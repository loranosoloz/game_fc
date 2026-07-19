/**
 * Dynamic Fatigue — Match Stamina + Heart Rate / Burst Zone
 * เมื่อ Burst Zone นาน → สุ่ม Soft-Tissue (กล้ามเนื้อ)
 */
import type { Pressing, Tempo } from '../types'

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
    /** สภาพอากาศ injury mult */
    weatherInjury?: number
  },
): BurstState {
  const base = 0.22 * pressDrain(opts.pressing) * tempoDrain(opts.tempo)
  const sprintExtra = opts.sprinting ? 1.8 : 0.4
  let heartRate = state.heartRate + sprintExtra * pressDrain(opts.pressing)
  let burstTicks = state.burstTicks
  if (heartRate >= 78) {
    burstTicks += 1
  } else {
    burstTicks = Math.max(0, burstTicks - 1)
    heartRate = Math.max(35, heartRate - 2.2)
  }
  heartRate = Math.min(100, heartRate)
  const matchStamina = Math.max(
    28,
    state.matchStamina - base * (opts.sprinting ? 1.6 : 1) * (opts.weatherInjury ?? 1),
  )
  return { heartRate, burstTicks, matchStamina }
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
