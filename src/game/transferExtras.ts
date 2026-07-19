/**
 * ระบบเสริมตลาด: เวลาลงตามสัญญา · เมดิคอล · ทะเบียนสควอด · ROFR ตอนขาย · สุภาพบุรุษ/คู่แข่ง
 */
import type { GameSave, Player, SquadStatusGuarantee } from './types'
import { formatMoney } from '@/lib/format'
import { injuryHistoryPenalty } from './medical'
import { playerNationality } from './nationalTeams'
import { areRivals, getRivalClubIds } from './rivalries'
import { recordHatredWhileAtClub } from './fans'
import { squadStatusPlayShare, mapSquadRoleToStatus } from './transferAdvanced'
import nationalDb from '@/data/nationalTeams.json'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

const LEAGUE_DOMESTIC = (nationalDb as { leagueDomestic?: Record<string, string> }).leagueDomestic ?? {
  eng: 'England',
  esp: 'Spain',
  ger: 'Germany',
  fra: 'France',
  ita: 'Italy',
}

/** สัญชาติในโซนยุโรป (นับเป็น EU สำหรับโควตา) */
const EU_NATIONS = new Set([
  'England',
  'Scotland',
  'Wales',
  'Ireland',
  'Northern Ireland',
  'Spain',
  'Germany',
  'France',
  'Italy',
  'Portugal',
  'Netherlands',
  'Belgium',
  'Denmark',
  'Sweden',
  'Norway',
  'Austria',
  'Switzerland',
  'Croatia',
  'Serbia',
  'Poland',
  'Czech Republic',
  'Czechia',
  'Hungary',
  'Romania',
  'Greece',
  'Turkey',
  'Ukraine',
  'Bosnia',
  'Kosovo',
  'Finland',
  'Iceland',
  'Slovenia',
  'Slovakia',
])

// ——— 1) Playing time vs contracted status ———

export function tickContractedPlayingTime(save: GameSave): GameSave {
  const md = Math.max(1, save.matchday)
  const notes: string[] = []
  let players = save.players.map((p) => {
    if (p.clubId !== save.humanClubId) return p
    const status: SquadStatusGuarantee =
      p.contractedSquadStatus ?? mapSquadRoleToStatus(p.squadRole)
    const expectShare = squadStatusPlayShare(status)
    // ประมาณ: XI = 90 นาที/MD · คาดหวังเทียบ matchday
    const expectedMin = expectShare * md * 90
    const actual = p.minutesPlayed ?? 0
    if (md < 4) return p // เริ่มฤดูกาลยังไม่โวย
    if (expectedMin < 180) return p // prospect/impact ไม่กดดันเร็ว

    const ratio = actual / Math.max(1, expectedMin)
    if (ratio >= 0.75) {
      // พอใจเล็กน้อย
      if (ratio >= 1 && status === 'star') {
        return {
          ...p,
          happiness: clamp((p.happiness ?? 10) + 1, 1, 20),
          morale: clamp(p.morale + 1, 1, 20),
        }
      }
      return p
    }

    // ลงน้อยกว่าสัญญา
    const harsh = status === 'star' || status === 'regular'
    const dropH = harsh ? (ratio < 0.45 ? 3 : 2) : 1
    const dropM = harsh ? 2 : 1
    let next: Player = {
      ...p,
      happiness: clamp((p.happiness ?? 10) - dropH, 1, 20),
      morale: clamp(p.morale - dropM, 1, 20),
    }

    if (harsh && ratio < 0.5 && md >= 6) {
      const intensity = Math.min(20, (p.wantAway?.intensity ?? 5) + (status === 'star' ? 4 : 2))
      next = {
        ...next,
        wantAway: {
          active: true,
          intensity,
          publicNews: intensity >= 14 || (p.wantAway?.publicNews ?? false),
          refuseCount: p.wantAway?.refuseCount ?? 0,
          sinceMatchday: p.wantAway?.sinceMatchday ?? save.matchday,
          reasonTh: `ไม่ได้ลงตามการันตีสถานะ「${status}」`,
          boardForced: p.wantAway?.boardForced,
        },
      }
      notes.push(
        `${p.name}: ลง ${Math.round(actual)}น. จากเป้า ~${Math.round(expectedMin)}น. (${status})`,
      )
    }
    return next
  })

  if (!notes.length) return { ...save, players }

  let nextSave: GameSave = {
    ...save,
    players,
    inbox: [
      {
        id: uid('msg-pt'),
        date: save.currentDate,
        title: 'เอเยนต์โวยเรื่องเวลาลงเล่น',
        body: `นักเตะไม่ได้รับการันตีสถานะในสัญญา: ${notes.slice(0, 6).join(' · ')}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }

  for (const name of notes.slice(0, 3)) {
    const p = players.find((x) => name.startsWith(x.name))
    if (!p) continue
    nextSave = recordHatredWhileAtClub(
      nextSave,
      save.humanClubId,
      p,
      'want_away',
      'ไม่ได้ลงตามสัญญา — แฟนเริ่มไม่พอใจการบริหาร',
    )
  }
  return nextSave
}

// ——— 2) ROFR เมื่อมีคนยื่นซื้อนักเตะที่คุณเคยขาย ———

export type RofrSellGate =
  | { ok: true; save: GameSave }
  | { ok: false; message: string; save: GameSave }

/**
 * ก่อนปิดขายให้ AI — ถ้า human ถือ ROFR ให้สร้างข้อเสนอรอตัดสินใจแทนการขายทันที
 */
export function gateSellWithHumanRofr(
  save: GameSave,
  playerId: string,
  askFee: number,
  buyerClubId: string,
): RofrSellGate {
  const player = save.players.find((p) => p.id === playerId)
  if (!player?.firstRefusalClubId) return { ok: true, save }
  if (player.firstRefusalClubId !== save.humanClubId) return { ok: true, save }
  // ขายจากคลับอื่นที่มี ROFR ของเรา — ใน sellPlayerToAi เรามักขายของตัวเอง
  // เคสสำคัญ: เราไม่ใช่เจ้าของปัจจุบัน แต่ ROFR ติดนักเตะ → ต้องเกิดตอน AI ซื้อจาก AI
  // สำหรับ sell จาก human: ROFR ของเราเองไม่บล็อก
  if (player.clubId === save.humanClubId) return { ok: true, save }

  const desk = save.transferDesk ?? { offers: [], auctions: [], clauses: [], feeInstallments: [] }
  const buyer = save.clubs.find((c) => c.id === buyerClubId)
  const offer = {
    id: uid('rofr'),
    kind: 'buy' as const,
    playerId,
    fromClubId: player.clubId,
    toClubId: save.humanClubId,
    fee: askFee,
    wage: Math.round(player.wage * 1.05),
    contractYears: 3,
    appearanceAddon: 0,
    sellOnPercent: 0,
    status: 'pending' as const,
    expiresMatchday: save.matchday + 2,
    note: `ROFR: ${buyer?.shortName ?? 'ทีมอื่น'} ยื่น ${formatMoney(askFee)} — แมตช์ราคาดึง ${player.name} กลับได้`,
    isRofrMatch: true,
  }

  return {
    ok: false,
    message: `ROFR: รอคุณตัดสินใจแมตช์ราคา ${player.name}`,
    save: {
      ...save,
      transferDesk: {
        ...desk,
        offers: [offer, ...(desk.offers ?? [])].slice(0, 30),
      },
      inbox: [
        {
          id: uid('msg-rofr-bid'),
          date: save.currentDate,
          title: `สิทธิ์ปฏิเสธครั้งแรก: ${player.name}`,
          body: offer.note,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** AI พยายามซื้อนักเตะที่ human มี ROFR (จากคลับปัจจุบัน) */
export function offerRofrMatchToHuman(
  save: GameSave,
  playerId: string,
  askFee: number,
  bidderClubId: string,
): GameSave {
  const gate = gateSellWithHumanRofr(save, playerId, askFee, bidderClubId)
  return gate.save
}

export function acceptRofrMatchOffer(
  save: GameSave,
  offerId: string,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const desk = save.transferDesk
  const offer = desk?.offers.find((o) => o.id === offerId && o.isRofrMatch && o.status === 'pending')
  if (!offer) return { ok: false, message: 'ไม่พบข้อเสนอ ROFR' }

  // ซื้อด้วยราคาแมตช์ — เรียก buy จากภายนอกผ่าน store; ที่นี่เตรียม clear ROFR แล้วให้ store ซื้อ
  const player = save.players.find((p) => p.id === offer.playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }

  return {
    ok: true,
    message: `รับ ROFR · แมตช์ ${formatMoney(offer.fee)} สำหรับ ${player.name}`,
    save: {
      ...save,
      players: save.players.map((p) =>
        p.id === offer.playerId ? { ...p, firstRefusalClubId: null } : p,
      ),
      transferDesk: {
        ...desk!,
        offers: desk!.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'accepted' as const } : o,
        ),
      },
    },
  }
}

export function declineRofrMatchOffer(
  save: GameSave,
  offerId: string,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const desk = save.transferDesk
  const offer = desk?.offers.find((o) => o.id === offerId && o.isRofrMatch && o.status === 'pending')
  if (!offer) return { ok: false, message: 'ไม่พบข้อเสนอ ROFR' }
  return {
    ok: true,
    message: 'ปล่อยผ่าน ROFR — ทีมอื่นซื้อต่อได้',
    save: {
      ...save,
      players: save.players.map((p) =>
        p.id === offer.playerId ? { ...p, firstRefusalClubId: null } : p,
      ),
      transferDesk: {
        ...desk!,
        offers: desk!.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
      },
      inbox: [
        {
          id: uid('msg-rofr-pass'),
          date: save.currentDate,
          title: 'ROFR ปล่อยผ่าน',
          body: offer.note,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

// ——— 3) Medical exam ———

export type MedicalExamResult = {
  ok: boolean
  grade: 'clear' | 'caution' | 'fail'
  feeMul: number
  message: string
  forceInsurance?: number
}

export function runTransferMedical(player: Player): MedicalExamResult {
  const hist = player.injuryHistory?.length ?? 0
  const days = player.injuryDays ?? 0
  const penalty = injuryHistoryPenalty(player)
  const fragile = (player.growth?.injuryProneness ?? 10) >= 14

  if (days > 14 || (hist >= 4 && penalty < 0.85)) {
    return {
      ok: false,
      grade: 'fail',
      feeMul: 0,
      message: `เมดิคอลไม่ผ่าน — ประวัติเจ็บหนัก / ยังพักยาว (${days} วัน)`,
    }
  }
  if (days > 0 || hist >= 2 || fragile || penalty < 0.92) {
    const mul = Math.max(0.72, Math.min(0.92, penalty * (fragile ? 0.9 : 0.95)))
    return {
      ok: true,
      grade: 'caution',
      feeMul: mul,
      message: `เมดิคอลผ่านแบบมีเงื่อนไข — แนะนำลดค่าตัว ~${Math.round((1 - mul) * 100)}% หรือใส่ประกัน`,
      forceInsurance: Math.round((player.wage ?? 10000) * 20),
    }
  }
  return {
    ok: true,
    grade: 'clear',
    feeMul: 1,
    message: 'เมดิคอลผ่านสะอาด',
  }
}

// ——— 4) Squad registration ———

export type SquadRegStatus = {
  total: number
  maxTotal: number
  nonEu: number
  maxNonEu: number
  homeGrown: number
  minHomeGrown: number
  ok: boolean
  reason: string
}

export function isEuNationality(nation: string): boolean {
  return EU_NATIONS.has(nation)
}

export function isHomeGrownPlayer(player: Player, save: GameSave, clubId: string): boolean {
  if (player.isYouth) return true
  const club = save.clubs.find((c) => c.id === clubId)
  const lid = club?.originLeagueId ?? save.leagueId ?? 'eng'
  const domestic = LEAGUE_DOMESTIC[lid] ?? 'England'
  const nat = playerNationality(player, save)
  if (nat === domestic) return true
  // ดาวรุ่งอายุน้อยที่คลับนานโดยประมาณ
  if (player.age <= 21 && player.squadRole === 'prospect') return true
  return false
}

export function squadRegistrationStatus(save: GameSave, clubId?: string): SquadRegStatus {
  const id = clubId ?? save.humanClubId
  const squad = save.players.filter((p) => p.clubId === id && !p.loanParentClubId)
  // ยืมเข้า นับในทะเบียน
  const loanedIn = save.players.filter((p) => p.clubId === id && p.loanParentClubId)
  const all = [...squad, ...loanedIn]
  const maxTotal = 25
  const maxNonEu = 17 // ผ่อนปรนจากจริง — เกมเล่นง่ายขึ้น
  const minHomeGrown = 8

  let nonEu = 0
  let homeGrown = 0
  for (const p of all) {
    const nat = playerNationality(p, save)
    if (!isEuNationality(nat)) nonEu++
    if (isHomeGrownPlayer(p, save, id)) homeGrown++
  }

  const total = all.length
  let ok = true
  let reason = `ทะเบียน ${total}/${maxTotal} · นอกยุโรป ${nonEu}/${maxNonEu} · HG ${homeGrown}/${minHomeGrown}`
  if (total > maxTotal) {
    ok = false
    reason = `สควอดเต็ม ${total}/${maxTotal} — ต้องปล่อย/ยืมออกก่อนซื้อเพิ่ม`
  } else if (nonEu > maxNonEu) {
    ok = false
    reason = `โควตานอกยุโรปเต็ม ${nonEu}/${maxNonEu}`
  } else if (homeGrown < minHomeGrown && total >= 18) {
    // เตือนเมื่อสควอดใหญ่แต่ HG น้อย — บล็อกถ้าจะซื้อคนนอกและ HG ต่ำมาก
    if (homeGrown < 5) {
      ok = false
      reason = `Home-grown ต่ำเกินไป (${homeGrown}/${minHomeGrown}) — ซื้อคนนอกยุโรป/นอกสมาคมไม่ได้`
    }
  }

  return { total, maxTotal, nonEu, maxNonEu, homeGrown, minHomeGrown, ok, reason }
}

/** ตรวจก่อนซื้อ/ยืมเข้า — canAdd=ผู้เล่นใหม่จะนับยังไง */
export function canRegisterIncoming(
  save: GameSave,
  incoming: Player,
): { ok: true } | { ok: false; reason: string } {
  const status = squadRegistrationStatus(save)
  if (status.total >= status.maxTotal) {
    return { ok: false, reason: status.reason }
  }
  const nat = playerNationality(incoming, save)
  const wouldNonEu = status.nonEu + (isEuNationality(nat) ? 0 : 1)
  if (wouldNonEu > status.maxNonEu) {
    return { ok: false, reason: `โควตานอกยุโรปจะเต็ม (${wouldNonEu}/${status.maxNonEu})` }
  }
  const wouldHg = status.homeGrown + (isHomeGrownPlayer(incoming, save, save.humanClubId) ? 1 : 0)
  if (
    !isHomeGrownPlayer(incoming, save, save.humanClubId) &&
    status.total >= 18 &&
    wouldHg < 5 &&
    status.homeGrown < 5
  ) {
    return {
      ok: false,
      reason: `Home-grown ไม่พอ (${status.homeGrown}/${status.minHomeGrown}) — รับคนนอกสมาคมไม่ได้`,
    }
  }
  return { ok: true }
}

// ——— 5) Gentlemen / rival sell ———

export type RivalSellPolicy = 'block' | 'allow_with_hatred' | 'ok'

export function rivalSellCheck(
  save: GameSave,
  buyerClubId: string,
  opts?: { allowToRival?: boolean },
): { policy: RivalSellPolicy; message: string; rivalIds: string[] } {
  const rivals = getRivalClubIds(save, save.humanClubId)
  if (!areRivals(save, save.humanClubId, buyerClubId)) {
    return { policy: 'ok', message: '', rivalIds: rivals }
  }
  if (opts?.allowToRival) {
    return {
      policy: 'allow_with_hatred',
      message: 'ขายให้คู่แข่ง — แฟนจะเกลียดมาก (สุภาพบุรุษถูกทำลาย)',
      rivalIds: rivals,
    }
  }
  return {
    policy: 'block',
    message: `บอร์ด/แฟนบล็อกขายให้คู่แข่ง — ติ๊ก「ฝ่าฝืนสุภาพบุรุษ」ถ้ายืนยัน`,
    rivalIds: rivals,
  }
}
