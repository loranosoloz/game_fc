import type { FanState, GameSave, InboxMessage } from './types'

export function createFanState(clubReputation: number): FanState {
  const base = Math.min(78, 52 + Math.round(clubReputation / 4))
  const intl = Math.min(70, 35 + Math.round(clubReputation / 5))
  return {
    mood: base,
    expectation: Math.min(85, 45 + Math.round(clubReputation / 3)),
    loyalty: Math.min(80, 40 + Math.round(clubReputation / 4)),
    factions: {
      ultras: 55 + Math.round(clubReputation / 10),
      soft: 58 + Math.round(clubReputation / 12),
      casual: 60,
      corporate: 50 + Math.round(clubReputation / 8),
      international: intl,
    },
    lastVerdict: 'แฟนบอลพร้อมสนับสนุนฤดูกาลใหม่',
    protestActive: false,
    boycottUntilMatchday: -1,
    lastEvent: 'เปิดฤดูกาล — อัฒจันทร์พร้อม',
    atmosphereLogs: [],
  }
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function defaultFactions(clubRep: number, partial?: FanState['factions']) {
  const fresh = createFanState(clubRep).factions
  return {
    ultras: partial?.ultras ?? fresh.ultras,
    soft: partial?.soft ?? fresh.soft,
    casual: partial?.casual ?? fresh.casual,
    corporate: partial?.corporate ?? fresh.corporate,
    international: partial?.international ?? fresh.international,
  }
}

export function ensureFanState(fans: FanState | undefined, clubRep = 50): FanState {
  if (!fans) return createFanState(clubRep)
  const base = createFanState(clubRep)
  return {
    ...base,
    ...fans,
    factions: defaultFactions(clubRep, fans.factions),
    protestActive: fans.protestActive ?? false,
    boycottUntilMatchday: fans.boycottUntilMatchday ?? -1,
    lastEvent: fans.lastEvent ?? fans.lastVerdict,
    atmosphereLogs: fans.atmosphereLogs ?? [],
  }
}

export function fanMoodLabel(mood: number): string {
  if (mood >= 80) return 'คลั่งไคล้'
  if (mood >= 65) return 'พอใจ'
  if (mood >= 50) return 'เฉยๆ'
  if (mood >= 35) return 'ไม่พอใจ'
  return 'โกรธจัด'
}

export function fanTicketMultiplier(fans: FanState, matchday = 0): number {
  const f = ensureFanState(fans)
  let m = 0.62 + (f.mood / 100) * 0.66
  if (f.boycottUntilMatchday >= matchday) m *= 0.55
  if (f.protestActive) m *= 0.85
  m *= 0.92 + f.loyalty / 800
  // soft + international ดึงตั๋ว/ทัวร์
  m *= 1 + f.factions.soft / 900 + f.factions.international / 700
  // ultras สูงมากแต่ประท้วง → ตั๋วตก
  if (f.factions.ultras > 75 && f.mood < 40) m *= 0.92
  return m
}

export function applyMatchToFans(
  fans: FanState,
  usGoals: number,
  themGoals: number,
  wasHome: boolean,
): FanState {
  const base = ensureFanState(fans)
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  const gd = usGoals - themGoals
  let delta = 0
  if (won) delta = 4 + Math.min(4, gd) + (wasHome ? 1 : 2)
  else if (drawn) delta = wasHome ? -1 : 1
  else delta = -5 - Math.min(4, -gd) - (wasHome ? 2 : 0)

  const pressure = (base.expectation - 50) / 50
  if (won) delta -= pressure * 1.5
  if (!won && !drawn) delta -= pressure * 3

  const cushion = base.loyalty / 200
  if (delta < 0) delta *= 1 - cushion

  const mood = clamp(base.mood + delta)
  let loyalty = base.loyalty
  if (won) loyalty = clamp(loyalty + 0.4)
  if (!won && !drawn && wasHome) loyalty = clamp(loyalty - 0.6)

  let verdict = base.lastVerdict
  if (won) verdict = wasHome ? 'อัฒจันทร์ระเบิด! ชนะในบ้าน' : 'แฟนบอลชื่นชมชัยชนะเยือน'
  else if (drawn) verdict = 'ผลเสมอทำให้แฟนงงๆ — อยากเห็นเกมชัดกว่านี้'
  else verdict = wasHome ? 'แพ้ในบ้าน — เสียงโห่ดังก้อง' : 'แพ้เยือน — แฟนเริ่มกังวลฟอร์ม'

  let protestActive = base.protestActive
  let lastEvent = base.lastEvent
  if (mood < 32 && !won && wasHome) {
    protestActive = true
    lastEvent = 'แฟนเริ่มประท้วงหลังเกมบ้าน'
  }
  if (mood >= 55) protestActive = false

  const fac = base.factions
  return {
    ...base,
    mood,
    loyalty,
    expectation: clamp(base.expectation + (won ? 1 : drawn ? 0 : -1)),
    factions: {
      ultras: clamp(fac.ultras + (won ? 3 : -4)),
      soft: clamp(fac.soft + (won ? 2 : drawn ? 0 : -1)),
      casual: clamp(fac.casual + (won ? 2 : drawn ? 0 : -2)),
      corporate: clamp(fac.corporate + (won ? 1 : drawn ? 0 : -1)),
      international: clamp(fac.international + (won && wasHome ? 2 : lostAway(wasHome, won) ? -1 : 0)),
    },
    lastVerdict: verdict,
    protestActive,
    lastEvent,
  }
}

function lostAway(wasHome: boolean, won: boolean) {
  return !wasHome && !won
}

export type TransferFanKind =
  | 'buy_star'
  | 'buy_squad'
  | 'buy_flop_risk'
  | 'sell_star'
  | 'sell_surplus'
  | 'sell_veteran'

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
  const base = ensureFanState(fans)
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

  const mood = clamp(base.mood + delta)
  let protestActive = base.protestActive
  let boycottUntilMatchday = base.boycottUntilMatchday
  let lastEvent = base.lastEvent
  if (kind === 'sell_star' && mood < 40) {
    protestActive = true
    boycottUntilMatchday = Math.max(boycottUntilMatchday, 0)
    lastEvent = `ประท้วงขายดาว ${playerName}`
  }

  const fac = base.factions
  return {
    fans: {
      ...base,
      mood,
      protestActive,
      boycottUntilMatchday,
      lastEvent: lastEvent || message,
      factions: {
        ultras: clamp(fac.ultras + (kind === 'sell_star' ? -8 : kind === 'buy_star' ? 5 : 0)),
        soft: clamp(fac.soft + (kind === 'sell_star' ? -3 : kind === 'buy_star' ? 2 : delta * 0.3)),
        casual: clamp(fac.casual + delta * 0.6),
        corporate: clamp(
          fac.corporate +
            (kind === 'sell_star' || kind === 'sell_surplus' ? 3 : kind === 'buy_star' ? -1 : 0),
        ),
        international: clamp(
          fac.international + (kind === 'buy_star' ? 3 : kind === 'sell_star' ? -2 : 0),
        ),
      },
      lastVerdict: message,
    },
    message,
  }
}

/** สุ่มเหตุการณ์แฟนหลังแมตช์เดย์ */
export function processFanPolitics(save: GameSave): GameSave {
  let fans = ensureFanState(save.fans)
  let inbox = save.inbox
  let board = save.board

  if (fans.mood < 28 && !fans.protestActive && Math.random() < 0.4) {
    fans = {
      ...fans,
      protestActive: true,
      boycottUntilMatchday: save.matchday + 1,
      lastEvent: 'กลุ่มหัวรุนแรงนัดประท้วงหน้าสโมสร · คว่ำบาตรตั๋วนัดหน้า',
    }
    inbox = [
      {
        id: `msg-protest-${Date.now()}`,
        date: save.currentDate,
        title: 'แฟนประท้วง',
        body: fans.lastEvent,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
    board = {
      ...board,
      confidence: Math.max(0, board.confidence - 3),
      lastNote: 'บอร์ดกังวลภาพลักษณ์จากประท้วงแฟน',
    }
  }

  // soft fans ขอ Family Day เมื่อ mood กลางๆ
  if (
    !fans.protestActive &&
    fans.factions.soft >= 65 &&
    fans.mood >= 45 &&
    fans.mood < 70 &&
    Math.random() < 0.12
  ) {
    fans = {
      ...fans,
      lastEvent: 'กลุ่มซอฟต์ร้องขอ Family Day / โซนเด็กในสนาม',
    }
    inbox = [
      {
        id: `msg-soft-${Date.now()}`,
        date: save.currentDate,
        title: 'คำขอจากแฟนครอบครัว',
        body: fans.lastEvent + ' — ไปเข้าหาที่หน้า Club Vision',
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  // international tourism interest
  if (fans.factions.international >= 60 && Math.random() < 0.1) {
    fans = {
      ...fans,
      lastEvent: 'ทัวร์ต่างชาติสนใจแพ็กเกจดูบอลบ้าน — โอกาสรายได้เสื้อ',
      factions: {
        ...fans.factions,
        international: clamp(fans.factions.international + 1),
      },
    }
  }

  if (fans.protestActive && fans.mood >= 50) {
    fans = {
      ...fans,
      protestActive: false,
      lastEvent: 'บรรยากาศอัฒจันทร์สงบลง',
    }
  }

  if (fans.boycottUntilMatchday < save.matchday && fans.boycottUntilMatchday >= 0) {
    fans = { ...fans, boycottUntilMatchday: -1 }
  }

  if (board.kpis?.some((k) => k.id === 'finance' && k.met) && Math.random() < 0.15) {
    fans = {
      ...fans,
      factions: {
        ...fans.factions,
        corporate: clamp(fans.factions.corporate + 2),
      },
      lastEvent: 'แฟนคอร์ปอเรตพอใจวินัยการเงิน',
    }
  }

  return { ...save, fans, board, inbox }
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
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  return { ...save, fans: ensureFanState(save.fans, club?.reputation ?? 50) }
}
