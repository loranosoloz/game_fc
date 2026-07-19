import players from '@/data/world/playersMys.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 mys squads — keyed by club key */
export function mysRosterForClub(clubKey: string): StarDef[] {
  const rows = (players as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function mysRosterClubKeys(): string[] {
  return Object.keys((players as { clubs: Record<string, Row[]> }).clubs ?? {})
}
