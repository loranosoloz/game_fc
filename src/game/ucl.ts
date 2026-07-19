import uclFormat from '@/data/uclFormat.json'
import uelFormat from '@/data/uelFormat.json'
import ueclFormat from '@/data/ueclFormat.json'
import type { Club, CupState, Fixture, Player, Tactics } from './types'
import type { LeagueId } from '@/data/world'
import {
  createEuropeCupsPack,
  generateLeaguePhaseFixtures,
  generateTenTeamEuroCupFixtures,
  playinByeSeeds,
  isEuropeLeague,
  EUROPE_LEAGUE_IDS,
} from './europeAccess'

export type UclState = CupState
export { isEuropeLeague, EUROPE_LEAGUE_IDS }

export function createUclState(): UclState {
  return {
    name: uclFormat.name,
    championClubId: null,
    eliminated: [],
  }
}

export function createUelState(): CupState {
  return { name: uelFormat.name, championClubId: null, eliminated: [], playinByes: [] }
}

export function createUeclState(): CupState {
  return { name: ueclFormat.name, championClubId: null, eliminated: [], playinByes: [] }
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** @deprecated — ใช้ createEuropeCupsPack */
export function createUclInviteClubs(homeLeagueId: LeagueId): {
  clubs: Club[]
  players: Player[]
  tactics: Record<string, Tactics>
} {
  const pack = createEuropeCupsPack(homeLeagueId, [], { ranksByLeague: {} })
  return { clubs: pack.clubs, players: pack.players, tactics: pack.tactics }
}

export function generateUclFixtures(
  field: Club[],
  seasonStartDate: string,
  homeLeagueId?: LeagueId,
): Fixture[] {
  if (homeLeagueId && !isEuropeLeague(homeLeagueId)) return []
  const size = (uclFormat as { fieldSize?: number }).fieldSize ?? 20
  if (field.length < size) return []
  const offsets =
    (uclFormat.rounds[0] as { matchdayOffsets?: number[] }).matchdayOffsets ?? [
      4, 6, 8, 10, 12, 14,
    ]
  return generateLeaguePhaseFixtures(field.slice(0, size), 'ucl', seasonStartDate, offsets)
}

export function generateUelFixtures(
  field: Club[],
  seasonStartDate: string,
  homeLeagueId?: LeagueId,
): { fixtures: Fixture[]; byes: string[] } {
  if (homeLeagueId && !isEuropeLeague(homeLeagueId)) return { fixtures: [], byes: [] }
  const md = (uelFormat.rounds[0] as { matchdayOffset: number }).matchdayOffset
  const fixtures = generateTenTeamEuroCupFixtures(field, 'uel', seasonStartDate, md)
  return { fixtures, byes: playinByeSeeds(field) }
}

export function generateUeclFixtures(
  field: Club[],
  seasonStartDate: string,
  homeLeagueId?: LeagueId,
): { fixtures: Fixture[]; byes: string[] } {
  if (homeLeagueId && !isEuropeLeague(homeLeagueId)) return { fixtures: [], byes: [] }
  const md = (ueclFormat.rounds[0] as { matchdayOffset: number }).matchdayOffset
  const fixtures = generateTenTeamEuroCupFixtures(field, 'uecl', seasonStartDate, md)
  return { fixtures, byes: playinByeSeeds(field) }
}

function leaguePhaseTable(fixtures: Fixture[]): string[] {
  const stats = new Map<string, { pts: number; gd: number; gf: number }>()
  const bump = (id: string, pts: number, gf: number, ga: number) => {
    const cur = stats.get(id) ?? { pts: 0, gd: 0, gf: 0 }
    stats.set(id, {
      pts: cur.pts + pts,
      gd: cur.gd + (gf - ga),
      gf: cur.gf + gf,
    })
  }
  for (const f of fixtures) {
    if (!f.played) continue
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
    if (hg > ag) {
      bump(f.homeClubId, 3, hg, ag)
      bump(f.awayClubId, 0, ag, hg)
    } else if (hg < ag) {
      bump(f.awayClubId, 3, ag, hg)
      bump(f.homeClubId, 0, hg, ag)
    } else {
      bump(f.homeClubId, 1, hg, ag)
      bump(f.awayClubId, 1, ag, hg)
    }
  }
  return [...stats.entries()]
    .sort((a, b) => {
      if (b[1].pts !== a[1].pts) return b[1].pts - a[1].pts
      if (b[1].gd !== a[1].gd) return b[1].gd - a[1].gd
      return b[1].gf - a[1].gf
    })
    .map(([id]) => id)
}

function advanceEuroKnockout(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
  competition: 'ucl' | 'uel' | 'uecl',
  format: { rounds: Array<Record<string, unknown>>; name: string },
): { fixtures: Fixture[]; cup: CupState } {
  const roundOrder = format.rounds.map((r) => r.id as string)
  const playedThis = fixtures.filter(
    (f) => f.competition === competition && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, cup }

  const roundId = playedThis[0].cupRound
  if (!roundId) return { fixtures, cup }

  const roundMeta = format.rounds.find((r) => r.id === roundId) as {
    id: string
    leaguePhase?: boolean
    qualifyCount?: number
    twoLegged?: boolean
    returnOffset?: number
    matchdayOffset?: number
  }
  const roundAll = fixtures.filter((f) => f.competition === competition && f.cupRound === roundId)
  if (!roundAll.every((f) => f.played)) {
    return { fixtures, cup }
  }

  let winners: string[] = []
  const eliminated = [...cup.eliminated]

  if (roundMeta?.leaguePhase) {
    const ranked = leaguePhaseTable(roundAll)
    const q = roundMeta.qualifyCount ?? 8
    winners = ranked.slice(0, q)
    for (const id of ranked.slice(q)) {
      if (!eliminated.includes(id)) eliminated.push(id)
    }
  } else if (roundId === 'playin') {
    for (const f of roundAll) {
      const hg = f.homeGoals ?? 0
      const ag = f.awayGoals ?? 0
      const winner = hg >= ag ? f.homeClubId : f.awayClubId
      const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
      winners.push(winner)
      if (!eliminated.includes(loser)) eliminated.push(loser)
    }
    winners = [...(cup.playinByes ?? []), ...winners]
  } else if (roundMeta?.twoLegged) {
    const byTie = new Map<string, Fixture[]>()
    for (const f of roundAll) {
      const tid = f.tieId ?? f.id
      const list = byTie.get(tid) ?? []
      list.push(f)
      byTie.set(tid, list)
    }
    for (const [, legs] of byTie) {
      const a = legs[0].homeClubId
      const b = legs[0].awayClubId
      let goalsA = 0
      let goalsB = 0
      for (const leg of legs) {
        const hg = leg.homeGoals ?? 0
        const ag = leg.awayGoals ?? 0
        if (leg.homeClubId === a) {
          goalsA += hg
          goalsB += ag
        } else {
          goalsA += ag
          goalsB += hg
        }
      }
      const winner = goalsA >= goalsB ? a : b
      const loser = winner === a ? b : a
      winners.push(winner)
      if (!eliminated.includes(loser)) eliminated.push(loser)
    }
  } else {
    for (const f of roundAll) {
      const hg = f.homeGoals ?? 0
      const ag = f.awayGoals ?? 0
      const winner = hg >= ag ? f.homeClubId : f.awayClubId
      const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
      winners.push(winner)
      if (!eliminated.includes(loser)) eliminated.push(loser)
    }
  }

  const idx = roundOrder.indexOf(roundId)
  if (idx === roundOrder.length - 1) {
    return {
      fixtures,
      cup: { ...cup, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = format.rounds[idx + 1] as {
    id: string
    matchdayOffset: number
    twoLegged?: boolean
    returnOffset?: number
  }
  const existingNext = fixtures.some(
    (f) => f.competition === competition && f.cupRound === nextRound.id,
  )
  if (existingNext || winners.length < 2) {
    return { fixtures, cup: { ...cup, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    const home = winners[i]
    const away = winners[i + 1]
    const tieId = `${competition}-tie-${nextRound.id}-${i / 2 + 1}`
    if (nextRound.twoLegged) {
      newFx.push({
        id: `${competition}-${nextRound.id}-${i / 2 + 1}-l1`,
        matchday: nextRound.matchdayOffset,
        date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition,
        cupRound: nextRound.id,
        leg: 1,
        tieId,
      })
      const ret = nextRound.returnOffset ?? nextRound.matchdayOffset + 2
      newFx.push({
        id: `${competition}-${nextRound.id}-${i / 2 + 1}-l2`,
        matchday: ret,
        date: addDays(playedThis[0].date, (ret - matchday) * 7),
        homeClubId: away,
        awayClubId: home,
        played: false,
        competition,
        cupRound: nextRound.id,
        leg: 2,
        tieId,
      })
    } else {
      newFx.push({
        id: `${competition}-${nextRound.id}-${i / 2 + 1}`,
        matchday: nextRound.matchdayOffset,
        date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition,
        cupRound: nextRound.id,
      })
    }
  }

  return {
    fixtures: [...fixtures, ...newFx],
    cup: { ...cup, eliminated },
  }
}

export function advanceUclAfterMatchday(
  fixtures: Fixture[],
  ucl: UclState,
  matchday: number,
): { fixtures: Fixture[]; ucl: UclState } {
  const r = advanceEuroKnockout(fixtures, ucl, matchday, 'ucl', uclFormat)
  return { fixtures: r.fixtures, ucl: r.cup }
}

export function advanceUelAfterMatchday(
  fixtures: Fixture[],
  uel: CupState,
  matchday: number,
): { fixtures: Fixture[]; uel: CupState } {
  const r = advanceEuroKnockout(fixtures, uel, matchday, 'uel', uelFormat)
  return { fixtures: r.fixtures, uel: r.cup }
}

export function advanceUeclAfterMatchday(
  fixtures: Fixture[],
  uecl: CupState,
  matchday: number,
): { fixtures: Fixture[]; uecl: CupState } {
  const r = advanceEuroKnockout(fixtures, uecl, matchday, 'uecl', ueclFormat)
  return { fixtures: r.fixtures, uecl: r.cup }
}

export { createEuropeCupsPack }
