import type { InjuryRecord, InjuryTreatment, InjuryType, Player } from './types'

const HISTORY_CAP = 12

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

function daysForType(type: InjuryType, source: 'match' | 'training', rng = Math.random): number {
  if (source === 'training') {
    if (type === 'muscle') return 3 + Math.floor(rng() * 5)
    if (type === 'ligament') return 6 + Math.floor(rng() * 6)
    return 12 + Math.floor(rng() * 10)
  }
  if (type === 'muscle') return 4 + Math.floor(rng() * 5)
  if (type === 'ligament') return 8 + Math.floor(rng() * 8)
  return 16 + Math.floor(rng() * 12)
}

export function rollInjury(
  source: 'match' | 'training',
  rng = Math.random,
): { type: InjuryType; days: number } {
  const type = pickInjuryType(rng)
  return { type, days: daysForType(type, source, rng) }
}

export function applyInjury(
  player: Player,
  source: 'match' | 'training',
  rng = Math.random,
): Player {
  const rolled = rollInjury(source, rng)
  const record: InjuryRecord = { type: rolled.type, days: rolled.days, source }
  const history = [record, ...(player.injuryHistory ?? [])].slice(0, HISTORY_CAP)
  return {
    ...player,
    injuryDays: rolled.days,
    injuryType: rolled.type,
    treatment: player.treatment ?? 'physio',
    injuryHistory: history,
    condition: Math.max(35, player.condition - (source === 'training' ? 15 : 8)),
  }
}

export function clearInjuryFields(player: Player): Player {
  if (player.injuryDays > 0) return player
  return {
    ...player,
    injuryDays: 0,
    injuryType: null,
    treatment: null,
  }
}

/** Days healed this tick from treatment + physio staff + injury type. */
export function recoveryTickAmount(
  player: Player,
  physioLevel: number,
): number {
  if (player.injuryDays <= 0) return 0
  const treatment = player.treatment ?? 'physio'
  let days = 1
  if (treatment === 'injection') days = 2
  if (treatment === 'physio') days += Math.floor(physioLevel / 8)
  if (treatment === 'physio' && player.injuryType === 'muscle') days += 1
  if (player.injuryType === 'bone' && treatment !== 'injection') days = Math.min(days, 1)
  if (treatment === 'rest') days = 1
  return Math.max(1, days)
}

export function tickPlayerInjury(player: Player, physioLevel: number): Player {
  if (player.injuryDays <= 0) {
    return {
      ...player,
      condition: Math.min(100, player.condition + 3 + Math.floor(physioLevel / 8)),
      injuryType: null,
      treatment: null,
    }
  }
  const heal = recoveryTickAmount(player, physioLevel)
  const treatment = player.treatment ?? 'physio'
  const condGain =
    treatment === 'rest' ? 5 + Math.floor(physioLevel / 8) : 2 + Math.floor(physioLevel / 8)
  const nextDays = Math.max(0, player.injuryDays - heal)
  return clearInjuryFields({
    ...player,
    condition: Math.min(100, player.condition + condGain),
    injuryDays: nextDays,
    injuryType: nextDays > 0 ? player.injuryType : null,
    treatment: nextDays > 0 ? treatment : null,
  })
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

export function formatInjuryStatus(player: Player): string {
  if (player.injuryDays <= 0) return `${player.condition}%`
  const type = player.injuryType ? INJURY_TYPE_LABEL[player.injuryType] : 'เจ็บ'
  return `${type} ${player.injuryDays}ว`
}
