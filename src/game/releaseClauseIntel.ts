/**
 * ค่าฉีกสัญญา (release clause) เป็นความลับ
 * — รู้ได้เมื่อสนิทกับเอเยนต์หรือนักเตะ (ครอบคลุมทุกทีม รวม AI)
 * — ทีมตัวเองรู้สัญญาของตัวเองอยู่แล้ว
 */
import type { AgentStyle, GameSave, Player, ScoutKnowledge } from './types'
import { agentStyleFor } from './agents'
import { ensureScouting } from './scouting'

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export type ReleaseClauseVisibility =
  | { status: 'secret' }
  | { status: 'none' }
  | { status: 'known'; value: number }

/** เกณฑ์สนิทที่เอเยนต์/นักเตะจะเปิดเผยค่าฉีก — เอเยนต์ซื่อสัตย์หลุดง่ายกว่า */
export function releaseIntelThresholds(player: Player): { agent: number; player: number } {
  const style: AgentStyle = agentStyleFor(player)
  if (style === 'loyal') return { agent: 36, player: 42 }
  if (style === 'balanced') return { agent: 50, player: 52 }
  if (style === 'aggressive') return { agent: 60, player: 58 }
  return { agent: 68, player: 55 } // greedy
}

export function agentRapportOf(scouting: ScoutKnowledge, playerId: string): number {
  return scouting.agentRapport?.[playerId] ?? 0
}

export function playerRapportOf(scouting: ScoutKnowledge, playerId: string): number {
  return scouting.playerRapport?.[playerId] ?? 0
}

export function isReleaseClauseKnown(save: GameSave, player: Player): boolean {
  // สโมสรตัวเองรู้เงื่อนไขในสัญญาเอง
  if (player.clubId === save.humanClubId) return true
  const scouting = ensureScouting(save)
  if ((scouting.knownReleaseClauseIds ?? []).includes(player.id)) return true
  const th = releaseIntelThresholds(player)
  return (
    agentRapportOf(scouting, player.id) >= th.agent ||
    playerRapportOf(scouting, player.id) >= th.player
  )
}

export function releaseClauseVisibility(
  save: GameSave,
  player: Player,
): ReleaseClauseVisibility {
  if (!isReleaseClauseKnown(save, player)) return { status: 'secret' }
  const v = player.releaseClause
  if (v == null || v <= 0) return { status: 'none' }
  return { status: 'known', value: v }
}

export function markReleaseClauseKnown(save: GameSave, playerId: string): GameSave {
  const scouting = ensureScouting(save)
  const ids = scouting.knownReleaseClauseIds ?? []
  if (ids.includes(playerId)) return { ...save, scouting }
  return {
    ...save,
    scouting: {
      ...scouting,
      knownReleaseClauseIds: [...ids, playerId].slice(-400),
    },
  }
}

/** ถ้าสนิทพอแล้ว → บันทึกว่าได้รู้ค่าฉีก (ถาวรในเซฟ) */
export function syncReleaseClauseIntel(save: GameSave, playerId: string): GameSave {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return save
  if (player.clubId === save.humanClubId) return markReleaseClauseKnown(save, playerId)
  const scouting = ensureScouting(save)
  if ((scouting.knownReleaseClauseIds ?? []).includes(playerId)) return { ...save, scouting }
  const th = releaseIntelThresholds(player)
  if (
    agentRapportOf(scouting, playerId) >= th.agent ||
    playerRapportOf(scouting, playerId) >= th.player
  ) {
    return markReleaseClauseKnown(save, playerId)
  }
  return { ...save, scouting }
}

export function bumpAgentRapport(save: GameSave, playerId: string, delta: number): GameSave {
  const scouting = ensureScouting(save)
  const prev = agentRapportOf(scouting, playerId)
  const next = {
    ...save,
    scouting: {
      ...scouting,
      agentRapport: {
        ...(scouting.agentRapport ?? {}),
        [playerId]: clamp(prev + delta),
      },
    },
  }
  return syncReleaseClauseIntel(next, playerId)
}

export function bumpPlayerRapport(save: GameSave, playerId: string, delta: number): GameSave {
  const scouting = ensureScouting(save)
  const prev = playerRapportOf(scouting, playerId)
  const next = {
    ...save,
    scouting: {
      ...scouting,
      playerRapport: {
        ...(scouting.playerRapport ?? {}),
        [playerId]: clamp(prev + delta),
      },
    },
  }
  return syncReleaseClauseIntel(next, playerId)
}

/** ข้อความสั้นสำหรับ UI */
export function releaseClauseLabelTh(
  save: GameSave,
  player: Player,
  formatMoney: (n: number) => string,
): string {
  const v = releaseClauseVisibility(save, player)
  if (v.status === 'secret') return 'เงื่อนไขซื้อขาด: ไม่ทราบ (ต้องสนิทเอเยนต์/นักเตะ)'
  if (v.status === 'none') return 'ไม่มีเงื่อนไขซื้อขาด'
  return `เงื่อนไขซื้อขาด ${formatMoney(v.value)}`
}

export function releaseIntelHintTh(save: GameSave, player: Player): string | null {
  if (isReleaseClauseKnown(save, player)) return null
  const scouting = ensureScouting(save)
  const th = releaseIntelThresholds(player)
  const a = agentRapportOf(scouting, player.id)
  const p = playerRapportOf(scouting, player.id)
  return `สนิทเอเยนต์ ${a}/${th.agent} · สนิทนักเตะ ${p}/${th.player}`
}
