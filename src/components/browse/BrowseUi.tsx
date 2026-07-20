import type { ReactNode, SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

const iconCls = 'size-4 shrink-0'

export function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="9" cy="7" r="3.25" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a3.25 3.25 0 0 1 0 6.74"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconWhistle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="M8.5 14.5 4 19M14 8l6.5-3.5M9 15a5 5 0 1 0 0-10 5 5 0 0 0 0 10Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="9" cy="10" r="1.25" fill="currentColor" />
    </svg>
  )
}

export function IconBriefcase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <rect
        x="3"
        y="7"
        width="18"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
      <path
        d="M8 7V5.5A1.5 1.5 0 0 1 9.5 4h5A1.5 1.5 0 0 1 16 5.5V7M3 12h18"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconLive({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <circle cx="12" cy="12" r="3" fill="currentColor" />
      <path
        d="M5.5 12a6.5 6.5 0 0 1 13 0M2.5 12a9.5 9.5 0 0 1 19 0"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconPackage({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="m12 2 9 5v10l-9 5-9-5V7l9-5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path d="M12 12 3 7M12 12v10M12 12l9-5" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

export function IconBuilding({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="M4 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M14 10h5a1 1 0 0 1 1 1v10M4 21h16M8 8h2M8 12h2M8 16h2"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function IconStatus({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="M4 14h4v6H4zM10 9h4v11h-4zM16 4h4v16h-4z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <circle cx="11" cy="11" r="6.25" stroke="currentColor" strokeWidth="1.75" />
      <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  )
}

export function IconLayers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="m12 3 9 5-9 5-9-5 9-5ZM3 13l9 5 9-5M3 17l9 5 9-5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconChevronDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn('size-3.5 shrink-0', className)} aria-hidden>
      <path
        d="m6 9 6 6 6-6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function IconDatabase({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <ellipse cx="12" cy="5" rx="8" ry="3" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  )
}

export function IconSpark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn(iconCls, className)} aria-hidden>
      <path
        d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="12" r="3.25" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  )
}

export function FilterSelect({
  label,
  icon,
  className,
  children,
  ...props
}: {
  label: string
  icon: ReactNode
  className?: string
  children: ReactNode
} & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className={cn('grid gap-1 text-xs', className)}>
      <span className="flex items-center gap-1.5 font-medium text-slate-600">
        <span className="text-slate-500">{icon}</span>
        {label}
      </span>
      <div className="relative">
        <select
          {...props}
          className={cn(
            'w-full appearance-none rounded-md border border-slate-300 bg-white py-2 pr-8 pl-2.5 text-sm outline-none ring-lime-400 focus:ring-2',
            props.disabled && 'opacity-40',
          )}
        >
          {children}
        </select>
        <span className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-slate-400">
          <IconChevronDown />
        </span>
      </div>
    </label>
  )
}

export function SearchField({
  label = 'ค้นหา',
  value,
  onChange,
  placeholder,
  className,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  className?: string
}) {
  return (
    <label className={cn('grid min-w-[14rem] flex-1 gap-1 text-xs', className)}>
      <span className="flex items-center gap-1.5 font-medium text-slate-600">
        <IconSearch className="text-slate-500" />
        {label}
      </span>
      <div className="relative">
        <IconSearch className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-slate-400" />
        <input
          className="w-full rounded-md border border-slate-300 bg-white py-2 pr-3 pl-8 text-sm outline-none ring-lime-400 focus:ring-2"
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </label>
  )
}

export const BROWSE_PAGE_SIZE = 100

export function pageSlice<T>(items: T[], page: number, size = BROWSE_PAGE_SIZE): T[] {
  const p = Math.max(1, page)
  const start = (p - 1) * size
  return items.slice(start, start + size)
}

/** Full-viewport shell — one page scroll only via child panes. */
export function BrowsePageShell({
  header,
  children,
}: {
  header: ReactNode
  children: ReactNode
}) {
  return (
    <div className="flex h-dvh w-full flex-col overflow-hidden bg-slate-100">
      {header}
      <div className="mx-auto flex min-h-0 w-full max-w-[1800px] flex-1 flex-col gap-3 overflow-hidden px-4 py-3 lg:gap-3 lg:px-6 lg:py-3">
        {children}
      </div>
    </div>
  )
}

export function BrowseFilterBar({ children }: { children: ReactNode }) {
  return (
    <div className="shrink-0 rounded-xl border border-slate-200/90 bg-white px-3 py-2.5 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  )
}

export function BrowseSplit({ list, detail }: { list: ReactNode; detail: ReactNode }) {
  return (
    <div className="grid min-h-0 flex-1 gap-3 xl:grid-cols-[minmax(0,1.2fr)_minmax(380px,0.95fr)]">
      {list}
      {detail}
    </div>
  )
}

export function BrowseListPane({
  title,
  subtitle,
  children,
  pager,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  pager?: ReactNode
}) {
  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      <div className="shrink-0 border-b border-slate-200 px-4 py-2.5">
        <h3 className="text-sm font-bold text-slate-900">{title}</h3>
        {subtitle ? <div className="mt-0.5 text-xs text-slate-500">{subtitle}</div> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
      {pager}
    </section>
  )
}

export function BrowseDetailPane({
  children,
  empty,
  header,
  tabs,
}: {
  children?: ReactNode
  empty?: ReactNode
  header?: ReactNode
  tabs?: ReactNode
}) {
  if (!children) {
    return (
      <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center">
          {empty ?? <p className="text-sm text-slate-500">เลือกรายการจากตารางเพื่อดูรายละเอียด</p>}
        </div>
      </section>
    )
  }

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
      {header ? <div className="shrink-0 border-b border-slate-200 px-4 pt-4 pb-3">{header}</div> : null}
      {tabs ? <div className="shrink-0 px-2">{tabs}</div> : null}
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-3">{children}</div>
    </section>
  )
}

export function DetailTabs<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: { id: T; label: string }[]
  value: T
  onChange: (id: T) => void
}) {
  return (
    <div className="flex gap-0.5 border-b border-slate-200" role="tablist">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            '-mb-px border-b-2 px-3 py-2 text-xs font-semibold transition-colors',
            value === t.id
              ? 'border-lime-500 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function AttrGrid({
  children,
  cols = 3,
}: {
  children: ReactNode
  cols?: 2 | 3
}) {
  return (
    <ul
      className={cn(
        'grid gap-x-3 gap-y-1 text-xs',
        cols === 3 ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-2',
      )}
    >
      {children}
    </ul>
  )
}

/** สีค่าพลัง — ใกล้ max (เช่น 99) = เขียวชัด · ต่ำ = เทา/แดง */
export function attrValueTone(value: number, max = 99): {
  text: string
  chip: string
} {
  const pct = max <= 0 ? 0 : Math.max(0, Math.min(1, value / max))
  if (pct >= 0.85) {
    return { text: 'text-emerald-800', chip: 'bg-emerald-100' }
  }
  if (pct >= 0.7) {
    return { text: 'text-lime-800', chip: 'bg-lime-100' }
  }
  if (pct >= 0.55) {
    return { text: 'text-sky-800', chip: 'bg-sky-50' }
  }
  if (pct >= 0.4) {
    return { text: 'text-slate-700', chip: 'bg-slate-100' }
  }
  if (pct >= 0.25) {
    return { text: 'text-amber-800', chip: 'bg-amber-50' }
  }
  return { text: 'text-rose-700', chip: 'bg-rose-50' }
}

export function AttrRow({
  label,
  value,
  max = 99,
}: {
  label: string
  value: number
  max?: number
}) {
  const tone = attrValueTone(value, max)
  return (
    <li className="flex min-w-0 items-center justify-between gap-2 border-b border-slate-100 py-1 last:border-0">
      <span className="truncate text-slate-500">{label}</span>
      <span
        className={cn(
          'inline-flex min-w-[1.75rem] justify-center rounded px-1.5 py-0.5 text-[11px] font-bold tabular-nums',
          tone.text,
          tone.chip,
        )}
      >
        {value}
      </span>
    </li>
  )
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-1.5 text-[11px] font-bold text-slate-500 uppercase">{children}</h4>
  )
}

export function ListPager({
  page,
  total,
  pageSize = BROWSE_PAGE_SIZE,
  onPage,
}: {
  page: number
  total: number
  pageSize?: number
  onPage: (page: number) => void
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const safe = Math.min(Math.max(1, page), pages)
  const from = total === 0 ? 0 : (safe - 1) * pageSize + 1
  const to = Math.min(safe * pageSize, total)

  if (total === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-slate-50/80 px-3 py-2 text-xs text-slate-600">
      <span>
        {from.toLocaleString('th-TH')}–{to.toLocaleString('th-TH')} จาก{' '}
        {total.toLocaleString('th-TH')} · หน้า {safe}/{pages}
      </span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
          disabled={safe <= 1}
          onClick={() => onPage(1)}
        >
          «
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
          disabled={safe <= 1}
          onClick={() => onPage(safe - 1)}
        >
          ก่อนหน้า
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
          disabled={safe >= pages}
          onClick={() => onPage(safe + 1)}
        >
          ถัดไป
        </button>
        <button
          type="button"
          className="rounded border border-slate-300 bg-white px-2.5 py-1 font-semibold hover:bg-slate-100 disabled:opacity-40"
          disabled={safe >= pages}
          onClick={() => onPage(pages)}
        >
          »
        </button>
      </div>
    </div>
  )
}
