import type { FormationId, PitchSpot, Player, Tactics } from './types'
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
