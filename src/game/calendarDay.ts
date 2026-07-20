/**
 * เดินเวลาทีละ 1 วันปฏิทิน — มีเหตุการณ์แม้ไม่มีแมตช์
 * (ลีก/ถ้วยเตะคนละวัน · วันว่างก็ต้องมีชีวิตโลก)
 */
import type { GameSave, InboxMessage } from './types'
import { simulateDailyLife } from './dailyLife'
import { tickPlayerInjury } from './medical'
import { tickIllness } from './illness'
import { staffLevel } from './staff'
import { medicalFacilityBonus } from './facilities'
import type { MatchdayReport, MatchdayReportLine } from './matchdayReport'
import { ensureInsolvency } from './insolvency'
import { tickWorldPulse } from './worldPulse'
import { formatMoney } from '@/lib/format'
import { tickSquadRegistration } from './squadRegistration'

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function weekdayUtc(iso: string) {
  return new Date(`${iso}T12:00:00Z`).getUTCDay() // 0=Sun
}

function recoverOneDay(save: GameSave): GameSave {
  const physio = staffLevel(save.staff, 'physio') + medicalFacilityBonus(save)
  const players = save.players.map((p) => {
    let next = tickPlayerInjury(p, physio)
    next = tickIllness(next, physio)
    const leave = next.leaveDays ?? 0
    if (leave > 0) next = { ...next, leaveDays: Math.max(0, leave - 1) }
    return next
  })
  return { ...save, players }
}

function fixturesOnDate(save: GameSave, date: string) {
  return save.fixtures.filter((f) => !f.played && f.date === date)
}

function buildEmptyDayLines(save: GameSave, prev: GameSave, date: string): MatchdayReportLine[] {
  const lines: MatchdayReportLine[] = []
  const todays = fixturesOnDate(save, date)
  const humanToday = todays.filter(
    (f) => f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId,
  )

  if (todays.length === 0) {
    lines.push({
      kind: 'calendar',
      text: `วันว่างตามปฏิทิน (${date}) — ไม่มีนัดในวันนี้ แต่โลกยังเดิน`,
    })
  } else {
    lines.push({
      kind: 'calendar',
      text: `วันนี้มี ${todays.length} นัดในตาราง (คุณ ${humanToday.length} · อื่น ${todays.length - humanToday.length}) · วันที่ลีก/ถ้วยไม่ตรงกันได้`,
    })
    if (humanToday.length > 0) {
      lines.push({
        kind: 'match',
        text: `มีนัดของคุณวันนี้ — กด「เล่นแมตช์เดย์」เมื่อพร้อมแข่ง`,
      })
    }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)
  const prevHuman = prev.clubs.find((c) => c.id === save.humanClubId)
  if (human && prevHuman && human.balance !== prevHuman.balance) {
    const d = human.balance - prevHuman.balance
    lines.push({
      kind: 'finance',
      text: `งบ ${d > 0 ? '+' : ''}${formatMoney(d)} → ${formatMoney(human.balance)}`,
    })
  }

  if (save.fans?.lastEvent && save.fans.lastEvent !== prev.fans?.lastEvent) {
    lines.push({ kind: 'fans', text: save.fans.lastEvent })
  }

  const inv = ensureInsolvency(save)
  const prevInv = ensureInsolvency(prev)
  if (inv.lastNote && inv.lastNote !== prevInv.lastNote) {
    lines.push({ kind: 'insolency', text: inv.lastNote })
  }

  const newInbox = save.inbox.filter((m) => !prev.inbox.some((p) => p.id === m.id)).slice(0, 5)
  for (const m of newInbox) {
    lines.push({ kind: 'media', text: m.title })
  }

  const healed = save.players.filter((p) => {
    if (p.clubId !== save.humanClubId) return false
    const old = prev.players.find((x) => x.id === p.id)
    return old && old.injuryDays > 0 && p.injuryDays === 0
  })
  if (healed.length) {
    lines.push({
      kind: 'medical',
      text: `หายเจ็บ: ${healed.map((p) => p.name).slice(0, 4).join(', ')}`,
    })
  }

  return lines
}

/** สุ่มเหตุการณ์เบาๆ ในวันว่าง (ไม่ทับแมตช์เดย์ใหญ่) */
function rollRestDayWorldEvents(save: GameSave): GameSave {
  const rng = Math.random()
  let inbox: InboxMessage[] = [...save.inbox]
  let fans = save.fans
  let owner = save.owner

  if (rng < 0.12 && fans) {
    const notes = [
      'สื่อท้องถิ่นคุยเรื่องฟอร์มล่าสุด',
      'แฟนบนโซเชียลถกแผนการตลาด',
      'ข่าวลือเล็กน้อยเรื่องสตาฟหลังบ้าน',
      'บรรยากาศซ้อมถูกมองในแง่บวก',
    ]
    const note = notes[Math.floor(Math.random() * notes.length)]!
    fans = { ...fans, lastEvent: note, mood: Math.min(100, fans.mood + (Math.random() < 0.5 ? 1 : 0)) }
    inbox = [
      {
        id: `msg-day-${Date.now()}`,
        date: save.currentDate,
        title: 'ข่าววันว่าง',
        body: note,
        read: false,
      },
      ...inbox,
    ]
  }

  if (rng > 0.88 && owner && ensureInsolvency(save).stage === 'ok') {
    owner = {
      ...owner,
      takeoverHeat: Math.max(0, (owner.takeoverHeat ?? 0) - 1),
    }
  }

  return {
    ...save,
    fans: fans ?? save.fans,
    owner: owner ?? save.owner,
    inbox: inbox.slice(0, 45),
  }
}

export type AdvanceDayResult = {
  save: GameSave
  message: string
  /** มีนัดของคุณในวันนี้ — ควรไปแข่ง */
  humanMatchToday: boolean
  fixturesToday: number
}

/**
 * เดินไปข้างหน้า 1 วันปฏิทิน
 * — มีเหตุการณ์แม้ไม่มีแมตช์
 * — นัดแข่งยังเล่นผ่าน playNextMatchday / ไลฟ์ ตามเดิม
 */
export function advanceCalendarDay(save: GameSave): AdvanceDayResult {
  if (save.seasonComplete) {
    return {
      save,
      message: 'จบฤดูกาลแล้ว — เริ่มฤดูกาลใหม่ก่อน',
      humanMatchToday: false,
      fixturesToday: 0,
    }
  }

  const prev = save
  const newDate = addDays(save.currentDate, 1)
  let next: GameSave = { ...save, currentDate: newDate }

  next = recoverOneDay(next)
  next = simulateDailyLife(next, 1)
  next = rollRestDayWorldEvents(next)

  // จันทร์ = ใกล้ค่าเหนื่อยรายสัปดาห์เล็กน้อย (เต็มรอบยังอยู่ที่แมตช์เดย์)
  if (weekdayUtc(newDate) === 1) {
    next = tickWorldPulse(next)
  }

  const todays = fixturesOnDate(next, newDate)
  const humanMatchToday = todays.some(
    (f) => f.homeClubId === next.humanClubId || f.awayClubId === next.humanClubId,
  )

  const dayLines = buildEmptyDayLines(next, prev, newDate)
  const dayReport: MatchdayReport = {
    matchday: next.matchday,
    season: next.season,
    date: newDate,
    resultsCount: 0,
    lines: dayLines.slice(0, 24),
    createdAt: new Date().toISOString(),
  }

  // ใช้ applyMatchdayChronicle แบบมือ — แปะรายงานวันว่าง
  const chronicle = [dayReport, ...(next.matchdayChronicle ?? [])].slice(0, 60)
  next = {
    ...next,
    lastMatchdayReport: dayReport,
    matchdayChronicle: chronicle,
  }

  let message = `เดินเวลา → ${newDate}`
  if (todays.length === 0) {
    message += ' · วันว่าง (มีเหตุการณ์โลก/ฟื้นตัว/ไลฟ์สไตล์)'
  } else if (humanMatchToday) {
    message += ` · มีนัดคุณ ${todays.filter((f) => f.homeClubId === next.humanClubId || f.awayClubId === next.humanClubId).length} นัด — กดเล่นแมตช์เดย์`
  } else {
    message += ` · มีนัดอื่น ${todays.length} นัดในปฏิทินวันนี้ (ลีก/ถ้วยคนละวันได้)`
  }

  next = tickSquadRegistration(next)

  return { save: next, message, humanMatchToday, fixturesToday: todays.length }
}
