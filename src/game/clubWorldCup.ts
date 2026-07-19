/**
 * FIFA Club World Cup (สโมสรโลก)
 * — 8 ทีม: แชมป์ทวีป + แขก CONMEBOL/CAF/CONCACAF/OFC
 * — แข่งช่วงกลางฤดูกาล (ประมาณวินเทอร์) น็อกเอาต์ QF→SF→Final
 */
import type { Club, CupState, Fixture, GameSave, Player, Tactics } from './types'
import type { LeagueId } from '@/data/world'
import { createPlayersForClubDef } from './worldSeed'
import { autoPickTactics } from './seed'
import { createClubSocial } from './social'
import { createClubFans } from './fans'
import { shiftMidweekDate } from './calendarDates'
import cwcFormat from '@/data/cwcFormat.json'
import { isEuropeLeague } from './europeAccess'
import { isAclLeague, isAseanLeague } from './awards'

export type CwcSeed = {
  confederation: 'UEFA' | 'AFC' | 'CONMEBOL' | 'CAF' | 'CONCACAF' | 'OFC' | 'HOST'
  name: string
  shortName: string
  color: string
  rep: number
  originLeagueId?: string
  crestKey?: string
  /** ถ้าเป็นคลับในเซฟ (แชมป์ฤดูกาลก่อน) */
  clubId?: string
}

export type CwcAccessState = {
  /** เมล็ดพันธุ์จากแชมป์ฤดูกาลก่อน + แขก */
  seeds: CwcSeed[]
  lastChampionName?: string
  lastNote?: string
}

/** แขกทวีปอื่น (ไม่มีลีกในเซฟ) — ความแข็งพอสำหรับสโมสรโลก */
const GUEST_CLUBS: CwcSeed[] = [
  {
    confederation: 'CONMEBOL',
    name: 'Club Atlético Boca Juniors',
    shortName: 'BOC',
    color: '#0033A0',
    rep: 88,
    crestKey: 'cwc-boc',
  },
  {
    confederation: 'CONMEBOL',
    name: 'CR Flamengo',
    shortName: 'FLA',
    color: '#C8102E',
    rep: 90,
    crestKey: 'cwc-fla',
  },
  {
    confederation: 'CAF',
    name: 'Al Ahly SC',
    shortName: 'AHL',
    color: '#E30613',
    rep: 84,
    crestKey: 'cwc-ahl',
  },
  {
    confederation: 'CONCACAF',
    name: 'CF Monterrey',
    shortName: 'MTY',
    color: '#0B2343',
    rep: 80,
    crestKey: 'cwc-mty',
  },
  {
    confederation: 'OFC',
    name: 'Auckland City FC',
    shortName: 'AUC',
    color: '#0033A1',
    rep: 62,
    crestKey: 'cwc-auc',
  },
]

export function createCwcAccess(): CwcAccessState {
  return { seeds: [] }
}

export function ensureCwcAccess(save: GameSave): CwcAccessState {
  return save.cwcAccess ?? createCwcAccess()
}

export function createCwcState(): CupState {
  return {
    name: 'FIFA Club World Cup',
    championClubId: null,
    eliminated: [],
  }
}

function clubToSeed(
  club: Club | undefined,
  confederation: CwcSeed['confederation'],
): CwcSeed | null {
  if (!club) return null
  return {
    confederation,
    name: club.name,
    shortName: club.shortName,
    color: club.color,
    rep: club.reputation,
    originLeagueId: club.originLeagueId,
    crestKey: club.crestKey,
    clubId: club.id,
  }
}

/**
 * เก็บเมล็ดสโมสรโลกจากแชมป์ถ้วยฤดูกาลนี้
 * — เรียกตอนจบฤดูกาล / ก่อนสร้างแพ็กฤดูกาลใหม่
 */
export function snapshotCwcSeeds(save: GameSave): CwcAccessState {
  const prev = ensureCwcAccess(save)
  const clubs = save.clubs
  const byId = (id: string | null | undefined) =>
    id ? clubs.find((c) => c.id === id) : undefined

  const seeds: CwcSeed[] = []
  const push = (s: CwcSeed | null) => {
    if (!s) return
    if (seeds.some((x) => x.name === s.name || (s.clubId && x.clubId === s.clubId))) return
    seeds.push(s)
  }

  // UEFA
  push(clubToSeed(byId(save.ucl?.championClubId), 'UEFA'))
  push(clubToSeed(byId(save.uel?.championClubId), 'UEFA'))
  // AFC
  push(clubToSeed(byId(save.acl?.championClubId), 'AFC'))
  push(clubToSeed(byId(save.aclTwo?.championClubId), 'AFC'))
  push(clubToSeed(byId(save.aseanCup?.championClubId), 'AFC'))

  // ถ้ายังไม่มีแชมป์ (ซีซันแรก) — ดึงทีมดังจากฟิกซ์เจอร์ถ้วยปัจจุบัน
  if (!seeds.some((s) => s.confederation === 'UEFA')) {
    const uclClub = clubs
      .filter((c) => c.id.startsWith('ucl-') || (c.originLeagueId && isEuropeLeague(c.originLeagueId)))
      .sort((a, b) => b.reputation - a.reputation)[0]
    push(clubToSeed(uclClub, 'UEFA'))
  }
  if (!seeds.some((s) => s.confederation === 'AFC')) {
    const asia = clubs
      .filter(
        (c) =>
          c.id.startsWith('acl') ||
          (c.originLeagueId &&
            (isAclLeague(c.originLeagueId) || isAseanLeague(c.originLeagueId))),
      )
      .sort((a, b) => b.reputation - a.reputation)[0]
    push(clubToSeed(asia, 'AFC'))
  }

  // แขกทวีปอื่น — สลับตามฤดูกาล
  const year = save.season
  const conmebol = GUEST_CLUBS.filter((g) => g.confederation === 'CONMEBOL')
  push(conmebol[year % conmebol.length] ?? GUEST_CLUBS[0]!)
  if (seeds.filter((s) => s.confederation === 'CONMEBOL').length < 1) {
    push(conmebol[(year + 1) % conmebol.length]!)
  }
  // ถ้า UEFA+AFC ยังไม่ครบ 2 ฝั่ง ใส่ Flamengo เป็นแขกที่ 2
  if (seeds.length < 4) {
    push(GUEST_CLUBS.find((g) => g.shortName === 'FLA') ?? null)
  }
  push(GUEST_CLUBS.find((g) => g.confederation === 'CAF')!)
  push(GUEST_CLUBS.find((g) => g.confederation === 'CONCACAF')!)
  push(GUEST_CLUBS.find((g) => g.confederation === 'OFC')!)

  // Host = แชมป์ลีกบ้าน หรือทีมดังสุดในลีกผู้เล่น
  const human = clubs.find((c) => c.id === save.humanClubId)
  const tableTop = [...(save.table ?? [])].sort((a, b) => b.points - a.points)[0]
  const hostClub = tableTop
    ? clubs.find((c) => c.id === tableTop.clubId)
    : human
  const hostSeed = clubToSeed(hostClub, 'HOST')
  if (hostSeed && !seeds.some((s) => s.clubId === hostSeed.clubId || s.name === hostSeed.name)) {
    seeds.push(hostSeed)
  }

  return {
    seeds: seeds.slice(0, 8),
    lastChampionName: prev.lastChampionName,
    lastNote: `เมล็ดสโมสรโลกฤดูกาล ${save.season + 1}: ${seeds
      .slice(0, 8)
      .map((s) => s.shortName)
      .join(' · ')}`,
  }
}

export type CwcPack = {
  clubs: Club[]
  players: Player[]
  tactics: Record<string, Tactics>
  field: Club[]
}

function buildGuestClub(idx: number, seed: CwcSeed): Club {
  const id = `cwc-${idx}`
  const balance = Math.round(8_000_000 + seed.rep * 220_000)
  return {
    id,
    name: seed.name,
    shortName: seed.shortName,
    color: seed.color,
    controlledBy: 'ai',
    reputation: seed.rep,
    stadiumCapacity: 32_000 + seed.rep * 450,
    balance,
    wageBudgetWeekly: Math.round(90_000 + seed.rep * 3_000),
    seasonStartBalance: balance,
    originLeagueId: seed.originLeagueId,
    division: 1,
    crestKey: seed.crestKey ?? id,
    clubFans: createClubFans(seed.rep),
    social: createClubSocial({
      id,
      name: seed.name,
      shortName: seed.shortName,
      reputation: seed.rep,
      stadiumCapacity: 32_000 + seed.rep * 450,
      division: 1,
    }),
  }
}

/** สร้างโผ 8 ทีมสโมสรโลก */
export function createCwcPack(
  homeLeagueId: LeagueId,
  domesticClubs: Club[],
  access: CwcAccessState,
  allClubs: Club[],
): CwcPack {
  const empty: CwcPack = { clubs: [], players: [], tactics: {}, field: [] }
  // เปิดเมื่อผู้เล่นอยู่ในยุโรปหรือเอเชีย (มีเส้นทางถ้วยทวีป)
  if (!isEuropeLeague(homeLeagueId) && !isAclLeague(homeLeagueId) && !isAseanLeague(homeLeagueId)) {
    return empty
  }

  let seeds = access.seeds.slice()
  if (seeds.length < 4) {
    // bootstrap จากชื่อเสียง
    const euro = allClubs
      .filter((c) => c.originLeagueId && isEuropeLeague(c.originLeagueId))
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, 2)
    const asia = allClubs
      .filter(
        (c) =>
          c.originLeagueId &&
          (isAclLeague(c.originLeagueId) || isAseanLeague(c.originLeagueId)),
      )
      .sort((a, b) => b.reputation - a.reputation)
      .slice(0, 2)
    seeds = [
      ...euro.map((c) => clubToSeed(c, 'UEFA')!),
      ...asia.map((c) => clubToSeed(c, 'AFC')!),
      ...GUEST_CLUBS.slice(0, 4),
    ]
  }

  // เติมแขกให้ครบ 8
  for (const g of GUEST_CLUBS) {
    if (seeds.length >= 8) break
    if (!seeds.some((s) => s.name === g.name)) seeds.push(g)
  }
  seeds = seeds.slice(0, 8)

  const clubs: Club[] = []
  const players: Player[] = []
  const tactics: Record<string, Tactics> = {}
  const field: Club[] = []
  const usedNames = new Set<string>()
  let n = 120_000
  let inviteN = 1
  const byId = new Map(allClubs.map((c) => [c.id, c]))
  const domesticByKey = new Map(domesticClubs.map((c) => [c.crestKey ?? '', c]))

  for (const seed of seeds) {
    // ใช้คลับในเซฟถ้ายังอยู่
    if (seed.clubId && byId.has(seed.clubId)) {
      const local = byId.get(seed.clubId)!
      if (!field.includes(local)) field.push(local)
      continue
    }
    if (seed.crestKey && domesticByKey.has(seed.crestKey)) {
      const local = domesticByKey.get(seed.crestKey)!
      if (!field.includes(local)) field.push(local)
      continue
    }

    const club = buildGuestClub(inviteN++, seed)
    clubs.push(club)
    field.push(club)
    const leagueId = (seed.originLeagueId as LeagueId) || homeLeagueId
    const def = {
      key: seed.crestKey ?? club.id,
      name: seed.name,
      shortName: seed.shortName,
      color: seed.color,
      rep: seed.rep,
      stars: [] as [],
    }
    const built = createPlayersForClubDef({
      leagueId,
      club,
      def,
      seed: 22_000 + inviteN * 53,
      idPrefix: 'cwc-p',
      startN: n,
      usedNames,
    })
    n = built.nextN
    players.push(...built.players)
    tactics[club.id] = autoPickTactics(club.id, built.players)
  }

  return { clubs, players, tactics, field: field.slice(0, 8) }
}

export function generateCwcFixtures(
  field: Club[],
  season: number,
  seasonStart = '2026-08-15',
): Fixture[] {
  if (field.length < 4) return []
  let teams = field.slice(0, 8)
  while (teams.length < 8 && teams.length >= 2) {
    // pad ด้วย bye ไม่ทำ — ตัดเหลือ power of 2
    break
  }
  let size = 8
  while (size > teams.length) size /= 2
  if (size < 4) size = 4
  teams = teams.slice(0, size)

  const roundId = size === 8 ? 'qf' : size === 4 ? 'sf' : 'final'
  const offset =
    (cwcFormat.rounds.find((r) => r.id === roundId) as { matchdayOffset?: number })
      ?.matchdayOffset ?? 20
  const start = new Date(`${seasonStart}T12:00:00Z`)
  const fixtures: Fixture[] = []
  for (let i = 0; i < teams.length; i += 2) {
    const d = new Date(start)
    d.setUTCDate(d.getUTCDate() + offset * 7)
    fixtures.push({
      id: `cwc-${season}-${roundId}-${i / 2}`,
      matchday: offset,
      date: d.toISOString().slice(0, 10),
      homeClubId: teams[i]!.id,
      awayClubId: teams[i + 1]!.id,
      competition: 'cwc',
      played: false,
      cupRound: roundId,
      slot: 'midweek',
    })
  }
  return fixtures
}

export function advanceCwcAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): { fixtures: Fixture[]; cup: CupState } {
  const rounds = cwcFormat.rounds as Array<{ id: string; matchdayOffset: number }>
  const roundOrder = rounds.map((r) => r.id)
  const playedThis = fixtures.filter(
    (f) => f.competition === 'cwc' && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, cup }

  const roundId = playedThis[0]?.cupRound
  if (!roundId) return { fixtures, cup }

  const winners: string[] = []
  const eliminated = [...(cup.eliminated ?? [])]
  for (const f of playedThis) {
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
    let winner: string
    if (f.penaltiesHome != null && f.penaltiesAway != null && hg === ag) {
      winner = f.penaltiesHome > f.penaltiesAway ? f.homeClubId : f.awayClubId
    } else {
      winner = hg >= ag ? f.homeClubId : f.awayClubId
    }
    const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
    winners.push(winner)
    if (!eliminated.includes(loser)) eliminated.push(loser)
  }

  const idx = roundOrder.indexOf(roundId)
  if (idx === roundOrder.length - 1 || roundId === 'final') {
    return {
      fixtures,
      cup: { ...cup, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = rounds[idx + 1]!
  if (fixtures.some((f) => f.competition === 'cwc' && f.cupRound === nextRound.id)) {
    return { fixtures, cup: { ...cup, eliminated } }
  }
  if (winners.length < 2) return { fixtures, cup: { ...cup, eliminated } }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    newFx.push({
      id: `cwc-${nextRound.id}-${i / 2 + 1}`,
      matchday: nextRound.matchdayOffset,
      date: shiftMidweekDate(playedThis[0]!.date, nextRound.matchdayOffset - matchday),
      homeClubId: winners[i]!,
      awayClubId: winners[i + 1]!,
      played: false,
      competition: 'cwc',
      cupRound: nextRound.id,
      slot: 'midweek',
    })
  }

  return { fixtures: [...fixtures, ...newFx], cup: { ...cup, eliminated } }
}

/** อัปเดตชื่อแชมป์หลังจบถ้วย */
export function recordCwcChampion(access: CwcAccessState, championName: string): CwcAccessState {
  return {
    ...access,
    lastChampionName: championName,
    lastNote: `แชมป์สโมสรโลก: ${championName}`,
  }
}
