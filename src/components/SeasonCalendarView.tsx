import { useEffect, useMemo, useRef, useState } from 'react'
import type { Club, Fixture, GameSave } from '@/game/types'
import type { CalendarWeekKind, SeasonCalendarState, SeasonWeek } from '@/game/seasonCalendar'
import { cn } from '@/lib/cn'

const KIND_STYLE: Record<
  CalendarWeekKind,
  { bg: string; soft: string; ring: string; text: string; label: string; short: string }
> = {
  league: {
    bg: 'bg-lime-500',
    soft: 'bg-lime-50',
    ring: 'ring-lime-600',
    text: 'text-lime-900',
    label: 'นัดลีก',
    short: 'ลีก',
  },
  fifa_window: {
    bg: 'bg-indigo-500',
    soft: 'bg-indigo-50',
    ring: 'ring-indigo-600',
    text: 'text-indigo-900',
    label: 'พัก FIFA',
    short: 'FIFA',
  },
  winter_break: {
    bg: 'bg-sky-400',
    soft: 'bg-sky-50',
    ring: 'ring-sky-600',
    text: 'text-sky-900',
    label: 'พักวินเทอร์',
    short: 'พัก',
  },
  cup_europe: {
    bg: 'bg-violet-500',
    soft: 'bg-violet-50',
    ring: 'ring-violet-600',
    text: 'text-violet-900',
    label: 'ถ้วย/ยุโรป',
    short: 'ถ้วย',
  },
  rest: {
    bg: 'bg-slate-300',
    soft: 'bg-slate-50',
    ring: 'ring-slate-500',
    text: 'text-slate-700',
    label: 'สัปดาห์ว่าง',
    short: 'ว่าง',
  },
  friendly: {
    bg: 'bg-amber-400',
    soft: 'bg-amber-50',
    ring: 'ring-amber-600',
    text: 'text-amber-950',
    label: 'ปรีซีซั่น/อุ่นเครื่อง',
    short: 'อุ่น',
  },
  intl_tournament: {
    bg: 'bg-orange-500',
    soft: 'bg-orange-50',
    ring: 'ring-orange-600',
    text: 'text-orange-950',
    label: 'ทัวร์นาเมนต์',
    short: 'ทัวร์',
  },
}

const MONTH_TH = [
  'มกราคม',
  'กุมภาพันธ์',
  'มีนาคม',
  'เมษายน',
  'พฤษภาคม',
  'มิถุนายน',
  'กรกฎาคม',
  'สิงหาคม',
  'กันยายน',
  'ตุลาคม',
  'พฤศจิกายน',
  'ธันวาคม',
]

const MONTH_TH_SHORT = [
  'ม.ค.',
  'ก.พ.',
  'มี.ค.',
  'เม.ย.',
  'พ.ค.',
  'มิ.ย.',
  'ก.ค.',
  'ส.ค.',
  'ก.ย.',
  'ต.ค.',
  'พ.ย.',
  'ธ.ค.',
]

const DOW_TH = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']

/** สีชิปแมตช์ตามประเภทถ้วย */
const COMP_CHIP: Record<string, { chip: string; short: string }> = {
  league: { chip: 'bg-lime-600 text-white', short: 'ลีก' },
  cup: { chip: 'bg-rose-600 text-white', short: 'FA' },
  league_cup: { chip: 'bg-amber-500 text-white', short: 'LC' },
  trophy: { chip: 'bg-stone-500 text-white', short: 'TR' },
  ucl: { chip: 'bg-blue-700 text-white', short: 'UCL' },
  uel: { chip: 'bg-orange-600 text-white', short: 'UEL' },
  uecl: { chip: 'bg-teal-600 text-white', short: 'UECL' },
  acl: { chip: 'bg-red-700 text-white', short: 'ACL' },
  acl_two: { chip: 'bg-red-500 text-white', short: 'ACL2' },
  asean_cup: { chip: 'bg-emerald-600 text-white', short: 'AFF' },
  cwc: { chip: 'bg-yellow-600 text-white', short: 'CWC' },
  super_cup: { chip: 'bg-violet-600 text-white', short: 'SC' },
}

const CUP_EURO_KINDS = new Set([
  'cup',
  'league_cup',
  'trophy',
  'ucl',
  'uel',
  'uecl',
  'acl',
  'acl_two',
  'asean_cup',
  'cwc',
  'super_cup',
])

function parseIso(iso: string) {
  return new Date(`${iso}T12:00:00Z`)
}

function toIso(d: Date) {
  return d.toISOString().slice(0, 10)
}

function addDaysIso(iso: string, days: number) {
  const d = parseIso(iso)
  d.setUTCDate(d.getUTCDate() + days)
  return toIso(d)
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}

function findCurrentWeekIndex(weeks: SeasonWeek[], currentDate: string): number {
  let idx = 0
  for (let i = 0; i < weeks.length; i++) {
    if (weeks[i].date <= currentDate) idx = i
    else break
  }
  return idx
}

function weekForDate(weeks: SeasonWeek[], date: string): SeasonWeek | null {
  let best: SeasonWeek | null = null
  for (const w of weeks) {
    if (w.date <= date) best = w
    else break
  }
  if (!best) return null
  const idx = weeks.indexOf(best)
  const next = weeks[idx + 1]
  if (next && date >= next.date) return null
  return best
}

function formatDateTh(iso: string) {
  const d = parseIso(iso)
  return `${d.getUTCDate()} ${MONTH_TH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`
}

function monthTitle(ym: string) {
  const [ys, ms] = ym.split('-')
  const y = Number(ys)
  const m = Number(ms) - 1
  return `${MONTH_TH[m]} ${y + 543}`
}

function shiftMonth(ym: string, delta: number) {
  const [ys, ms] = ym.split('-')
  const d = new Date(Date.UTC(Number(ys), Number(ms) - 1 + delta, 1))
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Mon-start month grid cells (ISO dates or null for padding) */
function buildMonthCells(ym: string): (string | null)[] {
  const [ys, ms] = ym.split('-')
  const year = Number(ys)
  const month = Number(ms) - 1
  const first = new Date(Date.UTC(year, month, 1))
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
  const monPad = (first.getUTCDay() + 6) % 7
  const cells: (string | null)[] = []
  for (let i = 0; i < monPad; i++) cells.push(null)
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(
      `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
    )
  }
  while (cells.length % 7 !== 0) cells.push(null)
  return cells
}

function clubCode(club: Club | undefined, fallback: string) {
  return club?.shortName || club?.name?.slice(0, 3).toUpperCase() || fallback.slice(0, 3)
}

function defaultCompName(kind: string) {
  return COMP_CHIP[kind]?.short ?? kind
}

export function SeasonCalendarView({
  calendar,
  currentDate,
  matchday,
  summerReports = [],
  fixtures = [],
  clubs = [],
  humanClubId,
  competitionNames = {},
}: {
  calendar: SeasonCalendarState
  currentDate: string
  matchday: number
  summerReports?: GameSave['lastIntlTournamentReports']
  fixtures?: Fixture[]
  clubs?: Club[]
  humanClubId?: string
  /** ชื่อถ้วยจริง เช่น FA Cup, EFL Cup, UCL */
  competitionNames?: Partial<Record<string, string>>
}) {
  const compLabel = (kind: string) => competitionNames[kind] ?? defaultCompName(kind)

  const currentIdx = useMemo(
    () => findCurrentWeekIndex(calendar.weeks, currentDate),
    [calendar.weeks, currentDate],
  )

  const seasonMonths = useMemo(() => {
    const set = new Set<string>()
    for (const w of calendar.weeks) {
      set.add(monthKey(w.date))
      set.add(monthKey(addDaysIso(w.date, 6)))
    }
    // รวมเดือนที่มีนัดถ้วย/ยุโรป (วันที่อาจอยู่นอกสัปดาห์ลีก)
    for (const f of fixtures) {
      if (CUP_EURO_KINDS.has(f.competition)) set.add(monthKey(f.date))
    }
    return [...set].sort()
  }, [calendar.weeks, fixtures])

  const [viewMonth, setViewMonth] = useState(() => monthKey(currentDate))
  const [selectedDate, setSelectedDate] = useState(currentDate)
  const [showStrip, setShowStrip] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setViewMonth(monthKey(currentDate))
    setSelectedDate(currentDate)
  }, [currentDate])

  const clubById = useMemo(() => {
    const m = new Map<string, Club>()
    for (const c of clubs) m.set(c.id, c)
    return m
  }, [clubs])

  const humanFixturesByDate = useMemo(() => {
    const map = new Map<string, Fixture[]>()
    if (!humanClubId) return map
    for (const f of fixtures) {
      if (f.homeClubId !== humanClubId && f.awayClubId !== humanClubId) continue
      const list = map.get(f.date) ?? []
      list.push(f)
      map.set(f.date, list)
    }
    return map
  }, [fixtures, humanClubId])

  const cupEuroSchedule = useMemo(() => {
    if (!humanClubId) return [] as Fixture[]
    return fixtures
      .filter(
        (f) =>
          CUP_EURO_KINDS.has(f.competition) &&
          (f.homeClubId === humanClubId || f.awayClubId === humanClubId),
      )
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [fixtures, humanClubId])

  const upcomingCups = cupEuroSchedule.filter((f) => !f.played && f.date >= currentDate)
  const recentCups = cupEuroSchedule.filter((f) => f.played).slice(-4)

  const cells = useMemo(() => buildMonthCells(viewMonth), [viewMonth])

  const selectedWeek = useMemo(
    () => weekForDate(calendar.weeks, selectedDate),
    [calendar.weeks, selectedDate],
  )
  const selectedFixtures = humanFixturesByDate.get(selectedDate) ?? []

  const leaguePlayed = calendar.weeks.filter(
    (w) => w.kind === 'league' && w.date <= currentDate,
  ).length
  const leagueTotal = calendar.weeks.filter((w) => w.kind === 'league').length

  const canPrev = seasonMonths.length > 0 && viewMonth > seasonMonths[0]
  const canNext =
    seasonMonths.length > 0 && viewMonth < seasonMonths[seasonMonths.length - 1]

  useEffect(() => {
    if (!showStrip) return
    const el = scrollRef.current
    if (!el) return
    const cell = el.querySelector(`[data-week="${currentIdx}"]`) as HTMLElement | null
    cell?.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' })
  }, [currentIdx, showStrip])

  const monthMarkers = useMemo(() => {
    const markers: { idx: number; label: string }[] = []
    let lastMonth = ''
    calendar.weeks.forEach((w, i) => {
      const m = w.date.slice(0, 7)
      if (m !== lastMonth) {
        const d = parseIso(w.date)
        markers.push({
          idx: i,
          label: `${MONTH_TH_SHORT[d.getUTCMonth()]} ${d.getUTCFullYear() + 543}`,
        })
        lastMonth = m
      }
    })
    return markers
  }, [calendar.weeks])

  const jumpToFixture = (f: Fixture) => {
    setSelectedDate(f.date)
    setViewMonth(monthKey(f.date))
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">ปฏิทินฤดูกาล</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            ฤดูกาล {calendar.season} · {calendar.weeks.length} สัปดาห์ · มุมมองรายเดือน
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-right">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            วันนี้ในเกม
          </p>
          <p className="text-sm font-bold text-slate-900">{formatDateTh(currentDate)}</p>
          <p className="text-xs text-slate-600">
            {matchday > 0 ? `แมตช์เดย์ ${matchday}` : 'ปรีซีซั่น'} · ลีก {leaguePlayed}/
            {leagueTotal}
          </p>
        </div>
      </div>

      {calendar.summerEvents.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {calendar.summerEvents.map((e) => (
            <span
              key={e.id}
              className="inline-flex items-center gap-1.5 rounded-full border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-950"
              title={e.blurb}
            >
              <span className="h-2 w-2 rounded-full bg-orange-500" aria-hidden />
              {e.labelTh}
              <span className="font-normal text-orange-800/80">· {e.weeks} สัปดาห์</span>
            </span>
          ))}
        </div>
      ) : null}

      {/* Cup & Europe schedule */}
      <div className="rounded-xl border border-violet-200 bg-violet-50/60 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-violet-950">ถ้วยชาติ · ลีกคัพ · ยูฟ่า / เอเชีย</h3>
          {upcomingCups[0] ? (
            <button
              type="button"
              onClick={() => jumpToFixture(upcomingCups[0]!)}
              className="text-xs font-bold text-violet-800 underline underline-offset-2"
            >
              ไปนัดถ้วยถัดไป →
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
          {(
            [
              ['cup', 'FA / ถ้วยชาติ'],
              ['league_cup', 'ลีกคัพ'],
              ['ucl', 'UCL'],
              ['uel', 'UEL'],
              ['uecl', 'UECL'],
              ['super_cup', 'ซูเปอร์คัพ'],
            ] as const
          ).map(([k, fallback]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span
                className={cn('rounded px-1 py-0.5 text-[9px] font-bold', COMP_CHIP[k].chip)}
              >
                {COMP_CHIP[k].short}
              </span>
              {competitionNames[k] ?? fallback}
            </span>
          ))}
        </div>
        {upcomingCups.length > 0 ? (
          <ul className="mt-3 max-h-48 space-y-1.5 overflow-y-auto">
            {upcomingCups.slice(0, 12).map((f) => {
              const home = humanClubId === f.homeClubId
              const oppId = home ? f.awayClubId : f.homeClubId
              const opp = clubById.get(oppId)
              const chip = COMP_CHIP[f.competition] ?? COMP_CHIP.cup
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => jumpToFixture(f)}
                    className="flex w-full items-center gap-2 rounded-lg bg-white/90 px-2.5 py-1.5 text-left text-xs ring-1 ring-violet-100 hover:bg-white"
                  >
                    <span className={cn('shrink-0 rounded px-1.5 py-0.5 text-[9px] font-bold', chip.chip)}>
                      {chip.short}
                    </span>
                    <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                      {formatDateTh(f.date)} · {home ? 'เหย้า' : 'เยือน'} vs{' '}
                      {opp?.shortName ?? opp?.name ?? oppId}
                      {f.cupRound ? ` · ${f.cupRound}` : ''}
                    </span>
                    <span className="shrink-0 text-[10px] text-slate-500">
                      {compLabel(f.competition)}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-violet-900/80">
            {cupEuroSchedule.length === 0
              ? 'ยังไม่มีนัดถ้วย/ยุโรปของทีมเราในตาราง (อาจยังไม่ผ่านเข้ารอบ หรือยังไม่ถึงรอบแรก)'
              : 'เล่นครบทุกรอบที่มีในตารางแล้ว — รอบถัดไปจะโผล่หลังแข่งรอบปัจจุบัน'}
          </p>
        )}
        {recentCups.length > 0 ? (
          <p className="mt-2 text-[10px] text-slate-500">
            ล่าสุด:{' '}
            {recentCups
              .map((f) => {
                const score =
                  f.homeGoals != null && f.awayGoals != null
                    ? `${f.homeGoals}-${f.awayGoals}`
                    : '—'
                return `${compLabel(f.competition)} ${score}`
              })
              .join(' · ')}
          </p>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-600">
        {(Object.keys(KIND_STYLE) as CalendarWeekKind[])
          .filter((k) => k !== 'rest')
          .map((k) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className={cn('h-2.5 w-2.5 rounded-sm', KIND_STYLE[k].bg)} aria-hidden />
              {KIND_STYLE[k].label}
            </span>
          ))}
      </div>

      {/* Month navigator */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            disabled={!canPrev}
            onClick={() => setViewMonth((m) => shiftMonth(m, -1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ←
          </button>
          <h3 className="min-w-[10rem] text-center text-base font-bold text-slate-900">
            {monthTitle(viewMonth)}
          </h3>
          <button
            type="button"
            disabled={!canNext}
            onClick={() => setViewMonth((m) => shiftMonth(m, 1))}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            →
          </button>
        </div>
        <button
          type="button"
          onClick={() => {
            setViewMonth(monthKey(currentDate))
            setSelectedDate(currentDate)
          }}
          className="rounded-lg border border-lime-300 bg-lime-50 px-3 py-1.5 text-xs font-bold text-lime-900 hover:bg-lime-100"
        >
          ไปวันนี้
        </button>
      </div>

      {/* Full month grid */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
          {DOW_TH.map((d) => (
            <div
              key={d}
              className="px-1 py-2 text-center text-[11px] font-bold tracking-wide text-slate-500 uppercase"
            >
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 auto-rows-fr">
          {cells.map((iso, i) => {
            if (!iso) {
              return (
                <div
                  key={`pad-${i}`}
                  className="min-h-[5.5rem] border-b border-r border-slate-100 bg-slate-50/40"
                />
              )
            }
            const week = weekForDate(calendar.weeks, iso)
            const style = week ? KIND_STYLE[week.kind] : null
            const dayFixtures = humanFixturesByDate.get(iso) ?? []
            const isToday = iso === currentDate
            const isSelected = iso === selectedDate
            const dayNum = Number(iso.slice(8, 10))
            const inSeason = Boolean(week)

            return (
              <button
                key={iso}
                type="button"
                onClick={() => setSelectedDate(iso)}
                className={cn(
                  'relative flex min-h-[5.5rem] flex-col gap-0.5 border-b border-r border-slate-100 p-1.5 text-left transition',
                  inSeason && style ? style.soft : 'bg-white',
                  !inSeason && 'opacity-50',
                  isSelected && 'z-[1] ring-2 ring-slate-800 ring-inset',
                  isToday && !isSelected && 'ring-2 ring-lime-500 ring-inset',
                  'hover:brightness-[0.98]',
                )}
              >
                <div className="flex items-start justify-between gap-1">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold tabular-nums',
                      isToday
                        ? 'bg-lime-600 text-white'
                        : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-800',
                    )}
                  >
                    {dayNum}
                  </span>
                  {week && iso === week.date ? (
                    <span
                      className={cn(
                        'rounded px-1 py-0.5 text-[9px] font-bold text-white',
                        style?.bg,
                      )}
                    >
                      {week.leagueMatchday ? `MD${week.leagueMatchday}` : style?.short}
                    </span>
                  ) : week ? (
                    <span className={cn('mt-1 h-1.5 w-1.5 rounded-full', style?.bg)} aria-hidden />
                  ) : null}
                </div>

                <div className="mt-auto flex flex-col gap-0.5">
                  {dayFixtures.slice(0, 2).map((f) => {
                    const home = humanClubId === f.homeClubId
                    const oppId = home ? f.awayClubId : f.homeClubId
                    const opp = clubCode(clubById.get(oppId), oppId)
                    const chip = COMP_CHIP[f.competition] ?? {
                      chip: 'bg-slate-600 text-white',
                      short: f.competition,
                    }
                    const score =
                      f.played && f.homeGoals != null && f.awayGoals != null
                        ? `${f.homeGoals}-${f.awayGoals}`
                        : null
                    return (
                      <span
                        key={f.id}
                        className={cn(
                          'truncate rounded px-1 py-0.5 text-[9px] font-semibold leading-tight',
                          chip.chip,
                        )}
                        title={`${compLabel(f.competition)} · ${home ? 'เหย้า' : 'เยือน'} vs ${opp}`}
                      >
                        {score ? `${score} ` : ''}
                        {chip.short} {home ? 'vs' : '@'} {opp}
                      </span>
                    )
                  })}
                  {dayFixtures.length > 2 ? (
                    <span className="text-[9px] font-semibold text-slate-500">
                      +{dayFixtures.length - 2} นัด
                    </span>
                  ) : null}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      <div className="rounded-xl border border-slate-200 bg-white px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-bold text-slate-900">{formatDateTh(selectedDate)}</span>
          {selectedDate === currentDate ? (
            <span className="rounded-full bg-lime-100 px-2 py-0.5 text-[10px] font-bold text-lime-900">
              วันนี้
            </span>
          ) : null}
          {selectedWeek ? (
            <span
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-bold text-white',
                KIND_STYLE[selectedWeek.kind].bg,
              )}
            >
              {KIND_STYLE[selectedWeek.kind].label}
            </span>
          ) : (
            <span className="text-xs text-slate-500">นอกช่วงฤดูกาลคลับ</span>
          )}
        </div>
        {selectedWeek ? (
          <p className={cn('mt-2 text-sm', KIND_STYLE[selectedWeek.kind].text)}>
            {selectedWeek.labelTh}
            {selectedWeek.leagueMatchday
              ? ` · แมตช์เดย์ลีก ${selectedWeek.leagueMatchday}`
              : ''}
          </p>
        ) : null}

        {selectedFixtures.length > 0 ? (
          <ul className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            {selectedFixtures.map((f) => {
              const home = humanClubId === f.homeClubId
              const oppId = home ? f.awayClubId : f.homeClubId
              const opp = clubById.get(oppId)
              const chip = COMP_CHIP[f.competition] ?? COMP_CHIP.cup
              return (
                <li
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={cn(
                          'rounded px-1.5 py-0.5 text-[9px] font-bold',
                          chip.chip,
                        )}
                      >
                        {chip.short}
                      </span>
                      <span className="text-xs font-semibold text-slate-600">
                        {compLabel(f.competition)}
                      </span>
                    </div>
                    <p className="mt-0.5 font-semibold text-slate-900">
                      {home ? 'เหย้า' : 'เยือน'} vs {opp?.name ?? oppId}
                    </p>
                    <p className="text-xs text-slate-500">
                      {f.cupRound ? `${f.cupRound} · ` : ''}
                      {f.slot === 'midweek' ? 'กลางสัปดาห์' : 'สุดสัปดาห์'}
                    </p>
                  </div>
                  <div className="text-right">
                    {f.played && f.homeGoals != null && f.awayGoals != null ? (
                      <p className="text-lg font-bold tabular-nums text-slate-900">
                        {f.homeGoals} – {f.awayGoals}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-amber-800">ยังไม่แข่ง</p>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="mt-2 text-xs text-slate-500">ไม่มีนัดของทีมเราในวันนี้</p>
        )}
      </div>

      {/* Season strip overview */}
      <div className="rounded-xl border border-slate-200 bg-slate-50/80">
        <button
          type="button"
          onClick={() => setShowStrip((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3 text-left"
        >
          <span className="text-sm font-semibold text-slate-800">ภาพรวมทั้งฤดูกาล (แถบไทม์ไลน์)</span>
          <span className="text-xs font-bold text-slate-500">{showStrip ? 'ซ่อน' : 'แสดง'}</span>
        </button>
        {showStrip ? (
          <div className="border-t border-slate-200 px-4 pb-4">
            <div ref={scrollRef} className="overflow-x-auto pb-1 pt-3">
              <div className="min-w-max px-0.5">
                {monthMarkers.map((m) => (
                  <p
                    key={`${m.idx}-${m.label}`}
                    className="mb-1 text-[10px] font-semibold text-slate-400"
                    style={{
                      marginLeft: `${m.idx * 2.125}rem`,
                      width: 'max-content',
                    }}
                  >
                    {m.label}
                  </p>
                ))}
                <div className="flex gap-1">
                  {calendar.weeks.map((week, i) => {
                    const style = KIND_STYLE[week.kind]
                    const isCurrent = i === currentIdx
                    return (
                      <button
                        data-week={i}
                        key={`${week.weekIndex}-${week.date}`}
                        type="button"
                        title={`${week.labelTh} · ${week.date}`}
                        onClick={() => {
                          setSelectedDate(week.date)
                          setViewMonth(monthKey(week.date))
                        }}
                        className={cn(
                          'group relative flex h-12 w-7 shrink-0 flex-col items-center justify-end rounded-md pb-1 transition',
                          style.bg,
                          isCurrent && 'ring-2 ring-offset-1',
                          isCurrent && style.ring,
                          'hover:brightness-110',
                        )}
                      >
                        <span className="text-[8px] font-bold text-white/90 drop-shadow-sm">
                          {week.leagueMatchday ? `MD${week.leagueMatchday}` : style.short}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
            <p className="mt-1 text-[10px] text-slate-400">คลิกสัปดาห์เพื่อกระโดดไปเดือนนั้น</p>
          </div>
        ) : null}
      </div>

      {summerReports && summerReports.length > 0 ? (
        <ul className="space-y-1.5 border-t border-slate-100 pt-3 text-xs text-slate-700">
          {summerReports.map((r) => (
            <li
              key={r.eventId}
              className="flex items-start gap-2 rounded-md bg-slate-50 px-2 py-1.5"
            >
              <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" aria-hidden />
              <span>
                <span className="font-semibold">{r.labelTh}</span>
                {' — แชมป์ '}
                {r.championTh}
                {r.humanClubPlayersAffected
                  ? ` · ลูกทีมไป ${r.humanClubPlayersAffected} คน`
                  : ''}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  )
}
