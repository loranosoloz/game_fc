import type { GameSave } from './types'
import { winterWindowRange } from '@/data/world/leagueSize'

export type TransferWindowKind = 'summer' | 'winter' | 'offseason' | 'closed'

export type TransferWindowBounds = {
  kind: 'summer' | 'winter' | 'offseason'
  start: number
  end: number
  /** ความยาวหน้าต่าง (แมตช์เดย์) */
  lengthMd: number
}

/** หน้าต่างตลาด: ซัมเมอร์ต้นฤดูกาล + วินเทอร์กลางฤดูกาล + ออฟซีซัน */
export function isTransferWindowOpen(save: GameSave): boolean {
  if (save.transferDeadline?.active) return true
  if (save.seasonComplete) return true
  const md = save.matchday
  if (md <= 6) return true
  const winter = winterWindowRange(save.leagueId || 'eng')
  if (md >= winter.start && md <= winter.end) return true
  return false
}

export function transferWindowBounds(save: GameSave): TransferWindowBounds | null {
  if (save.seasonComplete) {
    return { kind: 'offseason', start: 0, end: 99, lengthMd: 99 }
  }
  const md = save.matchday
  const winter = winterWindowRange(save.leagueId || 'eng')
  // ระหว่างซัมเมอร์ หรือยังไม่จบซัมเมอร์
  if (md <= 6 || (save.transferDeadline?.active && save.transferDeadline.window === 'summer')) {
    return { kind: 'summer', start: 0, end: 6, lengthMd: 7 }
  }
  if (
    (md >= winter.start && md <= winter.end) ||
    (save.transferDeadline?.active && save.transferDeadline.window === 'winter')
  ) {
    return {
      kind: 'winter',
      start: winter.start,
      end: winter.end,
      lengthMd: winter.end - winter.start + 1,
    }
  }
  return null
}

export function transferWindowLabel(save: GameSave): string {
  if (save.transferDeadline?.active) {
    const td = save.transferDeadline
    const hh = String(td.clockHour).padStart(2, '0')
    return `ปิดตลาด (${td.window === 'summer' ? 'ซัมเมอร์' : 'วินเทอร์'}) · ${hh}:00 · เหลือ ${td.hoursRemaining} ชม. จาก 72`
  }
  if (save.seasonComplete) return 'ออฟซีซัน — ตลาดเปิด'
  const md = save.matchday
  const winter = winterWindowRange(save.leagueId || 'eng')
  if (md <= 6) {
    const left = 6 - md
    const deadlineSoon = left <= 2
    return `ตลาดซัมเมอร์ MD0–6 · ตอนนี้ MD${md || 0} · เหลือ ~${left} MD${
      deadlineSoon ? ' · ใกล้ปิด (จะเข้าโหมดชั่วโมง)' : ''
    }`
  }
  if (md >= winter.start && md <= winter.end) {
    const left = winter.end - md
    return `ตลาดวินเทอร์ MD${winter.start}–${winter.end} (${winter.end - winter.start + 1} MD) · ตอนนี้ MD${md} · เหลือ ~${left} MD${
      left <= 2 ? ' · ใกล้ปิด (จะเข้าโหมดชั่วโมง)' : ''
    }`
  }
  if (md < winter.start) {
    return `ตลาดปิด · วินเทอร์เปิด MD${winter.start}–${winter.end} (อีก ${winter.start - md} MD)`
  }
  return 'ตลาดปิด · รอออฟซีซัน / ซัมเมอร์ฤดูกาลหน้า'
}

export function transferWindowKind(save: GameSave): TransferWindowKind {
  if (save.transferDeadline?.active) {
    return save.transferDeadline.window
  }
  if (save.seasonComplete) return 'offseason'
  const md = save.matchday
  if (md <= 6) return 'summer'
  const winter = winterWindowRange(save.leagueId || 'eng')
  if (md >= winter.start && md <= winter.end) return 'winter'
  return 'closed'
}

/** เหลือกี่แมตช์เดย์ก่อนปิดหน้าต่างปัจจุบัน */
export function matchdaysLeftInWindow(save: GameSave): number | null {
  const b = transferWindowBounds(save)
  if (!b || b.kind === 'offseason') return null
  return Math.max(0, b.end - save.matchday)
}
