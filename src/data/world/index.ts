import { WORLD_LEAGUES, type LeagueDef, type LeagueId, NAME_POOLS } from './leaguesCore'
import { LEAGUES_REST } from './leaguesRest'
import { LEAGUES_LATIN_THAI } from './leaguesLatinThai'

export type { LeagueId, LeagueDef, ClubDef, StarDef } from './leaguesCore'
export { NAME_POOLS }
export { REAL_NAME_BANKS } from './realNameBanks'
export { DIV2_CLUB_NAMES, DIV2_LEAGUE_NAME, EXTRA_CUP_NAMES } from './div2Clubs'

export const ALL_LEAGUES: LeagueDef[] = [
  ...WORLD_LEAGUES,
  ...LEAGUES_REST,
  ...LEAGUES_LATIN_THAI,
]

export function getLeague(id: LeagueId): LeagueDef {
  const league = ALL_LEAGUES.find((l) => l.id === id)
  if (!league) throw new Error(`Unknown league: ${id}`)
  if (league.clubs.length !== 20) {
    throw new Error(`League ${id} must have 20 clubs, got ${league.clubs.length}`)
  }
  return league
}

export function listLeagues() {
  return ALL_LEAGUES.map((l) => ({
    id: l.id,
    name: l.name,
    nameTh: l.nameTh,
    nation: l.nation,
    cupName: l.cupName,
  }))
}
