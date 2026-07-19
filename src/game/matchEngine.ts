import type {
  Club,
  Fixture,
  MatchEvent,
  MatchEventKind,
  MatchResult,
  PitchSpot,
  Player,
  Tactics,
} from './types'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function xiStrength(players: Player[], tactics: Tactics): number {
  const xi = tactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[]
  if (xi.length === 0) return 50
  const sum = xi.reduce((acc, p) => {
    const fitness = (p.condition / 100) * (0.7 + p.form / 40) * (0.85 + p.morale / 50)
    return acc + p.overall * fitness
  }, 0)
  return sum / xi.length
}

function sampleGoals(attack: number, defense: number, homeBoost: number, rng: () => number) {
  const expected = Math.max(0.2, (attack / defense) * 1.15 * homeBoost + (rng() - 0.5) * 0.6)
  let goals = 0
  const trials = 8
  const p = Math.min(0.55, expected / trials)
  for (let i = 0; i < trials; i++) {
    if (rng() < p) goals += 1
  }
  return goals
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)] ?? list[0]
}

function spot(rng: () => number, zone: 'home' | 'mid' | 'away' | 'homeBox' | 'awayBox'): PitchSpot {
  const y = 18 + rng() * 64
  switch (zone) {
    case 'home':
      return { x: 8 + rng() * 22, y }
    case 'homeBox':
      return { x: 6 + rng() * 14, y: 28 + rng() * 44 }
    case 'mid':
      return { x: 35 + rng() * 30, y }
    case 'away':
      return { x: 70 + rng() * 22, y }
    case 'awayBox':
      return { x: 80 + rng() * 14, y: 28 + rng() * 44 }
  }
}

function attackingZone(isHome: boolean): 'homeBox' | 'awayBox' {
  return isHome ? 'awayBox' : 'homeBox'
}

function buildSidePlayers(tactics: Tactics, players: Player[]) {
  return tactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p != null)
}

function outfield(pool: Player[]) {
  return pool.filter((p) => p.position !== 'GK')
}

function gk(pool: Player[]) {
  return pool.find((p) => p.position === 'GK') ?? pool[0]
}

/**
 * FM-style match script: final score is decided first, then a commentary timeline
 * is built so the UI can play it back on a pitch with text.
 */
export function simulateFixture(
  fixture: Fixture,
  clubs: Club[],
  players: Player[],
  tacticsByClub: Record<string, Tactics>,
  seedExtra = 0,
): MatchResult {
  const seed =
    fixture.matchday * 10_000 +
    fixture.homeClubId.charCodeAt(fixture.homeClubId.length - 1) * 97 +
    fixture.awayClubId.charCodeAt(fixture.awayClubId.length - 1) * 13 +
    seedExtra
  const rng = mulberry32(seed)

  const homeClub = clubs.find((c) => c.id === fixture.homeClubId)!
  const awayClub = clubs.find((c) => c.id === fixture.awayClubId)!
  const homeTactics = tacticsByClub[fixture.homeClubId]
  const awayTactics = tacticsByClub[fixture.awayClubId]
  const homeRating = xiStrength(players, homeTactics)
  const awayRating = xiStrength(players, awayTactics)

  const homeGoals = sampleGoals(homeRating, awayRating, 1.12, rng)
  const awayGoals = sampleGoals(awayRating, homeRating, 0.95, rng)

  const homePool = buildSidePlayers(homeTactics, players)
  const awayPool = buildSidePlayers(awayTactics, players)
  const homeOut = outfield(homePool)
  const awayOut = outfield(awayPool)
  const homeGk = gk(homePool)
  const awayGk = gk(awayPool)

  const events: MatchEvent[] = []
  let hg = 0
  let ag = 0
  let eid = 0

  const push = (
    minute: number,
    kind: MatchEventKind,
    text: string,
    s: PitchSpot,
    extra?: Partial<MatchEvent>,
  ) => {
    events.push({
      id: `ev-${fixture.id}-${eid++}`,
      minute,
      kind,
      text,
      spot: s,
      homeGoals: hg,
      awayGoals: ag,
      ...extra,
    })
  }

  push(
    0,
    'kickoff',
    `Kick-off! ${homeClub.name} host ${awayClub.name}. The crowd is ready.`,
    { x: 50, y: 50 },
  )

  const goalMinutesHome: number[] = []
  const goalMinutesAway: number[] = []
  for (let i = 0; i < homeGoals; i++) goalMinutesHome.push(4 + Math.floor(rng() * 86))
  for (let i = 0; i < awayGoals; i++) goalMinutesAway.push(4 + Math.floor(rng() * 86))
  goalMinutesHome.sort((a, b) => a - b)
  goalMinutesAway.sort((a, b) => a - b)

  const usedMinutes = new Set<number>([0, 45, 46, 90])
  const reserveMinute = (preferred: number) => {
    let m = preferred
    while (usedMinutes.has(m)) m = Math.min(89, m + 1)
    usedMinutes.add(m)
    return m
  }

  const scheduledGoals: Array<{ minute: number; home: boolean }> = [
    ...goalMinutesHome.map((minute) => ({ minute: reserveMinute(minute), home: true })),
    ...goalMinutesAway.map((minute) => ({ minute: reserveMinute(minute), home: false })),
  ].sort((a, b) => a.minute - b.minute)

  // Fill non-goal moments
  const fillerCount = 18 + Math.floor(rng() * 8)
  const fillerMinutes: number[] = []
  for (let i = 0; i < fillerCount; i++) {
    fillerMinutes.push(reserveMinute(3 + Math.floor(rng() * 86)))
  }
  fillerMinutes.sort((a, b) => a - b)

  type Beat =
    | { t: 'goal'; minute: number; home: boolean }
    | { t: 'fill'; minute: number }

  const beats: Beat[] = [
    ...scheduledGoals.map((g) => ({ t: 'goal' as const, ...g })),
    ...fillerMinutes.map((minute) => ({ t: 'fill' as const, minute })),
  ].sort((a, b) => a.minute - b.minute)

  let halfAnnounced = false
  let secondAnnounced = false

  for (const beat of beats) {
    if (!halfAnnounced && beat.minute >= 45) {
      push(
        45,
        'halftime',
        `Half-time whistle. ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}.`,
        { x: 50, y: 50 },
      )
      halfAnnounced = true
    }
    if (!secondAnnounced && beat.minute >= 46) {
      push(
        46,
        'secondhalf',
        'Second half underway. Both sides look sharp again.',
        { x: 50, y: 50 },
      )
      secondAnnounced = true
    }

    if (beat.t === 'goal') {
      const isHome = beat.home
      const scorer = pick(rng, isHome ? homeOut : awayOut)
      const assistPool = (isHome ? homeOut : awayOut).filter((p) => p.id !== scorer.id)
      const assist = assistPool.length ? pick(rng, assistPool) : null
      const s = spot(rng, attackingZone(isHome))

      push(
        Math.max(1, beat.minute - 1),
        'chance',
        `${isHome ? homeClub.shortName : awayClub.shortName} break forward — ${scorer.name} is free!`,
        spot(rng, isHome ? 'away' : 'home'),
        { clubId: isHome ? homeClub.id : awayClub.id, playerName: scorer.name },
      )
      push(
        beat.minute,
        'shot',
        `${scorer.name} shoots...`,
        s,
        { clubId: isHome ? homeClub.id : awayClub.id, playerName: scorer.name },
      )
      if (isHome) hg += 1
      else ag += 1
      const assistText = assist ? ` Assist: ${assist.name}.` : ''
      push(
        beat.minute,
        'goal',
        `GOAL! ${scorer.name} finds the net for ${isHome ? homeClub.name : awayClub.name}!${assistText} ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}.`,
        s,
        {
          clubId: isHome ? homeClub.id : awayClub.id,
          playerName: scorer.name,
        },
      )
      continue
    }

    // Filler FM-style lines
    const homeAttack = rng() < homeRating / (homeRating + awayRating)
    const team = homeAttack ? homeClub : awayClub
    const opp = homeAttack ? awayClub : homeClub
    const attackers = homeAttack ? homeOut : awayOut
    const defenders = homeAttack ? awayOut : homeOut
    const keeper = homeAttack ? awayGk : homeGk
    const actor = pick(rng, attackers)
    const defender = pick(rng, defenders)
    const roll = rng()

    if (roll < 0.18) {
      push(
        beat.minute,
        'commentary',
        `${team.shortName} recycle possession patiently through midfield.`,
        spot(rng, 'mid'),
        { clubId: team.id },
      )
    } else if (roll < 0.34) {
      push(
        beat.minute,
        'chance',
        `${actor.name} drives at ${defender.name} — the crowd rises.`,
        spot(rng, homeAttack ? 'away' : 'home'),
        { clubId: team.id, playerName: actor.name },
      )
    } else if (roll < 0.5) {
      const s = spot(rng, attackingZone(homeAttack))
      push(
        beat.minute,
        'shot',
        `${actor.name} lets fly from the edge of the box!`,
        s,
        { clubId: team.id, playerName: actor.name },
      )
      push(
        beat.minute,
        'save',
        `Saved! ${keeper.name} keeps ${opp.shortName} level for now.`,
        s,
        { clubId: opp.id, playerName: keeper.name },
      )
    } else if (roll < 0.62) {
      push(
        beat.minute,
        'corner',
        `Corner to ${team.shortName}. ${actor.name} will deliver.`,
        spot(rng, homeAttack ? 'awayBox' : 'homeBox'),
        { clubId: team.id, playerName: actor.name },
      )
    } else if (roll < 0.74) {
      push(
        beat.minute,
        'foul',
        `Foul by ${defender.name} on ${actor.name}. Free-kick ${team.shortName}.`,
        spot(rng, 'mid'),
        { clubId: opp.id, playerName: defender.name },
      )
    } else if (roll < 0.84) {
      push(
        beat.minute,
        'card',
        `Yellow card — ${defender.name} (${opp.shortName}) goes into the book.`,
        spot(rng, 'mid'),
        { clubId: opp.id, playerName: defender.name },
      )
    } else if (roll < 0.92) {
      push(
        beat.minute,
        'commentary',
        `${opp.shortName} win it back and look for a quick transition.`,
        spot(rng, homeAttack ? 'home' : 'away'),
        { clubId: opp.id },
      )
    } else {
      push(
        beat.minute,
        'commentary',
        `The tempo drops for a moment as ${team.name} reset their shape.`,
        spot(rng, 'mid'),
        { clubId: team.id },
      )
    }
  }

  if (!halfAnnounced) {
    push(45, 'halftime', `Half-time. ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}.`, {
      x: 50,
      y: 50,
    })
  }
  if (!secondAnnounced && (homeGoals > 0 || awayGoals > 0 || rng() > 0.2)) {
    // ensure second half marker if we had late events only — already handled usually
  }

  push(
    90,
    'fulltime',
    `Full-time! ${homeClub.name} ${hg}–${ag} ${awayClub.name}.`,
    { x: 50, y: 50 },
  )

  events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))

  // Reconcile running score in events (already tracked via hg/ag at push time)
  return {
    fixtureId: fixture.id,
    homeGoals: hg,
    awayGoals: ag,
    events,
    homeRating: Math.round(homeRating * 10) / 10,
    awayRating: Math.round(awayRating * 10) / 10,
  }
}

export function applyMatchFatigue(players: Player[], tactics: Tactics, played: boolean): Player[] {
  if (!played) return players
  const used = new Set([...tactics.startingXi, ...tactics.bench.slice(0, 3)])
  return players.map((p) => {
    if (!used.has(p.id)) {
      return { ...p, condition: Math.min(100, p.condition + 4) }
    }
    const drop = 6 + Math.floor(Math.random() * 6)
    return {
      ...p,
      condition: Math.max(45, p.condition - drop),
      form: Math.min(20, Math.max(1, p.form + (Math.random() > 0.5 ? 1 : -1))),
    }
  })
}
