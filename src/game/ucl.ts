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
      originLeagueId: pick.leagueId,
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

/** Top 4 domestic + invite → league phase (16 ทีม เล่น 6 นัด) แล้ว top 8 เข้า QF */
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

  const leagueRound = uclFormat.rounds[0] as {
    id: string
    leaguePhase?: boolean
    matchdayOffsets?: number[]
  }
  if (!leagueRound.leaguePhase || !leagueRound.matchdayOffsets?.length) {
    // fallback แบบเก่า
    const r16 = uclFormat.rounds[0]
    const fixtures: Fixture[] = []
    for (let i = 0; i < 8; i++) {
      fixtures.push({
        id: `ucl-${r16.id}-${i + 1}`,
        matchday: (r16 as { matchdayOffset: number }).matchdayOffset,
        date: addDays(seasonStartDate, ((r16 as { matchdayOffset: number }).matchdayOffset - 1) * 7),
        homeClubId: field[i].id,
        awayClubId: field[15 - i].id,
        played: false,
        competition: 'ucl',
        cupRound: r16.id,
      })
    }
    return fixtures
  }

  const fixtures: Fixture[] = []
  const ids = field.map((c) => c.id)
  let fxN = 1
  for (let mi = 0; mi < leagueRound.matchdayOffsets.length; mi++) {
    const md = leagueRound.matchdayOffsets[mi]
    // หมุนคู่แข่งแต่ละนัด
    const rot = ids.slice()
    for (let k = 0; k < mi; k++) {
      const last = rot.pop()!
      rot.splice(1, 0, last)
    }
    for (let i = 0; i < 8; i++) {
      const home = rot[i]
      const away = rot[15 - i]
      fixtures.push({
        id: `ucl-league-${fxN++}`,
        matchday: md,
        date: addDays(seasonStartDate, (md - 1) * 7),
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition: 'ucl',
        cupRound: 'league',
      })
    }
  }
  return fixtures
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

  const roundMeta = uclFormat.rounds.find((r) => r.id === roundId) as {
    id: string
    leaguePhase?: boolean
    qualifyCount?: number
    twoLegged?: boolean
    returnOffset?: number
    matchdayOffset?: number
  }
  const roundAll = fixtures.filter((f) => f.competition === 'ucl' && f.cupRound === roundId)
  if (!roundAll.every((f) => f.played)) {
    return { fixtures, ucl }
  }

  let winners: string[] = []
  const eliminated = [...ucl.eliminated]

  if (roundMeta?.leaguePhase) {
    const ranked = leaguePhaseTable(roundAll)
    const q = roundMeta.qualifyCount ?? 8
    winners = ranked.slice(0, q)
    for (const id of ranked.slice(q)) {
      if (!eliminated.includes(id)) eliminated.push(id)
    }
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
      ucl: { ...ucl, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = uclFormat.rounds[idx + 1] as {
    id: string
    matchdayOffset: number
    twoLegged?: boolean
    returnOffset?: number
  }
  const existingNext = fixtures.some((f) => f.competition === 'ucl' && f.cupRound === nextRound.id)
  if (existingNext || winners.length < 2) {
    return { fixtures, ucl: { ...ucl, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    const home = winners[i]
    const away = winners[i + 1]
    const tieId = `ucl-tie-${nextRound.id}-${i / 2 + 1}`
    if (nextRound.twoLegged) {
      newFx.push({
        id: `ucl-${nextRound.id}-${i / 2 + 1}-l1`,
        matchday: nextRound.matchdayOffset,
        date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition: 'ucl',
        cupRound: nextRound.id,
        leg: 1,
        tieId,
      })
      const ret = nextRound.returnOffset ?? nextRound.matchdayOffset + 2
      newFx.push({
        id: `ucl-${nextRound.id}-${i / 2 + 1}-l2`,
        matchday: ret,
        date: addDays(playedThis[0].date, (ret - matchday) * 7),
        homeClubId: away,
        awayClubId: home,
        played: false,
        competition: 'ucl',
        cupRound: nextRound.id,
        leg: 2,
        tieId,
      })
    } else {
      newFx.push({
        id: `ucl-${nextRound.id}-${i / 2 + 1}`,
        matchday: nextRound.matchdayOffset,
        date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition: 'ucl',
        cupRound: nextRound.id,
      })
    }
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
