import type { GameSave } from './types'
import { autoPickTactics } from './seed'
import {
  nextUnplayedMatchday,
  prepareMatchday,
  applyPreparedMatchday,
  recoverSquad,
  applyWeeklyWages,
} from './simulate'
import {
  advanceInternationalBreak,
  hasPendingInternationalBreak,
} from './internationalBreaks'
import { staffLevel } from './staff'
import { recomputeDynamics } from './dynamics'
import { medicalFacilityBonus } from './facilities'

/**
 * พักร้อน — ให้ระบบจำลองแมตช์เดย์ถัดไป N ครั้ง (AI เลือก XI ให้)
 */
export function takeHoliday(
  save: GameSave,
  matchdays: number,
): { ok: boolean; save: GameSave; message: string; simulated: number } {
  if (save.board?.sacked || save.career?.unemployed) {
    return { ok: false, save, message: 'ว่างงาน — พักร้อนไม่ได้', simulated: 0 }
  }
  if (save.seasonComplete) {
    return { ok: false, save, message: 'ฤดูกาลจบแล้ว — เริ่มฤดูกาลใหม่ก่อน', simulated: 0 }
  }
  const n = Math.max(1, Math.min(8, Math.round(matchdays)))
  let next = save
  let simulated = 0

  for (let i = 0; i < n; i++) {
    if (next.seasonComplete || next.board?.sacked) break

    if (hasPendingInternationalBreak(next)) {
      const br = advanceInternationalBreak(next)
      if (!br.ok) break
      next = br.save
      simulated++
      continue
    }

    const md = nextUnplayedMatchday(next)
    if (md == null) break

    // เติม XI อัตโนมัติก่อนจำลอง
    const humanId = next.humanClubId
    const current = next.tacticsByClub[humanId]
    const picked = autoPickTactics(
      humanId,
      next.players,
      current?.formation ?? '4-3-3',
      current?.formationOop ?? current?.formation ?? '4-3-3',
    )
    next = {
      ...next,
      tacticsByClub: {
        ...next.tacticsByClub,
        [humanId]: {
          ...picked,
          instructions: current?.instructions ?? picked.instructions,
          setPieces: current?.setPieces ?? picked.setPieces,
          familiarity: current?.familiarity ?? picked.familiarity,
          opposition: current?.opposition,
        },
      },
    }

    const prepared = prepareMatchday(next, md)
    if (!prepared) break
    next = applyPreparedMatchday(next, prepared)
    const physio = staffLevel(next.staff, 'physio') + medicalFacilityBonus(next)
    next = {
      ...next,
      players: recoverSquad(next.players, physio),
    }
    next = applyWeeklyWages(next)
    next = { ...next, dynamics: recomputeDynamics(next) }
    simulated++
  }

  if (simulated === 0) {
    return { ok: false, save, message: 'ไม่มีแมตช์เดย์ให้จำลอง', simulated: 0 }
  }

  return {
    ok: true,
    save: {
      ...next,
      inbox: [
        {
          id: `msg-holiday-${Date.now()}`,
          date: next.currentDate,
          title: 'กลับจากพักร้อน',
          body: `AI คุมทีมให้ ${simulated} แมตช์เดย์ · ตรวจผลในกล่องข้อความ/ตาราง`,
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    },
    message: `พักร้อน ${simulated} แมตช์เดย์ — AI เลือก XI และจำลองให้แล้ว`,
    simulated,
  }
}
