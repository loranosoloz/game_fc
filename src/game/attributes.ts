import attributesDb from '@/data/attributes.json'
import personalitiesDb from '@/data/personalities.json'
import developmentDb from '@/data/development.json'
import type { Player, PlayerAttributes, PlayerGrowth, PlayerHidden, RoleCode } from './types'
import { roleGroup } from './positions'
import { ensureBodyMap } from './bodyMap'

export { attributesDb, personalitiesDb, developmentDb }

function clamp(n: number, min = 1, max = 20) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function randRange(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min)
}

export function caFromOverall(overall: number): number {
  return Math.round(overall * developmentDb.caPa.caFromOverallScale)
}

export function overallFromCa(ca: number): number {
  return Math.max(40, Math.min(99, Math.round(ca / developmentDb.caPa.caFromOverallScale)))
}

export function makeAttrs(rng: () => number, overall: number, role: RoleCode): PlayerAttributes {
  const base = overall / 5
  const jitter = () => base + (rng() - 0.5) * 4
  const attrs: PlayerAttributes = {
    finishing: clamp(jitter()),
    passing: clamp(jitter()),
    tackling: clamp(jitter()),
    dribbling: clamp(jitter()),
    crossing: clamp(jitter()),
    heading: clamp(jitter()),
    technique: clamp(jitter()),
    decision: clamp(jitter()),
    vision: clamp(jitter()),
    composure: clamp(jitter()),
    positioning: clamp(jitter()),
    workRate: clamp(jitter()),
    pace: clamp(jitter()),
    stamina: clamp(jitter()),
    strength: clamp(jitter()),
    agility: clamp(jitter()),
    jumping: clamp(jitter()),
    handling: clamp(jitter() * 0.35),
    reflexes: clamp(jitter() * 0.35),
    aerialReach: clamp(jitter() * 0.35),
  }
  const group = roleGroup(role)
  if (role === 'GK') {
    attrs.handling = clamp(base + 3 + rng() * 3)
    attrs.reflexes = clamp(base + 3 + rng() * 3)
    attrs.aerialReach = clamp(base + 2 + rng() * 3)
    attrs.finishing = clamp(base * 0.35)
  } else if (group === 'FW') {
    attrs.finishing = clamp(base + 2 + rng() * 3)
    attrs.composure = clamp(base + 1 + rng() * 2)
  } else if (group === 'DF') {
    attrs.tackling = clamp(base + 2 + rng() * 3)
    attrs.positioning = clamp(base + 2 + rng() * 2)
  } else {
    attrs.passing = clamp(base + 2 + rng() * 3)
    attrs.vision = clamp(base + 1 + rng() * 2)
  }
  return attrs
}

export function makeHidden(rng: () => number): PlayerHidden {
  return {
    consistency: clamp(6 + rng() * 12),
    importantMatches: clamp(5 + rng() * 13),
    dirtiness: clamp(2 + rng() * 12),
    injuryProneness: clamp(3 + rng() * 12),
    versatility: clamp(4 + rng() * 14),
  }
}

export function pickPersonality(rng: () => number, age: number, overall: number) {
  const list = personalitiesDb.archetypes
  let pool = list
  if (age <= 21 && overall >= 68) pool = list.filter((a) => a.id === 'wonderkid' || a.id === 'driven')
  else if (rng() < 0.15) pool = list.filter((a) => a.id === 'unambitious')
  const arch = pool[Math.floor(rng() * pool.length)] ?? list[2]
  const growth: PlayerGrowth = {
    determination: clamp(randRange(rng, arch.determination[0], arch.determination[1])),
    ambition: clamp(randRange(rng, arch.ambition[0], arch.ambition[1])),
    professionalism: clamp(randRange(rng, arch.professionalism[0], arch.professionalism[1])),
    adaptability: clamp(randRange(rng, arch.adaptability[0], arch.adaptability[1])),
    learningRate: clamp(randRange(rng, arch.learningRate[0], arch.learningRate[1])),
  }
  return { personalityId: arch.id, growth }
}

export function makePa(rng: () => number, ca: number, age: number): number {
  const { paMinGap, paMaxGap } = developmentDb.caPa
  let gap = paMinGap + rng() * (paMaxGap - paMinGap)
  if (age >= 28) gap *= 0.35
  if (age <= 20) gap *= 1.15
  return Math.min(200, Math.round(ca + gap))
}

export function ensurePlayerV3Fields(p: Partial<Player> & { id: string; clubId: string; name: string }): Player {
  const role = (p.role ?? 'CM') as RoleCode
  const overall = p.overall ?? 60
  const ca = p.ca ?? caFromOverall(overall)
  const rng = () => Math.random()
  const personality =
    p.personalityId && p.growth
      ? { personalityId: p.personalityId, growth: p.growth }
      : pickPersonality(rng, p.age ?? 24, overall)

  const attrs = p.attrs
    ? {
        finishing: p.attrs.finishing ?? 10,
        passing: p.attrs.passing ?? 10,
        tackling: p.attrs.tackling ?? 10,
        dribbling: (p.attrs as PlayerAttributes).dribbling ?? 10,
        crossing: (p.attrs as PlayerAttributes).crossing ?? 10,
        heading: (p.attrs as PlayerAttributes).heading ?? 10,
        technique: (p.attrs as PlayerAttributes).technique ?? 10,
        decision: p.attrs.decision ?? 10,
        vision: (p.attrs as PlayerAttributes).vision ?? 10,
        composure: (p.attrs as PlayerAttributes).composure ?? 10,
        positioning: (p.attrs as PlayerAttributes).positioning ?? 10,
        workRate: (p.attrs as PlayerAttributes).workRate ?? 10,
        pace: p.attrs.pace ?? 10,
        stamina: p.attrs.stamina ?? 10,
        strength: (p.attrs as PlayerAttributes).strength ?? 10,
        agility: (p.attrs as PlayerAttributes).agility ?? 10,
        jumping: (p.attrs as PlayerAttributes).jumping ?? 10,
        handling: p.attrs.handling ?? 5,
        reflexes: (p.attrs as PlayerAttributes).reflexes ?? 5,
        aerialReach: (p.attrs as PlayerAttributes).aerialReach ?? 5,
      }
    : makeAttrs(rng, overall, role)

  return {
    id: p.id,
    clubId: p.clubId,
    name: p.name,
    age: p.age ?? 24,
    role,
    position: p.position ?? roleGroup(role),
    overall: overallFromCa(ca),
    ca,
    pa: p.pa ?? makePa(rng, ca, p.age ?? 24),
    attrs,
    hidden: p.hidden ?? makeHidden(rng),
    growth: personality.growth,
    personalityId: personality.personalityId,
    condition: p.condition ?? 90,
    sharpness: p.sharpness ?? 75,
    form: p.form ?? 10,
    morale: p.morale ?? 12,
    happiness: p.happiness ?? p.morale ?? 12,
    wage: p.wage ?? 2000,
    squadRole: p.squadRole ?? 'squad',
    injuryDays: p.injuryDays ?? 0,
    injuryType: p.injuryType ?? (p.injuryDays && p.injuryDays > 0 ? 'muscle' : null),
    treatment: p.treatment ?? (p.injuryDays && p.injuryDays > 0 ? 'physio' : null),
    injuryBodyPart: p.injuryBodyPart ?? null,
    bodyMap: ensureBodyMap(p),
    injuryHistory: p.injuryHistory ?? [],
    seasonYellows: p.seasonYellows ?? 0,
    banMatches: p.banMatches ?? 0,
    leaveDays: p.leaveDays ?? 0,
    contractYears: p.contractYears ?? Math.max(1, 4 - Math.floor((p.age ?? 24) / 10)),
    contractEndSeason: p.contractEndSeason ?? 2026 + (p.contractYears ?? 2),
    releaseClause: p.releaseClause ?? null,
    minutesPlayed: p.minutesPlayed ?? 0,
    isYouth: p.isYouth ?? false,
    mentorId: p.mentorId ?? null,
    mediaHandling: p.mediaHandling ?? Math.max(1, Math.min(20, Math.round(8 + Math.random() * 8))),
    cash:
      typeof p.cash === 'number'
        ? p.cash
        : Math.round((p.wage ?? 2000) * (6 + Math.random() * 14)),
    lastActivityId: p.lastActivityId ?? null,
  }
}

export function attrKeysVisible(): (keyof PlayerAttributes)[] {
  return attributesDb.attributes.map((a) => a.key as keyof PlayerAttributes)
}
