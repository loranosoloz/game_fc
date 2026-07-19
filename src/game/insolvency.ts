/**
 * วิกฤตสภาพคล่อง → Administration
 * ขั้น 1: liquidity crisis · ขั้น 2: administration (หักแต้ม · ห้ามซื้อ · fire sale)
 * ทางรอด: เจ้าของฉีดเงิน / เทคโอเวอร์เคลียร์หนี้
 */
import type { GameSave, InboxMessage, Player } from './types'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance, weeklyWageBillForClub } from './playerEconomy'
import { ensureOwner } from './owner'
import { ensureFanState } from './fans'
import { outstandingFeeCommitment } from './transferPayments'
import { ffpStatus } from './financeFfp'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

/** ประมาณค่าตัวแบบเบา — เลี่ยง circular import กับ transfer.ts */
function roughPlayerValue(player: Player): number {
  const ageFactor = player.age <= 24 ? 1.25 : player.age <= 29 ? 1.0 : player.age <= 32 ? 0.7 : 0.45
  const years = player.contractYears ?? 0
  let v = Math.round(player.overall ** 2 * 900 * ageFactor)
  if (years <= 0) v = Math.round(v * 0.15)
  else if (years === 1) v = Math.round(v * 0.45)
  return Math.max(50_000, v)
}

export type InsolvencyStage = 'ok' | 'liquidity_crisis' | 'administration'

export interface ClubInsolvencyState {
  stage: InsolvencyStage
  /** MD ที่ติดลบ/ค้างจ่ายติดต่อกัน */
  negativeStreak: number
  /** ค้างค่าเหนื่อยสะสม (บาท) */
  unpaidWages: number
  /** ครั้งที่เลื่อนจ่ายค่าเหนื่อย */
  wageDeferCount: number
  /** หักแต้มไปแล้วกี่ครั้งในฤดูกาลนี้ */
  pointsDeductedThisSeason: number
  adminSinceSeason: number | null
  adminSinceMatchday: number | null
  /** บังคับขาย */
  fireSalePlayerIds: string[]
  /** ห้ามซื้อจนถึง MD นี้ (-1 = ไม่แช่) */
  transferEmbargoUntil: number
  lastNote: string
  lastEventMatchday: number
}

export function createInsolvencyState(): ClubInsolvencyState {
  return {
    stage: 'ok',
    negativeStreak: 0,
    unpaidWages: 0,
    wageDeferCount: 0,
    pointsDeductedThisSeason: 0,
    adminSinceSeason: null,
    adminSinceMatchday: null,
    fireSalePlayerIds: [],
    transferEmbargoUntil: -1,
    lastNote: 'การเงินปกติ',
    lastEventMatchday: -1,
  }
}

export function ensureInsolvency(save: GameSave): ClubInsolvencyState {
  const raw = save.insolvency
  if (!raw) return createInsolvencyState()
  return { ...createInsolvencyState(), ...raw }
}

export function isInsolvencyEmbargo(save: GameSave): boolean {
  const inv = ensureInsolvency(save)
  if (inv.stage === 'administration') return true
  if (inv.transferEmbargoUntil >= 0 && save.matchday <= inv.transferEmbargoUntil) return true
  return false
}

export function insolvencyLabelTh(stage: InsolvencyStage): string {
  if (stage === 'administration') return 'Administration (พิทักษ์ทรัพย์)'
  if (stage === 'liquidity_crisis') return 'วิกฤตสภาพคล่อง'
  return 'ปกติ'
}

function dockLeaguePoints(save: GameSave, clubId: string, pts: number): GameSave {
  const club = save.clubs.find((c) => c.id === clubId)
  const div = club?.division ?? 1
  const key = div === 2 ? 'tableDiv2' : 'table'
  const table = [...(save[key] ?? [])]
  const idx = table.findIndex((r) => r.clubId === clubId)
  if (idx < 0) return save
  const row = table[idx]!
  table[idx] = { ...row, points: Math.max(0, row.points - pts) }
  return { ...save, [key]: table }
}

function pickFireSaleTargets(save: GameSave, needCash: number): string[] {
  const squad = save.players
    .filter((p) => p.clubId === save.humanClubId && !p.loanParentClubId)
    .map((p) => ({ p, v: roughPlayerValue(p) }))
    .sort((a, b) => b.v - a.v)

  const ids: string[] = []
  let raised = 0
  for (const row of squad) {
    if (row.p.squadRole === 'prospect' && raised > needCash * 0.3) continue
    ids.push(row.p.id)
    raised += Math.round(row.v * 0.75)
    if (ids.length >= 5 || raised >= needCash) break
  }
  return ids
}

/**
 * หลังจ่ายค่าเหนื่อยรายสัปดาห์ — ประเมินวิกฤต / เข้าแอดมิน / fire sale
 */
export function tickInsolvency(save: GameSave): GameSave {
  let inv = ensureInsolvency(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  if (!club) return { ...save, insolvency: inv }

  const wagesDue = weeklyWageBillForClub(save.players, club.id, save.loans)
  const installmentsDue = outstandingFeeCommitment(save, club.id)
  const ffp = ffpStatus(save)
  const overdueInstallments = (save.transferDesk?.feeInstallments ?? []).filter(
    (i) =>
      i.fromClubId === save.humanClubId &&
      (i.status === 'overdue' || (i.status === 'pending' && i.dueSeason <= save.season)),
  ).length

  let clubs = save.clubs
  let players = save.players
  let unpaid = inv.unpaidWages
  let deferCount = inv.wageDeferCount
  let inbox: InboxMessage[] = [...save.inbox]
  const notes: string[] = []
  let next: GameSave = save

  if (club.balance < 0 && wagesDue > 0) {
    unpaid += Math.min(wagesDue, Math.abs(Math.min(0, club.balance)))
    deferCount += 1
    players = players.map((p) => {
      if (p.clubId !== save.humanClubId) return p
      return {
        ...p,
        morale: Math.max(1, p.morale - 1),
        happiness: Math.max(1, (p.happiness ?? 10) - 1),
      }
    })
    notes.push(`เลื่อนภาระค่าเหนื่อย · ค้างสะสม ~${formatMoney(unpaid)}`)
  } else if (club.balance > wagesDue * 2 && unpaid > 0) {
    const payBack = Math.min(unpaid, Math.floor(club.balance * 0.25))
    if (payBack > 0) {
      clubs = clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - payBack } : c,
      )
      unpaid = Math.max(0, unpaid - payBack)
      notes.push(`ชำระค้างค่าเหนื่อย ${formatMoney(payBack)}`)
    }
  }

  let negativeStreak = inv.negativeStreak
  if (club.balance < 0 || unpaid > wagesDue * 2 || overdueInstallments >= 2) {
    negativeStreak += 1
  } else if (club.balance > 0 && unpaid <= 0) {
    negativeStreak = Math.max(0, negativeStreak - 1)
  }

  let stage = inv.stage
  let pointsDeducted = inv.pointsDeductedThisSeason
  let fireSale = [...inv.fireSalePlayerIds]
  let embargoUntil = inv.transferEmbargoUntil
  let adminSinceSeason = inv.adminSinceSeason
  let adminSinceMatchday = inv.adminSinceMatchday

  if (
    stage === 'ok' &&
    (negativeStreak >= 2 ||
      unpaid >= wagesDue * 3 ||
      (club.balance < -club.wageBudgetWeekly * 4 && club.balance < -500_000) ||
      (!ffp.ok && club.balance < 0))
  ) {
    stage = 'liquidity_crisis'
    embargoUntil = save.matchday + 4
    notes.push('เข้าสู่วิกฤตสภาพคล่อง — ห้ามซื้อชั่วคราว')
    inbox = [
      {
        id: uid('msg-liq'),
        date: save.currentDate,
        title: 'วิกฤตสภาพคล่อง',
        body: 'บัญชีติดลบ/ค้างจ่าย — ระงับตลาดซื้อ · เร่งขายหรือขอเจ้าของฉีดเงิน',
        read: false,
      },
      ...inbox,
    ]
  }

  let dock = 0
  if (
    stage === 'liquidity_crisis' &&
    (negativeStreak >= 4 ||
      unpaid >= wagesDue * 6 ||
      club.balance < -Math.max(2_000_000, club.seasonStartBalance * 0.35) ||
      (overdueInstallments >= 3 && club.balance < 0))
  ) {
    stage = 'administration'
    adminSinceSeason = save.season
    adminSinceMatchday = save.matchday
    dock = pointsDeducted === 0 ? 10 : pointsDeducted === 1 ? 2 : 0
    if (dock > 0) {
      next = dockLeaguePoints({ ...save, clubs, players }, save.humanClubId, dock)
      clubs = next.clubs
      players = next.players
      pointsDeducted += 1
      notes.push(`หัก ${dock} แต้มลีก (Administration)`)
    }
    const need = Math.max(
      3_000_000,
      unpaid + Math.abs(Math.min(0, club.balance)) + installmentsDue * 0.5,
    )
    fireSale = pickFireSaleTargets({ ...next, clubs, players }, need)
    players = players.map((p) =>
      fireSale.includes(p.id)
        ? {
            ...p,
            transferListed: true,
            transferListMinFee: Math.round(roughPlayerValue(p) * 0.7),
            wantAway: {
              active: true,
              intensity: 14,
              publicNews: true,
              refuseCount: 0,
              sinceMatchday: save.matchday,
              reasonTh: 'Fire sale — สโมสรอยู่ใน Administration',
              boardForced: true,
            },
          }
        : p,
    )
    embargoUntil = 9999
    notes.push(`เข้า Administration · Fire sale ${fireSale.length} คน`)
    inbox = [
      {
        id: uid('msg-admin'),
        date: save.currentDate,
        title: 'Administration — พิทักษ์ทรัพย์',
        body: `สโมสรเข้าสู่กระบวนการพิทักษ์ทรัพย์${dock > 0 ? ` · หัก ${dock} แต้มลีก` : ''} · ห้ามซื้อ · บังคับขายนักเตะมูลค่าสูง · ขอเจ้าของฉีดเงินหรือเปิดทางเทคโอเวอร์`,
        read: false,
      },
      ...inbox,
    ]
  }

  if (
    stage === 'liquidity_crisis' &&
    club.balance >= wagesDue * 3 &&
    unpaid <= 0 &&
    negativeStreak <= 0 &&
    overdueInstallments === 0
  ) {
    stage = 'ok'
    embargoUntil = -1
    notes.push('พ้นวิกฤตสภาพคล่อง')
    inbox = [
      {
        id: uid('msg-liq-ok'),
        date: save.currentDate,
        title: 'พ้นวิกฤตสภาพคล่อง',
        body: 'กระแสเงินกลับมาเสถียร — ตลาดซื้อเปิดตามหน้าต่างปกติ (ยังต้องระวัง FFP)',
        read: false,
      },
      ...inbox,
    ]
  }

  if (stage === 'administration') {
    fireSale = fireSale.filter((id) => {
      const p = players.find((x) => x.id === id)
      return p && p.clubId === save.humanClubId
    })
    // ฟื้นเองถ้าขายเคลียร์ + บัญชีแข็งแรง
    if (
      club.balance >= wagesDue * 4 &&
      unpaid <= 0 &&
      fireSale.length === 0 &&
      overdueInstallments === 0
    ) {
      stage = 'ok'
      embargoUntil = -1
      adminSinceSeason = null
      adminSinceMatchday = null
      notes.push('พ้น Administration ด้วยตัวเองหลังแก้สภาพคล่อง')
      inbox = [
        {
          id: uid('msg-admin-ok'),
          date: save.currentDate,
          title: 'พ้น Administration',
          body: 'ลีกถอนสถานะพิทักษ์ทรัพย์ — บัญชีและหนี้กลับสู่เกณฑ์ · ตลาดซื้อเปิดตามหน้าต่างปกติ',
          read: false,
        },
        ...inbox,
      ]
    } else if (
      pointsDeducted < 2 &&
      club.balance < -Math.max(4_000_000, club.seasonStartBalance * 0.5) &&
      save.matchday - (adminSinceMatchday ?? save.matchday) >= 6
    ) {
      next = dockLeaguePoints({ ...next, clubs, players }, save.humanClubId, 2)
      clubs = next.clubs
      players = next.players
      pointsDeducted = 2
      notes.push('หักเพิ่ม 2 แต้ม — การเงินยังทรุด')
      inbox = [
        {
          id: uid('msg-admin-pts'),
          date: save.currentDate,
          title: 'หักแต้มเพิ่ม (Administration)',
          body: 'ลีกสั่งหักเพิ่ม 2 แต้ม เนื่องจากยังไม่แก้วิกฤตการเงิน',
          read: false,
        },
        ...inbox,
      ]
    }
  }

  inv = {
    stage,
    negativeStreak,
    unpaidWages: Math.round(unpaid),
    wageDeferCount: deferCount,
    pointsDeductedThisSeason: pointsDeducted,
    adminSinceSeason,
    adminSinceMatchday,
    fireSalePlayerIds: fireSale,
    transferEmbargoUntil: embargoUntil,
    lastNote: notes.length ? notes.join(' · ') : inv.lastNote,
    lastEventMatchday: notes.length ? save.matchday : inv.lastEventMatchday,
  }

  // กดดันเทคโอเวอร์เมื่อวิกฤต
  let owner = save.owner
  if (stage !== 'ok' && owner) {
    const heatBump = stage === 'administration' ? 8 : 4
    owner = {
      ...ensureOwner({ ...save, clubs, players }),
      takeoverHeat: Math.min(100, (owner.takeoverHeat ?? 0) + heatBump),
      lastNote:
        stage === 'administration'
          ? `Administration · war chest กดดัน · ${inv.lastNote}`
          : `วิกฤตสภาพคล่อง · ${inv.lastNote}`,
    }
  }

  return {
    ...next,
    clubs,
    players,
    owner: owner ?? next.owner,
    insolvency: inv,
    inbox: inbox.slice(0, 45),
  }
}

/** เจ้าของฉีดเงินกู้วิกฤต */
export function requestOwnerBailout(
  save: GameSave,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const inv = ensureInsolvency(save)
  if (inv.stage === 'ok') {
    return { ok: false, message: 'ยังไม่วิกฤต — เจ้าของไม่ฉีดเงินฟรี' }
  }
  const owner = ensureOwner(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const need = Math.max(
    2_000_000,
    inv.unpaidWages + Math.abs(Math.min(0, club.balance)) + club.wageBudgetWeekly * 8,
  )

  const frugal = owner.personality === 'frugal'
  const willing =
    owner.warChest >= need * (frugal ? 1.1 : 0.85) &&
    (inv.stage === 'administration' || owner.relationship >= 40 || owner.patience >= 45)

  if (!willing) {
    return {
      ok: false,
      message: `เจ้าของ (${owner.name}) ปฏิเสธ — war chest ${formatMoney(owner.warChest)} · ต้องการ ~${formatMoney(need)} หรือเปิดทางเทคโอเวอร์`,
    }
  }

  const inject = Math.min(owner.warChest, Math.round(need * 1.05))
  const players = save.players.map((p) => {
    if (!inv.fireSalePlayerIds.includes(p.id)) return p
    return {
      ...p,
      transferListed: false,
      transferListMinFee: null,
      wantAway: p.wantAway?.boardForced ? null : p.wantAway,
      morale: Math.min(20, p.morale + 1),
    }
  })

  const nextInv: ClubInsolvencyState = {
    ...createInsolvencyState(),
    lastNote: `เจ้าของฉีดเงิน ${formatMoney(inject)} — พ้น ${insolvencyLabelTh(inv.stage)}`,
    lastEventMatchday: save.matchday,
    pointsDeductedThisSeason: inv.pointsDeductedThisSeason,
  }

  const fans = ensureFanState(save.fans)

  return {
    ok: true,
    message: `${owner.name} ฉีด ${formatMoney(inject)} — พ้น ${insolvencyLabelTh(inv.stage)}`,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === save.humanClubId ? { ...c, balance: c.balance + inject } : c,
      ),
      players,
      owner: {
        ...owner,
        warChest: Math.max(0, owner.warChest - inject),
        relationship: Math.min(100, owner.relationship + 4),
        takeoverHeat: Math.max(0, owner.takeoverHeat - 15),
        lastNote: `ฉีดเงินกู้วิกฤต ${formatMoney(inject)}`,
      },
      insolvency: nextInv,
      clubFinance: {
        ...ensureClubFinance(save),
        ledger: [
          {
            id: uid('led-bail'),
            date: save.currentDate,
            kind: 'other' as const,
            amount: inject,
            note: `เจ้าของฉีดเงินกู้วิกฤต`,
          },
          ...ensureClubFinance(save).ledger,
        ].slice(0, 50),
      },
      fans: {
        ...fans,
        mood: Math.min(100, fans.mood + 5),
        lastEvent: 'เจ้าของฉีดเงินกู้สโมสร',
      },
      inbox: [
        {
          id: uid('msg-bail'),
          date: save.currentDate,
          title: 'เจ้าของฉีดเงินกู้วิกฤต',
          body: `${owner.name} โอน ${formatMoney(inject)} · ยกเลิก fire sale · เปิดตลาดตามหน้าต่างปกติ`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** หลังเทคโอเวอร์สำเร็จ — เคลียร์แอดมิน */
export function clearInsolvencyAfterTakeover(save: GameSave, injectHint = 0): GameSave {
  const inv = ensureInsolvency(save)
  if (inv.stage === 'ok' && !inv.fireSalePlayerIds.length) return save
  return {
    ...save,
    insolvency: {
      ...createInsolvencyState(),
      lastNote: `พ้นวิกฤตหลังเทคโอเวอร์${injectHint ? ` · ฉีด ~${formatMoney(injectHint)}` : ''}`,
      lastEventMatchday: save.matchday,
      pointsDeductedThisSeason: inv.pointsDeductedThisSeason,
    },
    players: save.players.map((p) =>
      inv.fireSalePlayerIds.includes(p.id)
        ? {
            ...p,
            transferListed: false,
            wantAway: p.wantAway?.reasonTh?.includes('Fire sale') ? null : p.wantAway,
          }
        : p,
    ),
    inbox: [
      {
        id: uid('msg-to-clear'),
        date: save.currentDate,
        title: 'พ้น Administration',
        body: 'โครงสร้างเจ้าของใหม่เคลียร์หนี้วิกฤต — ตลาดกลับสู่ภาวะปกติ',
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

export function rollInsolvencyForNewSeason(save: GameSave): ClubInsolvencyState {
  const inv = ensureInsolvency(save)
  if (inv.stage === 'administration') {
    return {
      ...inv,
      pointsDeductedThisSeason: 0,
      lastNote: 'ยังอยู่ใน Administration ข้ามฤดูกาล',
    }
  }
  if (inv.stage === 'liquidity_crisis') {
    return {
      ...inv,
      pointsDeductedThisSeason: 0,
      negativeStreak: Math.max(1, inv.negativeStreak - 1),
    }
  }
  return createInsolvencyState()
}

export function insolvencyBlocksBuying(save: GameSave): string | null {
  const inv = ensureInsolvency(save)
  if (inv.stage === 'administration') {
    return 'Administration — ห้ามซื้อนักเตะจนกว่าจะพ้นวิกฤต (ฉีดเงินเจ้าของ / เทคโอเวอร์ / ขายเคลียร์หนี้)'
  }
  if (inv.stage === 'liquidity_crisis' || isInsolvencyEmbargo(save)) {
    return 'วิกฤตสภาพคล่อง — ระงับตลาดซื้อชั่วคราว'
  }
  return null
}
