import type { Club, EuroAccessState, Fixture, GameSave, Player, Tactics } from './types'
import type { LeagueId } from '@/data/world'
import { getLeague } from '@/data/world'
import { createPlayersForClubDef } from './worldSeed'
import { autoPickTactics } from './seed'
import { createClubSocial } from './social'
import uclFormat from '@/data/uclFormat.json'

export type EuroCupKind = 'ucl' | 'uel' | 'uecl'

/** ลีกยุโรปที่แข่งถ้วยยุโรปได้ — ไทยไม่ร่วม */
export const EUROPE_LEAGUE_IDS: LeagueId[] = ['eng', 'esp', 'ger', 'fra', 'ita']

export function isEuropeLeague(id: LeagueId | string): boolean {
  return (EUROPE_LEAGUE_IDS as string[]).includes(id)
}

export function createEuroAccess(): EuroAccessState {
  return { ranksByLeague: {} }
}

export function ensureEuroAccess(save: GameSave): EuroAccessState {
  return save.euroAccess ?? createEuroAccess()
}

/** ลำดับคีย์คลับจากชื่อเสียง (ใช้ซีซันแรก / ไม่มีประวัติ) */
export function ranksByReputation(leagueId: LeagueId): string[] {
  return getLeague(leagueId)
    .clubs.slice()
    .sort((a, b) => b.rep - a.rep)
    .map((c) => c.key)
}

export function resolveLeagueRanks(
  access: EuroAccessState,
  leagueId: LeagueId,
): string[] {
  const saved = access.ranksByLeague[leagueId]
  if (saved && saved.length >= 8) return saved
  return ranksByReputation(leagueId)
}

/** บันทึกอันดับจบซีซันจากตารางบ้าน + world pulse */
export function snapshotEuroRanks(save: GameSave): EuroAccessState {
  if (!isEuropeLeague(save.leagueId || 'eng')) {
    return ensureEuroAccess(save)
  }
  const homeId = (save.leagueId || 'eng') as LeagueId
  const ranksByLeague: Partial<Record<LeagueId, string[]>> = {
    ...ensureEuroAccess(save).ranksByLeague,
  }

  const table = [...(save.table ?? [])].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
  const homeKeys = table
    .map((row) => save.clubs.find((c) => c.id === row.clubId)?.crestKey)
    .filter((k): k is string => !!k)
  if (homeKeys.length >= 8) ranksByLeague[homeId] = homeKeys

  for (const row of save.worldPulse?.leagues ?? []) {
    if (!isEuropeLeague(row.leagueId)) continue
    if (row.leagueId === homeId) continue
    if (row.orderedKeys && row.orderedKeys.length >= 8) {
      ranksByLeague[row.leagueId as LeagueId] = row.orderedKeys
    }
  }

  return { ranksByLeague }
}

function uidInvite(kind: EuroCupKind, n: number) {
  return `${kind}-${n}`
}

function buildInviteClub(
  kind: EuroCupKind,
  idx: number,
  leagueId: LeagueId,
  def: ReturnType<typeof getLeague>['clubs'][0],
): Club {
  const id = uidInvite(kind, idx)
  const balance = Math.round(8_000_000 + def.rep * 220_000)
  return {
    id,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    controlledBy: 'ai',
    reputation: def.rep,
    stadiumCapacity: 35_000 + def.rep * 450,
    balance,
    wageBudgetWeekly: Math.round(90_000 + def.rep * 2_800),
    seasonStartBalance: balance,
    originLeagueId: leagueId,
    division: 1,
    crestKey: def.key,
    social: createClubSocial({
      id,
      name: def.name,
      shortName: def.shortName,
      reputation: def.rep,
      stadiumCapacity: 35_000 + def.rep * 450,
      division: 1,
    }),
  }
}

export type EuropePack = {
  clubs: Club[]
  players: Player[]
  tactics: Record<string, Tactics>
  uclField: Club[]
  uelField: Club[]
  ueclField: Club[]
}

/**
 * โควตาตายตัว (ยังไม่ใช้สัมประสิทธิ์):
 * 1–4 → UCL · 5–6 → Europa · 7–8 → Conference
 * ทุกลีกยุโรป 5 ลีก (ไม่มีไทย)
 */
export function createEuropeCupsPack(
  homeLeagueId: LeagueId,
  domesticDiv1: Club[],
  access: EuroAccessState,
): EuropePack {
  const empty: EuropePack = {
    clubs: [],
    players: [],
    tactics: {},
    uclField: [],
    uelField: [],
    ueclField: [],
  }
  if (!isEuropeLeague(homeLeagueId)) return empty

  const clubs: Club[] = []
  const players: Player[] = []
  const tactics: Record<string, Tactics> = {}
  const usedNames = new Set<string>()
  let n = 50_000
  let inviteN = 1

  const uclField: Club[] = []
  const uelField: Club[] = []
  const ueclField: Club[] = []

  const byKey = new Map(domesticDiv1.map((c) => [c.crestKey ?? '', c]))

  for (const leagueId of EUROPE_LEAGUE_IDS) {
    const order = resolveLeagueRanks(access, leagueId)
    const league = getLeague(leagueId)
    const defByKey = new Map(league.clubs.map((c) => [c.key, c]))

    const pickDefs = (from: number, to: number) =>
      order.slice(from, to).map((k) => defByKey.get(k)).filter(Boolean) as typeof league.clubs

    const addDomesticOrInvite = (defs: typeof league.clubs, kind: EuroCupKind, field: Club[]) => {
      for (const def of defs) {
        if (leagueId === homeLeagueId) {
          const local = byKey.get(def.key)
          if (local) {
            field.push(local)
            continue
          }
        }
        const club = buildInviteClub(kind, inviteN++, leagueId, def)
        clubs.push(club)
        field.push(club)
        const built = createPlayersForClubDef({
          leagueId,
          club,
          def,
          seed: 9000 + inviteN * 41,
          idPrefix: `${kind}-p`,
          startN: n,
          usedNames,
        })
        n = built.nextN
        players.push(...built.players)
        tactics[club.id] = autoPickTactics(club.id, built.players)
      }
    }

    addDomesticOrInvite(pickDefs(0, 4), 'ucl', uclField)
    addDomesticOrInvite(pickDefs(4, 6), 'uel', uelField)
    addDomesticOrInvite(pickDefs(6, 8), 'uecl', ueclField)
  }

  // กันซ้ำชื่อคลับใน field (edge case)
  const dedupe = (arr: Club[]) => {
    const seen = new Set<string>()
    return arr.filter((c) => {
      if (seen.has(c.id)) return false
      seen.add(c.id)
      return true
    })
  }

  return {
    clubs,
    players,
    tactics,
    uclField: dedupe(uclField).slice(0, (uclFormat as { fieldSize?: number }).fieldSize ?? 20),
    uelField: dedupe(uelField).slice(0, 10),
    ueclField: dedupe(ueclField).slice(0, 10),
  }
}

export function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** League phase สำหรับ N ทีม (N คู่) */
export function generateLeaguePhaseFixtures(
  field: Club[],
  competition: EuroCupKind,
  seasonStartDate: string,
  matchdayOffsets: number[],
): Fixture[] {
  const n = field.length
  if (n < 4 || n % 2 !== 0) return []
  const ids = field.map((c) => c.id)
  const fixtures: Fixture[] = []
  let fxN = 1
  const half = n / 2

  for (let mi = 0; mi < matchdayOffsets.length; mi++) {
    const md = matchdayOffsets[mi]
    const rot = ids.slice()
    for (let k = 0; k < mi; k++) {
      const last = rot.pop()!
      rot.splice(1, 0, last)
    }
    for (let i = 0; i < half; i++) {
      fixtures.push({
        id: `${competition}-league-${fxN++}`,
        matchday: md,
        date: addDays(seasonStartDate, (md - 1) * 7),
        homeClubId: rot[i],
        awayClubId: rot[n - 1 - i],
        played: false,
        competition,
        cupRound: 'league',
      })
    }
  }
  return fixtures
}

/**
 * Europa / Conference: 10 ทีม → play-in (7v10, 8v9) แล้ว QF 8 ทีม
 * เรียง seed ตามชื่อเสียง
 */
export function generateTenTeamEuroCupFixtures(
  field: Club[],
  competition: 'uel' | 'uecl',
  seasonStartDate: string,
  playinMd: number,
): Fixture[] {
  if (field.length < 8) return []
  const seeded = field.slice().sort((a, b) => b.reputation - a.reputation).slice(0, 10)
  if (seeded.length < 10) {
    // น้อยกว่า 10 → เข้า QF ตรงๆ คู่ตาม seed
    const fixtures: Fixture[] = []
    const qfMd = playinMd + 12
    for (let i = 0; i < Math.floor(seeded.length / 2); i++) {
      fixtures.push({
        id: `${competition}-qf-${i + 1}`,
        matchday: qfMd,
        date: addDays(seasonStartDate, (qfMd - 1) * 7),
        homeClubId: seeded[i].id,
        awayClubId: seeded[seeded.length - 1 - i].id,
        played: false,
        competition,
        cupRound: 'qf',
        leg: 1,
        tieId: `${competition}-tie-qf-${i + 1}`,
      })
    }
    return fixtures
  }

  // play-in: seed7 vs seed10, seed8 vs seed9 (0-based: 6v9, 7v8)
  return [
    {
      id: `${competition}-playin-1`,
      matchday: playinMd,
      date: addDays(seasonStartDate, (playinMd - 1) * 7),
      homeClubId: seeded[6].id,
      awayClubId: seeded[9].id,
      played: false,
      competition,
      cupRound: 'playin',
    },
    {
      id: `${competition}-playin-2`,
      matchday: playinMd,
      date: addDays(seasonStartDate, (playinMd - 1) * 7),
      homeClubId: seeded[7].id,
      awayClubId: seeded[8].id,
      played: false,
      competition,
      cupRound: 'playin',
    },
  ]
}

/** เก็บ bye seeds 1–6 ไว้ใน state ผ่าน note บน cup — ใช้ eliminated ไม่เหมาะ
 *  เก็บใน cup.playinByes แทน — เพิ่มบน CupState แบบ optional
 */
export function playinByeSeeds(field: Club[]): string[] {
  return field
    .slice()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 6)
    .map((c) => c.id)
}
