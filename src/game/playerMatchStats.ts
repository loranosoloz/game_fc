/**
 * สถิติแมตช์ติดตัวนักเตะทุกคนบนโลก — อัปเดตหลังจบนัด (รวม AI vs AI)
 */
import type {
  CompetitionKind,
  Fixture,
  MatchEvent,
  MatchResult,
  Player,
  PlayerLiveSeasonStats,
  PlayerMatchLogEntry,
  PlayerSeasonHistoryRow,
} from './types'

export const PLAYER_RECENT_MATCHES_CAP = 20
export const PLAYER_SEASON_HISTORY_CAP = 16

export function emptyLiveSeason(
  season: number,
  clubId: string,
): PlayerLiveSeasonStats {
  return {
    season,
    clubId,
    apps: 0,
    starts: 0,
    goals: 0,
    assists: 0,
    minutes: 0,
    yellows: 0,
    reds: 0,
    ratingSum: 0,
    motm: 0,
    cleanSheets: 0,
    shots: 0,
    xg: 0,
    saves: 0,
  }
}

function countFromEvents(events: MatchEvent[] | undefined) {
  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  const yellows = new Map<string, number>()
  const reds = new Map<string, number>()
  const saves = new Map<string, number>()
  for (const ev of events ?? []) {
    if (ev.kind === 'goal' && ev.playerId) {
      goals.set(ev.playerId, (goals.get(ev.playerId) ?? 0) + 1)
      if (ev.assistPlayerId) {
        assists.set(ev.assistPlayerId, (assists.get(ev.assistPlayerId) ?? 0) + 1)
      }
    }
    if (ev.kind === 'card' && ev.playerId) {
      if (ev.cardColor === 'red') reds.set(ev.playerId, (reds.get(ev.playerId) ?? 0) + 1)
      else yellows.set(ev.playerId, (yellows.get(ev.playerId) ?? 0) + 1)
    }
    if (ev.kind === 'save' && ev.playerId) {
      saves.set(ev.playerId, (saves.get(ev.playerId) ?? 0) + 1)
    }
  }
  return { goals, assists, yellows, reds, saves }
}

function archiveLiveIfNeeded(
  p: Player,
  season: number,
  clubId: string,
  clubName: string,
): Player {
  const live = p.liveSeason
  if (!live || live.apps < 1) return p
  const splitClub = live.season === season && live.clubId !== clubId
  const newSeason = live.season !== season
  if (!splitClub && !newSeason) return p

  const row: PlayerSeasonHistoryRow = {
    season: live.season,
    label: String(live.season),
    clubId: live.clubId,
    clubName,
    apps: live.apps,
    goals: live.goals,
    assists: live.assists,
    minutes: live.minutes,
    yellows: live.yellows,
    reds: live.reds,
    avgRating: live.apps > 0 ? Math.round((live.ratingSum / live.apps) * 100) / 100 : 0,
    motm: live.motm,
  }
  const history = [row, ...(p.seasonHistory ?? [])].slice(0, PLAYER_SEASON_HISTORY_CAP)
  return { ...p, seasonHistory: history, liveSeason: undefined }
}

function bumpLive(
  live: PlayerLiveSeasonStats,
  patch: {
    minutes: number
    goals: number
    assists: number
    yellows: number
    reds: number
    rating: number
    motm: boolean
    cleanSheet: boolean
    shots: number
    xg: number
    saves: number
    started: boolean
  },
): PlayerLiveSeasonStats {
  return {
    ...live,
    apps: live.apps + 1,
    starts: live.starts + (patch.started ? 1 : 0),
    goals: live.goals + patch.goals,
    assists: live.assists + patch.assists,
    minutes: live.minutes + patch.minutes,
    yellows: live.yellows + patch.yellows,
    reds: live.reds + patch.reds,
    ratingSum: live.ratingSum + patch.rating,
    motm: live.motm + (patch.motm ? 1 : 0),
    cleanSheets: live.cleanSheets + (patch.cleanSheet ? 1 : 0),
    shots: live.shots + patch.shots,
    xg: Math.round((live.xg + patch.xg) * 100) / 100,
    saves: live.saves + patch.saves,
  }
}

/**
 * เขียนสถิติแมตช์เข้าตัวนักเตะทุกคนที่ลงสนามในนัดนี้
 */
export function applyPlayerMatchStats(
  players: Player[],
  fixture: Fixture,
  result: MatchResult,
  opts: {
    season: number
    clubName: (clubId: string) => string
  },
): Player[] {
  const ratings = result.playerRatings
  if (!ratings?.length) return players

  const byId = new Map(players.map((p) => [p.id, p]))
  const ev = countFromEvents(result.events)
  const homeCs = result.awayGoals === 0
  const awayCs = result.homeGoals === 0

  for (const r of ratings) {
    if (r.minutes < 1) continue
    const clubId = r.team === 'home' ? fixture.homeClubId : fixture.awayClubId
    let p = byId.get(r.playerId)
    if (!p) continue

    p = archiveLiveIfNeeded(p, opts.season, clubId, opts.clubName(p.liveSeason?.clubId ?? p.clubId))

    const goals = Math.max(r.goals, ev.goals.get(r.playerId) ?? 0)
    const assists = ev.assists.get(r.playerId) ?? 0
    const yellows = ev.yellows.get(r.playerId) ?? 0
    const reds = ev.reds.get(r.playerId) ?? 0
    const saves = ev.saves.get(r.playerId) ?? 0
    const teamCs = r.team === 'home' ? homeCs : awayCs
    const cleanSheet =
      teamCs &&
      r.minutes >= 60 &&
      (p.position === 'GK' || p.position === 'DF')

    const live = bumpLive(p.liveSeason ?? emptyLiveSeason(opts.season, clubId), {
      minutes: r.minutes,
      goals,
      assists,
      yellows,
      reds,
      rating: r.rating,
      motm: result.manOfTheMatchId === r.playerId,
      cleanSheet,
      shots: r.shots ?? 0,
      xg: r.xg ?? 0,
      saves,
      started: r.minutes >= 45,
    })
    live.clubId = clubId
    live.season = opts.season

    const oppId = r.team === 'home' ? fixture.awayClubId : fixture.homeClubId
    const log: PlayerMatchLogEntry = {
      fixtureId: fixture.id,
      season: opts.season,
      matchday: fixture.matchday,
      date: fixture.date,
      competition: fixture.competition as CompetitionKind,
      clubId,
      opponentClubId: oppId,
      home: r.team === 'home',
      goals,
      assists,
      minutes: r.minutes,
      rating: r.rating,
      yellows,
      reds,
      motm: result.manOfTheMatchId === r.playerId,
      shots: r.shots ?? 0,
      xg: r.xg ?? 0,
    }

    byId.set(r.playerId, {
      ...p,
      liveSeason: live,
      recentMatches: [log, ...(p.recentMatches ?? [])].slice(0, PLAYER_RECENT_MATCHES_CAP),
    })
  }

  return players.map((p) => byId.get(p.id) ?? p)
}

/** ขึ้นฤดูกาลใหม่ — เก็บแถวฤดูกาลเก่าไว้ในประวัติแล้วรีเซ็ต */
export function rollPlayerLiveSeasonForNewSeason(
  player: Player,
  newSeason: number,
  clubName: (clubId: string) => string,
): Player {
  const live = player.liveSeason
  if (!live || live.apps < 1) {
    return { ...player, liveSeason: undefined }
  }
  const row: PlayerSeasonHistoryRow = {
    season: live.season,
    label: String(live.season),
    clubId: live.clubId,
    clubName: clubName(live.clubId),
    apps: live.apps,
    goals: live.goals,
    assists: live.assists,
    minutes: live.minutes,
    yellows: live.yellows,
    reds: live.reds,
    avgRating: live.apps > 0 ? Math.round((live.ratingSum / live.apps) * 100) / 100 : 0,
    motm: live.motm,
  }
  return {
    ...player,
    seasonHistory: [row, ...(player.seasonHistory ?? [])].slice(0, PLAYER_SEASON_HISTORY_CAP),
    liveSeason: undefined,
  }
}

export function liveSeasonAvgRating(live: PlayerLiveSeasonStats | null | undefined): number {
  if (!live || live.apps < 1) return 0
  return Math.round((live.ratingSum / live.apps) * 100) / 100
}

export function formatLiveSeasonLine(live: PlayerLiveSeasonStats | null | undefined): string {
  if (!live || live.apps < 1) return 'ยังไม่ลงแข่งฤดูกาลนี้'
  const avg = liveSeasonAvgRating(live)
  return `${live.apps} นัด · ${live.goals}G ${live.assists}A · ${live.minutes}' · เรต ${avg.toFixed(2)}`
}
