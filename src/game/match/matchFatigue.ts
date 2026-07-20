/**
 * Dynamic Fatigue — Match Stamina + Heart Rate / Burst Zone
 * เมื่อ Burst Zone นาน → สุ่ม Soft-Tissue (กล้ามเนื้อ)
 */
import type { Pressing, RoleCode, Tempo } from '../types'

export interface BurstState {
  /** 0–100 ความเข้มข้นสะสมจากสปริ้นท์ */
  heartRate: number
  /** จำนวน tick ติดต่อกันที่อยู่ใน burst */
  burstTicks: number
  /** พลังงานแมตช์แยกจาก condition (ลดตามแผน) */
  matchStamina: number
}

export function createBurstState(condition: number): BurstState {
  return {
    heartRate: 40,
    burstTicks: 0,
    matchStamina: Math.max(40, Math.min(100, condition)),
  }
}

function pressDrain(pressing: Pressing): number {
  if (pressing === 'high') return 2.0
  if (pressing === 'low') return 0.7
  return 1.0
}

function tempoDrain(tempo: Tempo | undefined): number {
  if (tempo === 'fast') return 1.35
  if (tempo === 'slow') return 0.75
  return 1
}

export function tickMatchFatigue(
  state: BurstState,
  opts: {
    pressing: Pressing
    tempo?: Tempo
    /** สปริ้นท์/ดริเบิล/เพรสในจังหวะนี้ */
    sprinting: boolean
    /** 0.1–1.65 — ความหนักตามการวิ่ง/บทบาท/งานจริง */
    activityLoad?: number
    /** สภาพอากาศ injury mult */
    weatherInjury?: number
  },
): BurstState {
  const load = Math.max(0.08, Math.min(1.65, opts.activityLoad ?? 1))
  const base = 0.22 * pressDrain(opts.pressing) * tempoDrain(opts.tempo) * load
  const sprintExtra = (opts.sprinting ? 1.8 : 0.4) * load
  let heartRate = state.heartRate + sprintExtra * pressDrain(opts.pressing)
  let burstTicks = state.burstTicks
  if (heartRate >= 78) {
    burstTicks += 1
  } else {
    burstTicks = Math.max(0, burstTicks - 1)
    heartRate = Math.max(35, heartRate - 2.2 * (1.1 - load * 0.35))
  }
  heartRate = Math.min(100, heartRate)
  const matchStamina = Math.max(
    28,
    state.matchStamina - base * (opts.sprinting ? 1.6 : 1) * (opts.weatherInjury ?? 1),
  )
  return { heartRate, burstTicks, matchStamina }
}

/** คำนวณความหนักต่อจังหวะ — แยกตามตำแหน่ง · วิ่ง · ครองบอล · เพรส */
export function computeAgentFatigueLoad(opts: {
  role: RoleCode
  workRate: number
  stamina: number
  /** ระยะวิ่งสะสมในจังหวะนี้ (grid units) */
  tickMove: number
  isCarrier: boolean
  actionKind: 'pass' | 'dribble' | 'shoot' | 'idle'
  teamHasBall: boolean
  pressing: Pressing
  tempo?: Tempo
  ballDist: number
}): { load: number; sprinting: boolean } {
  let load = 0.3
  if (opts.role === 'GK') load = 0.1
  else if (opts.role === 'CB') load = 0.36
  else if (opts.role === 'FB' || opts.role === 'WB') load = 0.5
  else if (opts.role === 'DM') load = 0.54
  else if (opts.role === 'CM') load = 0.58
  else if (opts.role === 'AM') load = 0.66
  else if (opts.role === 'LW' || opts.role === 'RW') load = 0.74
  else if (opts.role === 'ST' || opts.role === 'SS') load = 0.7

  load *= 0.72 + (opts.workRate / 99) * 0.48
  load *= 1.08 - (opts.stamina / 99) * 0.22
  load += Math.min(0.58, opts.tickMove / 13)

  if (opts.isCarrier) {
    load += opts.actionKind === 'dribble' ? 0.42 : opts.actionKind === 'shoot' ? 0.28 : 0.16
  }

  if (!opts.teamHasBall) {
    if (opts.pressing === 'high' && opts.ballDist < 28) load += 0.38
    else if (opts.pressing === 'medium' && opts.ballDist < 20) load += 0.2
    else if (opts.ballDist < 12) load += 0.12
  } else if (opts.tempo === 'fast') {
    load += 0.14
  }

  const sprinting =
    load >= 0.85 ||
    (opts.isCarrier && opts.actionKind === 'dribble') ||
    opts.tickMove > 11

  return { load: Math.min(1.65, Math.max(0.08, load)), sprinting }
}

/** รวมกับ condition แสดงผลในจังหวะแอ็กชัน */
export function effectiveCondition(condition: number, state: BurstState): number {
  return Math.max(35, Math.min(100, condition * 0.55 + state.matchStamina * 0.45))
}

/**
 * Soft-tissue check เมื่ออยู่ใน Burst Zone นาน
 * คืน true ถ้าบาดเจ็บ
 */
export function rollBurstInjury(
  rng: () => number,
  state: BurstState,
  injuryProneness: number,
  weatherInjury = 1,
): boolean {
  if (state.burstTicks < 3 && state.heartRate < 88) return false
  const intensity = Math.max(0, state.burstTicks - 2) * 0.012 + (state.heartRate - 80) / 400
  const p =
    Math.max(0, intensity) * (0.55 + injuryProneness / 120) * weatherInjury * 0.55
  return rng() < Math.min(0.18, p)
}
