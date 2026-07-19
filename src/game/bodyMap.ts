import type { BodyMap, BodyPartId, InjuryType, Player, PositionGroup } from './types'

export const BODY_PARTS: BodyPartId[] = [
  'head',
  'neck',
  'shoulderL',
  'shoulderR',
  'chest',
  'back',
  'armL',
  'armR',
  'handL',
  'handR',
  'abdomen',
  'groin',
  'thighL',
  'thighR',
  'kneeL',
  'kneeR',
  'calfL',
  'calfR',
  'ankleL',
  'ankleR',
  'footL',
  'footR',
]

export const BODY_PART_LABEL: Record<BodyPartId, string> = {
  head: 'ศีรษะ',
  neck: 'คอ',
  shoulderL: 'ไหล่ซ้าย',
  shoulderR: 'ไหล่ขวา',
  chest: 'อก',
  back: 'หลัง',
  armL: 'แขนซ้าย',
  armR: 'แขนขวา',
  handL: 'มือซ้าย',
  handR: 'มือขวา',
  abdomen: 'ท้อง',
  groin: 'ขาหนีบ',
  thighL: 'ต้นขาซ้าย',
  thighR: 'ต้นขาขวา',
  kneeL: 'เข่าซ้าย',
  kneeR: 'เข่าขวา',
  calfL: 'น่องซ้าย',
  calfR: 'น่องขวา',
  ankleL: 'ข้อเท้าซ้าย',
  ankleR: 'ข้อเท้าขวา',
  footL: 'เท้าซ้าย',
  footR: 'เท้าขวา',
}

export type BodyPartTone = 'green' | 'yellow' | 'red'

const MUSCLE_PARTS: BodyPartId[] = [
  'thighL',
  'thighR',
  'calfL',
  'calfR',
  'groin',
  'back',
  'abdomen',
  'armL',
  'armR',
]
const LIGAMENT_PARTS: BodyPartId[] = [
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
  'shoulderL',
  'shoulderR',
  'handL',
  'handR',
]
const BONE_PARTS: BodyPartId[] = [
  'footL',
  'footR',
  'calfL',
  'calfR',
  'handL',
  'handR',
  'head',
  'chest',
]

export function createBodyMap(rng = Math.random): BodyMap {
  const map = {} as BodyMap
  for (const part of BODY_PARTS) {
    map[part] = Math.round(82 + rng() * 16)
  }
  return map
}

export function ensureBodyMap(player: Partial<Player> & { bodyMap?: BodyMap }): BodyMap {
  const base = player.bodyMap
  const out = {} as BodyMap
  for (const part of BODY_PARTS) {
    const v = base?.[part]
    out[part] = typeof v === 'number' ? Math.max(0, Math.min(100, Math.round(v))) : 90
  }
  return out
}

export function bodyPartTone(fitness: number): BodyPartTone {
  if (fitness >= 70) return 'green'
  if (fitness >= 40) return 'yellow'
  return 'red'
}

export function bodyPartColor(fitness: number): string {
  const tone = bodyPartTone(fitness)
  if (tone === 'green') return '#22c55e'
  if (tone === 'yellow') return '#eab308'
  return '#ef4444'
}

export function pickInjuredBodyPart(
  type: InjuryType,
  map: BodyMap,
  rng = Math.random,
): BodyPartId {
  const pool = type === 'ligament' ? LIGAMENT_PARTS : type === 'bone' ? BONE_PARTS : MUSCLE_PARTS
  const ranked = pool
    .slice()
    .sort((a, b) => (map[a] ?? 90) - (map[b] ?? 90) + (rng() - 0.5) * 10)
  return ranked[0] ?? 'thighR'
}

function wearTargets(position: PositionGroup): BodyPartId[] {
  const legs: BodyPartId[] = ['thighL', 'thighR', 'calfL', 'calfR', 'kneeL', 'kneeR']
  if (position === 'GK') {
    return ['shoulderL', 'shoulderR', 'handL', 'handR', 'kneeL', 'kneeR', 'back', ...legs]
  }
  if (position === 'DF') {
    return ['ankleL', 'ankleR', 'kneeL', 'kneeR', 'head', 'chest', ...legs]
  }
  if (position === 'FW') {
    return ['groin', 'ankleL', 'ankleR', 'thighL', 'thighR', ...legs]
  }
  return ['groin', 'back', 'ankleL', 'ankleR', ...legs]
}

export function applyMatchWear(
  player: Player,
  intensity: 'starter' | 'sub' | 'unused',
  rng = Math.random,
): Player {
  const map = { ...ensureBodyMap(player) }
  if (intensity === 'unused') {
    for (const part of BODY_PARTS) {
      map[part] = Math.min(100, map[part] + 1 + (rng() > 0.7 ? 1 : 0))
    }
    return { ...player, bodyMap: map }
  }
  const mul = intensity === 'starter' ? 1 : 0.45
  const targets = wearTargets(player.position)
  const hits = 2 + Math.floor(rng() * 3)
  for (let i = 0; i < hits; i++) {
    const part = targets[Math.floor(rng() * targets.length)]
    const drop = (3 + Math.floor(rng() * 6) + player.hidden.injuryProneness / 8) * mul
    const ageMul = player.age >= 32 ? 1.2 : player.age <= 21 ? 0.85 : 1
    map[part] = Math.max(5, Math.round(map[part] - drop * ageMul))
  }
  for (const part of BODY_PARTS) {
    map[part] = Math.max(5, Math.round(map[part] - 0.5 * mul))
  }
  return { ...player, bodyMap: map }
}

export function applyTrainingWear(player: Player, heavy: boolean, rng = Math.random): Player {
  const map = { ...ensureBodyMap(player) }
  if (!heavy) {
    for (const part of BODY_PARTS) {
      map[part] = Math.min(100, map[part] + 2)
    }
    return { ...player, bodyMap: map }
  }
  const parts: BodyPartId[] = [
    'thighL',
    'thighR',
    'calfL',
    'calfR',
    'kneeL',
    'kneeR',
    'groin',
    'back',
  ]
  const part = parts[Math.floor(rng() * parts.length)]
  map[part] = Math.max(8, map[part] - (4 + Math.floor(rng() * 8)))
  return { ...player, bodyMap: map }
}

export function markBodyPartInjured(player: Player, part: BodyPartId): Player {
  const map = { ...ensureBodyMap(player) }
  map[part] = Math.min(map[part], 18 + Math.floor(Math.random() * 14))
  return { ...player, bodyMap: map, injuryBodyPart: part }
}

export function healBodyMap(player: Player, physioLevel: number, injured: boolean): Player {
  const map = { ...ensureBodyMap(player) }
  const bonus = 1 + Math.floor(physioLevel / 10)
  for (const part of BODY_PARTS) {
    let gain = injured ? 1 + bonus : 2 + bonus
    if (player.injuryBodyPart === part && injured) gain = Math.max(1, Math.floor(gain * 0.55))
    map[part] = Math.min(100, map[part] + gain)
  }
  if (!injured) {
    return { ...player, bodyMap: map, injuryBodyPart: null }
  }
  return { ...player, bodyMap: map }
}

export function weakestBodyParts(
  player: Player,
  n = 3,
): { part: BodyPartId; fitness: number; label: string }[] {
  const map = ensureBodyMap(player)
  return BODY_PARTS.map((part) => ({
    part,
    fitness: map[part],
    label: BODY_PART_LABEL[part],
  }))
    .sort((a, b) => a.fitness - b.fitness)
    .slice(0, n)
}

export function bodyMapSummary(player: Player): { green: number; yellow: number; red: number } {
  const map = ensureBodyMap(player)
  let green = 0
  let yellow = 0
  let red = 0
  for (const part of BODY_PARTS) {
    const t = bodyPartTone(map[part])
    if (t === 'green') green++
    else if (t === 'yellow') yellow++
    else red++
  }
  return { green, yellow, red }
}

/** Extra injury chance from worn red/yellow regions */
export function bodyWearInjuryBonus(player: Player): number {
  const map = ensureBodyMap(player)
  let bonus = 0
  for (const part of BODY_PARTS) {
    if (map[part] < 40) bonus += 0.012
    else if (map[part] < 55) bonus += 0.004
  }
  return Math.min(0.08, bonus)
}
