/**
 * Dynamic Crowd Support & Home Advantage — Crowd Pressure Modifiers
 * Attendance × Fan Passion → จิตวิทยาในสนาม
 */
export interface CrowdInputs {
  /** จำนวนผู้ชมโดยประมาณ */
  attendance: number
  stadiumCapacity: number
  /** 0–100 ความดุดันแฟน (ultras/mood) */
  passion: number
}

export interface CrowdPressure {
  /** 0–1 ความกดดันรวม */
  intensity: number
  /** คูณ composure ฝั่งเยือนเมื่อครองแดนตัวเอง / เตะมุม */
  awayNerve: number
  /** สัดส่วนตัวเลือกพาสที่ยัง “มองเห็น” (หด Perception Radar) */
  awayPassRadar: number
  /** โบนัสฟื้น burst stamina เจ้าบ้านช่วงท้ายเมื่อตามหลัง */
  homeLateRegen: number
  noteTh: string
}

/** ประมาณผู้ชมก่อนแมตช์ (ยังไม่มีสกอร์) */
export function estimateAttendance(
  capacity: number,
  clubRep: number,
  fanTicketMult = 1,
): number {
  const fill = 0.55 + Math.min(0.35, clubRep / 200)
  return Math.round(capacity * fill * fanTicketMult)
}

export function computeCrowdPressure(input: CrowdInputs): CrowdPressure {
  const fill = input.stadiumCapacity > 0 ? input.attendance / input.stadiumCapacity : 0.6
  const passion = Math.max(0, Math.min(100, input.passion)) / 100
  const intensity = Math.max(0.15, Math.min(1, fill * 0.55 + passion * 0.45))
  const awayNerve = 1 - intensity * 0.22
  const awayPassRadar = Math.max(0.35, 1 - intensity * 0.4)
  const homeLateRegen = 4 + intensity * 8
  const noteTh =
    intensity >= 0.75
      ? 'เสียงเชียร์ถล่มสนาม · กดดันทีมเยือนหนัก'
      : intensity >= 0.5
        ? 'บรรยากาศเหย้าคึกคัก'
        : 'ผู้ชมเงียบกว่าปกติ'
  return { intensity, awayNerve, awayPassRadar, homeLateRegen, noteTh }
}

/** ครองแดนตัวเองฝั่งเยือน / ใกล้มุม = โดนกดดัน */
export function isCrowdPressureSpot(
  team: 'home' | 'away',
  ballY: number,
  spotKind?: 'corner' | 'open',
): boolean {
  if (team === 'home') return false
  if (spotKind === 'corner') return true
  // เยือนครองแดนตัวเอง (Y สูง = ใกล้ประตูเยือนเมื่อ home บุกขึ้น)
  return ballY >= 55
}
