import type { Club, FormationId, Player, PlayerAttributes, Position, Tactics } from './types'
import { FORMATION_SLOTS } from './types'

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

function makeAttrs(rng: () => number, overall: number, position: Position): PlayerAttributes {
  const base = overall / 5
  const jitter = () => base + (rng() - 0.5) * 4
  const attrs: PlayerAttributes = {
    finishing: clamp(jitter()),
    passing: clamp(jitter()),
    tackling: clamp(jitter()),
    pace: clamp(jitter()),
    stamina: clamp(jitter()),
    decision: clamp(jitter()),
    handling: clamp(jitter() * 0.4),
  }
  if (position === 'GK') {
    attrs.handling = clamp(base + 3 + rng() * 3)
    attrs.finishing = clamp(base * 0.4)
  } else if (position === 'FW') {
    attrs.finishing = clamp(base + 2 + rng() * 3)
  } else if (position === 'DF') {
    attrs.tackling = clamp(base + 2 + rng() * 3)
  } else if (position === 'MF') {
    attrs.passing = clamp(base + 2 + rng() * 3)
  }
  return attrs
}

function squadTemplate(rep: number): Array<{ position: Position; count: number; ovr: number }> {
  const base = Math.round(58 + (rep - 48) * 0.45)
  return [
    { position: 'GK', count: 2, ovr: base - 2 },
    { position: 'DF', count: 7, ovr: base },
    { position: 'MF', count: 7, ovr: base + 1 },
    { position: 'FW', count: 4, ovr: base + 2 },
  ]
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
    }
  })
}

export function createPlayersForClubs(clubs: Club[], seed = 2026): Player[] {
  const rng = mulberry32(seed)
  const players: Player[] = []
  let n = 0

  for (const club of clubs) {
    const template = squadTemplate(club.reputation)
    for (const row of template) {
      for (let i = 0; i < row.count; i++) {
        n += 1
        const overall = clamp(row.ovr + (rng() - 0.5) * 8, 45, 92)
        const name = `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
        players.push({
          id: `p-${n}`,
          clubId: club.id,
          name,
          age: 17 + Math.floor(rng() * 18),
          position: row.position,
          overall,
          attrs: makeAttrs(rng, overall, row.position),
          condition: 85 + Math.floor(rng() * 15),
          form: 6 + Math.floor(rng() * 8),
          morale: 10 + Math.floor(rng() * 8),
          wage: Math.round(800 + overall * 90 + club.reputation * 40),
        })
      }
    }
  }
  return players
}

export function autoPickTactics(clubId: string, players: Player[], formation: FormationId = '4-3-3'): Tactics {
  const slots = FORMATION_SLOTS[formation]
  const pool = players
    .filter((p) => p.clubId === clubId)
    .slice()
    .sort((a, b) => b.overall * (b.condition / 100) - a.overall * (a.condition / 100))

  const used = new Set<string>()
  const startingXi: string[] = []

  for (const slot of slots) {
    const pick =
      pool.find((p) => !used.has(p.id) && p.position === slot) ??
      pool.find((p) => !used.has(p.id))
    if (pick) {
      used.add(pick.id)
      startingXi.push(pick.id)
    }
  }

  const bench = pool.filter((p) => !used.has(p.id)).slice(0, 7).map((p) => p.id)
  return { formation, startingXi, bench }
}

export function createTacticsForAll(clubs: Club[], players: Player[]): Record<string, Tactics> {
  const formations: FormationId[] = ['4-3-3', '4-4-2', '4-2-3-1']
  const map: Record<string, Tactics> = {}
  clubs.forEach((club, i) => {
    map[club.id] = autoPickTactics(club.id, players, formations[i % formations.length])
  })
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
