import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MatchPitch } from '@/components/MatchPitch'
import { cn } from '@/lib/cn'
import type { MatchEventKind, PitchSpot } from '@/game/types'
import {
  ballSpotFromSpatialDemo,
  buildKickoffMarkers,
  buildPitchPlayers,
  KICKOFF_BALL_SPOT,
  lerpSpatialFrames,
  markersFromSpatialFrameDemo,
  withActionOffset,
} from '@/game/pitchLayout'
import {
  applyDemoSupportRuns,
  blendDemoMarkers,
  introBlendT,
  springDemoMarkers,
  type DemoPitchMarker,
} from '@/game/demoPitchMotion'
import {
  DEMO_WALL_MS,
  buildDemoTimeline,
  demoBlendAtWallMs,
  isBigDemoEvent,
  isDemoFeedEvent,
  nextBigEventIndex,
} from '@/game/matchDemoMeta'
import type { MatchDemoBundle } from '@/game/matchDemo'
import { MatchSquadPanel } from '@/components/MatchSquadPanel'
import { MatchPlayerDetailPanel } from '@/components/MatchPlayerDetailPanel'
import { MatchOverlayModal } from '@/components/MatchOverlayModal'
import {
  DemoTacticsPanel,
  buildDemoTacticsState,
  demoTacticsSummary,
  type DemoTacticsState,
} from '@/components/DemoTacticsPanel'
import { fitnessFromSpatial, squadStatusFromEvents } from '@/game/matchFitness'

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
    case 'var':
      return 'border-violet-400 bg-violet-50 text-violet-950'
    case 'offside':
      return 'border-orange-400 bg-orange-50 text-orange-950'
    case 'foul':
      return 'border-orange-300 bg-orange-50 text-orange-950'
    case 'penalty':
      return 'border-fuchsia-400 bg-fuchsia-50 text-fuchsia-950'
    case 'halftime':
    case 'secondhalf':
    case 'fulltime':
      return 'border-slate-400 bg-slate-100 text-slate-900'
    case 'tactical_window':
      return 'border-orange-400 bg-orange-50 text-orange-950'
    default:
      return 'border-slate-200 bg-white text-slate-800'
  }
}

function formatClock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${r.toString().padStart(2, '0')}`
}

export function MatchDemoPage() {
  const [bundle, setBundle] = useState<MatchDemoBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('กำลังเตรียม…')
  const [error, setError] = useState<string | null>(null)
  /** ยังไม่กด Start — ยืนฟอร์เมชันฝั่งตัวเอง */
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)
  const [wallMs, setWallMs] = useState(0)
  const [index, setIndex] = useState(0)
  const [blendT, setBlendT] = useState(0)
  const [renderMarkers, setRenderMarkers] = useState<DemoPitchMarker[]>([])
  const [stoppageOpen, setStoppageOpen] = useState(false)
  const [tacticsOpen, setTacticsOpen] = useState(false)
  const [tacticsStoppage, setTacticsStoppage] = useState<'injury' | 'red_card' | null>(null)
  const [rmaTactics, setRmaTactics] = useState<DemoTacticsState | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState<string | null>(null)
  const stoppageSeenRef = useRef(new Set<string>())
  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const displayPosRef = useRef(new Map<string, PitchSpot>())
  const targetMarkersRef = useRef<DemoPitchMarker[]>([])
  const feedRef = useRef<HTMLDivElement>(null)
  const lastFeedIdRef = useRef<string | null>(null)

  const timeline = useMemo(
    () => (bundle ? buildDemoTimeline(bundle.events) : []),
    [bundle],
  )

  const kickoffPlayers = useMemo(() => {
    if (!bundle) return []
    return buildKickoffMarkers(bundle.homeXi, bundle.awayXi, bundle.players)
  }, [bundle])

  const kickoffPlayersRef = useRef(kickoffPlayers)
  useEffect(() => {
    kickoffPlayersRef.current = kickoffPlayers
  }, [kickoffPlayers])

  const runDemo = (seed?: number) => {
    setLoading(true)
    setError(null)
    setStarted(false)
    setPlaying(false)
    setDone(false)
    setWallMs(0)
    setIndex(0)
    setBlendT(0)
    displayPosRef.current.clear()
    setRenderMarkers([])
    lastTsRef.current = null
    lastFeedIdRef.current = null
    stoppageSeenRef.current.clear()
    setStoppageOpen(false)
    setTacticsOpen(false)
    setTacticsStoppage(null)
    setSelectedPlayerId(null)
    setStatus('กำลังโหลดเอนจินแมตช์…')

    void (async () => {
      try {
        const { buildMatchDemo } = await import('@/game/matchDemo')
        setStatus('กำลังซิม El Clásico (11v11)…')
        await new Promise((r) => window.setTimeout(r, 40))
        const next = buildMatchDemo({ seed })
        setBundle(next)
        setRmaTactics(
          buildDemoTacticsState(
            '4-3-3',
            next.homeXi,
            next.tacticsByClub[next.home.id]?.slotRoles
              ? { slotRoles: next.tacticsByClub[next.home.id]!.slotRoles }
              : undefined,
            next.players.filter((p) => p.clubId === next.home.id),
          ),
        )
        setLoading(false)
      } catch (e) {
        setBundle(null)
        setLoading(false)
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }

  const startMatch = () => {
    if (!bundle || done) return
    setStarted(true)
    setPlaying(true)
    setWallMs(0)
    setIndex(0)
    setBlendT(0)
    displayPosRef.current.clear()
    setRenderMarkers(kickoffPlayers)
    lastTsRef.current = null
  }

  useEffect(() => {
    runDemo()
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const events = bundle?.events ?? []
  const current = events[Math.min(index, Math.max(0, events.length - 1))]
  const nextEv = events[index + 1]

  const stoppageNotes = useMemo(() => {
    if (!current?.stoppageKind) return [] as string[]
    const m = current.minute
    const clubId = current.clubId
    return events
      .filter(
        (e) =>
          e.minute === m &&
          e.id !== current.id &&
          (e.kind === 'commentary' ||
            e.kind === 'substitution' ||
            e.kind === 'tactical_window') &&
          (!clubId || e.clubId === clubId || e.text.includes('AI')),
      )
      .map((e) => e.text)
      .slice(0, 4)
  }, [events, current])

  useEffect(() => {
    if (!started || !current?.stoppageKind || stoppageSeenRef.current.has(current.id)) return
    stoppageSeenRef.current.add(current.id)
    setPlaying(false)
    // RMA = ฝั่งคุณ → เปิดหน้าจัดตัว/เปลี่ยนตัวทันที
    if (current.stoppageSide === 'home') {
      setTacticsStoppage(current.stoppageKind)
      setStoppageOpen(false)
      setTacticsOpen(true)
      return
    }
    // คู่แข่ง → โชว์ว่า AI จัดการแล้ว
    setStoppageOpen(true)
  }, [started, current?.id, current?.stoppageKind, current?.stoppageSide])

  const resumeFromStoppage = () => {
    setStoppageOpen(false)
    if (!done) setPlaying(true)
  }

  const openTactics = () => {
    setPlaying(false)
    setTacticsStoppage(null)
    setTacticsOpen(true)
  }

  const closeTacticsPanel = () => {
    setTacticsOpen(false)
    setTacticsStoppage(null)
    setStoppageOpen(false)
    if (!done) setPlaying(true)
  }

  useEffect(() => {
    if (!started || !playing || done || !bundle || loading || timeline.length === 0 || stoppageOpen || tacticsOpen || selectedPlayerId) {
      lastTsRef.current = null
      return
    }

    const tick = (ts: number) => {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = ts - lastTsRef.current
      lastTsRef.current = ts
      setWallMs((prev) => {
        const next = Math.min(DEMO_WALL_MS, prev + dt)
        const { index: idx, t } = demoBlendAtWallMs(timeline, next)
        setIndex(idx)
        setBlendT(t)

        const intro = introBlendT(next)
        const targets = targetMarkersRef.current
        if (intro < 1 && bundle) {
          displayPosRef.current.clear()
          setRenderMarkers(
            blendDemoMarkers(kickoffPlayersRef.current, targets, intro),
          )
        } else if (bundle && targets.length > 0) {
          setRenderMarkers(
            springDemoMarkers(displayPosRef.current, targets, bundle.players, dt),
          )
        }

        if (next >= DEMO_WALL_MS || idx >= bundle.events.length - 1) {
          setDone(true)
          setPlaying(false)
          setIndex(Math.max(0, bundle.events.length - 1))
          setBlendT(0)
          return DEMO_WALL_MS
        }
        return next
      })
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }, [started, playing, done, bundle, loading, timeline, stoppageOpen, tacticsOpen, selectedPlayerId])

  useEffect(() => {
    if (!started || !current || !isBigDemoEvent(current.kind)) return
    if (lastFeedIdRef.current === current.id) return
    lastFeedIdRef.current = current.id
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [started, current])

  const spatialFrame = useMemo(() => {
    if (!started || !current?.spatial?.players?.length) return null
    if (nextEv?.spatial?.players?.length && blendT > 0.001) {
      return lerpSpatialFrames(current.spatial, nextEv.spatial, blendT)
    }
    return current.spatial
  }, [started, current, nextEv, blendT])

  const targetMarkers = useMemo(() => {
    if (!bundle) return [] as DemoPitchMarker[]
    if (!started) return kickoffPlayers
    if (spatialFrame) {
      const ball = ballSpotFromSpatialDemo(spatialFrame)
      const raw = markersFromSpatialFrameDemo(spatialFrame, bundle.players)
      return applyDemoSupportRuns(raw, ball, spatialFrame.possessing, bundle.players)
    }
    if (!current) return kickoffPlayers
    const homeT = {
      formation: '4-3-3' as const,
      formationOop: '4-3-3' as const,
      familiarity: 70,
      instructions: {
        mentality: 'balanced' as const,
        pressing: 'medium' as const,
        tempo: 'normal' as const,
        width: 'normal' as const,
        style: 'possession' as const,
      },
      startingXi: bundle.homeXi,
      bench: [],
      setPieces: { corners: 'mixed' as const, freeKicks: 'mixed' as const },
    }
    const awayT = { ...homeT, startingXi: bundle.awayXi }
    const home = buildPitchPlayers(homeT, bundle.players, 'home')
    const away = buildPitchPlayers(awayT, bundle.players, 'away')
    return withActionOffset([...home, ...away], current.playerName, current.spot)
  }, [bundle, started, kickoffPlayers, spatialFrame, current])

  useEffect(() => {
    targetMarkersRef.current = targetMarkers
    if (!started) {
      displayPosRef.current.clear()
      setRenderMarkers(kickoffPlayers)
    }
  }, [targetMarkers, started, kickoffPlayers])

  const pitchPlayers =
    started && renderMarkers.length > 0 ? renderMarkers : kickoffPlayers

  const ballSpot = useMemo(() => {
    if (!started) return KICKOFF_BALL_SPOT
    if (spatialFrame) return ballSpotFromSpatialDemo(spatialFrame)
    return current?.spot ?? KICKOFF_BALL_SPOT
  }, [started, spatialFrame, current])

  const visible = !started
    ? []
    : events
        .slice(0, index + 1)
        .filter((e) => isDemoFeedEvent(e))
        .slice(-28)
  const progress = started ? wallMs / DEMO_WALL_MS : 0
  const displayMinute = !started
    ? 0
    : current
      ? Math.round(current.minute + (nextEv ? (nextEv.minute - current.minute) * blendT : 0))
      : 0

  const squadStatus = useMemo(() => {
    if (!bundle) {
      return { sentOff: new Set<string>(), injuredParts: new Map(), onPitch: new Set<string>() }
    }
    return squadStatusFromEvents(
      events,
      index,
      spatialFrame,
      bundle.homeXi,
      bundle.awayXi,
    )
  }, [bundle, events, index, spatialFrame])

  const selectedPlayer = useMemo(() => {
    if (!bundle || !selectedPlayerId) return null
    return bundle.players.find((p) => p.id === selectedPlayerId) ?? null
  }, [bundle, selectedPlayerId])

  const selectedFitness = useMemo(() => {
    if (!selectedPlayer) return null
    return fitnessFromSpatial(spatialFrame, selectedPlayer.id, selectedPlayer, displayMinute, squadStatus.onPitch.has(selectedPlayer.id))
  }, [selectedPlayer, spatialFrame, displayMinute, squadStatus])

  const selectedInjuryPart = selectedPlayerId
    ? squadStatus.injuredParts.get(selectedPlayerId) ?? null
    : null

  const displayScore = !started
    ? '0–0'
    : current
      ? `${current.homeGoals}–${current.awayGoals}`
      : '0–0'

  const shortcut = (kind: 'big' | '30s' | 'ht' | 'end') => {
    if (!bundle || timeline.length === 0) return
    if (!started) startMatch()
    if (kind === 'end') {
      setStarted(true)
      setWallMs(DEMO_WALL_MS)
      setIndex(Math.max(0, events.length - 1))
      setBlendT(0)
      setDone(true)
      setPlaying(false)
      return
    }
    if (kind === 'big') {
      const next = nextBigEventIndex(events, index)
      const targetWall = timeline[next] ?? DEMO_WALL_MS
      displayPosRef.current.clear()
      setWallMs(Math.min(DEMO_WALL_MS, targetWall))
      setIndex(next)
      setBlendT(0)
      setPlaying(true)
      if (next >= events.length - 1) {
        setDone(true)
        setPlaying(false)
      }
      return
    }
    if (kind === '30s') {
      setPlaying(true)
      setWallMs((w) => {
        const next = Math.min(DEMO_WALL_MS, w + 30_000)
        const { index: idx, t } = demoBlendAtWallMs(timeline, next)
        setIndex(idx)
        setBlendT(t)
        displayPosRef.current.clear()
        if (next >= DEMO_WALL_MS) {
          setDone(true)
          setPlaying(false)
        }
        return next
      })
      return
    }
    if (kind === 'ht') {
      const ht = events.findIndex((e) => e.kind === 'halftime' || e.minute >= 45)
      const i = ht >= 0 ? ht : Math.floor(events.length / 2)
      displayPosRef.current.clear()
      setWallMs(timeline[i] ?? DEMO_WALL_MS / 2)
      setIndex(i)
      setBlendT(0)
      setPlaying(true)
    }
  }

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-100">
      <header className="shrink-0 border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div>
            <p className="text-[10px] font-bold text-lime-300/90 uppercase">El Clásico · จำลองแมตช์</p>
            <h1 className="text-base font-bold md:text-lg">
              Real Madrid vs FC Barcelona · ~4 นาทีจบเกม
            </h1>
            <p className="text-[11px] text-slate-400">
              กด Start ก่อนเริ่ม · ยืนฝั่งตัวเอง · shortcut ข้ามได้
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => runDemo(Date.now() % 1_000_000)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
            >
              รีแมตช์ (seed ใหม่)
            </button>
            <Link
              to="/match-demo-3d"
              className="rounded-md border border-sky-500/50 bg-sky-400/10 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-400/20"
            >
              ลอง 3D
            </Link>
            <Link
              to="/browse"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
            >
              ฐานข้อมูล
            </Link>
            <Link
              to="/"
              className="rounded-md bg-lime-400 px-3 py-1.5 text-xs font-bold text-slate-950"
            >
              หน้าแรก
            </Link>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 flex-col gap-3 px-4 py-4 lg:px-6">
        {error ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 rounded-xl border border-red-200 bg-white p-10 text-sm text-red-700">
            <p>โหลดแมตช์ไม่สำเร็จ: {error}</p>
            <button
              type="button"
              onClick={() => runDemo(Date.now() % 1_000_000)}
              className="rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white"
            >
              ลองใหม่
            </button>
          </div>
        ) : loading || !bundle ? (
          <div className="flex flex-1 items-center justify-center rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-500">
            {status}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  <span className="text-slate-700">{bundle.home.shortName}</span>{' '}
                  {bundle.home.name}{' '}
                  <span className="text-slate-400">vs</span> {bundle.away.name}{' '}
                  <span className="text-slate-700">{bundle.away.shortName}</span>
                </h2>
                <p className="text-xs text-slate-500">
                  {!started
                    ? `พร้อมเตะเริ่ม · seed ${bundle.seed} · กด Start เมื่อพร้อม`
                    : `El Clásico · seed ${bundle.seed} · ${events.length} จังหวะ · นาฬิกา ${formatClock(wallMs)} / ${formatClock(DEMO_WALL_MS)}`}
                </p>
              </div>
              <div className="text-right">
                <p className="font-mono text-4xl font-bold tabular-nums text-slate-900">
                  {displayScore}
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  {!started ? 'ก่อนเริ่ม' : `${displayMinute}'`}
                </p>
              </div>
            </div>

            <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-lime-500"
                style={{ width: `${progress * 100}%` }}
              />
            </div>

            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_300px] xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="min-w-0 space-y-3">
            <div className="relative isolate z-0">
              <MatchPitch
                spot={ballSpot}
                players={pitchPlayers}
                homeColor={bundle.home.color}
                awayColor={bundle.away.color}
                homeShort={bundle.home.shortName}
                awayShort={bundle.away.shortName}
                pulse={
                  Boolean(
                    started &&
                      current &&
                      blendT < 0.12 &&
                      (current.kind === 'goal' || current.kind === 'shot'),
                  )
                }
                glide={false}
                className="aspect-[100/64] w-full"
              />
              {!started ? (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-slate-950/35">
                  <button
                    type="button"
                    onClick={startMatch}
                    className="rounded-lg bg-lime-400 px-8 py-3 text-base font-bold text-slate-950 shadow-lg ring-4 ring-lime-200/50 hover:bg-lime-300"
                  >
                    Start · เริ่มแมตช์
                  </button>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {!started ? (
                <button
                  type="button"
                  onClick={startMatch}
                  className="rounded-md bg-lime-400 px-4 py-2 text-xs font-bold text-slate-950"
                >
                  Start · เริ่มแมตช์
                </button>
              ) : (
                <button
                  type="button"
                  disabled={done}
                  onClick={() => setPlaying((p) => !p)}
                  className="rounded-md bg-slate-900 px-3 py-2 text-xs font-bold text-white disabled:opacity-40"
                >
                  {playing ? 'พัก' : 'เล่นต่อ'}
                </button>
              )}
              {started ? (
                <button
                  type="button"
                  disabled={done}
                  onClick={openTactics}
                  className="rounded-md border-2 border-lime-500 bg-lime-50 px-3 py-2 text-xs font-bold text-lime-950 hover:bg-lime-100 disabled:opacity-40"
                >
                  ปรับแผน RMA
                </button>
              ) : null}
              <button
                type="button"
                disabled={done}
                onClick={() => shortcut('big')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Shortcut · ไฮไลต์ถัดไป
              </button>
              <button
                type="button"
                disabled={done}
                onClick={() => shortcut('30s')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                Shortcut · +30 วินาที
              </button>
              <button
                type="button"
                disabled={done}
                onClick={() => shortcut('ht')}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50 disabled:opacity-40"
              >
                ไปพักครึ่ง
              </button>
              <button
                type="button"
                disabled={done}
                onClick={() => shortcut('end')}
                className="rounded-md border border-lime-400 bg-lime-50 px-3 py-2 text-xs font-bold text-lime-950 hover:bg-lime-100 disabled:opacity-40"
              >
                Shortcut · จบแมตช์
              </button>
            </div>

            {started && rmaTactics ? (
              <p className="rounded-lg border border-lime-200 bg-lime-50/90 px-3 py-2 text-xs text-lime-950">
                <span className="font-bold">แผนฝั่งคุณ (RMA):</span>{' '}
                {demoTacticsSummary(rmaTactics)}
                <span className="text-lime-800/80">
                  {' '}
                  — กด「ปรับแผน RMA」→ แท็บ「จัดตัว + บทบาท」
                </span>
              </p>
            ) : null}

            {done && current ? (
              <p className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800">
                จบแล้ว {bundle.home.shortName} {current.homeGoals}–{current.awayGoals}{' '}
                {bundle.away.shortName} — กด「รีแมตช์」เพื่อซิมอีกรอบ
              </p>
            ) : null}

            <div
              ref={feedRef}
              className="max-h-56 space-y-1.5 overflow-y-auto rounded-xl border border-slate-200 bg-white p-3"
            >
              {!started ? (
                <p className="text-xs text-slate-500">
                  รอเตะเริ่ม — {bundle.home.shortName} ซ้าย · {bundle.away.shortName} ขวา · ลูกกลางสนาม
                </p>
              ) : (
                visible.map((ev) => (
                  <div
                    key={ev.id}
                    className={cn(
                      'rounded-md border px-2.5 py-1.5 text-xs',
                      kindTone(ev.kind, ev.cardColor),
                      current && ev.id === current.id && 'ring-2 ring-lime-400',
                    )}
                  >
                    <span className="font-bold tabular-nums">{ev.minute}&apos;</span> · {ev.text}
                  </div>
                ))
              )}
            </div>
              </div>

              <aside className="flex min-h-[420px] flex-col lg:min-h-0">
                <MatchSquadPanel
                  players={bundle.players.filter((p) => p.clubId === bundle.home.id)}
                  homeXi={bundle.homeXi}
                  awayXi={bundle.awayXi}
                  homeBench={bundle.homeBench}
                  awayBench={bundle.awayBench}
                  homeLabel={bundle.home.shortName}
                  awayLabel={bundle.away.shortName}
                  homeColor={bundle.home.color}
                  awayColor={bundle.away.color}
                  spatial={spatialFrame}
                  minute={displayMinute}
                  status={squadStatus}
                  selectedId={selectedPlayerId}
                  onSelect={(id) => {
                    setSelectedPlayerId(id)
                    setPlaying(false)
                  }}
                  ownSideOnly
                  focusSide="home"
                />
              </aside>
            </div>
          </>
        )}
      </div>

      <MatchOverlayModal
        open={Boolean(started && tacticsOpen && bundle && rmaTactics)}
        className="max-w-3xl border-orange-400"
      >
        {bundle && rmaTactics ? (
          <DemoTacticsPanel
            initial={rmaTactics}
            teamLabel={bundle.home.shortName}
            minute={displayMinute}
            players={bundle.players.filter((p) => p.clubId === bundle.home.id)}
            benchIds={bundle.homeBench}
            kitColor={bundle.home.color}
            stoppageMode={tacticsStoppage}
            forcedOutId={
              tacticsStoppage === 'injury' && current?.stoppageSide === 'home'
                ? current.playerId
                : null
            }
            stoppageText={
              tacticsStoppage && current?.stoppageKind ? current.text : undefined
            }
            onApply={setRmaTactics}
            onClose={closeTacticsPanel}
          />
        ) : null}
      </MatchOverlayModal>

      <MatchOverlayModal
        open={Boolean(
          started &&
            stoppageOpen &&
            current?.stoppageKind &&
            current.stoppageSide !== 'home',
        )}
        className="border-orange-400"
      >
        {current?.stoppageKind ? (
          <>
            <p className="text-[10px] font-bold tracking-wider text-orange-600 uppercase">
              เกมหยุด · คู่แข่ง · {current.stoppageKind === 'injury' ? 'บาดเจ็บ' : 'ใบแดง'}
            </p>
            <p className="mt-2 text-sm font-bold text-slate-900">{current.text}</p>
            {stoppageNotes.length ? (
              <ul className="mt-3 space-y-1 rounded-lg border border-orange-100 bg-orange-50/80 p-2.5 text-xs text-orange-950">
                {stoppageNotes.map((note, i) => (
                  <li key={`${current.id}-n-${i}`}>· {note}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-600">
                AI คู่แข่งจัดการเปลี่ยนตัว / แก้เกมให้แล้ว
              </p>
            )}
            <button
              type="button"
              onClick={resumeFromStoppage}
              className="mt-4 w-full rounded-lg bg-orange-500 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-600"
            >
              เล่นต่อ
            </button>
          </>
        ) : null}
      </MatchOverlayModal>

      <MatchOverlayModal
        open={Boolean(started && selectedPlayer && selectedFitness)}
        dismissOnBackdrop
        onClose={() => {
          setSelectedPlayerId(null)
          if (!done && !stoppageOpen && !tacticsOpen) setPlaying(true)
        }}
        className="max-w-2xl border-lime-400"
      >
        {selectedPlayer && selectedFitness ? (
          <MatchPlayerDetailPanel
            player={selectedPlayer}
            fitness={selectedFitness}
            injuryPart={selectedInjuryPart}
            minute={displayMinute}
            onClose={() => {
              setSelectedPlayerId(null)
              if (!done && !stoppageOpen && !tacticsOpen) setPlaying(true)
            }}
            className="border-0 shadow-none"
          />
        ) : null}
      </MatchOverlayModal>
    </div>
  )
}
