import type { PitchSpot, Player } from './types'

export const DEMO_INTRO_BLEND_MS = 1800

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

function lerpSpot(a: PitchSpot, b: PitchSpot, t: number): PitchSpot {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

function easeOutCubic(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return 1 - (1 - x) ** 3
}

/** 0→1 ช่วงหลัง Start — ผสม kickoff → gameplay */
export function introBlendT(wallMs: number): number {
  if (wallMs >= DEMO_INTRO_BLEND_MS) return 1
  return easeOutCubic(wallMs / DEMO_INTRO_BLEND_MS)
}

/** pace / positioning / workRate → ความเร็วไล่ตามเป้า (ต่อ ~16ms) */
export function demoMoveAlpha(
  player: Player | undefined,
  dtMs: number,
  active = false,
): number {
  const pace = player?.attrs.pace ?? 65
  const pos = player?.attrs.positioning ?? 65
  const wr = player?.attrs.workRate ?? 65
  const base = 0.08 + (pace / 99) * 0.14 + (wr / 99) * 0.08
  const precision = 0.82 + (pos / 99) * 0.18
  const mul = active ? 1.65 : 1
  return Math.min(0.52, base * precision * mul * (dtMs / 16.67))
}

export interface DemoPitchMarker {
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  spot: PitchSpot
  active: boolean
}

/** ผสมตำแหน่ง kickoff กับเป้าจากซิม */
export function blendDemoMarkers(
  kickoff: DemoPitchMarker[],
  targets: DemoPitchMarker[],
  t: number,
): DemoPitchMarker[] {
  const from = new Map(kickoff.map((m) => [m.id, m.spot]))
  return targets.map((m) => ({
    ...m,
    spot: lerpSpot(from.get(m.id) ?? m.spot, m.spot, t),
  }))
}

/** ทีมที่มีบอล — ดึง off-ball เข้าหาลูกเล็กน้อย (workRate / vision) */
export function applyDemoSupportRuns(
  markers: DemoPitchMarker[],
  ball: PitchSpot,
  possessing: 'home' | 'away' | undefined,
  roster: Player[],
): DemoPitchMarker[] {
  if (!possessing) return markers
  return markers.map((m) => {
    if (m.active || m.side !== possessing) return m
    const p = roster.find((r) => r.id === m.id)
    const wr = p?.attrs.workRate ?? 65
    const vision = p?.attrs.vision ?? 65
    const pull = 0.05 + (wr / 99) * 0.09 + (vision / 99) * 0.05
    return {
      ...m,
      spot: {
        x: m.spot.x * (1 - pull) + ball.x * pull,
        y: m.spot.y * (1 - pull) + ball.y * pull,
      },
    }
  })
}

/** spring ตามสแตต — นักเตะเร็ว/ฉลาดไล่เป้าได้ไวกว่า */
export function springDemoMarkers(
  current: Map<string, PitchSpot>,
  targets: DemoPitchMarker[],
  roster: Player[],
  dtMs: number,
): DemoPitchMarker[] {
  return targets.map((m) => {
    const prev = current.get(m.id) ?? m.spot
    const alpha = demoMoveAlpha(
      roster.find((p) => p.id === m.id),
      dtMs,
      m.active,
    )
    const next = lerpSpot(prev, m.spot, alpha)
    current.set(m.id, next)
    return { ...m, spot: next }
  })
}
