import type { FmInsideAttrs, FmInsideProfile, PlayerAttributes } from '@/game/types'
import { clampAttr } from '@/game/attributes'

export type { FmInsideAttrs, FmInsideProfile }

function pick(attrs: FmInsideAttrs, ...keys: string[]): number {
  for (const k of keys) {
    const t =
      attrs.goalkeeping?.[k] ??
      attrs.technical[k] ??
      attrs.mental[k] ??
      attrs.physical[k] ??
      attrs.setPieces[k]
    if (typeof t === 'number') return t
  }
  return 50
}

/** FMInside profile → in-game attrs (same 1–99 scale) */
export function playerAttrsFromFmInside(p: FmInsideProfile): PlayerAttributes {
  const a = p.attrs
  const pace = Math.round((pick(a, 'Pace') + pick(a, 'Acceleration')) / 2)
  return {
    finishing: clampAttr(pick(a, 'Finishing')),
    passing: clampAttr(pick(a, 'Passing')),
    tackling: clampAttr(pick(a, 'Tackling')),
    dribbling: clampAttr(pick(a, 'Dribbling')),
    crossing: clampAttr(pick(a, 'Crossing')),
    heading: clampAttr(pick(a, 'Heading')),
    technique: clampAttr(pick(a, 'Technique')),
    decision: clampAttr(pick(a, 'Decisions')),
    vision: clampAttr(pick(a, 'Vision')),
    composure: clampAttr(pick(a, 'Composure')),
    positioning: clampAttr(pick(a, 'Positioning')),
    workRate: clampAttr(pick(a, 'Work Rate')),
    pace: clampAttr(pace),
    stamina: clampAttr(pick(a, 'Stamina')),
    strength: clampAttr(pick(a, 'Strength')),
    agility: clampAttr(pick(a, 'Agility')),
    jumping: clampAttr(pick(a, 'Jumping Reach')),
    handling: clampAttr(pick(a, 'Handling') || Math.round(pick(a, 'First Touch') * 0.4)),
    reflexes: clampAttr(pick(a, 'Reflexes') || pick(a, 'Agility')),
    aerialReach: clampAttr(pick(a, 'Aerial Reach') || pick(a, 'Jumping Reach')),
  }
}

export function parseEuro(raw: string | null | undefined): number | null {
  if (!raw) return null
  const s = raw.replace(/\s/g, '').replace(/€/g, '')
  const m = s.match(/([\d.,]+)\s*([KMB])?/i)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? '').toUpperCase()
  if (u === 'K') return Math.round(n * 1_000)
  if (u === 'M') return Math.round(n * 1_000_000)
  if (u === 'B') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

function slugify(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/** Parse FMInside player page markdown (from WebFetch) */
export function parseFmInsideMarkdown(md: string, fmIdHint?: string): FmInsideProfile | null {
  const text = String(md)
  const nameM = text.match(/^#\s+(.+)$/m)
  const name = nameM?.[1]?.trim()
  if (!name) return null

  const grab = (label: string) => {
    const re = new RegExp(label.replace(/\s+/g, '\\s*') + '\\s*([^\\n]+)', 'i')
    const m = text.match(re)
    return m ? m[1].trim() : null
  }

  const age = Number(grab('Age')?.replace(/\D/g, '')) || undefined
  const heightRaw = grab('Height')
  const heightCm = heightRaw ? Number(heightRaw.replace(/\D/g, '')) || null : null
  const leftFoot = Number(grab('Left foot')) || null
  const rightFoot = Number(grab('Right foot')) || null
  const positions = grab('Position\\(s\\)') || grab('Position')
  const capsRaw = grab('Caps / Goals')
  let caps: number | null = null
  let goalsIntl: number | null = null
  if (capsRaw) {
    const cm = capsRaw.match(/(\d+)\s*\/\s*(\d+)/)
    if (cm) {
      caps = Number(cm[1])
      goalsIntl = Number(cm[2])
    }
  }

  const club = grab('Club')
  const sellValueEur = parseEuro(grab('Sell value'))
  const wageEurPw = parseEuro(grab('Wages')?.replace(/\s*pw/i, ''))
  const contractEnd = grab('Contract end')

  const fmId =
    fmIdHint ||
    text.match(/players\/7-fm-26\/(\d+)/)?.[1] ||
    text.match(/\/(\d{5,})-[a-z0-9-]+\/?/i)?.[1] ||
    ''

  const parseAttrsBlock = (heading: string): Record<string, number> => {
    const out: Record<string, number> = {}
    const re = new RegExp(`###\\s*${heading}[\\s\\S]*?(?=###|$)`, 'i')
    const block = text.match(re)?.[0] ?? ''
    for (const m of block.matchAll(/\|\s*([^|]+?)\s*\|\s*(\d{1,3})\s*\|/g)) {
      const key = m[1]!.trim()
      if (key.length < 2 || /^-+$/.test(key)) continue
      out[key] = Number(m[2])
    }
    return out
  }

  const attrs: FmInsideAttrs = {
    goalkeeping: parseAttrsBlock('Goalkeeping'),
    technical: parseAttrsBlock('Technical'),
    mental: parseAttrsBlock('Mental'),
    physical: parseAttrsBlock('Physical'),
    setPieces: parseAttrsBlock('Set Pieces'),
  }

  const parseRoles = (heading: string) => {
    const out: { name: string; score: number }[] = []
    const re = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=##\\s|#\\s|$)`, 'i')
    const block = text.match(re)?.[0] ?? ''
    for (const m of block.matchAll(/\d+\.\s+(.+?)(\d+(?:\.\d+)?)/g)) {
      out.push({ name: m[1]!.trim(), score: Number(m[2]) })
    }
    return out.slice(0, 8)
  }

  return {
    fmId: String(fmId),
    name,
    age,
    heightCm,
    leftFoot,
    rightFoot,
    positions,
    caps,
    goalsIntl,
    club,
    sellValueEur,
    wageEurPw,
    contractEnd,
    attrs,
    bestRolesIn: parseRoles('Best in posession roles'),
    bestRolesOut: parseRoles('Best out posession roles'),
    sourceUrl: fmId
      ? `https://fminside.net/players/7-fm-26/${fmId}-${slugify(name)}/`
      : undefined,
  }
}

export function formatEur(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  const abs = Math.abs(n)
  if (abs >= 1_000_000) return `€${(n / 1_000_000).toFixed(abs >= 10_000_000 ? 0 : 1)}M`
  if (abs >= 1_000) return `€${(n / 1_000).toFixed(0)}K`
  return `€${Math.round(n)}`
}
