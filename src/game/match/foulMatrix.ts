/**
 * Tackle / Foul matrix — สำเร็จ · พลาด · ฟาวล์ · จุดโทษ · ใบ
 */
import type { Pressing, Referee } from '../types'
import { decideCard, type CardIssue } from './disciplineSim'

export type TackleOutcomeKind = 'clean_win' | 'mistackle' | 'foul'

export interface TackleContext {
  /** 0–99 */
  tackling: number
  /** 0–99 hidden dirtiness */
  dirtiness: number
  /** psych shout mod */
  aggressionMod: number
  pressing: Pressing
  /** attacker progress toward goal 0–100 */
  attackProgress: number
  /** |x-50| distance from centre — box is narrow */
  lateralFromCentre: number
  ref: Referee
  alreadyYellow: boolean
  /** fouler is away side → home bias เพิ่มโอกาสเป่า */
  foulerIsAway?: boolean
}

export interface TackleResolution {
  kind: TackleOutcomeKind
  penalty: boolean
  card: CardIssue | null
  noteTh: string
}

function pressingIntensity(p: Pressing): number {
  if (p === 'high') return 1.35
  if (p === 'low') return 0.7
  return 1
}

/** In opponent box (attacking end) for pen. */
export function isPenaltyArea(attackProgress: number, lateralFromCentre: number): boolean {
  return attackProgress >= 82 && lateralFromCentre <= 18
}

/**
 * Resolve a tackle attempt on a failed dribble / contested ball.
 * Aggression (dirtiness + psych) × tackling intensity (pressing) → foul branch.
 */
export function resolveTackle(rng: () => number, ctx: TackleContext): TackleResolution {
  const intensity = pressingIntensity(ctx.pressing)
  const aggression =
    clamp(ctx.aggressionMod, 0.6, 1.5) * (0.55 + ctx.dirtiness / 120)
  const tackleSkill = ctx.tackling / 99

  // Home bias: กรรมการเอียงเจ้าบ้าน → เป่าฟาวล์ฝั่งเยือนง่ายขึ้น
  const bias = Math.max(1, Math.min(20, ctx.ref.homeBias ?? 10)) / 20
  const homeLean = ctx.foulerIsAway ? 1 + (bias - 0.5) * 0.35 : 1 - (bias - 0.5) * 0.12

  // Clean win more likely with good tackling + calmer aggression
  const cleanP = clamp(0.28 + tackleSkill * 0.45 - (aggression - 1) * 0.12, 0.15, 0.72)
  // Foul branch rises with intensity × aggression × strictness × home lean
  const foulP = clamp(
    (0.12 * intensity * aggression * (1.05 - tackleSkill * 0.35) +
      (ctx.ref.strictness / 20) * 0.08) *
      homeLean,
    0.08,
    0.62,
  )

  const roll = rng()
  if (roll < cleanP) {
    return { kind: 'clean_win', penalty: false, card: null, noteTh: 'สกัดสะอาด' }
  }
  if (roll < cleanP + foulP) {
    const inBox = isPenaltyArea(ctx.attackProgress, ctx.lateralFromCentre)
    const nearOwnBox = ctx.attackProgress >= 78
    const card = decideCard(
      rng,
      ctx.ref,
      aggression,
      nearOwnBox || inBox,
      ctx.alreadyYellow,
      ctx.foulerIsAway,
    )
    // Pen: foul in box — always award if foul confirmed there
    const penalty = inBox
    return {
      kind: 'foul',
      penalty,
      card,
      noteTh: penalty ? 'ฟาวล์ในกรอบ → จุดโทษ!' : 'ฟาวล์',
    }
  }
  return { kind: 'mistackle', penalty: false, card: null, noteTh: 'แท็กเคิลพลาด บอลยังอยู่' }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}
