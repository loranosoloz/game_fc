/**
 * แมตช์เปิดฤดูกาล — Community Shield / ซูเปอร์คัพ ตามลีก
 * แชมป์ลีกฤดูกาลก่อน vs แชมป์ถ้วยชาติ (ถ้าซ้ำ → รองแชมป์ถ้วย หรือ อันดับ 2 ลีก)
 */
import type { Club, CupState, Fixture, GameSave } from './types'
import type { LeagueId } from '@/data/world'
import { addDays } from './europeAccess'

export type DomesticTitles = {
  leagueChampionId: string | null
  cupChampionId: string | null
  cupRunnerId: string | null
  leagueRunnerId: string | null
}

export const SUPER_CUP_NAME: Record<string, string> = {
  eng: 'FA Community Shield',
  esp: 'Supercopa de España',
  ger: 'DFL-Supercup',
  fra: 'Trophée des Champions',
  ita: 'Supercoppa Italiana',
  tha: 'แชมเปียนส์คัพ',
  jpn: 'Japanese Super Cup',
  kor: 'Korean Super Cup',
  sco: 'Scottish Season Opener',
  ned: 'Johan Cruyff Shield',
  prt: 'Supertaça Cândido de Oliveira',
  bel: 'Belgian Super Cup',
  tur: 'Turkish Super Cup',
  bra: 'Supercopa do Brasil',
  aut: 'ÖFB Supercup',
  sui: 'Swiss Super Cup',
  den: 'Danish Super Cup',
  gre: 'Greek Super Cup',
  vie: 'Vietnamese Super Cup',
  idn: 'Indonesian Super Cup',
  mys: 'Malaysia Charity Shield',
  sgp: 'Singapore Community Shield',
  sau: 'Saudi Super Cup',
}

export function superCupName(leagueId: string): string {
  return SUPER_CUP_NAME[leagueId] ?? 'Super Cup'
}

export function createSuperCupState(leagueId: string): CupState {
  return {
    name: superCupName(leagueId),
    championClubId: null,
    eliminated: [],
  }
}

export function createDomesticTitles(): DomesticTitles {
  return {
    leagueChampionId: null,
    cupChampionId: null,
    cupRunnerId: null,
    leagueRunnerId: null,
  }
}

export function ensureDomesticTitles(save: GameSave): DomesticTitles {
  return save.domesticTitles ?? createDomesticTitles()
}

function sortedTable(save: GameSave) {
  return [...(save.table ?? [])].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

/** เก็บแชมป์ลีก/ถ้วยก่อนรีเซ็ตฤดูกาล */
export function snapshotDomesticTitles(save: GameSave): DomesticTitles {
  const table = sortedTable(save)
  const leagueChampionId = table[0]?.clubId ?? null
  const leagueRunnerId = table[1]?.clubId ?? null
  const cupChampionId = save.cup?.championClubId ?? null

  let cupRunnerId: string | null = null
  const finals = save.fixtures.filter(
    (f) => f.competition === 'cup' && f.cupRound === 'final' && f.played,
  )
  const final = finals[finals.length - 1]
  if (final && cupChampionId) {
    cupRunnerId =
      final.homeClubId === cupChampionId ? final.awayClubId : final.homeClubId
  }

  return {
    leagueChampionId,
    cupChampionId,
    cupRunnerId,
    leagueRunnerId,
  }
}

/** จับคู่สองทีมสำหรับนัดเปิดฤดูกาล */
export function resolveSuperCupPair(
  domesticDiv1: Club[],
  titles: DomesticTitles,
): { homeId: string; awayId: string } | null {
  const byId = new Map(domesticDiv1.map((c) => [c.id, c]))
  const alive = (id: string | null | undefined) => (id && byId.has(id) ? id : null)

  let a = alive(titles.leagueChampionId)
  let b = alive(titles.cupChampionId)

  // ซีซันแรก / ยังไม่มีแชมป์ — top 2 ตามชื่อเสียง
  if (!a || !b) {
    const ranked = domesticDiv1.slice().sort((x, y) => y.reputation - x.reputation)
    a = a ?? ranked[0]?.id ?? null
    b = b ?? ranked[1]?.id ?? null
  }

  if (!a || !b) return null

  // แชมป์ลีก = แชมป์ถ้วย → ใช้รองแชมป์ถ้วย หรือ อันดับ 2 ลีก
  if (a === b) {
    b =
      alive(titles.cupRunnerId) ??
      alive(titles.leagueRunnerId) ??
      domesticDiv1
        .slice()
        .sort((x, y) => y.reputation - x.reputation)
        .map((c) => c.id)
        .find((id) => id !== a) ??
      null
  }

  if (!a || !b || a === b) return null
  return { homeId: a, awayId: b }
}

/** นัดเดียว matchday 0 — เล่นก่อนเปิดลีก */
export function generateSuperCupFixture(
  leagueId: LeagueId | string,
  domesticDiv1: Club[],
  titles: DomesticTitles,
  season: number,
  seasonStart = '2026-08-15',
): Fixture | null {
  const pair = resolveSuperCupPair(domesticDiv1, titles)
  if (!pair) return null
  return {
    id: `super_cup-${season}-final`,
    matchday: 0,
    date: addDays(seasonStart, -3),
    homeClubId: pair.homeId,
    awayClubId: pair.awayId,
    competition: 'super_cup',
    played: false,
    cupRound: 'final',
    slot: 'weekend',
  }
}

/** หลังแข่งนัดเปิดฤดูกาล — มงกุฎแชมป์ */
export function crownSuperCupFromFixtures(
  fixtures: Fixture[],
  cup: CupState,
  matchday: number,
): CupState {
  if (cup.championClubId) return cup
  const played = fixtures.filter(
    (f) => f.competition === 'super_cup' && f.matchday === matchday && f.played,
  )
  if (played.length === 0) return cup
  const f = played[0]!
  const hg = f.homeGoals ?? 0
  const ag = f.awayGoals ?? 0
  let winner: string
  if (f.penaltiesHome != null && f.penaltiesAway != null && hg === ag) {
    winner = f.penaltiesHome > f.penaltiesAway ? f.homeClubId : f.awayClubId
  } else {
    winner = hg >= ag ? f.homeClubId : f.awayClubId
  }
  const loser = winner === f.homeClubId ? f.awayClubId : f.homeClubId
  return {
    ...cup,
    championClubId: winner,
    eliminated: cup.eliminated.includes(loser) ? cup.eliminated : [...cup.eliminated, loser],
  }
}
