import type { RoleCode } from '../types'
import { FORMATION_ANCHORS } from './formationAnchors'

export interface AgentLite {
  id: string
  team: 'home' | 'away'
  role: RoleCode
  x: number
  y: number
  slotIndex: number
}

/**
 * Free player: slot ที่ไม่มีคู่ประกบตามบทบาทใกล้เคียงในโซน (เช่น DM vs ไม่มี DM)
 * ไม่ใช่ “ฟอเมชั่นชนะ” — คือช่องว่างจาก overlay พิกัด
 */
export function findFreePlayers(
  home: AgentLite[],
  away: AgentLite[],
  possessing: 'home' | 'away',
): { agentId: string; role: RoleCode; note: string }[] {
  const attackers = possessing === 'home' ? home : away
  const defenders = possessing === 'home' ? away : home
  const notes: { agentId: string; role: RoleCode; note: string }[] = []

  for (const a of attackers) {
    if (a.role === 'GK') continue
    const markRadius = a.role === 'CDM' || a.role === 'CAM' ? 14 : 12
    const markers = defenders.filter((d) => {
      const dx = d.x - a.x
      const ddy = d.y - a.y
      return Math.hypot(dx, ddy) < markRadius
    })
    // DM โดยเฉพาะ — ถ้าไม่มีใครประกบใกล้
    if (markers.length === 0) {
      notes.push({
        agentId: a.id,
        role: a.role,
        note: `${a.role} ว่างไม่มีคนประกบ (free player)`,
      })
    } else if (a.role === 'CDM' && markers.every((m) => m.role === 'ST' || m.role === 'SS')) {
      notes.push({
        agentId: a.id,
        role: a.role,
        note: `DM ถูกประกบแค่หน้าคู่ — ยังสร้างเกมได้`,
      })
    }
  }
  return notes.slice(0, 4)
}

/** คะแนนโครงข่ายพาส: ระยะเฉลี่ยไปหาเพื่อนบ้าน 2 คน + มุมสามเหลี่ยม */
export function passNetworkScore(agents: AgentLite[], carrierId: string): {
  avgEdge: number
  options: number
  triangleBonus: number
} {
  const carrier = agents.find((a) => a.id === carrierId)
  if (!carrier) return { avgEdge: 40, options: 0, triangleBonus: 0 }
  const mates = agents
    .filter((a) => a.team === carrier.team && a.id !== carrierId && a.role !== 'GK')
    .map((a) => ({ a, d: Math.hypot(a.x - carrier.x, a.y - carrier.y) }))
    .sort((x, y) => x.d - y.d)
  const near = mates.slice(0, 3)
  const avgEdge = near.length ? near.reduce((s, n) => s + n.d, 0) / near.length : 40
  let triangleBonus = 0
  if (near.length >= 2) {
    const a = near[0]!.a
    const b = near[1]!.a
    const ang = angleDeg(carrier.x, carrier.y, a.x, a.y, b.x, b.y)
    if (ang >= 40 && ang <= 75) triangleBonus = 0.12
    else if (ang >= 30 && ang <= 90) triangleBonus = 0.06
  }
  return {
    avgEdge,
    options: near.filter((n) => n.d < 28).length,
    triangleBonus,
  }
}

function angleDeg(
  ox: number,
  oy: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
): number {
  const v1x = ax - ox
  const v1y = ay - oy
  const v2x = bx - ox
  const v2y = by - oy
  const d = Math.hypot(v1x, v1y) * Math.hypot(v2x, v2y)
  if (d < 1e-6) return 0
  const c = Math.max(-1, Math.min(1, (v1x * v2x + v1y * v2y) / d))
  return (Math.acos(c) * 180) / Math.PI
}

export function roleFitPenalty(playerRole: RoleCode, slotRole: RoleCode): number {
  if (playerRole === slotRole) return 1
  const group = (r: RoleCode) => {
    if (r === 'GK') return 'gk'
    if (r === 'CB' || r === 'LB' || r === 'RB') return 'df'
    if (r === 'CDM' || r === 'CM' || r === 'CAM' || r === 'LM' || r === 'RM') return 'mf'
    return 'fw'
  }
  if (group(playerRole) === group(slotRole)) return 0.92
  return 0.78
}

export function validateAnchorCount(formation: keyof typeof FORMATION_ANCHORS): boolean {
  return FORMATION_ANCHORS[formation].length === 11
}
