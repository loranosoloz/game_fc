import type {
  FormationId,
  MatchSpatialFrame,
  PitchSpot,
  Player,
  Tactics,
} from './types'
import { FORMATION_ANCHORS } from './match/formationAnchors'

export interface PitchPlayer {
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  base: PitchSpot
}

/** Convert formationAnchors (x width, y depth) → pitch lanes (x attack, y width) */
function lanesFromAnchors(
  anchors: Array<{ x: number; y: number }>,
): Array<{ x: number; y: number }> {
  return anchors.map((p) => ({
    x: p.y / 100,
    y: p.x / 100,
  }))
}

const FORMATION_LANES: Record<FormationId, Array<{ x: number; y: number }>> = Object.fromEntries(
  (Object.keys(FORMATION_ANCHORS) as FormationId[]).map((id) => [
    id,
    lanesFromAnchors(FORMATION_ANCHORS[id]),
  ]),
) as Record<FormationId, Array<{ x: number; y: number }>>

function laneToHomeSpot(lane: { x: number; y: number }): PitchSpot {
  return {
    x: 4 + lane.x * 46,
    y: 8 + lane.y * 84,
  }
}

function laneToAwaySpot(lane: { x: number; y: number }): PitchSpot {
  return {
    x: 96 - lane.x * 46,
    y: 8 + lane.y * 84,
  }
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

export function buildPitchPlayers(
  tactics: Tactics,
  roster: Player[],
  side: 'home' | 'away',
): PitchPlayer[] {
  const lanes = FORMATION_LANES[tactics.formation] ?? FORMATION_LANES['4-3-3']
  const toSpot = side === 'home' ? laneToHomeSpot : laneToAwaySpot

  return tactics.startingXi.slice(0, lanes.length).map((id, i) => {
    const player = roster.find((p) => p.id === id)
    const name = player?.name ?? `Player ${i + 1}`
    return {
      id,
      name,
      label: initials(name),
      side,
      base: toSpot(lanes[i]!),
    }
  })
}

/** XI ยืนฝั่งตัวเองก่อนเตะเริ่ม (เหย้าซ้าย / เยือนขวา — ไม่ใช้เฟรมโจมตีจากซิม) */
export function buildKickoffMarkers(
  homeXi: string[],
  awayXi: string[],
  roster: Player[],
  formation: FormationId = '4-3-3',
): Array<{
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  spot: PitchSpot
  active: boolean
}> {
  const tacticsBase = {
    formation,
    formationOop: formation,
    familiarity: 70,
    instructions: {
      mentality: 'balanced' as const,
      pressing: 'medium' as const,
      tempo: 'normal' as const,
      width: 'normal' as const,
      style: 'possession' as const,
    },
    bench: [] as string[],
    setPieces: { corners: 'mixed' as const, freeKicks: 'mixed' as const },
  }
  const home = buildPitchPlayers({ ...tacticsBase, startingXi: homeXi }, roster, 'home')
  const away = buildPitchPlayers({ ...tacticsBase, startingXi: awayXi }, roster, 'away')
  return [...home, ...away].map((p) => ({
    id: p.id,
    name: p.name,
    label: p.label,
    side: p.side,
    spot: p.base,
    active: false,
  }))
}

export const KICKOFF_BALL_SPOT: PitchSpot = { x: 50, y: 50 }

/** Convert formationAnchors → full-pitch spots (โจมตีขึ้นบน) สำหรับรางวัล XI */
export function buildAwardsPitchPlayers(
  formation: FormationId,
  xi: Array<{ playerId: string; name: string; isHumanClub?: boolean }>,
): Array<PitchPlayer & { highlight: boolean }> {
  const anchors = FORMATION_ANCHORS[formation] ?? FORMATION_ANCHORS['4-3-3']
  return xi.slice(0, anchors.length).map((slot, i) => {
    const a = anchors[i]!
    const name = slot.name
    return {
      id: slot.playerId,
      name,
      label: initials(name),
      side: 'home' as const,
      base: {
        x: 8 + (a.x / 100) * 84,
        y: 10 + ((100 - a.y) / 100) * 80,
      },
      highlight: !!slot.isHumanClub,
    }
  })
}
export function withActionOffset(
  players: PitchPlayer[],
  activeName: string | undefined,
  ball: PitchSpot,
): Array<PitchPlayer & { spot: PitchSpot; active: boolean }> {
  return players.map((p) => {
    const active = Boolean(activeName && p.name === activeName)
    if (!active) return { ...p, spot: p.base, active: false }
    return {
      ...p,
      active: true,
      spot: {
        x: p.base.x * 0.55 + ball.x * 0.45,
        y: p.base.y * 0.55 + ball.y * 0.45,
      },
    }
  })
}

/**
 * แปลงพิกัดซิม (x = กว้าง, y = ลึก เหย้าบุก +y)
 * → จอ LiveMatch (เหย้าซ้าย→ขวา, ลึกเต็มสนาม)
 */
export function simToLivePitchSpot(sim: { x: number; y: number }): PitchSpot {
  return {
    x: 4 + (sim.y / 100) * 92,
    y: 8 + (sim.x / 100) * 84,
  }
}

/** kickoff เท่านั้น — half-pitch (laneToHomeSpot / laneToAwaySpot) */

/**
 * พิกัดซิมเป็นพิกัดโลกร่วม (เหย้าบุก +y · เยือนพลิกจากประตูตัวเองแล้ว)
 * → จอ LiveMatch (เหย้าซ้าย→ขวา)
 */
function displaySimPos(p: { x: number; y: number; side: 'home' | 'away' }) {
  return { x: p.x, y: p.y }
}

/** สร้าง markers จาก spatial frame ของซิม — ตัวขยับตามจังหวะจริง */
export function markersFromSpatialFrame(
  frame: MatchSpatialFrame,
  roster: Player[],
): Array<{
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  spot: PitchSpot
  active: boolean
}> {
  return frame.players.map((p) => {
    const name = roster.find((r) => r.id === p.id)?.name ?? p.id
    return {
      id: p.id,
      name,
      label: initials(name),
      side: p.side,
      spot: simToLivePitchSpot(displaySimPos(p)),
      active: frame.carrierId === p.id,
    }
  })
}

export function ballSpotFromSpatial(frame: MatchSpatialFrame): PitchSpot {
  return simToLivePitchSpot(frame.ball)
}

/** สร้าง markers สำหรับ Match Demo — full-pitch ตามซิม (บุกข้ามกลางสนามได้) */
export function markersFromSpatialFrameDemo(
  frame: MatchSpatialFrame,
  roster: Player[],
): Array<{
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  spot: PitchSpot
  active: boolean
}> {
  const ball = simToLivePitchSpot(frame.ball)
  return frame.players.map((p) => {
    const name = roster.find((r) => r.id === p.id)?.name ?? p.id
    const active = frame.carrierId === p.id
    return {
      id: p.id,
      name,
      label: initials(name),
      side: p.side,
      spot: active ? ball : simToLivePitchSpot(displaySimPos(p)),
      active,
    }
  })
}

/** ลูกบอล demo */
export function ballSpotFromSpatialDemo(frame: MatchSpatialFrame): PitchSpot {
  return simToLivePitchSpot(frame.ball)
}

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/** smoothstep — เลื่อนเข้า/ออกนุ่ม */
function easeInOut(t: number) {
  const x = Math.max(0, Math.min(1, t))
  return x * x * (3 - 2 * x)
}

/** ผสมสองเฟรมซิม — เล่นต่อเนื่องระหว่างไฮไลต์ */
export function lerpSpatialFrames(
  from: MatchSpatialFrame,
  to: MatchSpatialFrame,
  t: number,
): MatchSpatialFrame {
  const u = easeInOut(t)
  const byId = new Map(to.players.map((p) => [p.id, p]))
  return {
    ball: {
      x: lerp(from.ball.x, to.ball.x, u),
      y: lerp(from.ball.y, to.ball.y, u),
    },
    possessing: u < 0.55 ? from.possessing : to.possessing,
    carrierId: u < 0.55 ? from.carrierId : to.carrierId,
    players: from.players.map((p) => {
      const q = byId.get(p.id)
      if (!q) return p
      return {
        id: p.id,
        side: p.side,
        x: lerp(p.x, q.x, u),
        y: lerp(p.y, q.y, u),
      }
    }),
  }
}
