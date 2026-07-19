/**
 * Ball Physics & Pitch Surface Friction — จากสภาพอากาศ
 */
import type { MatchWeather } from '../types'

export interface PitchPhysics {
  /** แรงเสียดทาน — สูง = บอลกลิ้งช้า / พาสสั้น */
  friction: number
  /** การเด้ง — สูง = ควบคุมยาก */
  bounce: number
  /** คูณระยะพาสที่มีผล (1 = ปกติ) */
  passRange: number
  /** คูณ first touch / รับบอล (ต่ำ = รับหลุดง่าย) */
  firstTouch: number
  /** คำอธิบายสั้น */
  noteTh: string
}

export function pitchPhysicsFromWeather(weather: MatchWeather): PitchPhysics {
  switch (weather) {
    case 'rain':
      return {
        friction: 1.35,
        bounce: 0.85,
        passRange: 0.78,
        firstTouch: 0.88,
        noteTh: 'สนามแฉะ · บอลกลิ้งช้า พาสสั้นเสี่ยงถูกตัด',
      }
    case 'cold':
      return {
        friction: 0.82,
        bounce: 1.15,
        passRange: 1.08,
        firstTouch: 0.85,
        noteTh: 'พื้นลื่น · บอลพุ่งไว รับบอลแรกยาก',
      }
    case 'wind':
      return {
        friction: 0.95,
        bounce: 1.05,
        passRange: 0.9,
        firstTouch: 0.92,
        noteTh: 'ลมแรง · ทิศทางลูกไม่นิ่ง',
      }
    case 'hot':
      return {
        friction: 1.08,
        bounce: 0.95,
        passRange: 0.94,
        firstTouch: 0.96,
        noteTh: 'ร้อนจัด · พื้นแห้ง เหนื่อยเร็ว',
      }
    case 'clear':
    default:
      return {
        friction: 1,
        bounce: 1,
        passRange: 1,
        firstTouch: 1,
        noteTh: 'สนามปกติ',
      }
  }
}

/** ระยะพาสเกินช่วงที่มีผลบนพื้นนี้หรือไม่ */
export function passTooLongForPitch(dist: number, physics: PitchPhysics): boolean {
  const maxEffective = 38 * physics.passRange
  return dist > maxEffective
}

/** โอกาสรับบอลแรกพลาดหลังพาสสำเร็จ */
export function firstTouchFailChance(physics: PitchPhysics, technique: number): number {
  const tech = technique / 99
  return Math.max(0, (1 - physics.firstTouch) * 0.55 + (1 - tech) * 0.08)
}
