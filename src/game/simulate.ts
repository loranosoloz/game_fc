import type { Club, Fixture, GameSave, InboxMessage, MatchResult, Player, TableRow, Tactics } from './types'
import { applyMatchFatigue, simulateFixture } from './matchEngine'
import { autoPickTactics } from './seed'
import { applyMatchToFans, ensureFans, fanTicketMultiplier } from './fans'
import { applyMatchToBoard } from './board'
import { applyTrainingWeek, updatePlayingTimeMorale } from './training'
import { tickPlayerInjury } from './medical'
import { applyDevelopmentForSave } from './development'
import { recomputeDynamics, dynamicsMatchBonus } from './dynamics'
import { pressAfterMatch } from './press'
import { maybePromoteYouth } from './youth'
import { weeklyScoutPassive } from './scouting'
import { advanceCupAfterMatchday } from './cup'
import { advanceUclAfterMatchday } from './ucl'
import { staffLevel } from './staff'

function applyResultToTable(table: TableRow[], fixture: Fixture, homeGoals: number, awayGoals: number): TableRow[] {
  if (fixture.competition === 'cup' || fixture.competition === 'ucl') return table
  return table.map((row) => {
    if (row.clubId === fixture.homeClubId) {
      const won = homeGoals > awayGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + homeGoals,
        ga: row.ga + awayGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    if (row.clubId === fixture.awayClubId) {
      const won = awayGoals > homeGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + awayGoals,
        ga: row.ga + homeGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    return row
  })
}

function ticketIncome(
  club: Club,
  isHome: boolean,
  goalsFor: number,
  goalsAgainst: number,
  fanMult = 1,
) {
  if (!isHome) return 0
  const fill = 0.55 + Math.min(0.35, club.reputation / 200)
  const crowd = Math.round(club.stadiumCapacity * fill * fanMult)
  const mood = goalsFor >= goalsAgainst ? 1.05 : 0.95
  return Math.round(crowd * 18 * mood)
}

function bumpFamiliarity(tactics: Tactics, played: boolean): Tactics {
  if (!played) return tactics
  return {
    ...tactics,
    familiarity: Math.min(100, tactics.familiarity + 2),
  }
}

export interface PreparedMatchday {
  matchday: number
  date: string
  tacticsByClub: Record<string, Tactics>
  results: Array<{ fixture: Fixture; result: MatchResult }>
  humanResult: MatchResult | null
  humanFixture: Fixture | null
}

export function prepareMatchday(save: GameSave, matchday: number): PreparedMatchday | null {
  const dayFixtures = save.fixtures.filter((f) => f.matchday === matchday && !f.played)
  if (dayFixtures.length === 0) return null

  const players = save.players
  let tacticsByClub = { ...save.tacticsByClub }
  for (const club of save.clubs) {
    if (club.controlledBy === 'ai') {
      const current = tacticsByClub[club.id]
      const picked = autoPickTactics(club.id, players, current.formation, current.formationOop)
      tacticsByClub[club.id] = {
        ...picked,
        instructions: current.instructions,
        familiarity: current.familiarity,
        setPieces: current.setPieces,
      }
    }
  }

  const dynBonus =
    save.humanClubId && save.dynamics ? dynamicsMatchBonus(save.dynamics) : 1

  const results: PreparedMatchday['results'] = []
  let humanResult: MatchResult | null = null
  let humanFixture: Fixture | null = null

  for (const fixture of dayFixtures) {
    const result = simulateFixture(
      fixture,
      save.clubs,
      players,
      tacticsByClub,
      matchday * 17,
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
        ? dynBonus
        : 1,
    )
    results.push({ fixture, result })
    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    if (involvesHuman) {
      humanResult = result
      humanFixture = fixture
    }
  }

  return {
    matchday,
    date: dayFixtures[0]?.date ?? save.currentDate,
    tacticsByClub,
    results,
    humanResult,
    humanFixture,
  }
}

export function applyPreparedMatchday(save: GameSave, prepared: PreparedMatchday): GameSave {
  save = ensureFans(save)
  let fixtures = save.fixtures.slice()
  let table = save.table.slice()
  let players = save.players.slice()
  let clubs = save.clubs.map((c) => ({ ...c }))
  let fans = save.fans
  let board = save.board
  let press = save.press.slice()
  let cup = save.cup
  let ucl = save.ucl
  const inbox: InboxMessage[] = [...save.inbox]
  let tacticsByClub = { ...prepared.tacticsByClub }
  let humanResult: MatchResult | null = null

  for (const { fixture, result } of prepared.results) {
    fixtures = fixtures.map((f) =>
      f.id === fixture.id
        ? { ...f, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals }
        : f,
    )
    table = applyResultToTable(table, fixture, result.homeGoals, result.awayGoals)

    const home = clubs.find((c) => c.id === fixture.homeClubId)!
    const away = clubs.find((c) => c.id === fixture.awayClubId)!
    const isHumanHome = home.id === save.humanClubId
    const fanMult = isHumanHome ? fanTicketMultiplier(fans) : 1
    const homeIncome = ticketIncome(home, true, result.homeGoals, result.awayGoals, fanMult)
    clubs = clubs.map((c) => (c.id === home.id ? { ...c, balance: c.balance + homeIncome } : c))

    players = applyMatchFatigue(players, tacticsByClub[fixture.homeClubId], true)
    players = applyMatchFatigue(players, tacticsByClub[fixture.awayClubId], true)
    tacticsByClub[fixture.homeClubId] = bumpFamiliarity(tacticsByClub[fixture.homeClubId], true)
    tacticsByClub[fixture.awayClubId] = bumpFamiliarity(tacticsByClub[fixture.awayClubId], true)

    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    if (involvesHuman) {
      humanResult = result
      const opp = fixture.homeClubId === save.humanClubId ? away : home
      const usHome = fixture.homeClubId === save.humanClubId
      const usGoals = usHome ? result.homeGoals : result.awayGoals
      const themGoals = usHome ? result.awayGoals : result.homeGoals
      const outcome = usGoals > themGoals ? 'ชนะ' : usGoals === themGoals ? 'เสมอ' : 'แพ้'
      fans = applyMatchToFans(fans, usGoals, themGoals, usHome)

      const midSave: GameSave = {
        ...save,
        table,
        fans,
        board,
        players,
        clubs,
        tacticsByClub,
        fixtures,
      }
      board = applyMatchToBoard(midSave, usGoals, themGoals)
      press = [pressAfterMatch({ ...midSave, board }, usGoals, themGoals, opp.name), ...press].slice(
        0,
        30,
      )

      const comp =
        fixture.competition === 'cup'
          ? `ถ้วย (${fixture.cupRound})`
          : fixture.competition === 'ucl'
            ? `UCL (${fixture.cupRound})`
            : 'ลีก'
      inbox.unshift({
        id: `msg-${Date.now()}-${fixture.id}`,
        date: fixture.date,
        title: `${outcome} พบ ${opp.name} · ${comp}`,
        body: `สกอร์ ${result.homeGoals}–${result.awayGoals} · ตั๋วเหย้า ${homeIncome.toLocaleString('th-TH')} บาท · แฟน: ${fans.lastVerdict}`,
        read: false,
      })
    }
  }

  const cupAdv = advanceCupAfterMatchday(fixtures, cup, prepared.matchday)
  fixtures = cupAdv.fixtures
  cup = cupAdv.cup
  if (cup.championClubId && !save.cup.championClubId) {
    const champ = clubs.find((c) => c.id === cup.championClubId)
    inbox.unshift({
      id: `msg-cup-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of the Cup',
      body: `${champ?.name ?? cup.championClubId} คว้าแชมป์ ${cup.name}`,
      read: false,
    })
  }

  const uclAdv = advanceUclAfterMatchday(fixtures, ucl, prepared.matchday)
  fixtures = uclAdv.fixtures
  ucl = uclAdv.ucl
  if (ucl.championClubId && !save.ucl?.championClubId) {
    const champ = clubs.find((c) => c.id === ucl.championClubId)
    inbox.unshift({
      id: `msg-ucl-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of Europe',
      body: `${champ?.name ?? ucl.championClubId} คว้าแชมป์ ${ucl.name}`,
      read: false,
    })
  }

  let next: GameSave = {
    ...save,
    fixtures,
    table,
    players,
    clubs,
    tacticsByClub,
    fans,
    board,
    press,
    cup,
    ucl,
    inbox: inbox.slice(0, 40),
    lastHumanResult: humanResult ?? save.lastHumanResult,
    matchday: prepared.matchday,
    seasonComplete: fixtures.filter((f) => f.competition === 'league').every((f) => f.played),
    currentDate: prepared.date,
  }

  const trained = applyTrainingWeek(next.players, next.humanClubId, next.training)
  const coachBoost = staffLevel(next.staff, 'coach') / 40
  next = {
    ...next,
    players: trained.players.map((p) =>
      p.clubId === next.humanClubId
        ? { ...p, sharpness: Math.min(100, p.sharpness + coachBoost) }
        : p,
    ),
    inbox: [
      {
        id: `msg-train-${Date.now()}`,
        date: prepared.date,
        title: 'สรุปการซ้อม',
        body: trained.note,
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }
  next = { ...next, players: updatePlayingTimeMorale(next) }
  next = { ...next, dynamics: recomputeDynamics(next) }
  next = applyDevelopmentForSave(next)
  next = maybePromoteYouth(next)
  next = { ...next, scouting: weeklyScoutPassive(next, next.staff) }

  return next
}

export function simulateMatchday(save: GameSave, matchday: number) {
  const prepared = prepareMatchday(save, matchday)
  if (!prepared) {
    return { save, humanResult: null, resultsCount: 0 }
  }
  return {
    save: applyPreparedMatchday(save, prepared),
    humanResult: prepared.humanResult,
    resultsCount: prepared.results.length,
  }
}

export function payWeeklyWages(clubs: Club[], players: Player[]): Club[] {
  return clubs.map((club) => {
    const wages = players.filter((p) => p.clubId === club.id).reduce((s, p) => s + p.wage, 0)
    return { ...club, balance: club.balance - wages }
  })
}

export function recoverSquad(players: Player[], physioLevel = 8): Player[] {
  return players.map((p) => tickPlayerInjury(p, physioLevel))
}

export function sortedTable(table: TableRow[]) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

export function nextUnplayedMatchday(save: GameSave): number | null {
  const upcoming = save.fixtures.filter((f) => !f.played)
  if (upcoming.length === 0) return null
  return Math.min(...upcoming.map((f) => f.matchday))
}
