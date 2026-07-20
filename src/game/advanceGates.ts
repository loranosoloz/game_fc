/**
 * เงื่อนไขก่อนเดินเวลา / พักร้อน — เหตุการณ์บังคับต้องเคลียร์ก่อน
 */
import type { GameSave } from './types'
import { isPreSeasonBlocking } from './preSeason'
import { pendingTalkRequests } from './playerTalks'
import { hasPendingInternationalBreak } from './internationalBreaks'

export type AdvanceBlocker = {
  id: string
  message: string
  /** เส้นทางแนะนำให้ไปแก้ */
  href?: string
}

export function getDayAdvanceBlockers(save: GameSave): AdvanceBlocker[] {
  const blockers: AdvanceBlocker[] = []

  if (save.seasonComplete) {
    blockers.push({
      id: 'season_complete',
      message: 'จบฤดูกาลแล้ว — กดเริ่มฤดูกาลใหม่ก่อน',
      href: '/match',
    })
    return blockers
  }

  if (save.board?.sacked || (save.career?.unemployed && !save.career?.nationalNation)) {
    blockers.push({
      id: 'unemployed',
      message: 'ว่างงาน — ไปตลาดงานก่อนเดินเวลาคลับ',
      href: '/club-vision',
    })
  }

  const ps = save.preSeason
  if (isPreSeasonBlocking(save)) {
    if (ps?.phase === 'choosing') {
      blockers.push({
        id: 'preseason_choose',
        message: 'ต้องเลือกทัวร์ปรีซีซั่นหรือข้ามทัวร์ก่อนเดินวัน',
        href: '/preseason',
      })
    } else {
      blockers.push({
        id: 'preseason_active',
        message: 'ช่วงทัวร์ปรีซีซั่น — ไปหน้าปรีซีซั่นเล่นนัดอุ่นให้จบก่อน',
        href: '/preseason',
      })
    }
  }

  if (save.pressConference?.pending) {
    blockers.push({
      id: 'press',
      message: 'มีแถลงข่าวค้าง — ตอบที่พอร์ทัลก่อนเดินวัน',
      href: '/portal',
    })
  }

  if (save.playerInterview?.pending) {
    blockers.push({
      id: 'interview',
      message: 'มีสัมภาษณ์นักเตะค้าง — ตอบที่พอร์ทัลก่อนเดินวัน',
      href: '/portal',
    })
  }

  const talks = pendingTalkRequests(save)
  if (talks.length > 0) {
    blockers.push({
      id: 'talks',
      message: `นักเตะเรียกคุย ${talks.length} คน — ตอบที่หน้าประชุมก่อน`,
      href: '/meetings',
    })
  }

  if (
    hasPendingInternationalBreak(save) &&
    save.career?.nationalNation &&
    save.ntCamp &&
    !save.ntCamp.confirmed
  ) {
    blockers.push({
      id: 'nt_camp',
      message: 'ยืนยันโผแคมป์ทีมชาติที่พอร์ทัลก่อนเดินหน้า',
      href: '/portal',
    })
  }

  if (save.lastMatchdayReport && save.lastMatchdayReport.lines.length > 0) {
    blockers.push({
      id: 'day_report',
      message: 'มีสรุปรายวันค้าง — ปิดที่พอร์ทัลก่อนเดินวันถัดไป',
      href: '/portal',
    })
  }

  return blockers
}

export function canAdvanceDay(save: GameSave): boolean {
  return getDayAdvanceBlockers(save).length === 0
}

export function dayAdvanceBlockMessage(save: GameSave): string | null {
  const blockers = getDayAdvanceBlockers(save)
  if (blockers.length === 0) return null
  return blockers.map((b) => b.message).join(' · ')
}
