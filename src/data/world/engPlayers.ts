import playersEng from '@/data/world/playersEng.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'
import { youthRosterFromPack } from './youthFromPack'

type EngPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Premier League real squads (SortItOutSI) — keyed by club key */
export function engRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersEng as { clubs: Record<string, EngPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

/** FMTU Wonderkids → U16/U18/U21/U23 */
export function engYouthForClub(clubKey: string): StarDef[] {
  return youthRosterFromPack(playersEng as { youth?: Record<string, EngPlayerRow[]> }, clubKey)
}

export function engRosterClubKeys(): string[] {
  return Object.keys((playersEng as { clubs: Record<string, EngPlayerRow[]> }).clubs ?? {})
}
