/**
 * ห้องแต่งตัว / Dynamics — hierarchy · กลุ่มสังคม · คู่แข่งในทีม · ความเชื่อมั่นต่อผู้จัดการ
 */
import type {
  DynamicsHierarchyEntry,
  DynamicsRivalry,
  DynamicsSocialGroup,
  DynamicsState,
  GameSave,
  HierarchyTier,
  Player,
  SquadRole,
} from './types'
import { listSquadSeniors } from './squadSeniors'

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function uid(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}

export function createDynamics(): DynamicsState {
  return {
    cohesion: 58,
    hierarchyStability: 62,
    dressingRoomMood: 60,
    managerTrust: 55,
    lastNote: 'ห้องแต่งตัวกำลังปรับตัวกับผู้จัดการคนใหม่',
    hierarchy: [],
    groups: [],
    rivalries: [],
  }
}

export function ensureDynamics(d: DynamicsState | undefined | null): DynamicsState {
  const base = d ?? createDynamics()
  return {
    ...createDynamics(),
    ...base,
    hierarchy: base.hierarchy ?? [],
    groups: base.groups ?? [],
    rivalries: base.rivalries ?? [],
    managerTrust: base.managerTrust ?? 55,
  }
}

const ROLE_WEIGHT: Record<SquadRole, number> = {
  key: 4,
  regular: 2,
  squad: 1,
  prospect: 1,
}

const TIER_RANK: Record<HierarchyTier, number> = {
  leader: 4,
  influential: 3,
  squad: 2,
  peripheral: 1,
}

function assignTier(p: Player, tacticsCaptainId: string | null | undefined, seniorIds: Set<string>): HierarchyTier {
  if (tacticsCaptainId === p.id) return 'leader'
  if (p.squadRole === 'key' || seniorIds.has(p.id)) return 'influential'
  if (p.squadRole === 'prospect' || p.age <= 20) return 'peripheral'
  return 'squad'
}

function buildHierarchy(
  squad: Player[],
  captainId: string | null | undefined,
  seniorIds: Set<string>,
): DynamicsHierarchyEntry[] {
  return squad
    .map((p) => {
      const tier = assignTier(p, captainId, seniorIds)
      const influence = clamp(
        p.overall * 0.35 +
          ROLE_WEIGHT[p.squadRole] * 8 +
          (p.morale ?? 10) * 2 +
          (tier === 'leader' ? 18 : tier === 'influential' ? 10 : 0) +
          (p.age >= 28 ? 6 : 0),
      )
      return { playerId: p.id, tier, influence }
    })
    .sort((a, b) => b.influence - a.influence || TIER_RANK[b.tier] - TIER_RANK[a.tier])
}

function buildGroups(squad: Player[], hierarchy: DynamicsHierarchyEntry[]): DynamicsSocialGroup[] {
  const byId = new Map(hierarchy.map((h) => [h.playerId, h]))
  const leaders = hierarchy.filter((h) => h.tier === 'leader' || h.tier === 'influential').slice(0, 4)
  const youth = squad.filter((p) => p.age <= 22 || p.isYouth).slice(0, 8)
  const foreign = squad.filter((p) => (p.bio?.nationality || p.fmInside?.attrs) && p.age > 22).slice(0, 8)

  const groups: DynamicsSocialGroup[] = []
  if (leaders.length >= 2) {
    groups.push({
      id: 'grp-core',
      labelTh: 'แกนนำห้องแต่งตัว',
      memberIds: leaders.map((l) => l.playerId),
      mood: clamp(
        leaders.reduce((s, l) => {
          const p = squad.find((x) => x.id === l.playerId)
          return s + (p?.morale ?? 10) * 5
        }, 0) / leaders.length,
      ),
    })
  }
  if (youth.length >= 3) {
    groups.push({
      id: 'grp-youth',
      labelTh: 'กลุ่มดาวรุ่ง',
      memberIds: youth.map((p) => p.id),
      mood: clamp(youth.reduce((s, p) => s + p.morale * 5, 0) / youth.length),
    })
  }
  // กลุ่มตามบทบาทหลัก
  const attackers = squad.filter((p) => p.position === 'FW' || p.role === 'CAM').slice(0, 6)
  if (attackers.length >= 3) {
    groups.push({
      id: 'grp-attack',
      labelTh: 'กลุ่มเกมรุก',
      memberIds: attackers.map((p) => p.id),
      mood: clamp(attackers.reduce((s, p) => s + p.happiness * 5, 0) / attackers.length),
    })
  }
  if (foreign.length >= 3 && groups.length < 4) {
    const ids = foreign.map((p) => p.id).filter((id) => !youth.some((y) => y.id === id))
    if (ids.length >= 3) {
      groups.push({
        id: 'grp-intl',
        labelTh: 'กลุ่มนักเตะต่างชาติ',
        memberIds: ids.slice(0, 8),
        mood: clamp(
          ids.reduce((s, id) => {
            const p = squad.find((x) => x.id === id)
            return s + (p?.morale ?? 10) * 5
          }, 0) / ids.length,
        ),
      })
    }
  }
  // เติมกลุ่มเหลือจากคน peripheral ที่ยังไม่อยู่กลุ่ม
  const covered = new Set(groups.flatMap((g) => g.memberIds))
  const rest = squad.filter((p) => !covered.has(p.id)).slice(0, 6)
  if (rest.length >= 3) {
    groups.push({
      id: uid('grp-rest'),
      labelTh: 'กลุ่มขอบสนาม',
      memberIds: rest.map((p) => p.id),
      mood: clamp(rest.reduce((s, p) => s + p.morale * 5, 0) / rest.length),
    })
  }
  void byId
  return groups.slice(0, 5)
}

function buildRivalries(squad: Player[], xi: string[]): DynamicsRivalry[] {
  const rivals: DynamicsRivalry[] = []
  const keys = squad.filter((p) => p.squadRole === 'key' && p.injuryDays <= 0)
  // ดาวสำคัญนอก XI vs คนที่ได้ลง
  for (const k of keys) {
    if (xi.includes(k.id)) continue
    const samePos = squad
      .filter((p) => p.id !== k.id && p.position === k.position && xi.includes(p.id))
      .sort((a, b) => b.overall - a.overall)[0]
    if (!samePos) continue
    rivals.push({
      aId: k.id,
      bId: samePos.id,
      intensity: clamp(40 + (k.overall - samePos.overall) + (20 - k.happiness)),
      reasonTh: `${k.name} ไม่พอใจที่ ${samePos.name} ได้ลงตัวจริงแทน`,
    })
  }
  // want away vs loyal
  const wantAway = squad.filter((p) => p.transferDesire?.active)
  for (const w of wantAway.slice(0, 2)) {
    const loyal = squad
      .filter((p) => p.id !== w.id && (p.clubLoyalty ?? 10) >= 14)
      .sort((a, b) => (b.clubLoyalty ?? 0) - (a.clubLoyalty ?? 0))[0]
    if (!loyal) continue
    rivals.push({
      aId: w.id,
      bId: loyal.id,
      intensity: clamp(35 + (w.transferDesire?.intensity ?? 5)),
      reasonTh: `${loyal.name} ไม่ชอบทัศนคติอยากย้ายของ ${w.name}`,
    })
  }
  return rivals.slice(0, 6)
}

export function recomputeDynamics(save: GameSave): DynamicsState {
  const prev = ensureDynamics(save.dynamics)
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const avgMorale =
    squad.reduce((s, p) => s + p.morale, 0) / Math.max(1, squad.length)
  const tactics = save.tacticsByClub[save.humanClubId]
  const xi = tactics?.startingXi ?? []
  const xiPlayers = xi
    .map((id) => squad.find((p) => p.id === id))
    .filter((p): p is Player => !!p)

  const keyOnBench = squad.filter(
    (p) => p.squadRole === 'key' && !xi.includes(p.id) && p.injuryDays <= 0,
  ).length

  const seniors = listSquadSeniors(squad, tactics, 5)
  const seniorIds = new Set(seniors.map((s) => s.player.id))
  const seniorsInXi = xiPlayers.filter((p) => seniorIds.has(p.id)).length
  const seniorAvgMorale =
    seniors.length > 0
      ? seniors.reduce((s, x) => s + x.player.morale, 0) / seniors.length
      : avgMorale

  const hierarchy = buildHierarchy(squad, tactics?.captainId, seniorIds)
  const groups = buildGroups(squad, hierarchy)
  const rivalries = buildRivalries(squad, xi)

  let cohesion = 40 + avgMorale * 2.5
  cohesion -= keyOnBench * 8
  cohesion += Math.min(10, xiPlayers.filter((p) => p.squadRole === 'key').length * 3)
  cohesion += Math.min(6, seniorsInXi * 2)
  cohesion -= Math.min(12, rivalries.reduce((s, r) => s + r.intensity, 0) / 40)
  const groupMoodAvg =
    groups.length > 0 ? groups.reduce((s, g) => s + g.mood, 0) / groups.length : 55
  cohesion += (groupMoodAvg - 50) * 0.15

  let hierarchyStab =
    70 -
    keyOnBench * 10 +
    (xiPlayers.reduce((s, p) => s + ROLE_WEIGHT[p.squadRole], 0) / Math.max(1, xiPlayers.length)) *
      4
  hierarchyStab += Math.min(12, seniorsInXi * 3)
  hierarchyStab += (seniorAvgMorale - 10) * 1.2
  if (tactics?.captainId && xi.includes(tactics.captainId)) hierarchyStab += 4
  hierarchyStab -= rivalries.filter((r) => r.intensity >= 55).length * 5

  const mood =
    (cohesion + avgMorale * 4 + save.fans.mood * 0.3 + seniorAvgMorale * 1.5 + groupMoodAvg * 0.4) /
    2.8

  // ความเชื่อมั่นต่อผู้จัดการ — จากผลงาน + บอร์ด + โมราเล
  const boardConf = save.board?.confidence ?? 50
  let trust = prev.managerTrust ?? 55
  trust = trust * 0.85 + boardConf * 0.1 + avgMorale * 2.5 * 0.05
  if (keyOnBench >= 2) trust -= 3
  if (rivalries.length >= 3) trust -= 2
  if (cohesion >= 75) trust += 2

  let lastNote = prev.lastNote ?? ''
  const topSenior = seniors[0]?.player.name
  const hotRival = rivalries[0]
  if (hotRival && hotRival.intensity >= 55) lastNote = hotRival.reasonTh
  else if (keyOnBench >= 2) lastNote = 'ดาวสำคัญอยู่บนม้านั่ง — ลำดับชั้นสั่นคลอน'
  else if (seniorAvgMorale <= 7 && topSenior)
    lastNote = `ซีเนียร์นำโดย ${topSenior} ไม่พอใจ — ห้องแต่งตัวตึง`
  else if (cohesion >= 75 && topSenior)
    lastNote = `ห้องแต่งตัวสามัคคี · แกนซีเนียร์ ${topSenior} คุมบรรยากาศได้`
  else if (cohesion >= 75) lastNote = 'ห้องแต่งตัวสามัคคีดี ความเชื่อมั่นสูง'
  else if (cohesion <= 40) lastNote = 'บรรยากาศตึงเครียด โมราเลสควอดต่ำ'
  else if (topSenior) lastNote = `ไดนามิกส์กลางๆ · ซีเนียร์หลัก ${topSenior}`
  else lastNote = 'ไดนามิกส์สควอดอยู่ในระดับกลางๆ'

  return {
    cohesion: clamp(cohesion),
    hierarchyStability: clamp(hierarchyStab),
    dressingRoomMood: clamp(mood),
    managerTrust: clamp(trust),
    lastNote,
    hierarchy,
    groups,
    rivalries,
  }
}

export function dynamicsMatchBonus(dynamics: DynamicsState): number {
  const d = ensureDynamics(dynamics)
  const base =
    0.92 +
    (d.cohesion / 100) * 0.1 +
    (d.dressingRoomMood / 100) * 0.05 +
    (d.hierarchyStability / 100) * 0.04 +
    ((d.managerTrust ?? 50) / 100) * 0.03
  const rivalPenalty = Math.min(0.04, (d.rivalries?.length ?? 0) * 0.008)
  return Math.max(0.88, Math.min(1.14, base - rivalPenalty))
}

export const HIERARCHY_TIER_LABEL: Record<HierarchyTier, string> = {
  leader: 'ผู้นำ',
  influential: 'มีอิทธิพล',
  squad: 'สมาชิก',
  peripheral: 'ขอบสควอด',
}
