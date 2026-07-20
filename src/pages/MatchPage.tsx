import { useNavigate, Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { getReferee, pickRefereeId, reputationLabel, strictnessLabel } from '@/game/referees'
import { fixtureWeatherSeed, pickWeather, WEATHER_LABEL } from '@/game/weather'
import { MatchStatsPanel } from '@/components/MatchStatsPanel'
import { GhostButton, PageHeader, Panel, PrimaryButton, StatTile } from '@/components/ui'
import { ensureScouting, formWatchCost } from '@/game/scouting'
import { formatMoney } from '@/lib/format'
import { PlayerFace } from '@/components/PlayerFace'
import {
  enrichOppositionBrief,
  humanMatchAbsentees,
  nextHumanFixture,
  predictedStartingXi,
  preMatchChecklist,
  TEAM_TALK_OPTIONS,
} from '@/game/preMatch'
import { ensurePhase5 } from '@/game/save'
import { formationLabel } from '@/game/types'
import { cn } from '@/lib/cn'
import {
  isTransferDeadlineActive,
  shouldEnterTransferDeadline,
  transferDeadlineLabel,
} from '@/game/transferDeadline'
import { transferWindowLabel } from '@/game/transferWindow'
import { canAdvanceDay, dayAdvanceBlockMessage } from '@/game/advanceGates'

function FormPills({ form }: { form: Array<'W' | 'D' | 'L'> }) {
  if (form.length === 0) return <span className="text-xs text-slate-500">ยังไม่มีผล</span>
  return (
    <span className="inline-flex gap-1">
      {form.map((r, i) => (
        <span
          key={`${r}-${i}`}
          className={cn(
            'inline-flex h-6 w-6 items-center justify-center rounded text-[11px] font-bold',
            r === 'W' && 'bg-lime-200 text-lime-900',
            r === 'D' && 'bg-slate-200 text-slate-700',
            r === 'L' && 'bg-rose-200 text-rose-900',
          )}
        >
          {r}
        </span>
      ))}
    </span>
  )
}

export function MatchPage() {
  const navigate = useNavigate()
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const startLiveMatch = useGameStore((s) => s.startLiveMatch)
  const playNextMatchday = useGameStore((s) => s.playNextMatchday)
  const advanceDay = useGameStore((s) => s.advanceDay)
  const confirmPreMatchLineup = useGameStore((s) => s.confirmPreMatchLineup)
  const choosePreMatchTalk = useGameStore((s) => s.choosePreMatchTalk)
  const assignScoutWatch = useGameStore((s) => s.assignScoutWatch)

  const next = nextHumanFixture(save)
  const humanFixtures = save.fixtures.filter(
    (f) => f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId,
  )
  const recent = humanFixtures.filter((f) => f.played).slice(-8).reverse()
  const last = save.lastHumanResult
  const scouting = ensureScouting(save)
  const watchCost = formWatchCost(save)
  const alreadyWatchingNext =
    !!next && scouting.pendingWatches.some((w) => w.status === 'pending' && w.fixtureId === next.id)

  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id
  const tag = (id: string) => (id === save.humanClubId ? 'คุณ' : 'AI')

  const dayFixtures =
    next != null ? save.fixtures.filter((f) => f.matchday === next.matchday) : []

  const oppId = next
    ? next.homeClubId === save.humanClubId
      ? next.awayClubId
      : next.homeClubId
    : null
  const brief = oppId ? enrichOppositionBrief(save, oppId) : null
  const absentees = humanMatchAbsentees(save)
  const check = preMatchChecklist(save)
  const tactics = save.tacticsByClub[save.humanClubId]
  const setPieces = tactics?.setPieces
  const ourXi = predictedStartingXi(save, save.humanClubId)
  const ourBench = (tactics?.bench ?? [])
    .map((id) => save.players.find((p) => p.id === id))
    .filter(Boolean) as typeof ourXi

  const nextRef = next
    ? getReferee(next.refereeId ?? pickRefereeId(next.id, next.competition ?? 'league'))
    : null
  const nextWeather = next
    ? (next.weather ?? pickWeather(fixtureWeatherSeed(next.id, next.matchday)))
    : null

  const lastFx = last ? save.fixtures.find((f) => f.id === last.fixtureId) : null

  const enterLive = (force = false) => {
    if (startLiveMatch({ force })) navigate('/match/live')
  }

  const compLabel =
    next?.competition === 'ucl'
      ? 'UCL'
      : next?.competition === 'cup'
        ? 'ถ้วยชาติ'
        : next?.competition === 'league_cup'
          ? 'ลีกคัพ'
          : next?.competition === 'trophy'
            ? 'ถ้วยลีกล่าง'
            : 'ลีก'

  return (
    <div className="space-y-5">
      <PageHeader
        title="พรีแมตช์ · ศูนย์แมตช์"
        subtitle="เดิน 1 วัน = เหตุการณ์แม้ไม่มีนัด · เล่นแมตช์เดย์ = แข่งชุดนัดตามตาราง"
      />

      {!isTransferDeadlineActive(save) && !shouldEnterTransferDeadline(save) && !save.seasonComplete ? (
        <Panel>
          <p className="text-xs text-slate-500">
            วันนี้ในเกม <strong className="text-slate-800">{save.currentDate}</strong>
            {' · '}ลีก/ถ้วยเตะคนละวันได้ — วันว่างก็มีฟื้นตัว·ไลฟ์สไตล์·ข่าว
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton
              disabled={!canAdvanceDay(save)}
              title={dayAdvanceBlockMessage(save) ?? undefined}
              onClick={() => advanceDay()}
            >
              เดิน 1 วัน
            </PrimaryButton>
            <GhostButton onClick={() => playNextMatchday({ force: true })}>
              เล่นแมตช์เดย์ถัดไป
            </GhostButton>
            {!canAdvanceDay(save) ? (
              <p className="w-full text-xs text-amber-800">{dayAdvanceBlockMessage(save)}</p>
            ) : null}
          </div>
        </Panel>
      ) : null}

      {isTransferDeadlineActive(save) || shouldEnterTransferDeadline(save) ? (
        <Panel className="border-amber-300 bg-amber-50">
          <p className="text-[11px] font-bold tracking-wider text-amber-800 uppercase">
            โหมดปิดตลาด · นับชั่วโมง
          </p>
          <p className="mt-2 text-lg font-bold text-slate-900">
            {isTransferDeadlineActive(save)
              ? transferDeadlineLabel(save)
              : 'ถึงช่วง 3 วันสุดท้าย — กดถัดไปเพื่อเริ่มนับ 72 ชม.'}
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {transferWindowLabel(save)} · กดถัดไป = เดินหน้า 1 ชั่วโมง · ตลาดชุกชุม มีข้อเสนอ/ข่าวถี่
          </p>
          {save.transferDeadline?.log?.[0] ? (
            <p className="mt-2 rounded-md bg-white/80 px-3 py-2 text-xs text-slate-700">
              ล่าสุด: {save.transferDeadline.log[0].title} — {save.transferDeadline.log[0].body}
            </p>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <PrimaryButton onClick={() => playNextMatchday({ force: true })}>
              {isTransferDeadlineActive(save) ? '+1 ชั่วโมง' : 'เริ่มโหมดปิดตลาด'}
            </PrimaryButton>
            <Link
              to="/transfers"
              className="rounded-md border border-amber-400 bg-white px-3 py-2 text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              ไปตลาดซื้อขาย
            </Link>
          </div>
          {isTransferDeadlineActive(save) && (save.transferDeadline?.log?.length ?? 0) > 1 ? (
            <ul className="mt-3 max-h-40 space-y-1 overflow-y-auto text-xs text-slate-600">
              {save.transferDeadline!.log.slice(0, 8).map((l) => (
                <li key={l.id}>
                  <span className="font-semibold text-slate-800">{l.title}</span> · {l.body}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      {!next ? (
        <Panel tone="dark">
          <p className="text-slate-300">ไม่มีนัดเหลือสำหรับทีมคุณ</p>
          <div className="mt-3">
            {!save.seasonComplete ? (
              <PrimaryButton onClick={() => playNextMatchday({ force: true })}>
                จำลองแมตช์เดย์ AI
              </PrimaryButton>
            ) : !save.board?.sacked ? (
              <PrimaryButton onClick={() => useGameStore.getState().startNewSeason()}>
                เริ่มฤดูกาล {save.season + 1}
              </PrimaryButton>
            ) : null}
          </div>
        </Panel>
      ) : (
        <>
          <Panel tone="dark">
            <p className="text-[11px] font-bold tracking-[0.18em] text-lime-300/80 uppercase">
              นัดถัดไป · {compLabel}
            </p>
            <p className="mt-3 text-2xl font-bold tracking-tight md:text-3xl">
              {nameOf(next.homeClubId)}{' '}
              <span className="text-sm font-normal text-slate-400">({tag(next.homeClubId)})</span>
              <span className="mx-2 text-slate-500">พบ</span>
              {nameOf(next.awayClubId)}{' '}
              <span className="text-sm font-normal text-slate-400">({tag(next.awayClubId)})</span>
            </p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <StatTile label="แมตช์เดย์" value={next.matchday} />
              <StatTile label="วันที่" value={next.date} />
              <StatTile
                label="วันเดียวกัน"
                value={`${dayFixtures.length} นัด`}
                hint="นัดคุณ + AI"
              />
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-sm">
              {nextWeather ? (
                <span className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                  อากาศ <strong>{WEATHER_LABEL[nextWeather]}</strong>
                </span>
              ) : null}
              {nextRef ? (
                <span className="rounded-md border border-slate-700 bg-slate-800/80 px-3 py-1.5">
                  เป่า <strong>{nextRef.name}</strong> · {reputationLabel(nextRef.reputation)} ·{' '}
                  {strictnessLabel(nextRef.strictness)}
                </span>
              ) : null}
            </div>
          </Panel>

          <Panel className="border-lime-300 bg-lime-50/60">
            <h3 className="text-sm font-bold text-slate-900">ขึ้นสนาม</h3>
            <p className="mt-1 text-xs text-slate-600">
              ยืนยัน XI + ทีมทอล์คอยู่ตรงนี้ · ตะโกนสั่งใช้บนหน้าแมตช์สด (ข้างสนาม)
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => confirmPreMatchLineup()}>
                {check.prep?.lineupConfirmed
                  ? '✓ ยืนยัน XI แล้ว'
                  : 'ยืนยัน XI + ตัวสำรอง'}
              </PrimaryButton>
              <Link to="/tactics" className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50">
                แก้แท็กติก
              </Link>
            </div>
            <p className="mt-4 text-xs font-semibold tracking-wide text-slate-500 uppercase">
              ทีมทอล์คห้องแต่งตัว
            </p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {TEAM_TALK_OPTIONS.map((opt) => {
                const active = check.prep?.talkKind === opt.id
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => choosePreMatchTalk(opt.id)}
                    className={cn(
                      'rounded-lg border px-3 py-2.5 text-left transition',
                      active
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : 'border-slate-200 bg-white hover:border-slate-400',
                    )}
                  >
                    <p className="text-sm font-semibold">{opt.label}</p>
                    <p className={cn('mt-0.5 text-xs', active ? 'text-slate-300' : 'text-slate-500')}>
                      {opt.blurb}
                    </p>
                  </button>
                )
              })}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => enterLive(false)} disabled={!check.ready}>
                เข้าแมตช์สด · สนาม
              </PrimaryButton>
              <GhostButton
                disabled={!check.ready}
                onClick={() => playNextMatchday()}
              >
                ผลทันที
              </GhostButton>
              <GhostButton onClick={() => enterLive(true)}>
                เตะแบบรีบ
              </GhostButton>
            </div>
            {!check.ready ? (
              <p className="mt-2 text-xs text-amber-800">
                ยังไม่ครบ: ยืนยัน XI + เลือกทีมทอล์ค (หรือเตะแบบรีบ)
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium text-lime-800">
                พร้อม · ตะโกนสั่งได้หลังเข้าแมตช์สดใต้สนาม
              </p>
            )}
          </Panel>

          <Panel>
            <h3 className="text-sm font-bold text-slate-900">เช็คลิสต์ก่อนเตะ</h3>
            <ul className="mt-3 space-y-2">
              {check.steps.map((s) => (
                <li
                  key={s.id}
                  className={cn(
                    'flex items-start justify-between gap-3 rounded-lg px-3 py-2 text-sm',
                    s.done ? 'bg-lime-50 text-lime-950' : 'bg-amber-50 text-amber-950',
                  )}
                >
                  <span>
                    <span className="font-semibold">{s.done ? '✓' : '○'}</span> {s.label}
                    {s.detail ? (
                      <span className="mt-0.5 block text-xs opacity-80">{s.detail}</span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
            {!check.ready ? (
              <p className="mt-2 text-xs text-slate-500">
                ทำครบแล้วปุ่มเขียวจะพร้อม — หรือเตะแบบรีบได้แต่ไม่มีโบนัสทีมทอล์ค
              </p>
            ) : (
              <p className="mt-2 text-xs font-medium text-lime-800">พร้อมขึ้นสนาม</p>
            )}
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">รายงานคู่แข่ง</h3>
                {brief ? <FormPills form={brief.form} /> : null}
              </div>
              {brief ? (
                <div className="mt-3 space-y-2 text-sm">
                  <p>
                    รูป {formationLabel(brief.formation, true)} · ความแข็งแกร่ง XI ~{brief.strength}
                  </p>
                  <p>
                    <span className="text-slate-500">จุดอ่อน:</span> {brief.weakness}
                  </p>
                  <p>
                    <span className="text-slate-500">ภัยคุกคาม:</span>{' '}
                    {brief.threatPlayers.join(' · ')}
                  </p>
                  <p className="text-lime-900">{brief.advice}</p>
                  <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase">XI คาดการณ์</p>
                    <ul className="mt-1.5 grid grid-cols-1 gap-0.5 sm:grid-cols-2">
                      {brief.predictedXi.map((p) => (
                        <li key={p.id} className="flex items-center gap-1.5 text-xs">
                          <PlayerFace name={p.name} size="xs" />
                          <span>
                            <span className="text-slate-400">{p.role}</span> {p.name}{' '}
                            <span className="tabular-nums text-slate-500">{p.overall}</span>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <span className="text-xs text-slate-500">ฟอร์มคุณ</span>
                    <FormPills form={brief.ourForm} />
                    <Link to="/data" className="text-xs font-semibold text-sky-800 underline">
                      Data Hub
                    </Link>
                  </div>
                </div>
              ) : null}
            </Panel>

            <Panel>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">XI + ตัวสำรอง</h3>
                <Link to="/tactics" className="text-xs font-semibold text-sky-800 underline">
                  แก้แท็กติก
                </Link>
              </div>
              <ul className="mt-3 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ourXi.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-1.5 rounded bg-slate-50 px-2 py-1 text-xs"
                  >
                    <PlayerFace name={p.name} size="xs" />
                    <span>
                      <span className="text-slate-400">{p.role}</span> {p.name}{' '}
                      <span className="tabular-nums text-slate-500">
                        {p.overall} · C{p.condition}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs font-semibold text-slate-500 uppercase">
                ม้านั่ง ({ourBench.length})
              </p>
              <ul className="mt-1 grid grid-cols-1 gap-1 sm:grid-cols-2">
                {ourBench.map((p) => (
                  <li key={p.id} className="flex items-center gap-1.5 rounded bg-amber-50/80 px-2 py-1 text-xs">
                    <PlayerFace name={p.name} size="xs" />
                    <span>
                      <span className="text-amber-800/80">{p.role}</span> {p.name}{' '}
                      <span className="tabular-nums text-slate-500">{p.overall}</span>
                    </span>
                  </li>
                ))}
              </ul>
              {(absentees.injured.length > 0 ||
                absentees.banned.length > 0 ||
                absentees.other.length > 0) && (
                <p className="mt-2 text-xs text-rose-800">
                  ขาด:{' '}
                  {[
                    ...absentees.injured.map((p) => `${p.name}(เจ็บ)`),
                    ...absentees.banned.map((p) => `${p.name}(แบน)`),
                    ...absentees.other.map((p) => `${p.name}(ลา)`),
                  ].join(' · ') || '—'}
                </p>
              )}
              {setPieces ? (
                <p className="mt-2 text-xs text-slate-600">
                  ลูกตั้งเตะ: มุม {setPieces.corners} · FK {setPieces.freeKicks}
                </p>
              ) : null}
            </Panel>
          </div>

          <Panel tone="dark">
            <p className="text-xs text-slate-400">
              ตะโกนริมเส้นอยู่บนหน้าแมตช์สดใต้สนาม — ไม่ต้องตั้งคิวก่อนเตะ
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <PrimaryButton onClick={() => enterLive(false)} disabled={!check.ready}>
                เข้าแมตช์สด · สนาม
              </PrimaryButton>
              <GhostButton
                className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                disabled={!check.ready}
                onClick={() => playNextMatchday()}
              >
                ผลทันที
              </GhostButton>
              <GhostButton
                className="border-amber-600/50 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50"
                disabled={alreadyWatchingNext}
                onClick={() => {
                  if (!next || !oppId) return
                  const targets = save.players
                    .filter((p) => p.clubId === oppId)
                    .sort((a, b) => b.overall - a.overall)
                    .slice(0, 2)
                    .map((p) => p.id)
                  assignScoutWatch(next.id, targets)
                }}
              >
                {alreadyWatchingNext
                  ? 'สเกาต์ดูนัดนี้แล้ว'
                  : `ดูฟอร์มคู่แข่ง · ${formatMoney(watchCost)}`}
              </GhostButton>
              <Link
                to="/scouting"
                className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
              >
                ศูนย์สเกาต์
              </Link>
            </div>
          </Panel>
        </>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        {last && lastFx ? (
          <>
            <MatchStatsPanel
              result={last}
              homeName={nameOf(lastFx.homeClubId)}
              awayName={nameOf(lastFx.awayClubId)}
            />
            {last.breakdown ? (
              <Panel>
                <h3 className="text-sm font-bold text-slate-900">วิเคราะห์พื้นที่</h3>
                <p className="mt-1 text-xs text-slate-500">
                  {formationLabel(last.breakdown.homeFormation, true)} vs{' '}
                  {formationLabel(last.breakdown.awayFormation, true)}
                </p>
                <ul className="mt-2 space-y-1 text-xs text-slate-700">
                  {last.breakdown.lines.map((l, i) => (
                    <li key={i}>{l}</li>
                  ))}
                  {last.breakdown.freePlayerNotes.slice(0, 2).map((l, i) => (
                    <li key={`f${i}`}>· {l}</li>
                  ))}
                  {last.breakdown.overloadNotes.slice(0, 2).map((l, i) => (
                    <li key={`o${i}`}>· {l}</li>
                  ))}
                </ul>
              </Panel>
            ) : null}
          </>
        ) : (
          <Panel>
            <p className="text-sm text-slate-500">ยังไม่มีสถิติแมตช์ล่าสุด</p>
          </Panel>
        )}
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ผลล่าสุด</h3>
          <ul className="mt-3 space-y-1.5 text-sm">
            {recent.length === 0 ? (
              <li className="text-slate-500">ยังไม่เคยลงแข่ง</li>
            ) : (
              recent.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                >
                  <span className="truncate pr-2">
                    {nameOf(f.homeClubId)} พบ {nameOf(f.awayClubId)}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums">
                    {f.homeGoals}–{f.awayGoals}
                  </span>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>
    </div>
  )
}
