/**
 * จัดตำแหน่งนักเตะก่อนลูกตั้งเตะ — กองกรอบ / มุม / ทุ่ม
 */
import type { MatchSpatialFrame, MatchSpatialPlayer } from '../types'

export interface SpatialAgent {
  id: string
  team: 'home' | 'away'
  role: string
  x: number
  y: number
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function pickCornerTaker(attackers: SpatialAgent[]): SpatialAgent | null {
  const pool = attackers.filter((a) => a.role !== 'GK')
  if (!pool.length) return null
  const prefer = pool.find((a) =>
    ['LB', 'RB', 'LM', 'RM', 'LW', 'RW'].includes(a.role),
  )
  return prefer ?? pool[0]!
}

/** มุม — กองกรอบ + คนเตะยืนมุม */
export function buildCornerSetupSpatial(
  attackers: SpatialAgent[],
  defenders: SpatialAgent[],
  attackingTeam: 'home' | 'away',
  cornerSpot: { x: number; y: number },
  rng: () => number,
): { spatial: MatchSpatialFrame; takerId?: string } {
  const attackingUp = attackingTeam === 'home'
  const boxY = attackingUp ? 90 : 10
  const atkField = attackers.filter((a) => a.role !== 'GK')
  const defField = defenders.filter((a) => a.role !== 'GK')
  const players: MatchSpatialPlayer[] = []

  atkField.forEach((a, i) => {
    const n = Math.max(1, atkField.length - 1)
    const x = clamp(36 + (i / n) * 28 + (rng() - 0.5) * 8, 8, 92)
    const y = clamp(boxY + (rng() - 0.5) * 5, 2, 98)
    players.push({ id: a.id, side: a.team, x, y })
  })

  defField.forEach((d, i) => {
    const n = Math.max(1, defField.length - 1)
    const x = clamp(32 + (i / n) * 36 + (rng() - 0.5) * 6, 8, 92)
    const y = clamp(boxY + (attackingUp ? -3 : 3) + (rng() - 0.5) * 4, 2, 98)
    players.push({ id: d.id, side: d.team, x, y })
  })

  const gk = defenders.find((d) => d.role === 'GK')
  if (gk) {
    players.push({
      id: gk.id,
      side: gk.team,
      x: 50,
      y: attackingUp ? 97 : 3,
    })
  }

  const taker = pickCornerTaker(attackers)
  if (taker) {
    const idx = players.findIndex((p) => p.id === taker.id)
    const atCorner = {
      id: taker.id,
      side: taker.team,
      x: cornerSpot.x,
      y: cornerSpot.y,
    }
    if (idx >= 0) players[idx] = atCorner
    else players.push(atCorner)
  }

  return {
    takerId: taker?.id,
    spatial: {
      ball: { x: cornerSpot.x, y: cornerSpot.y },
      possessing: attackingTeam,
      carrierId: taker?.id,
      players,
    },
  }
}

/** ลูกทุ่ม — กองแนว touchline แล้วเตรียมทุ่มเข้า */
export function buildThrowInSetupSpatial(
  attackers: SpatialAgent[],
  defenders: SpatialAgent[],
  attackingTeam: 'home' | 'away',
  spot: { x: number; y: number },
  rng: () => number,
): { spatial: MatchSpatialFrame; takerId?: string } {
  const attackingUp = attackingTeam === 'home'
  const touchY = spot.y
  const inward = attackingUp ? -1 : 1
  const players: MatchSpatialPlayer[] = []

  const taker =
    attackers.find((a) => a.role === 'LB' || a.role === 'RB' || a.role === 'LM' || a.role === 'RM') ??
    attackers.find((a) => a.role !== 'GK') ??
    null

  attackers
    .filter((a) => a.role !== 'GK')
    .forEach((a, i) => {
      const nearTaker = taker && a.id === taker.id
      const x = nearTaker
        ? spot.x
        : clamp(spot.x + (i - 3) * 7 + (rng() - 0.5) * 4, 10, 90)
      const y = nearTaker
        ? touchY
        : clamp(touchY + inward * (8 + rng() * 10), 2, 98)
      players.push({ id: a.id, side: a.team, x, y })
    })

  defenders
    .filter((d) => d.role !== 'GK')
    .slice(0, 6)
    .forEach((d, i) => {
      const x = clamp(spot.x + (i - 2) * 8 + (rng() - 0.5) * 5, 10, 90)
      const y = clamp(touchY + inward * (14 + rng() * 8), 2, 98)
      players.push({ id: d.id, side: d.team, x, y })
    })

  const gk = defenders.find((d) => d.role === 'GK')
  if (gk) {
    players.push({
      id: gk.id,
      side: gk.team,
      x: 50,
      y: attackingUp ? 94 : 6,
    })
  }

  return {
    takerId: taker?.id,
    spatial: {
      ball: { x: spot.x, y: spot.y },
      possessing: attackingTeam,
      carrierId: taker?.id,
      players,
    },
  }
}

export function applySpatialToAgents(agents: SpatialAgent[], spatial: MatchSpatialFrame) {
  for (const p of spatial.players) {
    const a = agents.find((x) => x.id === p.id)
    if (a) {
      a.x = p.x
      a.y = p.y
    }
  }
}

export function cornerSpotForAttack(attackingUp: boolean, rng: () => number): { x: number; y: number } {
  return {
    x: rng() < 0.5 ? 12 : 88,
    y: attackingUp ? 92 : 8,
  }
}

export function throwInSpot(attackingUp: boolean, rng: () => number): { x: number; y: number } {
  return {
    x: rng() < 0.5 ? 8 : 92,
    y: attackingUp ? clamp(55 + rng() * 30, 40, 88) : clamp(45 - rng() * 30, 12, 60),
  }
}
