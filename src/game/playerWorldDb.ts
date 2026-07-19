/**
 * Live world player DB = GameSave.players (+ move log)
 * Pack JSON = แม่แบบตอนเริ่มอาชีพเท่านั้น
 */
import type { Club, GameSave, Player } from './types'
import { playerNationality } from './nationalTeams'
import { hasPhotoForPlayerName } from '@/lib/playerPhotos'

export type PlayerMoveKind =
  | 'transfer'
  | 'loan_out'
  | 'loan_return'
  | 'free'
  | 'release'
  | 'retire'
  | 'other'

export interface PlayerMoveEvent {
  id: string
  matchday: number
  season: number
  date: string
  playerId: string
  playerName: string
  fromClubId: string
  toClubId: string
  kind: PlayerMoveKind
  fee?: number
  note?: string
}

export type LiveStatusFilter =
  | 'all'
  | 'available'
  | 'injured'
  | 'banned'
  | 'loan'
  | 'listed'
  | 'free_agent'

export interface LivePlayerRow {
  id: string
  name: string
  age: number
  role: Player['role']
  position: Player['position']
  overall: number
  ca: number
  clubId: string
  clubName: string
  clubShort: string
  leagueId: string
  nationality: string
  statusLabel: string
  statusKind: 'ok' | 'injured' | 'ill' | 'banned' | 'leave' | 'loan' | 'listed' | 'free'
  injuryDays: number
  banMatches: number
  wage: number
  contractYears: number
  transferListed: boolean
  wantAway: boolean
  hasPhoto: boolean
  player: Player
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export function createPlayerMoveLog(): PlayerMoveEvent[] {
  return []
}

export function ensurePlayerMoveLog(save: GameSave): PlayerMoveEvent[] {
  return save.playerMoveLog ?? []
}

export function clubLabel(clubs: Club[], clubId: string): { name: string; short: string } {
  if (clubId === '__free__') return { name: 'ฟรีเอเยนต์', short: 'FREE' }
  const c = clubs.find((x) => x.id === clubId)
  return { name: c?.name ?? clubId, short: c?.shortName ?? clubId.slice(0, 3).toUpperCase() }
}

export function playerAvailabilityLabel(p: Player): {
  label: string
  kind: LivePlayerRow['statusKind']
} {
  if (p.clubId === '__free__') return { label: 'ฟรีเอเยนต์', kind: 'free' }
  if ((p.injuryDays ?? 0) > 0) {
    return { label: `เจ็บ ${p.injuryDays} วัน`, kind: 'injured' }
  }
  if ((p.illnessDays ?? 0) > 0) {
    return { label: `ป่วย ${p.illnessDays} วัน`, kind: 'ill' }
  }
  if ((p.banMatches ?? 0) > 0) {
    return { label: `แบน ${p.banMatches} นัด`, kind: 'banned' }
  }
  if ((p.leaveDays ?? 0) > 0) {
    return { label: `ลา ${p.leaveDays} วัน`, kind: 'leave' }
  }
  if (p.loanParentClubId) return { label: 'ยืมตัว', kind: 'loan' }
  if (p.transferListed) return { label: 'ขึ้นขาย', kind: 'listed' }
  if (p.wantAway?.active) return { label: 'อยากย้าย', kind: 'listed' }
  return { label: 'พร้อม', kind: 'ok' }
}

export function listLivePlayers(save: GameSave): LivePlayerRow[] {
  const clubs = save.clubs
  return save.players
    .map((p) => {
      const club = clubLabel(clubs, p.clubId)
      const st = playerAvailabilityLabel(p)
      const hostClub = clubs.find((c) => c.id === p.clubId)
      return {
        id: p.id,
        name: p.name,
        age: p.age,
        role: p.role,
        position: p.position,
        overall: p.overall,
        ca: p.ca,
        clubId: p.clubId,
        clubName: club.name,
        clubShort: club.short,
        leagueId: hostClub?.originLeagueId ?? save.leagueId,
        nationality: playerNationality(p, save),
        statusLabel: st.label,
        statusKind: st.kind,
        injuryDays: p.injuryDays ?? 0,
        banMatches: p.banMatches ?? 0,
        wage: p.wage,
        contractYears: p.contractYears ?? 0,
        transferListed: Boolean(p.transferListed),
        wantAway: Boolean(p.wantAway?.active),
        hasPhoto: hasPhotoForPlayerName(p.name),
        player: p,
      }
    })
    .sort((a, b) => b.overall - a.overall || a.name.localeCompare(b.name))
}

export function liveDbStats(rows: LivePlayerRow[]) {
  return {
    total: rows.length,
    free: rows.filter((r) => r.clubId === '__free__').length,
    injured: rows.filter((r) => r.statusKind === 'injured' || r.statusKind === 'ill').length,
    banned: rows.filter((r) => r.statusKind === 'banned').length,
    loan: rows.filter((r) => r.statusKind === 'loan').length,
    listed: rows.filter((r) => r.transferListed || r.wantAway).length,
  }
}

export function filterLivePlayers(
  rows: LivePlayerRow[],
  opts: {
    q?: string
    clubId?: string
    status?: LiveStatusFilter
    leagueId?: string | 'all'
  },
): LivePlayerRow[] {
  const needle = (opts.q ?? '').trim().toLowerCase()
  const clubId = opts.clubId ?? 'all'
  const status = opts.status ?? 'all'
  const leagueId = opts.leagueId ?? 'all'

  return rows.filter((r) => {
    if (clubId !== 'all' && r.clubId !== clubId) return false
    if (leagueId !== 'all' && r.leagueId !== leagueId) return false
    if (status === 'available' && r.statusKind !== 'ok') return false
    if (status === 'injured' && r.statusKind !== 'injured' && r.statusKind !== 'ill') return false
    if (status === 'banned' && r.statusKind !== 'banned') return false
    if (status === 'loan' && r.statusKind !== 'loan') return false
    if (status === 'listed' && !r.transferListed && !r.wantAway) return false
    if (status === 'free_agent' && r.clubId !== '__free__') return false
    if (!needle) return true
    return (
      r.name.toLowerCase().includes(needle) ||
      r.clubName.toLowerCase().includes(needle) ||
      r.clubShort.toLowerCase().includes(needle) ||
      r.nationality.toLowerCase().includes(needle)
    )
  })
}

/** บันทึกการเปลี่ยนคลับลง world DB log */
export function appendPlayerMove(
  save: GameSave,
  input: {
    playerId: string
    playerName: string
    fromClubId: string
    toClubId: string
    kind: PlayerMoveKind
    fee?: number
    note?: string
  },
): GameSave {
  if (input.fromClubId === input.toClubId) return save
  const ev: PlayerMoveEvent = {
    id: uid('pmv'),
    matchday: save.matchday,
    season: save.season,
    date: save.currentDate,
    playerId: input.playerId,
    playerName: input.playerName,
    fromClubId: input.fromClubId,
    toClubId: input.toClubId,
    kind: input.kind,
    fee: input.fee,
    note: input.note,
  }
  return {
    ...save,
    playerMoveLog: [ev, ...ensurePlayerMoveLog(save)].slice(0, 200),
  }
}

export function movesForPlayer(save: GameSave, playerId: string): PlayerMoveEvent[] {
  return ensurePlayerMoveLog(save).filter((m) => m.playerId === playerId)
}

export const MOVE_KIND_LABEL: Record<PlayerMoveKind, string> = {
  transfer: 'ย้ายถาวร',
  loan_out: 'ยืมออก',
  loan_return: 'คืนยืม',
  free: 'ฟรีเอเยนต์',
  release: 'ปล่อยตัว',
  retire: 'เลิกเล่น',
  other: 'อื่นๆ',
}
