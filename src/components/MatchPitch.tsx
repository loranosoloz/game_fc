import { motion } from 'motion/react'
import type { PitchSpot } from '@/game/types'
import { cn } from '@/lib/cn'

interface MatchPitchProps {
  spot: PitchSpot
  homeColor: string
  awayColor: string
  homeShort: string
  awayShort: string
  pulse?: boolean
  className?: string
}

export function MatchPitch({
  spot,
  homeColor,
  awayColor,
  homeShort,
  awayShort,
  pulse = false,
  className,
}: MatchPitchProps) {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-lg border border-emerald-900/40 shadow-inner',
        className,
      )}
      style={{
        background:
          'repeating-linear-gradient(90deg, #1f6b3a 0 12.5%, #1a5c32 12.5% 25%)',
      }}
    >
      <svg viewBox="0 0 100 64" className="block h-auto w-full" role="img" aria-label="Football pitch">
        <rect x="1" y="1" width="98" height="62" fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth="0.6" />
        <line x1="50" y1="1" x2="50" y2="63" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <circle cx="50" cy="32" r="8" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <circle cx="50" cy="32" r="0.7" fill="rgba(255,255,255,0.9)" />
        <rect x="1" y="18" width="14" height="28" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <rect x="1" y="24" width="5" height="16" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <rect x="85" y="18" width="14" height="28" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <rect x="94" y="24" width="5" height="16" fill="none" stroke="rgba(255,255,255,0.75)" strokeWidth="0.45" />
        <rect x="0.2" y="27" width="0.8" height="10" fill="rgba(255,255,255,0.95)" />
        <rect x="99" y="27" width="0.8" height="10" fill="rgba(255,255,255,0.95)" />
        <circle cx="4" cy="6" r="2.2" fill={homeColor} />
        <text x="8" y="7.2" fontSize="3.2" fill="white" fontFamily="sans-serif">
          {homeShort}
        </text>
        <circle cx="90" cy="6" r="2.2" fill={awayColor} />
        <text x="78" y="7.2" fontSize="3.2" fill="white" fontFamily="sans-serif" textAnchor="end">
          {awayShort}
        </text>
      </svg>

      <motion.div
        className="pointer-events-none absolute h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f8fafc] shadow-[0_0_14px_rgba(255,255,255,0.55)] ring-2 ring-slate-900/25"
        animate={{
          left: `${spot.x}%`,
          top: `${spot.y}%`,
          scale: pulse ? [1, 1.45, 1] : 1,
        }}
        transition={{
          left: { type: 'spring', stiffness: 90, damping: 16 },
          top: { type: 'spring', stiffness: 90, damping: 16 },
          scale: { duration: 0.4 },
        }}
        aria-hidden
      />
    </div>
  )
}
