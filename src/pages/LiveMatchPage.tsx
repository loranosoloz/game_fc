import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MatchPitch } from '@/components/MatchPitch'
import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'
import type {
  FormationId,
  MatchEventKind,
  Mentality,
  Pressing,
  TeamTalkKind,
} from '@/game/types'
import {
  ALL_FORMATIONS,
  FORMATION_LABEL_TH,
  formationLabel,
} from '@/game/types'
import { buildPitchPlayers, withActionOffset } from '@/game/pitchLayout'
import { getReferee, homeBiasLabel, reputationLabel, strictnessLabel } from '@/game/referees'
import { MatchStatsPanel } from '@/components/MatchStatsPanel'
import { TEAM_TALK_OPTIONS, TOUCHLINE_SHOUT_OPTIONS } from '@/game/preMatch'
import { halfTimeScoreLine, type HalfTimeAdjustments, type HalfTimeSub } from '@/game/match/halfTime'
import type { TouchlineShout } from '@/game/match/touchlineShouts'

const SPEED_MS: Record<'slow' | 'normal' | 'fast', number> = {
  slow: 1400,
  normal: 700,
  fast: 280,
}

function kindTone(kind: MatchEventKind, cardColor?: 'yellow' | 'red') {
  switch (kind) {
    case 'goal':
      return 'border-lime-400 bg-lime-100 text-lime-950'
    case 'shot':
    case 'chance':
      return 'border-amber-300 bg-amber-50 text-amber-950'
    case 'save':
      return 'border-sky-300 bg-sky-50 text-sky-950'
    case 'card':
      return cardColor === 'red'
        ? 'border-red-500 bg-red-100 text-red-950'
        : 'border-yellow-400 bg-yellow-50 text-yellow-950'
    case 'penalty':
      return 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950'
    case 'var':
      return 'border-violet-400 bg-violet-50 text-violet-950'
    case 'foul':
      return 'border-orange-300 bg-orange-50 text-orange-950'
    case 'corner':
      return 'border-cyan-400 bg-cyan-50 text-cyan-950'
    case 'substitution':
      return 'border-blue-400 bg-blue-50 text-blue-950'
    case 'tactical_window':
      return 'border-orange-400 bg-orange-50 text-orange-950'
    case 'extratime':
      return 'border-rose-400 bg-rose-50 text-rose-950'
    case 'shootout':
      return 'border-pink-500 bg-pink-50 text-pink-950'
    case 'stoppage':
      return 'border-teal-400 bg-teal-50 text-teal-950'
    case 'secondhalf':
      return 'border-emerald-400 bg-emerald-50 text-emerald-950'
    case 'fulltime':
    case 'halftime':
      return 'border-slate-400 bg-slate-100 text-slate-900'
    default:
      return 'border-slate-200 bg-white text-slate-800'
  }
}

export function LiveMatchPage() {
  const navigate = useNavigate()
  const save = useGameStore((s) => s.save)
  const live = useGameStore((s) => s.liveMatch)
  const finishLiveMatch = useGameStore((s) => s.finishLiveMatch)
  const abortLiveMatch = useGameStore((s) => s.abortLiveMatch)
  const continueHalfTime = useGameStore((s) => s.continueHalfTime)
  const queueLiveSub = useGameStore((s) => s.queueLiveSub)
  const removeLiveSub = useGameStore((s) => s.removeLiveSub)
  const applyLiveAdjustments = useGameStore((s) => s.applyLiveAdjustments)

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [done, setDone] = useState(false)
  const [htOpen, setHtOpen] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)
  const htShownRef = useRef(false)

  useEffect(() => {
    if (!live || !save) {
      navigate('/match', { replace: true })
    }
  }, [live, save, navigate])

  const events = live?.humanResult?.events ?? []
  const current = events[Math.min(index, Math.max(0, events.length - 1))]
  const visible = events.slice(0, index + 1).slice(-12)
  const needsHt =
    !!live?.halfTime && !live.halfTime.resolved && current?.kind === 'halftime'

  // Auto-pause at half-time for adjustments
  useEffect(() => {
    if (!needsHt || htShownRef.current) return
    htShownRef.current = true
    setPlaying(false)
    setHtOpen(true)
  }, [needsHt])

  // After HT resolved, events grow — keep playing from current index
  useEffect(() => {
    if (live?.halfTime?.resolved) {
      setHtOpen(false)
      setPlaying(true)
      setDone(false)
    }
  }, [live?.halfTime?.resolved, live?.humanResult?.events?.length])

  useEffect(() => {
    if (!playing || done || !live || events.length === 0 || htOpen) return
    if (needsHt) return
    if (index >= events.length - 1) {
      setDone(true)
      setPlaying(false)
      return
    }
    if (
      live.halfTime &&
      !live.halfTime.resolved &&
      current?.kind === 'halftime'
    ) {
      setPlaying(false)
      setHtOpen(true)
      return
    }
    const t = window.setTimeout(() => setIndex((i) => i + 1), SPEED_MS[speed])
    return () => window.clearTimeout(t)
  }, [
    playing,
    done,
    index,
    speed,
    live,
    events,
    htOpen,
    needsHt,
    current?.kind,
  ])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [index])

  const clubs = useMemo(() => {
    if (!save || !live?.humanFixture) return null
    const fx = live.humanFixture
    return {
      home: save.clubs.find((c) => c.id === fx.homeClubId)!,
      away: save.clubs.find((c) => c.id === fx.awayClubId)!,
    }
  }, [save, live])

  const referee = live?.humanFixture ? getReferee(live.humanFixture.refereeId) : undefined

  const pitchPlayers = useMemo(() => {
    if (!save || !live?.humanFixture || !current) return []
    const fx = live.humanFixture
    const homeTactics = live.tacticsByClub[fx.homeClubId]
    const awayTactics = live.tacticsByClub[fx.awayClubId]
    const home = buildPitchPlayers(homeTactics, save.players, 'home')
    const away = buildPitchPlayers(awayTactics, save.players, 'away')
    return withActionOffset([...home, ...away], current.playerName, current.spot)
  }, [save, live, current])

  const skipToEnd = () => {
    if (live?.halfTime && !live.halfTime.resolved) {
      continueHalfTime({})
    }
    window.setTimeout(() => {
      const ev = useGameStore.getState().liveMatch?.humanResult?.events ?? []
      setIndex(Math.max(0, ev.length - 1))
      setDone(true)
      setPlaying(false)
      setHtOpen(false)
    }, 0)
  }

  if (!save || !live || !current || !clubs) return null

  const pulse = current.kind === 'goal' || current.kind === 'shot'
  const active = pitchPlayers.find((p) => p.active)
  const humanIsHome = live.humanFixture!.homeClubId === save.humanClubId

  return (
    <div className="mx-auto flex min-h-dvh max-w-5xl flex-col gap-4 px-4 py-4 md:py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
            แมตช์สด · สไตล์ FM
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            {clubs.home.name}{' '}
            <span className="text-slate-400">พบ</span> {clubs.away.name}
          </h1>
          <p className="text-sm text-slate-600">
            แมตช์เดย์ {live.matchday} · {live.date}
            {referee
              ? ` · ผู้ตัดสิน ${referee.name} (${reputationLabel(referee.reputation)} · ${strictnessLabel(referee.strictness)} · ${homeBiasLabel(referee.homeBias)})`
              : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-4xl font-bold tracking-tight text-slate-900">
            {current.homeGoals}–{current.awayGoals}
          </p>
          <p className="text-sm font-semibold text-slate-600">{current.minute}&apos;</p>
          {active ? (
            <p className="mt-1 text-xs font-medium text-lime-800">ครองบอล: {active.name}</p>
          ) : null}
        </div>
      </header>

      <MatchPitch
        spot={current.spot}
        players={pitchPlayers}
        homeColor={clubs.home.color}
        awayColor={clubs.away.color}
        homeShort={clubs.home.shortName}
        awayShort={clubs.away.shortName}
        pulse={pulse}
        className="aspect-[100/64] w-full"
      />

      {!htOpen && !done ? (
        <LiveTouchlineBoard
          minute={current.minute}
          pending={live.pendingLiveShouts ?? []}
          defaultOpen
          onShout={(shout) => {
            const ok = applyLiveAdjustments({ shouts: [shout] }, current.minute)
            if (ok && live.halfTime?.resolved) {
              const ev = useGameStore.getState().liveMatch?.humanResult?.events ?? []
              const idx = ev.findIndex((e) => e.minute >= current.minute)
              if (idx >= 0) setIndex(idx)
            }
          }}
        />
      ) : null}

      {htOpen && live.halfTime && !live.halfTime.resolved ? (
        <HalfTimePanel
          title="พักครึ่ง · แก้เกม"
          scoreHome={live.halfTime.midState.homeGoals}
          scoreAway={live.halfTime.midState.awayGoals}
          humanIsHome={humanIsHome}
          maxSubs={Math.max(
            0,
            (live.halfTime.midState.maxSubs ?? 5) -
              (humanIsHome
                ? live.halfTime.midState.homeSubsUsed ?? live.halfTime.midState.subsUsed ?? 0
                : live.halfTime.midState.awaySubsUsed ?? live.halfTime.midState.subsUsed ?? 0),
          )}
          formation={live.tacticsByClub[save.humanClubId]!.formation}
          formationOop={live.tacticsByClub[save.humanClubId]!.formationOop}
          mentality={live.tacticsByClub[save.humanClubId]!.instructions.mentality}
          pressing={live.tacticsByClub[save.humanClubId]!.instructions.pressing}
          xi={live.tacticsByClub[save.humanClubId]!.startingXi}
          bench={live.tacticsByClub[save.humanClubId]!.bench}
          sentOff={new Set(live.halfTime.midState.sentOffIds)}
          initialSubs={live.phaseQueuedSubs ?? live.pendingHumanSubs ?? []}
          playerName={(id) => save.players.find((p) => p.id === id)?.name ?? id}
          onContinue={(adj) => {
            continueHalfTime(adj)
            setHtOpen(false)
            setPlaying(true)
          }}
        />
      ) : null}

      {!htOpen && !done ? (
        <>
          <LiveSubBoard
            xi={live.tacticsByClub[save.humanClubId]!.startingXi}
            bench={live.tacticsByClub[save.humanClubId]!.bench}
            queued={live.phaseQueuedSubs ?? live.pendingHumanSubs ?? []}
            minute={current.minute}
            maxSubs={Math.max(
              0,
              5 -
                (humanIsHome
                  ? live.halfTime?.midState.homeSubsUsed ?? live.halfTime?.midState.subsUsed ?? 0
                  : live.halfTime?.midState.awaySubsUsed ?? live.halfTime?.midState.subsUsed ?? 0),
            )}
            playerName={(id) => save.players.find((p) => p.id === id)?.name ?? id}
            onQueue={(outId, inId) => {
              const ok = queueLiveSub(outId, inId, current.minute)
              if (ok) {
                const ev = useGameStore.getState().liveMatch?.humanResult?.events ?? []
                const idx = ev.findIndex((e) => e.minute >= current.minute)
                if (idx >= 0) setIndex(idx)
              }
            }}
            onRemove={removeLiveSub}
          />
          <LiveTacticsBoard
            minute={current.minute}
            formation={live.tacticsByClub[save.humanClubId]!.formation}
            formationOop={live.tacticsByClub[save.humanClubId]!.formationOop}
            mentality={live.tacticsByClub[save.humanClubId]!.instructions.mentality}
            pressing={live.tacticsByClub[save.humanClubId]!.instructions.pressing}
            onApply={(adj) => {
              const ok = applyLiveAdjustments(adj, current.minute)
              if (ok && live.halfTime?.resolved) {
                const ev = useGameStore.getState().liveMatch?.humanResult?.events ?? []
                const idx = ev.findIndex((e) => e.minute >= current.minute)
                if (idx >= 0) setIndex(idx)
              }
            }}
          />
        </>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          onClick={() => setPlaying((p) => !p)}
          disabled={done || htOpen}
        >
          {playing ? 'หยุดชั่วคราว' : 'เล่นต่อ'}
        </button>
        {(['slow', 'normal', 'fast'] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setSpeed(s)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-medium',
              speed === s
                ? 'border-slate-900 bg-slate-900 text-lime-300'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {s === 'slow' ? 'ช้า' : s === 'normal' ? 'ปกติ' : 'เร็ว'}
          </button>
        ))}
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          onClick={skipToEnd}
        >
          ข้ามไปจบเกม
        </button>
        {done ? (
          <button
            type="button"
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
            onClick={() => {
              finishLiveMatch()
              navigate('/match')
            }}
          >
            ยืนยันผลและบันทึกนัด AI
          </button>
        ) : (
          <button
            type="button"
            className="rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-semibold text-red-800 hover:bg-red-100"
            onClick={() => {
              if (window.confirm('ออกโดยไม่จบแมตช์? แมตช์เดย์จะไม่ถูกบันทึก')) {
                abortLiveMatch()
                navigate('/match')
              }
            }}
          >
            ยกเลิก
          </button>
        )}
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/90 p-4 shadow-sm">
        <h2 className="text-sm font-semibold tracking-wide text-slate-500 uppercase">
          คำบรรยาย
        </h2>
        <div ref={feedRef} className="mt-3 max-h-64 space-y-2 overflow-y-auto pr-1">
          {visible.map((ev) => (
            <div
              key={ev.id}
              className={cn(
                'rounded-md border px-3 py-2 text-sm leading-relaxed',
                kindTone(ev.kind, ev.cardColor),
              )}
            >
              <span className="mr-2 font-mono text-xs font-bold opacity-70">{ev.minute}&apos;</span>
              {ev.text}
            </div>
          ))}
        </div>
      </section>

      {done && live.humanResult && clubs ? (
        <>
          <MatchStatsPanel
            result={live.humanResult}
            homeName={clubs.home.name}
            awayName={clubs.away.name}
          />
          {live.humanResult.breakdown ? (
            <section className="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4">
              <h2 className="text-sm font-semibold text-indigo-950">วิเคราะห์พื้นที่ (Match Engine)</h2>
              <p className="mt-1 text-xs text-indigo-800">
                {formationLabel(live.humanResult.breakdown.homeFormation, true)} vs{' '}
                {formationLabel(live.humanResult.breakdown.awayFormation, true)}
              </p>
              <ul className="mt-2 space-y-1 text-sm text-indigo-950">
                {live.humanResult.breakdown.lines.map((l, i) => (
                  <li key={`l-${i}`}>{l}</li>
                ))}
              </ul>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}

function LiveTouchlineBoard(props: {
  minute: number
  pending: TouchlineShout[]
  onShout: (shout: TouchlineShout) => void
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(props.defaultOpen ?? true)
  return (
    <section className="rounded-xl border-2 border-lime-600/40 bg-lime-50/90 p-3 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-sm font-bold text-slate-900">ตะโกนริมเส้น · ข้างสนาม</p>
          <p className="text-xs text-slate-600">
            สั่งจากขอบสนาม · นาที {props.minute}&apos;
            {props.pending.length ? ` · คิว ${props.pending.length}` : ''}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-600">{open ? 'ซ่อน' : 'เปิด'}</span>
      </button>
      {open ? (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-lime-200 pt-3">
          {TOUCHLINE_SHOUT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              onClick={() => props.onShout(o.id)}
              className={cn(
                'rounded border px-2.5 py-1.5 text-xs font-semibold',
                props.pending.includes(o.id)
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white hover:bg-white',
              )}
            >
              {o.label}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  )
}

function LiveTacticsBoard(props: {
  minute: number
  formation: FormationId
  formationOop: FormationId
  mentality: Mentality
  pressing: Pressing
  onApply: (adj: HalfTimeAdjustments) => void
}) {
  const [open, setOpen] = useState(false)
  const [formation, setFormation] = useState(props.formation)
  const [formationOop, setFormationOop] = useState(props.formationOop)
  const [mentality, setMentality] = useState(props.mentality)
  const [pressing, setPressing] = useState(props.pressing)

  useEffect(() => {
    setFormation(props.formation)
    setFormationOop(props.formationOop)
    setMentality(props.mentality)
    setPressing(props.pressing)
  }, [props.formation, props.formationOop, props.mentality, props.pressing])

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-sm font-bold text-slate-900">เปลี่ยนแผนกลางเกม</p>
          <p className="text-xs text-slate-500">
            แผน/มายด์เซ็ต · ไม่หยุดเกม · นาที {props.minute}&apos;
          </p>
        </div>
        <span className="text-xs font-medium text-slate-600">{open ? 'ซ่อน' : 'เปิด'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-3 border-t border-slate-100 pt-3">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">แผน IP</p>
            <div className="flex flex-wrap gap-1">
              {ALL_FORMATIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  title={FORMATION_LABEL_TH[f]}
                  onClick={() => setFormation(f)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs',
                    formation === f
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300',
                  )}
                >
                  {formationLabel(f, true)}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">แผน OOP</p>
            <div className="flex flex-wrap gap-1">
              {ALL_FORMATIONS.map((f) => (
                <button
                  key={`oop-${f}`}
                  type="button"
                  onClick={() => setFormationOop(f)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs',
                    formationOop === f
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300',
                  )}
                >
                  {formationLabel(f, true)}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Mentality</p>
              <div className="flex gap-1">
                {(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMentality(m)}
                    className={cn(
                      'rounded border px-2 py-1 text-xs',
                      mentality === m
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : 'border-slate-300',
                    )}
                  >
                    {m === 'defensive' ? 'รับ' : m === 'attacking' ? 'บุก' : 'สมดุล'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Pressing</p>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as Pressing[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPressing(p)}
                    className={cn(
                      'rounded border px-2 py-1 text-xs',
                      pressing === p
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : 'border-slate-300',
                    )}
                  >
                    {p === 'low' ? 'ต่ำ' : p === 'high' ? 'สูง' : 'กลาง'}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button
            type="button"
            className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-lime-300"
            onClick={() =>
              props.onApply({ formation, formationOop, mentality, pressing })
            }
          >
            ใช้แผนนี้
          </button>
        </div>
      ) : null}
    </section>
  )
}

function LiveSubBoard(props: {
  xi: string[]
  bench: string[]
  queued: HalfTimeSub[]
  minute: number
  maxSubs: number
  playerName: (id: string) => string
  onQueue: (outId: string, inId: string) => void
  onRemove: (outId: string) => void
}) {
  const [open, setOpen] = useState(false)
  const [outId, setOutId] = useState('')
  const [inId, setInId] = useState('')
  const left = Math.max(0, props.maxSubs - props.queued.length)

  return (
    <section className="rounded-xl border border-slate-300 bg-white p-3 shadow-sm">
      <button
        type="button"
        className="flex w-full items-center justify-between text-left"
        onClick={() => setOpen((o) => !o)}
      >
        <div>
          <p className="text-sm font-bold text-slate-900">ขอเปลี่ยนตัว</p>
          <p className="text-xs text-slate-500">
            เลือกได้ตลอด · ลงสนามเมื่อบอลออก · คิว {props.queued.length} · เหลือ {left}
          </p>
        </div>
        <span className="text-xs font-medium text-slate-600">{open ? 'ซ่อน' : 'เปิด'}</span>
      </button>
      {open ? (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              ออก
              <select
                className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
                value={outId}
                onChange={(e) => setOutId(e.target.value)}
              >
                <option value="">—</option>
                {props.xi.map((id) => (
                  <option key={id} value={id}>
                    {props.playerName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              เข้า
              <select
                className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
                value={inId}
                onChange={(e) => setInId(e.target.value)}
              >
                <option value="">—</option>
                {props.bench.map((id) => (
                  <option key={id} value={id}>
                    {props.playerName(id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded border border-slate-900 bg-slate-900 px-3 py-1.5 text-sm font-semibold text-lime-300 disabled:opacity-40"
              disabled={!outId || !inId || left <= 0}
              onClick={() => {
                if (!outId || !inId) return
                props.onQueue(outId, inId)
                setOutId('')
                setInId('')
              }}
            >
              ขอเปลี่ยน
            </button>
          </div>
          {props.queued.length > 0 ? (
            <ul className="space-y-1 text-xs text-slate-700">
              {props.queued.map((s) => (
                <li key={`${s.outId}-${s.inId}`}>
                  รอบอลออก · {props.playerName(s.outId)} → {props.playerName(s.inId)}{' '}
                  <button
                    type="button"
                    className="text-red-700 underline"
                    onClick={() => props.onRemove(s.outId)}
                  >
                    ยกเลิก
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">ยังไม่มีคิว · นาทีปัจจุบัน {props.minute}&apos;</p>
          )}
        </div>
      ) : null}
    </section>
  )
}

function HalfTimePanel(props: {
  title?: string
  scoreHome: number
  scoreAway: number
  humanIsHome: boolean
  maxSubs?: number
  formation: FormationId
  formationOop: FormationId
  mentality: Mentality
  pressing: Pressing
  xi: string[]
  bench: string[]
  sentOff: Set<string>
  initialSubs?: HalfTimeSub[]
  playerName: (id: string) => string
  onContinue: (adj: HalfTimeAdjustments) => void
}) {
  const maxSubs = props.maxSubs ?? 3
  const [formation, setFormation] = useState(props.formation)
  const [formationOop, setFormationOop] = useState(props.formationOop)
  const [mentality, setMentality] = useState(props.mentality)
  const [pressing, setPressing] = useState(props.pressing)
  const [talk, setTalk] = useState<TeamTalkKind | null>('inspire')
  const [shout, setShout] = useState<TouchlineShout | null>('encourage')
  const [subs, setSubs] = useState<HalfTimeSub[]>(props.initialSubs ?? [])
  const [outId, setOutId] = useState('')
  const [inId, setInId] = useState('')

  const hint = halfTimeScoreLine(props.scoreHome, props.scoreAway, props.humanIsHome)
  const xiAvail = props.xi.filter((id) => !props.sentOff.has(id))
  const benchAvail = props.bench.filter((id) => !props.sentOff.has(id))

  const addSub = () => {
    if (!outId || !inId || subs.length >= maxSubs) return
    if (subs.some((s) => s.outId === outId || s.inId === inId)) return
    setSubs([...subs, { outId, inId }])
    setOutId('')
    setInId('')
  }

  return (
    <section className="rounded-xl border-2 border-slate-900 bg-white p-5 shadow-lg">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900">{props.title ?? 'พักครึ่ง · แก้เกม'}</h2>
          <p className="mt-1 text-sm text-slate-600">
            สกอร์ {props.scoreHome}–{props.scoreAway} · {hint}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            เปลี่ยนตัวจะลงสนามเมื่อบอลออก (พัก/หยุดเกมนับว่าบอลออกแล้ว)
          </p>
        </div>
        <p className="font-mono text-3xl font-bold">{props.scoreHome}–{props.scoreAway}</p>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">แผน IP ครึ่งหลัง</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_FORMATIONS.map((f) => (
              <button
                key={f}
                type="button"
                title={FORMATION_LABEL_TH[f]}
                onClick={() => setFormation(f)}
                className={cn(
                  'rounded border px-2 py-1 text-xs font-medium',
                  formation === f
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white hover:bg-slate-50',
                )}
              >
                {formationLabel(f, true)}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">แผน OOP ครึ่งหลัง</p>
          <div className="flex flex-wrap gap-1.5">
            {ALL_FORMATIONS.map((f) => (
              <button
                key={`oop-${f}`}
                type="button"
                title={FORMATION_LABEL_TH[f]}
                onClick={() => setFormationOop(f)}
                className={cn(
                  'rounded border px-2 py-1 text-xs font-medium',
                  formationOop === f
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white hover:bg-slate-50',
                )}
              >
                {formationLabel(f, true)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-4">
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Mentality</p>
            <div className="flex gap-1">
              {(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMentality(m)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs',
                    mentality === m
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300',
                  )}
                >
                  {m === 'defensive' ? 'รับ' : m === 'attacking' ? 'บุก' : 'สมดุล'}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">Pressing</p>
            <div className="flex gap-1">
              {(['low', 'medium', 'high'] as Pressing[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPressing(p)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs',
                    pressing === p
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300',
                  )}
                >
                  {p === 'low' ? 'ต่ำ' : p === 'high' ? 'สูง' : 'กลาง'}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">
            เปลี่ยนตัว (เหลือ {maxSubs} จากโควต้า) · {subs.length}/{maxSubs} · ลงเมื่อบอลออก
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs">
              ออก
              <select
                className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
                value={outId}
                onChange={(e) => setOutId(e.target.value)}
              >
                <option value="">—</option>
                {xiAvail.map((id) => (
                  <option key={id} value={id}>
                    {props.playerName(id)}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-xs">
              เข้า
              <select
                className="mt-0.5 block rounded border border-slate-300 px-2 py-1 text-sm"
                value={inId}
                onChange={(e) => setInId(e.target.value)}
              >
                <option value="">—</option>
                {benchAvail.map((id) => (
                  <option key={id} value={id}>
                    {props.playerName(id)}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="rounded border border-slate-300 px-2 py-1 text-sm hover:bg-slate-50"
              onClick={addSub}
            >
              เพิ่ม
            </button>
          </div>
          {subs.length > 0 ? (
            <ul className="mt-2 space-y-1 text-xs text-slate-700">
              {subs.map((s) => (
                <li key={`${s.outId}-${s.inId}`}>
                  {props.playerName(s.outId)} → {props.playerName(s.inId)}{' '}
                  <button
                    type="button"
                    className="text-red-700 underline"
                    onClick={() => setSubs(subs.filter((x) => x !== s))}
                  >
                    ลบ
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">ทีมทอล์คพักครึ่ง</p>
          <div className="flex flex-wrap gap-1.5">
            {TEAM_TALK_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setTalk(o.id)}
                className={cn(
                  'rounded border px-2 py-1 text-xs',
                  talk === o.id
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">ตะโกนริมเส้น (ครึ่งหลัง)</p>
          <div className="flex flex-wrap gap-1.5">
            {TOUCHLINE_SHOUT_OPTIONS.map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setShout(o.id)}
                className={cn(
                  'rounded border px-2 py-1 text-xs',
                  shout === o.id
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-300 hover:bg-slate-800"
          onClick={() =>
            props.onContinue({
              formation,
              formationOop,
              mentality,
              pressing,
              subs,
              teamTalk: talk,
              shouts: shout ? [shout] : [],
            })
          }
        >
          เตะครึ่งหลัง
        </button>
        <button
          type="button"
          className="rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-50"
          onClick={() => props.onContinue({})}
        >
          ไม่เปลี่ยนอะไร · เตะต่อ
        </button>
      </div>
    </section>
  )
}
