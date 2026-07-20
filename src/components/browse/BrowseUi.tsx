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
