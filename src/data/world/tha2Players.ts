import playersTha2 from '@/data/world/playersTha2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 Thai League 2 real squads — keyed by club key (see DIV2_CLUB_NAMES.tha) */
export function tha2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersTha2 as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function tha2RosterClubKeys(): string[] {
  return Object.keys((playersTha2 as { clubs: Record<string, Row[]> }).clubs ?? {})
}
