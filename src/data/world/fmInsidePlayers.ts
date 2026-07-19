import pack from '@/data/world/fmInsideAttrs.json'
import type { FmInsideProfile } from '@/game/types'

const BY_NAME = (pack as { byName?: Record<string, FmInsideProfile> }).byName ?? {}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const BY_NORM: Record<string, FmInsideProfile> = {}
for (const [name, p] of Object.entries(BY_NAME)) {
  BY_NORM[normalize(name)] = p
}

export function fmInsideForPlayerName(name: string): FmInsideProfile | null {
  return BY_NAME[name] ?? BY_NORM[normalize(name)] ?? null
}
