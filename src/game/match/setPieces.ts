/**
 * ลูกตั้งเตะในแมตช์ — มุม / ฟรีคิก (ใช้แผนจาก Tactics.setPieces)
 */
import type { AgentLike } from './setPiecesTypes'
import type { SetPiecePlan, TeamMatchStats } from '../types'
import { setPiecePlanTh } from './matchDrama'

export type { AgentLike } from './setPiecesTypes'

export interface SetPieceContext {
  plan: SetPiecePlan
  minute: number
  attackingUp: boolean
  rng: () => number
}

export interface SetPieceOutcome {
  kind: 'goal' | 'save' | 'clear' | 'miss' | 'short_keep'
  scorerId?: string
  scorerName?: string
  takerId?: string
  takerName?: string
  text: string
  spot: { x: number; y: number }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function pickTaker(attackers: AgentLike[], preferCrosser: boolean): AgentLike | null {
  const pool = attackers.filter((a) => a.role !== 'GK')
  if (pool.length === 0) return null
  const scored = [...pool].sort((a, b) => {
    const sa =
      (preferCrosser ? a.attrs.crossing : a.attrs.technique) * 0.5 +
      a.attrs.passing * 0.3 +
      a.overall * 0.2
    const sb =
      (preferCrosser ? b.attrs.crossing : b.attrs.technique) * 0.5 +
      b.attrs.passing * 0.3 +
      b.overall * 0.2
    return sb - sa
  })
  return scored[0] ?? null
}

function pickTarget(attackers: AgentLike[], plan: SetPiecePlan): AgentLike | null {
  const fw = attackers.filter((a) => a.role === 'ST' || a.role === 'CB' || a.role === 'CAM')
  const pool = fw.length ? fw : attackers.filter((a) => a.role !== 'GK')
  if (pool.length === 0) return null
  if (plan === 'near_post') {
    return [...pool].sort((a, b) => b.attrs.heading + b.attrs.jumping - (a.attrs.heading + a.attrs.jumping))[0]!
  }
  if (plan === 'far_post') {
    return [...pool].sort((a, b) => b.attrs.heading * 0.6 + b.attrs.strength * 0.4 - (a.attrs.heading * 0.6 + a.attrs.strength * 0.4))[0]!
  }
  return [...pool].sort((a, b) => b.overall - a.overall)[0]!
}

function planBias(plan: SetPiecePlan): number {
  if (plan === 'direct') return 0.08
  if (plan === 'near_post' || plan === 'far_post') return 0.06
  if (plan === 'short') return -0.04
  return 0.02
}

/** ลูกมุมหลังยิงหลุด / เซฟออกข้าง */
export function resolveCorner(
  attackers: AgentLike[],
  defenders: AgentLike[],
  atkStats: TeamMatchStats,
  ctx: SetPieceContext,
): SetPieceOutcome {
  atkStats.corners += 1
  const side = ctx.rng() < 0.5 ? 12 : 88
  const spot = { x: side, y: ctx.attackingUp ? 92 : 8 }
  const taker = pickTaker(attackers, true)
  const target = pickTarget(attackers, ctx.plan)
  if (!taker || !target) {
    return { kind: 'miss', text: 'ลูกมุมเสีย', spot }
  }

  if (ctx.plan === 'short') {
    if (ctx.rng() < 0.55) {
      return {
        kind: 'short_keep',
        takerId: taker.id,
        takerName: taker.name,
        text: `มุมสั้น · ${taker.name} เปิดสั้นครองต่อ (แผน「${setPiecePlanTh(ctx.plan)}」)`,
        spot,
      }
    }
  }

  const delivery =
    (taker.attrs.crossing + taker.attrs.technique) / 2 / 99 + planBias(ctx.plan)
  const aerial =
    (target.attrs.heading + target.attrs.jumping + target.attrs.strength) / 3 / 99
  const gk = defenders.find((d) => d.role === 'GK') ?? defenders[0]
  const gkStr = gk
    ? (gk.attrs.handling + gk.attrs.aerialReach + gk.attrs.reflexes) / 3 / 99
    : 0.55
  const chance = clamp(0.1 + delivery * 0.2 + aerial * 0.28 - gkStr * 0.32, 0.05, 0.28)

  if (ctx.rng() < chance) {
    return {
      kind: 'goal',
      scorerId: target.id,
      scorerName: target.name,
      takerId: taker.id,
      takerName: taker.name,
      text: `ลูกมุมเข้า! ${target.name} (เปิดโดย ${taker.name} · แผน「${setPiecePlanTh(ctx.plan)}」)`,
      spot: { x: 50, y: ctx.attackingUp ? 94 : 6 },
    }
  }
  if (ctx.rng() < 0.4) {
    return {
      kind: 'save',
      takerId: taker.id,
      takerName: taker.name,
      text: `เซฟลูกมุมจาก ${taker.name} (แผน「${setPiecePlanTh(ctx.plan)}」)`,
      spot: { x: 50, y: ctx.attackingUp ? 96 : 4 },
    }
  }
  return {
    kind: 'clear',
    takerId: taker.id,
    takerName: taker.name,
    text: `เคลียร์ลูกมุมของ ${taker.name} · แผน「${setPiecePlanTh(ctx.plan)}」ยังไม่คม`,
    spot,
  }
}

/** ฟรีคิกนอกกรอบ */
export function resolveFreeKick(
  attackers: AgentLike[],
  defenders: AgentLike[],
  ctx: SetPieceContext & { spot: { x: number; y: number } },
): SetPieceOutcome {
  const taker = pickTaker(attackers, ctx.plan !== 'direct')
  if (!taker) {
    return { kind: 'miss', text: 'ฟรีคิกเสีย', spot: ctx.spot }
  }

  if (ctx.plan === 'short' || (ctx.plan === 'mixed' && ctx.rng() < 0.35)) {
    return {
      kind: 'short_keep',
      takerId: taker.id,
      takerName: taker.name,
      text: `ฟรีคิกสั้น · ${taker.name} ส่งต่อ (แผน「${setPiecePlanTh(ctx.plan)}」)`,
      spot: ctx.spot,
    }
  }

  const shoot =
    ctx.plan === 'direct' ||
    ctx.plan === 'mixed' ||
    (ctx.plan !== 'near_post' && ctx.plan !== 'far_post' && ctx.rng() < 0.45)

  if (shoot) {
    const finish =
      (taker.attrs.technique + taker.attrs.finishing + taker.attrs.composure) / 3 / 99
    const gk = defenders.find((d) => d.role === 'GK') ?? defenders[0]
    const wall = 0.08
    const gkStr = gk ? (gk.attrs.reflexes + gk.attrs.handling) / 2 / 99 : 0.5
    const chance = clamp(0.1 + finish * 0.32 + planBias(ctx.plan) - gkStr * 0.22 - wall, 0.05, 0.38)
    if (ctx.rng() < chance) {
      return {
        kind: 'goal',
        scorerId: taker.id,
        scorerName: taker.name,
        takerId: taker.id,
        takerName: taker.name,
        text: `ฟรีคิกเข้า! ${taker.name} · แผน「${setPiecePlanTh(ctx.plan)}」`,
        spot: { x: 50, y: ctx.attackingUp ? 94 : 6 },
      }
    }
    if (ctx.rng() < 0.45) {
      return {
        kind: 'save',
        takerId: taker.id,
        takerName: taker.name,
        text: `เซฟฟรีคิก ${taker.name}`,
        spot: { x: 50, y: ctx.attackingUp ? 96 : 4 },
      }
    }
    return {
      kind: 'miss',
      takerId: taker.id,
      takerName: taker.name,
      text: `ฟรีคิกของ ${taker.name} หลุดกรอบ`,
      spot: ctx.spot,
    }
  }

  // Cross FK into box
  const target = pickTarget(attackers, ctx.plan)
  if (!target) {
    return { kind: 'miss', takerId: taker.id, takerName: taker.name, text: 'ฟรีคิกเสีย', spot: ctx.spot }
  }
  const delivery = (taker.attrs.crossing + taker.attrs.technique) / 2 / 99
  const aerial = (target.attrs.heading + target.attrs.jumping) / 2 / 99
  if (ctx.rng() < clamp(0.1 + delivery * 0.2 + aerial * 0.3, 0.05, 0.35)) {
    return {
      kind: 'goal',
      scorerId: target.id,
      scorerName: target.name,
      takerId: taker.id,
      takerName: taker.name,
      text: `ฟรีคิกเปิดเข้าหัว! ${target.name} (แผน「${setPiecePlanTh(ctx.plan)}」)`,
      spot: { x: 50, y: ctx.attackingUp ? 94 : 6 },
    }
  }
  return {
    kind: 'clear',
    takerId: taker.id,
    takerName: taker.name,
    text: `เคลียร์ฟรีคิกจาก ${taker.name} · แผน「${setPiecePlanTh(ctx.plan)}」`,
    spot: ctx.spot,
  }
}
