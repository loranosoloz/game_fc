/**
 * Zone of Control & Pass Blocking Lanes — บังไลน์ส่งบอล / ดักตัดโดยไม่ต้องปะทะตัว
 */
export interface PassBlockAgent {
  id: string
  name: string
  x: number
  y: number
  /** ใช้ positioning + tackling เป็น proxy ของ interceptions */
  positioning: number
  tackling: number
  decision: number
  /** low block / deep defending → ขยาย shadow */
  lowBlockBonus?: number
}

export interface PassBlockResult {
  blocked: boolean
  interceptorId?: string
  interceptorName?: string
  /** 0–1 ความหนาของกำแพงบนไลน์ */
  shadowStrength: number
  noteTh?: string
}

/** ระยะตั้งฉากจากจุดไปยังเส้น segment a→b (พิกัดสนาม 0–100) */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): { dist: number; t: number } {
  const abx = bx - ax
  const aby = by - ay
  const len2 = abx * abx + aby * aby
  if (len2 < 1e-6) return { dist: Math.hypot(px - ax, py - ay), t: 0 }
  let t = ((px - ax) * abx + (py - ay) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return { dist: Math.hypot(px - cx, py - cy), t }
}

/**
 * ตรวจว่ามีกองหลังยืนบังไลน์ส่งจาก from → to หรือไม่
 * รัศมี Shadow Zone กว้างขึ้นเมื่อ positioning/tackling สูง + low block
 */
export function resolvePassBlock(
  from: { x: number; y: number },
  to: { x: number; y: number },
  defenders: PassBlockAgent[],
  rng: () => number,
): PassBlockResult {
  const laneLen = Math.hypot(to.x - from.x, to.y - from.y)
  if (laneLen < 4 || defenders.length === 0) {
    return { blocked: false, shadowStrength: 0 }
  }

  let best: { agent: PassBlockAgent; strength: number; dist: number } | null = null

  for (const d of defenders) {
    const { dist, t } = distToSegment(d.x, d.y, from.x, from.y, to.x, to.y)
    // ต้องอยู่ระหว่างส่ง–รับ ไม่ใช่หลังตัวส่ง
    if (t < 0.12 || t > 0.92) continue
    const interceptSkill = (d.positioning + d.tackling + d.decision) / 3 / 99
    const baseRadius = 2.2 + interceptSkill * 5.5 + (d.lowBlockBonus ?? 0) * 2.2
    if (dist > baseRadius) continue
    // ยิ่งใกล้ไลน์ + สกิลสูง → กำแพงหนา
    const proximity = 1 - dist / baseRadius
    const strength = proximity * (0.35 + interceptSkill * 0.65) * (0.85 + (d.lowBlockBonus ?? 0) * 0.25)
    if (!best || strength > best.strength) best = { agent: d, strength, dist }
  }

  if (!best) return { blocked: false, shadowStrength: 0 }

  const blockP = Math.min(0.72, best.strength * 0.85)
  if (rng() < blockP) {
    return {
      blocked: true,
      interceptorId: best.agent.id,
      interceptorName: best.agent.name,
      shadowStrength: best.strength,
      noteTh: `${best.agent.name} บังไลน์ส่ง · ดักตัด!`,
    }
  }
  return {
    blocked: false,
    interceptorId: best.agent.id,
    interceptorName: best.agent.name,
    shadowStrength: best.strength,
  }
}
