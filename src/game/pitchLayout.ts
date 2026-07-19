import type { FormationId, PitchSpot, Player, Tactics } from './types'

export interface PitchPlayer {
  id: string
  name: string
  label: string
  side: 'home' | 'away'
  base: PitchSpot
}

/** Relative lane coords: x along attack direction (0=own goal, 1=opp half), y 0..1 top→bottom. */
const FORMATION_LANES: Record<FormationId, Array<{ x: number; y: number }>> = {
  '4-3-3': [
    { x: 0.06, y: 0.5 }, // GK
    { x: 0.2, y: 0.16 },
    { x: 0.2, y: 0.36 },
    { x: 0.2, y: 0.64 },
    { x: 0.2, y: 0.84 },
    { x: 0.4, y: 0.28 },
    { x: 0.38, y: 0.5 },
    { x: 0.4, y: 0.72 },
    { x: 0.62, y: 0.2 },
    { x: 0.66, y: 0.5 },
    { x: 0.62, y: 0.8 },
  ],
  '4-4-2': [
    { x: 0.06, y: 0.5 },
    { x: 0.2, y: 0.16 },
    { x: 0.2, y: 0.36 },
    { x: 0.2, y: 0.64 },
    { x: 0.2, y: 0.84 },
    { x: 0.42, y: 0.16 },
    { x: 0.4, y: 0.38 },
    { x: 0.4, y: 0.62 },
    { x: 0.42, y: 0.84 },
    { x: 0.64, y: 0.38 },
    { x: 0.64, y: 0.62 },
  ],
  '4-2-3-1': [
    { x: 0.06, y: 0.5 },
    { x: 0.2, y: 0.16 },
    { x: 0.2, y: 0.36 },
    { x: 0.2, y: 0.64 },
    { x: 0.2, y: 0.84 },
    { x: 0.36, y: 0.38 },
    { x: 0.36, y: 0.62 },
    { x: 0.52, y: 0.2 },
    { x: 0.52, y: 0.5 },
    { x: 0.52, y: 0.8 },
    { x: 0.68, y: 0.5 },
  ],
}

function laneToHomeSpot(lane: { x: number; y: number }): PitchSpot {
  // Home attacks to the right
  return {
    x: 4 + lane.x * 46,
    y: 8 + lane.y * 84,
  }
}

function laneToAwaySpot(lane: { x: number; y: number }): PitchSpot {
  // Away attacks to the left (mirror)
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
  const lanes = FORMATION_LANES[tactics.formation]
  const toSpot = side === 'home' ? laneToHomeSpot : laneToAwaySpot

  return tactics.startingXi.slice(0, lanes.length).map((id, i) => {
    const player = roster.find((p) => p.id === id)
    const name = player?.name ?? `Player ${i + 1}`
    return {
      id,
      name,
      label: initials(name),
      side,
      base: toSpot(lanes[i]),
    }
  })
}

/** Nudge the active player toward the ball so the action reads on the pitch. */
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
