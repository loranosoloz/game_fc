import { cn } from '@/lib/cn'
import { staminaBarColor } from '@/game/matchFitness'

export function StatusBar({
  label,
  value,
  max = 100,
  colorClass,
  compact,
}: {
  label: string
  value: number
  max?: number
  /** override bar color e.g. stamina */
  colorClass?: string
  compact?: boolean
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  const barColor = colorClass ?? staminaBarColor(value)
  return (
    <li className={cn('flex items-center gap-2', compact ? 'text-[11px]' : 'text-xs')}>
      <span className={cn('shrink-0 text-slate-500', compact ? 'w-16' : 'w-20')}>{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
        <span
          className={cn('block h-full rounded transition-[width]', barColor)}
          style={{ width: `${pct}%` }}
        />
      </span>
      <span className={cn('text-right font-medium tabular-nums', compact ? 'w-8' : 'w-10')}>
        {max === 100 ? `${Math.round(value)}` : `${value}/${max}`}
      </span>
    </li>
  )
}
