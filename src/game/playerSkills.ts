import skillsDb from '@/data/positionSkills.json'
import type { Player, PositionGroup, RoleCode } from './types'
import { roleGroup } from './positions'

export type SkillEffect = 'attack' | 'defend' | 'both'

export interface PositionSkillDef {
  id: string
  labelTh: string
  effect: SkillEffect
  power: number
}

export const MAX_PLAYER_SKILLS = skillsDb.maxPerPlayer as number

const BY_POS = skillsDb.byPosition as Record<PositionGroup, PositionSkillDef[]>

/** Validate catalog: no duplicate ids across positions */
function assertUniqueCatalog() {
  const seen = new Set<string>()
  for (const pos of Object.keys(BY_POS) as PositionGroup[]) {
    for (const s of BY_POS[pos]) {
      if (seen.has(s.id)) throw new Error(`Duplicate skill id: ${s.id}`)
      seen.add(s.id)
    }
  }
}
assertUniqueCatalog()

export function skillsForPosition(pos: PositionGroup): PositionSkillDef[] {
  return BY_POS[pos] ?? []
}

export function skillsForRole(role: RoleCode): PositionSkillDef[] {
  return skillsForPosition(roleGroup(role))
}

export function skillDef(id: string): PositionSkillDef | undefined {
  for (const pos of Object.keys(BY_POS) as PositionGroup[]) {
    const hit = BY_POS[pos].find((s) => s.id === id)
    if (hit) return hit
  }
  return undefined
}

export function skillLabel(id: string): string {
  return skillDef(id)?.labelTh ?? id
}

/** Keep only valid skills for the player's position, cap at max. */
export function sanitizePlayerSkills(
  skills: string[] | undefined,
  position: PositionGroup,
): string[] {
  const pool = new Set(skillsForPosition(position).map((s) => s.id))
  const out: string[] = []
  for (const id of skills ?? []) {
    if (!pool.has(id)) continue
    if (out.includes(id)) continue
    out.push(id)
    if (out.length >= MAX_PLAYER_SKILLS) break
  }
  return out
}

/**
 * Roll starting skills for a new player.
 * Higher overall / key role → more skills (2–8, never over 10).
 */
export function rollPlayerSkills(
  position: PositionGroup,
  overall: number,
  rng: () => number,
): string[] {
  const pool = skillsForPosition(position).slice()
  // shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j], pool[i]]
  }
  let count: number
  if (position === 'GK') {
    count = overall >= 80 ? 5 : overall >= 70 ? 4 : overall >= 60 ? 3 : 2
  } else {
    count = overall >= 85 ? 7 : overall >= 78 ? 6 : overall >= 70 ? 5 : overall >= 60 ? 4 : 3
  }
  count = Math.min(MAX_PLAYER_SKILLS, Math.max(1, count))
  // Prefer higher power skills slightly
  pool.sort((a, b) => b.power - a.power + (rng() - 0.5) * 2)
  return pool.slice(0, count).map((s) => s.id)
}

export function ensurePlayerSkills(player: Player): string[] {
  const pos = player.position ?? roleGroup(player.role)
  const existing = sanitizePlayerSkills(player.skills, pos)
  if (existing.length > 0) return existing
  // Deterministic-ish fallback from id hash if missing
  let h = 0
  for (let i = 0; i < player.id.length; i++) h = (h * 31 + player.id.charCodeAt(i)) >>> 0
  const rng = () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
  return rollPlayerSkills(pos, player.overall, rng)
}

/** Aggregate XI skill bonuses for match engine (small %). */
export function xiSkillBonuses(
  players: Player[],
  xiIds: string[],
): { attack: number; defend: number } {
  let atk = 0
  let def = 0
  let n = 0
  for (const id of xiIds) {
    const p = players.find((x) => x.id === id)
    if (!p) continue
    if (p.injuryDays > 0 || (p.illnessDays ?? 0) > 0) continue
    n += 1
    const skills = ensurePlayerSkills(p)
    for (const sid of skills) {
      const d = skillDef(sid)
      if (!d) continue
      const w = d.power * 0.004 // ~0.4% per power point
      if (d.effect === 'attack' || d.effect === 'both') atk += w
      if (d.effect === 'defend' || d.effect === 'both') def += w
    }
  }
  if (n === 0) return { attack: 1, defend: 1 }
  // Soft cap
  return {
    attack: 1 + Math.min(0.12, atk),
    defend: 1 + Math.min(0.12, def),
  }
}

export function catalogCounts(): Record<PositionGroup, number> {
  return {
    GK: BY_POS.GK.length,
    DF: BY_POS.DF.length,
    MF: BY_POS.MF.length,
    FW: BY_POS.FW.length,
  }
}
