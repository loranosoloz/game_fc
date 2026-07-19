import type { Fixture } from './types'

/** Round-robin home & away for 20 clubs → 38 matchdays, 10 games each. */
export function generateSeasonFixtures(clubIds: string[], seasonStart = '2026-08-15'): Fixture[] {
  if (clubIds.length !== 20) {
    throw new Error('League must have exactly 20 clubs')
  }

  const n = clubIds.length
  const rounds = n - 1
  const half = n / 2
  const rotation = clubIds.slice()
  const fixtures: Fixture[] = []
  let id = 1

  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  for (let round = 0; round < rounds; round++) {
    const matchday = round + 1
    const date = addDays(seasonStart, round * 7)
    for (let i = 0; i < half; i++) {
      const home = rotation[i]
      const away = rotation[n - 1 - i]
      fixtures.push({
        id: `fx-${id++}`,
        matchday,
        date,
        homeClubId: home,
        awayClubId: away,
        played: false,
      })
    }
    const fixed = rotation[0]
    const rest = rotation.slice(1)
    rest.unshift(rest.pop()!)
    rotation.splice(0, rotation.length, fixed, ...rest)
  }

  // Second half: reverse home/away
  const firstHalf = fixtures.slice()
  for (const fx of firstHalf) {
    fixtures.push({
      id: `fx-${id++}`,
      matchday: fx.matchday + rounds,
      date: addDays(seasonStart, (fx.matchday + rounds - 1) * 7),
      homeClubId: fx.awayClubId,
      awayClubId: fx.homeClubId,
      played: false,
    })
  }

  return fixtures
}

export function blankTable(clubIds: string[]) {
  return clubIds.map((clubId) => ({
    clubId,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
  }))
}
