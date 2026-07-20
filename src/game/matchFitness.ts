import type { BodyMap, BodyPartId, MatchEvent, MatchSpatialFrame, Player } from './types'
import { ensureBodyMap } from './bodyMap'
import { effectiveCondition } from './match/matchFatigue'

export interface MatchPlayerFitness {
  condition: number
  matchStamina: number
  heartRate: number
  /** รวม condition + stamina สำหรับแสดงหลอดหลัก */
  effective: number
}

const LEG_PARTS: BodyPartId[] = [
  'thighL',
  'thighR',
  'calfL',
  'calfR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
  'footL',
  'footR',
]

export function staminaBarTone(value: number): 'fresh' | 'tired' | 'exhausted' {
  if (value >= 72) return 'fresh'
  if (value >= 48) return 'tired'
  return 'exhausted'
}

export function staminaBarColor(value: number): string {
  const tone = staminaBarTone(value)
  if (tone === 'fresh') return 'bg-emerald-500'
  if (tone === 'tired') return 'bg-amber-500'
  return 'bg-rose-500'
}

export function staminaLabelTh(value: number): string {
  const tone = staminaBarTone(value)
  if (tone === 'fresh') return 'สด'
  if (tone === 'tired') return 'เริ่มเหนื่อย'
  return 'หมดแรง'
}

export function fitnessFromSpatial(
  spatial: MatchSpatialFrame | null | undefined,
  playerId: string,
  player: Player,
  minute = 0,
  onPitch = true,
): MatchPlayerFitness {
  /** ม้านั่ง / ยังไม่ลง — ไม่เสีย stamina */
  if (!onPitch) {
    const rest = Math.round(player.condition)
    return {
      condition: rest,
      matchStamina: rest,
      heartRate: 36,
      effective: rest,
    }
  }

  const snap = spatial?.players.find((p) => p.id === playerId)
  if (snap?.condition != null) {
    const burst = {
      heartRate: snap.heartRate ?? 40,
      burstTicks: 0,
      matchStamina: snap.matchStamina ?? snap.condition,
    }
    return {
      condition: snap.condition,
      matchStamina: snap.matchStamina ?? snap.condition,
      heartRate: snap.heartRate ?? 40,
      effective: Math.round(effectiveCondition(snap.condition, burst)),
    }
  }

  /** บนสนามแต่ไม่มี snapshot — ใช้ค่าเริ่ม (ไม่หักตามนาทีแบบเท่ากันทุกคน) */
  const base = Math.round(player.condition)
  return {
    condition: base,
    matchStamina: base,
    heartRate: 42,
    effective: base,
  }
}

export function activityLabelTh(load?: number): string {
  if (load == null) return '—'
  if (load >= 78) return 'วิ่งหนักมาก'
  if (load >= 58) return 'วิ่งเยอะ'
  if (load >= 38) return 'ปานกลาง'
  if (load >= 18) return 'เบา'
  return 'นิ่ง'
}

/** แผนที่ร่างกายสด — สะท้อน fatigue ในแมตช์ + จุดบาดเจ็บ */
export function liveMatchBodyMap(
  player: Player,
  fitness: MatchPlayerFitness,
  injuryPart?: BodyPartId | null,
): BodyMap {
  const map = { ...ensureBodyMap(player) }
  const fatigue = 100 - fitness.effective
  const legMul =
    player.position === 'FW' ? 1.15 : player.position === 'MF' ? 1.05 : 0.88
  const legWear = Math.min(38, fatigue * 0.5 * legMul)
  const backWear =
    fitness.heartRate > 78 ? Math.min(22, (fitness.heartRate - 78) * 1.1) : 0

  for (const part of LEG_PARTS) {
    map[part] = Math.max(5, Math.round(map[part] - legWear))
  }
  if (backWear > 0) {
    map.back = Math.max(5, Math.round(map.back - backWear))
    map.groin = Math.max(5, Math.round(map.groin - backWear * 0.45))
  }
  if (injuryPart) {
    map[injuryPart] = Math.min(map[injuryPart], 12 + Math.floor(fatigue * 0.08))
  }
  return map
}

export interface MatchSquadStatus {
  sentOff: Set<string>
  injuredParts: Map<string, BodyPartId>
  onPitch: Set<string>
}

export function squadStatusFromEvents(
  events: MatchEvent[],
  upToIndex: number,
  spatial: MatchSpatialFrame | null | undefined,
  fallbackHomeXi: string[],
  fallbackAwayXi: string[],
): MatchSquadStatus {
  const sentOff = new Set<string>()
  const injuredParts = new Map<string, BodyPartId>()

  for (let i = 0; i <= upToIndex; i++) {
    const e = events[i]
    if (!e) continue
    if (e.kind === 'card' && e.cardColor === 'red' && e.playerId) {
      sentOff.add(e.playerId)
    }
    if (e.stoppageKind === 'injury' && e.playerId) {
      injuredParts.set(e.playerId, e.injuryBodyPart ?? 'groin')
    }
  }

  const onPitch = new Set<string>()
  if (spatial?.players.length) {
    for (const p of spatial.players) onPitch.add(p.id)
  } else {
    for (const id of fallbackHomeXi) if (!sentOff.has(id)) onPitch.add(id)
    for (const id of fallbackAwayXi) if (!sentOff.has(id)) onPitch.add(id)
  }

  return { sentOff, injuredParts, onPitch }
}

export function playerForBodyDisplay(
  player: Player,
  fitness: MatchPlayerFitness,
  injuryPart?: BodyPartId | null,
): Player {
  const bodyMap = liveMatchBodyMap(player, fitness, injuryPart)
  return {
    ...player,
    bodyMap,
    injuryBodyPart: injuryPart ?? player.injuryBodyPart,
  }
}

export function heartRateLabelTh(hr: number): string {
  if (hr >= 88) return 'Burst Zone — เสี่ยงกล้ามเนื้อ'
  if (hr >= 72) return 'วิ่งหนัก'
  return 'ปกติ'
}
