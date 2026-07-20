import type { InjuryRecord, InjuryTreatment, InjuryType, Player } from './types'
import {
  BODY_PART_LABEL,
  ensureBodyMap,
  healBodyMap,
  markBodyPartInjured,
  pickInjuredBodyPart,
} from './bodyMap'

const HISTORY_CAP = 24

export const INJURY_TYPE_LABEL: Record<InjuryType, string> = {
  muscle: 'กล้ามเนื้อ',
  ligament: 'เอ็น',
  bone: 'กระดูก',
}

export const TREATMENT_LABEL: Record<InjuryTreatment, string> = {
  rest: 'พัก',
  physio: 'Physio',
  injection: 'ฉีดยา',
}

export const TREATMENT_HINT: Record<InjuryTreatment, string> = {
  rest: 'ฟื้นช้า แต่สภาพดีขึ้นชัด',
  physio: 'สมดุล — แพทย์ช่วยเร่ง',
  injection: 'หายเร็ว แต่เสี่ยงซ้ำ + สภาพไม่เต็ม',
}

const TYPE_WEIGHTS: { type: InjuryType; w: number }[] = [
  { type: 'muscle', w: 55 },
  { type: 'ligament', w: 30 },
  { type: 'bone', w: 15 },
]

function pickInjuryType(rng = Math.random): InjuryType {
  const total = TYPE_WEIGHTS.reduce((s, r) => s + r.w, 0)
  let roll = rng() * total
  for (const row of TYPE_WEIGHTS) {
    roll -= row.w
    if (roll <= 0) return row.type
  }
  return 'muscle'
}

function daysForType(
  type: InjuryType,
  source: 'match' | 'training',
  age: number,
  rng = Math.random,
): number {
  let base: number
  if (source === 'training') {
    if (type === 'muscle') base = 3 + Math.floor(rng() * 5)
    else if (type === 'ligament') base = 6 + Math.floor(rng() * 6)
    else base = 12 + Math.floor(rng() * 10)
  } else if (type === 'muscle') base = 4 + Math.floor(rng() * 5)
  else if (type === 'ligament') base = 8 + Math.floor(rng() * 8)
  else base = 16 + Math.floor(rng() * 12)

  // Older players heal slower / longer absences
  if (age >= 33) base = Math.round(base * 1.25)
  else if (age >= 30) base = Math.round(base * 1.1)
  else if (age <= 21) base = Math.max(2, Math.round(base * 0.9))
  return base
}

export function rollInjury(
  source: 'match' | 'training',
  rng = Math.random,
  age = 25,
): { type: InjuryType; days: number } {
  const type = pickInjuryType(rng)
  return { type, days: daysForType(type, source, age, rng) }
}

export function applyInjury(
  player: Player,
  source: 'match' | 'training',
  rng = Math.random,
): Player {
  const rolled = rollInjury(source, rng, player.age)
  const map = ensureBodyMap(player)
  const bodyPart = pickInjuredBodyPart(rolled.type, map, rng)
  const record: InjuryRecord = {
    type: rolled.type,
    days: rolled.days,
    source,
    bodyPart,
  }
  const history = [record, ...(player.injuryHistory ?? [])].slice(0, HISTORY_CAP)
  let next: Player = {
    ...player,
    injuryDays: rolled.days,
    injuryType: rolled.type,
    treatment: player.treatment ?? 'physio',
    injuryHistory: history,
    condition: Math.max(35, player.condition - (source === 'training' ? 15 : 8)),
  }
  next = markBodyPartInjured(next, bodyPart)
  return next
}

export function clearInjuryFields(player: Player): Player {
  if (player.injuryDays > 0) return player
  return {
    ...player,
    injuryDays: 0,
    injuryType: null,
    treatment: null,
    injuryBodyPart: null,
  }
}

/** Days healed this tick from treatment + physio staff + injury type. */
export function recoveryTickAmount(player: Player, physioLevel: number): number {
  if (player.injuryDays <= 0) return 0
  const treatment = player.treatment ?? 'physio'
  let days = 1
  if (treatment === 'injection') days = 2 + Math.floor(physioLevel / 12)
  if (treatment === 'physio') days += Math.floor(physioLevel / 8)
  if (treatment === 'physio' && player.injuryType === 'muscle') days += 1
  if (player.injuryType === 'ligament' && treatment === 'physio') days += Math.floor(physioLevel / 15)
  if (player.injuryType === 'bone' && treatment !== 'injection') days = Math.min(days, 1)
  if (treatment === 'rest') days = 1
  if (player.age >= 33) days = Math.max(1, days - 1)
  return Math.max(1, days)
}

export function tickPlayerInjury(player: Player, physioLevel: number): Player {
  if (player.injuryDays <= 0) {
    const healed = healBodyMap(
      {
        ...player,
        condition: Math.min(100, player.condition + 3 + Math.floor(physioLevel / 8)),
        injuryType: null,
        treatment: null,
        injuryBodyPart: null,
      },
      physioLevel,
      false,
    )
    return healed
  }
  const heal = recoveryTickAmount(player, physioLevel)
  const treatment = player.treatment ?? 'physio'
  let condGain =
    treatment === 'rest' ? 5 + Math.floor(physioLevel / 8) : 2 + Math.floor(physioLevel / 8)
  if (treatment === 'injection') condGain = Math.max(1, condGain - 1)

  const nextDays = Math.max(0, player.injuryDays - heal)

  if (treatment === 'injection' && nextDays > 0 && Math.random() < 0.08) {
    return healBodyMap(
      {
        ...player,
        injuryDays: nextDays + 2,
        condition: Math.max(30, player.condition - 4),
      },
      physioLevel,
      true,
    )
  }

  const base = clearInjuryFields({
    ...player,
    condition: Math.min(100, player.condition + condGain),
    injuryDays: nextDays,
    injuryType: nextDays > 0 ? player.injuryType : null,
    treatment: nextDays > 0 ? treatment : null,
    injuryBodyPart: nextDays > 0 ? player.injuryBodyPart : null,
  })
  return healBodyMap(base, physioLevel, nextDays > 0)
}

export function formatInjuryStatus(player: Player): string {
  if (player.injuryDays <= 0) return `${player.condition}%`
  const type = player.injuryType ? INJURY_TYPE_LABEL[player.injuryType] : 'เจ็บ'
  const part = player.injuryBodyPart ? ` · ${BODY_PART_LABEL[player.injuryBodyPart]}` : ''
  return `${type}${part} ${player.injuryDays}ว`
}

export function setPlayerTreatment(player: Player, treatment: InjuryTreatment): Player {
  if (player.injuryDays <= 0) return player
  return { ...player, treatment }
}

export function injuryHistoryPenalty(player: Player): number {
  const hist = player.injuryHistory ?? []
  if (!hist.length) return 1
  const recent = hist.slice(0, 5)
  const boneHits = recent.filter((h) => h.type === 'bone').length
  const total = recent.length
  return Math.max(0.75, 1 - total * 0.03 - boneHits * 0.04)
}

export function estimatedReturnMatchdays(player: Player): number {
  if (player.injuryDays <= 0) return 0
  return Math.max(1, Math.ceil(player.injuryDays / 7))
}
