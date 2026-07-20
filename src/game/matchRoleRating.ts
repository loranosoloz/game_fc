/**
 * เรตติ้งตามหน้าที่บทบาท + อัปเดตฟอร์ม/คุ้นเคยหลังแมตช์
 */
import type { MatchPlayerRating, MatchResult, Player, RoleCode } from '../types'
import type { TacticalRoleId } from '../tacticalRoles'
import { roleEffectsFor } from './match/matchRoleEffects'
import {
  bumpRoleFamiliarity,
  roleFamiliarityOf,
  roleFamiliarityRatingBonus,
} from './roleFamiliarity'
import type { PlayerPerfAccum } from './match/playerPerformance'
import { applyFameAfterRating } from './playerFame'

export interface RolePerfContext {
  tacticalRoleId?: string | null
  roleCode?: RoleCode
  passesCompleted?: number
  dribblesOk?: number
  /** fit รวมบทบาท+คุ้นเคยตอนลงแข่ง */
  roleFit?: number
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** คะแนนหน้าที่ตามบทบาท — ไม่ใช่แค่ประตู */
export function roleDutyScore(
  p: PlayerPerfAccum,
  ctx: RolePerfContext,
): { duty: number; noteTh: string } {
  const roleId = ctx.tacticalRoleId
  const e = roleEffectsFor(ctx.roleCode ?? 'CM', roleId)
  const passes = p.passesCompleted ?? ctx.passesCompleted ?? 0
  const dribbles = p.dribblesOk ?? ctx.dribblesOk ?? 0
  let duty = 0
  let noteTh = 'ทำหน้าที่ครบ'

  // เพลย์เมกเกอร์ / DLP — เน้นพาส
  if (e.pass >= 1.2) {
    duty += passes * 0.12 + p.keyActions * 0.08
    noteTh = passes >= 4 ? 'กระจายบอลตามบทบาท' : 'สร้างเกมน้อยไปหน่อย'
  }
  // กองหน้าล่า — เน้นยิง/ประตู
  if (e.shoot >= 1.2) {
    duty += p.goals * 1.2 + p.shotsOnTarget * 0.35 + p.shots * 0.1
    noteTh = p.goals > 0 || p.shotsOnTarget >= 2 ? 'จบสกอร์ตามหน้าที่' : 'โอกาสน้อย / จบไม่คม'
  }
  // ปีก / ดริบ
  if (e.dribble >= 1.2) {
    duty += dribbles * 0.28 + passes * 0.05
    noteTh = dribbles >= 2 ? 'พาลูกทะลุตามบทบาท' : 'พาลูกไม่ค่อยได้จังหวะ'
  }
  // ผู้รักษาประตู
  if ((ctx.roleCode === 'GK' || roleId === 'shot_stopper' || roleId === 'sweeper_keeper') && p.saves > 0) {
    duty += p.saves * 0.45
    noteTh = p.saves >= 3 ? 'คุมเขตดี' : 'เซฟได้บ้าง'
  }
  // แบ็ก / วิงแบ็ก — รับ+ส่ง
  if (
    roleId === 'wing_back' ||
    roleId === 'full_back' ||
    roleId === 'inverted_fb' ||
    ctx.roleCode === 'LB' ||
    ctx.roleCode === 'RB'
  ) {
    duty += passes * 0.08 + dribbles * 0.12 - p.fouls * 0.15
    noteTh = 'ซ้อน/คุมข้าง'
  }
  // สมอ / destroyer
  if (roleId === 'anchor' || roleId === 'destroyer' || roleId === 'no_nonsense_cb') {
    duty += p.keyActions * 0.1 - p.fouls * 0.08
    noteTh = 'ทำลายเกม / คัฟเวอร์'
  }

  if (duty < 0.15 && p.goals === 0 && passes < 2) {
    noteTh = 'บทบาทไม่เด่นในนัดนี้'
  }

  return { duty: clamp(duty, 0, 4), noteTh }
}

export function ratingFromRoleDuty(
  p: PlayerPerfAccum,
  ctx: RolePerfContext,
  player?: Player | null,
): { rating: number; dutyNote: string; dutyScore: number } {
  const { duty, noteTh } = roleDutyScore(p, ctx)
  const mins = Math.max(15, p.minutes || 60)
  let r =
    6.0 +
    (p.overall - 70) * 0.015 +
    p.goals * 0.85 +
    p.shotsOnTarget * 0.18 +
    p.shots * 0.05 +
    p.saves * 0.32 +
    p.keyActions * 0.05 +
    duty * 0.55 -
    p.fouls * 0.12 -
    p.yellows * 0.35 -
    p.reds * 1.8

  // fit / ความคุ้นเคย
  if (ctx.roleFit != null) r += (ctx.roleFit - 0.85) * 0.8
  if (player) r += roleFamiliarityRatingBonus(player, ctx.tacticalRoleId)

  r = clamp(r, 4.0, 9.8)
  return {
    rating: Math.round(r * 10) / 10,
    dutyNote: noteTh,
    dutyScore: Math.round(duty * 100) / 100,
  }
}

export function finalizeRoleAwareRatings(
  acc: Map<string, PlayerPerfAccum>,
  ctxById: Map<string, RolePerfContext>,
  players: Player[],
  halfMinutes = 90,
): { ratings: MatchPlayerRating[]; momPlayerId: string | null; momName: string | null } {
  const byPlayer = new Map(players.map((p) => [p.id, p]))
  const ratings: MatchPlayerRating[] = []
  for (const p of acc.values()) {
    const mins = Math.max(15, p.minutes || halfMinutes * 0.7)
    const ctx = ctxById.get(p.playerId) ?? {
      tacticalRoleId: p.tacticalRoleId,
      roleCode: undefined,
      passesCompleted: p.passesCompleted,
      dribblesOk: p.dribblesOk,
      roleFit: p.roleFit,
    }
    const pl = byPlayer.get(p.playerId)
    const scored = ratingFromRoleDuty(p, ctx, pl)
    ratings.push({
      playerId: p.playerId,
      name: p.name,
      team: p.team,
      rating: scored.rating,
      goals: p.goals,
      shots: p.shots,
      xg: Math.round(p.xgContrib * 100) / 100,
      minutes: Math.round(mins),
      tacticalRoleId: (ctx.tacticalRoleId as TacticalRoleId | undefined) ?? undefined,
      dutyNote: scored.dutyNote,
      dutyScore: scored.dutyScore,
      roleFamiliarity: pl ? roleFamiliarityOf(pl, ctx.tacticalRoleId) : undefined,
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

/** หลังแมตช์ — ฟอร์ม + ความคุ้นเคยบทบาท + เฟม */
export function applyPostMatchRoleProgress(
  players: Player[],
  result: MatchResult,
  xiByClub: Record<string, { startingXi: string[]; slotRoles?: (string | null | undefined)[] }>,
): Player[] {
  const ratings = result.playerRatings ?? []
  if (!ratings.length) return players
  const ratingById = new Map(ratings.map((r) => [r.playerId, r]))
  const roleByPlayer = new Map<string, string>()
  for (const tac of Object.values(xiByClub)) {
    tac.startingXi.forEach((id, i) => {
      const role = tac.slotRoles?.[i]
      if (id && role) roleByPlayer.set(id, role)
    })
  }

  return players.map((p) => {
    const pr = ratingById.get(p.id)
    if (!pr || pr.minutes < 15) return p
    const roleId = pr.tacticalRoleId ?? roleByPlayer.get(p.id)
    let next = bumpRoleFamiliarity(p, roleId, pr.minutes, pr.rating)
    // ฟอร์มตามเรตติ้งหน้าที่
    let form = next.form
    if (pr.rating >= 8) form = Math.min(20, form + 2)
    else if (pr.rating >= 7.2) form = Math.min(20, form + 1)
    else if (pr.rating <= 5.5) form = Math.max(1, form - 2)
    else if (pr.rating <= 6.2) form = Math.max(1, form - 1)
    next = { ...next, form, minutesPlayed: (next.minutesPlayed ?? 0) + pr.minutes }
    next = applyFameAfterRating(next, pr.rating, pr.minutes)
    return next
  })
}
