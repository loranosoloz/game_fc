import { cn } from '@/lib/cn'
import { coachStatTo20 } from '@/lib/format'
import type { ReactNode } from 'react'

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 border-b border-slate-200/80 pb-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  )
}

export function Panel({
  children,
  className,
  tone = 'default',
}: {
  children: ReactNode
  className?: string
  tone?: 'default' | 'dark' | 'accent' | 'warn'
}) {
  return (
    <section
      className={cn(
        'rounded-xl border p-5 shadow-sm',
        tone === 'default' && 'border-slate-200/90 bg-white/90',
        tone === 'dark' && 'border-slate-800 bg-slate-900 text-slate-100',
        tone === 'accent' && 'border-lime-300/50 bg-lime-50/80',
        tone === 'warn' && 'border-amber-200 bg-amber-50/90',
        className,
      )}
    >
      {children}
    </section>
  )
}

export function StatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3 py-2.5',
        accent
          ? 'border-slate-800 bg-slate-900 text-lime-300'
          : 'border-slate-100 bg-slate-50/90',
      )}
    >
      <p className={cn('text-[11px] font-semibold tracking-wide uppercase', accent ? 'text-slate-400' : 'text-slate-500')}>
        {label}
      </p>
      <p className={cn('mt-0.5 text-lg font-bold tabular-nums', accent ? 'text-lime-300' : 'text-slate-900')}>
        {value}
      </p>
      {hint ? (
        <p className={cn('mt-0.5 text-xs', accent ? 'text-slate-400' : 'text-slate-500')}>{hint}</p>
      ) : null}
    </div>
  )
}

export function PrimaryButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  children,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cn(
        'rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-40',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
}

export function ProgressBar({
  value,
  max = 20,
  className,
}: {
  value: number
  max?: number
  className?: string
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-full bg-slate-200', className)}>
      <div className="h-full rounded-full bg-slate-800 transition-all" style={{ width: `${pct}%` }} />
    </div>
  )
}

/** แถบสtat โค้ชแบบ FM (สเกล /20 จากค่า 1–100 ภายใน) */
export function CoachStatRow({ label, value100 }: { label: string; value100: number }) {
  const v20 = coachStatTo20(value100)
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <ProgressBar value={v20} max={20} className="flex-1" />
      <span className="w-10 text-right font-semibold tabular-nums">{v20}/20</span>
    </div>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h3 className="text-xs font-bold tracking-[0.14em] text-slate-500 uppercase">{children}</h3>
  )
}
