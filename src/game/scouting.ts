import type { GameSave, Player, PlayerAttributes, PlayerGrowth, PlayerHidden, ScoutKnowledge, StaffState } from './types'
import { staffLevel } from './staff'
import attributesDb from '@/data/attributes.json'

export function createScouting(players: Player[], humanClubId: string): ScoutKnowledge {
  const byPlayer: Record<string, number> = {}
  for (const p of players) {
    byPlayer[p.id] = p.clubId === humanClubId ? 100 : 25 + Math.floor(Math.random() * 25)
  }
  return { byPlayer }
}

export function knowledgeOf(scouting: ScoutKnowledge, playerId: string): number {
  return scouting.byPlayer[playerId] ?? 20
}

export function scoutPlayer(
  save: GameSave,
  playerId: string,
): { save: GameSave; message: string } {
  const level = staffLevel(save.staff, 'scout')
  const gain = 12 + Math.floor(level * 1.2)
  const prev = knowledgeOf(save.scouting, playerId)
  const next = Math.min(100, prev + gain)
  return {
    save: {
      ...save,
      scouting: {
        byPlayer: { ...save.scouting.byPlayer, [playerId]: next },
      },
    },
    message: `สเกาต์สำเร็จ ความรู้ ${prev}→${next}%`,
  }
}

/** Detailed masking: group unlock thresholds + noise */
export function maskAttrValue(
  value: number,
  knowledge: number,
  group: string,
): number | null | { band: string } {
  const groupNeed =
    group === 'goalkeeping' ? 50 : group === 'technical' ? 35 : group === 'mental' ? 45 : 40
  if (knowledge < groupNeed - 15) return null
  if (knowledge < groupNeed) {
    if (value >= 15) return { band: 'สูง' }
    if (value >= 10) return { band: 'กลาง' }
    return { band: 'ต่ำ' }
  }
  if (knowledge < 70) {
    const noise = knowledge < 55 ? 2 : 1
    const stepped = Math.round(value / (noise + 1)) * (noise + 1)
    return Math.max(1, Math.min(20, stepped))
  }
  return value
}

export function revealPa(pa: number, knowledge: number): string {
  if (knowledge >= 85) return String(pa)
  if (knowledge >= 55) {
    const band = Math.round(pa / 10) * 10
    return `~${band}`
  }
  if (knowledge >= 30) return pa >= 140 ? 'สูง' : pa >= 110 ? 'กลาง' : 'จำกัด'
  return '???'
}

export function revealHidden(
  hidden: PlayerHidden,
  knowledge: number,
): Partial<Record<keyof PlayerHidden, number | string | null>> {
  if (knowledge < 40) {
    return {
      consistency: null,
      importantMatches: null,
      dirtiness: null,
      injuryProneness: knowledge >= 25 ? (hidden.injuryProneness >= 12 ? 'เสี่ยง' : 'ปกติ') : null,
      versatility: null,
    }
  }
  if (knowledge < 75) {
    return {
      consistency: Math.round(hidden.consistency / 2) * 2,
      importantMatches: Math.round(hidden.importantMatches / 2) * 2,
      dirtiness: null,
      injuryProneness: hidden.injuryProneness,
      versatility: Math.round(hidden.versatility / 2) * 2,
    }
  }
  return { ...hidden }
}

export function revealGrowth(
  growth: PlayerGrowth,
  knowledge: number,
): Partial<Record<keyof PlayerGrowth, number | null>> {
  if (knowledge < 50) {
    return {
      determination: null,
      ambition: knowledge >= 35 ? growth.ambition : null,
      professionalism: null,
      adaptability: null,
      learningRate: knowledge >= 40 ? Math.round(growth.learningRate / 2) * 2 : null,
    }
  }
  if (knowledge < 80) {
    return {
      determination: Math.round(growth.determination / 2) * 2,
      ambition: growth.ambition,
      professionalism: Math.round(growth.professionalism / 2) * 2,
      adaptability: Math.round(growth.adaptability / 2) * 2,
      learningRate: growth.learningRate,
    }
  }
  return { ...growth }
}

export type MaskedAttrView = {
  key: keyof PlayerAttributes
  group: string
  display: string
  known: boolean
}

export function visibleAttrsDetailed(
  attrs: PlayerAttributes,
  knowledge: number,
): MaskedAttrView[] {
  return attributesDb.attributes.map((def) => {
    const key = def.key as keyof PlayerAttributes
    const masked = maskAttrValue(attrs[key], knowledge, def.group)
    if (masked === null) {
      return { key, group: def.group, display: '???', known: false }
    }
    if (typeof masked === 'object' && 'band' in masked) {
      return { key, group: def.group, display: masked.band, known: false }
    }
    return { key, group: def.group, display: String(masked), known: true }
  })
}

/** @deprecated use visibleAttrsDetailed */
export function visibleAttrs(
  attrs: PlayerAttributes,
  knowledge: number,
): Partial<Record<keyof PlayerAttributes, number | null>> {
  const out: Partial<Record<keyof PlayerAttributes, number | null>> = {}
  for (const row of visibleAttrsDetailed(attrs, knowledge)) {
    out[row.key] = row.known ? Number(row.display) : null
  }
  return out
}

export function weeklyScoutPassive(save: GameSave, staff: StaffState): ScoutKnowledge {
  const level = staffLevel(staff, 'scout')
  const byPlayer = { ...save.scouting.byPlayer }
  for (const p of save.players) {
    if (p.clubId === save.humanClubId) {
      byPlayer[p.id] = 100
      continue
    }
    if (Math.random() < 0.08 + level * 0.004) {
      byPlayer[p.id] = Math.min(100, (byPlayer[p.id] ?? 20) + 3)
    }
  }
  return { byPlayer }
}
