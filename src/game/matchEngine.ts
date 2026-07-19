import type { Club, Fixture, MatchEvent, MatchResult, Player, Tactics } from './types'

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
  // Poisson-ish via repeated Bernoulli
  const trials = 8
  const p = Math.min(0.55, expected / trials)
  for (let i = 0; i < trials; i++) {
    if (rng() < p) goals += 1
  }
  return goals
}

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

  const homeTactics = tacticsByClub[fixture.homeClubId]
  const awayTactics = tacticsByClub[fixture.awayClubId]
  const homeRating = xiStrength(players, homeTactics)
  const awayRating = xiStrength(players, awayTactics)

  const homeGoals = sampleGoals(homeRating, awayRating, 1.12, rng)
  const awayGoals = sampleGoals(awayRating, homeRating, 0.95, rng)

  const events: MatchEvent[] = []
  const homePlayers = homeTactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p != null && p.position !== 'GK')
  const awayPlayers = awayTactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p != null && p.position !== 'GK')

  const pushGoals = (count: number, clubId: string, pool: Player[]) => {
    for (let i = 0; i < count; i++) {
      const scorer = pool[Math.floor(rng() * pool.length)] ?? pool[0]
      events.push({
        minute: 5 + Math.floor(rng() * 85),
        kind: 'goal',
        clubId,
        playerName: scorer?.name ?? 'Unknown',
      })
    }
  }

  pushGoals(homeGoals, fixture.homeClubId, homePlayers)
  pushGoals(awayGoals, fixture.awayClubId, awayPlayers)
  events.sort((a, b) => a.minute - b.minute)

  void clubs
  return {
    fixtureId: fixture.id,
    homeGoals,
    awayGoals,
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
