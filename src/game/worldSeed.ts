import type { Club, Player, RoleCode, SquadRole } from '@/game/types'
import { roleGroup } from '@/game/positions'
import {
  caFromOverall,
  makeAttrs,
  makeHidden,
  makePa,
  overallFromCa,
  pickPersonality,
} from '@/game/attributes'
import { getLeague, type LeagueId, type ClubDef } from '@/data/world'
import { REAL_NAME_BANKS } from '@/data/world/realNameBanks'
import { REAL_NAME_OVERFLOW } from '@/data/world/realNameOverflow'
import { createBodyMap } from '@/game/bodyMap'

/** All real names across leagues + overflow (deduped) for fill when regional bank is empty. */
const GLOBAL_REAL_NAMES: string[] = [
  ...new Set([...Object.values(REAL_NAME_BANKS).flat(), ...REAL_NAME_OVERFLOW]),
]

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, min = 1, max = 20) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

type Slot = { role: RoleCode; count: number; ovr: number }

function squadTemplate(rep: number): Slot[] {
  const base = Math.round(58 + (rep - 48) * 0.45)
  return [
    { role: 'GK', count: 2, ovr: base - 2 },
    { role: 'CB', count: 3, ovr: base },
    { role: 'LB', count: 2, ovr: base },
    { role: 'RB', count: 2, ovr: base },
    { role: 'CDM', count: 2, ovr: base + 1 },
    { role: 'CM', count: 3, ovr: base + 1 },
    { role: 'CAM', count: 1, ovr: base + 1 },
    { role: 'LW', count: 1, ovr: base + 1 },
    { role: 'RW', count: 1, ovr: base + 1 },
    { role: 'ST', count: 2, ovr: base + 2 },
    { role: 'SS', count: 1, ovr: base + 2 },
  ]
}

function pickSquadRole(overall: number, age: number, indexInClub: number): SquadRole {
  if (indexInClub < 3 && overall >= 70) return 'key'
  if (indexInClub < 11) return 'regular'
  if (age <= 21) return 'prospect'
  return 'squad'
}

export function createClubsFromLeague(leagueId: LeagueId, humanClubId: string): Club[] {
  const league = getLeague(leagueId)
  return league.clubs.map((def, i) => {
    const id = `club-${i + 1}`
    const isHuman = id === humanClubId
    const balance = Math.round(8_000_000 + def.rep * 220_000 + (isHuman ? 500_000 : 0))
    return {
      id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      controlledBy: isHuman ? 'human' : 'ai',
      reputation: def.rep,
      stadiumCapacity: 18_000 + def.rep * 450,
      balance,
      wageBudgetWeekly: Math.round(80_000 + def.rep * 2_800),
      seasonStartBalance: balance,
    }
  })
}

export function listClubOptionsForLeague(leagueId: LeagueId) {
  return getLeague(leagueId).clubs.map((def, i) => ({
    id: `club-${i + 1}`,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    reputation: def.rep,
  }))
}

/** Pick a unique real footballer name (league bank → overflow → numbered suffix). */
function uniqueRealName(
  rng: () => number,
  leagueId: LeagueId,
  used: Set<string>,
): string {
  const primary = REAL_NAME_BANKS[leagueId] ?? []
  for (const pool of [primary, GLOBAL_REAL_NAMES]) {
    if (pool.length === 0) continue
    const start = Math.floor(rng() * pool.length)
    for (let i = 0; i < pool.length; i++) {
      const name = pool[(start + i) % pool.length]
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
  }
  const base = primary[0] ?? GLOBAL_REAL_NAMES[0] ?? 'Player'
  for (let i = 2; i < 9999; i++) {
    const name = `${base} ${i}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `${base} ${Math.floor(rng() * 99999)}`
  used.add(fallback)
  return fallback
}

export function createPlayersForClubDef(opts: {
  leagueId: LeagueId
  club: Club
  def: ClubDef
  seed: number
  idPrefix?: string
  startN?: number
  usedNames?: Set<string>
}): { players: Player[]; nextN: number } {
  const {
    leagueId,
    club,
    def,
    seed,
    idPrefix = 'p',
    startN = 0,
    usedNames = new Set<string>(),
  } = opts
  const rng = mulberry32(seed)
  const template = squadTemplate(def.rep)
  const clubPlayers: Player[] = []
  let n = startN

  const starQueue = def.stars.slice()
  const usedRoles = new Map<RoleCode, number>()

  for (const star of starQueue) {
    n += 1
    usedNames.add(star.name)
    const ca = caFromOverall(star.ovr)
    const personality = pickPersonality(rng, star.age, star.ovr)
    usedRoles.set(star.role, (usedRoles.get(star.role) ?? 0) + 1)
    clubPlayers.push({
      id: `${idPrefix}-${n}`,
      clubId: club.id,
      name: star.name,
      age: star.age,
      role: star.role,
      position: roleGroup(star.role),
      overall: overallFromCa(ca),
      ca,
      pa: makePa(rng, ca, star.age),
      attrs: makeAttrs(rng, star.ovr, star.role),
      hidden: makeHidden(rng),
      growth: personality.growth,
      personalityId: personality.personalityId,
      condition: 88 + Math.floor(rng() * 12),
      sharpness: 75 + Math.floor(rng() * 20),
      form: 8 + Math.floor(rng() * 8),
      morale: 12 + Math.floor(rng() * 6),
      happiness: 12 + Math.floor(rng() * 6),
      wage: Math.round(1200 + star.ovr * 140 + club.reputation * 50),
      cash: Math.round((1200 + star.ovr * 140 + club.reputation * 50) * (8 + rng() * 10)),
      squadRole: 'key',
      injuryDays: 0,
      injuryType: null,
      treatment: null,
      injuryBodyPart: null,
      bodyMap: createBodyMap(rng),
      injuryHistory: [],
      illnessDays: 0,
      illnessType: null,
      seasonYellows: 0,
      banMatches: 0,
      leaveDays: 0,
      contractYears: 3,
      contractEndSeason: 2029,
      releaseClause: star.ovr >= 80 ? Math.round(star.ovr ** 2 * 1200) : null,
      minutesPlayed: 0,
      isYouth: false,
      mentorId: null,
      mediaHandling: 6 + Math.floor(rng() * 12),
    })
  }

  for (const row of template) {
    const already = usedRoles.get(row.role) ?? 0
    const need = Math.max(0, row.count - already)
    for (let i = 0; i < need; i++) {
      n += 1
      const overall = clamp(row.ovr + (rng() - 0.5) * 7, 45, Math.min(88, def.rep + 5))
      const age = 17 + Math.floor(rng() * 18)
      const name = uniqueRealName(rng, leagueId, usedNames)
      const ca = caFromOverall(overall)
      const personality = pickPersonality(rng, age, overall)
      const years = 1 + Math.floor(rng() * 4)
      clubPlayers.push({
        id: `${idPrefix}-${n}`,
        clubId: club.id,
        name,
        age,
        role: row.role,
        position: roleGroup(row.role),
        overall: overallFromCa(ca),
        ca,
        pa: makePa(rng, ca, age),
        attrs: makeAttrs(rng, overall, row.role),
        hidden: makeHidden(rng),
        growth: personality.growth,
        personalityId: personality.personalityId,
        condition: 85 + Math.floor(rng() * 15),
        sharpness: 70 + Math.floor(rng() * 25),
        form: 6 + Math.floor(rng() * 8),
        morale: 10 + Math.floor(rng() * 8),
        happiness: 10 + Math.floor(rng() * 8),
        wage: Math.round(800 + overall * 90 + club.reputation * 40),
        cash: Math.round((800 + overall * 90 + club.reputation * 40) * (6 + rng() * 12)),
        squadRole: 'squad',
        injuryDays: 0,
        injuryType: null,
        treatment: null,
        injuryBodyPart: null,
        bodyMap: createBodyMap(rng),
        injuryHistory: [],
        illnessDays: 0,
        illnessType: null,
        seasonYellows: 0,
        banMatches: 0,
        leaveDays: 0,
        contractYears: years,
        contractEndSeason: 2026 + years,
        releaseClause: overall >= 78 ? Math.round(overall ** 2 * 1000) : null,
        minutesPlayed: 0,
        isYouth: false,
        mentorId: null,
        mediaHandling: 6 + Math.floor(rng() * 12),
      })
    }
  }

  clubPlayers.sort((a, b) => b.overall - a.overall)
  clubPlayers.forEach((p, idx) => {
    if (p.squadRole !== 'key') p.squadRole = pickSquadRole(p.overall, p.age, idx)
  })

  return { players: clubPlayers, nextN: n }
}

export function createPlayersFromLeague(
  leagueId: LeagueId,
  clubs: Club[],
  seed = 2026,
): Player[] {
  const league = getLeague(leagueId)
  const players: Player[] = []
  const usedNames = new Set<string>()
  let n = 0

  clubs.forEach((club, clubIndex) => {
    const def: ClubDef = league.clubs[clubIndex]
    const built = createPlayersForClubDef({
      leagueId,
      club,
      def,
      seed: seed + clubIndex * 131 + leagueId.charCodeAt(0) * 97,
      startN: n,
      usedNames,
    })
    n = built.nextN
    players.push(...built.players)
  })

  return players
}
