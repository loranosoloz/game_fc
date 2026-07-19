/**
 * Team of the Week / Month · Manager of the Week / Month
 * แยกตามดิวิชันในลีกที่คุม · เลือกฟอเมชั่นจากกระจายตำแหน่ง
 */
import type {
  Club,
  FormationId,
  GameSave,
  MatchResult,
  MediaItem,
  MediaTone,
  Player,
  RoleCode,
  Tactics,
} from './types'
import { ALL_FORMATIONS, FORMATION_SLOTS } from './types'
import { getWorldCoach } from './worldCoaches'
import { pushNews } from './media'
import { isEuropeLeague } from './europeAccess'
import {
  compareGoldenShoe,
  goldenShoePoints,
  leagueDifficultyWeight,
  leagueWeightNote,
  shoeScopeForLeague,
} from './leagueWeights'

export const ASIA_LEAGUE_IDS = ['tha', 'jpn', 'kor', 'vie', 'idn', 'mys', 'sgp', 'sau'] as const

/** ASEAN domestic leagues (excl. East Asia / West Asia) */
export const ASEAN_LEAGUE_IDS = ['tha', 'vie', 'idn', 'mys', 'sgp'] as const

/** AFC Champions League–eligible domestic leagues in-game (= Asia including Saudi) */
export const ACL_LEAGUE_IDS = [...ASIA_LEAGUE_IDS] as const

export function isAsiaLeague(id: string): boolean {
  return (ASIA_LEAGUE_IDS as readonly string[]).includes(id)
}

export function isAseanLeague(id: string): boolean {
  return (ASEAN_LEAGUE_IDS as readonly string[]).includes(id)
}

export function isAclLeague(id: string): boolean {
  return (ACL_LEAGUE_IDS as readonly string[]).includes(id)
}

/** ผลแมตช์เดย์ที่ต้องการสำหรับรางวัล (เลี่ยง circular import กับ simulate) */
export interface AwardsMatchdayInput {
  matchday: number
  date: string
  results: Array<{ fixture: import('./types').Fixture; result: MatchResult }>
  tacticsByClub?: Record<string, Tactics>
}

export interface AwardXiSlot {
  playerId: string
  name: string
  clubId: string
  clubShort: string
  role: RoleCode
  rating: number
  isHumanClub: boolean
}

export interface TeamOfPeriod {
  kind: 'week' | 'month'
  season: number
  matchday: number
  date: string
  monthKey: string
  leagueId: string
  leagueLabel: string
  division: 1 | 2
  formation: FormationId
  xi: AwardXiSlot[]
  avgRating: number
}

export interface ManagerAward {
  kind: 'week' | 'month'
  season: number
  matchday: number
  date: string
  monthKey: string
  leagueId: string
  leagueLabel: string
  division: 1 | 2
  clubId: string
  clubName: string
  clubShort: string
  managerName: string
  isHuman: boolean
  points: number
  wins: number
  draws: number
  losses: number
  gd: number
  score: number
}

export interface MonthlyPlayerAccum {
  playerId: string
  name: string
  clubId: string
  role: RoleCode
  ratingSum: number
  apps: number
  goals: number
  bestRating: number
}

export interface MonthlyManagerAccum {
  clubId: string
  points: number
  wins: number
  draws: number
  losses: number
  gd: number
  score: number
}

export interface AwardsState {
  monthKey: string
  teamOfWeek: TeamOfPeriod[]
  teamOfMonth: TeamOfPeriod[]
  managerOfWeek: ManagerAward[]
  managerOfMonth: ManagerAward[]
  /** key = `${division}:${playerId}` */
  monthlyPlayers: Record<string, MonthlyPlayerAccum>
  /** key = `${division}:${clubId}` */
  monthlyManagers: Record<string, MonthlyManagerAccum>
  /** สถิติสะสมทั้งฤดูกาล (key = playerId) */
  seasonPlayers: Record<string, SeasonPlayerAccum>
  /** รางวัลจบลีกฤดูกาลล่าสุด */
  seasonAwards: SeasonIndividualAward[]
  /** ฤดูกาลที่ finalize ไปแล้ว (กันซ้ำ) */
  seasonFinalized: number
  history: Array<
    | { type: 'totw' | 'totm'; team: TeamOfPeriod }
    | { type: 'mow' | 'mom'; manager: ManagerAward }
    | { type: 'season'; award: SeasonIndividualAward }
  >
}

/** ขอบเขตรางวัลรายปี */
export type SeasonAwardRegion = 'league' | 'europe' | 'asia' | 'americas'
export type SeasonAwardKind = 'ballon_dor' | 'golden_boot' | 'golden_glove'

export interface SeasonPlayerAccum {
  playerId: string
  name: string
  clubId: string
  role: RoleCode
  division: 1 | 2
  /** ลีกต้นทางของคลับ (สำหรับตัวคูณ) */
  originLeagueId: string
  goalsLeague: number
  goalsAll: number
  assistsAll: number
  /** ประตูจากจุดโทษ (ลีก) — ใช้ tie-break */
  penaltyGoals: number
  /** แต้ม Golden Shoe = Σ (ประตูลีก × weight) */
  shoePoints: number
  saves: number
  cleanSheets: number
  appsLeague: number
  appsAll: number
  ratingSum: number
  minutes: number
}

export interface SeasonIndividualAward {
  kind: SeasonAwardKind
  region: SeasonAwardRegion
  /** เฉพาะรางวัลลีก */
  division?: 1 | 2
  season: number
  date: string
  leagueId: string
  label: string
  playerId: string
  name: string
  clubId: string
  clubShort: string
  isHumanClub: boolean
  /** ประตู / คลีนชีต / คะแนน Ballon */
  value: number
  detail: string
}

/** รางวัลติดตัวนักเตะถาวรในเซฟ */
export type PlayerCareerHonourKind =
  | 'ballon_dor'
  | 'golden_boot'
  | 'golden_glove'
  | 'totw'
  | 'totm'
  | 'motm'

export interface PlayerCareerHonour {
  id: string
  kind: PlayerCareerHonourKind
  label: string
  season: number
  date: string
  matchday?: number
  clubId?: string
  clubShort?: string
  detail?: string
  value?: number
}

const MAX_CAREER_HONOURS = 120

export function grantCareerHonours(
  save: GameSave,
  grants: Array<{ playerId: string; honour: Omit<PlayerCareerHonour, 'id'> & { id?: string } }>,
): GameSave {
  if (!grants.length) return save
  const byPlayer = new Map<string, PlayerCareerHonour[]>()
  for (const g of grants) {
    const honour: PlayerCareerHonour = {
      id: g.honour.id ?? `hon-${g.playerId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      kind: g.honour.kind,
      label: g.honour.label,
      season: g.honour.season,
      date: g.honour.date,
      matchday: g.honour.matchday,
      clubId: g.honour.clubId,
      clubShort: g.honour.clubShort,
      detail: g.honour.detail,
      value: g.honour.value,
    }
    const list = byPlayer.get(g.playerId) ?? []
    list.push(honour)
    byPlayer.set(g.playerId, list)
  }
  return {
    ...save,
    players: save.players.map((p) => {
      const add = byPlayer.get(p.id)
      if (!add?.length) return p
      const prev = p.careerHonours ?? []
      // กันซ้ำ label+season+kind ในรอบเดียวกัน
      const keys = new Set(prev.map((h) => `${h.kind}|${h.season}|${h.label}|${h.matchday ?? ''}`))
      const merged = [...prev]
      for (const h of add) {
        const k = `${h.kind}|${h.season}|${h.label}|${h.matchday ?? ''}`
        if (keys.has(k)) continue
        keys.add(k)
        merged.push(h)
      }
      return { ...p, careerHonours: merged.slice(-MAX_CAREER_HONOURS) }
    }),
  }
}

function honoursFromTeamOfPeriod(team: TeamOfPeriod, kind: 'totw' | 'totm'): Array<{
  playerId: string
  honour: Omit<PlayerCareerHonour, 'id'>
}> {
  return team.xi.map((slot) => ({
    playerId: slot.playerId,
    honour: {
      kind,
      label: kind === 'totw' ? `TOTW · ${team.leagueLabel}` : `TOTM · ${team.leagueLabel}`,
      season: team.season,
      date: team.date,
      matchday: team.matchday,
      clubId: slot.clubId,
      clubShort: slot.clubShort,
      detail: `${slot.role} · เรตติ้ง ${slot.rating.toFixed(1)} · แผน ${team.formation}`,
      value: slot.rating,
    },
  }))
}

function honourFromSeasonAward(a: SeasonIndividualAward): {
  playerId: string
  honour: Omit<PlayerCareerHonour, 'id'>
} {
  return {
    playerId: a.playerId,
    honour: {
      kind: a.kind,
      label: a.label,
      season: a.season,
      date: a.date,
      clubId: a.clubId,
      clubShort: a.clubShort,
      detail: a.detail,
      value: a.value,
    },
  }
}

export function continentOfLeague(id: string): SeasonAwardRegion | 'other' {
  if (isEuropeLeague(id)) return 'europe'
  if (isAsiaLeague(id)) return 'asia'
  if (id === 'bra') return 'americas'
  return 'other'
}

function continentLabel(region: SeasonAwardRegion): string {
  if (region === 'europe') return 'ยุโรป'
  if (region === 'asia') return 'เอเชีย'
  if (region === 'americas') return 'อเมริกาใต้'
  return 'ลีก'
}

export function emptyAwardsState(monthKey = '0000-00'): AwardsState {
  return {
    monthKey,
    teamOfWeek: [],
    teamOfMonth: [],
    managerOfWeek: [],
    managerOfMonth: [],
    monthlyPlayers: {},
    monthlyManagers: {},
    seasonPlayers: {},
    seasonAwards: [],
    seasonFinalized: 0,
    history: [],
  }
}

export function ensureAwards(save: GameSave): AwardsState {
  const base = save.awards ?? emptyAwardsState(monthKeyFromDate(save.currentDate))
  return {
    ...emptyAwardsState(base.monthKey || monthKeyFromDate(save.currentDate)),
    ...base,
    seasonPlayers: base.seasonPlayers ?? {},
    seasonAwards: base.seasonAwards ?? [],
    seasonFinalized: base.seasonFinalized ?? 0,
    history: base.history ?? [],
  }
}

export function monthKeyFromDate(date: string): string {
  return (date || '0000-00-00').slice(0, 7)
}

function divisionLabel(leagueName: string, division: 1 | 2): string {
  return division === 1 ? `${leagueName} · ดิวิชัน 1` : `${leagueName} · ดิวิชัน 2`
}

function managerNameForClub(save: GameSave, club: Club): string {
  if (club.id === save.humanClubId) return save.managerName
  const coach = getWorldCoach(club.coachId)
  return coach?.name ?? `โค้ช ${club.shortName}`
}

function rolePlayed(
  playerId: string,
  clubId: string,
  tacticsByClub: Record<string, Tactics>,
  players: Player[],
): RoleCode {
  const tac = tacticsByClub[clubId]
  if (tac) {
    const idx = tac.startingXi.indexOf(playerId)
    if (idx >= 0) {
      const slots = FORMATION_SLOTS[tac.formation]
      return slots[idx] ?? players.find((p) => p.id === playerId)?.role ?? 'CM'
    }
  }
  return players.find((p) => p.id === playerId)?.role ?? 'CM'
}

/** ความเข้ากันของบทบาทกับช่องในแผน */
function roleFit(slot: RoleCode, playerRole: RoleCode): number {
  if (slot === playerRole) return 1
  const soft: Partial<Record<RoleCode, RoleCode[]>> = {
    CB: ['LB', 'RB'],
    LB: ['CB', 'LM', 'LW'],
    RB: ['CB', 'RM', 'RW'],
    CDM: ['CM', 'CB'],
    CM: ['CDM', 'CAM', 'LM', 'RM'],
    CAM: ['CM', 'SS', 'ST'],
    LM: ['LW', 'CM', 'LB', 'RM'],
    RM: ['RW', 'CM', 'RB', 'LM'],
    LW: ['LM', 'ST', 'RW', 'SS'],
    RW: ['RM', 'ST', 'LW', 'SS'],
    ST: ['SS', 'CAM', 'LW', 'RW'],
    SS: ['ST', 'CAM'],
    GK: [],
  }
  if (soft[slot]?.includes(playerRole)) return 0.72
  if (soft[playerRole]?.includes(slot)) return 0.65
  const group = (r: RoleCode) => {
    if (r === 'GK') return 'GK'
    if (r === 'CB' || r === 'LB' || r === 'RB') return 'DF'
    if (r === 'ST' || r === 'SS' || r === 'LW' || r === 'RW') return 'FW'
    return 'MF'
  }
  return group(slot) === group(playerRole) ? 0.45 : 0.12
}

interface Cand {
  playerId: string
  name: string
  clubId: string
  clubShort: string
  role: RoleCode
  rating: number
  goals: number
  isHumanClub: boolean
}

function pickXiForPool(pool: Cand[]): { formation: FormationId; xi: AwardXiSlot[]; avgRating: number } {
  if (pool.length === 0) {
    return { formation: '4-3-3', xi: [], avgRating: 0 }
  }

  const gkPool = pool.filter((c) => c.role === 'GK').sort((a, b) => b.rating - a.rating)
  const outfield = pool.filter((c) => c.role !== 'GK').sort((a, b) => b.rating - a.rating)

  // นับแนวจากผู้เล่นท็อป ~18 คน — เลือกแผนที่เข้ากับกระจายตำแหน่ง
  const sample = outfield.slice(0, 18)
  let df = 0
  let mf = 0
  let fw = 0
  for (const c of sample) {
    if (c.role === 'CB' || c.role === 'LB' || c.role === 'RB') df += 1
    else if (c.role === 'ST' || c.role === 'SS' || c.role === 'LW' || c.role === 'RW') fw += 1
    else mf += 1
  }

  const preferred: FormationId[] = []
  if (fw >= 5) preferred.push('4-2-4', '3-4-3', '4-2-1-3', '3-4-3-diamond')
  else if (fw >= 4) preferred.push('4-3-3', '3-4-3', '4-2-4', '4-2-1-3')
  else if (fw <= 1 && mf >= 6) preferred.push('4-5-1', '4-1-4-1', '3-6-1', '5-4-1')
  if (df >= 6) preferred.push('3-5-2', '3-4-2-1', '5-3-2', '3-1-4-2')
  else preferred.push('4-2-3-1', '4-3-3', '4-4-2', '4-3-2-1')
  // เติมแผนที่เหลือเป็นตัวเลือก
  for (const f of ALL_FORMATIONS) {
    if (!preferred.includes(f)) preferred.push(f)
  }

  let best: { formation: FormationId; xi: AwardXiSlot[]; score: number } | null = null

  for (const formation of preferred.slice(0, 12)) {
    const slots = FORMATION_SLOTS[formation]
    const used = new Set<string>()
    const xi: AwardXiSlot[] = []
    let score = 0

    for (const slot of slots) {
      let pick: Cand | null = null
      let pickFit = -1
      const source = slot === 'GK' ? gkPool : outfield
      for (const c of source) {
        if (used.has(c.playerId)) continue
        const fit = roleFit(slot, c.role)
        const val = c.rating * fit + c.goals * 0.15
        if (val > pickFit) {
          pickFit = val
          pick = c
        }
      }
      // ถ้าไม่มี GK ในพูล — ใช้คนที่เหลือที่ใกล้เคียงที่สุด
      if (!pick) {
        for (const c of pool) {
          if (used.has(c.playerId)) continue
          const fit = roleFit(slot, c.role)
          const val = c.rating * fit
          if (val > pickFit) {
            pickFit = val
            pick = c
          }
        }
      }
      if (!pick) break
      used.add(pick.playerId)
      score += pickFit
      xi.push({
        playerId: pick.playerId,
        name: pick.name,
        clubId: pick.clubId,
        clubShort: pick.clubShort,
        role: slot,
        rating: Math.round(pick.rating * 10) / 10,
        isHumanClub: pick.isHumanClub,
      })
    }

    if (xi.length < 11) continue
    if (!best || score > best.score) best = { formation, xi, score }
  }

  if (!best) {
    // fallback: ท็อป 11 + 4-3-3
    const formation: FormationId = '4-3-3'
    const slots = FORMATION_SLOTS[formation]
    const top = [...gkPool.slice(0, 1), ...outfield].slice(0, 11)
    while (top.length < 11 && outfield[top.length]) top.push(outfield[top.length]!)
    const xi = top.slice(0, 11).map((c, i) => ({
      playerId: c.playerId,
      name: c.name,
      clubId: c.clubId,
      clubShort: c.clubShort,
      role: slots[i]!,
      rating: Math.round(c.rating * 10) / 10,
      isHumanClub: c.isHumanClub,
    }))
    return {
      formation,
      xi,
      avgRating: xi.reduce((s, x) => s + x.rating, 0) / Math.max(1, xi.length),
    }
  }

  return {
    formation: best.formation,
    xi: best.xi,
    avgRating: best.xi.reduce((s, x) => s + x.rating, 0) / 11,
  }
}

function clubDivision(club: Club): 1 | 2 {
  return club.division === 2 ? 2 : 1
}

function collectWeekCandidates(
  prepared: AwardsMatchdayInput,
  save: GameSave,
  division: 1 | 2,
): Cand[] {
  const byId = new Map<string, Cand>()
  const clubs = new Map(save.clubs.map((c) => [c.id, c]))
  const tactics = prepared.tacticsByClub ?? save.tacticsByClub

  for (const { fixture, result } of prepared.results) {
    if (fixture.competition !== 'league') continue
    const home = clubs.get(fixture.homeClubId)
    const away = clubs.get(fixture.awayClubId)
    if (!home || !away) continue
    if (clubDivision(home) !== division || clubDivision(away) !== division) continue
    // นัดข้ามดิวิชันไม่นับ
    if (fixture.division != null && fixture.division !== division) continue

    ingestResult(result, fixture.homeClubId, fixture.awayClubId, save, tactics, byId)
  }

  return [...byId.values()]
}

function ingestResult(
  result: MatchResult,
  homeClubId: string,
  awayClubId: string,
  save: GameSave,
  tacticsByClub: Record<string, Tactics>,
  byId: Map<string, Cand>,
) {
  const clubs = new Map(save.clubs.map((c) => [c.id, c]))
  for (const r of result.playerRatings ?? []) {
    if (r.minutes < 30) continue
    const clubId = r.team === 'home' ? homeClubId : awayClubId
    const club = clubs.get(clubId)
    if (!club) continue
    const role = rolePlayed(r.playerId, clubId, tacticsByClub, save.players)
    const prev = byId.get(r.playerId)
    if (!prev || r.rating > prev.rating) {
      byId.set(r.playerId, {
        playerId: r.playerId,
        name: r.name,
        clubId,
        clubShort: club.shortName,
        role,
        rating: r.rating,
        goals: r.goals,
        isHumanClub: clubId === save.humanClubId,
      })
    }
  }
}

function managerWeekScores(
  prepared: AwardsMatchdayInput,
  save: GameSave,
  division: 1 | 2,
): ManagerAward[] {
  const clubs = new Map(save.clubs.map((c) => [c.id, c]))
  const score = new Map<
    string,
    { points: number; wins: number; draws: number; losses: number; gd: number; ratingBonus: number }
  >()

  for (const { fixture, result } of prepared.results) {
    if (fixture.competition !== 'league') continue
    const home = clubs.get(fixture.homeClubId)
    const away = clubs.get(fixture.awayClubId)
    if (!home || !away) continue
    if (clubDivision(home) !== division || clubDivision(away) !== division) continue

    const apply = (clubId: string, gf: number, ga: number, teamAvg: number) => {
      const cur = score.get(clubId) ?? {
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        gd: 0,
        ratingBonus: 0,
      }
      const gd = gf - ga
      cur.gd += gd
      if (gf > ga) {
        cur.wins += 1
        cur.points += 3
      } else if (gf === ga) {
        cur.draws += 1
        cur.points += 1
      } else {
        cur.losses += 1
      }
      cur.ratingBonus += (teamAvg - 6.5) * 0.35
      score.set(clubId, cur)
    }

    const homeRatings = (result.playerRatings ?? []).filter((r) => r.team === 'home')
    const awayRatings = (result.playerRatings ?? []).filter((r) => r.team === 'away')
    const homeAvg =
      homeRatings.length > 0
        ? homeRatings.reduce((s, r) => s + r.rating, 0) / homeRatings.length
        : result.homeRating / 10
    const awayAvg =
      awayRatings.length > 0
        ? awayRatings.reduce((s, r) => s + r.rating, 0) / awayRatings.length
        : result.awayRating / 10

    apply(fixture.homeClubId, result.homeGoals, result.awayGoals, homeAvg)
    apply(fixture.awayClubId, result.awayGoals, result.homeGoals, awayAvg)
  }

  const mk = monthKeyFromDate(prepared.date)
  const awards: ManagerAward[] = []
  for (const [clubId, s] of score) {
    const club = clubs.get(clubId)!
    awards.push({
      kind: 'week',
      season: save.season,
      matchday: prepared.matchday,
      date: prepared.date,
      monthKey: mk,
      leagueId: save.leagueId,
      leagueLabel: divisionLabel(save.leagueName, division),
      division,
      clubId,
      clubName: club.name,
      clubShort: club.shortName,
      managerName: managerNameForClub(save, club),
      isHuman: clubId === save.humanClubId,
      points: s.points,
      wins: s.wins,
      draws: s.draws,
      losses: s.losses,
      gd: s.gd,
      score: Math.round((s.points * 10 + s.gd * 2 + s.ratingBonus * 10) * 10) / 10,
    })
  }
  awards.sort((a, b) => b.score - a.score || b.gd - a.gd || b.points - a.points)
  return awards
}

function buildTeamAward(
  kind: 'week' | 'month',
  pool: Cand[],
  save: GameSave,
  prepared: AwardsMatchdayInput,
  division: 1 | 2,
  monthKey: string,
): TeamOfPeriod | null {
  const picked = pickXiForPool(pool)
  if (picked.xi.length < 11) return null
  return {
    kind,
    season: save.season,
    matchday: prepared.matchday,
    date: prepared.date,
    monthKey,
    leagueId: save.leagueId,
    leagueLabel: divisionLabel(save.leagueName, division),
    division,
    formation: picked.formation,
    xi: picked.xi,
    avgRating: Math.round(picked.avgRating * 10) / 10,
  }
}

function pushHistory(
  state: AwardsState,
  entry: AwardsState['history'][number],
): AwardsState {
  return { ...state, history: [entry, ...state.history].slice(0, 48) }
}

function newsItem(
  date: string,
  headline: string,
  body: string,
  tone: MediaTone,
  tags: string[],
): MediaItem {
  return {
    id: `awards-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date,
    channel: 'news',
    headline,
    body,
    tone,
    tags,
  }
}

function newsForTotw(team: TeamOfPeriod, humanCount: number) {
  const mom = [...team.xi].sort((a, b) => b.rating - a.rating)[0]
  return newsItem(
    team.date,
    `ทีมยอดเยี่ยมประจำสัปดาห์ · ${team.leagueLabel}`,
    `แผน ${team.formation} · เฉลี่ย ${team.avgRating.toFixed(1)}` +
      (mom ? ` · ดาวเด่น ${mom.name} (${mom.rating.toFixed(1)})` : '') +
      (humanCount > 0 ? ` · มีนักเตะทีมคุณ ${humanCount} คน` : ''),
    humanCount > 0 ? 'positive' : 'neutral',
    ['totw', `div${team.division}`],
  )
}

function newsForTotm(team: TeamOfPeriod, humanCount: number) {
  return newsItem(
    team.date,
    `ทีมยอดเยี่ยมประจำเดือน · ${team.leagueLabel}`,
    `${team.monthKey} · แผน ${team.formation} · เฉลี่ย ${team.avgRating.toFixed(1)}` +
      (humanCount > 0 ? ` · ทีมคุณติด ${humanCount} คน` : ''),
    humanCount > 0 ? 'positive' : 'neutral',
    ['totm', `div${team.division}`],
  )
}

function newsForManager(m: ManagerAward) {
  const title =
    m.kind === 'week'
      ? `ผู้จัดการยอดเยี่ยมประจำสัปดาห์ · ${m.leagueLabel}`
      : `ผู้จัดการยอดเยี่ยมประจำเดือน · ${m.leagueLabel}`
  return newsItem(
    m.date,
    title,
    `${m.managerName} (${m.clubShort}) · ${m.wins}ชนะ ${m.draws}เสมอ ${m.losses}แพ้ · GD ${m.gd >= 0 ? '+' : ''}${m.gd}`,
    m.isHuman ? 'positive' : 'neutral',
    [m.kind === 'week' ? 'mow' : 'mom', `div${m.division}`],
  )
}

/** รันหลังแมตช์เดย์ — อัปเดต TOTW / MoW และปิดเดือนเมื่อเปลี่ยนเดือน */
export function processMatchdayAwards(
  save: GameSave,
  prepared: AwardsMatchdayInput,
): GameSave {
  let awards = ensureAwards(save)
  const mk = monthKeyFromDate(prepared.date)
  const news: MediaItem[] = []
  const honourGrants: Array<{ playerId: string; honour: Omit<PlayerCareerHonour, 'id'> }> = []

  // ปิดเดือนก่อนถ้าข้ามเดือน
  if (awards.monthKey && awards.monthKey !== '0000-00' && awards.monthKey !== mk) {
    const closed = finalizeMonth(save, awards, prepared, awards.monthKey)
    awards = closed.awards
    news.push(...closed.news)
    honourGrants.push(...closed.honours)
    awards = {
      ...awards,
      monthKey: mk,
      monthlyPlayers: {},
      monthlyManagers: {},
    }
  } else if (!awards.monthKey || awards.monthKey === '0000-00') {
    awards = { ...awards, monthKey: mk }
  }

  const totwList: TeamOfPeriod[] = []
  const mowList: ManagerAward[] = []

  for (const division of [1, 2] as const) {
    const pool = collectWeekCandidates(prepared, save, division)
    const team = buildTeamAward('week', pool, save, prepared, division, mk)
    if (team) {
      totwList.push(team)
      awards = pushHistory(awards, { type: 'totw', team })
      const humanCount = team.xi.filter((x) => x.isHumanClub).length
      news.push(newsForTotw(team, humanCount))
      honourGrants.push(...honoursFromTeamOfPeriod(team, 'totw'))
    }

    const managers = managerWeekScores(prepared, save, division)
    const top = managers[0]
    if (top) {
      mowList.push(top)
      awards = pushHistory(awards, { type: 'mow', manager: top })
      news.push(newsForManager(top))
    }

    // สะสมรายเดือน
    const monthlyPlayers = { ...awards.monthlyPlayers }
    for (const c of pool) {
      const key = `${division}:${c.playerId}`
      const prev = monthlyPlayers[key]
      monthlyPlayers[key] = {
        playerId: c.playerId,
        name: c.name,
        clubId: c.clubId,
        role: c.role,
        ratingSum: (prev?.ratingSum ?? 0) + c.rating,
        apps: (prev?.apps ?? 0) + 1,
        goals: (prev?.goals ?? 0) + c.goals,
        bestRating: Math.max(prev?.bestRating ?? 0, c.rating),
      }
    }
    const monthlyManagers = { ...awards.monthlyManagers }
    for (const m of managers) {
      const key = `${division}:${m.clubId}`
      const prev = monthlyManagers[key]
      monthlyManagers[key] = {
        clubId: m.clubId,
        points: (prev?.points ?? 0) + m.points,
        wins: (prev?.wins ?? 0) + m.wins,
        draws: (prev?.draws ?? 0) + m.draws,
        losses: (prev?.losses ?? 0) + m.losses,
        gd: (prev?.gd ?? 0) + m.gd,
        score: (prev?.score ?? 0) + m.score,
      }
    }
    awards = { ...awards, monthlyPlayers, monthlyManagers }
  }

  awards = accumulateSeasonStats(save, prepared, awards)

  awards = {
    ...awards,
    monthKey: mk,
    teamOfWeek: totwList,
    managerOfWeek: mowList,
  }

  // Man of the Match ติดตัวถาวร
  for (const { fixture, result } of prepared.results) {
    if (!result.manOfTheMatchId || !result.manOfTheMatchName) continue
    const clubId =
      result.playerRatings?.find((r) => r.playerId === result.manOfTheMatchId)?.team === 'away'
        ? fixture.awayClubId
        : fixture.homeClubId
    const club = save.clubs.find((c) => c.id === clubId)
    honourGrants.push({
      playerId: result.manOfTheMatchId,
      honour: {
        kind: 'motm',
        label: `Man of the Match · MD${prepared.matchday}`,
        season: save.season,
        date: prepared.date,
        matchday: prepared.matchday,
        clubId,
        clubShort: club?.shortName,
        detail: result.manOfTheMatchName,
      },
    })
  }

  let next: GameSave = { ...save, awards }
  next = grantCareerHonours(next, honourGrants)
  for (const n of news) next = pushNews(next, n)
  return next
}

function finalizeMonth(
  save: GameSave,
  awards: AwardsState,
  prepared: AwardsMatchdayInput,
  monthKey: string,
): {
  awards: AwardsState
  news: MediaItem[]
  honours: Array<{ playerId: string; honour: Omit<PlayerCareerHonour, 'id'> }>
} {
  const news: MediaItem[] = []
  const totmList: TeamOfPeriod[] = []
  const momList: ManagerAward[] = []
  const honours: Array<{ playerId: string; honour: Omit<PlayerCareerHonour, 'id'> }> = []
  let next = awards

  for (const division of [1, 2] as const) {
    const pool: Cand[] = []
    for (const [key, acc] of Object.entries(awards.monthlyPlayers)) {
      if (!key.startsWith(`${division}:`)) continue
      if (acc.apps < 1) continue
      const club = save.clubs.find((c) => c.id === acc.clubId)
      if (!club) continue
      const avg = acc.ratingSum / acc.apps
      pool.push({
        playerId: acc.playerId,
        name: acc.name,
        clubId: acc.clubId,
        clubShort: club.shortName,
        role: acc.role,
        rating: avg * 0.85 + acc.bestRating * 0.15,
        goals: acc.goals,
        isHumanClub: acc.clubId === save.humanClubId,
      })
    }

    const team = buildTeamAward('month', pool, save, prepared, division, monthKey)
    if (team) {
      totmList.push(team)
      next = pushHistory(next, { type: 'totm', team })
      news.push(newsForTotm(team, team.xi.filter((x) => x.isHumanClub).length))
      honours.push(...honoursFromTeamOfPeriod(team, 'totm'))
    }

    const managers: ManagerAward[] = []
    for (const [key, acc] of Object.entries(awards.monthlyManagers)) {
      if (!key.startsWith(`${division}:`)) continue
      const club = save.clubs.find((c) => c.id === acc.clubId)
      if (!club) continue
      managers.push({
        kind: 'month',
        season: save.season,
        matchday: prepared.matchday,
        date: prepared.date,
        monthKey,
        leagueId: save.leagueId,
        leagueLabel: divisionLabel(save.leagueName, division),
        division,
        clubId: club.id,
        clubName: club.name,
        clubShort: club.shortName,
        managerName: managerNameForClub(save, club),
        isHuman: club.id === save.humanClubId,
        points: acc.points,
        wins: acc.wins,
        draws: acc.draws,
        losses: acc.losses,
        gd: acc.gd,
        score: Math.round(acc.score * 10) / 10,
      })
    }
    managers.sort((a, b) => b.score - a.score || b.gd - a.gd)
    const top = managers[0]
    if (top) {
      momList.push(top)
      next = pushHistory(next, { type: 'mom', manager: top })
      news.push(newsForManager(top))
    }
  }

  next = {
    ...next,
    teamOfMonth: totmList.length ? totmList : next.teamOfMonth,
    managerOfMonth: momList.length ? momList : next.managerOfMonth,
  }
  return { awards: next, news, honours }
}

function bumpSeasonPlayer(
  map: Record<string, SeasonPlayerAccum>,
  patch: Partial<SeasonPlayerAccum> &
    Pick<SeasonPlayerAccum, 'playerId' | 'name' | 'clubId' | 'role' | 'division' | 'originLeagueId'>,
): Record<string, SeasonPlayerAccum> {
  const prev = map[patch.playerId]
  const next: SeasonPlayerAccum = {
    playerId: patch.playerId,
    name: patch.name,
    clubId: patch.clubId,
    role: patch.role,
    division: patch.division,
    originLeagueId: patch.originLeagueId || prev?.originLeagueId || patch.originLeagueId,
    goalsLeague: (prev?.goalsLeague ?? 0) + (patch.goalsLeague ?? 0),
    goalsAll: (prev?.goalsAll ?? 0) + (patch.goalsAll ?? 0),
    assistsAll: (prev?.assistsAll ?? 0) + (patch.assistsAll ?? 0),
    penaltyGoals: (prev?.penaltyGoals ?? 0) + (patch.penaltyGoals ?? 0),
    shoePoints: Math.round(((prev?.shoePoints ?? 0) + (patch.shoePoints ?? 0)) * 10) / 10,
    saves: (prev?.saves ?? 0) + (patch.saves ?? 0),
    cleanSheets: (prev?.cleanSheets ?? 0) + (patch.cleanSheets ?? 0),
    appsLeague: (prev?.appsLeague ?? 0) + (patch.appsLeague ?? 0),
    appsAll: (prev?.appsAll ?? 0) + (patch.appsAll ?? 0),
    ratingSum: (prev?.ratingSum ?? 0) + (patch.ratingSum ?? 0),
    minutes: (prev?.minutes ?? 0) + (patch.minutes ?? 0),
  }
  return { ...map, [patch.playerId]: next }
}

function accumulateSeasonStats(
  save: GameSave,
  prepared: AwardsMatchdayInput,
  awards: AwardsState,
): AwardsState {
  const tactics = prepared.tacticsByClub ?? save.tacticsByClub
  const clubs = new Map(save.clubs.map((c) => [c.id, c]))
  let map = { ...awards.seasonPlayers }

  for (const { fixture, result } of prepared.results) {
    const home = clubs.get(fixture.homeClubId)
    const away = clubs.get(fixture.awayClubId)
    if (!home || !away) continue
    const isLeague = fixture.competition === 'league'
    const homeDiv = clubDivision(home)
    const awayDiv = clubDivision(away)

    const goalByPlayer = new Map<string, number>()
    const penGoalByPlayer = new Map<string, number>()
    const assistByPlayer = new Map<string, number>()
    const saveByPlayer = new Map<string, number>()
    for (const ev of result.events ?? []) {
      if (ev.kind === 'goal' && ev.playerId) {
        goalByPlayer.set(ev.playerId, (goalByPlayer.get(ev.playerId) ?? 0) + 1)
        if (ev.fromPenalty) {
          penGoalByPlayer.set(ev.playerId, (penGoalByPlayer.get(ev.playerId) ?? 0) + 1)
        }
        if (ev.assistPlayerId) {
          assistByPlayer.set(
            ev.assistPlayerId,
            (assistByPlayer.get(ev.assistPlayerId) ?? 0) + 1,
          )
        }
      }
      if (ev.kind === 'save' && ev.playerId) {
        saveByPlayer.set(ev.playerId, (saveByPlayer.get(ev.playerId) ?? 0) + 1)
      }
    }

    const continentScope = shoeScopeForLeague(save.leagueId || 'eng')

    // ratings เป็นหลัก · events เติม assist/save/penalty
    const seen = new Set<string>()
    for (const r of result.playerRatings ?? []) {
      if (r.minutes < 1) continue
      const clubId = r.team === 'home' ? fixture.homeClubId : fixture.awayClubId
      const club = clubs.get(clubId)
      if (!club) continue
      const originLeagueId = club.originLeagueId ?? save.leagueId
      const div = clubDivision(club)
      const role = rolePlayed(r.playerId, clubId, tactics, save.players)
      const goalsFromRating = r.goals
      const goalsFromEv = goalByPlayer.get(r.playerId) ?? 0
      const goals = Math.max(goalsFromRating, goalsFromEv)
      const pens = Math.min(penGoalByPlayer.get(r.playerId) ?? 0, goals)
      const leagueGoals = isLeague ? goals : 0
      const weight = leagueDifficultyWeight(originLeagueId, div, continentScope)
      const shoeAdd = isLeague ? Math.round(leagueGoals * weight * 10) / 10 : 0
      seen.add(r.playerId)
      map = bumpSeasonPlayer(map, {
        playerId: r.playerId,
        name: r.name,
        clubId,
        role,
        division: div,
        originLeagueId,
        goalsLeague: leagueGoals,
        goalsAll: goals,
        assistsAll: assistByPlayer.get(r.playerId) ?? 0,
        penaltyGoals: isLeague ? pens : 0,
        shoePoints: shoeAdd,
        saves: saveByPlayer.get(r.playerId) ?? 0,
        appsLeague: isLeague ? 1 : 0,
        appsAll: 1,
        ratingSum: r.rating,
        minutes: r.minutes,
      })
    }

    // assist/save ที่ไม่อยู่ใน ratings
    for (const [pid, n] of assistByPlayer) {
      if (seen.has(pid)) continue
      const p = save.players.find((x) => x.id === pid)
      if (!p) continue
      const club = clubs.get(p.clubId)
      if (!club) continue
      map = bumpSeasonPlayer(map, {
        playerId: pid,
        name: p.name,
        clubId: p.clubId,
        role: p.role,
        division: clubDivision(club),
        originLeagueId: club.originLeagueId ?? save.leagueId,
        assistsAll: n,
      })
    }

    // คลีนชีต GK
    const sides: Array<{ clubId: string; conceded: number; div: 1 | 2 }> = [
      { clubId: fixture.homeClubId, conceded: result.awayGoals, div: homeDiv },
      { clubId: fixture.awayClubId, conceded: result.homeGoals, div: awayDiv },
    ]
    for (const side of sides) {
      if (side.conceded > 0) continue
      const tac = tactics[side.clubId]
      const gkId =
        tac?.startingXi.find((id) => {
          const role = rolePlayed(id, side.clubId, tactics, save.players)
          return role === 'GK'
        }) ??
        result.playerRatings?.find((r) => {
          const clubId = r.team === 'home' ? fixture.homeClubId : fixture.awayClubId
          if (clubId !== side.clubId) return false
          return rolePlayed(r.playerId, clubId, tactics, save.players) === 'GK'
        })?.playerId
      if (!gkId) continue
      const p = save.players.find((x) => x.id === gkId)
      const club = clubs.get(side.clubId)
      if (!p || !club) continue
      map = bumpSeasonPlayer(map, {
        playerId: gkId,
        name: p.name,
        clubId: side.clubId,
        role: 'GK',
        division: side.div,
        originLeagueId: club.originLeagueId ?? save.leagueId,
        cleanSheets: isLeague || fixture.competition !== 'friendly' ? 1 : 0,
      })
    }
  }

  return { ...awards, seasonPlayers: map }
}

function ballonScore(a: SeasonPlayerAccum): number {
  const apps = Math.max(1, a.appsAll)
  const avg = a.ratingSum / apps
  return (
    avg * Math.min(apps, 38) * 0.55 +
    a.goalsAll * 2.2 +
    a.assistsAll * 1.4 +
    a.cleanSheets * 1.6 +
    a.saves * 0.04 +
    Math.min(a.minutes, 3200) / 400
  )
}

function pickTop(
  list: SeasonPlayerAccum[],
  scoreFn: (a: SeasonPlayerAccum) => number,
): SeasonPlayerAccum | null {
  if (!list.length) return null
  return list.slice().sort((a, b) => scoreFn(b) - scoreFn(a))[0] ?? null
}

function toSeasonAward(
  save: GameSave,
  kind: SeasonAwardKind,
  region: SeasonAwardRegion,
  acc: SeasonPlayerAccum,
  label: string,
  value: number,
  detail: string,
  date: string,
  division?: 1 | 2,
): SeasonIndividualAward {
  const club = save.clubs.find((c) => c.id === acc.clubId)
  return {
    kind,
    region,
    division,
    season: save.season,
    date,
    leagueId: save.leagueId,
    label,
    playerId: acc.playerId,
    name: acc.name,
    clubId: acc.clubId,
    clubShort: club?.shortName ?? '—',
    isHumanClub: acc.clubId === save.humanClubId,
    value: Math.round(value * 10) / 10,
    detail,
  }
}

function newsForSeasonAward(a: SeasonIndividualAward): MediaItem {
  return newsItem(
    a.date,
    a.label,
    `${a.name} (${a.clubShort}) · ${a.detail}`,
    a.isHumanClub ? 'positive' : 'neutral',
    [a.kind, a.region, `s${a.season}`],
  )
}

/** จบลีก — Ballon d'Or / ดาวซัลโว / ถุงมือทองคำ (ลีก + ทวีป) */
export function finalizeSeasonAwards(save: GameSave, date?: string): GameSave {
  let awards = ensureAwards(save)
  if (awards.seasonFinalized === save.season) return { ...save, awards }

  const when = date ?? save.currentDate
  const players = Object.values(awards.seasonPlayers)
  const news: MediaItem[] = []
  const won: SeasonIndividualAward[] = []
  const continent = continentOfLeague(save.leagueId || 'eng')

  const pushAward = (a: SeasonIndividualAward | null) => {
    if (!a) return
    won.push(a)
    awards = pushHistory(awards, { type: 'season', award: a })
    news.push(newsForSeasonAward(a))
  }

  // —— ดาวซัลโว / ถุงมือทองคำ ต่อดิวิชัน (ในลีกเดียวกัน weight เท่ากัน → นับประตู) ——
  for (const division of [1, 2] as const) {
    const pool = players.filter((p) => p.division === division && p.appsLeague > 0)
    const boot = [...pool].sort((a, b) =>
      compareGoldenShoe(
        {
          shoePoints: a.shoePoints || goldenShoePoints(a.goalsLeague, a.originLeagueId || save.leagueId, a.division),
          goalsLeague: a.goalsLeague,
          minutes: a.minutes,
          assistsAll: a.assistsAll,
          penaltyGoals: a.penaltyGoals ?? 0,
        },
        {
          shoePoints: b.shoePoints || goldenShoePoints(b.goalsLeague, b.originLeagueId || save.leagueId, b.division),
          goalsLeague: b.goalsLeague,
          minutes: b.minutes,
          assistsAll: b.assistsAll,
          penaltyGoals: b.penaltyGoals ?? 0,
        },
      ),
    )[0]
    if (boot && boot.goalsLeague > 0) {
      const w = leagueDifficultyWeight(
        boot.originLeagueId || save.leagueId,
        boot.division,
        shoeScopeForLeague(save.leagueId),
      )
      const pts = boot.shoePoints || goldenShoePoints(boot.goalsLeague, boot.originLeagueId || save.leagueId, boot.division)
      pushAward(
        toSeasonAward(
          save,
          'golden_boot',
          'league',
          boot,
          `ดาวซัลโว · ${divisionLabel(save.leagueName, division)}`,
          pts,
          `${boot.goalsLeague} ประตู ×${w.toFixed(1)} = ${pts} แต้ม · ${boot.assistsAll}A · ${leagueWeightNote(boot.originLeagueId || save.leagueId, division)}`,
          when,
          division,
        ),
      )
    }
    const glovePool = pool.filter((p) => p.role === 'GK')
    const glove = pickTop(
      glovePool,
      (p) => p.cleanSheets * 1000 + p.saves + p.ratingSum / 50,
    )
    if (glove && (glove.cleanSheets > 0 || glove.saves > 0)) {
      pushAward(
        toSeasonAward(
          save,
          'golden_glove',
          'league',
          glove,
          `ถุงมือทองคำ · ${divisionLabel(save.leagueName, division)}`,
          glove.cleanSheets,
          `${glove.cleanSheets} คลีนชีต · ${glove.saves} เซฟ`,
          when,
          division,
        ),
      )
    }
  }

  // —— ทวีป: Golden Shoe ด้วยตัวคูณความยาก (Div1 vs Div2 / คลับต่างลีก) ——
  if (continent === 'europe' || continent === 'asia' || continent === 'americas') {
    const cLabel = continentLabel(continent)
    const scope = shoeScopeForLeague(save.leagueId || 'eng')
    const allPool = players.filter((p) => p.appsAll > 0 || p.goalsLeague > 0)

    const cBoot = [...allPool]
      .filter((p) => p.goalsLeague > 0)
      .sort((a, b) =>
        compareGoldenShoe(
          {
            shoePoints:
              a.shoePoints ||
              goldenShoePoints(a.goalsLeague, a.originLeagueId || save.leagueId, a.division, scope),
            goalsLeague: a.goalsLeague,
            minutes: a.minutes,
            assistsAll: a.assistsAll,
            penaltyGoals: a.penaltyGoals ?? 0,
          },
          {
            shoePoints:
              b.shoePoints ||
              goldenShoePoints(b.goalsLeague, b.originLeagueId || save.leagueId, b.division, scope),
            goalsLeague: b.goalsLeague,
            minutes: b.minutes,
            assistsAll: b.assistsAll,
            penaltyGoals: b.penaltyGoals ?? 0,
          },
        ),
      )[0]
    if (cBoot && cBoot.goalsLeague > 0) {
      const w = leagueDifficultyWeight(
        cBoot.originLeagueId || save.leagueId,
        cBoot.division,
        scope,
      )
      const pts =
        cBoot.shoePoints ||
        goldenShoePoints(cBoot.goalsLeague, cBoot.originLeagueId || save.leagueId, cBoot.division, scope)
      pushAward(
        toSeasonAward(
          save,
          'golden_boot',
          continent,
          cBoot,
          `Golden Shoe ${cLabel}`,
          pts,
          `${cBoot.goalsLeague} ประตูลีก ×${w.toFixed(1)} = ${pts} แต้ม · ${cBoot.assistsAll}A · ไม่นับแค่จำนวนลูกดิบ`,
          when,
        ),
      )
    }

    const cGlove = pickTop(
      allPool.filter((p) => p.role === 'GK'),
      (p) => p.cleanSheets * 1000 + p.saves,
    )
    if (cGlove && (cGlove.cleanSheets > 0 || cGlove.saves > 0)) {
      pushAward(
        toSeasonAward(
          save,
          'golden_glove',
          continent,
          cGlove,
          `ถุงมือทองคำ${cLabel}`,
          cGlove.cleanSheets,
          `${cGlove.cleanSheets} คลีนชีต · ${cGlove.saves} เซฟ`,
          when,
        ),
      )
    }

    // Ballon d'Or ปีละครั้งต่อทวีปของลีกที่คุม
    const ballon = pickTop(
      allPool.filter((p) => p.appsAll >= 8 || p.goalsAll >= 8),
      (p) => {
        // ใช้ shoe points เป็นส่วนหนึ่งของคะแนน Ballon — ลดอคติลีกอ่อน
        const shoe =
          p.shoePoints ||
          goldenShoePoints(p.goalsLeague, p.originLeagueId || save.leagueId, p.division, scope)
        return ballonScore(p) + shoe * 0.35
      },
    )
    if (ballon) {
      const score = ballonScore(ballon)
      pushAward(
        toSeasonAward(
          save,
          'ballon_dor',
          continent,
          ballon,
          `Ballon d'Or ${cLabel} · ฤดูกาล ${save.season}`,
          score,
          `เรตติ้งเฉลี่ย ${(ballon.ratingSum / Math.max(1, ballon.appsAll)).toFixed(2)} · ${ballon.goalsAll}G ${ballon.assistsAll}A · shoe ${ballon.shoePoints || 0} แต้ม`,
          when,
        ),
      )
    }
  }

  awards = {
    ...awards,
    seasonAwards: won,
    seasonFinalized: save.season,
  }

  let next: GameSave = { ...save, awards }
  next = grantCareerHonours(
    next,
    won.map((a) => honourFromSeasonAward(a)),
  )
  for (const n of news) next = pushNews(next, n)
  return next
}

/** เริ่มฤดูกาลใหม่ — เคลียร์สะสม แต่เก็บ winners ใน history */
export function resetAwardsForNewSeason(save: GameSave): AwardsState {
  const prev = ensureAwards(save)
  return {
    ...emptyAwardsState(monthKeyFromDate(save.currentDate)),
    history: prev.history,
    // เก็บรางวัลฤดูกาลก่อนไว้ดูจนกว่าจะมีชุดใหม่
    seasonAwards: prev.seasonAwards,
    seasonFinalized: 0,
  }
}

