import { useEffect, useMemo, useState } from 'react'
import type { MatchSpatialFrame, Player } from '@/game/types'
import { cn } from '@/lib/cn'
import {
  activityLabelTh,
  fitnessFromSpatial,
  staminaBarColor,
  staminaLabelTh,
  type MatchSquadStatus,
} from '@/game/matchFitness'
import { roleGroup } from '@/game/positions'

type SideTab = 'home' | 'away'

export function MatchSquadPanel({
  players,
  homeXi,
  awayXi,
  homeBench = [],
  awayBench = [],
  homeLabel,
  awayLabel,
  homeColor,
  awayColor,
  spatial,
  minute,
  status,
  selectedId,
  onSelect,
  /** แมตช์สด / demo ฝั่งคุณ — ไม่โชว์ stamina คู่แข่ง */
  ownSideOnly,
  focusSide,
}: {
  players: Player[]
  homeXi: string[]
  awayXi: string[]
  homeBench?: string[]
  awayBench?: string[]
  homeLabel: string
  awayLabel: string
  homeColor: string
  awayColor: string
  spatial?: MatchSpatialFrame | null
  minute: number
  status: MatchSquadStatus
  selectedId?: string | null
  onSelect: (id: string) => void
  ownSideOnly?: boolean
  /** ฝั่งที่เน้น (แมตช์สด = ทีมคุณ · demo = RMA/home) */
  focusSide?: SideTab
}) {
  const defaultSide = focusSide ?? 'home'
  const [tab, setTab] = useState<SideTab>(defaultSide)

  useEffect(() => {
    if (ownSideOnly && focusSide) setTab(focusSide)
  }, [ownSideOnly, focusSide])

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])

  const side = ownSideOnly ? defaultSide : tab
  const xi = side === 'home' ? homeXi : awayXi
  const bench = side === 'home' ? homeBench : awayBench
  const color = side === 'home' ? homeColor : awayColor
  const label = side === 'home' ? homeLabel : awayLabel

  const rows = [...xi, ...bench.filter((id) => !xi.includes(id))]

  return (
    <section className="flex h-full min-h-0 flex-col rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-100 px-3 py-2">
        <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
          รายชื่อ · พลังงาน{ownSideOnly ? ` · ${label}` : ''}
        </p>
        {!ownSideOnly ? (
        <div className="mt-1.5 flex gap-1">
          {(['home', 'away'] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setTab(s)}
              className={cn(
                'flex-1 rounded-md border px-2 py-1 text-xs font-bold',
                tab === s
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white',
              )}
            >
              <span
                className="mr-1 inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: s === 'home' ? homeColor : awayColor }}
              />
              {s === 'home' ? homeLabel : awayLabel}
            </button>
          ))}
        </div>
        ) : null}
        <p className="mt-1 text-[10px] text-slate-500">
          {ownSideOnly ? 'ทีมคุณ' : label} · นาที {minute}&apos; · กดชื่อดูรายละเอียดกลางจอ
        </p>
      </div>

      <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {rows.map((id) => {
          const p = byId.get(id)
          if (!p) return null
          const onPitch = status.onPitch.has(id)
          const sentOff = status.sentOff.has(id)
          const injured = status.injuredParts.has(id)
          const fitness = fitnessFromSpatial(spatial, id, p, minute, onPitch)
          const snap = spatial?.players.find((sp) => sp.id === id)
          const isXi = xi.includes(id)
          const active = spatial?.carrierId === id
          const selected = selectedId === id

          return (
            <li key={id}>
              <button
                type="button"
                onClick={() => onSelect(id)}
                disabled={sentOff}
                className={cn(
                  'w-full rounded-lg border px-2 py-1.5 text-left transition-colors',
                  selected
                    ? 'border-lime-500 bg-lime-50 ring-1 ring-lime-400'
                    : 'border-transparent hover:border-slate-200 hover:bg-slate-50',
                  sentOff && 'cursor-not-allowed opacity-45',
                )}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                      onPitch && !sentOff ? 'text-white' : 'bg-slate-200 text-slate-600',
                    )}
                    style={onPitch && !sentOff ? { backgroundColor: color } : undefined}
                  >
                    {p.overall}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1">
                      <span className="truncate text-xs font-semibold text-slate-900">
                        {p.name}
                      </span>
                      {active ? (
                        <span className="shrink-0 rounded bg-lime-200 px-1 text-[9px] font-bold text-lime-900">
                          บอล
                        </span>
                      ) : null}
                      {injured ? (
                        <span className="shrink-0 rounded bg-rose-100 px-1 text-[9px] font-bold text-rose-800">
                          เจ็บ
                        </span>
                      ) : null}
                      {sentOff ? (
                        <span className="shrink-0 rounded bg-red-100 px-1 text-[9px] font-bold text-red-800">
                          แดง
                        </span>
                      ) : null}
                      {!isXi && onPitch ? (
                        <span className="shrink-0 text-[9px] text-sky-700">ซับ</span>
                      ) : null}
                      {!onPitch && !sentOff && isXi ? null : !onPitch && !sentOff ? (
                        <span className="shrink-0 text-[9px] text-slate-400">ม้านั่ง</span>
                      ) : null}
                    </div>
                    <p className="text-[10px] text-slate-500">
                      {roleGroup(p.role)} · STA {p.attrs.stamina}
                      {onPitch && !sentOff
                        ? ` · ${activityLabelTh(snap?.activityLoad)} · ${staminaLabelTh(fitness.effective)}`
                        : ' · พัก — ไม่เสียพลัง'}
                    </p>
                  </div>
                </div>
                {onPitch && !sentOff ? (
                  <>
                <div className="mt-1.5 flex items-center gap-1.5">
                  <span className="w-8 shrink-0 text-[9px] font-medium text-slate-400">พลัง</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                    <span
                      className={cn('block h-full rounded-full', staminaBarColor(fitness.effective))}
                      style={{ width: `${Math.max(4, fitness.effective)}%` }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-700">
                    {fitness.effective}
                  </span>
                </div>
                <div className="mt-0.5 flex items-center gap-1.5">
                  <span className="w-8 shrink-0 text-[9px] font-medium text-slate-400">หัวใจ</span>
                  <span className="h-1 overflow-hidden rounded-full bg-slate-100 flex-1">
                    <span
                      className={cn(
                        'block h-full rounded-full',
                        fitness.heartRate >= 88
                          ? 'bg-rose-500'
                          : fitness.heartRate >= 72
                            ? 'bg-amber-500'
                            : 'bg-sky-400',
                      )}
                      style={{ width: `${Math.max(4, fitness.heartRate)}%` }}
                    />
                  </span>
                  <span className="w-7 shrink-0 text-right text-[10px] tabular-nums text-slate-500">
                    {fitness.heartRate}
                  </span>
                </div>
                  </>
                ) : (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="w-8 shrink-0 text-[9px] font-medium text-slate-400">พลัง</span>
                    <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                      <span
                        className="block h-full w-full rounded-full bg-slate-300"
                        style={{ width: '100%' }}
                      />
                    </span>
                    <span className="w-7 shrink-0 text-right text-[10px] font-bold tabular-nums text-slate-500">
                      {fitness.effective}
                    </span>
                  </div>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
