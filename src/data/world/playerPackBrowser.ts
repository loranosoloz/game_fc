import { getLeague, DIV2_CLUB_NAMES, type LeagueId } from '@/data/world'
import { engRosterClubKeys, engRosterForClub } from './engPlayers'
import { eng2RosterClubKeys, eng2RosterForClub } from './eng2Players'
import { espRosterClubKeys, espRosterForClub } from './espPlayers'
import { esp2RosterClubKeys, esp2RosterForClub } from './esp2Players'
import { gerRosterClubKeys, gerRosterForClub } from './gerPlayers'
import { ger2RosterClubKeys, ger2RosterForClub } from './ger2Players'
import { fraRosterClubKeys, fraRosterForClub } from './fraPlayers'
import { fra2RosterClubKeys, fra2RosterForClub } from './fra2Players'
import { itaRosterClubKeys, itaRosterForClub } from './itaPlayers'
import { ita2RosterClubKeys, ita2RosterForClub } from './ita2Players'
import { thaRosterClubKeys, thaRosterForClub } from './thaPlayers'
import { tha2RosterClubKeys, tha2RosterForClub } from './tha2Players'
import { jpnRosterClubKeys, jpnRosterForClub } from './jpnPlayers'
import { jpn2RosterClubKeys, jpn2RosterForClub } from './jpn2Players'
import { korRosterClubKeys, korRosterForClub } from './korPlayers'
import { kor2RosterClubKeys, kor2RosterForClub } from './kor2Players'
import { braRosterClubKeys, braRosterForClub } from './braPlayers'
import { turRosterClubKeys, turRosterForClub } from './turPlayers'
import { nedRosterClubKeys, nedRosterForClub } from './nedPlayers'
import { prtRosterClubKeys, prtRosterForClub } from './prtPlayers'
import { belRosterClubKeys, belRosterForClub } from './belPlayers'
import { scoRosterClubKeys, scoRosterForClub } from './scoPlayers'
import { autRosterClubKeys, autRosterForClub } from './autPlayers'
import { suiRosterClubKeys, suiRosterForClub } from './suiPlayers'
import { denRosterClubKeys, denRosterForClub } from './denPlayers'
import { greRosterClubKeys, greRosterForClub } from './grePlayers'
import { vieRosterClubKeys, vieRosterForClub } from './viePlayers'
import { idnRosterClubKeys, idnRosterForClub } from './idnPlayers'
import { mysRosterClubKeys, mysRosterForClub } from './mysPlayers'
import { sgpRosterClubKeys, sgpRosterForClub } from './sgpPlayers'
import { sauRosterClubKeys, sauRosterForClub } from './sauPlayers'
import { bioForPlayerName } from './playerBios'
import { fmInsideForPlayerName } from './fmInsidePlayers'
import { hasPhotoForPlayerName } from '@/lib/playerPhotos'
import type { RoleCode } from '@/game/types'

export type PackLeagueId =
  | 'eng'
  | 'eng2'
  | 'esp'
  | 'esp2'
  | 'ger'
  | 'ger2'
  | 'fra'
  | 'fra2'
  | 'ita'
  | 'ita2'
  | 'tha'
  | 'tha2'
  | 'jpn'
  | 'jpn2'
  | 'kor'
  | 'kor2'
  | 'bra'
  | 'tur'
  | 'ned'
  | 'prt'
  | 'bel'
  | 'sco'
  | 'aut'
  | 'sui'
  | 'den'
  | 'gre'
  | 'vie'
  | 'idn'
  | 'mys'
  | 'sgp'
  | 'sau'

export interface PackPlayerRow {
  id: string
  leagueId: PackLeagueId
  leagueLabel: string
  clubKey: string
  clubName: string
  clubShort: string
  name: string
  role: RoleCode
  age: number
  ovr: number
  hasBio: boolean
  hasFmInside: boolean
  hasPhoto: boolean
  fmPos: string | null
  nationality: string | null
}

const LEAGUE_META: Record<
  PackLeagueId,
  { label: string; keys: () => string[]; roster: (key: string) => ReturnType<typeof engRosterForClub> }
> = {
  eng: { label: 'Premier League', keys: engRosterClubKeys, roster: engRosterForClub },
  eng2: { label: 'Championship', keys: eng2RosterClubKeys, roster: eng2RosterForClub },
  esp: { label: 'La Liga', keys: espRosterClubKeys, roster: espRosterForClub },
  esp2: { label: 'LaLiga2', keys: esp2RosterClubKeys, roster: esp2RosterForClub },
  ger: { label: 'Bundesliga', keys: gerRosterClubKeys, roster: gerRosterForClub },
  ger2: { label: '2. Bundesliga', keys: ger2RosterClubKeys, roster: ger2RosterForClub },
  fra: { label: 'Ligue 1', keys: fraRosterClubKeys, roster: fraRosterForClub },
  fra2: { label: 'Ligue 2', keys: fra2RosterClubKeys, roster: fra2RosterForClub },
  ita: { label: 'Serie A', keys: itaRosterClubKeys, roster: itaRosterForClub },
  ita2: { label: 'Serie B', keys: ita2RosterClubKeys, roster: ita2RosterForClub },
  tha: { label: 'Thai League 1', keys: thaRosterClubKeys, roster: thaRosterForClub },
  tha2: { label: 'Thai League 2', keys: tha2RosterClubKeys, roster: tha2RosterForClub },
  jpn: { label: 'J1 League', keys: jpnRosterClubKeys, roster: jpnRosterForClub },
  jpn2: { label: 'J2 League', keys: jpn2RosterClubKeys, roster: jpn2RosterForClub },
  kor: { label: 'K League 1', keys: korRosterClubKeys, roster: korRosterForClub },
  kor2: { label: 'K League 2', keys: kor2RosterClubKeys, roster: kor2RosterForClub },
  bra: { label: 'Brasileirão', keys: braRosterClubKeys, roster: braRosterForClub },
  tur: { label: 'Süper Lig', keys: turRosterClubKeys, roster: turRosterForClub },
  ned: { label: 'Eredivisie', keys: nedRosterClubKeys, roster: nedRosterForClub },
  prt: { label: 'Primeira Liga', keys: prtRosterClubKeys, roster: prtRosterForClub },
  bel: { label: 'Pro League', keys: belRosterClubKeys, roster: belRosterForClub },
  sco: { label: 'Scottish Premiership', keys: scoRosterClubKeys, roster: scoRosterForClub },
  aut: { label: 'Austrian Bundesliga', keys: autRosterClubKeys, roster: autRosterForClub },
  sui: { label: 'Swiss Super League', keys: suiRosterClubKeys, roster: suiRosterForClub },
  den: { label: 'Superliga', keys: denRosterClubKeys, roster: denRosterForClub },
  gre: { label: 'Super League Greece', keys: greRosterClubKeys, roster: greRosterForClub },
  vie: { label: 'V.League 1', keys: vieRosterClubKeys, roster: vieRosterForClub },
  idn: { label: 'Liga 1', keys: idnRosterClubKeys, roster: idnRosterForClub },
  mys: { label: 'Malaysia Super League', keys: mysRosterClubKeys, roster: mysRosterForClub },
  sgp: { label: 'Singapore Premier League', keys: sgpRosterClubKeys, roster: sgpRosterForClub },
  sau: { label: 'Saudi Pro League', keys: sauRosterClubKeys, roster: sauRosterForClub },
}

const DIV2_LOOKUP: Partial<Record<PackLeagueId, LeagueId>> = {
  eng2: 'eng',
  esp2: 'esp',
  ger2: 'ger',
  fra2: 'fra',
  ita2: 'ita',
  tha2: 'tha',
  jpn2: 'jpn',
  kor2: 'kor',
}

function clubLabel(leagueId: PackLeagueId, clubKey: string) {
  const div2Nation = DIV2_LOOKUP[leagueId]
  if (div2Nation) {
    const def = DIV2_CLUB_NAMES[div2Nation].find((c) => c.key === clubKey)
    if (def) return { name: def.name, short: def.shortName }
    return { name: clubKey.toUpperCase(), short: clubKey.toUpperCase() }
  }
  try {
    const league = getLeague(leagueId as LeagueId)
    const def = league.clubs.find((c) => c.key === clubKey)
    if (def) return { name: def.name, short: def.shortName }
  } catch {
    /* ignore */
  }
  return { name: clubKey.toUpperCase(), short: clubKey.toUpperCase() }
}

let cached: PackPlayerRow[] | null = null

/** รายชื่อนักเตะจาก pack JSON — ไม่ใช่เซฟเกม */
export function listAllPackPlayers(): PackPlayerRow[] {
  if (cached) return cached
  const rows: PackPlayerRow[] = []
  for (const leagueId of Object.keys(LEAGUE_META) as PackLeagueId[]) {
    const meta = LEAGUE_META[leagueId]
    for (const clubKey of meta.keys()) {
      const club = clubLabel(leagueId, clubKey)
      const roster = meta.roster(clubKey)
      const nameCount = new Map<string, number>()
      for (let i = 0; i < roster.length; i++) {
        const p = roster[i]!
        const occ = (nameCount.get(p.name) ?? 0) + 1
        nameCount.set(p.name, occ)
        const bio = bioForPlayerName(p.name)
        const fm = fmInsideForPlayerName(p.name)
        const idSuffix = occ > 1 ? `#${occ}` : ''
        rows.push({
          id: `${leagueId}-${clubKey}-${i}-${p.name}${idSuffix}`,
          leagueId,
          leagueLabel: meta.label,
          clubKey,
          clubName: club.name,
          clubShort: club.short,
          name: p.name,
          role: p.role,
          age: p.age,
          ovr: p.ovr,
          hasBio: Boolean(bio),
          hasFmInside: Boolean(fm),
          hasPhoto: hasPhotoForPlayerName(p.name),
          fmPos: bio?.fmPos ?? fm?.positions ?? null,
          nationality: bio?.nationality ?? null,
        })
      }
    }
  }
  rows.sort((a, b) => b.ovr - a.ovr || a.name.localeCompare(b.name))
  cached = rows
  return rows
}

function emptyLeagueStats() {
  return { players: 0, clubs: 0, withPhoto: 0, withBio: 0, withFm: 0 }
}

export function packDbStats(rows = listAllPackPlayers()) {
  const byLeague = Object.fromEntries(
    (Object.keys(LEAGUE_META) as PackLeagueId[]).map((id) => [id, emptyLeagueStats()]),
  ) as Record<PackLeagueId, ReturnType<typeof emptyLeagueStats>>
  const clubsSeen = Object.fromEntries(
    (Object.keys(LEAGUE_META) as PackLeagueId[]).map((id) => [id, new Set<string>()]),
  ) as Record<PackLeagueId, Set<string>>
  let withBio = 0
  let withFm = 0
  let withPhoto = 0
  for (const r of rows) {
    byLeague[r.leagueId].players += 1
    clubsSeen[r.leagueId].add(r.clubKey)
    if (r.hasBio) {
      withBio += 1
      byLeague[r.leagueId].withBio += 1
    }
    if (r.hasFmInside) {
      withFm += 1
      byLeague[r.leagueId].withFm += 1
    }
    if (r.hasPhoto) {
      withPhoto += 1
      byLeague[r.leagueId].withPhoto += 1
    }
  }
  for (const id of Object.keys(byLeague) as PackLeagueId[]) {
    byLeague[id].clubs = clubsSeen[id].size
  }
  return {
    total: rows.length,
    withBio,
    withFm,
    withPhoto,
    byLeague,
  }
}

export function packLeagueOptions() {
  return (Object.keys(LEAGUE_META) as PackLeagueId[]).map((id) => ({
    id,
    label: LEAGUE_META[id].label,
  }))
}
