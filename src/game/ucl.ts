import uclFormat from '@/data/uclFormat.json'
import type { Club, CupState, Fixture, GameSave, Player, Tactics } from './types'
import { ALL_LEAGUES, getLeague, type LeagueId } from '@/data/world'
import { createPlayersForClubDef } from './worldSeed'
import { autoPickTactics } from './seed'

export type UclState = CupState

export function createUclState(): UclState {
  return {
    name: uclFormat.name,
    championClubId: null,
    eliminated: [],
  }
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** Top clubs from other leagues → invite AI clubs (ucl-*). */
export function createUclInviteClubs(homeLeagueId: LeagueId): {
  clubs: Club[]
  players: Player[]
  tactics: Record<string, Tactics>
} {
  const others = ALL_LEAGUES.filter((l) => l.id !== homeLeagueId)
  const candidates: Array<{ leagueId: LeagueId; clubIndex: number; rep: number }> = []
  for (const league of others) {
    league.clubs.forEach((c, i) => {
      candidates.push({ leagueId: league.id as LeagueId, clubIndex: i, rep: c.rep })
    })
  }
  candidates.sort((a, b) => b.rep - a.rep)
  const picked = candidates.slice(0, uclFormat.inviteSlots)

  const clubs: Club[] = []
  const players: Player[] = []
  const tactics: Record<string, Tactics> = {}
  const usedNames = new Set<string>()
  let n = 50_000

  picked.forEach((pick, idx) => {
    const league = getLeague(pick.leagueId)
    const def = league.clubs[pick.clubIndex]
    const id = `ucl-${idx + 1}`
    const balance = Math.round(10_000_000 + def.rep * 250_000)
    const club: Club = {
      id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      controlledBy: 'ai',
      reputation: def.rep,
      stadiumCapacity: 40_000 + def.rep * 500,
      balance,
      wageBudgetWeekly: Math.round(100_000 + def.rep * 3_000),
      seasonStartBalance: balance,
    }
    clubs.push(club)

    const built = createPlayersForClubDef({
      leagueId: pick.leagueId,
      club,
      def,
      seed: 8000 + idx * 97,
      idPrefix: 'ucl-p',
      startN: n,
      usedNames,
    })
    n = built.nextN
    players.push(...built.players)
    tactics[id] = autoPickTactics(id, built.players)
  })

  return { clubs, players, tactics }
}

/** Top 4 domestic by rep (human always included) + invite clubs → R16. */
export function generateUclFixtures(
  domesticClubs: Club[],
  inviteClubs: Club[],
  humanClubId: string,
  seasonStartDate: string,
): Fixture[] {
  const domesticSlots = uclFormat.domesticSlots
  let domestic = domesticClubs
    .slice()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, domesticSlots)

  if (!domestic.some((c) => c.id === humanClubId)) {
    const human = domesticClubs.find((c) => c.id === humanClubId)
    if (human) domestic = [...domestic.slice(0, domesticSlots - 1), human]
  }

  const field = [...domestic, ...inviteClubs].slice(0, 16)
  if (field.length < 16) return []

  const r16 = uclFormat.rounds[0]
  const fixtures: Fixture[] = []
  for (let i = 0; i < 8; i++) {
    const home = field[i]
    const away = field[15 - i]
    fixtures.push({
      id: `ucl-${r16.id}-${i + 1}`,
      matchday: r16.matchdayOffset,
      date: addDays(seasonStartDate, (r16.matchdayOffset - 1) * 7),
      homeClubId: home.id,
      awayClubId: away.id,
      played: false,
      competition: 'ucl',
      cupRound: r16.id,
    })
  }
  return fixtures
}

export function advanceUclAfterMatchday(
  fixtures: Fixture[],
  ucl: UclState,
  matchday: number,
): { fixtures: Fixture[]; ucl: UclState } {
  const roundOrder = uclFormat.rounds.map((r) => r.id)
  const playedThis = fixtures.filter(
    (f) => f.competition === 'ucl' && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, ucl }

  const roundId = playedThis[0].cupRound
  if (!roundId) return { fixtures, ucl }

  const winners: string[] = []
  const eliminated = [...ucl.eliminated]
  for (const f of playedThis) {
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
    const winner = hg >= ag ? f.homeClubId : f.awayClubId
    const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
    winners.push(winner)
    if (!eliminated.includes(loser)) eliminated.push(loser)
  }

  const idx = roundOrder.indexOf(roundId)
  if (idx === roundOrder.length - 1) {
    return {
      fixtures,
      ucl: { ...ucl, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = uclFormat.rounds[idx + 1]
  const existingNext = fixtures.some((f) => f.competition === 'ucl' && f.cupRound === nextRound.id)
  if (existingNext || winners.length < 2) {
    return { fixtures, ucl: { ...ucl, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    newFx.push({
      id: `ucl-${nextRound.id}-${i / 2 + 1}`,
      matchday: nextRound.matchdayOffset,
      date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      played: false,
      competition: 'ucl',
      cupRound: nextRound.id,
    })
  }

  return {
    fixtures: [...fixtures, ...newFx],
    ucl: { ...ucl, eliminated },
  }
}

export function isUclClub(clubId: string) {
  return clubId.startsWith('ucl-')
}

export function domesticClubsOnly(save: GameSave): Club[] {
  return save.clubs.filter((c) => !isUclClub(c.id))
}
