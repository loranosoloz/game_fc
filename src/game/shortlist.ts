import type { GameSave, ShortlistState } from './types'

export function createShortlist(): ShortlistState {
  return { entries: [] }
}

export function ensureShortlist(save: GameSave): ShortlistState {
  return save.shortlist ?? createShortlist()
}

export function toggleShortlist(
  save: GameSave,
  playerId: string,
  note = '',
): GameSave {
  const sl = ensureShortlist(save)
  const exists = sl.entries.some((e) => e.playerId === playerId)
  const entries = exists
    ? sl.entries.filter((e) => e.playerId !== playerId)
    : [
        ...sl.entries,
        { playerId, addedMatchday: save.matchday, note: note || 'ติดตาม' },
      ].slice(0, 40)
  return { ...save, shortlist: { entries } }
}

export function isShortlisted(save: GameSave, playerId: string): boolean {
  return ensureShortlist(save).entries.some((e) => e.playerId === playerId)
}

/** แจ้งเตือนถ้าคนใน shortlist มีฟอร์มดี / สัญญาใกล้หมด */
export function shortlistAlerts(save: GameSave): string[] {
  const sl = ensureShortlist(save)
  const notes: string[] = []
  for (const e of sl.entries) {
    const p = save.players.find((x) => x.id === e.playerId)
    if (!p) continue
    if (p.clubId === save.humanClubId) continue
    if ((p.contractYears ?? 2) <= 1) {
      notes.push(`${p.name} สัญญาใกล้หมด — โอกาสเจรจา`)
    }
    if (p.form >= 8) notes.push(`${p.name} ฟอร์มร้อน (${p.form}/10)`)
    if ((p.happiness ?? 10) <= 7) notes.push(`${p.name} ไม่แฮปปี้ที่คลับปัจจุบัน`)
  }
  return notes.slice(0, 5)
}
