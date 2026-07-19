import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { formatMoney } from '@/lib/format'
import { ensureFans, fanMoodLabel, fanTicketMultiplier } from '@/game/fans'
import { boardLabel } from '@/game/board'
import { ensurePhase5 } from '@/game/save'
import { ensureMediaFeed, gossipLine, countTodaysNews } from '@/game/media'
import { ensureScouting } from '@/game/scouting'
import { pendingTalkRequests } from '@/game/playerTalks'
import { latestSquadDay } from '@/game/dailyLife'
import { fixtureWeatherSeed, pickWeather, WEATHER_LABEL } from '@/game/weather'
import { calendarBlurb } from '@/game/seasonCalendar'
import { reportKindLabelTh } from '@/game/matchdayReport'
import {
  NT_CAMP_FOCUS_LABEL,
  type NtCampFocus,
} from '@/game/ntCamp'
import { playerNationality } from '@/game/nationalTeams'
import { LANG_LABEL_TH, managerLanguages } from '@/game/languages'
import { cn } from '@/lib/cn'
import { isPreSeasonBlocking } from '@/game/preSeason'

export function PortalPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(ensureFans(saveRaw))
  const markInboxRead = useGameStore((s) => s.markInboxRead)
  const answerPress = useGameStore((s) => s.answerPressConference)
  const skipPress = useGameStore((s) => s.dismissPressConference)
  const answerInterview = useGameStore((s) => s.answerPlayerInterview)
  const skipInterview = useGameStore((s) => s.dismissPlayerInterview)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const fans = save.fans
  const board = save.board
  const media = ensureMediaFeed(save)
  const todayNews = countTodaysNews(save)
  const socialPreview = media.social.slice(0, 2)
  const newsPreview = media.news.slice(0, 3)
  const conf = save.pressConference
  const interview = save.playerInterview
  const intlBreak = save.internationalBreak
  const [pressPicks, setPressPicks] = useState<Record<string, string>>({})
  const [ivPicks, setIvPicks] = useState<Record<string, string>>({})
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const opp = nextFx
    ? save.clubs.find(
        (c) =>
          c.id ===
          (nextFx.homeClubId === save.humanClubId ? nextFx.awayClubId : nextFx.homeClubId),
      )
    : null
  const table = sortedTable(save.table)
  const top5 = table.slice(0, 5)
  const ticketBoost = Math.round((fanTicketMultiplier(fans) - 1) * 100)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1
  const dayLogs = latestSquadDay(save)
  const missCount = dayLogs.filter((l) => l.missTraining).length
  const scouting = ensureScouting(save)
  const lastVisit = scouting.visits[0]
  const talkPending = pendingTalkRequests(save)
  const startNewSeason = useGameStore((s) => s.startNewSeason)
  const dismissReport = useGameStore((s) => s.dismissMatchdayReport)
  const setCampFocus = useGameStore((s) => s.setNtCampFocus)
  const toggleCampPlayer = useGameStore((s) => s.toggleNtCampPlayer)
  const confirmCamp = useGameStore((s) => s.confirmNtCamp)
  const report = save.lastMatchdayReport
  const chronicle = save.matchdayChronicle ?? []
  const ntCamp = save.ntCamp
  const mgrLangLabel = managerLanguages(save.managerProfile)
    .map((l) => LANG_LABEL_TH[l] ?? l)
    .join(' · ')
  const summerReports = save.lastIntlTournamentReports ?? []
  const [showChronicle, setShowChronicle] = useState(false)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        {report && report.lines.length > 0 ? (
          <div className="rounded-xl border border-sky-300 bg-sky-50 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-sky-950">
                  สรุปแมตช์เดย์ {report.matchday}
                  {report.season ? ` · S${report.season}` : ''}
                </h2>
                <p className="text-xs text-sky-800">
                  {report.date} · บันทึกเหตุการณ์ {report.lines.length} รายการ → เซฟ
                </p>
              </div>
              <button
                type="button"
                onClick={() => dismissReport()}
                className="shrink-0 text-xs font-semibold text-sky-900 underline"
              >
                ปิด
              </button>
            </div>
            <ul className="mt-3 space-y-1.5 text-sm text-sky-950">
              {report.lines.map((line, i) => (
                <li key={`${line.kind}-${i}`}>
                  <span className="text-xs font-semibold text-sky-700">
                    {reportKindLabelTh(line.kind)}
                  </span>
                  {' · '}
                  {line.text}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {chronicle.length > 0 ? (
          <div className="rounded-xl border border-slate-200 bg-white/80 p-4">
            <button
              type="button"
              className="flex w-full items-center justify-between text-left"
              onClick={() => setShowChronicle((v) => !v)}
            >
              <div>
                <h3 className="text-sm font-bold text-slate-900">สมุดเหตุการณ์อาชีพ</h3>
                <p className="text-xs text-slate-500">
                  สะสม {chronicle.length} แมตช์เดย์ล่าสุด (ย้าย·แฟน·เทคโอเวอร์·งบ·เจ็บ…)
                </p>
              </div>
              <span className="text-xs font-semibold text-slate-600">
                {showChronicle ? 'ซ่อน' : 'เปิด'}
              </span>
            </button>
            {showChronicle ? (
              <ul className="mt-3 max-h-72 space-y-3 overflow-y-auto text-sm">
                {chronicle.slice(0, 20).map((entry) => (
                  <li
                    key={`${entry.season}-${entry.matchday}-${entry.createdAt}`}
                    className="rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-xs font-semibold text-slate-700">
                      S{entry.season ?? '—'} MD{entry.matchday} · {entry.date}
                    </p>
                    <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                      {entry.lines.slice(0, 8).map((line, i) => (
                        <li key={`${entry.matchday}-${line.kind}-${i}`}>
                          <span className="font-semibold text-slate-500">
                            {reportKindLabelTh(line.kind)}
                          </span>
                          {' · '}
                          {line.text}
                        </li>
                      ))}
                      {entry.lines.length > 8 ? (
                        <li className="text-slate-400">+{entry.lines.length - 8} รายการ</li>
                      ) : null}
                    </ul>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}
        {save.career?.nationalNation ? (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-5">
            <h2 className="text-lg font-semibold text-indigo-950">โค้ชทีมชาติ</h2>
            <p className="mt-1 text-sm text-indigo-900">
              คุณถูกสมาคมจ้างคุมทีมชาติ
              {save.associations?.[save.career.nationalNation]?.nameTh
                ? ` ${save.associations[save.career.nationalNation]!.nameTh}`
                : ''}{' '}
              · คลับเป็น AI — หางานสโมสรได้ที่ Club Vision
            </p>
            <Link
              to="/club-vision"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-2"
            >
              เปิดตลาดงาน / สถานะชาติ →
            </Link>
          </div>
        ) : null}
        {save.board?.sacked || (save.career?.unemployed && !save.career?.nationalNation) ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 p-5">
            <h2 className="text-lg font-semibold text-rose-950">ว่างงาน · ตลาดงาน</h2>
            <p className="mt-1 text-sm text-rose-900">
              {(save.career?.jobOffers ?? []).filter((o) => o.status === 'open').length} ข้อเสนอเปิดอยู่ —
              ไปหน้า Club Vision เพื่อรับงานสโมสรหรือทีมชาติ
            </p>
            <Link
              to="/club-vision"
              className="mt-3 inline-block text-sm font-semibold underline underline-offset-2"
            >
              เปิดตลาดงาน →
            </Link>
          </div>
        ) : null}
        {isPreSeasonBlocking(save) ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 p-5">
            <h2 className="text-lg font-semibold text-amber-950">ปรีซีซั่น · ทัวร์อุ่นเครื่อง</h2>
            <p className="mt-1 text-sm text-amber-900">
              {save.preSeason?.note ??
                'เจ้าภาพเสนอให้อุ่นเครื่อง — ได้เงิน · สนาม/อากาศส่งผลต่อนักเตะ'}
            </p>
            <Link
              to="/preseason"
              className="mt-3 inline-block rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-300"
            >
              เปิดหน้าปรีซีซั่น →
            </Link>
          </div>
        ) : null}
        {save.seasonComplete && !save.board?.sacked ? (
          <div className="rounded-xl border border-lime-300 bg-lime-50 p-5">
            <h2 className="text-lg font-semibold text-lime-950">จบฤดูกาล {save.season}</h2>
            <p className="mt-1 text-sm text-lime-900">
              อันดับลีก #{rank || '—'} · กดเริ่มฤดูกาลใหม่เพื่ออายุนักเตะ +1 และสร้างตารางปีถัดไป
            </p>
            <button
              type="button"
              onClick={() => startNewSeason()}
              className="mt-3 rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-300"
            >
              เริ่มฤดูกาล {save.season + 1}
            </button>
          </div>
        ) : null}
        {save.seasonCalendar ? (
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-lg font-semibold text-slate-900">ปฏิทินฤดูกาล</h2>
            <p className="mt-1 text-sm text-slate-600">{calendarBlurb(save.seasonCalendar)}</p>
            {save.seasonCalendar.summerEvents.length > 0 ? (
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {save.seasonCalendar.summerEvents.map((e) => (
                  <li key={e.id}>
                    <span className="font-semibold">{e.labelTh}</span>
                    {e.blurb ? ` — ${e.blurb}` : ''} · {e.weeks} สัปดาห์
                  </li>
                ))}
              </ul>
            ) : null}
            {summerReports.length > 0 ? (
              <ul className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs text-slate-700">
                {summerReports.map((r) => (
                  <li key={r.eventId}>
                    <span className="font-semibold">{r.labelTh}</span>
                    {' — แชมป์ '}
                    {r.championTh}
                    {r.humanClubPlayersAffected
                      ? ` · ลูกทีมไป ${r.humanClubPlayersAffected}`
                      : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-2 text-xs text-slate-500">
              นัดลีก = เสาร์ · ถ้วย/ยุโรป = พุธกลางสัปดาห์ · มีช่อง FIFA / พักวินเทอร์คั่น
              {mgrLangLabel ? ` · ภาษาคุณ: ${mgrLangLabel}` : ''}
            </p>
          </div>
        ) : null}
        {intlBreak && intlBreak.weeksLeft > 0 ? (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-5">
            <h2 className="text-lg font-semibold text-indigo-950">พักเบรกทีมชาติ</h2>
            <p className="mt-1 text-sm text-indigo-900">
              {intlBreak.label} · เหลือ {intlBreak.weeksLeft}/{intlBreak.totalWeeks} สัปดาห์ · ไม่มีนัดลีก
            </p>
            {ntCamp && save.career?.nationalNation ? (
              <div className="mt-3 rounded-lg border border-indigo-200 bg-white/70 p-3">
                <h3 className="text-sm font-bold text-indigo-950">
                  แคมป์{ntCamp.nationTh} (คุณเป็นโค้ชชาติ)
                </h3>
                <p className="mt-1 text-xs text-indigo-800">{ntCamp.note}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(NT_CAMP_FOCUS_LABEL) as NtCampFocus[]).map((f) => (
                    <button
                      key={f}
                      type="button"
                      disabled={ntCamp.confirmed}
                      onClick={() => setCampFocus(f)}
                      className={cn(
                        'rounded-md px-2 py-1 text-xs font-semibold',
                        ntCamp.focus === f
                          ? 'bg-indigo-900 text-white'
                          : 'bg-indigo-100 text-indigo-950',
                        ntCamp.confirmed && 'opacity-60',
                      )}
                    >
                      {NT_CAMP_FOCUS_LABEL[f].split('—')[0]}
                    </button>
                  ))}
                </div>
                {!ntCamp.confirmed ? (
                  <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
                    {save.players
                      .filter((p) => playerNationality(p, save) === ntCamp.nation)
                      .sort((a, b) => b.overall - a.overall)
                      .slice(0, 40)
                      .map((p) => {
                        const on = ntCamp.selectedIds.includes(p.id)
                        return (
                          <li key={p.id}>
                            <button
                              type="button"
                              onClick={() => toggleCampPlayer(p.id)}
                              className={cn(
                                'w-full rounded px-2 py-1 text-left',
                                on ? 'bg-indigo-200 font-semibold' : 'hover:bg-indigo-50',
                              )}
                            >
                              {on ? '✓ ' : '○ '}
                              {p.name} · {p.overall} · {p.role}
                            </button>
                          </li>
                        )
                      })}
                  </ul>
                ) : (
                  <div className="mt-2 space-y-2 text-xs text-indigo-900">
                    <p>
                      โผยืนยันแล้ว {ntCamp.selectedIds.length} คน · {NT_CAMP_FOCUS_LABEL[ntCamp.focus]}
                      {ntCamp.associationForm != null
                        ? ` · ฟอร์มสมาคม ${ntCamp.associationForm}/20`
                        : ''}
                    </p>
                    {(ntCamp.friendlies?.length ?? 0) > 0 ? (
                      <ul className="space-y-1 rounded-md bg-indigo-100/50 px-2 py-1.5">
                        {ntCamp.friendlies!.map((f, i) => (
                          <li key={`${f.opponent}-${i}`}>
                            สัปดาห์ {f.weekIndex}: vs {f.opponentTh}{' '}
                            <span className="font-semibold">
                              {f.gf}-{f.ga}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-indigo-800/80">เดินหน้าสัปดาห์พักเพื่อแข่งอุ่นเครื่อง</p>
                    )}
                  </div>
                )}
                {!ntCamp.confirmed ? (
                  <button
                    type="button"
                    onClick={() => confirmCamp()}
                    className="mt-3 rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    ยืนยันโผแคมป์
                  </button>
                ) : null}
              </div>
            ) : null}
            <p className="mt-1 text-xs text-indigo-800/80">
              กดเล่นแมตช์เดย์ถัดไปเพื่อเดินหน้าสัปดาห์พัก
              {ntCamp && !ntCamp.confirmed ? ' — ยืนยันโผก่อน' : ''}
            </p>
            {(intlBreak.callUps ?? [])
              .filter((c) => c.clubId === save.humanClubId)
              .slice(0, 8).length > 0 ? (
              <ul className="mt-2 space-y-2 text-xs text-indigo-950">
                {(intlBreak.callUps ?? [])
                  .filter((c) => c.clubId === save.humanClubId)
                  .map((c) => (
                    <li key={c.playerId} className="rounded-lg bg-indigo-100/60 px-2 py-1.5">
                      <div>
                        <span className="font-semibold">{c.playerName}</span>
                        {' → '}
                        {c.nationTh} (โค้ช {c.coachName})
                        {c.firstCap ? (
                          <span className="ml-1 font-semibold text-amber-800">★ติดครั้งแรก</span>
                        ) : null}
                      </div>
                      {(c.reasons?.length ?? 0) > 0 ? (
                        <p className="mt-0.5 text-indigo-800/85">ทำไมถึงเรียก: {c.reasons.join(' · ')}</p>
                      ) : null}
                    </li>
                  ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-indigo-800">รอบนี้ไม่มีใครในทีมคุณถูกเรียก</p>
            )}
            {(intlBreak.snubs ?? []).filter((s) => s.clubId === save.humanClubId).length > 0 ? (
              <div className="mt-3 border-t border-indigo-200 pt-2">
                <p className="text-xs font-semibold text-rose-900">หลุดโผ / ไม่ติด</p>
                <ul className="mt-1 space-y-1.5 text-xs text-rose-950">
                  {(intlBreak.snubs ?? [])
                    .filter((s) => s.clubId === save.humanClubId)
                    .slice(0, 4)
                    .map((s) => (
                      <li key={s.playerId}>
                        <span className="font-semibold">{s.playerName}</span>
                        {' · '}
                        {s.nationTh}
                        {s.reasons?.length ? (
                          <span className="text-rose-800/90"> — {s.reasons.join(' · ')}</span>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">ชีพจรสโมสร</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-slate-500">เงินในบัญชี</dt>
              <dd className="font-semibold">{formatMoney(club.balance)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">แมตช์เดย์</dt>
              <dd className="font-semibold">{save.matchday || 'พรีซีซัน'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">นัดถัดไป</dt>
              <dd className="font-semibold">
                {opp ? (
                  <>
                    {opp.name}{' '}
                    <span className="text-xs font-normal text-slate-500">(AI)</span>
                    {nextFx ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        สภาพอากาศ{' '}
                        {WEATHER_LABEL[
                          nextFx.weather ??
                            pickWeather(fixtureWeatherSeed(nextFx.id, nextFx.matchday))
                        ]}
                      </span>
                    ) : null}
                    <Link
                      to="/match"
                      className="mt-1.5 inline-block text-xs font-bold text-sky-800 underline underline-offset-2"
                    >
                      เตรียมนัด →
                    </Link>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">ลีก</dt>
              <dd className="font-semibold">{save.leagueName ?? '—'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">โลกเกม</dt>
              <dd className="font-semibold">คุณ 1 · AI 19</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">ชีวิตนักเตะวันนี้</h2>
          <p className="mt-1 text-sm text-slate-600">
            สุ่มจากฐานข้อมูล ~50 กิจกรรม · น้ำหนักตาม professionalism / ambition / personality
            {dayLogs[0] ? ` · วันที่ ${dayLogs[0].date}` : ' · เล่นแมตช์เดย์เพื่อสร้างไดอารี่'}
            {missCount > 0 ? ` · มาซ้อมไม่ทัน ${missCount} คน` : ''}
          </p>
          {dayLogs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มีบันทึก — ผ่านแมตช์เดย์หนึ่งครั้ง</p>
          ) : (
            <ul className="mt-3 max-h-56 space-y-1 overflow-y-auto text-sm">
              {dayLogs.slice(0, 24).map((l) => (
                <li
                  key={l.id}
                  className={cn(
                    'flex justify-between gap-2 rounded-md px-2 py-1.5',
                    l.missTraining ? 'bg-rose-50 text-rose-950' : 'bg-slate-50',
                    l.subject === 'staff' && !l.missTraining && 'bg-amber-50/80',
                  )}
                >
                  <span className="truncate">
                    <span className="font-medium">{l.playerName}</span>
                    <span className="text-slate-500"> · {l.labelTh}</span>
                  </span>
                  <span className="shrink-0 text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                    {l.category}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">Dynamics</h2>
          <p className="mt-1 text-sm text-slate-600">{save.dynamics.lastNote}</p>
          <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">สามัคคี</dt>
              <dd className="text-lg font-bold">{save.dynamics.cohesion}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ลำดับชั้น</dt>
              <dd className="text-lg font-bold">{save.dynamics.hierarchyStability}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ห้องแต่งตัว</dt>
              <dd className="text-lg font-bold">{save.dynamics.dressingRoomMood}</dd>
            </div>
          </dl>
        </div>

        {talkPending.length > 0 ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-sky-950">นักเตะเรียกคุย</h2>
              <Link
                to="/meetings"
                className="text-xs font-semibold text-sky-800 underline underline-offset-2 hover:text-sky-950"
              >
                ตอบเลย →
              </Link>
            </div>
            <p className="mt-1 text-sm text-sky-900">
              มี {talkPending.length} คนรอคุยส่วนตัว — ความต้องการจากสถานะจริง (นาที·สัญญา·ย้าย·เจ็บ)
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">แขกสนาม / สเกาต์</h2>
            <Link
              to="/scouting"
              className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              เปิดศูนย์ →
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-600">
            ความรู้ตลาดเริ่ม 0% · อดีตลูกทีม 50% · ดูฟอร์มทีละนัดได้ที่ศูนย์สเกาต์
          </p>
          {lastVisit ? (
            <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <span className="font-semibold">{lastVisit.name}</span> · {lastVisit.report}
            </p>
          ) : (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มีแขก — เล่นนัดเหย้าเพื่อรับนักเตะ/โค้ช/คนดัง</p>
          )}
        </div>

        {conf?.pending ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-5">
            <h2 className="text-lg font-semibold text-amber-950">แถลงข่าวหลังเกม</h2>
            <p className="mt-1 text-sm text-amber-900">{conf.matchSummary}</p>
            <p className="mt-0.5 text-xs text-amber-800/80">
              คำถามสุ่มตามบริบทจริง (ผลแข่ง · เจ็บ · ตลาด · บอร์ด · อันดับ) จากพูล ~100+ แม่แบบ
            </p>
            <ul className="mt-3 space-y-3">
              {conf.questions.map((q) => (
                <li key={q.id} className="rounded-md border border-amber-100 bg-white/80 p-3">
                  <p className="text-sm font-medium text-slate-800">{q.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.answers.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setPressPicks((prev) => ({ ...prev, [q.id]: a.id }))}
                        className={cn(
                          'rounded border px-2 py-1 text-xs font-medium',
                          pressPicks[q.id] === a.id
                            ? 'border-slate-900 bg-slate-900 text-lime-300'
                            : 'border-slate-300 bg-white hover:bg-slate-50',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={conf.questions.some((q) => !pressPicks[q.id])}
                onClick={() => {
                  const ids = conf.questions.map((q) => pressPicks[q.id])
                  answerPress(ids)
                  setPressPicks({})
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-lime-300 disabled:opacity-40"
              >
                ส่งคำตอบ
              </button>
              <button
                type="button"
                onClick={() => {
                  skipPress()
                  setPressPicks({})
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                ข้าม (−1 reputation)
              </button>
            </div>
          </div>
        ) : null}

        {interview?.pending ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-5">
            <h2 className="text-lg font-semibold text-sky-950">สัมภาษณ์นักเตะ</h2>
            <p className="mt-1 text-sm text-sky-900">
              {interview.playerName} · {interview.blurb}
            </p>
            <ul className="mt-3 space-y-3">
              {interview.questions.map((q) => (
                <li key={q.id} className="rounded-md border border-sky-100 bg-white/80 p-3">
                  <p className="text-sm font-medium text-slate-800">{q.prompt}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {q.answers.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setIvPicks((prev) => ({ ...prev, [q.id]: a.id }))}
                        className={cn(
                          'rounded border px-2 py-1 text-xs font-medium',
                          ivPicks[q.id] === a.id
                            ? 'border-slate-900 bg-slate-900 text-lime-300'
                            : 'border-slate-300 bg-white hover:bg-slate-50',
                        )}
                      >
                        {a.label}
                      </button>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={interview.questions.some((q) => !ivPicks[q.id])}
                onClick={() => {
                  const ids = interview.questions.map((q) => ivPicks[q.id])
                  answerInterview(ids)
                  setIvPicks({})
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-lime-300 disabled:opacity-40"
              >
                ส่งคำตอบนักเตะ
              </button>
              <button
                type="button"
                onClick={() => {
                  skipInterview()
                  setIvPicks({})
                }}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
              >
                ข้ามสัมภาษณ์
              </button>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">
              สื่อ / ซุบซิบ
              {todayNews > 0 ? (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                  ใหม่ {todayNews}
                </span>
              ) : null}
            </h2>
            <Link
              to="/media"
              className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              เปิดฟีดเต็ม →
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ความเชื่อถือผู้จัดการ {save.managerReputation ?? 50}/100
          </p>
          <div className="mt-2 rounded-md border border-amber-100 bg-amber-50/70 px-3 py-2">
            <p className="text-[10px] font-bold tracking-wide text-amber-800 uppercase">ซุบซิบ</p>
            <p className="text-xs text-amber-900">{gossipLine(save)}</p>
          </div>
          <div className="mt-3">
            <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">พาดหัว</p>
            <ul className="mt-1 space-y-2">
              {newsPreview.length === 0 ? (
                <li className="text-sm text-slate-500">ยังไม่มีข่าว — เล่นแมตช์เดย์หรือดูหน้าสื่อ</li>
              ) : (
                newsPreview.map((story) => (
                  <li key={story.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                    <p className="text-sm font-medium">{story.headline}</p>
                    <p className="mt-1 text-xs text-slate-600">{story.body}</p>
                  </li>
                ))
              )}
            </ul>
          </div>
          {socialPreview.length > 0 ? (
            <div className="mt-3">
              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">โซเชียล</p>
              <ul className="mt-1 space-y-1.5">
                {socialPreview.map((s) => (
                  <li key={s.id} className="rounded-md bg-sky-50/80 px-2 py-1.5 text-xs text-slate-700">
                    <span className="font-semibold">{s.headline}</span>
                    <span className="text-slate-500"> — {s.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">บอร์ดสโมสร</h2>
            <Link
              to="/club-vision"
              className="text-xs font-semibold text-slate-600 underline underline-offset-2 hover:text-slate-900"
            >
              Club Vision →
            </Link>
          </div>
          <p className="mt-1 text-sm text-slate-600">{board.lastNote}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                ความมั่นใจ · {boardLabel(board.confidence)} ({board.confidence}/100)
              </span>
              <span>
                อันดับ #{rank || '—'} / เป้าท็อป {board.targetMaxRank}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-violet-500 transition-all"
                style={{ width: `${board.confidence}%` }}
              />
            </div>
          </div>
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {board.kpis?.map((k) => (
              <li key={k.id}>
                {k.met ? '✓' : '·'} {k.label}
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">แฟนบอล</h2>
          <p className="mt-1 text-sm text-slate-600">{fans.lastVerdict}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                ความพอใจ · {fanMoodLabel(fans.mood)} ({fans.mood}/100)
              </span>
              <span>
                ตั๋วเหย้า {ticketBoost >= 0 ? '+' : ''}
                {ticketBoost}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${fans.mood}%` }}
              />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">หัวรุนแรง</dt>
              <dd className="text-lg font-bold">{fans.factions.ultras}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ซอฟต์</dt>
              <dd className="text-lg font-bold">{fans.factions.soft}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ทั่วไป</dt>
              <dd className="text-lg font-bold">{fans.factions.casual}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">คอร์ป</dt>
              <dd className="text-lg font-bold">{fans.factions.corporate}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ต่างชาติ</dt>
              <dd className="text-lg font-bold">{fans.factions.international}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            ความคาดหวัง {fans.expectation}/100 · ความจงรัก {fans.loyalty}/100 ·
            ขายดาวตอนแฟนโกรธอาจถูกบอร์ดบล็อก
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">กล่องข้อความ</h2>
          <ul className="mt-3 space-y-2">
            {save.inbox.length === 0 ? (
              <li className="text-sm text-slate-500">ยังไม่มีข้อความ</li>
            ) : (
              save.inbox.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => markInboxRead(msg.id)}
                    className="w-full rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium ${msg.read ? 'text-slate-500' : 'text-slate-900'}`}
                      >
                        {msg.title}
                      </span>
                      <span className="text-xs text-slate-400">{msg.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{msg.body}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">สรุปตารางลีก</h2>
        <p className="mt-1 text-xs text-slate-500">ตารางเดียวกัน — ผล AI นับด้วย</p>
        <ol className="mt-3 space-y-1.5 text-sm">
          {top5.map((row, i) => {
            const c = save.clubs.find((x) => x.id === row.clubId)!
            const you = c.id === save.humanClubId
            return (
              <li
                key={row.clubId}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 ${you ? 'bg-sky-50 ring-1 ring-sky-200' : ''}`}
              >
                <span>
                  {i + 1}. {c.shortName}{' '}
                  {you ? (
                    <span className="text-xs text-sky-700">คุณ</span>
                  ) : (
                    <span className="text-xs text-slate-400">AI</span>
                  )}
                </span>
                <span className="font-semibold">{row.points} แต้ม</span>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
