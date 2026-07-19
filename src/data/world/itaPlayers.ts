import playersIta from '@/data/world/playersIta.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'
import { youthRosterFromPack } from './youthFromPack'

type ItaPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Serie A real squads — keyed by club key */
export function itaRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersIta as { clubs: Record<string, ItaPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function itaYouthForClub(clubKey: string): StarDef[] {
  return youthRosterFromPack(playersIta as { youth?: Record<string, ItaPlayerRow[]> }, clubKey)
}

export function itaRosterClubKeys(): string[] {
  return Object.keys((playersIta as { clubs: Record<string, ItaPlayerRow[]> }).clubs ?? {})
}
