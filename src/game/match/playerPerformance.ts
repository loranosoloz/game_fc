/**
 * xG · Player Ratings · Man of the Match
 */
import type { MatchEvent, MatchPlayerRating } from '../types'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** xG จากจังหวะยิง (ก่อนรู้ผล) */
export function shotXg(progress: number, onTargetLikely: boolean): number {
  const base = 0.04 + Math.max(0, progress - 55) / 90
  return clamp(onTargetLikely ? base * 1.35 : base * 0.85, 0.02, 0.55)
}

export interface PlayerPerfAccum {
  playerId: string
  name: string
  team: 'home' | 'away'
  overall: number
  minutes: number
  goals: number
  shots: number
  shotsOnTarget: number
  keyActions: number
  fouls: number
  yellows: number
  reds: number
  saves: number
  xgContrib: number
  /** พาสสำเร็จในแมตช์ */
  passesCompleted: number
  /** ดริบสำเร็จ */
  dribblesOk: number
  tacticalRoleId?: string | null
  roleFit?: number
}

export function createPerf(
  playerId: string,
  name: string,
  team: 'home' | 'away',
  overall: number,
): PlayerPerfAccum {
  return {
    playerId,
    name,
    team,
    overall,
    minutes: 0,
    goals: 0,
    shots: 0,
    shotsOnTarget: 0,
    keyActions: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    saves: 0,
    xgContrib: 0,
    passesCompleted: 0,
    dribblesOk: 0,
  }
}

/** สะสมจาก MatchEvent หลังจบ (fallback ถ้าไม่ track ระหว่างเกม) */
export function accumulateFromEvents(
  events: MatchEvent[],
  seed: Map<string, PlayerPerfAccum>,
): Map<string, PlayerPerfAccum> {
  const map = new Map(seed)
  for (const ev of events) {
    if (!ev.playerId) continue
    let p = map.get(ev.playerId)
    if (!p) {
      p = createPerf(ev.playerId, ev.playerName ?? ev.playerId, 'home', 70)
      map.set(ev.playerId, p)
    }
    // goal/shot/xg สะสมระหว่างซิมแล้ว — ที่นี่เติมวินัย/เซฟ/จังหวะสำคัญเท่านั้น
    if (ev.kind === 'save') {
      p.saves += 1
      p.keyActions += 1
    } else if (ev.kind === 'foul') {
      p.fouls += 1
    } else if (ev.kind === 'card') {
      if (ev.cardColor === 'red') p.reds += 1
      else p.yellows += 1
    } else if (ev.kind === 'chance') {
      p.keyActions += 0.35
    } else if (ev.kind === 'commentary') {
      p.keyActions += 0.15
    }
  }
  return map
}

export function finalizePlayerRatings(
  acc: Map<string, PlayerPerfAccum>,
  halfMinutes = 90,
): { ratings: MatchPlayerRating[]; momPlayerId: string | null; momName: string | null } {
  const ratings: MatchPlayerRating[] = []
  for (const p of acc.values()) {
    const mins = Math.max(15, p.minutes || halfMinutes * 0.7)
    let r =
      6.2 +
      (p.overall - 70) * 0.02 +
      p.goals * 1.1 +
      p.shotsOnTarget * 0.25 +
      p.shots * 0.08 +
      p.saves * 0.35 +
      p.keyActions * 0.06 -
      p.fouls * 0.12 -
      p.yellows * 0.35 -
      p.reds * 1.8
    r = clamp(r, 4.0, 9.8)
    ratings.push({
      playerId: p.playerId,
      name: p.name,
      team: p.team,
      rating: Math.round(r * 10) / 10,
      goals: p.goals,
      shots: p.shots,
      xg: Math.round(p.xgContrib * 100) / 100,
      minutes: Math.round(mins),
    })
  }
  ratings.sort((a, b) => b.rating - a.rating)
  const mom = ratings[0]
  return {
    ratings,
    momPlayerId: mom?.playerId ?? null,
    momName: mom?.name ?? null,
  }
}
