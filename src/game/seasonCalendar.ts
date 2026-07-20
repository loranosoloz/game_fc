import intlDb from '@/data/intlCalendar.json'
import { leagueMatchdays } from '@/data/world/leagueSize'
import type { GameSave, InternationalBreakState } from './types'
import { nationalTeamCallUps } from './nationalTeams'

export type CalendarWeekKind =
  | 'league'
  | 'cup_europe'
  | 'fifa_window'
  | 'winter_break'
  | 'rest'
  | 'intl_tournament'
  | 'friendly'

export interface SeasonWeek {
  weekIndex: number
  date: string
  kind: CalendarWeekKind
  labelTh: string
  /** นัดลีกที่เล่นสัปดาห์นี้ (ถ้ามี) */
  leagueMatchday?: number
}

export interface IntlTournamentEvent {
  id: string
  label: string
  labelTh: string
  kind: string
  year: number
  weeks: number
  confederation?: string
  blurb?: string
}

export interface SeasonCalendarState {
  season: number
  leagueId: string
  weeks: SeasonWeek[]
  /** MD ลีก → วันที่จริง (มีช่องว่างพัก) */
  dateByLeagueMd: Record<number, string>
  /** ทัวร์นาเมนต์ฤดูร้อนก่อนเปิดฤดูกาลนี้ */
  summerEvents: IntlTournamentEvent[]
}

type TourneyDef = {
  id: string
  label: string
  labelTh: string
  periodYears: number
  phaseOffset: number
  weeks: number
  kind: string
  confederation?: string
  summerOnly?: boolean
  blurb?: string
}

const TOURNAMENTS = intlDb.tournaments as TourneyDef[]
const FIFA_WINDOWS = intlDb.fifaWindows as {
  afterLeagueMdRatio: number
  weeks: number
  labelTh: string
  kind?: string
}[]

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function daysBetween(a: string, b: string) {
  const da = new Date(`${a}T12:00:00Z`).getTime()
  const db = new Date(`${b}T12:00:00Z`).getTime()
  return Math.round((db - da) / 86_400_000)
}

/** ทัวร์นาเมนต์ที่จัดฤดูร้อนของปีปฏิทินนั้น (ก่อนเปิดลีก ส.ค.) */
export function summerTournamentsForYear(year: number): IntlTournamentEvent[] {
  const out: IntlTournamentEvent[] = []
  for (const t of TOURNAMENTS) {
    if (t.summerOnly === false) continue
    if (t.kind === 'friendly') continue
    if (t.kind === 'nations_league') continue
    if ((year - t.phaseOffset) % t.periodYears !== 0) continue
    out.push({
      id: t.id,
      label: t.label,
      labelTh: t.labelTh,
      kind: t.kind,
      year,
      weeks: t.weeks,
      confederation: t.confederation,
      blurb: t.blurb,
    })
  }
  // ไม่มีทัวร์ใหญ่ → อุ่นเครื่อง
  if (out.length === 0) {
    const fr = TOURNAMENTS.find((t) => t.id === 'friendlies_summer')
    if (fr) {
      out.push({
        id: fr.id,
        label: fr.label,
        labelTh: fr.labelTh,
        kind: 'friendly',
        year,
        weeks: fr.weeks,
        blurb: fr.blurb,
      })
    }
  }
  return out.sort((a, b) => b.weeks - a.weeks)
}

/**
 * สร้างปฏิทินฤดูกาลคลับ — นัดลีกไม่ติดกันทุกสัปดาห์
 * มีช่อง FIFA window / พักวินเทอร์ คั่น
 */
export function buildSeasonCalendar(
  season: number,
  leagueId: string,
  seasonStart = `${season}-08-15`,
): SeasonCalendarState {
  const totalMd = leagueMatchdays(leagueId)
  const summerEvents = summerTournamentsForYear(season)

  // จุดแทรกพัก: หลังเพลย์ครบ N นัดลีก
  const inserts: { afterMd: number; weeks: number; kind: CalendarWeekKind; labelTh: string }[] =
    FIFA_WINDOWS.map((w) => ({
      afterMd: Math.max(1, Math.min(totalMd - 1, Math.round(totalMd * w.afterLeagueMdRatio))),
      weeks: w.weeks,
      kind: (w.kind === 'winter_break' ? 'winter_break' : 'fifa_window') as CalendarWeekKind,
      labelTh: w.labelTh,
    }))
  // ไม่ให้ afterMd ซ้ำ — รวมสัปดาห์
  const byAfter = new Map<number, { weeks: number; kind: CalendarWeekKind; labelTh: string }>()
  for (const ins of inserts) {
    const prev = byAfter.get(ins.afterMd)
    if (!prev) byAfter.set(ins.afterMd, ins)
    else {
      byAfter.set(ins.afterMd, {
        weeks: Math.max(prev.weeks, ins.weeks),
        kind: prev.kind === 'winter_break' || ins.kind === 'winter_break' ? 'winter_break' : 'fifa_window',
        labelTh: prev.weeks >= ins.weeks ? prev.labelTh : ins.labelTh,
      })
    }
  }

  const weeks: SeasonWeek[] = []
  const dateByLeagueMd: Record<number, string> = {}
  let weekIndex = 0

  // ช่วงปรีซีซั่นหลังจบบอลโลก — เริ่ม 20 ก.ค. (seasonStart−26) จนถึงก่อน Shield
  const preWeeks = 4
  let preCursor = addDays(seasonStart, -26)
  for (let i = 0; i < preWeeks; i++) {
    weeks.push({
      weekIndex,
      date: preCursor,
      kind: 'friendly',
      labelTh:
        i === preWeeks - 1
          ? 'ปรีซีซั่น / ทัวร์อุ่น (ก่อน Community Shield)'
          : `ปรีซีซั่น / ทัวร์อุ่น (${i + 1}/${preWeeks})`,
    })
    weekIndex += 1
    preCursor = addDays(preCursor, 7)
  }

  let cursor = seasonStart
  let placed = 0

  while (placed < totalMd) {
    placed += 1
    dateByLeagueMd[placed] = cursor
    weeks.push({
      weekIndex,
      date: cursor,
      kind: 'league',
      labelTh: `ลีก MD${placed}`,
      leagueMatchday: placed,
    })
    weekIndex += 1
    cursor = addDays(cursor, 7)

    const gap = byAfter.get(placed)
    if (gap) {
      for (let i = 0; i < gap.weeks; i++) {
        weeks.push({
          weekIndex,
          date: cursor,
          kind: gap.kind,
          labelTh: gap.weeks > 1 ? `${gap.labelTh} (${i + 1}/${gap.weeks})` : gap.labelTh,
        })
        weekIndex += 1
        cursor = addDays(cursor, 7)
      }
    } else if (placed < totalMd && placed % 5 === 0) {
      // ทุก ~5 นัดแทรกพักเบา 1 สัปดาห์ (ไม่ให้แข่งติดกันตลอด)
      weeks.push({
        weekIndex,
        date: cursor,
        kind: 'cup_europe',
        labelTh: 'สัปดาห์ถ้วย · ยุโรป (ไม่มีนัดลีก)',
      })
      weekIndex += 1
      cursor = addDays(cursor, 7)
    }
  }

  return {
    season,
    leagueId,
    weeks,
    dateByLeagueMd,
    summerEvents,
  }
}

export function ensureSeasonCalendar(save: GameSave): GameSave {
  const cal = save.seasonCalendar
  const hasFriendly = Boolean(cal?.weeks?.some((w) => w.kind === 'friendly'))
  if (
    cal &&
    cal.season === save.season &&
    cal.leagueId === save.leagueId &&
    cal.weeks?.length &&
    Object.keys(cal.dateByLeagueMd ?? {}).length >= 10 &&
    hasFriendly
  ) {
    // เซฟเก่า: สัปดาห์ถ้วยเคยเป็น kind rest → ย้ายเป็น cup_europe
    if (cal.weeks.some((w) => w.kind === 'rest')) {
      return {
        ...save,
        seasonCalendar: {
          ...cal,
          weeks: cal.weeks.map((w) =>
            w.kind === 'rest'
              ? {
                  ...w,
                  kind: 'cup_europe' as const,
                  labelTh:
                    w.labelTh.includes('ถ้วย') || w.labelTh.includes('ยุโรป')
                      ? w.labelTh
                      : 'สัปดาห์ถ้วย · ยุโรป (ไม่มีนัดลีก)',
                }
              : w,
          ),
        },
      }
    }
    return save
  }
  return {
    ...save,
    seasonCalendar: buildSeasonCalendar(save.season, save.leagueId || 'eng'),
  }
}

/** หลังจบ MD — ถ้าวันนัดถัดไปห่างเกิน 9 วัน ให้คิวพักตามปฏิทิน */
export function maybeQueueCalendarGap(save: GameSave): GameSave {
  if ((save.internationalBreak?.weeksLeft ?? 0) > 0) return save
  const upcoming = save.fixtures.filter((f) => !f.played)
  if (upcoming.length === 0) return save
  const nextDate = [...upcoming].sort((a, b) => a.date.localeCompare(b.date))[0]!.date
  const gapDays = daysBetween(save.currentDate, nextDate)
  if (gapDays <= 9) return save

  const weeks = Math.min(3, Math.max(1, Math.ceil((gapDays - 7) / 7)))
  const cal = save.seasonCalendar
  const label =
    cal?.weeks.find(
      (w) =>
        w.date > save.currentDate &&
        w.date < nextDate &&
        (w.kind === 'fifa_window' || w.kind === 'winter_break' || w.kind === 'rest'),
    )?.labelTh ?? 'พักตามปฏิทิน'

  const isFifa = label.includes('FIFA')
  let calledUpIds: string[] = []
  let callUps: InternationalBreakState['callUps'] = []
  let snubs: InternationalBreakState['snubs'] = []
  let players = save.players

  if (isFifa) {
    const { callUps: cu, snubs: sn } = nationalTeamCallUps(save, weeks)
    callUps = cu
    snubs = sn
    calledUpIds = cu.map((c) => c.playerId)
    const callIds = new Set(calledUpIds)
    const snubIds = new Set(sn.map((s) => s.playerId))
    players = save.players.map((p) => {
      if (callIds.has(p.id)) {
        return {
          ...p,
          leaveDays: Math.max(p.leaveDays ?? 0, weeks),
          morale: Math.min(20, p.morale + 1),
        }
      }
      if (snubIds.has(p.id) && p.clubId === save.humanClubId) {
        return { ...p, morale: Math.max(1, p.morale - 1) }
      }
      return p
    })
  }

  return {
    ...save,
    players,
    internationalBreak: {
      weeksLeft: weeks,
      totalWeeks: weeks,
      label: isFifa ? label : `ปฏิทิน · ${label}`,
      afterMatchday: save.matchday,
      calledUpIds,
      callUps,
      snubs,
    },
    inbox: [
      {
        id: `msg-cal-gap-${Date.now()}`,
        date: save.currentDate,
        title: isFifa ? 'พักเบรกทีมชาติ' : 'สัปดาห์ว่างตามปฏิทิน',
        body: `${label} · พัก ${weeks} สัปดาห์ก่อนนัดถัดไป (${nextDate}) — ลีกไม่ได้แข่งติดกันทุกอาทิตย์`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 45),
  }
}

export function calendarBlurb(cal: SeasonCalendarState | null | undefined): string {
  if (!cal) return 'ยังไม่มีปฏิทินฤดูกาล'
  const summer = cal.summerEvents.map((e) => e.labelTh).join(' · ') || 'อุ่นเครื่อง'
  const pre = cal.weeks.filter((w) => w.kind === 'friendly').length
  const gaps = cal.weeks.filter((w) => w.kind !== 'league' && w.kind !== 'friendly').length
  return `ฤดูร้อน: ${summer} · ปรีซีซั่น ${pre} สัปดาห์ (ก่อน Shield/ลีก) · สัปดาห์ในปฏิทิน ${cal.weeks.length} (พัก/FIFA ${gaps})`
}

export function listAllTournamentDefs(): TourneyDef[] {
  return TOURNAMENTS
}
