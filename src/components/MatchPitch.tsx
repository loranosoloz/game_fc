import { motion } from 'motion/react'
import type { PitchSpot } from '@/game/types'
import { cn } from '@/lib/cn'

export interface PitchPlayerMarker {
  id: string
  label: string
  name: string
  side: 'home' | 'away'
  spot: PitchSpot
  active?: boolean
  /** ไฮไลต์ทีมที่ผู้เล่นคุม (รางวัล) */
  highlight?: boolean
}

/** เสื้อขาว/สว่าง (เช่น Real Madrid) ต้องตัวอักษรเข้ม + ขอบ ไม่งั้นมองไม่เห็นบนสนาม */
function kitContrast(hex: string): { text: string; ring: string } {
  const h = hex.replace('#', '').trim()
  const full =
    h.length === 3
      ? `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
      : h.padEnd(6, '0').slice(0, 6)
  const r = Number.parseInt(full.slice(0, 2), 16) || 0
  const g = Number.parseInt(full.slice(2, 4), 16) || 0
  const b = Number.parseInt(full.slice(4, 6), 16) || 0
  const light = 0.299 * r + 0.587 * g + 0.114 * b > 170
  return light
    ? { text: '#0f172a', ring: 'ring-slate-800/70' }
    : { text: '#ffffff', ring: 'ring-black/30' }
}

interface MatchPitchProps {
  spot: PitchSpot
  players: PitchPlayerMarker[]
  homeColor: string
  awayColor: string
  homeShort: string
  awayShort: string
  pulse?: boolean
  className?: string
  /** ซ่อนลูกบอล (เช่น หน้าทีมยอดเยี่ยม) */
  hideBall?: boolean
  /** โหมดรางวัล — ไม่แสดงป้ายเหย้า/เยือน */
  awardsMode?: boolean
  /** โมชันนุ่มสำหรับ demo ต่อเนื่อง */
  glide?: boolean
}

export function MatchPitch({
  spot,
  players,
  homeColor,
  awayColor,
  homeShort,
  awayShort,
  pulse = false,
  className,
  hideBall = false,
  awardsMode = false,
  glide = false,
}: MatchPitchProps) {
  const move = glide
    ? { type: 'tween' as const, duration: 0.28, ease: 'easeInOut' as const }
    : { type: 'spring' as const, stiffness: 100, damping: 18 }
  const ballMove = glide
    ? { type: 'tween' as const, duration: 0.22, ease: 'easeOut' as const }
    : { type: 'spring' as const, stiffness: 90, damping: 16 }
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
        {!awardsMode ? (
          <>
            <circle
              cx="4"
              cy="6"
              r="2.2"
              fill={homeColor}
              stroke={kitContrast(homeColor).text === '#0f172a' ? '#0f172a' : 'rgba(255,255,255,0.5)'}
              strokeWidth="0.35"
            />
            <text x="8" y="7.2" fontSize="3.2" fill="white" fontFamily="sans-serif">
              {homeShort}
            </text>
            <circle
              cx="90"
              cy="6"
              r="2.2"
              fill={awayColor}
              stroke={kitContrast(awayColor).text === '#0f172a' ? '#0f172a' : 'rgba(255,255,255,0.5)'}
              strokeWidth="0.35"
            />
            <text x="78" y="7.2" fontSize="3.2" fill="white" fontFamily="sans-serif" textAnchor="end">
              {awayShort}
            </text>
          </>
        ) : null}
      </svg>

      {players.map((p) => {
        const color = p.highlight ? '#65a30d' : p.side === 'home' ? homeColor : awayColor
        const contrast = kitContrast(color)
        return (
          <motion.div
            key={p.id}
            title={p.name}
            className={cn(
              'pointer-events-none absolute flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full text-[10px] font-bold shadow-md ring-2',
              p.highlight || p.active ? 'z-20 ring-lime-300' : cn('z-10', contrast.ring),
            )}
            style={{ backgroundColor: color, color: contrast.text }}
            animate={{
              left: `${p.spot.x}%`,
              top: `${p.spot.y}%`,
              scale: p.highlight || p.active ? 1.2 : 1,
            }}
            transition={{
              left: move,
              top: move,
              scale: { duration: 0.2 },
            }}
          >
            {p.label}
          </motion.div>
        )
      })}

      {!hideBall ? (
        <motion.div
          className="pointer-events-none absolute z-30 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#f8fafc] shadow-[0_0_14px_rgba(255,255,255,0.55)] ring-2 ring-slate-900/25"
          animate={{
            left: `${spot.x}%`,
            top: `${spot.y}%`,
            scale: pulse ? [1, 1.45, 1] : 1,
          }}
          transition={{
            left: ballMove,
            top: ballMove,
            scale: { duration: 0.35 },
          }}
          aria-hidden
        />
      ) : null}
    </div>
  )
}
