import type { Club, FormationId, Player, RoleCode, SquadRole, Tactics } from './types'
import { DEFAULT_INSTRUCTIONS, DEFAULT_SET_PIECES, FORMATION_SLOTS } from './types'
import { roleGroup } from './positions'
import {
  caFromOverall,
  makeAttrs,
  makeHidden,
  makePa,
  overallFromCa,
  pickPersonality,
} from './attributes'
import { createBodyMap } from './bodyMap'
import { rollPlayerSkills } from './playerSkills'
import { createClubSocial, createPlayerSocial } from './social'
import { getWorldCoach, instructionsFromCoach, type WorldCoach } from './worldCoaches'
import {
  ensurePlayerTacticalRoles,
  pickSlotRoleForPlayer,
  xiPickScore,
} from './playerTacticalRoles'
import { ensureSlotRoles, type TacticalRoleId } from './tacticalRoles'
import { pickCaptainsFromXi } from './match/matchCaptain'

const CLUB_DEFS: Array<{ name: string; shortName: string; color: string; rep: number }> = [
  { name: 'Northgate United', shortName: 'NOR', color: '#1d4ed8', rep: 78 },
  { name: 'Riverdale FC', shortName: 'RIV', color: '#b91c1c', rep: 76 },
  { name: 'Eastbridge Athletic', shortName: 'EAS', color: '#047857', rep: 74 },
  { name: 'Westford Town', shortName: 'WES', color: '#7c3aed', rep: 72 },
  { name: 'Harbor City', shortName: 'HAR', color: '#0e7490', rep: 70 },
  { name: 'Milltown Rovers', shortName: 'MIL', color: '#a16207', rep: 68 },
  { name: 'Oakridge Wanderers', shortName: 'OAK', color: '#166534', rep: 66 },
  { name: 'Stonehaven FC', shortName: 'STO', color: '#334155', rep: 65 },
  { name: 'Redcliff Borough', shortName: 'RED', color: '#9f1239', rep: 64 },
  { name: 'Silverlake United', shortName: 'SIL', color: '#475569', rep: 63 },
  { name: 'Ashford City', shortName: 'ASH', color: '#c2410c', rep: 62 },
  { name: 'Bluepeak Rangers', shortName: 'BLU', color: '#1e40af', rep: 60 },
  { name: 'Greenfield Albion', shortName: 'GRE', color: '#15803d', rep: 58 },
  { name: 'Ironworks FC', shortName: 'IRO', color: '#44403c', rep: 57 },
  { name: 'Lakeside Rovers', shortName: 'LAK', color: '#0369a1', rep: 56 },
  { name: 'Meadow Park', shortName: 'MEA', color: '#4d7c0f', rep: 55 },
  { name: 'Crown Hill', shortName: 'CRO', color: '#854d0e', rep: 54 },
  { name: 'Southbay United', shortName: 'SOU', color: '#be123c', rep: 52 },
  { name: 'Valley Athletic', shortName: 'VAL', color: '#5b21b6', rep: 50 },
  { name: 'Newbridge Town', shortName: 'NEW', color: '#0f766e', rep: 48 },
]

const FIRST = [
  'Alex', 'Jordan', 'Sam', 'Chris', 'Morgan', 'Riley', 'Casey', 'Jamie', 'Taylor', 'Drew',
  'Kai', 'Noah', 'Leo', 'Omar', 'Felix', 'Hugo', 'Ivan', 'Nico', 'Owen', 'Quinn',
]
const LAST = [
  'Hart', 'Cole', 'Brooks', 'Reed', 'Hayes', 'Ford', 'Blake', 'Shaw', 'Lane', 'West',
  'Park', 'Stone', 'Cross', 'Wells', 'Grant', 'Frost', 'Nash', 'Quinn', 'Porter', 'Vance',
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

export function createClubs(humanClubId: string): Club[] {
  return CLUB_DEFS.map((def, i) => {
    const id = `club-${i + 1}`
    const isHuman = id === humanClubId
    const balance = Math.round(8_000_000 + def.rep * 180_000 + (isHuman ? 500_000 : 0))
    return {
      id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      controlledBy: isHuman ? 'human' : 'ai',
      reputation: def.rep,
      stadiumCapacity: 18_000 + def.rep * 400,
      balance,
      wageBudgetWeekly: Math.round(80_000 + def.rep * 2_200),
      seasonStartBalance: balance,
      division: 1 as const,
      social: createClubSocial({
        id,
        name: def.name,
        shortName: def.shortName,
        reputation: def.rep,
        stadiumCapacity: 18_000 + def.rep * 400,
        division: 1,
      }),
    }
  })
}

export function createPlayersForClubs(clubs: Club[], seed = 2026): Player[] {
  const rng = mulberry32(seed)
  const players: Player[] = []
  let n = 0

  for (const club of clubs) {
    const template = squadTemplate(club.reputation)
    let clubIndex = 0
    const clubPlayers: Player[] = []
    for (const row of template) {
      for (let i = 0; i < row.count; i++) {
        n += 1
        clubIndex += 1
        const overall = clamp(row.ovr + (rng() - 0.5) * 8, 45, 92)
        const age = 17 + Math.floor(rng() * 18)
        const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
        const ca = caFromOverall(overall)
        const personality = pickPersonality(rng, age, overall)
        const attrs = makeAttrs(rng, overall, row.role)
        const ovr = overallFromCa(ca)
        clubPlayers.push({
          id: `p-${n}`,
          clubId: club.id,
          name,
          age,
          role: row.role,
          position: roleGroup(row.role),
          overall: ovr,
          ca,
          pa: makePa(rng, ca, age),
          attrs,
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
          contractYears: 2 + Math.floor(rng() * 3),
          contractEndSeason: 2028 + Math.floor(rng() * 2),
          releaseClause: null,
          minutesPlayed: 0,
          isYouth: false,
          mentorId: null,
          mediaHandling: 6 + Math.floor(rng() * 12),
          skills: rollPlayerSkills(roleGroup(row.role), ovr, rng, {
            role: row.role,
            attrs,
            id: `p-${n}`,
          }),
          social: createPlayerSocial(
            {
              id: `p-${n}`,
              name,
              overall: overallFromCa(ca),
              age,
              mediaHandling: 6 + Math.floor(rng() * 12),
              isYouth: false,
            },
            club.social?.followers ?? 80_000,
          ),
        })
      }
    }
    clubPlayers.sort((a, b) => b.overall - a.overall)
    clubPlayers.forEach((p, idx) => {
      p.squadRole = pickSquadRole(p.overall, p.age, idx)
      players.push(p)
    })
  }
  return players
}

export function autoPickTactics(
  clubId: string,
  players: Player[],
  formation: FormationId = '4-3-3',
  formationOop: FormationId = formation,
  coach?: WorldCoach | null,
): Tactics {
  const slots = FORMATION_SLOTS[formation]
  const pool = players
    .filter(
      (p) =>
        p.clubId === clubId &&
        p.injuryDays <= 0 &&
        (p.illnessDays ?? 0) <= 0 &&
        (p.banMatches ?? 0) <= 0 &&
        (p.leaveDays ?? 0) <= 0,
    )
    .map((p) => ensurePlayerTacticalRoles(p))

  const used = new Set<string>()
  const startingXi: string[] = []
  const slotRoles: TacticalRoleId[] = []

  for (const slot of slots) {
    let best: Player | null = null
    let bestScore = -1
    for (const p of pool) {
      if (used.has(p.id)) continue
      const roleId = pickSlotRoleForPlayer(p, slot, coach)
      const score = xiPickScore(p, slot, roleId, coach)
      if (score > bestScore) {
        bestScore = score
        best = p
      }
    }
    if (best) {
      used.add(best.id)
      startingXi.push(best.id)
      slotRoles.push(pickSlotRoleForPlayer(best, slot, coach))
    } else {
      slotRoles.push(ensureSlotRoles([slot])[0]!)
    }
  }

  const bench = pool
    .filter((p) => !used.has(p.id))
    .slice()
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 7)
    .map((p) => p.id)

  const caps = pickCaptainsFromXi(startingXi, players)

  return {
    formation,
    formationOop,
    instructions: { ...DEFAULT_INSTRUCTIONS },
    familiarity: 55,
    startingXi,
    bench,
    slotRoles: ensureSlotRoles(slots, slotRoles),
    captainId: caps.captainId,
    viceCaptainId: caps.viceCaptainId,
    setPieces: { ...DEFAULT_SET_PIECES },
  }
}

export function createTacticsForAll(clubs: Club[], players: Player[]): Record<string, Tactics> {
  const map: Record<string, Tactics> = {}
  for (const club of clubs) {
    const coach = getWorldCoach(club.coachId)
    const formation = coach?.preferredFormation ?? '4-3-3'
    const oop = coach?.formationOop ?? formation
    const base = autoPickTactics(club.id, players, formation, oop, coach)
    if (!coach) {
      map[club.id] = base
      continue
    }
    map[club.id] = {
      ...base,
      instructions: instructionsFromCoach(coach),
      setPieces: {
        ...DEFAULT_SET_PIECES,
        corners: coach.solveGame.includes('set_pieces') ? 'near_post' : DEFAULT_SET_PIECES.corners,
        freeKicks: coach.solveGame.includes('set_pieces') ? 'direct' : DEFAULT_SET_PIECES.freeKicks,
      },
      familiarity: Math.min(78, 50 + Math.round(coach.power / 5)),
    }
  }
  return map
}

export function listClubOptions() {
  return CLUB_DEFS.map((def, i) => ({
    id: `club-${i + 1}`,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    reputation: def.rep,
  }))
}

export { FIRST, LAST, mulberry32 }
