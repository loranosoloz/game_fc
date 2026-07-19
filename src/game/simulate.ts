import type { Club, Fixture, GameSave, InboxMessage, MatchResult, Player, TableRow, Tactics } from './types'
import { applyMatchFatigue, simulateFixture } from './matchEngine'
import { autoPickTactics } from './seed'
import { applyMatchToFans, ensureFans, fanTicketMultiplier } from './fans'

function applyResultToTable(table: TableRow[], fixture: Fixture, homeGoals: number, awayGoals: number): TableRow[] {
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

export interface PreparedMatchday {
  matchday: number
  date: string
  tacticsByClub: Record<string, Tactics>
  results: Array<{ fixture: Fixture; result: MatchResult }>
  humanResult: MatchResult | null
  humanFixture: Fixture | null
}

/** Pre-simulate entire matchday (human + AI) without writing to save yet. */
export function prepareMatchday(save: GameSave, matchday: number): PreparedMatchday | null {
  const dayFixtures = save.fixtures.filter((f) => f.matchday === matchday && !f.played)
  if (dayFixtures.length === 0) return null

  let players = save.players
  let tacticsByClub = { ...save.tacticsByClub }
  for (const club of save.clubs) {
    if (club.controlledBy === 'ai') {
      tacticsByClub[club.id] = autoPickTactics(club.id, players, tacticsByClub[club.id].formation)
    }
  }

  const results: PreparedMatchday['results'] = []
  let humanResult: MatchResult | null = null
  let humanFixture: Fixture | null = null

  for (const fixture of dayFixtures) {
    const result = simulateFixture(fixture, save.clubs, players, tacticsByClub, matchday * 17)
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

/** Apply a prepared matchday package to the save (after live watch or instant skip). */
export function applyPreparedMatchday(save: GameSave, prepared: PreparedMatchday): GameSave {
  save = ensureFans(save)
  let fixtures = save.fixtures.slice()
  let table = save.table.slice()
  let players = save.players.slice()
  let clubs = save.clubs.map((c) => ({ ...c }))
  let fans = save.fans
  const inbox: InboxMessage[] = [...save.inbox]
  const tacticsByClub = prepared.tacticsByClub
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
      inbox.unshift({
        id: `msg-${Date.now()}-${fixture.id}`,
        date: fixture.date,
        title: `${outcome} พบ ${opp.name}`,
        body: `สกอร์ ${result.homeGoals}–${result.awayGoals} · ตั๋วเหย้า ${homeIncome.toLocaleString('th-TH')} บาท · แฟน: ${fans.lastVerdict}`,
        read: false,
      })
    }
  }

  return {
    ...save,
    fixtures,
    table,
    players,
    clubs,
    tacticsByClub,
    fans,
    inbox: inbox.slice(0, 40),
    lastHumanResult: humanResult ?? save.lastHumanResult,
    matchday: prepared.matchday,
    seasonComplete: fixtures.every((f) => f.played),
    currentDate: prepared.date,
  }
}

/** Instant simulate (no live pitch) — used as fallback / skip. */
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

export function recoverSquad(players: Player[]): Player[] {
  return players.map((p) => ({
    ...p,
    condition: Math.min(100, p.condition + 3),
  }))
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
