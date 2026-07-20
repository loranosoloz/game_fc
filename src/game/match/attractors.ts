import type { BehavioralVectors, RoleCode, RoleDuty, TeamInstructions } from '../types'
import { TACTICAL_ROLE_BY_ID, type TacticalRoleId } from '../tacticalRoles'

export type { RoleDuty, BehavioralVectors }

export interface RoleVectorDef {
  roleName: string
  duty: RoleDuty
  vectors: BehavioralVectors
}

const def = (
  roleName: string,
  duty: RoleDuty,
  partial: Partial<BehavioralVectors>,
): RoleVectorDef => ({
  roleName,
  duty,
  vectors: {
    forwardRunTendency: 0.3,
    lateralHoldTendency: 0.5,
    centralCutInAttractor: 0.2,
    passingRiskTolerance: 0.45,
    defensiveTrackingDrop: 0.5,
    overlapTendency: 0.2,
    ...partial,
  },
})

/** Default attractors ตาม RoleCode ของ slot */
export const ROLE_VECTORS: Record<RoleCode, RoleVectorDef> = {
  GK: def('SweeperKeeperLite', 'defend', {
    forwardRunTendency: 0.05,
    lateralHoldTendency: 0.9,
    passingRiskTolerance: 0.35,
    defensiveTrackingDrop: 0.1,
  }),
  CB: def('BallPlayingDefender', 'defend', {
    forwardRunTendency: 0.12,
    lateralHoldTendency: 0.75,
    passingRiskTolerance: 0.55,
    defensiveTrackingDrop: 0.2,
  }),
  LB: def('FullBack', 'support', {
    forwardRunTendency: 0.55,
    overlapTendency: 0.7,
    lateralHoldTendency: 0.4,
    defensiveTrackingDrop: 0.55,
  }),
  RB: def('FullBack', 'support', {
    forwardRunTendency: 0.55,
    overlapTendency: 0.7,
    lateralHoldTendency: 0.4,
    defensiveTrackingDrop: 0.55,
  }),
  CDM: def('DeepLyingPlaymaker', 'defend', {
    forwardRunTendency: 0.2,
    lateralHoldTendency: 0.7,
    passingRiskTolerance: 0.7,
    defensiveTrackingDrop: 0.35,
  }),
  CM: def('BoxToBox', 'support', {
    forwardRunTendency: 0.45,
    lateralHoldTendency: 0.45,
    passingRiskTolerance: 0.55,
  }),
  CAM: def('AdvancedPlaymaker', 'attack', {
    forwardRunTendency: 0.7,
    centralCutInAttractor: 0.6,
    passingRiskTolerance: 0.65,
    defensiveTrackingDrop: 0.4,
  }),
  LM: def('WideMid', 'support', {
    forwardRunTendency: 0.5,
    overlapTendency: 0.45,
    lateralHoldTendency: 0.55,
  }),
  RM: def('WideMid', 'support', {
    forwardRunTendency: 0.5,
    overlapTendency: 0.45,
    lateralHoldTendency: 0.55,
  }),
  LW: def('InsideForward', 'attack', {
    forwardRunTendency: 0.85,
    centralCutInAttractor: 0.85,
    defensiveTrackingDrop: 0.35,
    passingRiskTolerance: 0.5,
  }),
  RW: def('InsideForward', 'attack', {
    forwardRunTendency: 0.85,
    centralCutInAttractor: 0.85,
    defensiveTrackingDrop: 0.35,
    passingRiskTolerance: 0.5,
  }),
  ST: def('AdvancedForward', 'attack', {
    forwardRunTendency: 0.9,
    centralCutInAttractor: 0.4,
    defensiveTrackingDrop: 0.25,
  }),
  SS: def('ShadowStriker', 'attack', {
    forwardRunTendency: 0.8,
    centralCutInAttractor: 0.7,
    defensiveTrackingDrop: 0.3,
  }),
}

export function dutyScaleFromMentality(mentality: TeamInstructions['mentality']): number {
  if (mentality === 'attacking') return 1.15
  if (mentality === 'defensive') return 0.75
  return 1
}

/**
 * Off-ball attractor offset (relative grid deltas)
 * V_final = V_formation + ω_role*A_role + ω_duty*A_duty
 */
export function resolveRoleVectors(
  role: RoleCode,
  tacticalRoleId?: string | null,
): RoleVectorDef {
  if (tacticalRoleId) {
    const tr = TACTICAL_ROLE_BY_ID[tacticalRoleId as TacticalRoleId]
    if (tr && tr.slots.includes(role)) {
      return { roleName: tr.id, duty: tr.duty, vectors: tr.vectors }
    }
  }
  return ROLE_VECTORS[role]
}

/**
 * Off-ball attractor offset (relative grid deltas)
 * V_final = V_formation + ω_role*A_role + ω_duty*A_duty
 */
export function attractorOffset(
  role: RoleCode,
  mentality: TeamInstructions['mentality'],
  inPossession: boolean,
  attackingRight: boolean,
  tacticalRoleId?: string | null,
): { dx: number; dy: number } {
  const defn = resolveRoleVectors(role, tacticalRoleId)
  if (!inPossession) {
    const v = defn.vectors
    return {
      dx: 0,
      dy: -8 * v.defensiveTrackingDrop * (attackingRight ? 1 : -1),
    }
  }
  const v = defn.vectors
  const dutyW =
    dutyScaleFromMentality(mentality) *
    (defn.duty === 'attack' ? 1.2 : defn.duty === 'defend' ? 0.5 : 0.85)
  const dir = attackingRight ? 1 : -1
  const towardCenter = role === 'LW' || role === 'LM' ? 1 : role === 'RW' || role === 'RM' ? -1 : 0
  const dx =
    towardCenter * 12 * v.centralCutInAttractor +
    (role === 'LB' || role === 'LM' ? -1 : role === 'RB' || role === 'RM' ? 1 : 0) *
      10 *
      v.overlapTendency
  const dy =
    dir * (14 * v.forwardRunTendency * dutyW - 6 * v.lateralHoldTendency * (1 - dutyW * 0.3))
  return { dx, dy }
}
