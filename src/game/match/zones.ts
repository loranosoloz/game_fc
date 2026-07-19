/** 18 โซนสนาม — นับคนเพื่อ overload / underload (ไม่ใช่ตารางชนะฟอเมชั่น) */

export type ZoneId =
  | 'box_own'
  | 'box_opp'
  | 'zone14'
  | 'am'
  | 'mid_deep'
  | 'mid_central'
  | 'flank_l'
  | 'flank_r'
  | 'halfspace_l'
  | 'halfspace_r'
  | 'front'
  | 'between_mf_cb'
  | 'behind_winger'
  | 'wing_l_high'
  | 'wing_r_high'
  | 'cb_line'
  | 'gk_zone'
  | 'rest'

export interface ZoneDef {
  id: ZoneId
  x0: number
  x1: number
  y0: number
  y1: number
}

/** พิกัด relative 0–100 จากมุมมองทีมที่กำลังโจมตีไปทาง y+ */
export const ZONES: ZoneDef[] = [
  { id: 'gk_zone', x0: 30, x1: 70, y0: 0, y1: 12 },
  { id: 'box_own', x0: 25, x1: 75, y0: 0, y1: 18 },
  { id: 'cb_line', x0: 20, x1: 80, y0: 14, y1: 28 },
  { id: 'between_mf_cb', x0: 25, x1: 75, y0: 28, y1: 40 },
  { id: 'mid_deep', x0: 30, x1: 70, y0: 36, y1: 48 },
  { id: 'mid_central', x0: 30, x1: 70, y0: 44, y1: 58 },
  { id: 'zone14', x0: 35, x1: 65, y0: 62, y1: 78 },
  { id: 'am', x0: 30, x1: 70, y0: 58, y1: 72 },
  { id: 'front', x0: 25, x1: 75, y0: 74, y1: 95 },
  { id: 'box_opp', x0: 25, x1: 75, y0: 82, y1: 100 },
  { id: 'flank_l', x0: 0, x1: 22, y0: 20, y1: 80 },
  { id: 'flank_r', x0: 78, x1: 100, y0: 20, y1: 80 },
  { id: 'halfspace_l', x0: 18, x1: 35, y0: 40, y1: 75 },
  { id: 'halfspace_r', x0: 65, x1: 82, y0: 40, y1: 75 },
  { id: 'wing_l_high', x0: 0, x1: 25, y0: 65, y1: 95 },
  { id: 'wing_r_high', x0: 75, x1: 100, y0: 65, y1: 95 },
  { id: 'behind_winger', x0: 0, x1: 100, y0: 45, y1: 62 },
  { id: 'rest', x0: 0, x1: 100, y0: 0, y1: 100 },
]

export function pointInZone(x: number, y: number, z: ZoneDef): boolean {
  return x >= z.x0 && x <= z.x1 && y >= z.y0 && y <= z.y1
}

export function primaryZone(x: number, y: number): ZoneId {
  for (const z of ZONES) {
    if (z.id === 'rest') continue
    if (pointInZone(x, y, z)) return z.id
  }
  return 'rest'
}

export function countInZone(
  agents: { x: number; y: number; team: 'home' | 'away' }[],
  zoneId: ZoneId,
  team: 'home' | 'away',
  /** ถ้า away โจมตีฝั่งกลับ ให้พลิก y */
  flipY: boolean,
): number {
  const z = ZONES.find((q) => q.id === zoneId)!
  return agents.filter((a) => {
    if (a.team !== team) return false
    const y = flipY ? 100 - a.y : a.y
    return pointInZone(a.x, y, z)
  }).length
}

/** Numerical advantage ในโซน → ลด P_opp ของฝั่งที่ได้เปรียบ */
export function overloadPressureFactor(
  ownCount: number,
  oppCount: number,
): number {
  if (ownCount > oppCount + 0.5) return 0.7 // −30%
  if (ownCount < oppCount - 0.5) return 1.25
  return 1
}
