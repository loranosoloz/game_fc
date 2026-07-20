/**
 * ทดเวลา (stoppage / injury time)
 * สะสมเป็นเศษนาทีจากเหตุการณ์ → จบครึ่งปัดขึ้นด้วย Math.ceil
 * ตัวอย่าง: สะสม 1.10 → ทดเวลา 2 นาที
 */
export const STOPPAGE = {
  foul: 0.4,
  yellow: 0.35,
  red: 0.85,
  varCheck: 0.7,
  goal: 0.5,
  penalty: 0.6,
  /** ลูกออก / ตัดพาส · เสียครอง */
  ballOut: 0.15,
  tackleWin: 0.06,
  mistackle: 0.08,
  save: 0.1,
  shot: 0.05,
  offside: 0.25,
  timeWaste: 0.35,
  argue: 0.2,
} as const

/** ปัดขึ้นเสมอ — แม้ 0.01 ก็ได้ 1 นาที · 1.10 ได้ 2 */
export function ceilStoppageMinutes(accumulated: number): number {
  if (accumulated <= 0) return 0
  return Math.ceil(accumulated)
}

export function stoppageAnnounceTh(added: number, raw: number): string {
  return `ทดเวลา ${added} นาที (สะสม ${raw.toFixed(2)} นาที → ปัดขึ้น)`
}
