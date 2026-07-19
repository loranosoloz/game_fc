import type { GameSave, PressStory } from './types'

export function createPressFeed(): PressStory[] {
  return []
}

export function pressAfterMatch(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): PressStory {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  let headline = ''
  let body = ''
  if (won) {
    headline = `${club.shortName} ชนะ ${oppName} — สื่อยกนิ้ว`
    body = `สกอร์ ${usGoals}–${themGoals} ทำให้แฟนและสื่อเริ่มพูดถึงฟอร์มของ ${club.name}`
  } else if (drawn) {
    headline = `${club.shortName} แบ่งแต้มกับ ${oppName}`
    body = `ผลเสมอถูกวิจารณ์ว่ายังขาดความคมในกรอบเขตโทษ`
  } else {
    headline = `คำถามถึง ${save.managerName} หลังแพ้ ${oppName}`
    body = `สื่อกดดันหลังสกอร์ ${usGoals}–${themGoals} — บอร์ดจับตาความมั่นใจ`
  }
  return {
    id: `press-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    date: save.currentDate,
    headline,
    body,
  }
}

export function pressAfterTransfer(save: GameSave, playerName: string, isBuy: boolean): PressStory {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  return {
    id: `press-tr-${Date.now()}`,
    date: save.currentDate,
    headline: isBuy
      ? `${club.shortName} ปิดดีลคว้า ${playerName}`
      : `${club.shortName} ปล่อย ${playerName} — สื่อถกเถียง`,
    body: isBuy
      ? `วงในบอกว่าข้อตกลงผ่านไปได้เพราะสเกาต์และงบที่ยังพอ`
      : `แฟนบางส่วนไม่พอใจ ขณะที่ฝั่งการเงินมองว่าสมเหตุสมผล`,
  }
}

export function gossipLine(save: GameSave): string {
  const lowMorale = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => a.morale - b.morale)[0]
  if (lowMorale && lowMorale.morale <= 6) {
    return `ซุบซิบ: ${lowMorale.name} ไม่พอใจเวลาลงเล่น`
  }
  if (save.dynamics.cohesion < 45) return 'ซุบซิบ: ห้องแต่งตัวมีเสียงวิจารณ์แท็กติก'
  if (save.board.confidence < 40) return 'ซุบซิบ: บอร์ดเริ่มคุยเรื่องอนาคตผู้จัดการ'
  return 'ซุบซิบ: สัปดาห์นี้เงียบเป็นพิเศษ'
}
