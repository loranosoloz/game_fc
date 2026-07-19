/**
 * European Golden Shoe–style league difficulty weights
 * แต้มดาวซัลโว = ประตูลีก × ค่าตัวคูณความยากของลีก
 */
import type { LeagueId } from '@/data/world'
import { isEuropeLeague } from './europeAccess'

const ASIA_IDS = new Set(['tha', 'jpn', 'kor', 'vie', 'idn', 'mys', 'sgp', 'sau'])

function isAsia(id: string): boolean {
  return ASIA_IDS.has(id)
}

/** อันดับสัมประสิทธิ์ยุโรป (ยิ่งน้อยยิ่งยาก) — อ้างอิง UEFA-style */
export const UEFA_COEFFICIENT_RANK: Record<string, number> = {
  eng: 1,
  esp: 2,
  ita: 3,
  ger: 4,
  fra: 5,
  ned: 6,
  prt: 7,
  bel: 8,
  tur: 9,
  sco: 11,
  aut: 12,
  sui: 13,
  den: 15,
  gre: 18,
}

/** อันดับสัมประสิทธิ์เอเชีย (AFC-style ในเกม) */
export const AFC_COEFFICIENT_RANK: Record<string, number> = {
  sau: 1,
  jpn: 2,
  kor: 3,
  tha: 4,
  vie: 5,
  idn: 6,
  mys: 7,
  sgp: 8,
}

/** อเมริกาใต้ (CONMEBOL-lite) */
export const CONMEBOL_COEFFICIENT_RANK: Record<string, number> = {
  bra: 1,
}

export type ShoeScope = 'uefa' | 'afc' | 'conmebol' | 'global'

export function shoeScopeForLeague(leagueId: string): ShoeScope {
  if (isEuropeLeague(leagueId)) return 'uefa'
  if (isAsia(leagueId)) return 'afc'
  if (leagueId === 'bra') return 'conmebol'
  return 'global'
}

/** อันดับสัมประสิทธิ์ตามขอบเขตทวีป */
export function leagueCoefficientRank(leagueId: string, scope?: ShoeScope): number {
  const s = scope ?? shoeScopeForLeague(leagueId)
  if (s === 'uefa') return UEFA_COEFFICIENT_RANK[leagueId] ?? 30
  if (s === 'afc') return AFC_COEFFICIENT_RANK[leagueId] ?? 10
  if (s === 'conmebol') return CONMEBOL_COEFFICIENT_RANK[leagueId] ?? 5
  // global: map Asia/Brazil onto a softer UEFA-like scale
  if (UEFA_COEFFICIENT_RANK[leagueId] != null) return UEFA_COEFFICIENT_RANK[leagueId]!
  if (leagueId === 'jpn') return 20
  if (leagueId === 'bra') return 10
  if (leagueId === 'kor') return 28
  if (leagueId === 'tha') return 40
  return 35
}

/**
 * Tier 1 (อันดับ 1–5) → ×2.0
 * Tier 2 (อันดับ 6–22) → ×1.5
 * Tier 3 (23+) → ×1.0
 * ดิวิชัน 2: ลดครึ่งขั้น (อย่างน้อย ×1.0)
 */
export function leagueDifficultyWeight(
  leagueId: string,
  division: 1 | 2 = 1,
  scope?: ShoeScope,
): number {
  const rank = leagueCoefficientRank(leagueId, scope)
  let weight = 1.0
  if (rank <= 5) weight = 2.0
  else if (rank <= 22) weight = 1.5
  else weight = 1.0

  if (division === 2) {
    // ลีกล่างของประเทศเดียวกัน — ลดน้ำหนักความยาก
    weight = Math.max(1.0, weight - 0.5)
  }
  return weight
}

export function goldenShoePoints(
  leagueGoals: number,
  leagueId: string,
  division: 1 | 2 = 1,
  scope?: ShoeScope,
): number {
  return Math.round(leagueGoals * leagueDifficultyWeight(leagueId, division, scope) * 10) / 10
}

export function weightTierLabel(weight: number): string {
  if (weight >= 2) return 'Tier 1 · ×2.0'
  if (weight >= 1.5) return 'Tier 2 · ×1.5'
  return 'Tier 3 · ×1.0'
}

export function leagueWeightNote(leagueId: string, division: 1 | 2 = 1, scope?: ShoeScope): string {
  const w = leagueDifficultyWeight(leagueId, division, scope)
  const rank = leagueCoefficientRank(leagueId, scope)
  return `${weightTierLabel(w)} · อันดับสัมประสิทธิ์ #${rank}${division === 2 ? ' · ดิวิชัน 2' : ''}`
}

/** เปรียบเทียบดาวซัลโวแบบ Golden Shoe + tie-breakers */
export function compareGoldenShoe(
  a: {
    shoePoints: number
    goalsLeague: number
    minutes: number
    assistsAll: number
    penaltyGoals: number
  },
  b: {
    shoePoints: number
    goalsLeague: number
    minutes: number
    assistsAll: number
    penaltyGoals: number
  },
): number {
  if (b.shoePoints !== a.shoePoints) return b.shoePoints - a.shoePoints
  // Minutes per Goal — น้อยกว่าดีกว่า
  const mpgA = a.goalsLeague > 0 ? a.minutes / a.goalsLeague : 9999
  const mpgB = b.goalsLeague > 0 ? b.minutes / b.goalsLeague : 9999
  if (mpgA !== mpgB) return mpgA - mpgB
  if (b.assistsAll !== a.assistsAll) return b.assistsAll - a.assistsAll
  // Non-penalty goals — ยิงจุดโทษน้อยกว่าดีกว่า
  const npA = a.goalsLeague - a.penaltyGoals
  const npB = b.goalsLeague - b.penaltyGoals
  return npB - npA
}

export function isKnownLeagueId(id: string): id is LeagueId {
  return (
    id in UEFA_COEFFICIENT_RANK ||
    id in AFC_COEFFICIENT_RANK ||
    id in CONMEBOL_COEFFICIENT_RANK
  )
}
