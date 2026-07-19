/**
 * ถ้วย / น็อกเอาต์ — ต่อเวลา + ยิงจุดโทษ (แทนการบังคับ +1 ประตู)
 */
import type { CompetitionKind, Fixture, Player } from '../types'

export const MAX_MATCH_SUBS = 5

export function isKnockoutCompetition(c: CompetitionKind): boolean {
  return c === 'cup' || c === 'league_cup' || c === 'ucl' || c === 'uel' || c === 'uecl' || c === 'trophy'
}

/**
 * ต้องการผู้ชนะหลัง 90' หรือไม่
 * - นัดเดียว (ไม่มี tieId)
 * - หรือขากลับ (leg 2) ที่สกอร์รวมเสมอ (เรียกพร้อม aggregateDraw)
 */
export function needsDecisiveWinner(
  fixture: Fixture,
  opts?: { aggregateLevel?: boolean },
): boolean {
  if (!isKnockoutCompetition(fixture.competition)) return false
  if (fixture.tieId) {
    // สองนัด: ตัดสินเฉพาะขากลับเมื่อเสมอรวม
    return fixture.leg === 2 && !!opts?.aggregateLevel
  }
  return true
}

export interface PenTaker {
  id: string
  name: string
  finishing: number
  composure: number
  overall: number
}

export function buildPenOrder(players: Player[], xiIds: string[]): PenTaker[] {
  return xiIds
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p && p.role !== 'GK')
    .sort(
      (a, b) =>
        b.attrs.finishing * 0.5 +
        b.attrs.composure * 0.35 +
        b.overall * 0.15 -
        (a.attrs.finishing * 0.5 + a.attrs.composure * 0.35 + a.overall * 0.15),
    )
    .slice(0, 5)
    .map((p) => ({
      id: p.id,
      name: p.name,
      finishing: p.attrs.finishing,
      composure: p.attrs.composure,
      overall: p.overall,
    }))
}

export interface ShootoutResult {
  home: number
  away: number
  events: Array<{
    minute: number
    text: string
    clubId: string
    playerId?: string
    playerName?: string
    scored: boolean
  }>
}

/** ยิง 5 คนสลับ · ถ้าเสมอยิงต่อจนขาด */
export function simulatePenaltyShootout(
  rng: () => number,
  homeTakers: PenTaker[],
  awayTakers: PenTaker[],
  homeGk: { handling: number; reflexes: number } | null,
  awayGk: { handling: number; reflexes: number } | null,
  homeClubId: string,
  awayClubId: string,
  startMinute = 121,
): ShootoutResult {
  let home = 0
  let away = 0
  const events: ShootoutResult['events'] = []
  const minute = startMinute

  const take = (
    taker: PenTaker,
    gk: { handling: number; reflexes: number } | null,
    clubId: string,
    side: 'home' | 'away',
  ) => {
    const finish = (taker.finishing + taker.composure) / 2 / 99
    const gkStr = gk ? (gk.handling + gk.reflexes) / 2 / 99 : 0.5
    const scored = rng() < Math.max(0.42, Math.min(0.92, 0.58 + finish * 0.35 - gkStr * 0.28))
    if (side === 'home') {
      if (scored) home += 1
    } else if (scored) away += 1
    events.push({
      minute,
      text: scored
        ? `จุดโทษเข้า! ${taker.name} (${home}–${away})`
        : `เซฟ/หลุด! ${taker.name} พลาด (${home}–${away})`,
      clubId,
      playerId: taker.id,
      playerName: taker.name,
      scored,
    })
  }

  const h = homeTakers.length ? homeTakers : [{ id: 'h', name: 'Home', finishing: 70, composure: 70, overall: 70 }]
  const a = awayTakers.length ? awayTakers : [{ id: 'a', name: 'Away', finishing: 70, composure: 70, overall: 70 }]

  for (let i = 0; i < 5; i++) {
    take(h[i % h.length]!, awayGk, homeClubId, 'home')
    // early end if impossible
    const homeLeft = 4 - i
    const awayLeft = 5 - i
    if (home > away + awayLeft) break
    if (away > home + homeLeft) {
      take(a[i % a.length]!, homeGk, awayClubId, 'away')
      break
    }
    take(a[i % a.length]!, homeGk, awayClubId, 'away')
    if (i === 4) break
    const hRem = 4 - i
    const aRem = 4 - i
    if (home > away + aRem || away > home + hRem) break
  }

  let sudden = 0
  while (home === away && sudden < 10) {
    const hi = (5 + sudden) % h.length
    const ai = (5 + sudden) % a.length
    take(h[hi]!, awayGk, homeClubId, 'home')
    take(a[ai]!, homeGk, awayClubId, 'away')
    sudden += 1
  }

  return { home, away, events }
}
