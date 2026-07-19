import playersIta2 from '@/data/world/playersIta2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 Serie B real squads — keyed by club key (see DIV2_CLUB_NAMES.ita) */
export function ita2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersIta2 as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function ita2RosterClubKeys(): string[] {
  return Object.keys((playersIta2 as { clubs: Record<string, Row[]> }).clubs ?? {})
}
