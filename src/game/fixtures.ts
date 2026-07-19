import type { Fixture } from './types'
import { isValidLeagueSize } from '@/data/world/leagueSize'

/** Round-robin home & away — วันที่มาจากปฏิทิน (มีช่องพัก) ไม่ใช่ทุก 7 วันติด */
export function generateSeasonFixtures(
  clubIds: string[],
  seasonStart = '2026-08-15',
  division: 1 | 2 = 1,
  dateByMatchday?: Record<number, string>,
): Fixture[] {
  if (!isValidLeagueSize(clubIds.length)) {
    throw new Error(`ลีกต้องมีจำนวนสโมสรคู่ (>=4) ได้ ${clubIds.length}`)
  }

  const n = clubIds.length
  const rounds = n - 1
  const half = n / 2
  const rotation = clubIds.slice()
  const fixtures: Fixture[] = []
  let id = 1
  const prefix = division === 2 ? 'fx2' : 'fx'

  const addDays = (iso: string, days: number) => {
    const d = new Date(`${iso}T12:00:00Z`)
    d.setUTCDate(d.getUTCDate() + days)
    return d.toISOString().slice(0, 10)
  }

  const dateFor = (matchday: number) =>
    dateByMatchday?.[matchday] ?? addDays(seasonStart, (matchday - 1) * 7)

  for (let round = 0; round < rounds; round++) {
    const matchday = round + 1
    const date = dateFor(matchday)
    for (let i = 0; i < half; i++) {
      const home = rotation[i]
      const away = rotation[n - 1 - i]
      fixtures.push({
        id: `${prefix}-${id++}`,
        matchday,
        date,
        homeClubId: home,
        awayClubId: away,
        played: false,
        competition: 'league',
        division,
        slot: 'weekend',
      })
    }
    const fixed = rotation[0]
    const rest = rotation.slice(1)
    rest.unshift(rest.pop()!)
    rotation.splice(0, rotation.length, fixed, ...rest)
  }

  const firstHalf = fixtures.slice()
  for (const fx of firstHalf) {
    const matchday = fx.matchday + rounds
    fixtures.push({
      id: `${prefix}-${id++}`,
      matchday,
      date: dateFor(matchday),
      homeClubId: fx.awayClubId,
      awayClubId: fx.homeClubId,
      played: false,
      competition: 'league',
      division,
      slot: 'weekend',
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
