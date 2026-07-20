import { WORLD_LEAGUES, type LeagueDef, type LeagueId, NAME_POOLS } from './leaguesCore'
import { LEAGUES_REST } from './leaguesRest'
import { LEAGUES_LATIN_THAI } from './leaguesLatinThai'
import { LEAGUES_EXTRA } from './leaguesExtra'
import { LEAGUES_ASEAN_SAUDI } from './leaguesAseanSaudi'
import { leagueTeamCount } from './leagueSize'

export type { LeagueId, LeagueDef, ClubDef, StarDef } from './leaguesCore'
export { NAME_POOLS }
export { REAL_NAME_BANKS } from './realNameBanks'
export { DIV2_CLUB_NAMES, DIV2_LEAGUE_NAME, EXTRA_CUP_NAMES } from './div2Clubs'
export {
  leagueTeamCount,
  promoRelegCount,
  leagueMatchdays,
  winterWindowRange,
  isValidLeagueSize,
  div2TeamCount,
} from './leagueSize'

export const ALL_LEAGUES: LeagueDef[] = [
  ...WORLD_LEAGUES,
  ...LEAGUES_REST,
  ...LEAGUES_LATIN_THAI,
  ...LEAGUES_EXTRA,
  ...LEAGUES_ASEAN_SAUDI,
]

export function getLeague(id: LeagueId): LeagueDef {
  const league = ALL_LEAGUES.find((l) => l.id === id)
  if (!league) throw new Error(`Unknown league: ${id}`)
  const expected = leagueTeamCount(id)
  if (league.clubs.length !== expected) {
    throw new Error(`League ${id} must have ${expected} clubs, got ${league.clubs.length}`)
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
    teams: l.clubs.length,
  }))
}

/** รายชื่อสโมสรสำหรับหน้าเริ่มอาชีพ — เบา ไม่ดึง roster pack */
export function listClubOptionsForLeague(leagueId: LeagueId) {
  return getLeague(leagueId).clubs.map((def, i) => ({
    id: `club-${i + 1}`,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    reputation: def.rep,
    crestKey: def.key,
  }))
}
