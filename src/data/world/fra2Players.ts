import playersFra2 from '@/data/world/playersFra2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 Ligue 2 real squads — keyed by club key (see DIV2_CLUB_NAMES.fra) */
export function fra2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersFra2 as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function fra2RosterClubKeys(): string[] {
  return Object.keys((playersFra2 as { clubs: Record<string, Row[]> }).clubs ?? {})
}
