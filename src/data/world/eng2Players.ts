import playersEng2 from '@/data/world/playersEng2.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Eng2PlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Championship real squads — keyed by club key (see DIV2_CLUB_NAMES.eng) */
export function eng2RosterForClub(clubKey: string): StarDef[] {
  const rows = (playersEng2 as { clubs: Record<string, Eng2PlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function eng2RosterClubKeys(): string[] {
  return Object.keys((playersEng2 as { clubs: Record<string, Eng2PlayerRow[]> }).clubs ?? {})
}
