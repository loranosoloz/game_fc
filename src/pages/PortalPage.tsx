import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { formatMoney } from '@/lib/format'
import { ensureFans, fanMoodLabel } from '@/game/fans'
import { boardLabel } from '@/game/board'
import { ensurePhase5 } from '@/game/save'
import { ensureMediaFeed, gossipLine, countTodaysNews } from '@/game/media'
import { pendingTalkRequests } from '@/game/playerTalks'
import { fixtureWeatherSeed, pickWeather, WEATHER_LABEL } from '@/game/weather'
import { reportKindLabelTh } from '@/game/matchdayReport'
import {
  NT_CAMP_FOCUS_LABEL,
  type NtCampFocus,
} from '@/game/ntCamp'
import { playerNationality } from '@/game/nationalTeams'
import { cn } from '@/lib/cn'
import { isPreSeasonBlocking } from '@/game/preSeason'
import { LeagueTableMini } from '@/components/LeagueTableMini'
import { PlayerFace } from '@/components/PlayerFace'

export function PortalPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(ensureFans(saveRaw))
  const markInboxRead = useGameStore((s) => s.markInboxRead)
  const answerPress = useGameStore((s) => s.answerPressConference)
  const answerInterview = useGameStore((s) => s.answerPlayerInterview)
  const startNewSeason = useGameStore((s) => s.startNewSeason)
  const dismissReport = useGameStore((s) => s.dismissMatchdayReport)
  const setCampFocus = useGameStore((s) => s.setNtCampFocus)
  const toggleCampPlayer = useGameStore((s) => s.toggleNtCampPlayer)
  const confirmCamp = useGameStore((s) => s.confirmNtCamp)

  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const fans = save.fans
  const board = save.board
  const media = ensureMediaFeed(save)
  const todayNews = countTodaysNews(save)
  const newsFeed = media.news.slice(0, 14)
  const socialFeed = media.social.slice(0, 5)
  const conf = save.pressConference
  const interview = save.playerInterview
  const intlBreak = save.internationalBreak
  const report = save.lastMatchdayReport
  const ntCamp = save.ntCamp
  const talkPending = pendingTalkRequests(save)
  const table = sortedTable(save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1

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

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.9fr)]">
      <section className="space-y-4">
        {/* —— แจ้งเตือนสำคัญเท่านั้น —— */}
        {isPreSeasonBlocking(save) ? (
          <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3">
            <p className="font-semibold text-amber-950">
              {save.preSeason?.phase === 'choosing'
                ? 'บังคับ · เลือกปรีซีซั่นก่อนเดินวัน'
                : 'บังคับ · เล่นนัดอุ่นปรีซีซั่นให้จบ'}
            </p>
            <p className="mt-0.5 text-sm text-amber-900">
              {save.preSeason?.note ?? 'เลือกทัวร์หรือข้ามทัวร์ก่อนเปิดฤดูกาล — เดินวัน/พักร้อนจะถูกบล็อก'}
            </p>
            <Link
              to="/preseason"
              className="mt-2 inline-block text-sm font-bold text-amber-950 underline"
            >
              เปิดหน้าปรีซีซั่น →
            </Link>
          </div>
        ) : null}

        {save.board?.sacked || (save.career?.unemployed && !save.career?.nationalNation) ? (
          <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3">
            <p className="font-semibold text-rose-950">ว่างงาน · ตลาดงาน</p>
            <Link to="/club-vision" className="mt-1 inline-block text-sm font-bold underline">
              เปิดตลาดงาน →
            </Link>
          </div>
        ) : null}

        {save.seasonComplete && !save.board?.sacked ? (
          <div className="rounded-xl border border-lime-300 bg-lime-50 px-4 py-3">
            <p className="font-semibold text-lime-950">จบฤดูกาล {save.season}</p>
            <p className="text-sm text-lime-900">อันดับลีก #{rank || '—'}</p>
            <button
              type="button"
              onClick={() => startNewSeason()}
              className="mt-2 rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-lime-300"
            >
              เริ่มฤดูกาล {save.season + 1}
            </button>
          </div>
        ) : null}

        {report && report.lines.length > 0 ? (
          <div className="rounded-xl border border-sky-300 bg-sky-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-sky-950">
                  สรุปแมตช์เดย์ {report.matchday}
                  {report.season ? ` · S${report.season}` : ''}
                </h2>
                <p className="text-xs text-sky-800">{report.date}</p>
              </div>
              <button
                type="button"
                onClick={() => dismissReport()}
                className="text-xs font-semibold text-sky-900 underline"
              >
                ปิด
              </button>
            </div>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-sky-950">
              {report.lines.slice(0, 12).map((line, i) => (
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

        {talkPending.length > 0 ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3">
            <p className="font-semibold text-sky-950">
              นักเตะเรียกคุย {talkPending.length} คน
            </p>
            <Link to="/meetings" className="mt-1 inline-block text-sm font-bold underline">
              ตอบเลย →
            </Link>
          </div>
        ) : null}

        {intlBreak && intlBreak.weeksLeft > 0 ? (
          <div className="rounded-xl border border-indigo-300 bg-indigo-50 p-4">
            <h2 className="font-semibold text-indigo-950">พักเบรกทีมชาติ</h2>
            <p className="mt-1 text-sm text-indigo-900">
              {intlBreak.label} · เหลือ {intlBreak.weeksLeft}/{intlBreak.totalWeeks} สัปดาห์
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
                  <>
                    <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs">
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
                                  'flex w-full items-center gap-2 rounded px-2 py-1 text-left',
                                  on ? 'bg-indigo-200 font-semibold' : 'hover:bg-indigo-50',
                                )}
                              >
                                <PlayerFace name={p.name} size="xs" />
                                <span>
                                  {on ? '✓ ' : '○ '}
                                  {p.name} · {p.overall}
                                </span>
                              </button>
                            </li>
                          )
                        })}
                    </ul>
                    <button
                      type="button"
                      onClick={() => confirmCamp()}
                      className="mt-3 rounded-md bg-indigo-900 px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      ยืนยันโผแคมป์
                    </button>
                  </>
                ) : (
                  <p className="mt-2 text-xs text-indigo-900">
                    โผยืนยันแล้ว {ntCamp.selectedIds.length} คน
                  </p>
                )}
              </div>
            ) : null}
          </div>
        ) : null}

        {conf?.pending ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50/90 p-4">
            <h2 className="font-semibold text-amber-950">แถลงข่าวหลังเกม</h2>
            <p className="mt-1 text-sm text-amber-900">{conf.matchSummary}</p>
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
                  answerPress(conf.questions.map((q) => pressPicks[q.id]))
                  setPressPicks({})
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-lime-300 disabled:opacity-40"
              >
                ส่งคำตอบ
              </button>
              <p className="w-full text-xs text-amber-800">
                ต้องตอบครบก่อนจึงจะเดินวันถัดไปได้
              </p>
            </div>
          </div>
        ) : null}

        {interview?.pending ? (
          <div className="rounded-xl border border-sky-200 bg-sky-50/90 p-4">
            <h2 className="font-semibold text-sky-950">สัมภาษณ์นักเตะ</h2>
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
                  answerInterview(interview.questions.map((q) => ivPicks[q.id]))
                  setIvPicks({})
                }}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-semibold text-lime-300 disabled:opacity-40"
              >
                ส่งคำตอบ
              </button>
              <p className="w-full text-xs text-sky-800">
                ต้องตอบครบก่อนจึงจะเดินวันถัดไปได้
              </p>
            </div>
          </div>
        ) : null}

        {/* —— ฟีดหลัก: ข่าว / อัปเดต —— */}
        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-xl font-bold text-slate-900">
              อัปเดตวันนี้
              {todayNews > 0 ? (
                <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-800">
                  ใหม่ {todayNews}
                </span>
              ) : null}
            </h2>
            <Link
              to="/media"
              className="text-xs font-semibold text-sky-800 underline underline-offset-2"
            >
              ฟีดเต็ม →
            </Link>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            ข่าว · ซุบซิบ · ความเชื่อถือผู้จัดการ {save.managerReputation ?? 50}/100
          </p>

          <div className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2.5">
            <p className="text-[10px] font-bold tracking-wide text-amber-800 uppercase">ซุบซิบ</p>
            <p className="mt-0.5 text-sm text-amber-950">{gossipLine(save)}</p>
          </div>

          <ul className="mt-4 space-y-3">
            {newsFeed.length === 0 ? (
              <li className="rounded-lg bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
                ยังไม่มีข่าว — เดินเวลาหรือเล่นแมตช์เดย์เพื่อให้อัปเดตไหลเข้ามา
              </li>
            ) : (
              newsFeed.map((story) => (
                <li
                  key={story.id}
                  className="rounded-lg border border-slate-100 bg-slate-50/80 px-4 py-3"
                >
                  <p className="text-base font-semibold text-slate-900">{story.headline}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{story.body}</p>
                  <p className="mt-2 text-[11px] text-slate-400">{story.date}</p>
                </li>
              ))
            )}
          </ul>

          {socialFeed.length > 0 ? (
            <div className="mt-5 border-t border-slate-100 pt-4">
              <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                โซเชียล
              </p>
              <ul className="mt-2 space-y-2">
                {socialFeed.map((s) => (
                  <li
                    key={s.id}
                    className="rounded-md bg-sky-50/90 px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="font-semibold">{s.headline}</span>
                    <span className="text-slate-500"> — {s.body}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-semibold text-slate-900">กล่องข้อความ</h2>
          <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
            {save.inbox.length === 0 ? (
              <li className="text-sm text-slate-500">ยังไม่มีข้อความ</li>
            ) : (
              save.inbox.slice(0, 16).map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => markInboxRead(msg.id)}
                    className="w-full rounded-md border border-slate-100 bg-slate-50 px-3 py-2.5 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={cn(
                          'text-sm font-medium',
                          msg.read ? 'text-slate-500' : 'text-slate-900',
                        )}
                      >
                        {!msg.read ? '● ' : ''}
                        {msg.title}
                      </span>
                      <span className="shrink-0 text-xs text-slate-400">{msg.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{msg.body}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="text-sm font-bold text-slate-900">ชีพจรคลับ</h3>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
            <div>
              <dt className="text-xs text-slate-500">บัญชี</dt>
              <dd className="font-semibold tabular-nums">{formatMoney(club.balance)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">อันดับ</dt>
              <dd className="font-semibold">#{rank || '—'}</dd>
            </div>
            <div className="col-span-2">
              <dt className="text-xs text-slate-500">นัดถัดไป</dt>
              <dd className="font-semibold">
                {opp ? (
                  <>
                    {opp.shortName || opp.name}
                    {nextFx ? (
                      <span className="mt-0.5 block text-xs font-normal text-slate-500">
                        MD{nextFx.matchday} · {nextFx.date} ·{' '}
                        {
                          WEATHER_LABEL[
                            nextFx.weather ??
                              pickWeather(fixtureWeatherSeed(nextFx.id, nextFx.matchday))
                          ]
                        }
                      </span>
                    ) : null}
                    <Link
                      to="/match"
                      className="mt-1 inline-block text-xs font-bold text-sky-800 underline"
                    >
                      เตรียมนัด →
                    </Link>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
          </dl>
          <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3 text-xs">
            <Link to="/calendar" className="font-semibold text-sky-800 underline">
              ปฏิทินฤดูกาล →
            </Link>
            <Link to="/table" className="font-semibold text-sky-800 underline">
              ตารางเต็ม →
            </Link>
            <Link to="/media" className="font-semibold text-sky-800 underline">
              สื่อ →
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <LeagueTableMini save={save} limit={5} />
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-2 flex justify-between text-xs text-slate-500">
            <span>
              บอร์ด · {boardLabel(board.confidence)} ({board.confidence}/100)
            </span>
            <Link to="/club-vision" className="font-semibold text-sky-800 underline">
              รายละเอียด
            </Link>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-violet-500"
              style={{ width: `${board.confidence}%` }}
            />
          </div>
          <div className="mt-3 mb-1 flex justify-between text-xs text-slate-500">
            <span>
              แฟน · {fanMoodLabel(fans.mood)} ({fans.mood}/100)
            </span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-sky-500"
              style={{ width: `${fans.mood}%` }}
            />
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-slate-500">
            {board.lastNote || fans.lastVerdict}
          </p>
        </div>
      </aside>
    </div>
  )
}
