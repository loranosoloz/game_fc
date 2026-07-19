import { useState } from 'react'
import type { BodyPartId, Player } from '@/game/types'
import {
  BODY_PART_LABEL,
  BODY_PARTS,
  bodyMapSummary,
  bodyPartColor,
  bodyPartTone,
  ensureBodyMap,
  weakestBodyParts,
} from '@/game/bodyMap'
import { cn } from '@/lib/cn'

type Region = { id: BodyPartId; d: string }

/** Front-facing silhouette regions (viewBox 0 0 200 420) */
const REGIONS: Region[] = [
  { id: 'head', d: 'M100 8 c-18 0-32 14-32 32 c0 20 14 34 32 34 s32-14 32-34 c0-18-14-32-32-32z' },
  { id: 'neck', d: 'M88 72 h24 v18 h-24z' },
  { id: 'shoulderL', d: 'M42 90 l28 4 v22 l-32-8z' },
  { id: 'shoulderR', d: 'M158 90 l-28 4 v22 l32-8z' },
  { id: 'chest', d: 'M70 92 h60 v48 h-60z' },
  { id: 'back', d: 'M78 140 h44 v28 h-44z' },
  { id: 'armL', d: 'M38 112 l22 6 v70 l-20-10z' },
  { id: 'armR', d: 'M162 112 l-22 6 v70 l20-10z' },
  { id: 'handL', d: 'M34 186 l18 4 v22 l-16-6z' },
  { id: 'handR', d: 'M166 186 l-18 4 v22 l16-6z' },
  { id: 'abdomen', d: 'M74 168 h52 v36 h-52z' },
  { id: 'groin', d: 'M82 200 h36 v22 h-36z' },
  { id: 'thighL', d: 'M74 220 h24 v58 h-28z' },
  { id: 'thighR', d: 'M102 220 h24 v58 h-20z' },
  { id: 'kneeL', d: 'M72 276 h26 v22 h-28z' },
  { id: 'kneeR', d: 'M102 276 h26 v22 h-24z' },
  { id: 'calfL', d: 'M72 296 h24 v52 h-26z' },
  { id: 'calfR', d: 'M104 296 h24 v52 h-22z' },
  { id: 'ankleL', d: 'M72 346 h22 v16 h-24z' },
  { id: 'ankleR', d: 'M106 346 h22 v16 h-20z' },
  { id: 'footL', d: 'M64 360 h34 v18 h-38z' },
  { id: 'footR', d: 'M102 360 h34 v18 h-30z' },
]

export function BodyMapFigure({
  player,
  className,
  compact,
}: {
  player: Player
  className?: string
  compact?: boolean
}) {
  const map = ensureBodyMap(player)
  const [hover, setHover] = useState<BodyPartId | null>(null)
  const summary = bodyMapSummary(player)
  const weak = weakestBodyParts(player, 4)
  const active = hover ?? player.injuryBodyPart

  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-start', className)}>
      <div className="mx-auto shrink-0">
        <svg
          viewBox="0 0 200 420"
          className={cn('drop-shadow-sm', compact ? 'h-52 w-auto' : 'h-72 w-auto')}
          role="img"
          aria-label={`แผนที่ร่างกาย ${player.name}`}
        >
          <title>{player.name} — body map</title>
          {REGIONS.map((r) => {
            const fit = map[r.id]
            const isActive = active === r.id || player.injuryBodyPart === r.id
            return (
              <path
                key={r.id}
                d={r.d}
                fill={bodyPartColor(fit)}
                fillOpacity={isActive ? 0.95 : 0.78}
                stroke={isActive ? '#0f172a' : '#334155'}
                strokeWidth={isActive ? 2.2 : 1}
                className="cursor-pointer transition-opacity hover:opacity-100"
                onMouseEnter={() => setHover(r.id)}
                onMouseLeave={() => setHover(null)}
              >
                <title>
                  {BODY_PART_LABEL[r.id]} · {fit}% ({bodyPartTone(fit)})
                </title>
              </path>
            )
          })}
        </svg>
        <div className="mt-2 flex justify-center gap-3 text-[10px] font-semibold tracking-wide uppercase">
          <span className="text-emerald-700">เขียว {summary.green}</span>
          <span className="text-amber-700">เหลือง {summary.yellow}</span>
          <span className="text-rose-700">แดง {summary.red}</span>
        </div>
      </div>

      <div className="min-w-0 flex-1 space-y-2 text-sm">
        <p className="text-xs text-slate-500">
          เขียว = แข็งแรง · เหลือง = อ่อนล้า/เสี่ยง · แดง = วิกฤตหรือเจ็บ
        </p>
        {active ? (
          <p className="rounded-md bg-slate-50 px-2 py-1.5 text-sm">
            <span className="font-semibold">{BODY_PART_LABEL[active]}</span>
            <span className="text-slate-600"> · {map[active]}%</span>
            {player.injuryBodyPart === active && player.injuryDays > 0 ? (
              <span className="ml-1 font-medium text-rose-700">(บาดเจ็บ {player.injuryDays} วัน)</span>
            ) : null}
          </p>
        ) : (
          <p className="text-xs text-slate-500">ชี้ที่ส่วนร่างกายเพื่อดูรายละเอียด</p>
        )}
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">จุดอ่อน</p>
          <ul className="mt-1 space-y-1">
            {weak.map((w) => (
              <li key={w.part} className="flex justify-between gap-2 text-xs">
                <span>{w.label}</span>
                <span
                  className={cn(
                    'font-semibold',
                    bodyPartTone(w.fitness) === 'red' && 'text-rose-700',
                    bodyPartTone(w.fitness) === 'yellow' && 'text-amber-700',
                    bodyPartTone(w.fitness) === 'green' && 'text-emerald-700',
                  )}
                >
                  {w.fitness}%
                </span>
              </li>
            ))}
          </ul>
        </div>
        {!compact ? (
          <details className="text-xs text-slate-600">
            <summary className="cursor-pointer font-medium">ทุกส่วน ({BODY_PARTS.length})</summary>
            <ul className="mt-1 grid max-h-36 grid-cols-2 gap-x-2 gap-y-0.5 overflow-y-auto">
              {BODY_PARTS.map((part) => (
                <li key={part} className="flex justify-between gap-1">
                  <span>{BODY_PART_LABEL[part]}</span>
                  <span style={{ color: bodyPartColor(map[part]) }} className="font-semibold">
                    {map[part]}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </div>
  )
}
