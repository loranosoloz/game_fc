import playersTha from '@/data/world/playersTha.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type ThaPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Thai League 1 real squads — keyed by club key */
export function thaRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersTha as { clubs: Record<string, ThaPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function thaRosterClubKeys(): string[] {
  return Object.keys((playersTha as { clubs: Record<string, ThaPlayerRow[]> }).clubs ?? {})
}
