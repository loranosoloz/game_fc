import playersEsp from '@/data/world/playersEsp.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'
import { youthRosterFromPack } from './youthFromPack'

type EspPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 La Liga real squads — keyed by club key */
export function espRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersEsp as { clubs: Record<string, EspPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function espYouthForClub(clubKey: string): StarDef[] {
  return youthRosterFromPack(playersEsp as { youth?: Record<string, EspPlayerRow[]> }, clubKey)
}

export function espRosterClubKeys(): string[] {
  return Object.keys((playersEsp as { clubs: Record<string, EspPlayerRow[]> }).clubs ?? {})
}
