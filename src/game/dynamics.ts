import type { DynamicsState, GameSave, Player, SquadRole } from './types'

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function createDynamics(): DynamicsState {
  return {
    cohesion: 58,
    hierarchyStability: 62,
    dressingRoomMood: 60,
    lastNote: 'ห้องแต่งตัวกำลังปรับตัวกับผู้จัดการคนใหม่',
  }
}

const ROLE_WEIGHT: Record<SquadRole, number> = {
  key: 4,
  regular: 2,
  squad: 1,
  prospect: 1,
}

export function recomputeDynamics(save: GameSave): DynamicsState {
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const avgMorale =
    squad.reduce((s, p) => s + p.morale, 0) / Math.max(1, squad.length)
  const xi = save.tacticsByClub[save.humanClubId]?.startingXi ?? []
  const xiPlayers = xi
    .map((id) => squad.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  const keyOnBench = squad.filter(
    (p) => p.squadRole === 'key' && !xi.includes(p.id) && p.injuryDays <= 0,
  ).length

  let cohesion = 40 + avgMorale * 2.5
  cohesion -= keyOnBench * 8
  cohesion += Math.min(10, xiPlayers.filter((p) => p.squadRole === 'key').length * 3)

  const hierarchy =
    70 -
    keyOnBench * 10 +
    (xiPlayers.reduce((s, p) => s + ROLE_WEIGHT[p.squadRole], 0) / Math.max(1, xiPlayers.length)) * 4

  const mood = (cohesion + avgMorale * 4 + save.fans.mood * 0.3) / 2.2

  let lastNote = save.dynamics?.lastNote ?? ''
  if (keyOnBench >= 2) lastNote = 'ดาวสำคัญอยู่บนม้านั่ง — ลำดับชั้นสั่นคลอน'
  else if (cohesion >= 75) lastNote = 'ห้องแต่งตัวสามัคคีดี ความเชื่อมั่นสูง'
  else if (cohesion <= 40) lastNote = 'บรรยากาศตึงเครียด โมราเลสควอดต่ำ'
  else lastNote = 'ไดนามิกส์สควอดอยู่ในระดับกลางๆ'

  return {
    cohesion: clamp(cohesion),
    hierarchyStability: clamp(hierarchy),
    dressingRoomMood: clamp(mood),
    lastNote,
  }
}

export function dynamicsMatchBonus(dynamics: DynamicsState): number {
  return 0.92 + (dynamics.cohesion / 100) * 0.12 + (dynamics.dressingRoomMood / 100) * 0.06
}
