/**
 * In-match cards + simple VAR (goal / red reviews).
 * Season bans are applied later via discipline.applyDisciplineFromEvents.
 */
import type { MatchEvent, Referee } from '../types'

export type CardColor = 'yellow' | 'red'

export interface CardIssue {
  color: CardColor
  /** true when this red came from a second yellow */
  secondYellow: boolean
  text: string
}

/** Strict refs book more; aggression bumps booking chance; homeBias เอียงใบใส่ทีมเยือน */
export function bookingChance(
  ref: Referee,
  aggressionMod: number,
  nearOwnBox: boolean,
  foulerIsAway = false,
): { yellow: number; red: number } {
  const strict = Math.max(1, Math.min(20, ref.strictness)) / 20
  const bias = Math.max(1, Math.min(20, ref.homeBias ?? 10)) / 20
  const lean = foulerIsAway ? 1 + (bias - 0.5) * 0.4 : 1 - (bias - 0.5) * 0.15
  const yellow =
    clamp(0.18 + 0.28 * strict, 0.12, 0.55) * clamp(aggressionMod, 0.7, 1.4) * lean
  let red = clamp(0.02 + 0.08 * strict, 0.015, 0.12) * clamp(aggressionMod, 0.8, 1.5) * lean
  if (nearOwnBox) red *= 2.2 // DOGSO / last-man risk
  return { yellow, red }
}

export function decideCard(
  rng: () => number,
  ref: Referee,
  aggressionMod: number,
  nearOwnBox: boolean,
  alreadyYellow: boolean,
  foulerIsAway = false,
): CardIssue | null {
  const { yellow, red } = bookingChance(ref, aggressionMod, nearOwnBox, foulerIsAway)
  if (rng() < red) {
    return {
      color: 'red',
      secondYellow: false,
      text: nearOwnBox ? 'ใบแดง! (โอกาสทำประตูชัด / ตัวสุดท้าย)' : 'ใบแดงตรง!',
    }
  }
  if (rng() < yellow) {
    if (alreadyYellow) {
      return {
        color: 'red',
        secondYellow: true,
        text: 'ใบเหลืองที่สอง → ใบแดง!',
      }
    }
    return { color: 'yellow', secondYellow: false, text: 'ใบเหลือง' }
  }
  return null
}

/** Competitions / refs that get VAR. */
export function matchHasVar(
  competition: string,
  ref: Referee,
): boolean {
  if (competition === 'ucl' || competition === 'uel' || competition === 'uecl') return true
  if (competition === 'cup') return ref.reputation >= 10
  return ref.reputation >= 8
}

export type VarGoalOutcome = 'none' | 'check_ok' | 'overturn'

/** Soft VAR after a goal — mostly confirms, sometimes offsides cancel. */
export function varCheckGoal(rng: () => number, hasVar: boolean): VarGoalOutcome {
  if (!hasVar) return 'none'
  if (rng() > 0.11) return 'none'
  return rng() < 0.32 ? 'overturn' : 'check_ok'
}

export type VarRedOutcome = 'none' | 'confirm' | 'downgrade' | 'upgrade'

/** Review borderline reds / potential upgrades from yellow. */
export function varCheckRed(
  rng: () => number,
  hasVar: boolean,
  wasStraightRed: boolean,
): VarRedOutcome {
  if (!hasVar) return 'none'
  if (wasStraightRed) {
    if (rng() > 0.18) return 'none'
    return rng() < 0.38 ? 'downgrade' : 'confirm'
  }
  // yellow that VAR might upgrade
  if (rng() > 0.06) return 'none'
  return rng() < 0.45 ? 'upgrade' : 'none'
}

export function varEventText(outcome: VarGoalOutcome | VarRedOutcome, subject: string): string {
  switch (outcome) {
    case 'check_ok':
      return `VAR ยืนยันประตูของ ${subject}`
    case 'overturn':
      return `VAR ยกเลิกประตู! ${subject} ล้ำหน้า`
    case 'confirm':
      return `VAR ยืนยันใบแดงของ ${subject}`
    case 'downgrade':
      return `VAR ลดโทษ → ${subject} ได้แค่ใบเหลือง`
    case 'upgrade':
      return `VAR อัปเกรด → ${subject} ได้ใบแดง`
    default:
      return `VAR ตรวจสอบ ${subject}`
  }
}

export type PushFn = (
  minute: number,
  kind: MatchEvent['kind'],
  text: string,
  spot: { x: number; y: number },
  extra?: Partial<MatchEvent>,
) => void

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
