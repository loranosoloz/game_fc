/**
 * ความคุ้นเคยบทบาทแท็กติก — เล่นบทเดิมบ่อย → ฟอร์ม/เรตติ้งดีขึ้น
 */
import type { Player } from '../types'
import type { TacticalRoleId } from '../tacticalRoles'
import { tacticalRoleShort } from '../tacticalRoles'

export type RoleFamiliarityMap = Partial<Record<TacticalRoleId, number>>

export function roleFamiliarityOf(
  player: Player,
  roleId: string | null | undefined,
): number {
  if (!roleId) return 35
  const map = player.tacticalRoleFamiliarity ?? {}
  const v = map[roleId as TacticalRoleId]
  if (typeof v === 'number') return Math.max(0, Math.min(100, v))
  // seed จากสไตล์ถนัด
  const styles = player.preferredTacticalRoles ?? []
  const hit = styles.find((s) => s.id === roleId)
  if (hit?.level === 3) return 62
  if (hit?.level === 2) return 48
  if (hit?.level === 1) return 36
  return 28
}

/** คูณ fit ในแมตช์จากความคุ้นเคย (0.88–1.12) */
export function roleFamiliarityFitMul(player: Player, roleId?: string | null): number {
  const f = roleFamiliarityOf(player, roleId)
  return 0.88 + (f / 100) * 0.24
}

/** คูณเรตติ้งหลังแมตช์เล็กน้อย */
export function roleFamiliarityRatingBonus(player: Player, roleId?: string | null): number {
  const f = roleFamiliarityOf(player, roleId)
  if (f >= 75) return 0.25
  if (f >= 55) return 0.12
  if (f < 25) return -0.15
  return 0
}

export function bumpRoleFamiliarity(
  player: Player,
  roleId: string | null | undefined,
  minutes: number,
  rating: number,
): Player {
  if (!roleId || minutes < 20) return player
  const id = roleId as TacticalRoleId
  const prev = roleFamiliarityOf(player, id)
  // นาที + เรตติ้งดี = ขึ้นเร็ว · เรตติ้งแย่ขึ้นช้า
  let gain = 1.2 + (minutes / 90) * 3.5
  if (rating >= 7.5) gain += 1.5
  else if (rating >= 7) gain += 0.8
  else if (rating < 5.8) gain *= 0.45
  const next = Math.min(100, Math.round((prev + gain) * 10) / 10)
  return {
    ...player,
    tacticalRoleFamiliarity: {
      ...(player.tacticalRoleFamiliarity ?? {}),
      [id]: next,
    },
  }
}

export function roleFamiliarityLabelTh(player: Player, roleId: string): string {
  const f = roleFamiliarityOf(player, roleId)
  const short = tacticalRoleShort(roleId as TacticalRoleId)
  if (f >= 75) return `${short} คุ้นมาก (${Math.round(f)})`
  if (f >= 50) return `${short} คุ้น (${Math.round(f)})`
  if (f >= 30) return `${short} กำลังเรียนรู้ (${Math.round(f)})`
  return `${short} ยังใหม่ (${Math.round(f)})`
}
