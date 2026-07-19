import { useState } from 'react'
import { cn } from '@/lib/cn'
import { photoUrlForCoach } from '@/lib/coachPhotos'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  xs: 'h-6 w-6',
  sm: 'h-8 w-8',
  md: 'h-14 w-14',
  lg: 'h-20 w-20',
}

const TEXT: Record<Size, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-sm',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function CoachFace({
  coachId,
  name,
  size = 'sm',
  className,
}: {
  coachId?: string | null
  name: string
  size?: Size
  className?: string
}) {
  const src = photoUrlForCoach(coachId, name)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-indigo-800 font-bold text-white',
          SIZE[size],
          TEXT[size],
          className,
        )}
        title={name}
        aria-hidden
      >
        {initials(name)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      title={name}
      className={cn(
        'inline-block shrink-0 rounded-full bg-slate-100 object-cover object-top',
        SIZE[size],
        className,
      )}
      onError={() => setFailed(true)}
    />
  )
}
