import biosEng from '@/data/world/playerBiosEng.json'
import biosEsp from '@/data/world/playerBiosEsp.json'
import biosGer from '@/data/world/playerBiosGer.json'
import biosFra from '@/data/world/playerBiosFra.json'
import biosIta from '@/data/world/playerBiosIta.json'
import biosEsp2 from '@/data/world/playerBiosEsp2.json'
import biosGer2 from '@/data/world/playerBiosGer2.json'
import biosFra2 from '@/data/world/playerBiosFra2.json'
import biosIta2 from '@/data/world/playerBiosIta2.json'
import biosEng2 from '@/data/world/playerBiosEng2.json'
import biosSau from '@/data/world/playerBiosSau.json'
import biosTur from '@/data/world/playerBiosTur.json'
import biosSau2 from '@/data/world/playerBiosSau2.json'
import type { PlayerBio } from '@/game/types'

type Pack = { byName?: Record<string, PlayerBio & { name?: string; age?: number; clubKey?: string }> }

function normalize(name: string): string {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/** Eng first; later packs overwrite same-name keys. */
const PACKS: Pack[] = [
  biosEng as Pack,
  biosEsp as Pack,
  biosGer as Pack,
  biosFra as Pack,
  biosIta as Pack,
  biosEsp2 as Pack,
  biosGer2 as Pack,
  biosFra2 as Pack,
  biosIta2 as Pack,
  biosEng2 as Pack,
  biosSau as Pack,
  biosTur as Pack,
  biosSau2 as Pack,
]

const BY_NAME: Record<string, PlayerBio> = {}
for (const pack of PACKS) {
  for (const [name, bio] of Object.entries(pack.byName ?? {})) {
    BY_NAME[name] = bio
  }
}

const BY_NORM: Record<string, PlayerBio> = {}
for (const [name, bio] of Object.entries(BY_NAME)) {
  BY_NORM[normalize(name)] = bio
}

export function bioForPlayerName(name: string): PlayerBio | null {
  return BY_NAME[name] ?? BY_NORM[normalize(name)] ?? null
}
