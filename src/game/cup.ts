import cupFormat from '@/data/cupFormat.json'
import type { Club, CupState, Fixture } from './types'

export function createCupState(name = cupFormat.name): CupState {
  return {
    name,
    championClubId: null,
    eliminated: [],
  }
}

/** Seed cup R16 from top 16 by reputation; schedule on cup matchdays. */
export function generateCupFixtures(clubs: Club[], seasonStartDate: string): Fixture[] {
  const seeded = clubs.slice().sort((a, b) => b.reputation - a.reputation).slice(0, 16)
  const fixtures: Fixture[] = []
  const rounds = cupFormat.rounds

  // Only generate first round; later rounds added when previous completes
  const r16 = rounds[0]
  for (let i = 0; i < 8; i++) {
    const home = seeded[i]
    const away = seeded[15 - i]
    fixtures.push({
      id: `cup-${r16.id}-${i + 1}`,
      matchday: r16.matchdayOffset,
      date: addDays(seasonStartDate, (r16.matchdayOffset - 1) * 7),
      homeClubId: home.id,
      awayClubId: away.id,
      played: false,
      competition: 'cup',
      cupRound: r16.id,
    })
  }
  return fixtures
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function advanceCupAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): { fixtures: Fixture[]; cup: CupState } {
  const roundOrder = cupFormat.rounds.map((r) => r.id)
  const playedThis = fixtures.filter(
    (f) => f.competition === 'cup' && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, cup }

  const roundId = playedThis[0].cupRound
  if (!roundId) return { fixtures, cup }

  const winners: string[] = []
  const eliminated = [...cup.eliminated]
  for (const f of playedThis) {
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
    // cup: no draws — away wins on equal (simple)
    const winner = hg >= ag ? f.homeClubId : f.awayClubId
    const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
    winners.push(winner)
    if (!eliminated.includes(loser)) eliminated.push(loser)
  }

  const idx = roundOrder.indexOf(roundId)
  if (idx === roundOrder.length - 1) {
    return {
      fixtures,
      cup: { ...cup, eliminated, championClubId: winners[0] ?? null },
    }
  }

  const nextRound = cupFormat.rounds[idx + 1]
  const existingNext = fixtures.some((f) => f.cupRound === nextRound.id)
  if (existingNext || winners.length < 2) {
    return { fixtures, cup: { ...cup, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    newFx.push({
      id: `cup-${nextRound.id}-${i / 2 + 1}`,
      matchday: nextRound.matchdayOffset,
      date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      played: false,
      competition: 'cup',
      cupRound: nextRound.id,
    })
  }

  return {
    fixtures: [...fixtures, ...newFx],
    cup: { ...cup, eliminated },
  }
}
