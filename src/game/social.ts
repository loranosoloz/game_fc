import type { Club, ClubSocial, GameSave, Player, PlayerSocial } from './types'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function slugHandle(raw: string, fallback: string): string {
  const cleaned = raw
    .replace(/\s+/g, '')
    .replace(/[^a-zA-Z0-9_\u0E00-\u0E7F]/g, '')
  return `@${(cleaned || fallback).slice(0, 18)}`
}

export function createClubSocial(club: Pick<Club, 'name' | 'shortName' | 'reputation' | 'stadiumCapacity' | 'division' | 'id'>): ClubSocial {
  const divMult = club.division === 2 ? 0.55 : 1
  const followers = Math.round(
    club.stadiumCapacity * (0.9 + club.reputation / 90) * divMult +
      club.reputation * club.reputation * 90 +
      (club.id.length % 7) * 12_000,
  )
  return {
    handle: slugHandle(club.shortName || club.name, 'ClubFC'),
    followers: Math.max(8_000, followers),
    engagement: clamp(38 + club.reputation / 3, 25, 88),
    brand: clamp(club.reputation * 0.85 + (club.division === 1 ? 8 : 0), 20, 98),
    lastPostNote: `${club.name} เปิดบัญชีทางการ`,
  }
}

export function createPlayerSocial(
  player: Pick<Player, 'id' | 'name' | 'overall' | 'age' | 'mediaHandling' | 'isYouth'>,
  clubFollowers = 100_000,
): PlayerSocial {
  const mh = player.mediaHandling ?? 10
  const base =
    player.overall * player.overall * 55 +
    mh * 9_000 +
    Math.round(clubFollowers * (0.008 + player.overall / 9000)) +
    (player.id.length % 11) * 2_500
  const youthCut = player.isYouth ? 0.35 : 1
  const ageCut = player.age <= 21 ? 0.75 : player.age >= 34 ? 0.85 : 1
  const parts = player.name.trim().split(/\s+/)
  const handleBase = parts.length >= 2 ? `${parts[0][0]}${parts[parts.length - 1]}` : parts[0] ?? 'Player'
  return {
    handle: slugHandle(handleBase, 'Player'),
    followers: Math.max(1_200, Math.round(base * youthCut * ageCut)),
    heat: clamp(12 + mh + (player.overall - 60), 5, 55),
    postsWeek: clamp(1 + Math.floor(mh / 5) + (player.overall >= 80 ? 1 : 0), 1, 8),
    verified: player.overall >= 78 || mh >= 16,
  }
}

export function ensureClubSocial(club: Club): Club {
  if (club.social?.handle && typeof club.social.followers === 'number') {
    return {
      ...club,
      social: {
        ...createClubSocial(club),
        ...club.social,
        handle: club.social.handle || createClubSocial(club).handle,
      },
    }
  }
  return { ...club, social: createClubSocial(club) }
}

export function ensurePlayerSocial(player: Player, clubFollowers?: number): Player {
  if (player.social?.handle && typeof player.social.followers === 'number') {
    return {
      ...player,
      social: {
        ...createPlayerSocial(player, clubFollowers),
        ...player.social,
        handle: player.social.handle || createPlayerSocial(player, clubFollowers).handle,
      },
    }
  }
  return { ...player, social: createPlayerSocial(player, clubFollowers) }
}

export function ensureAllSocial(save: GameSave): GameSave {
  const clubs = save.clubs.map(ensureClubSocial)
  const followersByClub = new Map(clubs.map((c) => [c.id, c.social.followers]))
  const players = save.players.map((p) =>
    ensurePlayerSocial(p, followersByClub.get(p.clubId) ?? 80_000),
  )
  return { ...save, clubs, players }
}

export function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`
  if (n >= 10_000) return `${(n / 1_000).toFixed(n >= 100_000 ? 0 : 1)}K`
  return n.toLocaleString('th-TH')
}

/** หลังแมตช์เดย์ — ขยับ followers/engagement/heat ตามผลแข่ง */
export function tickSocialAfterMatchday(save: GameSave): GameSave {
  let clubs = save.clubs.map(ensureClubSocial)
  let players = save.players.map((p) => {
    const club = clubs.find((c) => c.id === p.clubId)
    return ensurePlayerSocial(p, club?.social.followers)
  })

  const dayFixtures = save.fixtures.filter((f) => f.matchday === save.matchday && f.played)
  const clubDelta = new Map<string, number>()
  const engagementDelta = new Map<string, number>()

  for (const f of dayFixtures) {
    if (f.homeGoals == null || f.awayGoals == null) continue
    const hg = f.homeGoals
    const ag = f.awayGoals
    const homeWin = hg > ag
    const draw = hg === ag
    const margin = Math.abs(hg - ag)

    const apply = (clubId: string, won: boolean, _lost: boolean) => {
      let d = 0
      let eng = 0
      if (won) {
        d = 0.004 + margin * 0.0012
        eng = 3 + margin
      } else if (draw) {
        d = 0.0008
        eng = 0.5
      } else {
        d = -0.0015 - margin * 0.0004
        eng = -2
      }
      if (f.competition === 'ucl') d *= 1.6
      if (f.competition === 'cup' || f.competition === 'league_cup') d *= 1.25
      clubDelta.set(clubId, (clubDelta.get(clubId) ?? 0) + d)
      engagementDelta.set(clubId, (engagementDelta.get(clubId) ?? 0) + eng)
    }

    apply(f.homeClubId, homeWin, !homeWin && !draw)
    apply(f.awayClubId, !homeWin && !draw, homeWin)
  }

  clubs = clubs.map((c) => {
    const d = clubDelta.get(c.id) ?? 0
    const eng = engagementDelta.get(c.id) ?? 0
    const drift = (Math.sin(save.matchday * 1.7 + c.id.length) * 0.0004)
    const nextFollowers = Math.max(
      5_000,
      Math.round(c.social.followers * (1 + d + drift)),
    )
    const engagement = clamp(c.social.engagement + eng * 0.35 - 0.4, 15, 98)
    const brand = clamp(
      c.social.brand + (d > 0.002 ? 0.4 : d < -0.001 ? -0.3 : 0),
      15,
      99,
    )
    let lastPostNote = c.social.lastPostNote
    if (d > 0.003) lastPostNote = `แฟนออนไลน์พุ่งหลังเกมดี · ${formatFollowers(nextFollowers)}`
    else if (d < -0.002) lastPostNote = `โซเชียลเงียบหลังผลไม่ดี · ${formatFollowers(nextFollowers)}`
    return {
      ...c,
      social: {
        ...c.social,
        followers: nextFollowers,
        engagement,
        brand,
        lastPostNote,
      },
    }
  })

  const followersByClub = new Map(clubs.map((c) => [c.id, c.social.followers]))
  const playedClubs = new Set(dayFixtures.flatMap((f) => [f.homeClubId, f.awayClubId]))

  players = players.map((p) => {
    const clubF = followersByClub.get(p.clubId) ?? p.social.followers
    let followers = p.social.followers
    let heat = p.social.heat
    let postsWeek = p.social.postsWeek

    // soft weekly post rhythm
    if (save.matchday % 4 === 0) {
      postsWeek = clamp(1 + Math.floor((p.mediaHandling ?? 10) / 5), 1, 8)
    }

    if (playedClubs.has(p.clubId)) {
      const clubDeltaPct = clubDelta.get(p.clubId) ?? 0
      const share = 0.35 + (p.overall / 200) + ((p.mediaHandling ?? 10) / 80)
      followers = Math.max(
        800,
        Math.round(followers * (1 + clubDeltaPct * share) + (clubDeltaPct > 0 ? p.overall * 8 : 0)),
      )
      heat = clamp(heat + clubDeltaPct * 400 + (p.form >= 14 ? 4 : p.form <= 8 ? -3 : 0) - 1.2, 0, 100)
    } else {
      heat = clamp(heat - 0.8, 0, 100)
      followers = Math.max(800, Math.round(followers * 1.0002 + clubF * 0.00001))
    }

    // stars slowly catch club audience
    if (p.overall >= 82 && followers < clubF * 0.15) {
      followers = Math.round(followers + clubF * 0.002)
    }

    return {
      ...p,
      social: {
        ...p.social,
        followers,
        heat,
        postsWeek,
        verified: p.social.verified || p.overall >= 78 || (p.mediaHandling ?? 0) >= 16,
      },
    }
  })

  return { ...save, clubs, players }
}

export function topClubSocial(save: GameSave, limit = 8): Club[] {
  return save.clubs
    .map(ensureClubSocial)
    .filter((c) => !c.id.startsWith('ucl-') || c.reputation >= 70)
    .sort((a, b) => b.social.followers - a.social.followers)
    .slice(0, limit)
}

export function topPlayerSocial(save: GameSave, clubId?: string, limit = 8): Player[] {
  return save.players
    .filter((p) => (clubId ? p.clubId === clubId : true))
    .map((p) => {
      const club = save.clubs.find((c) => c.id === p.clubId)
      return ensurePlayerSocial(p, club?.social?.followers)
    })
    .sort((a, b) => b.social.followers - a.social.followers)
    .slice(0, limit)
}
