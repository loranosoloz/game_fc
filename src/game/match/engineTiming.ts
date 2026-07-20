/**
 * Match timing model
 *
 * FM-style engines integrate physics every ~0.1s (~54,000 ticks / 90').
 * We do NOT run 54k decision loops (too heavy for batch AI matchdays).
 *
 * Instead:
 * - Engine spring ticks = continuous position integration (between highlights)
 * - Key Match Events (48–72) = Action / decision / text / 2D feed moments
 */
export type MatchFidelity = 'human' | 'ai'

/** Conceptual physics step (documentation / scaling only). */
export const CONCEPTUAL_TICK_DT_SEC = 0.1
export const MATCH_DURATION_MIN = 90
export const CONCEPTUAL_TICKS_PER_MATCH =
  (MATCH_DURATION_MIN * 60) / CONCEPTUAL_TICK_DT_SEC // 54_000

/** Key Match Events — highlights that resolve Pass/Dribble/Shoot/Tackle. */
export function keyEventCount(fidelity: MatchFidelity): number {
  // human: หนาแน่นพอให้ฟีด/พาสอ่านรู้เรื่อง · ai: เบาสำหรับซิมทั้งลีก
  return fidelity === 'human' ? 112 : 52
}

/**
 * Spring micro-ticks between each key event.
 * human: 112×10 ≈ 1120 position steps · ai: 52×7 ≈ 364
 */
export function springTicksPerKeyEvent(fidelity: MatchFidelity): number {
  return fidelity === 'human' ? 10 : 7
}

export function totalSpringTicks(fidelity: MatchFidelity): number {
  return keyEventCount(fidelity) * springTicksPerKeyEvent(fidelity)
}

export function timingNoteTh(fidelity: MatchFidelity): string {
  const keys = keyEventCount(fidelity)
  const springs = springTicksPerKeyEvent(fidelity)
  const half = Math.ceil(keys / 2)
  return (
    `ครึ่งละ 45'+ทดเวลา · ไฮไลท์ ~${half}/ครึ่ง × สปริง ${springs} tick` +
    ` (ไม่ใช่ ${CONCEPTUAL_TICKS_PER_MATCH.toLocaleString()} tick แบบ 0.1s ทั้งนัด)`
  )
}
