import playersGer2 from '@/data/world/playersGer2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 2. Bundesliga real squads — keyed by club key (see DIV2_CLUB_NAMES.ger) */
export function ger2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersGer2 as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function ger2RosterClubKeys(): string[] {
  return Object.keys((playersGer2 as { clubs: Record<string, Row[]> }).clubs ?? {})
}
