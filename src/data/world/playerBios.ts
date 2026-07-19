import biosJson from '@/data/world/playerBiosEng.json'
import type { PlayerBio } from '@/game/types'

type Pack = { byName?: Record<string, PlayerBio & { name?: string; age?: number; clubKey?: string }> }

const BY_NAME = (biosJson as Pack).byName ?? {}

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const BY_NORM: Record<string, PlayerBio> = {}
for (const [name, bio] of Object.entries(BY_NAME)) {
  BY_NORM[normalize(name)] = bio
}

export function bioForPlayerName(name: string): PlayerBio | null {
  return BY_NAME[name] ?? BY_NORM[normalize(name)] ?? null
}
