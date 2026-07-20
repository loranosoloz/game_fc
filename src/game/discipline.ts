import type { GameSave, MatchEvent, Player } from './types'
import { formatIllnessStatus } from './illness'
import { canPlayMatch } from './medicalStamina'

const YELLOW_THRESHOLD = 5

export function isUnavailable(player: Player): boolean {
  return !canPlayMatch(player)
}

export function formatBanStatus(player: Player): string | null {
  const leave = player.leaveDays ?? 0
  if (leave > 0) return `ลา ${leave} นัด`
  const ill = formatIllnessStatus(player)
  if (ill) return ill
  const ban = player.banMatches ?? 0
  if (ban <= 0) return null
  return `แบน ${ban} นัด`
}

export function applyCardToPlayer(player: Player, color: 'yellow' | 'red'): Player {
  if (color === 'red') {
    const ban = 1 + Math.floor(Math.random() * 2) // 1–2 matches (deterministic caller should pass rng)
    return {
      ...player,
      seasonYellows: player.seasonYellows ?? 0,
      banMatches: Math.max(player.banMatches ?? 0, ban),
    }
  }
  const yellows = (player.seasonYellows ?? 0) + 1
  if (yellows >= YELLOW_THRESHOLD) {
    return {
      ...player,
      seasonYellows: 0,
      banMatches: Math.max(player.banMatches ?? 0, 1),
    }
  }
  return { ...player, seasonYellows: yellows }
}

export function applyCardToPlayerRng(
  player: Player,
  color: 'yellow' | 'red',
  rng: () => number,
): Player {
  if (color === 'red') {
    const ban = rng() < 0.35 ? 3 : rng() < 0.55 ? 2 : 1
    return {
      ...player,
      seasonYellows: player.seasonYellows ?? 0,
      banMatches: Math.max(player.banMatches ?? 0, ban),
    }
  }
  const yellows = (player.seasonYellows ?? 0) + 1
  if (yellows >= YELLOW_THRESHOLD) {
    return {
      ...player,
      seasonYellows: 0,
      banMatches: Math.max(player.banMatches ?? 0, 1),
    }
  }
  return { ...player, seasonYellows: yellows }
}

/** Apply disciplinary from match events (needs playerId on card events). */
export function applyDisciplineFromEvents(
  players: Player[],
  events: MatchEvent[],
  rng: () => number,
): {
  players: Player[]
  notes: string[]
  fineTriggers: Array<{ playerId: string; kind: 'red_card' | 'yellow_ban' }>
} {
  let next = players
  const notes: string[] = []
  const fineTriggers: Array<{ playerId: string; kind: 'red_card' | 'yellow_ban' }> = []
  for (const ev of events) {
    if (ev.kind !== 'card' || !ev.playerId) continue
    const color = ev.cardColor ?? 'yellow'
    const before = next.find((p) => p.id === ev.playerId)
    if (!before) continue
    const updated = applyCardToPlayerRng(before, color, rng)
    next = next.map((p) => (p.id === ev.playerId ? updated : p))
    if ((updated.banMatches ?? 0) > (before.banMatches ?? 0)) {
      notes.push(
        `${updated.name} โดนแบน ${updated.banMatches} นัด` +
          (color === 'red' ? ' (ใบแดง)' : ' (ใบเหลืองสะสม)'),
      )
      fineTriggers.push({
        playerId: updated.id,
        kind: color === 'red' ? 'red_card' : 'yellow_ban',
      })
    }
  }
  return { players: next, notes, fineTriggers }
}

/** After a matchday completes, tick bans for players who did not play (or all clubs). */
export function tickBansAfterMatchday(save: GameSave, playedClubIds: Set<string>): Player[] {
  return save.players.map((p) => {
    if ((p.banMatches ?? 0) <= 0) return p
    // Serve ban when their club had a fixture this matchday
    if (!playedClubIds.has(p.clubId)) return p
    return { ...p, banMatches: Math.max(0, (p.banMatches ?? 0) - 1) }
  })
}

export function stripBannedFromTactics(
  tactics: GameSave['tacticsByClub'],
  players: Player[],
): GameSave['tacticsByClub'] {
  const banned = new Set(players.filter((p) => (p.banMatches ?? 0) > 0).map((p) => p.id))
  if (banned.size === 0) return tactics
  const next = { ...tactics }
  for (const clubId of Object.keys(next)) {
    const t = next[clubId]
    next[clubId] = {
      ...t,
      startingXi: t.startingXi.filter((id) => !banned.has(id)),
      bench: t.bench.filter((id) => !banned.has(id)),
    }
  }
  return next
}
