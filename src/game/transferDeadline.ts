/**
 * โหมดปิดตลาด — 3 วันสุดท้ายนับเป็นชั่วโมง (72 ชม.)
 * กด Next = +1 ชม. · ตลาดชุกชุม · มีข้อเสนอ/ข่าวถี่ขึ้น
 */
import type { GameSave, InboxMessage, PendingTransferOffer, TransferDeadlineState } from './types'
import { processTransferDeskMatchday } from './transferDesk'
import { processWantAwayAiBids, tickWantAwayDrama } from './wantAway'
import { advanceMediaWeek, pushNews } from './media'
import { maybeAiRomanoPlants } from './romanoPlant'
import { simulateDailyLife } from './dailyLife'
import {
  isTransferWindowOpen,
  transferWindowBounds,
  transferWindowKind,
} from './transferWindow'
import { formatMoney } from '@/lib/format'
import { estimatedValue } from './transfer'
import { nextUnplayedMatchday, simulateMatchday } from './simulate'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clampHour(h: number) {
  return ((h % 24) + 24) % 24
}

function addHoursToDate(isoDate: string, hours: number): string {
  const base = new Date(`${isoDate.slice(0, 10)}T12:00:00Z`)
  if (Number.isNaN(base.getTime())) {
    const d = new Date()
    d.setUTCHours(d.getUTCHours() + hours)
    return d.toISOString().slice(0, 10)
  }
  base.setUTCHours(base.getUTCHours() + hours)
  return base.toISOString().slice(0, 10)
}

export function isTransferDeadlineActive(save: GameSave): boolean {
  return Boolean(save.transferDeadline?.active && (save.transferDeadline.hoursRemaining ?? 0) > 0)
}

/** แมตช์เดย์แรกของโซน 3 วันสุดท้าย = end - 2 */
export function transferDeadlineStartMd(save: GameSave): number | null {
  const b = transferWindowBounds(save)
  if (!b || b.kind === 'offseason') return null
  return Math.max(b.start, b.end - 2)
}

export function shouldEnterTransferDeadline(save: GameSave): boolean {
  if (isTransferDeadlineActive(save)) return false
  const kind = transferWindowKind(save)
  if (kind !== 'summer' && kind !== 'winter') return false
  if (save.transferDeadline?.completedForWindow === kind) return false
  if (!isTransferWindowOpen(save)) return false
  const start = transferDeadlineStartMd(save)
  if (start == null) return false
  const next = nextUnplayedMatchday(save)
  return next === start
}

export function beginTransferDeadline(save: GameSave): GameSave {
  const kind = transferWindowKind(save)
  if (kind !== 'summer' && kind !== 'winter') return save
  const bounds = transferWindowBounds(save)
  if (!bounds) return save
  const startMd = transferDeadlineStartMd(save)
  if (startMd == null) return save

  const deadline: TransferDeadlineState = {
    active: true,
    window: kind,
    hoursRemaining: 72,
    hoursElapsed: 0,
    clockHour: 9,
    startedMatchday: startMd,
    windowEndMatchday: bounds.end,
    completedForWindow: null,
    log: [
      {
        id: uid('tdl'),
        hour: 0,
        title: 'เข้าโหมดปิดตลาด',
        body: `3 วันสุดท้ายของตลาด${kind === 'summer' ? 'ซัมเมอร์' : 'วินเทอร์'} — นับเป็นชั่วโมง (เหลือ 72 ชม.) · ตลาดจะชุกชุม`,
      },
    ],
  }

  const inbox: InboxMessage[] = [
    {
      id: uid('msg-tdl'),
      date: save.currentDate,
      title: '⏰ ปิดตลาดใน 72 ชั่วโมง',
      body: 'กดถัดไป = เดินหน้า 1 ชั่วโมง · เอเยนต์/สโมสรยื่นข้อเสนอถี่ขึ้น · เช็ค Transfers กับ Inbox บ่อยๆ',
      read: false,
    },
    ...save.inbox,
  ].slice(0, 45)

  return { ...save, transferDeadline: deadline, inbox }
}

function deadlineHourEvents(
  save: GameSave,
  hourIndex: number,
): { save: GameSave; notes: string[] } {
  let next = save
  const notes: string[] = []
  const human = next.clubs.find((c) => c.id === next.humanClubId)
  if (!human) return { save: next, notes }

  if (Math.random() < 0.55) next = processWantAwayAiBids(next)
  if (Math.random() < 0.7) {
    next = processTransferDeskMatchday(next, next.lastHumanResult ? [next.lastHumanResult] : [])
  }
  if (hourIndex % 3 === 0) next = tickWantAwayDrama(next)
  if (Math.random() < 0.35) next = maybeAiRomanoPlants(next)
  if (hourIndex % 6 === 5) next = advanceMediaWeek(next)

  const squad = next.players
    .filter((p) => p.clubId === next.humanClubId && p.overall >= 70)
    .sort((a, b) => b.overall - a.overall)
  if (squad.length && Math.random() < 0.42) {
    const target = squad[Math.floor(Math.random() * Math.min(8, squad.length))]!
    const buyers = next.clubs
      .filter(
        (c) =>
          c.controlledBy === 'ai' &&
          c.id !== human.id &&
          c.balance > estimatedValue(target) * 0.6,
      )
      .sort((a, b) => b.reputation - a.reputation)
    if (buyers.length) {
      const buyer = buyers[Math.floor(Math.random() * Math.min(6, buyers.length))]!
      const fee = Math.round(estimatedValue(target) * (0.88 + Math.random() * 0.28))
      const desk = next.transferDesk ?? { offers: [], auctions: [], clauses: [] }
      const offer: PendingTransferOffer = {
        id: uid('offer'),
        kind: 'sell',
        playerId: target.id,
        fromClubId: human.id,
        toClubId: buyer.id,
        fee,
        wage: Math.round(target.wage * 1.05),
        contractYears: 3,
        appearanceAddon: 0,
        sellOnPercent: 0,
        status: 'pending',
        expiresMatchday: next.matchday + 1,
        note: `ปิดตลาด: ${buyer.shortName} ยื่นซื้อ ${target.name} ${formatMoney(fee)}`,
      }
      next = {
        ...next,
        transferDesk: {
          ...desk,
          offers: [offer, ...(desk.offers ?? [])].slice(0, 35),
        },
        inbox: [
          {
            id: uid('msg-bid'),
            date: next.currentDate,
            title: `ข้อเสนอชั่วโมงนี้: ${target.name}`,
            body: `${offer.note} — ไปที่ Transfers เพื่อตอบ`,
            read: false,
          },
          ...next.inbox,
        ].slice(0, 45),
      }
      notes.push(offer.note)
    }
  }

  if (Math.random() < 0.28) {
    const rumors = [
      'เอเยนต์รวมตัวที่ล็อบบี้โรงแรม — มีดีลใหญ่ใกล้จบ',
      'สโมสรใหญ่เปิดเช็คบุ๊กชั่วโมงสุดท้าย',
      'สื่อรายงานว่ารายชื่ออยากย้ายถูกส่งไปหลายทีม',
      'แฟนบอลลุ้นหน้าตลาดจนดึก',
      'บอร์ดคู่แข่งอนุมัติงบฉุกเฉินก่อนปิดตลาด',
    ]
    const body = rumors[Math.floor(Math.random() * rumors.length)]!
    next = pushNews(next, {
      id: uid('news-tdl'),
      channel: Math.random() < 0.4 ? 'romano' : 'news',
      date: next.currentDate,
      headline: 'ตลาดชั่วโมงทอง',
      body,
      tone: 'rumor',
      tags: ['transfer', 'deadline'],
      reliability: 55 + Math.floor(Math.random() * 25),
    })
    notes.push(body)
  }

  return { save: next, notes }
}

export function advanceTransferDeadlineHour(save: GameSave): {
  ok: true
  save: GameSave
  message: string
} | { ok: false; message: string } {
  if (!isTransferDeadlineActive(save)) {
    return { ok: false, message: 'ไม่ได้อยู่ในโหมดปิดตลาด' }
  }
  const td = save.transferDeadline!
  const hoursElapsed = td.hoursElapsed + 1
  const hoursRemaining = Math.max(0, td.hoursRemaining - 1)
  const clockHour = clampHour(td.clockHour + 1)
  const date = addHoursToDate(save.currentDate, 1)

  let next: GameSave = {
    ...save,
    currentDate: date,
    transferDeadline: {
      ...td,
      hoursElapsed,
      hoursRemaining,
      clockHour,
    },
  }

  if (hoursElapsed % 8 === 0) {
    next = simulateDailyLife(next, 1)
  }

  const ev = deadlineHourEvents(next, hoursElapsed)
  next = ev.save

  const logEntry = {
    id: uid('tdl'),
    hour: hoursElapsed,
    title: `ชม. ${String(clockHour).padStart(2, '0')}:00 · เหลือ ${hoursRemaining} ชม.`,
    body: ev.notes.length ? ev.notes.slice(0, 2).join(' · ') : 'เงียบเป็นช่วง ๆ — เอเยนต์ยังไม่ขยับ',
  }
  next = {
    ...next,
    transferDeadline: {
      ...next.transferDeadline!,
      log: [logEntry, ...(next.transferDeadline!.log ?? [])].slice(0, 40),
    },
  }

  if (hoursRemaining <= 0) {
    const ended = finishTransferDeadline(next)
    return { ok: true, save: ended.save, message: ended.message }
  }

  return {
    ok: true,
    save: next,
    message: `+1 ชม. · นาฬิกาตลาด ${String(clockHour).padStart(2, '0')}:00 · เหลือ ${hoursRemaining} ชม.${
      ev.notes[0] ? ` · ${ev.notes[0]}` : ''
    }`,
  }
}

/** จบ 72 ชม. → จำลองแมตช์เดย์ในโซน deadline แล้วปิดตลาด */
export function finishTransferDeadline(save: GameSave): { save: GameSave; message: string } {
  const td = save.transferDeadline
  if (!td) return { save, message: 'ไม่มีโหมดปิดตลาด' }

  // ปิดโหมดก่อนจำลองนัด — กันวนเข้า deadline ซ้ำ
  let next: GameSave = {
    ...save,
    transferDeadline: {
      ...td,
      active: false,
      hoursRemaining: 0,
      completedForWindow: td.window,
    },
  }

  const start = td.startedMatchday
  const end = td.windowEndMatchday
  const notes: string[] = []

  for (let md = start; md <= end; md++) {
    const needs = next.fixtures.some((f) => f.matchday === md && !f.played)
    if (!needs && next.matchday >= md) continue
    const r = simulateMatchday(next, md)
    next = r.save
    notes.push(`MD${md}`)
  }

  next = {
    ...next,
    transferDeadline: {
      ...next.transferDeadline!,
      active: false,
      hoursRemaining: 0,
      completedForWindow: td.window,
      log: [
        {
          id: uid('tdl-end'),
          hour: 72,
          title: 'ปิดตลาดแล้ว',
          body: `ครบ 72 ชั่วโมง · ตลาด${td.window === 'summer' ? 'ซัมเมอร์' : 'วินเทอร์'}ปิด · จำลองนัด ${notes.join(', ') || '—'}`,
        },
        ...(td.log ?? []),
      ].slice(0, 40),
    },
    inbox: [
      {
        id: uid('msg-tdl-end'),
        date: next.currentDate,
        title: 'ตลาดปิดแล้ว',
        body: 'หน้าต่างโอนย้ายสิ้นสุด — ซื้อ/ขาย/ยืมได้ใหม่เมื่อเปิดหน้าต่างถัดไป',
        read: false,
      },
      ...next.inbox,
    ].slice(0, 45),
  }

  return {
    save: next,
    message: `ปิดตลาดแล้ว (ครบ 72 ชม.) · จำลอง ${notes.join(' · ') || 'นัดในโซนปิดตลาด'}`,
  }
}

export function transferDeadlineLabel(save: GameSave): string | null {
  const td = save.transferDeadline
  if (!td?.active) return null
  const hh = String(td.clockHour).padStart(2, '0')
  return `ปิดตลาด · ${hh}:00 · เหลือ ${td.hoursRemaining} ชม.`
}
