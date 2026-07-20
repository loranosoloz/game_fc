/**
 * ประวัติย้อนหลัง 10 ปี (2016–2026) — สโมสร · ทีมชาติ · โค้ช · นักเตะ
 */
import historyDb from '@/data/world/worldHistory.json'
import type { GameSave, Player } from './types'
import type { PlayerCareerHonour } from './awards'

export type HistoryEventKind = 'nation' | 'club' | 'award' | 'other'

export interface HistoryTimelineEvent {
  year: number
  kind: HistoryEventKind | string
  comp?: string
  season?: string
  leagueId?: string
  title: string
  titleTh: string
  winner: string
  winnerTh?: string
  winnerKey?: string
  runnerUp?: string
  runnerUpTh?: string
  coach?: string
  keyPlayers?: string[]
  blurbTh?: string
}

export interface LeagueChampionRow {
  season: string
  endYear: number
  club: string
  clubTh: string
  clubKey?: string
  coach?: string
}

export interface BallonDorRow {
  year: number
  player: string | null
  nation?: string
  club?: string
  clubKey?: string | null
  noteTh?: string
}

export interface HistoryCoach {
  id: string
  name: string
  nationTh: string
  summaryTh: string
  honours2016to2026: string[]
}

export interface HistoryPlayer {
  name: string
  nation: string
  nationTh: string
  clubs: string[]
  summaryTh: string
  honours: Array<{ year: number; kind: string; label: string }>
  peakStats?: {
    season: string
    club: string
    goals?: number
    assists?: number
    noteTh?: string
  }
}

export interface WorldHistoryData {
  version: number
  range: { from: number; to: number }
  noteTh: string
  timeline: HistoryTimelineEvent[]
  leagues: Record<
    string,
    { name: string; nameTh: string; champions: LeagueChampionRow[] }
  >
  ballonDor: BallonDorRow[]
  coaches: HistoryCoach[]
  players: HistoryPlayer[]
}

const db = historyDb as WorldHistoryData

export function getWorldHistory(): WorldHistoryData {
  return db
}

export function historyTimeline(filter?: {
  kind?: string
  from?: number
  to?: number
}): HistoryTimelineEvent[] {
  let list = db.timeline.slice()
  if (filter?.kind) list = list.filter((e) => e.kind === filter.kind)
  if (filter?.from != null) list = list.filter((e) => e.year >= filter.from!)
  if (filter?.to != null) list = list.filter((e) => e.year <= filter.to!)
  return list.sort((a, b) => b.year - a.year || a.title.localeCompare(b.title))
}

export function leagueChampions(leagueId: string): LeagueChampionRow[] {
  return db.leagues[leagueId]?.champions?.slice().reverse() ?? []
}

export function findHistoryPlayer(name: string): HistoryPlayer | undefined {
  const n = name.trim().toLowerCase()
  return db.players.find((p) => p.name.toLowerCase() === n)
}

export function findHistoryCoach(idOrName: string): HistoryCoach | undefined {
  const q = idOrName.trim().toLowerCase()
  return db.coaches.find(
    (c) => c.id.toLowerCase() === q || c.name.toLowerCase() === q,
  )
}

/** แมป honour kind จากประวัติ → PlayerCareerHonourKind ที่เกมรองรับ */
function mapHonourKind(
  kind: string,
): import('./awards').PlayerCareerHonourKind | null {
  if (kind === 'ballon_dor') return 'ballon_dor'
  if (kind === 'golden_boot') return 'golden_boot'
  if (kind === 'golden_glove') return 'golden_glove'
  // ถ้วย/ลีก/ชาติ → เก็บเป็น detail ผ่าน ballon_dor label ไม่ได้ — ใช้ totm เป็น proxy ไม่ดี
  // เก็บเฉพาะรางวัลบุคคลที่ kind ตรง
  return null
}

/**
 * ติดเกียรติยศย้อนหลังให้นักเตะในเซฟที่ชื่อตรงกับคลังประวัติ
 * (เฉพาะ kind ที่ระบบรองรับ เช่น ballon_dor)
 */
export function seedCareerHonoursFromHistory(save: GameSave): GameSave {
  const byName = new Map(db.players.map((p) => [p.name.toLowerCase(), p]))
  let changed = false
  const players: Player[] = save.players.map((p) => {
    const hist = byName.get(p.name.toLowerCase())
    if (!hist) return p
    const existing = p.careerHonours ?? []
    const existingKeys = new Set(existing.map((h) => `${h.kind}:${h.season}:${h.label}`))
    const grants: PlayerCareerHonour[] = []
    for (const h of hist.honours) {
      const kind = mapHonourKind(h.kind)
      if (!kind) continue
      const key = `${kind}:${h.year}:${h.label}`
      if (existingKeys.has(key)) continue
      grants.push({
        id: `hist-${p.id}-${h.year}-${kind}`,
        kind,
        label: h.label,
        season: h.year,
        date: `${h.year}-12-01`,
        detail: hist.summaryTh,
      })
    }
    if (grants.length === 0) return p
    changed = true
    return {
      ...p,
      careerHonours: [...grants, ...existing].slice(0, 120),
    }
  })
  return changed ? { ...save, players } : save
}

export function worldHistoryBlurb(): string {
  return db.noteTh
}
