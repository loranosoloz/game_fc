import attributesDb from '@/data/attributes.json'
import personalitiesDb from '@/data/personalities.json'
import developmentDb from '@/data/development.json'
import type { Player, PlayerAttributes, PlayerGrowth, PlayerHidden, RoleCode } from './types'
import { roleGroup } from './positions'
import { ensureBodyMap } from './bodyMap'
import { ensurePlayerSkills } from './playerSkills'

export { attributesDb, personalitiesDb, developmentDb }

/** Player attribute scale matches FMInside (1–99) */
export const ATTR_MIN = 1
export const ATTR_MAX = 99
/** Training / development bump sized for 99-scale */
export const ATTR_BUMP = 6

function clamp(n: number, min = 1, max = 20) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function clampAttr(n: number): number {
  return Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(n)))
}

/** Upgrade legacy 1–20 attrs to 1–99 (detect by max ≤ 25) */
export function ensureAttrsScale99(attrs: PlayerAttributes): PlayerAttributes {
  const vals = Object.values(attrs).filter((v) => typeof v === 'number') as number[]
  if (vals.length === 0) return attrs
  const max = Math.max(...vals)
  if (max > 25) {
    return {
      finishing: clampAttr(attrs.finishing),
      passing: clampAttr(attrs.passing),
      tackling: clampAttr(attrs.tackling),
      dribbling: clampAttr(attrs.dribbling),
      crossing: clampAttr(attrs.crossing),
      heading: clampAttr(attrs.heading),
      technique: clampAttr(attrs.technique),
      decision: clampAttr(attrs.decision),
      vision: clampAttr(attrs.vision),
      composure: clampAttr(attrs.composure),
      positioning: clampAttr(attrs.positioning),
      workRate: clampAttr(attrs.workRate),
      pace: clampAttr(attrs.pace),
      stamina: clampAttr(attrs.stamina),
      strength: clampAttr(attrs.strength),
      agility: clampAttr(attrs.agility),
      jumping: clampAttr(attrs.jumping),
      handling: clampAttr(attrs.handling),
      reflexes: clampAttr(attrs.reflexes),
      aerialReach: clampAttr(attrs.aerialReach),
    }
  }
  const to99 = (v: number) => clampAttr(Math.round((v / 20) * 99))
  return {
    finishing: to99(attrs.finishing),
    passing: to99(attrs.passing),
    tackling: to99(attrs.tackling),
    dribbling: to99(attrs.dribbling),
    crossing: to99(attrs.crossing),
    heading: to99(attrs.heading),
    technique: to99(attrs.technique),
    decision: to99(attrs.decision),
    vision: to99(attrs.vision),
    composure: to99(attrs.composure),
    positioning: to99(attrs.positioning),
    workRate: to99(attrs.workRate),
    pace: to99(attrs.pace),
    stamina: to99(attrs.stamina),
    strength: to99(attrs.strength),
    agility: to99(attrs.agility),
    jumping: to99(attrs.jumping),
    handling: to99(attrs.handling),
    reflexes: to99(attrs.reflexes),
    aerialReach: to99(attrs.aerialReach),
  }
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
  const base = Math.max(35, Math.min(92, overall))
  const jitter = () => base + (rng() - 0.5) * 16
  const attrs: PlayerAttributes = {
    finishing: clampAttr(jitter()),
    passing: clampAttr(jitter()),
    tackling: clampAttr(jitter()),
    dribbling: clampAttr(jitter()),
    crossing: clampAttr(jitter()),
    heading: clampAttr(jitter()),
    technique: clampAttr(jitter()),
    decision: clampAttr(jitter()),
    vision: clampAttr(jitter()),
    composure: clampAttr(jitter()),
    positioning: clampAttr(jitter()),
    workRate: clampAttr(jitter()),
    pace: clampAttr(jitter()),
    stamina: clampAttr(jitter()),
    strength: clampAttr(jitter()),
    agility: clampAttr(jitter()),
    jumping: clampAttr(jitter()),
    handling: clampAttr(jitter() * 0.35),
    reflexes: clampAttr(jitter() * 0.35),
    aerialReach: clampAttr(jitter() * 0.35),
  }
  const group = roleGroup(role)
  if (role === 'GK') {
    attrs.handling = clampAttr(base + 8 + rng() * 10)
    attrs.reflexes = clampAttr(base + 8 + rng() * 10)
    attrs.aerialReach = clampAttr(base + 5 + rng() * 10)
    attrs.finishing = clampAttr(base * 0.35)
  } else if (group === 'FW') {
    attrs.finishing = clampAttr(base + 6 + rng() * 10)
    attrs.composure = clampAttr(base + 3 + rng() * 8)
  } else if (group === 'DF') {
    attrs.tackling = clampAttr(base + 6 + rng() * 10)
    attrs.positioning = clampAttr(base + 5 + rng() * 8)
  } else {
    attrs.passing = clampAttr(base + 6 + rng() * 10)
    attrs.vision = clampAttr(base + 3 + rng() * 8)
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

  const mid = Math.round(overall * 0.85)
  const attrs = ensureAttrsScale99(
    p.attrs
      ? {
          finishing: p.attrs.finishing ?? mid,
          passing: p.attrs.passing ?? mid,
          tackling: p.attrs.tackling ?? mid,
          dribbling: (p.attrs as PlayerAttributes).dribbling ?? mid,
          crossing: (p.attrs as PlayerAttributes).crossing ?? mid,
          heading: (p.attrs as PlayerAttributes).heading ?? mid,
          technique: (p.attrs as PlayerAttributes).technique ?? mid,
          decision: p.attrs.decision ?? mid,
          vision: (p.attrs as PlayerAttributes).vision ?? mid,
          composure: (p.attrs as PlayerAttributes).composure ?? mid,
          positioning: (p.attrs as PlayerAttributes).positioning ?? mid,
          workRate: (p.attrs as PlayerAttributes).workRate ?? mid,
          pace: p.attrs.pace ?? mid,
          stamina: p.attrs.stamina ?? mid,
          strength: (p.attrs as PlayerAttributes).strength ?? mid,
          agility: (p.attrs as PlayerAttributes).agility ?? mid,
          jumping: (p.attrs as PlayerAttributes).jumping ?? mid,
          handling: p.attrs.handling ?? Math.round(mid * 0.4),
          reflexes: (p.attrs as PlayerAttributes).reflexes ?? Math.round(mid * 0.4),
          aerialReach: (p.attrs as PlayerAttributes).aerialReach ?? Math.round(mid * 0.4),
        }
      : makeAttrs(rng, overall, role),
  )

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
    illnessDays: p.illnessDays ?? 0,
    illnessType: p.illnessType ?? null,
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
    skills: ensurePlayerSkills({
      ...p,
      position: p.position ?? roleGroup(role),
      overall: p.overall ?? overallFromCa(ca),
      role,
    } as Player),
    wantAway: p.wantAway ?? null,
    refuseContractRenewal: p.refuseContractRenewal ?? false,
    cash:
      typeof p.cash === 'number'
        ? p.cash
        : Math.round((p.wage ?? 2000) * (6 + Math.random() * 14)),
    lastActivityId: p.lastActivityId ?? null,
    social: p.social ?? {
      handle: `@${(p.name ?? 'Player').replace(/\s+/g, '').slice(0, 14) || 'Player'}`,
      followers: Math.max(
        1_200,
        Math.round(((p.overall ?? 60) ** 2) * 55 + ((p.mediaHandling ?? 10) * 9_000)),
      ),
      heat: 20,
      postsWeek: 2,
      verified: (p.overall ?? 0) >= 78,
    },
    careerHonours: Array.isArray(p.careerHonours) ? p.careerHonours : [],
  }
}

export function attrKeysVisible(): (keyof PlayerAttributes)[] {
  return attributesDb.attributes.map((a) => a.key as keyof PlayerAttributes)
}
