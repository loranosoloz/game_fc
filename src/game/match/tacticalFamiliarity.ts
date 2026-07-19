/**
 * Tactical Adaptability & Dynamic Familiarity
 * familiarity บน Tactics เป็น 0–100 → ใช้เป็นตัวคูณความผิดพลาดในแมตช์
 */

/** 0–1 ความคุ้นเคย (1 = ชำนาญ) */
export function familiarityFactor(familiarity: number | undefined | null): number {
  const f = Math.max(0, Math.min(100, familiarity ?? 55))
  return f / 100
}

/**
 * ค่าสุ่มความผิดพลาดจาก familiarity ต่ำ
 * 0 ที่ 100% familiarity → สูงสุด ~0.45 ที่ familiarity 0
 */
export function familiarityErrorRate(familiarity: number | undefined | null): number {
  const know = familiarityFactor(familiarity)
  return (1 - know) * 0.45
}

/** คูณ errScale ของการวิ่งหาตำแหน่ง */
export function familiarityPositionNoise(familiarity: number | undefined | null): number {
  return 1 + familiarityErrorRate(familiarity) * 2.2
}

/** เพิ่มความยากของการจ่าย/ยิงเมื่อคุ้นแผนต่ำ */
export function familiarityActionPenalty(familiarity: number | undefined | null): number {
  return 1 + familiarityErrorRate(familiarity) * 0.55
}

/** โอกาสจ่ายหลุด/วิ่งทับตำแหน่ง (ใช้สุ่ม commentary) */
export function familiarityBlunderChance(familiarity: number | undefined | null): number {
  return familiarityErrorRate(familiarity) * 0.35
}
