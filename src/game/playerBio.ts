import type { PlayerBio } from '@/game/types'

export type { PlayerBio }

export function parseMoneyGbp(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = String(raw).trim().replace(/,/g, '')
  const m = s.match(/£\s*([\d.]+)\s*([kmb])?/i)
  if (!m) {
    const n = Number(s.replace(/[£\s]/g, ''))
    return Number.isFinite(n) ? Math.round(n) : null
  }
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? '').toLowerCase()
  if (u === 'k') return Math.round(n * 1_000)
  if (u === 'm') return Math.round(n * 1_000_000)
  if (u === 'b') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

export function normalizeDate(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) return s
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return s
}

export function contractEndSeasonFromDate(expires: string | null | undefined): number | null {
  const d = normalizeDate(expires)
  if (!d) return null
  const y = Number(d.slice(0, 4))
  return Number.isFinite(y) ? y : null
}

export function yearsLeftFromExpires(
  expires: string | null | undefined,
  seasonStart = 2026,
): number | null {
  const end = contractEndSeasonFromDate(expires)
  if (end == null) return null
  return Math.max(0, end - seasonStart)
}

export function formatGbp(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `£${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}m`
  if (abs >= 1_000) return `£${(n / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`
  return `£${Math.round(n)}`
}
