import playersGer from '@/data/world/playersGer.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'
import { youthRosterFromPack } from './youthFromPack'

type GerPlayerRow = { name: string; role: string; age: number; ovr: number }

/** FM26 Bundesliga real squads — keyed by club key */
export function gerRosterForClub(clubKey: string): StarDef[] {
  const rows = (playersGer as { clubs: Record<string, GerPlayerRow[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function gerYouthForClub(clubKey: string): StarDef[] {
  return youthRosterFromPack(playersGer as { youth?: Record<string, GerPlayerRow[]> }, clubKey)
}

export function gerRosterClubKeys(): string[] {
  return Object.keys((playersGer as { clubs: Record<string, GerPlayerRow[]> }).clubs ?? {})
}
