/**
 * AFC club access: ACL Elite (ชั้น 1) · ACL Two (ชั้น 2) · ASEAN Club Championship (ภูมิภาค)
 */
import type { Club, CupState, Fixture, GameSave, Player, Tactics } from './types'
import type { LeagueId } from '@/data/world'
import { getLeague } from '@/data/world'
import { createPlayersForClubDef } from './worldSeed'
import { autoPickTactics } from './seed'
import { createClubSocial } from './social'
import { createClubFans } from './fans'
import { ACL_LEAGUE_IDS, ASEAN_LEAGUE_IDS, isAclLeague, isAseanLeague } from './awards'
import aclFormat from '@/data/aclFormat.json'
import aclTwoFormat from '@/data/aclTwoFormat.json'
import aseanCupFormat from '@/data/aseanCupFormat.json'
import { shiftMidweekDate } from './calendarDates'

export type AsiaCupKind = 'acl' | 'acl_two' | 'asean_cup'

export type AsiaAccessState = {
  ranksByLeague: Partial<Record<LeagueId, string[]>>
}

/** โควต้า ACL Elite ต่อลีก (ชั้นบน — ซาอุ/ญี่ปุ่น/เกาหลีเน้น) */
export const ACL_ELITE_SLOTS: Partial<Record<LeagueId, number>> = {
  sau: 3,
  jpn: 3,
  kor: 2,
  tha: 1,
}

/** โควต้า ACL Two ต่อลีก (ชั้นสอง — ไทย/อาเซียนเน้น + ทีมรองจากลีกใหญ่) */
export const ACL_TWO_SLOTS: Partial<Record<LeagueId, number>> = {
  tha: 2,
  vie: 2,
  idn: 2,
  mys: 2,
  sgp: 1,
  sau: 1,
  jpn: 1,
  kor: 1,
}

export function createAsiaAccess(): AsiaAccessState {
  return { ranksByLeague: {} }
}

export function ensureAsiaAccess(save: GameSave): AsiaAccessState {
  return save.asiaAccess ?? createAsiaAccess()
}

function ranksByReputation(leagueId: LeagueId): string[] {
  return getLeague(leagueId)
    .clubs.slice()
    .sort((a, b) => b.rep - a.rep)
    .map((c) => c.key)
}

function resolveRanks(access: AsiaAccessState, leagueId: LeagueId): string[] {
  const saved = access.ranksByLeague[leagueId]
  if (saved && saved.length >= 4) return saved
  return ranksByReputation(leagueId)
}

/** บันทึกอันดับจบลีกเอเชีย (โควตา Elite / Two / ASEAN) */
export function snapshotAsiaRanks(save: GameSave): AsiaAccessState {
  const homeId = (save.leagueId || 'eng') as LeagueId
  if (!isAclLeague(homeId) && !isAseanLeague(homeId)) {
    return ensureAsiaAccess(save)
  }
  const ranksByLeague: Partial<Record<LeagueId, string[]>> = {
    ...ensureAsiaAccess(save).ranksByLeague,
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
  if (homeKeys.length >= 4) ranksByLeague[homeId] = homeKeys

  for (const row of save.worldPulse?.leagues ?? []) {
    if (!isAclLeague(row.leagueId) && !isAseanLeague(row.leagueId)) continue
    if (row.leagueId === homeId) continue
    if (row.orderedKeys && row.orderedKeys.length >= 4) {
      ranksByLeague[row.leagueId as LeagueId] = row.orderedKeys
    }
  }
  return { ranksByLeague }
}

function buildInviteClub(
  kind: AsiaCupKind,
  idx: number,
  leagueId: LeagueId,
  def: ReturnType<typeof getLeague>['clubs'][0],
): Club {
  const id = `${kind}-${idx}`
  const moneyMult = leagueId === 'sau' ? 4.5 : leagueId === 'jpn' || leagueId === 'kor' ? 2.2 : 1
  const balance = Math.round((6_000_000 + def.rep * 180_000) * moneyMult)
  return {
    id,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    controlledBy: 'ai',
    reputation: def.rep,
    stadiumCapacity: 28_000 + def.rep * 400,
    balance,
    wageBudgetWeekly: Math.round((70_000 + def.rep * 2_400) * moneyMult),
    seasonStartBalance: balance,
    originLeagueId: leagueId,
    division: 1,
    crestKey: def.key,
    clubFans: createClubFans(def.rep),
    social: createClubSocial({
      id,
      name: def.name,
      shortName: def.shortName,
      reputation: def.rep,
      stadiumCapacity: 28_000 + def.rep * 400,
      division: 1,
    }),
  }
}

export type AsiaPack = {
  clubs: Club[]
  players: Player[]
  tactics: Record<string, Tactics>
  /** ACL Elite field */
  aclField: Club[]
  /** ACL Two field */
  aclTwoField: Club[]
  aseanField: Club[]
}

/**
 * สร้างโผถ้วยเอเชีย
 * — Elite: ซาอุ/ญี่ปุ่น/เกาหลี + แชมป์ไทย
 * — Two: ไทย/อาเซียนหลัก + ทีมรองจากลีกใหญ่
 * — ASEAN: ถ้วยภูมิภาค (ไม่ซ้ำกับ Elite)
 */
export function createAsiaCupsPack(
  homeLeagueId: LeagueId,
  domesticDiv1: Club[],
  access: AsiaAccessState,
): AsiaPack {
  const empty: AsiaPack = {
    clubs: [],
    players: [],
    tactics: {},
    aclField: [],
    aclTwoField: [],
    aseanField: [],
  }
  const inAcl = isAclLeague(homeLeagueId)
  const inAsean = isAseanLeague(homeLeagueId)
  if (!inAcl && !inAsean) return empty

  const clubs: Club[] = []
  const players: Player[] = []
  const tactics: Record<string, Tactics> = {}
  const usedNames = new Set<string>()
  let n = 80_000
  let inviteN = 1
  const aclField: Club[] = []
  const aclTwoField: Club[] = []
  const aseanField: Club[] = []
  const byKey = new Map(domesticDiv1.map((c) => [c.crestKey ?? '', c]))
  /** leagueId:clubKey ที่ถูกใช้ไปแล้ว (ไม่ให้อยู่สองถ้วยชั้นบนพร้อมกัน) */
  const usedClubKeys = new Set<string>()

  const addDefs = (
    leagueId: LeagueId,
    defs: ReturnType<typeof getLeague>['clubs'],
    kind: AsiaCupKind,
    field: Club[],
  ) => {
    for (const def of defs) {
      const uk = `${leagueId}:${def.key}`
      if (usedClubKeys.has(uk) && kind !== 'asean_cup') continue
      if (kind !== 'asean_cup') usedClubKeys.add(uk)

      if (leagueId === homeLeagueId) {
        const local = byKey.get(def.key)
        if (local) {
          if (!field.includes(local)) field.push(local)
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
        seed: 11_000 + inviteN * 37,
        idPrefix: `${kind}-p`,
        startN: n,
        usedNames,
      })
      n = built.nextN
      players.push(...built.players)
      tactics[club.id] = autoPickTactics(club.id, built.players)
    }
  }

  const pickDefs = (leagueId: LeagueId, slots: number, skipUsed: boolean) => {
    if (slots <= 0) return [] as ReturnType<typeof getLeague>['clubs']
    const order = resolveRanks(access, leagueId)
    const league = getLeague(leagueId)
    const defByKey = new Map(league.clubs.map((c) => [c.key, c]))
    const out: typeof league.clubs = []
    for (const k of order) {
      const uk = `${leagueId}:${k}`
      if (skipUsed && usedClubKeys.has(uk)) continue
      const def = defByKey.get(k)
      if (!def) continue
      out.push(def)
      if (out.length >= slots) break
    }
    return out
  }

  if (inAcl) {
    // —— Elite ——
    for (const leagueId of ACL_LEAGUE_IDS) {
      const slots = ACL_ELITE_SLOTS[leagueId as LeagueId] ?? 0
      if (!slots) continue
      const defs = pickDefs(leagueId as LeagueId, slots, false)
      addDefs(leagueId as LeagueId, defs, 'acl', aclField)
    }
    // —— Two (ทีมที่ยังไม่ติด Elite) ——
    for (const leagueId of ACL_LEAGUE_IDS) {
      const slots = ACL_TWO_SLOTS[leagueId as LeagueId] ?? 0
      if (!slots) continue
      const defs = pickDefs(leagueId as LeagueId, slots, true)
      addDefs(leagueId as LeagueId, defs, 'acl_two', aclTwoField)
    }
  }

  if (inAsean) {
    for (const leagueId of ASEAN_LEAGUE_IDS) {
      const order = resolveRanks(access, leagueId as LeagueId)
      const league = getLeague(leagueId as LeagueId)
      const defByKey = new Map(league.clubs.map((c) => [c.key, c]))
      const slots = leagueId === 'sgp' ? 1 : 2
      const eliteKeys = new Set(
        aclField
          .filter((c) => c.originLeagueId === leagueId || (leagueId === homeLeagueId && byKey.has(c.crestKey ?? '')))
          .map((c) => c.crestKey)
          .filter(Boolean) as string[],
      )
      // ทีมบ้านใน Elite
      for (const c of aclField) {
        if (leagueId === homeLeagueId && byKey.has(c.crestKey ?? '')) {
          eliteKeys.add(c.crestKey!)
        }
      }
      const defs: typeof league.clubs = []
      for (const k of order) {
        if (eliteKeys.has(k)) continue // แชมป์ Elite ไม่ลง ASEAN
        const def = defByKey.get(k)
        if (!def) continue
        defs.push(def)
        if (defs.length >= slots) break
      }
      addDefs(leagueId as LeagueId, defs, 'asean_cup', aseanField)
    }
  }

  return { clubs, players, tactics, aclField, aclTwoField, aseanField }
}

export function createAclState(): CupState {
  return {
    name: 'AFC Champions League Elite',
    championClubId: null,
    eliminated: [],
  }
}

export function createAclTwoState(): CupState {
  return {
    name: 'AFC Champions League Two',
    championClubId: null,
    eliminated: [],
  }
}

export function createAseanCupState(): CupState {
  return {
    name: 'ASEAN Club Championship',
    championClubId: null,
    eliminated: [],
  }
}

const ROUND_OFFSET: Record<AsiaCupKind, number> = {
  acl: 8,
  acl_two: 7,
  asean_cup: 6,
}

/** Generate knockout fixtures for a field (8–16 teams → pad/trim to power of 2). */
export function generateAsiaKnockoutFixtures(
  kind: AsiaCupKind,
  field: Club[],
  season: number,
  seasonStart = '2026-08-15',
): Fixture[] {
  if (field.length < 2) return []
  let teams = field.slice()
  let size = 16
  while (size > teams.length) size /= 2
  if (size < 4) size = 4
  teams = teams.slice(0, size)
  const fixtures: Fixture[] = []
  const roundId = size === 16 ? 'r16' : size === 8 ? 'qf' : 'sf'
  const offset = ROUND_OFFSET[kind]
  const start = new Date(`${seasonStart}T12:00:00Z`)
  for (let i = 0; i < teams.length; i += 2) {
    const home = teams[i]!
    const away = teams[i + 1]!
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + offset * 7)
    fixtures.push({
      id: `${kind}-${season}-${roundId}-${i / 2}`,
      matchday: offset,
      date: d.toISOString().slice(0, 10),
      homeClubId: home.id,
      awayClubId: away.id,
      competition: kind,
      played: false,
      cupRound: roundId,
      slot: 'midweek',
    })
  }
  return fixtures
}

function advanceAsiaKind(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
  competition: AsiaCupKind,
  rounds: Array<{ id: string; matchdayOffset: number }>,
): { fixtures: Fixture[]; cup: CupState } {
  const roundOrder = rounds.map((r) => r.id)
  const playedThis = fixtures.filter(
    (f) => f.competition === competition && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, cup }

  const roundId = playedThis[0]?.cupRound
  if (!roundId) return { fixtures, cup }

  const winners: string[] = []
  const eliminated = [...(cup.eliminated ?? [])]
  for (const f of playedThis) {
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
    let winner: string
    if (f.penaltiesHome != null && f.penaltiesAway != null && hg === ag) {
      winner = f.penaltiesHome > f.penaltiesAway ? f.homeClubId : f.awayClubId
    } else {
      winner = hg >= ag ? f.homeClubId : f.awayClubId
    }
    const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
    winners.push(winner)
    if (!eliminated.includes(loser)) eliminated.push(loser)
  }

  const idx = roundOrder.indexOf(roundId)
  if (idx === roundOrder.length - 1) {
    return {
      fixtures,
      cup: { ...cup, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = rounds[idx + 1]!
  const existingNext = fixtures.some(
    (f) => f.competition === competition && f.cupRound === nextRound.id,
  )
  if (existingNext || winners.length < 2) {
    return { fixtures, cup: { ...cup, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    newFx.push({
      id: `${competition}-${nextRound.id}-${i / 2 + 1}`,
      matchday: nextRound.matchdayOffset,
      date: shiftMidweekDate(playedThis[0]!.date, nextRound.matchdayOffset - matchday),
      homeClubId: winners[i]!,
      awayClubId: winners[i + 1]!,
      played: false,
      competition,
      cupRound: nextRound.id,
      slot: 'midweek',
    })
  }

  return { fixtures: [...fixtures, ...newFx], cup: { ...cup, eliminated } }
}

export function advanceAclAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): { fixtures: Fixture[]; cup: CupState } {
  return advanceAsiaKind(fixtures, cup, matchday, 'acl', aclFormat.rounds)
}

export function advanceAclTwoAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): { fixtures: Fixture[]; cup: CupState } {
  return advanceAsiaKind(fixtures, cup, matchday, 'acl_two', aclTwoFormat.rounds)
}

export function advanceAseanCupAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): { fixtures: Fixture[]; cup: CupState } {
  return advanceAsiaKind(fixtures, cup, matchday, 'asean_cup', aseanCupFormat.rounds)
}
