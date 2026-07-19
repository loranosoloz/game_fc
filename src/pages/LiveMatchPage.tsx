import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MatchPitch } from '@/components/MatchPitch'
import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'
import type { MatchEventKind } from '@/game/types'
import { buildPitchPlayers, withActionOffset } from '@/game/pitchLayout'
import { getReferee, reputationLabel, strictnessLabel } from '@/game/referees'
import { MatchStatsPanel } from '@/components/MatchStatsPanel'

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
    case 'foul':
      return 'border-orange-300 bg-orange-50 text-orange-950'
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

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeed] = useState<'slow' | 'normal' | 'fast'>('normal')
  const [done, setDone] = useState(false)
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!live || !save) {
      navigate('/match', { replace: true })
    }
  }, [live, save, navigate])

  const events = live?.humanResult?.events ?? []
  const current = events[Math.min(index, Math.max(0, events.length - 1))]
  const visible = events.slice(0, index + 1).slice(-12)

  useEffect(() => {
    if (!playing || done || !live || events.length === 0) return
    if (index >= events.length - 1) {
      setDone(true)
      setPlaying(false)
      return
    }
    const t = window.setTimeout(() => setIndex((i) => i + 1), SPEED_MS[speed])
    return () => window.clearTimeout(t)
  }, [playing, done, index, speed, live, events.length])

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

  if (!save || !live || !current || !clubs) return null

  const pulse = current.kind === 'goal' || current.kind === 'shot'
  const active = pitchPlayers.find((p) => p.active)

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
              ? ` · ผู้ตัดสิน ${referee.name} (${reputationLabel(referee.reputation)} · ${strictnessLabel(referee.strictness)})`
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

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-slate-50"
          onClick={() => setPlaying((p) => !p)}
          disabled={done}
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
          onClick={() => {
            setIndex(events.length - 1)
            setDone(true)
            setPlaying(false)
          }}
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
        <MatchStatsPanel
          result={live.humanResult}
          homeName={clubs.home.name}
          awayName={clubs.away.name}
        />
      ) : null}
    </div>
  )
}
