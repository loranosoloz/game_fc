/**
 * คลังสถิติแมตช์ทั้งลีก — รวมนัด AI vs AI
 */
import type {
  CompetitionKind,
  Fixture,
  GameSave,
  MatchEvent,
  MatchResult,
  TeamMatchStats,
} from './types'

export const MATCH_ARCHIVE_CAP = 2_400

export interface MatchArchiveEntry {
  id: string
  season: number
  matchday: number
  date: string
  competition: CompetitionKind
  cupRound?: string
  division?: 1 | 2
  homeClubId: string
  awayClubId: string
  homeGoals: number
  awayGoals: number
  stats: { home: TeamMatchStats; away: TeamMatchStats }
  manOfTheMatchName?: string | null
  attendance?: number
  involvesHuman: boolean
  homeRating: number
  awayRating: number
  topRatings?: Array<{
    name: string
    team: 'home' | 'away'
    rating: number
    goals: number
  }>
  penaltiesHome?: number
  penaltiesAway?: number
  wentToExtraTime?: boolean
}

export function emptyTeamStats(): TeamMatchStats {
  return {
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    possession: 50,
    xg: 0,
  }
}

export function buildArchiveEntry(
  fixture: Fixture,
  result: MatchResult,
  opts: { season: number; humanClubId: string },
): MatchArchiveEntry {
  const involvesHuman =
    fixture.homeClubId === opts.humanClubId || fixture.awayClubId === opts.humanClubId
  const topRatings = (result.playerRatings ?? [])
    .slice()
    .sort((a, b) => b.rating - a.rating)
    .slice(0, involvesHuman ? 8 : 4)
    .map((r) => ({
      name: r.name,
      team: r.team,
      rating: r.rating,
      goals: r.goals,
    }))

  return {
    id: fixture.id,
    season: opts.season,
    matchday: fixture.matchday,
    date: fixture.date,
    competition: fixture.competition,
    cupRound: fixture.cupRound,
    division: fixture.division,
    homeClubId: fixture.homeClubId,
    awayClubId: fixture.awayClubId,
    homeGoals: result.homeGoals,
    awayGoals: result.awayGoals,
    stats: {
      home: { ...(result.stats?.home ?? emptyTeamStats()) },
      away: { ...(result.stats?.away ?? emptyTeamStats()) },
    },
    manOfTheMatchName: result.manOfTheMatchName,
    attendance: result.attendance ?? fixture.attendance,
    involvesHuman,
    homeRating: result.homeRating,
    awayRating: result.awayRating,
    topRatings: topRatings.length ? topRatings : undefined,
    penaltiesHome: result.penalties?.home,
    penaltiesAway: result.penalties?.away,
    wentToExtraTime: result.wentToExtraTime,
  }
}

export function appendMatchArchive(
  archive: MatchArchiveEntry[] | null | undefined,
  entries: MatchArchiveEntry[],
): MatchArchiveEntry[] {
  const prev = archive ?? []
  const byId = new Map(prev.map((e) => [e.id, e]))
  for (const e of entries) byId.set(e.id, e)
  const next = [...byId.values()].sort((a, b) => {
    if (a.season !== b.season) return b.season - a.season
    if (a.matchday !== b.matchday) return b.matchday - a.matchday
    return b.date.localeCompare(a.date) || a.id.localeCompare(b.id)
  })
  return next.slice(0, MATCH_ARCHIVE_CAP)
}

/** สถิติสะสมจากอีเวนต์ถึงนาทีปัจจุบัน (ตอนเล่นไลฟ์) */
export function statsFromEventsUpTo(
  events: MatchEvent[],
  upToIndex: number,
  homeClubId: string,
  awayClubId: string,
  finalStats?: { home: TeamMatchStats; away: TeamMatchStats } | null,
): { home: TeamMatchStats; away: TeamMatchStats; homeGoals: number; awayGoals: number } {
  const home = emptyTeamStats()
  const away = emptyTeamStats()
  let homeGoals = 0
  let awayGoals = 0
  const end = Math.max(0, Math.min(events.length - 1, upToIndex))
  for (let i = 0; i <= end; i++) {
    const ev = events[i]
    if (!ev) continue
    homeGoals = ev.homeGoals
    awayGoals = ev.awayGoals
    const side =
      ev.clubId === homeClubId ? home : ev.clubId === awayClubId ? away : null
    if (!side) continue
    if (ev.kind === 'shot' || ev.kind === 'chance') side.shots += 1
    if (ev.kind === 'goal') {
      side.shots += 1
      side.shotsOnTarget += 1
      side.xg += 0.35
    }
    if (ev.kind === 'save') {
      // ยิงเข้ากรอบฝั่งตรงข้าม
      const atk = side === home ? away : home
      atk.shots += 1
      atk.shotsOnTarget += 1
    }
    if (ev.kind === 'corner') side.corners += 1
    if (ev.kind === 'foul') side.fouls += 1
    if (ev.kind === 'card') {
      if (ev.cardColor === 'red') side.reds += 1
      else side.yellows += 1
    }
    if (ev.kind === 'penalty') side.shots += 1
  }

  // ครองบอล — สัดส่วนจากสกอร์เวลา / หรือประมาณจาก final เมื่อใกล้จบ
  const progress = events.length > 1 ? (end + 1) / events.length : 0
  if (finalStats && progress > 0.15) {
    home.possession = Math.round(
      50 + (finalStats.home.possession - 50) * Math.min(1, progress * 1.15),
    )
    away.possession = 100 - home.possession
    // ผสม xG จากอีเวนต์กับค่าสุดท้าย
    if (finalStats.home.xg > home.xg) {
      home.xg = Math.round(home.xg * 0.4 + finalStats.home.xg * progress * 0.6 * 100) / 100
    }
    if (finalStats.away.xg > away.xg) {
      away.xg = Math.round(away.xg * 0.4 + finalStats.away.xg * progress * 0.6 * 100) / 100
    }
  } else {
    const totalActions =
      home.shots + away.shots + home.corners + away.corners + home.fouls + away.fouls + 2
    home.possession = Math.round(
      ((home.shots + home.corners + 1) / totalActions) * 100,
    )
    home.possession = Math.max(28, Math.min(72, home.possession))
    away.possession = 100 - home.possession
  }

  home.xg = Math.round(home.xg * 100) / 100
  away.xg = Math.round(away.xg * 100) / 100
  return { home, away, homeGoals, awayGoals }
}

export function archiveEntryToMatchResult(entry: MatchArchiveEntry): MatchResult {
  return {
    fixtureId: entry.id,
    homeGoals: entry.homeGoals,
    awayGoals: entry.awayGoals,
    events: [],
    homeRating: entry.homeRating,
    awayRating: entry.awayRating,
    stats: entry.stats,
    manOfTheMatchName: entry.manOfTheMatchName,
    attendance: entry.attendance,
    wentToExtraTime: entry.wentToExtraTime,
    penalties:
      entry.penaltiesHome != null && entry.penaltiesAway != null
        ? { home: entry.penaltiesHome, away: entry.penaltiesAway }
        : undefined,
    playerRatings: entry.topRatings?.map((r, i) => ({
      playerId: `${entry.id}-${i}`,
      name: r.name,
      team: r.team,
      rating: r.rating,
      goals: r.goals,
      shots: 0,
      xg: 0,
      minutes: 90,
    })),
  }
}

export function findArchiveEntry(
  save: GameSave,
  fixtureId: string,
): MatchArchiveEntry | null {
  return (save.matchArchive ?? []).find((e) => e.id === fixtureId) ?? null
}

export function competitionLabelTh(c: CompetitionKind, cupRound?: string): string {
  const base: Record<string, string> = {
    league: 'ลีก',
    cup: 'ถ้วย',
    ucl: 'UCL',
    uel: 'Europa',
    uecl: 'Conference',
    acl: 'ACL',
    acl_two: 'ACL Two',
    asean_cup: 'ASEAN',
    cwc: 'สโมสรโลก',
    super_cup: 'Super Cup',
    league_cup: 'ลีกคัพ',
    trophy: 'โทรฟี่',
  }
  const b = base[c] ?? c
  return cupRound ? `${b} · ${cupRound}` : b
}
