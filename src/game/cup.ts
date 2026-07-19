import cupFormat from '@/data/cupFormat.json'
import type { Club, CupState, Fixture } from './types'
import { midweekMatchDate, shiftMidweekDate } from './calendarDates'

export function createCupState(name = cupFormat.name): CupState {
  return {
    name,
    championClubId: null,
    eliminated: [],
  }
}

/** Seed cup R16 from top 16 by reputation; schedule midweek. */
export function generateCupFixtures(clubs: Club[], seasonStartDate: string): Fixture[] {
  const seeded = clubs.slice().sort((a, b) => b.reputation - a.reputation).slice(0, 16)
  const fixtures: Fixture[] = []
  const rounds = cupFormat.rounds

  const r16 = rounds[0]
  for (let i = 0; i < 8; i++) {
    const home = seeded[i]
    const away = seeded[15 - i]
    fixtures.push({
      id: `cup-${r16.id}-${i + 1}`,
      matchday: r16.matchdayOffset,
      date: midweekMatchDate(seasonStartDate, r16.matchdayOffset),
      homeClubId: home.id,
      awayClubId: away.id,
      played: false,
      competition: 'cup',
      cupRound: r16.id,
      slot: 'midweek',
    })
  }
  return fixtures
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
    let winner: string
    if (f.penaltiesHome != null && f.penaltiesAway != null && hg === ag) {
      winner = f.penaltiesHome > f.penaltiesAway ? f.homeClubId : f.awayClubId
    } else {
      winner = hg >= ag ? f.homeClubId : f.awayClubId
    }
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
      date: shiftMidweekDate(playedThis[0].date, nextRound.matchdayOffset - matchday),
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      played: false,
      competition: 'cup',
      cupRound: nextRound.id,
      slot: 'midweek',
    })
  }

  return {
    fixtures: [...fixtures, ...newFx],
    cup: { ...cup, eliminated },
  }
}
