/** Layer 1: Time-to-Intercept + Pitch Control (sigmoid) */

export function reactionTime(decision: number, positioning: number, composure: number, focusMod: number): number {
  // attrs 1–99 → reaction 0.05–0.55s
  const avg = (decision + positioning + composure) / 3
  const base = 0.55 - (avg / 99) * 0.5
  return Math.max(0.05, base / Math.max(0.7, focusMod))
}

export function vmax(pace: number, condition: number, stamina: number, injured: boolean): number {
  if (injured) return 1.5
  const p = 4 + (pace / 99) * 7 // ~4–11 m/s scaled for relative grid
  return p * (condition / 100) * (0.85 + (stamina / 99) * 0.15)
}

export function timeToIntercept(
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  treaction: number,
  vmaxMs: number,
): number {
  const dist = Math.hypot(toX - fromX, toY - fromY) * 1.05 // grid → approx meters scale
  return treaction + dist / Math.max(0.5, vmaxMs)
}

/** P_teamA = 1 / (1 + e^{-k (T_Bmin - T_Amin)}) */
export function pitchControlProb(tOwnMin: number, tOppMin: number, k = 2.2): number {
  return 1 / (1 + Math.exp(-k * (tOppMin - tOwnMin)))
}

export function minTti(
  agents: {
    x: number
    y: number
    treaction: number
    vmax: number
  }[],
  tx: number,
  ty: number,
): number {
  let best = Infinity
  for (const a of agents) {
    const t = timeToIntercept(a.x, a.y, tx, ty, a.treaction, a.vmax)
    if (t < best) best = t
  }
  return best
}
