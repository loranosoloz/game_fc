import type { Club, Fixture, GameSave, InboxMessage, MatchResult, Player, TableRow } from './types'
import { applyMatchFatigue, simulateFixture } from './matchEngine'
import { autoPickTactics } from './seed'

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

function ticketIncome(club: Club, isHome: boolean, goalsFor: number, goalsAgainst: number) {
  if (!isHome) return 0
  const fill = 0.55 + Math.min(0.35, club.reputation / 200)
  const crowd = Math.round(club.stadiumCapacity * fill)
  const mood = goalsFor >= goalsAgainst ? 1.05 : 0.95
  return Math.round(crowd * 18 * mood)
}

/** Simulate every unplayed fixture on a matchday — human + all AI clubs. */
export function simulateMatchday(save: GameSave, matchday: number): {
  save: GameSave
  humanResult: MatchResult | null
  resultsCount: number
} {
  const dayFixtures = save.fixtures.filter((f) => f.matchday === matchday && !f.played)
  if (dayFixtures.length === 0) {
    return { save, humanResult: null, resultsCount: 0 }
  }

  let fixtures = save.fixtures.slice()
  let table = save.table.slice()
  let players = save.players.slice()
  let clubs = save.clubs.map((c) => ({ ...c }))
  let humanResult: MatchResult | null = null
  const inbox: InboxMessage[] = [...save.inbox]
  let tacticsByClub = { ...save.tacticsByClub }

  // AI refreshes XI lightly before matchday
  for (const club of clubs) {
    if (club.controlledBy === 'ai') {
      tacticsByClub[club.id] = autoPickTactics(club.id, players, tacticsByClub[club.id].formation)
    }
  }

  for (const fixture of dayFixtures) {
    const result = simulateFixture(fixture, clubs, players, tacticsByClub, matchday * 17)
    fixtures = fixtures.map((f) =>
      f.id === fixture.id
        ? { ...f, played: true, homeGoals: result.homeGoals, awayGoals: result.awayGoals }
        : f,
    )
    table = applyResultToTable(table, fixture, result.homeGoals, result.awayGoals)

    const home = clubs.find((c) => c.id === fixture.homeClubId)!
    const away = clubs.find((c) => c.id === fixture.awayClubId)!
    const homeIncome = ticketIncome(home, true, result.homeGoals, result.awayGoals)
    clubs = clubs.map((c) => {
      if (c.id === home.id) return { ...c, balance: c.balance + homeIncome }
      return c
    })

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
      const outcome = usGoals > themGoals ? 'Win' : usGoals === themGoals ? 'Draw' : 'Loss'
      inbox.unshift({
        id: `msg-${Date.now()}-${fixture.id}`,
        date: fixture.date,
        title: `${outcome} vs ${opp.name}`,
        body: `Final score ${result.homeGoals}–${result.awayGoals}. Gate receipts for home side: £${homeIncome.toLocaleString()}. All other matchday fixtures (AI vs AI) were also simulated.`,
        read: false,
      })
    }
  }

  const seasonComplete = fixtures.every((f) => f.played)

  return {
    save: {
      ...save,
      fixtures,
      table,
      players,
      clubs,
      tacticsByClub,
      inbox: inbox.slice(0, 40),
      lastHumanResult: humanResult ?? save.lastHumanResult,
      matchday,
      seasonComplete,
      currentDate: dayFixtures[0]?.date ?? save.currentDate,
    },
    humanResult,
    resultsCount: dayFixtures.length,
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
