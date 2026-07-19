import playersFra from '@/data/world/playersFra.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'
import { youthRosterFromPack } from './youthFromPack'

type FraPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Ligue 1 real squads — keyed by club key */
export function fraRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersFra as { clubs: Record<string, FraPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function fraYouthForClub(clubKey: string): StarDef[] {
  return youthRosterFromPack(playersFra as { youth?: Record<string, FraPlayerRow[]> }, clubKey)
}

export function fraRosterClubKeys(): string[] {
  return Object.keys((playersFra as { clubs: Record<string, FraPlayerRow[]> }).clubs ?? {})
}
