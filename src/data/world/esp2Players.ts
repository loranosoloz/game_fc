import playersEsp2 from '@/data/world/playersEsp2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Esp2PlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 LaLiga2 real squads — keyed by club key (see DIV2_CLUB_NAMES.esp) */
export function esp2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersEsp2 as { clubs: Record<string, Esp2PlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function esp2RosterClubKeys(): string[] {
  return Object.keys((playersEsp2 as { clubs: Record<string, Esp2PlayerRow[]> }).clubs ?? {})
}
