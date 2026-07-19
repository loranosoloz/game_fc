import skillsDb from '@/data/positionSkills.json'
import type { Player, PlayerAttributes, PositionGroup, RoleCode } from './types'
import { roleGroup } from './positions'
import {
  SKILL_MODS,
  MOD_SCALE,
  MOD_SOFT_CAP,
  emptySkillProfile,
  describeMods,
  type SkillModKey,
  type XiSkillProfile,
  type SkillMods,
} from './skillMods'

export type SkillEffect = 'attack' | 'defend' | 'both'

export interface PositionSkillDef {
  id: string
  labelTh: string
  effect: SkillEffect
  power: number
  descTh?: string
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
      if (!SKILL_MODS[s.id]) {
        console.warn(`[playerSkills] missing SKILL_MODS for ${s.id}`)
      }
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

export function skillDescription(id: string): string {
  const d = skillDef(id)
  if (!d) return id
  const mods = SKILL_MODS[id] ?? fallbackMods(d.effect)
  const effectLine = describeMods(mods, d.power)
  return d.descTh ? `${d.descTh} (${effectLine})` : effectLine
}

function fallbackMods(effect: SkillEffect): SkillMods {
  if (effect === 'both') return { attack: 1, defend: 1 }
  if (effect === 'defend') return { defend: 1 }
  return { attack: 1 }
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

export type SkillAssignInput = {
  id?: string
  position: PositionGroup
  role?: RoleCode
  overall: number
  attrs?: PlayerAttributes | null
  skills?: string[]
}

/** จำนวนสล็อตที่ควรมีตามความสามารถ (สูงสุด 10) */
export function skillSlotCount(overall: number, _position?: PositionGroup): number {
  let count: number
  if (overall >= 90) count = 10
  else if (overall >= 85) count = 9
  else if (overall >= 80) count = 8
  else if (overall >= 75) count = 7
  else if (overall >= 70) count = 6
  else if (overall >= 64) count = 5
  else if (overall >= 56) count = 4
  else count = 3
  return Math.min(MAX_PLAYER_SKILLS, Math.max(3, count))
}

function avg(...vals: number[]) {
  const ok = vals.filter((v) => typeof v === 'number' && !Number.isNaN(v))
  if (!ok.length) return 50
  return ok.reduce((a, b) => a + b, 0) / ok.length
}

/** ความถนัดของนักเตะต่อมิติสกิล (จากแอตทริบิวต์) */
function attrAffinity(attrs: PlayerAttributes | null | undefined, key: SkillModKey): number {
  if (!attrs) return 55
  const a = attrs
  switch (key) {
    case 'finish':
      return avg(a.finishing, a.composure, a.technique)
    case 'create':
      return avg(a.passing, a.vision, a.decision)
    case 'aerial':
      return avg(a.heading, a.jumping, a.aerialReach)
    case 'setpiece':
      return avg(a.crossing, a.technique, a.composure)
    case 'pace':
      return avg(a.pace, a.agility)
    case 'press':
      return avg(a.workRate, a.stamina, a.positioning)
    case 'dribble':
      return avg(a.dribbling, a.technique, a.agility)
    case 'duel':
      return avg(a.tackling, a.strength, a.positioning)
    case 'save':
      return avg(a.reflexes, a.handling, a.agility)
    case 'claim':
      return avg(a.aerialReach, a.handling, a.jumping)
    case 'distribute':
      return avg(a.passing, a.vision, a.decision)
    case 'focus':
      return avg(a.composure, a.decision, a.positioning)
    case 'attack':
      return avg(a.finishing, a.passing, a.dribbling, a.pace, a.vision)
    case 'defend':
      return avg(a.tackling, a.positioning, a.strength, a.workRate)
    default:
      return 55
  }
}

/** สกิลที่บทบาทนี้ถนัดเป็นพิเศษ */
const ROLE_PREF: Partial<Record<RoleCode, string[]>> = {
  GK: ['gk_shot_stopper', 'gk_reflex_wall', 'gk_one_on_one', 'gk_cross_claimer', 'gk_distribution'],
  CB: ['df_last_man', 'df_aerial_duel', 'df_man_mark', 'df_duel_winner', 'df_box_clearance', 'df_hold_line'],
  LB: ['df_overlap_wing', 'df_whipped_cross', 'df_recovery_pace', 'df_cut_inside_fb', 'df_wide_lock'],
  RB: ['df_overlap_wing', 'df_whipped_cross', 'df_recovery_pace', 'df_cut_inside_fb', 'df_wide_lock'],
  CDM: ['mf_anchor', 'mf_shield_defense', 'mf_interception', 'mf_duel_mid', 'mf_press_engine'],
  CM: ['mf_box_to_box', 'mf_progressive_pass', 'mf_dictates_tempo', 'mf_carrier', 'mf_duel_mid'],
  CAM: ['mf_killer_pass', 'mf_through_ball', 'mf_deep_playmaker', 'mf_half_space', 'mf_vision_scan'],
  LM: ['mf_wide_creator', 'mf_switch_field', 'mf_drive_forward', 'mf_wide_track', 'mf_corner_delivery'],
  RM: ['mf_wide_creator', 'mf_switch_field', 'mf_drive_forward', 'mf_wide_track', 'mf_corner_delivery'],
  LW: ['fw_dribble_cut', 'fw_wide_finisher', 'fw_pace_burst', 'fw_cutback', 'fw_channel_run'],
  RW: ['fw_dribble_cut', 'fw_wide_finisher', 'fw_pace_burst', 'fw_cutback', 'fw_channel_run'],
  ST: ['fw_poacher', 'fw_clinical', 'fw_composure_box', 'fw_places_shots', 'fw_runs_in_behind'],
  SS: ['fw_false_nine', 'fw_link_up', 'fw_drop_deep', 'fw_composure_box', 'mf_second_striker_link'],
}

function scoreSkillForPlayer(
  skill: PositionSkillDef,
  input: SkillAssignInput,
  rng: () => number,
): number {
  const mods = SKILL_MODS[skill.id] ?? fallbackMods(skill.effect)
  let score = skill.power * 0.4
  for (const [key, weight] of Object.entries(mods) as [SkillModKey, number][]) {
    if (!weight) continue
    score += weight * (attrAffinity(input.attrs, key) / 99) * skill.power
  }
  const prefs = input.role ? ROLE_PREF[input.role] : undefined
  if (prefs?.includes(skill.id)) score += 2.2
  // คนเก่งได้สกิล power สูงง่ายกว่า
  if (input.overall >= 82 && skill.power >= 3) score += 0.8
  if (input.overall < 65 && skill.power >= 3) score -= 0.6
  score += (rng() - 0.5) * 0.55
  return score
}

function rngFromId(id: string): () => number {
  let h = 2166136261
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return () => {
    h = (Math.imul(h, 1664525) + 1013904223) >>> 0
    return h / 4294967296
  }
}

/**
 * ฝังพลังแฝงตามความสามารถ + แอตทริบิวต์ + บทบาท
 * (จำนวนสล็อตขึ้นกับ OVR — ดาวเต็มเกือบ 10)
 */
export function assignPlayerSkills(
  input: SkillAssignInput,
  rng: () => number = Math.random,
): string[] {
  const target = skillSlotCount(input.overall, input.position)
  const pool = skillsForPosition(input.position)
  if (!pool.length) return []
  const ranked = pool
    .map((s) => ({ s, score: scoreSkillForPlayer(s, input, rng) }))
    .sort((a, b) => b.score - a.score)
  return ranked.slice(0, target).map((x) => x.s.id)
}

/** เติมสล็อตให้ถึงเป้าหมายตามความสามารถ โดยเลือกสกิลที่เข้ากับตัวนักเตะ */
export function topUpPlayerSkills(
  input: SkillAssignInput,
  rng: () => number = Math.random,
): string[] {
  const pos = input.position
  const existing = sanitizePlayerSkills(input.skills, pos)
  const target = skillSlotCount(input.overall, pos)
  if (existing.length >= target) return existing.slice(0, MAX_PLAYER_SKILLS)
  if (existing.length === 0) return assignPlayerSkills(input, rng)

  const owned = new Set(existing)
  const ranked = skillsForPosition(pos)
    .filter((s) => !owned.has(s.id))
    .map((s) => ({ s, score: scoreSkillForPlayer(s, input, rng) }))
    .sort((a, b) => b.score - a.score)
  const need = target - existing.length
  return [...existing, ...ranked.slice(0, need).map((x) => x.s.id)].slice(0, MAX_PLAYER_SKILLS)
}

/**
 * Roll starting skills — ตามความสามารถ (รองรับ attrs/role)
 */
export function rollPlayerSkills(
  position: PositionGroup,
  overall: number,
  rng: () => number,
  opts?: { role?: RoleCode; attrs?: PlayerAttributes | null; id?: string },
): string[] {
  return assignPlayerSkills(
    {
      id: opts?.id,
      position,
      role: opts?.role,
      overall,
      attrs: opts?.attrs,
    },
    rng,
  )
}

/**
 * Unlock one empty พลังแฝง slot when developing (training / matchday).
 * เลือกสกิลที่เข้ากับความสามารถของนักเตะ
 */
export function tryUnlockPlayerSkill(
  player: Player,
  rng: () => number = Math.random,
): { skills: string[]; unlockedId: string } | null {
  const pos = player.position ?? roleGroup(player.role)
  const current = sanitizePlayerSkills(player.skills, pos)
  if (current.length >= MAX_PLAYER_SKILLS) return null
  const owned = new Set(current)
  const input: SkillAssignInput = {
    id: player.id,
    position: pos,
    role: player.role,
    overall: player.overall,
    attrs: player.attrs,
    skills: current,
  }
  const candidates = skillsForPosition(pos)
    .filter((s) => !owned.has(s.id))
    .map((s) => ({ s, score: scoreSkillForPlayer(s, input, rng) }))
    .sort((a, b) => b.score - a.score)
  if (candidates.length === 0) return null
  // เลือกจาก top 4 ที่เข้ากับตัว
  const pick = candidates[Math.floor(rng() * Math.min(4, candidates.length))]!.s
  return { skills: [...current, pick.id], unlockedId: pick.id }
}

/** ทุกนักเตะต้องมีพลังแฝงครบตามความสามารถ — ฝังตามแอตทริบิวต์/บทบาท */
export function ensurePlayerSkills(player: Player): string[] {
  const pos = player.position ?? roleGroup(player.role)
  const rng = rngFromId(player.id || `${player.name}-${player.overall}`)
  const existing = sanitizePlayerSkills(player.skills, pos)
  const target = skillSlotCount(player.overall, pos)
  const ability = assignPlayerSkills(
    {
      id: player.id,
      position: pos,
      role: player.role,
      overall: player.overall,
      attrs: player.attrs,
    },
    rng,
  )
  // ยังไม่เกินเป้า → ใช้ชุดตามความสามารถ (stable จาก id)
  if (existing.length <= target) return ability
  // มีปลดล็อกเกินเป้า → คงสกิลพิเศษที่ปลดเพิ่มไว้
  const extras = existing.filter((id) => !ability.includes(id))
  return [...ability, ...extras].slice(0, MAX_PLAYER_SKILLS)
}

function addSkillToProfile(profile: XiSkillProfile, skillId: string, power: number) {
  const mods = SKILL_MODS[skillId] ?? fallbackMods(skillDef(skillId)?.effect ?? 'attack')
  for (const [key, weight] of Object.entries(mods) as [SkillModKey, number][]) {
    if (!weight) continue
    profile[key] += weight * power * MOD_SCALE
  }
}

function softCapProfile(profile: XiSkillProfile): XiSkillProfile {
  const out = emptySkillProfile()
  for (const key of Object.keys(out) as SkillModKey[]) {
    const bonus = Math.max(0, profile[key] - 1)
    out[key] = 1 + Math.min(MOD_SOFT_CAP[key], bonus)
  }
  return out
}

/** Aggregate XI skill profile for match engine. */
export function xiSkillProfile(players: Player[], xiIds: string[]): XiSkillProfile {
  const raw = emptySkillProfile()
  // emptySkillProfile starts at 1; we accumulate bonuses on top of 1
  for (const key of Object.keys(raw) as SkillModKey[]) raw[key] = 1

  let n = 0
  for (const id of xiIds) {
    const p = players.find((x) => x.id === id)
    if (!p) continue
    if (p.injuryDays > 0 || (p.illnessDays ?? 0) > 0) continue
    n += 1
    for (const sid of ensurePlayerSkills(p)) {
      const d = skillDef(sid)
      addSkillToProfile(raw, sid, d?.power ?? 1)
    }
  }
  if (n === 0) return emptySkillProfile()
  return softCapProfile(raw)
}

/** @deprecated use xiSkillProfile — kept for callers expecting attack/defend only */
export function xiSkillBonuses(
  players: Player[],
  xiIds: string[],
): { attack: number; defend: number } {
  const p = xiSkillProfile(players, xiIds)
  return { attack: p.attack, defend: p.defend }
}

/** Weight for picking scorers / assisters from skill profile of a player. */
export function playerSkillWeight(
  player: Player,
  keys: SkillModKey[],
): number {
  let w = 1
  for (const sid of ensurePlayerSkills(player)) {
    const d = skillDef(sid)
    const mods = SKILL_MODS[sid]
    if (!mods || !d) continue
    for (const k of keys) {
      const m = mods[k]
      if (m) w += m * d.power * 0.35
    }
  }
  return w
}

export function pickWeightedPlayer(
  rng: () => number,
  pool: Player[],
  keys: SkillModKey[],
): Player {
  if (pool.length === 0) throw new Error('empty pool')
  if (pool.length === 1) return pool[0]
  const weights = pool.map((p) => playerSkillWeight(p, keys))
  const sum = weights.reduce((a, b) => a + b, 0)
  let r = rng() * sum
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

export function catalogCounts(): Record<PositionGroup, number> {
  return {
    GK: BY_POS.GK.length,
    DF: BY_POS.DF.length,
    MF: BY_POS.MF.length,
    FW: BY_POS.FW.length,
  }
}

export { describeMods } from './skillMods'
export type { SkillModKey, XiSkillProfile }

