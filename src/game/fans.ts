import type { FanState, GameSave, InboxMessage } from './types'

export function createFanState(clubReputation: number): FanState {
  const base = Math.min(78, 52 + Math.round(clubReputation / 4))
  return {
    mood: base,
    expectation: Math.min(85, 45 + Math.round(clubReputation / 3)),
    loyalty: Math.min(80, 40 + Math.round(clubReputation / 4)),
    factions: {
      ultras: 55 + Math.round(clubReputation / 10),
      casual: 60,
      corporate: 50 + Math.round(clubReputation / 8),
    },
    lastVerdict: 'แฟนบอลพร้อมสนับสนุนฤดูกาลใหม่',
  }
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function fanMoodLabel(mood: number): string {
  if (mood >= 80) return 'คลั่งไคล้'
  if (mood >= 65) return 'พอใจ'
  if (mood >= 50) return 'เฉยๆ'
  if (mood >= 35) return 'ไม่พอใจ'
  return 'โกรธจัด'
}

export function fanTicketMultiplier(fans: FanState): number {
  // mood 50 = 1.0, 100 ~= 1.28, 0 ~= 0.62
  return 0.62 + (fans.mood / 100) * 0.66
}

export function applyMatchToFans(
  fans: FanState,
  usGoals: number,
  themGoals: number,
  wasHome: boolean,
): FanState {
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  const gd = usGoals - themGoals
  let delta = 0
  if (won) delta = 4 + Math.min(4, gd) + (wasHome ? 1 : 2)
  else if (drawn) delta = wasHome ? -1 : 1
  else delta = -5 - Math.min(4, -gd) - (wasHome ? 2 : 0)

  // ความคาดหวังสูง = แพ้เจ็บกว่า / ชนะได้หน่อย
  const pressure = (fans.expectation - 50) / 50
  if (won) delta -= pressure * 1.5
  if (!won && !drawn) delta -= pressure * 3

  const cushion = fans.loyalty / 200
  if (delta < 0) delta *= 1 - cushion

  const mood = clamp(fans.mood + delta)
  let verdict = fans.lastVerdict
  if (won) verdict = wasHome ? 'อัฒจันทร์ระเบิด! ชนะในบ้าน' : 'แฟนบอลชื่นชมชัยชนะเยือน'
  else if (drawn) verdict = 'ผลเสมอทำให้แฟนงงๆ — อยากเห็นเกมชัดกว่านี้'
  else verdict = wasHome ? 'แพ้ในบ้าน — เสียงโห่ดังก้อง' : 'แพ้เยือน — แฟนเริ่มกังวลฟอร์ม'

  return {
    ...fans,
    mood,
    expectation: clamp(fans.expectation + (won ? 1 : drawn ? 0 : -1)),
    factions: {
      ultras: clamp(fans.factions.ultras + (won ? 3 : -4)),
      casual: clamp(fans.factions.casual + (won ? 2 : drawn ? 0 : -2)),
      corporate: clamp(fans.factions.corporate + (won ? 1 : drawn ? 0 : -1)),
    },
    lastVerdict: verdict,
  }
}

export type TransferFanKind = 'buy_star' | 'buy_squad' | 'buy_flop_risk' | 'sell_star' | 'sell_surplus' | 'sell_veteran'

export function classifyTransferForFans(
  playerOverall: number,
  squadAvg: number,
  isBuy: boolean,
  wasKeyPlayer: boolean,
  age: number,
): TransferFanKind {
  if (isBuy) {
    if (playerOverall >= squadAvg + 4) return 'buy_star'
    if (playerOverall + 2 < squadAvg) return 'buy_flop_risk'
    return 'buy_squad'
  }
  if (wasKeyPlayer || playerOverall >= squadAvg + 2) return 'sell_star'
  if (age >= 32) return 'sell_veteran'
  return 'sell_surplus'
}

export function applyTransferToFans(
  fans: FanState,
  kind: TransferFanKind,
  playerName: string,
): { fans: FanState; message: string } {
  let delta = 0
  let message = ''
  switch (kind) {
    case 'buy_star':
      delta = 6
      message = `แฟนคลั่ง! การซื้อ ${playerName} ถูกมองว่าเป็นสัญญาณความทะเยอทะยาน`
      break
    case 'buy_squad':
      delta = 2
      message = `แฟนพอใจการเสริม ${playerName} — ดูสมเหตุสมผล`
      break
    case 'buy_flop_risk':
      delta = -2
      message = `แฟนสงสัยคุณภาพของ ${playerName} — กลัวเสียเงินฟรี`
      break
    case 'sell_star':
      delta = -10
      message = `อัฒจันทร์เดือด! การขาย ${playerName} ถูกมองว่าขาดความทะเยอทะยาน`
      break
    case 'sell_veteran':
      delta = 1
      message = `แฟนเข้าใจการปล่อย ${playerName} ตามวัย — ขอให้ใช้เงินดีๆ`
      break
    case 'sell_surplus':
      delta = 2
      message = `แฟนโอเคกับการขาย ${playerName} ที่ความลึกตำแหน่งยังพอ`
      break
  }

  const mood = clamp(fans.mood + delta)
  return {
    fans: {
      ...fans,
      mood,
      factions: {
        ultras: clamp(fans.factions.ultras + (kind === 'sell_star' ? -8 : kind === 'buy_star' ? 5 : 0)),
        casual: clamp(fans.factions.casual + delta * 0.6),
        corporate: clamp(
          fans.factions.corporate +
            (kind === 'sell_star' || kind === 'sell_surplus' ? 3 : kind === 'buy_star' ? -1 : 0),
        ),
      },
      lastVerdict: message,
    },
    message,
  }
}

export function fanInbox(save: GameSave, title: string, body: string): InboxMessage {
  return {
    id: `msg-fan-${Date.now()}`,
    date: save.currentDate,
    title,
    body,
    read: false,
  }
}

export function ensureFans(save: GameSave): GameSave {
  if (save.fans && typeof save.fans.mood === 'number') return save
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  return { ...save, fans: createFanState(club.reputation) }
}
