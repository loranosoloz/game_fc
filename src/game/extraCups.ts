import leagueCupFormat from '@/data/leagueCupFormat.json'
import trophyFormat from '@/data/trophyFormat.json'
import type { Club, CupState, Fixture, CompetitionKind } from './types'

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function advanceGenericCup(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
  competition: CompetitionKind,
  rounds: Array<{ id: string; matchdayOffset: number }>,
): { fixtures: Fixture[]; cup: CupState } {
  const roundOrder = rounds.map((r) => r.id)
  const playedThis = fixtures.filter(
    (f) => f.competition === competition && f.matchday === matchday && f.played,
  )
  if (playedThis.length === 0) return { fixtures, cup }

  const roundId = playedThis[0].cupRound
  if (!roundId) return { fixtures, cup }

  const winners: string[] = []
  const eliminated = [...cup.eliminated]
  for (const f of playedThis) {
    const hg = f.homeGoals ?? 0
    const ag = f.awayGoals ?? 0
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

  const nextRound = rounds[idx + 1]
  const existingNext = fixtures.some(
    (f) => f.competition === competition && f.cupRound === nextRound.id,
  )
  if (existingNext || winners.length < 2) {
    return { fixtures, cup: { ...cup, eliminated } }
  }

  const newFx: Fixture[] = []
  for (let i = 0; i < winners.length; i += 2) {
    if (!winners[i + 1]) break
    newFx.push({
      id: `${competition}-${nextRound.id}-${i / 2 + 1}`,
      matchday: nextRound.matchdayOffset,
      date: addDays(playedThis[0].date, (nextRound.matchdayOffset - matchday) * 7),
      homeClubId: winners[i],
      awayClubId: winners[i + 1],
      played: false,
      competition,
      cupRound: nextRound.id,
    })
  }

  return { fixtures: [...fixtures, ...newFx], cup: { ...cup, eliminated } }
}

/** ลีกคัพ: 32 ทีมจากดิวิชัน 1+2 (เรียงชื่อเสียง) */
export function generateLeagueCupFixtures(
  clubs: Club[],
  seasonStartDate: string,
  name?: string,
): { fixtures: Fixture[]; state: CupState } {
  const domestic = clubs.filter((c) => !c.id.startsWith('ucl-'))
  const seeded = domestic
    .slice()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 32)
  const fixtures: Fixture[] = []
  const r0 = leagueCupFormat.rounds[0]
  for (let i = 0; i < 16; i++) {
    fixtures.push({
      id: `league_cup-${r0.id}-${i + 1}`,
      matchday: r0.matchdayOffset,
      date: addDays(seasonStartDate, (r0.matchdayOffset - 1) * 7),
      homeClubId: seeded[i].id,
      awayClubId: seeded[31 - i].id,
      played: false,
      competition: 'league_cup',
      cupRound: r0.id,
    })
  }
  return {
    fixtures,
    state: {
      name: name ?? leagueCupFormat.name,
      championClubId: null,
      eliminated: [],
    },
  }
}

/** ถ้วยลีกล่าง: 16 ทีมจากดิวิชัน 2 */
export function generateTrophyFixtures(
  clubs: Club[],
  seasonStartDate: string,
  name?: string,
): { fixtures: Fixture[]; state: CupState } {
  const div2 = clubs.filter((c) => c.division === 2 || c.id.startsWith('d2-'))
  const seeded = div2
    .slice()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 16)
  if (seeded.length < 16) {
    return {
      fixtures: [],
      state: { name: name ?? trophyFormat.name, championClubId: null, eliminated: [] },
    }
  }
  const fixtures: Fixture[] = []
  const r0 = trophyFormat.rounds[0]
  for (let i = 0; i < 8; i++) {
    fixtures.push({
      id: `trophy-${r0.id}-${i + 1}`,
      matchday: r0.matchdayOffset,
      date: addDays(seasonStartDate, (r0.matchdayOffset - 1) * 7),
      homeClubId: seeded[i].id,
      awayClubId: seeded[15 - i].id,
      played: false,
      competition: 'trophy',
      cupRound: r0.id,
    })
  }
  return {
    fixtures,
    state: {
      name: name ?? trophyFormat.name,
      championClubId: null,
      eliminated: [],
    },
  }
}

export function advanceLeagueCupAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
) {
  return advanceGenericCup(
    fixtures,
    cup,
    matchday,
    'league_cup',
    leagueCupFormat.rounds,
  )
}

export function advanceTrophyAfterMatchday(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
) {
  return advanceGenericCup(fixtures, cup, matchday, 'trophy', trophyFormat.rounds)
}

/** ขยายถ้วยใหญ่ให้มีดิวิชัน 2 ร่วม (top 16 จากทั้งสองดิวิชัน) */
export function generateNationalCupFixtures(
  clubs: Club[],
  seasonStartDate: string,
): Fixture[] {
  const domestic = clubs.filter((c) => !c.id.startsWith('ucl-'))
  const seeded = domestic
    .slice()
    .sort((a, b) => b.reputation - a.reputation)
    .slice(0, 16)
  // reuse cup.ts pattern — imported caller uses generateCupFixtures; this is optional alt
  const fixtures: Fixture[] = []
  for (let i = 0; i < 8; i++) {
    fixtures.push({
      id: `cup-r16-${i + 1}`,
      matchday: 4,
      date: addDays(seasonStartDate, 3 * 7),
      homeClubId: seeded[i].id,
      awayClubId: seeded[15 - i].id,
      played: false,
      competition: 'cup',
      cupRound: 'r16',
    })
  }
  return fixtures
}
