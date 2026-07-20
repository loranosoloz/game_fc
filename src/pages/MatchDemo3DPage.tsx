/**
 * เดโมแมตช์ 3D (Three.js) — แยกจาก MatchDemoPage 2D
 * ใช้ AI / ซิมเดิม (buildMatchDemo) แค่เรนเดอร์คนละแบบ
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { MatchPitch3D } from '@/components/MatchPitch3D'
import { cn } from '@/lib/cn'
import type { MatchEventKind, PitchSpot } from '@/game/types'
import {
  ballSpotFromSpatialDemo,
  buildKickoffMarkers,
  KICKOFF_BALL_SPOT,
  lerpSpatialFrames,
  markersFromSpatialFrame,
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
  isDemoFeedEvent,
} from '@/game/matchDemoMeta'
import type { MatchDemoBundle } from '@/game/matchDemo'

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

export function MatchDemo3DPage() {
  const [bundle, setBundle] = useState<MatchDemoBundle | null>(null)
  const [loading, setLoading] = useState(true)
  const [status, setStatus] = useState('กำลังเตรียม…')
  const [error, setError] = useState<string | null>(null)
  const [started, setStarted] = useState(false)
  const [playing, setPlaying] = useState(false)
  const [done, setDone] = useState(false)
  const [wallMs, setWallMs] = useState(0)
  const [index, setIndex] = useState(0)
  const [blendT, setBlendT] = useState(0)
  const [renderMarkers, setRenderMarkers] = useState<DemoPitchMarker[]>([])

  const rafRef = useRef<number | null>(null)
  const lastTsRef = useRef<number | null>(null)
  const displayPosRef = useRef(new Map<string, PitchSpot>())
  const targetMarkersRef = useRef<DemoPitchMarker[]>([])
  const kickoffPlayersRef = useRef<DemoPitchMarker[]>([])
  const feedRef = useRef<HTMLDivElement>(null)

  const runDemo = (seed = Date.now() % 1_000_000) => {
    setLoading(true)
    setError(null)
    setStatus('กำลังซิม El Clásico (3D)…')
    setStarted(false)
    setPlaying(false)
    setDone(false)
    setWallMs(0)
    setIndex(0)
    setBlendT(0)
    setRenderMarkers([])
    displayPosRef.current.clear()

    void (async () => {
      try {
        const { buildMatchDemo } = await import('@/game/matchDemo')
        await new Promise((r) => window.setTimeout(r, 40))
        const next = buildMatchDemo({ seed })
        setBundle(next)
        setLoading(false)
      } catch (e) {
        setBundle(null)
        setLoading(false)
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }

  useEffect(() => {
    runDemo()
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const kickoffPlayers = useMemo(() => {
    if (!bundle) return [] as DemoPitchMarker[]
    const markers = buildKickoffMarkers(bundle.homeXi, bundle.awayXi, bundle.players)
    kickoffPlayersRef.current = markers
    return markers
  }, [bundle])

  const timeline = useMemo(
    () => (bundle ? buildDemoTimeline(bundle.events) : []),
    [bundle],
  )

  const events = bundle?.events ?? []
  const current = events[Math.min(index, Math.max(0, events.length - 1))]
  const nextEv = events[index + 1]

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
    if (!started || !playing || done || !bundle || loading || timeline.length === 0) {
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
          setRenderMarkers(blendDemoMarkers(kickoffPlayersRef.current, targets, intro))
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
  }, [started, playing, done, bundle, loading, timeline])

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
      // markersFromSpatialFrame ไม่ snap คนถือลูกเข้าจุดบอล → ลื่นกว่าบน 3D
      const raw = markersFromSpatialFrame(spatialFrame, bundle.players)
      return applyDemoSupportRuns(raw, ball, spatialFrame.possessing, bundle.players)
    }
    return kickoffPlayers
  }, [bundle, started, kickoffPlayers, spatialFrame])

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

  const feed = useMemo(() => {
    if (!bundle || !started) return []
    return events
      .slice(0, index + 1)
      .filter((e) => isDemoFeedEvent(e))
      .slice(-24)
  }, [bundle, started, events, index])

  useEffect(() => {
    feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
  }, [feed.length])

  return (
    <div className="flex min-h-full flex-col bg-slate-950 text-slate-100">
      <header className="flex flex-wrap items-center gap-3 border-b border-slate-800 px-4 py-3">
        <Link to="/" className="text-xs font-semibold text-slate-400 hover:text-white">
          ← หน้าหลัก
        </Link>
        <h1 className="text-sm font-bold tracking-wide text-lime-300">
          El Clásico · 3D (Three.js)
        </h1>
        <Link
          to="/match-demo"
          className="rounded border border-slate-600 px-2 py-1 text-[11px] text-slate-300 hover:bg-slate-800"
        >
          เปิดเวอร์ชัน 2D
        </Link>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          {bundle ? (
            <span className="tabular-nums text-sm font-bold">
              {bundle.home.shortName} {bundle.result.homeGoals}–{bundle.result.awayGoals}{' '}
              {bundle.away.shortName}
            </span>
          ) : null}
          <span className="tabular-nums text-xs text-slate-400">{formatClock(wallMs)}</span>
          {!started ? (
            <button
              type="button"
              disabled={loading || !bundle}
              onClick={startMatch}
              className="rounded-md bg-lime-300 px-3 py-1.5 text-xs font-bold text-slate-900 disabled:opacity-50"
            >
              Start
            </button>
          ) : (
            <button
              type="button"
              disabled={done}
              onClick={() => setPlaying((p) => !p)}
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800 disabled:opacity-50"
            >
              {playing ? 'Pause' : 'Play'}
            </button>
          )}
          <button
            type="button"
            onClick={() => runDemo()}
            className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold hover:bg-slate-800"
          >
            ซิมใหม่
          </button>
        </div>
      </header>

      <div className="grid flex-1 gap-3 p-3 lg:grid-cols-[1fr_280px]">
        <div className="flex min-h-0 flex-col gap-2">
          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center rounded-lg border border-slate-800 text-sm text-slate-400">
              {status}
            </div>
          ) : error ? (
            <div className="rounded-lg border border-red-500/40 bg-red-950/40 p-4 text-sm text-red-200">
              {error}
            </div>
          ) : bundle ? (
            <>
              <MatchPitch3D
                className="min-h-[520px] flex-1"
                spot={ballSpot}
                players={pitchPlayers}
                homeColor={bundle.home.color}
                awayColor={bundle.away.color}
              />
              <p className="text-[11px] text-slate-500">
                ลากเมาส์หมุนมุมมอง · สกรอลล์ซูม · AI แมตช์เดียวกับเดโม 2D
              </p>
              {current ? (
                <p className="truncate text-xs text-slate-300">
                  <span className="font-bold tabular-nums text-lime-300">{current.minute}&apos;</span>{' '}
                  {current.text}
                </p>
              ) : null}
            </>
          ) : null}
        </div>

        <aside className="flex max-h-[70vh] flex-col rounded-lg border border-slate-800 bg-slate-900/60">
          <div className="border-b border-slate-800 px-3 py-2 text-[11px] font-bold tracking-wider text-slate-400 uppercase">
            ฟีดแมตช์
          </div>
          <div ref={feedRef} className="flex-1 space-y-1.5 overflow-y-auto p-2">
            {!started ? (
              <p className="p-2 text-xs text-slate-500">กด Start เพื่อเล่นซิมบนสนาม 3D</p>
            ) : (
              feed.map((ev) => (
                <div
                  key={ev.id}
                  className={cn('rounded-md border px-2 py-1.5 text-xs', kindTone(ev.kind, ev.cardColor))}
                >
                  <span className="font-bold tabular-nums">{ev.minute}&apos;</span> · {ev.text}
                </div>
              ))
            )}
          </div>
        </aside>
      </div>
    </div>
  )
}
