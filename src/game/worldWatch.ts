/**
 * โลกมีชีวิต — ฟีดกิจกรรมคลับ AI · ติดตามคู่แข่ง · ความสนใจทีมชาติต่อนักเตะ
 */
import type {
  Club,
  GameSave,
  InboxMessage,
  Player,
  WorldActivityEvent,
  WorldActivityKind,
  WorldNtInterest,
  WorldWatchState,
} from './types'
import { getRivalClubIds } from './rivalries'
import { playerNationality } from './nationalTeams'
import { formatMoney } from '@/lib/format'
import { ensurePlayerMoveLog } from './playerWorldDb'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function createWorldWatch(_humanClubId: string, rivalIds: string[]): WorldWatchState {
  return {
    watchedClubIds: rivalIds.slice(0, 4),
    primaryRivalId: rivalIds[0] ?? null,
    feed: [],
    ntInterest: [],
    lastTickMatchday: -1,
  }
}

export function ensureWorldWatch(save: GameSave): WorldWatchState {
  const rivals = getRivalClubIds(save, save.humanClubId)
  const raw = save.worldWatch
  if (!raw) return createWorldWatch(save.humanClubId, rivals)
  return {
    watchedClubIds: raw.watchedClubIds?.length ? raw.watchedClubIds : rivals.slice(0, 4),
    primaryRivalId: raw.primaryRivalId ?? rivals[0] ?? null,
    feed: raw.feed ?? [],
    ntInterest: raw.ntInterest ?? [],
    lastTickMatchday: raw.lastTickMatchday ?? -1,
  }
}

export function toggleWatchClub(save: GameSave, clubId: string): GameSave {
  const ww = ensureWorldWatch(save)
  if (clubId === save.humanClubId) return save
  const set = new Set(ww.watchedClubIds)
  if (set.has(clubId)) set.delete(clubId)
  else {
    if (set.size >= 8) {
      const first = [...set][0]!
      set.delete(first)
    }
    set.add(clubId)
  }
  return {
    ...save,
    worldWatch: {
      ...ww,
      watchedClubIds: [...set],
      primaryRivalId:
        ww.primaryRivalId && set.has(ww.primaryRivalId)
          ? ww.primaryRivalId
          : ([...set][0] ?? null),
    },
  }
}

export function setPrimaryRival(save: GameSave, clubId: string | null): GameSave {
  const ww = ensureWorldWatch(save)
  let watched = ww.watchedClubIds
  if (clubId && !watched.includes(clubId)) {
    watched = [clubId, ...watched].slice(0, 8)
  }
  return {
    ...save,
    worldWatch: { ...ww, watchedClubIds: watched, primaryRivalId: clubId },
  }
}

function pushFeed(
  feed: WorldActivityEvent[],
  ev: Omit<WorldActivityEvent, 'id'>,
): WorldActivityEvent[] {
  return [{ ...ev, id: uid('wa') }, ...feed].slice(0, 80)
}

function clubName(save: GameSave, id: string): string {
  return save.clubs.find((c) => c.id === id)?.shortName ?? id
}

function aiClubs(save: GameSave): Club[] {
  return save.clubs.filter((c) => c.id !== save.humanClubId && c.controlledBy !== 'human')
}

function squadOf(save: GameSave, clubId: string): Player[] {
  return save.players.filter((p) => p.clubId === clubId && !p.isYouth)
}

/** AI–AI ย้ายตัวเบา ๆ — ทำให้โลกขยับ */
function rollAiToAiTransfer(save: GameSave, rng: () => number): {
  save: GameSave
  event: Omit<WorldActivityEvent, 'id'> | null
} {
  const clubs = aiClubs(save).filter((c) => (c.division ?? 1) === 1)
  if (clubs.length < 4 || rng() > 0.55) return { save, event: null }

  const buyers = clubs.slice().sort((a, b) => b.reputation - a.reputation)
  const buyer = buyers[Math.floor(rng() * Math.min(8, buyers.length))]!
  const sellers = clubs.filter((c) => c.id !== buyer.id)
  const seller = sellers[Math.floor(rng() * sellers.length)]!
  const pool = squadOf(save, seller.id)
    .filter((p) => p.squadRole !== 'key' && p.overall >= 68 && p.overall <= 82 && p.age <= 29)
    .sort((a, b) => a.overall - b.overall)
  if (pool.length === 0) return { save, event: null }
  const player = pool[Math.floor(rng() * Math.min(5, pool.length))]!
  const fee = Math.round(player.overall * player.overall * 8_000 * (0.7 + rng() * 0.8))
  if (buyer.balance < fee * 0.6) return { save, event: null }

  let next: GameSave = {
    ...save,
    clubs: save.clubs.map((c) => {
      if (c.id === buyer.id) return { ...c, balance: c.balance - fee }
      if (c.id === seller.id) return { ...c, balance: c.balance + fee }
      return c
    }),
    players: save.players.map((p) =>
      p.id === player.id
        ? {
            ...p,
            clubId: buyer.id,
            wage: Math.round(p.wage * (1.05 + rng() * 0.15)),
            transferDesire: undefined,
          }
        : p,
    ),
  }
  next = {
    ...next,
    playerMoveLog: [
      {
        id: uid('move'),
        matchday: next.matchday,
        season: next.season,
        date: next.currentDate,
        playerId: player.id,
        playerName: player.name,
        fromClubId: seller.id,
        toClubId: buyer.id,
        kind: 'transfer',
        fee,
        note: 'ตลาดโลก (AI↔AI)',
      },
      ...ensurePlayerMoveLog(next),
    ].slice(0, 200),
  }

  return {
    save: next,
    event: {
      date: next.currentDate,
      matchday: next.matchday,
      season: next.season,
      kind: 'transfer',
      clubId: buyer.id,
      otherClubId: seller.id,
      playerId: player.id,
      headlineTh: `${clubName(next, buyer.id)} คว้า ${player.name} จาก ${clubName(next, seller.id)}`,
      bodyTh: `ค่าตัวประมาณ ${formatMoney(fee)} · ตลาดโลกเคลื่อนไหว`,
      importance: fee > 25_000_000 ? 3 : 2,
    },
  }
}

function rollClubFlavor(
  save: GameSave,
  club: Club,
  rng: () => number,
): Omit<WorldActivityEvent, 'id'> | null {
  const squad = squadOf(save, club.id)
  if (squad.length === 0) return null
  const kinds: WorldActivityKind[] = [
    'training',
    'board',
    'injury',
    'contract',
    'scout',
    'media',
    'youth',
  ]
  const kind = kinds[Math.floor(rng() * kinds.length)]!
  const star = squad.slice().sort((a, b) => b.overall - a.overall)[0]!
  const mid = squad[Math.floor(rng() * squad.length)]!

  switch (kind) {
    case 'training':
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        headlineTh: `${club.shortName} ซ้อมเข้มก่อนนัดใหญ่`,
        bodyTh: `โค้ชเน้นเกมรับ · ${star.name} อยู่ในกลุ่มตัวจริง`,
        importance: 1,
      }
    case 'board':
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        headlineTh: `บอร์ด ${club.shortName} ประชุมงบตลาด`,
        bodyTh:
          rng() > 0.5
            ? 'มีข่าวลืออยากเสริมปีก'
            : 'พอใจผลงานช่วงนี้ — ยังไม่บังคับขายดาว',
        importance: 1,
      }
    case 'injury': {
      const hurt = squad.find((p) => p.injuryDays > 0) ?? mid
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        playerId: hurt.id,
        headlineTh: `${hurt.name} (${club.shortName}) ปัญหาฟิตเนส`,
        bodyTh:
          hurt.injuryDays > 0
            ? `พักประมาณ ${hurt.injuryDays} วัน`
            : 'แพทย์เฝ้าระวัง — อาจพักซ้อมเบา',
        importance: 2,
      }
    }
    case 'contract':
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        playerId: mid.id,
        headlineTh: `${club.shortName} คุยต่อสัญญา ${mid.name}`,
        bodyTh: 'เอเยนต์ยังไม่ปิดโต๊ะ — ติดตามได้',
        importance: 1,
      }
    case 'scout':
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        headlineTh: `สเกาต์ ${club.shortName} ไปดูดาวต่างลีก`,
        bodyTh: 'สนใจกองกลางอายุน้อย',
        importance: 1,
      }
    case 'youth':
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind,
        clubId: club.id,
        headlineTh: `อะคาเดมี ${club.shortName} ปล่อยข่าวดาวรุ่ง`,
        bodyTh: 'อาจได้โอกาสตัวสำรองเร็ว ๆ นี้',
        importance: 1,
      }
    default:
      return {
        date: save.currentDate,
        matchday: save.matchday,
        season: save.season,
        kind: 'media',
        clubId: club.id,
        headlineTh: `สื่อท้องถิ่นจับตา ${club.shortName}`,
        bodyTh: `โฟกัสฟอร์มของ ${star.name}`,
        playerId: star.id,
        importance: 1,
      }
  }
}

/** ทีมชาติสังเกตนักเตะในลีกคุณ / ดาวดัง */
function tickNtInterest(save: GameSave, rng: () => number): WorldNtInterest[] {
  const ww = ensureWorldWatch(save)
  let list = [...(ww.ntInterest ?? [])]

  const candidates = save.players
    .filter((p) => p.overall >= 74 && p.age <= 28)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 40)

  for (const p of candidates) {
    if (rng() > 0.18) continue
    const nation = playerNationality(p, save)
    if (!nation || nation === 'Unknown') continue
    const existing = list.find((x) => x.playerId === p.id && x.nation === nation)
    const level = clamp(
      (existing?.level ?? 20) + 8 + Math.floor(rng() * 15) + (p.clubId === save.humanClubId ? 10 : 0),
      10,
      100,
    )
    const noteTh =
      level >= 70
        ? `${nation} จับตามองหนัก — มีลุ้นคอลอัปหน้าต่างถัดไป`
        : level >= 45
          ? `${nation} สังเกตฟอร์มต่อเนื่อง`
          : `${nation} เริ่มเก็บข้อมูล`

    if (existing) {
      list = list.map((x) =>
        x.playerId === p.id && x.nation === nation
          ? { ...x, level, noteTh, lastUpdateMatchday: save.matchday }
          : x,
      )
    } else {
      list.unshift({
        playerId: p.id,
        nation,
        level,
        noteTh,
        lastUpdateMatchday: save.matchday,
      })
    }
  }

  // ผ่อนความสนใจคนที่ไม่ขยับ
  list = list
    .map((x) =>
      x.lastUpdateMatchday < save.matchday - 4
        ? { ...x, level: clamp(x.level - 3, 0, 100) }
        : x,
    )
    .filter((x) => x.level >= 12)
    .sort((a, b) => b.level - a.level)
    .slice(0, 40)

  return list
}

function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * หลังแมตช์เดย์ — คลับในลีกเคลื่อนไหว · อัปเดตฟีด · NT สังเกต
 */
export function tickWorldWatch(save: GameSave): GameSave {
  let next = save
  const ww = ensureWorldWatch(next)
  if (ww.lastTickMatchday === next.matchday && next.matchday > 0) {
    return { ...next, worldWatch: ww }
  }

  const rng = mulberry(next.season * 10007 + next.matchday * 97 + 4242)
  let feed = [...ww.feed]

  // ย้าย AI↔AI 0–2 ดีล
  for (let i = 0; i < 2; i++) {
    const rolled = rollAiToAiTransfer(next, rng)
    next = rolled.save
    if (rolled.event) feed = pushFeed(feed, rolled.event)
  }

  // กิจกรรมคลับที่ติดตาม + คู่แข่ง + สุ่มคลับอื่น
  const focusIds = new Set([
    ...ww.watchedClubIds,
    ...(ww.primaryRivalId ? [ww.primaryRivalId] : []),
    ...getRivalClubIds(next, next.humanClubId).slice(0, 3),
  ])
  const focusClubs = aiClubs(next).filter((c) => focusIds.has(c.id))
  const extras = aiClubs(next)
    .filter((c) => !focusIds.has(c.id) && (c.division ?? 1) === 1)
    .sort(() => rng() - 0.5)
    .slice(0, 3)

  for (const club of [...focusClubs, ...extras]) {
    if (rng() > (focusIds.has(club.id) ? 0.75 : 0.35)) continue
    const ev = rollClubFlavor(next, club, rng)
    if (ev) feed = pushFeed(feed, ev)
  }

  // ผลนัดของคลับที่ติดตาม (จาก fixtures ที่เพิ่งเล่น)
  const playedToday = next.fixtures.filter(
    (f) => f.played && f.matchday === next.matchday && f.competition === 'league',
  )
  for (const f of playedToday) {
    for (const cid of [f.homeClubId, f.awayClubId]) {
      if (!focusIds.has(cid) || cid === next.humanClubId) continue
      const home = f.homeClubId === cid
      const gf = home ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0)
      const ga = home ? (f.awayGoals ?? 0) : (f.homeGoals ?? 0)
      const result = gf > ga ? 'ชนะ' : gf === ga ? 'เสมอ' : 'แพ้'
      feed = pushFeed(feed, {
        date: next.currentDate,
        matchday: next.matchday,
        season: next.season,
        kind: 'match',
        clubId: cid,
        otherClubId: home ? f.awayClubId : f.homeClubId,
        headlineTh: `${clubName(next, cid)} ${result} ${gf}–${ga}`,
        bodyTh: `ลีก · พบ ${clubName(next, home ? f.awayClubId : f.homeClubId)}`,
        importance: result === 'แพ้' ? 2 : 1,
      })
    }
  }

  const ntInterest = tickNtInterest(next, rng)
  const hotNt = ntInterest.filter(
    (x) =>
      x.level >= 55 &&
      x.lastUpdateMatchday === next.matchday &&
      next.players.find((p) => p.id === x.playerId)?.clubId === next.humanClubId,
  )
  for (const n of hotNt.slice(0, 2)) {
    const p = next.players.find((x) => x.id === n.playerId)
    if (!p) continue
    feed = pushFeed(feed, {
      date: next.currentDate,
      matchday: next.matchday,
      season: next.season,
      kind: 'nt_watch',
      clubId: next.humanClubId,
      playerId: p.id,
      headlineTh: `${n.nation} สังเกต ${p.name}`,
      bodyTh: n.noteTh,
      importance: n.level >= 75 ? 3 : 2,
    })
  }

  let inbox = next.inbox
  const rivalId = ww.primaryRivalId
  if (rivalId) {
    const rivalNews = feed.filter(
      (e) =>
        e.matchday === next.matchday &&
        (e.clubId === rivalId || e.otherClubId === rivalId) &&
        e.importance >= 2,
    )
    if (rivalNews[0]) {
      inbox = [
        {
          id: uid('msg-rival'),
          date: next.currentDate,
          title: `คู่แข่ง · ${clubName(next, rivalId)}`,
          body: rivalNews
            .slice(0, 2)
            .map((e) => e.headlineTh)
            .join(' · '),
          read: false,
        } satisfies InboxMessage,
        ...inbox,
      ].slice(0, 45)
    }
  }

  if (hotNt[0]) {
    const p = next.players.find((x) => x.id === hotNt[0]!.playerId)
    inbox = [
      {
        id: uid('msg-nt'),
        date: next.currentDate,
        title: 'ทีมชาติจับตามอง',
        body: `${hotNt[0]!.nation} · ${p?.name ?? ''} — ${hotNt[0]!.noteTh}`,
        read: false,
      } satisfies InboxMessage,
      ...inbox,
    ].slice(0, 45)
  }

  return {
    ...next,
    inbox,
    worldWatch: {
      ...ww,
      feed,
      ntInterest,
      lastTickMatchday: next.matchday,
    },
  }
}

export function clubSnapshot(save: GameSave, clubId: string) {
  const club = save.clubs.find((c) => c.id === clubId)
  if (!club) return null
  const squad = squadOf(save, clubId).sort((a, b) => b.overall - a.overall)
  const table =
    save.table.find((r) => r.clubId === clubId) ??
    save.tableDiv2?.find((r) => r.clubId === clubId)
  const rank =
    table && save.table.some((r) => r.clubId === clubId)
      ? [...save.table]
          .sort((a, b) => b.points - a.points || b.gf - b.ga - (a.gf - a.ga))
          .findIndex((r) => r.clubId === clubId) + 1
      : null
  const recent = save.fixtures
    .filter(
      (f) =>
        f.played &&
        (f.homeClubId === clubId || f.awayClubId === clubId) &&
        f.competition === 'league',
    )
    .slice(-5)
  const form = recent.map((f) => {
    const home = f.homeClubId === clubId
    const gf = home ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0)
    const ga = home ? (f.awayGoals ?? 0) : (f.homeGoals ?? 0)
    if (gf > ga) return 'W'
    if (gf === ga) return 'D'
    return 'L'
  })
  const ww = ensureWorldWatch(save)
  const activity = ww.feed.filter((e) => e.clubId === clubId || e.otherClubId === clubId).slice(0, 12)
  return {
    club,
    squad: squad.slice(0, 18),
    table,
    rank,
    form,
    activity,
    balance: club.balance,
    watched: ww.watchedClubIds.includes(clubId),
    isPrimaryRival: ww.primaryRivalId === clubId,
  }
}

export const ACTIVITY_KIND_LABEL: Record<WorldActivityKind, string> = {
  transfer: 'ตลาด',
  match: 'ผลแข่ง',
  training: 'ซ้อม',
  board: 'บอร์ด',
  injury: 'แพทย์',
  contract: 'สัญญา',
  scout: 'สเกาต์',
  media: 'สื่อ',
  youth: 'เยาวชน',
  nt_watch: 'ทีมชาติ',
  rivalry: 'คู่แข่ง',
}
