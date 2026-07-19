import type { GameSave } from './types'

/** หน้าต่างตลาด: ซัมเมอร์ต้นฤดูกาล + วินเทอร์กลางฤดูกาล + ออฟซีซัน */
export function isTransferWindowOpen(save: GameSave): boolean {
  if (save.seasonComplete) return true
  const md = save.matchday
  if (md <= 6) return true
  if (md >= 19 && md <= 23) return true
  return false
}

export function transferWindowLabel(save: GameSave): string {
  if (save.seasonComplete) return 'ออฟซีซัน — ตลาดเปิด'
  const md = save.matchday
  if (md <= 6) return `ตลาดซัมเมอร์ (ถึง MD6) · ตอนนี้ MD${md || 0}`
  if (md >= 19 && md <= 23) return `ตลาดวินเทอร์ MD19–23 · ตอนนี้ MD${md}`
  if (md < 19) return `ตลาดปิด · วินเทอร์เปิด MD19 (อีก ${19 - md} MD)`
  return 'ตลาดปิด · รอออฟซีซัน / ซัมเมอร์ฤดูกาลหน้า'
}

export function transferWindowKind(
  save: GameSave,
): 'summer' | 'winter' | 'offseason' | 'closed' {
  if (save.seasonComplete) return 'offseason'
  const md = save.matchday
  if (md <= 6) return 'summer'
  if (md >= 19 && md <= 23) return 'winter'
  return 'closed'
}
