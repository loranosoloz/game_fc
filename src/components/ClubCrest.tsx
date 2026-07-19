import { useState } from 'react'
import { cn } from '@/lib/cn'
import { crestUrlForClub } from '@/lib/crests'

type Size = 'xs' | 'sm' | 'md' | 'lg'

const SIZE: Record<Size, string> = {
  xs: 'h-5 w-5',
  sm: 'h-7 w-7',
  md: 'h-9 w-9',
  lg: 'h-12 w-12',
}

export function ClubCrest({
  club,
  size = 'sm',
  className,
}: {
  club: { name: string; shortName: string; color: string; crestKey?: string | null }
  size?: Size
  className?: string
}) {
  const src = crestUrlForClub(club)
  const [failed, setFailed] = useState(false)

  if (!src || failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white',
          SIZE[size],
          className,
        )}
        style={{ backgroundColor: club.color }}
        title={club.name}
        aria-hidden
      >
        {club.shortName.slice(0, 3)}
      </span>
    )
  }

  return (
    <img
      src={src}
      alt=""
      title={club.name}
      className={cn('inline-block shrink-0 object-contain', SIZE[size], className)}
      onError={() => setFailed(true)}
    />
  )
}
