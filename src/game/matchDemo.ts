/**
 * แมตช์จำลอง El Clásico — ไม่ดึง worldSeed / fmInside (18MB) เพจโหลดติด
 */
import { LEAGUES_REST } from '@/data/world/leaguesRest'
import { espRosterForClub, espYouthForClub } from '@/data/world/espPlayers'
import {
  caFromOverall,
  makeAttrs,
  makeHidden,
  makePa,
  overallFromCa,
  pickPersonality,
} from './attributes'
import { createBodyMap } from './bodyMap'
import { simulateFixture } from './matchEngine'
import { ensurePlayerTacticalRoles, pickSlotRoleForPlayer } from './playerTacticalRoles'
import { rollPlayerSkills } from './playerSkills'
import { roleGroup } from './positions'
import { planDemoVisitors } from './stadiumVisits'
import { ensureCaptains } from './match/matchCaptain'
import { ensureSlotRoles } from './tacticalRoles'
import { FORMATION_SLOTS } from './types'
import type {
  Club,
  Fixture,
  FormationId,
  MatchEvent,
  MatchResult,
  Player,
  Tactics,
} from './types'
import { getWorldCoach } from './worldCoaches'

export {
  DEMO_WALL_MS,
  DEMO_MATCH_MINUTES,
  demoWallMsAtMinute,
  demoIndexAtWallMs,
  nextBigEventIndex,
  buildDemoTimeline,
  demoBlendAtWallMs,
  isDemoFeedEvent,
} from './matchDemoMeta'

const DEFAULT_FORMATION: FormationId = '4-3-3'
const DEMO_HOME_CREST = 'rma'
const DEMO_AWAY_CREST = 'bar'

export type MatchDemoBundle = {
  home: Club
  away: Club
  players: Player[]
  result: MatchResult
  events: MatchEvent[]
  homeXi: string[]
  awayXi: string[]
  homeBench: string[]
  awayBench: string[]
  tacticsByClub: Record<string, Tactics>
  seed: number
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

function defaultTactics(
  xi: string[],
  bench: string[],
  players: Player[],
  coachId: string | null | undefined,
): Tactics {
  const slots = FORMATION_SLOTS[DEFAULT_FORMATION]
  const coach = getWorldCoach(coachId)
  const slotRoles = xi.map((id, i) => {
    const p = players.find((x) => x.id === id)
    const slot = slots[i]!
    return p ? pickSlotRoleForPlayer(p, slot, coach) : ensureSlotRoles([slot])[0]!
  })
  return ensureCaptains(
    {
      formation: DEFAULT_FORMATION,
      formationOop: DEFAULT_FORMATION,
      familiarity: 72,
      instructions: {
        mentality: 'balanced',
        pressing: 'medium',
        tempo: 'normal',
        width: 'normal',
        style: 'possession',
      },
      startingXi: xi,
      bench,
      setPieces: { corners: 'mixed', freeKicks: 'mixed' },
      slotRoles,
    },
    players,
  )
}

function pickXi(pool: Player[], formation: FormationId): { xi: string[]; bench: string[] } {
  const slots = FORMATION_SLOTS[formation]
  const available = pool
    .filter((p) => (p.injuryDays ?? 0) <= 0 && (p.banMatches ?? 0) <= 0)
    .slice()
    .sort((a, b) => b.overall - a.overall)
  const used = new Set<string>()
  const xi: string[] = []

  for (const role of slots) {
    const pick =
      available
        .filter((p) => !used.has(p.id))
        .sort((a, b) => {
          const score = (p: Player) =>
            p.overall +
            (p.role === role ? 10 : roleGroup(p.role) === roleGroup(role) ? 4 : 0)
          return score(b) - score(a)
        })[0] ?? available.find((p) => !used.has(p.id))
    if (!pick) break
    xi.push(pick.id)
    used.add(pick.id)
  }

  while (xi.length < 11) {
    const next = available.find((p) => !used.has(p.id))
    if (!next) break
    xi.push(next.id)
    used.add(next.id)
  }

  const bench = available.filter((p) => !used.has(p.id)).slice(0, 7).map((p) => p.id)
  return { xi, bench }
}

function makeDemoClub(
  id: string,
  def: { key: string; name: string; shortName: string; color: string; rep: number },
): Club {
  const followers = Math.round(800_000 + def.rep * 40_000)
  return {
    id,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    controlledBy: 'ai',
    reputation: def.rep,
    stadiumCapacity: 18_000 + def.rep * 450,
    balance: Math.round(8_000_000 + def.rep * 220_000),
    wageBudgetWeekly: Math.round(80_000 + def.rep * 2_800),
    seasonStartBalance: Math.round(8_000_000 + def.rep * 220_000),
    division: 1,
    crestKey: def.key,
    coachId: def.key === 'rma' ? 'carlo-ancelotti' : def.key === 'bar' ? 'hansi-flick' : null,
    social: {
      handle: `@${def.shortName}`,
      followers,
      engagement: 55,
      brand: Math.min(99, def.rep),
      lastPostNote: '',
    },
  }
}

function makeDemoPlayers(club: Club, crestKey: string, seed: number, startN: number): Player[] {
  const rng = mulberry32(seed)
  const senior = espRosterForClub(crestKey)
  const youth = espYouthForClub(crestKey)
  const used = new Set<string>()
  const stars = [...senior, ...youth.filter((y) => !senior.some((s) => s.name === y.name))]
  const out: Player[] = []
  let n = startN

  for (const star of stars) {
    if (used.has(star.name)) continue
    used.add(star.name)
    n += 1
    const ca = caFromOverall(star.ovr)
    const personality = pickPersonality(rng, star.age, star.ovr)
    const attrs = makeAttrs(rng, star.ovr, star.role)
    const ovr = overallFromCa(ca)
    const id = `demo-${n}`
    const wage = Math.round(1200 + star.ovr * 140 + club.reputation * 50)
    out.push(
      ensurePlayerTacticalRoles({
        id,
        clubId: club.id,
        name: star.name,
        age: star.age,
        role: star.role,
        position: roleGroup(star.role),
        overall: ovr,
        ca,
        pa: makePa(rng, ca, star.age),
        attrs,
        hidden: makeHidden(rng),
        growth: personality.growth,
        personalityId: personality.personalityId,
        condition: 88 + Math.floor(rng() * 12),
        sharpness: 75 + Math.floor(rng() * 20),
        form: 8 + Math.floor(rng() * 8),
        morale: 12 + Math.floor(rng() * 6),
        happiness: 12 + Math.floor(rng() * 6),
        wage,
        cash: Math.round(wage * 10),
        squadRole: star.isYouth ? 'prospect' : 'key',
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
        isYouth: Boolean(star.isYouth),
        mentorId: null,
        mediaHandling: 10,
        skills: rollPlayerSkills(roleGroup(star.role), ovr, rng, {
          role: star.role,
          attrs,
          id,
        }),
      }),
    )
  }
  return out
}

export function buildMatchDemo(opts?: { seed?: number }): MatchDemoBundle {
  const seed = opts?.seed ?? (Date.now() % 1_000_000)
  const esp = LEAGUES_REST.find((l) => l.id === 'esp')
  if (!esp) throw new Error('La Liga definition missing')

  const homeDef = esp.clubs.find((c) => c.key === DEMO_HOME_CREST) ?? esp.clubs[0]!
  const awayDef = esp.clubs.find((c) => c.key === DEMO_AWAY_CREST) ?? esp.clubs[1]!
  const home = makeDemoClub('demo-rma', homeDef)
  const away = makeDemoClub('demo-bar', awayDef)

  const players = [
    ...makeDemoPlayers(home, homeDef.key, seed, 0),
    ...makeDemoPlayers(away, awayDef.key, seed + 97, 500),
  ]

  const homePick = pickXi(
    players.filter((p) => p.clubId === home.id),
    DEFAULT_FORMATION,
  )
  const awayPick = pickXi(
    players.filter((p) => p.clubId === away.id),
    DEFAULT_FORMATION,
  )

  if (homePick.xi.length < 11 || awayPick.xi.length < 11) {
    throw new Error(
      `XI ไม่ครบ 11v11 (RMA ${homePick.xi.length}, BAR ${awayPick.xi.length})`,
    )
  }

  const clubs = [home, away]
  const tacticsByClub: Record<string, Tactics> = {
    [home.id]: defaultTactics(homePick.xi, homePick.bench, players, home.coachId),
    [away.id]: defaultTactics(awayPick.xi, awayPick.bench, players, away.coachId),
  }

  const fixture: Fixture = {
    id: `demo-${seed}`,
    matchday: 1,
    date: '2026-08-01',
    homeClubId: home.id,
    awayClubId: away.id,
    played: false,
    competition: 'league',
    division: 1,
  }

  const result = simulateFixture(fixture, clubs, players, tacticsByClub, seed, 1, undefined, undefined, {
    fidelity: 'human',
    phase: 'full',
    stadiumVisitors: planDemoVisitors(fixture, players, homePick.xi, awayPick.xi, seed),
  })

  return {
    home,
    away,
    players,
    result,
    events: result.events,
    homeXi: homePick.xi,
    awayXi: awayPick.xi,
    homeBench: homePick.bench,
    awayBench: awayPick.bench,
    tacticsByClub,
    seed,
  }
}
