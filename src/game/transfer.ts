import type { Club, ContractNegotiation, ContractTalkState, GameSave, InboxMessage, Player, Tactics } from './types'
import { autoPickTactics } from './seed'
import { formatMoney } from '@/lib/format'
import {
  applyTransferToFans,
  classifyTransferForFans,
  ensureFans,
  fanInbox,
  recordHatredAfterLeave,
  recordHatredWhileAtClub,
  syncHumanFansToClub,
} from './fans'
import { applyFfpBreachSanction, canAffordTransfer } from './financeFfp'
import { ensureClubFinance } from './playerEconomy'
import { newsAfterTransfer, newsAfterContract, pushNews } from './media'
import { injuryHistoryPenalty } from './medical'
import { ensureScouting, markPlayerAsAlumni } from './scouting'
import { isTransferFrozen } from './clubAtmosphere'
import { isTransferWindowOpen, transferWindowKind, transferWindowLabel } from './transferWindow'
import { insolvencyBlocksBuying, ensureInsolvency } from './insolvency'
import { appendPlayerMove } from './playerWorldDb'
import {
  attachClausesAfterBuy,
  emptyAddonPackage,
  settleSellOnClauses,
} from './transferClauses'
import {
  attachFeeInstallments,
  buildFeePaymentSchedule,
  describePaymentScheduleTh,
  sellerPresentValue,
} from './transferPayments'
import {
  agentAskMul,
  agentFeeMul,
  agentKindFeeMul,
  agentStyleFor,
  agentWalkHarder,
  AGENT_STYLE_LABEL,
} from './agents'
import {
  counterAsks,
  findStickingPoints,
  negotiationProfile,
  roundNoteTh,
  seedContractBonusAsks,
  stickingDetailTh,
  type ContractBonusOffer,
} from './contractNegotiation'
import {
  agentRapportOf,
  bumpAgentRapport,
  bumpPlayerRapport,
  isReleaseClauseKnown,
  markReleaseClauseKnown,
  playerRapportOf,
} from './releaseClauseIntel'
import { analyzeBuy } from './transferIntel'
import { resolveRofrForAi } from './transferAdvanced'
import {
  canRegisterIncoming,
  rivalSellCheck,
  runTransferMedical,
} from './transferExtras'
import { heatRivalry } from './rivalries'
import {
  affinityWageMul,
  clubDesireScore,
  isAvoidClub,
  renewAffinityWageMul,
  sellerBlocksBuyer,
  withEnsuredAffinity,
} from './playerAmbition'
import { rollingFormHints, rollingFormMarketMul } from './contractLifecycle'
import {
  ensureClubLoyalty,
  loyaltyRefuseRenewChanceMul,
  loyaltyRenewWageMul,
  resetLoyaltyOnTransfer,
} from './playerLoyalty'

export function estimatedValue(player: Player, save?: GameSave): number {
  const ageFactor = player.age <= 24 ? 1.25 : player.age <= 29 ? 1.0 : player.age <= 32 ? 0.7 : 0.45
  const injuryFactor = injuryHistoryPenalty(player) * (player.injuryDays > 0 ? 0.85 : 1)
  let v = Math.round(player.overall ** 2 * 900 * ageFactor * injuryFactor)

  // ฟอร์ม 1–20 → ~0.90–1.12
  v = Math.round(v * formMarketMul(player))
  // ความสนใจตลาด 0–20 → +0–18%
  v = Math.round(v * heatMarketMul(player))

  const years = player.contractYears ?? 0
  if (years <= 0) v = Math.round(v * 0.15)
  else if (years === 1) v = Math.round(v * 0.45)
  else if (years === 2) v = Math.round(v * 0.75)

  if (player.transferListed) v = Math.round(v * 0.78)
  if (player.wantAway?.active && player.wantAway.publicNews) v = Math.round(v * 0.88)
  else if (player.wantAway?.active) v = Math.round(v * 0.94)
  if (player.refuseContractRenewal) v = Math.round(v * 0.72)

  if (save) {
    const finalYear = (player.contractYears ?? 99) <= 1
    if (finalYear && save.matchday >= 14) v = Math.round(v * 0.55)
  }

  return Math.max(50_000, v)
}

/** ฟอร์มสัปดาห์+เดือน → คูณค่าตัว (~0.90–1.25 เมื่อโก่ง) */
export function formMarketMul(player: Player): number {
  return rollingFormMarketMul(player)
}

/** ความสนใจตลาด → คูณค่าตัว (+0–18%) */
export function heatMarketMul(player: Player): number {
  const h = Math.min(20, Math.max(0, player.marketHeat ?? 0))
  return 1 + (h / 20) * 0.18
}

/**
 * ฟอร์ม + heat → คูณค่าเหนื่อยที่ขอตอนเจรจาเท่านั้น
 * (สัญญาที่เซ็นแล้วไม่ขยับตามฟอร์มรายสัปดาห์ — ประเมินใหม่ตอนซื้อ/ต่อสัญญา)
 * ~0.94–1.14
 */
export function negotiationWageMul(player: Player): number {
  const f = Math.min(20, Math.max(1, formWindowAvgSafe(player)))
  let m = 0.94 + (f / 20) * 0.16
  const h = Math.min(20, Math.max(0, player.marketHeat ?? 0))
  if (h >= 12) m *= 1.04
  else if (h >= 7) m *= 1.02
  return Math.round(m * 1000) / 1000
}

function formWindowAvgSafe(player: Player): number {
  const hist = player.formHistory
  if (!hist?.length) return player.form ?? 10
  const slice = hist.slice(-4)
  return slice.reduce((s, n) => s + n, 0) / slice.length
}

/** ข้อความสั้นๆ ว่าทำไมราคาขยับ — ใช้ใน UI ตลาด */
export function marketValueHints(player: Player): string[] {
  const hints: string[] = [...rollingFormHints(player)]
  const h = player.marketHeat ?? 0
  if (h >= 14) hints.push(`ตลาดร้อนแรง (${h}/20) · หลายสโมสรจับตา`)
  else if (h >= 7) hints.push(`มีความสนใจซื้อ (${h}/20)`)
  return hints
}

export function clampMarketHeat(n: number): number {
  return Math.max(0, Math.min(20, Math.round(n)))
}

export function bumpMarketHeat(player: Player, delta: number): Player {
  return {
    ...player,
    marketHeat: clampMarketHeat((player.marketHeat ?? 0) + delta),
  }
}

/**
 * พรีเมียมตลาดกลางฤดูกาล (วินเทอร์) — ไม่มีใครอยากปล่อยนักเตะกลางทาง
 * ซัมเมอร์/ออฟซีซัน = 1
 */
export function marketSellPremium(save: GameSave, player: Player): number {
  const kind = transferWindowKind(save)
  if (kind !== 'winter') return 1

  let m = 1.48
  if (player.squadRole === 'key') m = 1.92
  else if (player.squadRole === 'regular') m = 1.68
  else if (player.overall >= 80) m = 1.75
  else if (player.overall >= 74) m = 1.58

  // สัญญายาว → ยิ่งไม่ยอมขาย
  const yearsLeft = player.contractYears ?? 0
  if (yearsLeft >= 3) m *= 1.12
  else if (yearsLeft >= 2) m *= 1.06

  // อยากย้าย/ข่าวสาธารณะ → ลดแรงต้านนิดหน่อย
  if (player.wantAway?.active && player.wantAway.publicNews) m *= 0.88
  else if (player.wantAway?.active) m *= 0.94
  if (player.refuseContractRenewal) m *= 0.9

  // ช่วงชั่วโมงปิดตลาด — ยังแพง แต่บางทีมพร้อมคุยถ้าจ่ายโหด
  if (save.transferDeadline?.active && save.transferDeadline.window === 'winter') {
    m *= 1.08
  }

  return Math.min(2.35, Math.round(m * 100) / 100)
}

export function minAcceptableFee(player: Player, seller: Club, save?: GameSave): number {
  const base = estimatedValue(player) * (0.85 + seller.reputation / 400)
  const premium = save ? marketSellPremium(save, player) : 1
  return Math.round(base * premium)
}

export function winterMarketHintTh(save: GameSave): string | null {
  if (transferWindowKind(save) !== 'winter') return null
  return 'ตลาดวินเทอร์: ราคาโหด — สโมสรไม่ยอมปล่อยนักเตะกลางทาง (คีย์/ตัวจริงแพงเป็นพิเศษ)'
}

export type OfferResult =
  | { ok: true; message: string; save: GameSave }
  | { ok: false; message: string; save?: GameSave }

function stripFromTactics(tactics: Tactics, playerId: string): Tactics {
  return {
    ...tactics,
    startingXi: tactics.startingXi.filter((id) => id !== playerId),
    bench: tactics.bench.filter((id) => id !== playerId),
  }
}

function ensureXiFilled(clubId: string, players: Player[], tactics: Tactics): Tactics {
  if (tactics.startingXi.length >= 11) return tactics
  const picked = autoPickTactics(clubId, players, tactics.formation, tactics.formationOop)
  return {
    ...picked,
    instructions: tactics.instructions,
    familiarity: tactics.familiarity,
    setPieces: tactics.setPieces,
  }
}

function squadAvg(save: GameSave, clubId: string) {
  const list = save.players.filter((p) => p.clubId === clubId)
  if (!list.length) return 60
  return list.reduce((s, p) => s + p.overall, 0) / list.length
}

/** ซื้อนักเตะจากคลับ AI */
export function buyPlayerFromAi(
  save: GameSave,
  playerId: string,
  offerFee: number,
  offerWage: number,
  contractYears = 3,
  opts?: {
    loanBackUntilNextSeason?: boolean
    paymentPreset?: import('./types').FeePaymentPreset
    /** ข้ามเมดิคอล (เช่น ฟรีเอเยนต์ที่รู้ร่างกายแล้ว) */
    skipMedical?: boolean
    /** ยอมรับเมดิคอลแบบมีเงื่อนไขแล้ว */
    acceptCautionMedical?: boolean
  },
): OfferResult {
  save = ensureFans(save)
  if (!isTransferWindowOpen(save)) {
    return { ok: false, message: transferWindowLabel(save) }
  }
  if (isTransferFrozen(save)) {
    return {
      ok: false,
      message: `บอร์ดแช่แข็งตลาดถึง MD${save.board.transferFreezeUntil} — ซื้อไม่ได้ชั่วคราว`,
    }
  }
  const insolvencyBlock = insolvencyBlocksBuying(save)
  if (insolvencyBlock) return { ok: false, message: insolvencyBlock }
  const playerRaw = save.players.find((p) => p.id === playerId)
  if (!playerRaw) return { ok: false, message: 'ไม่พบนักเตะ' }
  const player = withEnsuredAffinity(playerRaw, save.clubs)
  if (player.clubId === save.humanClubId) {
    return { ok: false, message: 'นักเตะคนนี้อยู่ในทีมคุณแล้ว' }
  }
  if (isAvoidClub(player, save.humanClubId) && !player.wantAway?.boardForced) {
    return {
      ok: false,
      message: `${player.name} ไม่สนใจย้ายมาสโมสรคุณ (ทีมที่เขาเลี่ยง)`,
      save,
    }
  }
  const sellerClubEarly = save.clubs.find((c) => c.id === player.clubId)
  if (
    sellerClubEarly &&
    sellerBlocksBuyer(sellerClubEarly, save.humanClubId, save.matchday)
  ) {
    return {
      ok: false,
      message: `${sellerClubEarly.name} ห้ามขายให้คุณชั่วคราว (หลังจับสัญญาใจ/tapping-up) จนถึง MD${sellerClubEarly.refuseBuyersUntil?.[save.humanClubId]}`,
      save,
    }
  }
  let dealFee = offerFee
  if ((player.agentLockUntilMatchday ?? -1) >= save.matchday) {
    return {
      ok: false,
      message: `เอเยนต์ล็อกการเจรจาถึง MD${player.agentLockUntilMatchday}`,
      save,
    }
  }

  const reg = canRegisterIncoming(save, player)
  if (!reg.ok) return { ok: false, message: `ทะเบียนสควอด: ${reg.reason}`, save }

  if (!opts?.skipMedical) {
    const med = runTransferMedical(player)
    if (med.grade === 'fail') {
      return { ok: false, message: med.message, save }
    }
    if (med.grade === 'caution' && !opts?.acceptCautionMedical) {
      return {
        ok: false,
        message: `${med.message} — ติ๊กยอมรับเมดิคอลมีเงื่อนไขแล้วส่งใหม่ (ค่าตัวจะถูกคูณ ${med.feeMul.toFixed(2)})`,
        save,
      }
    }
    if (med.grade === 'caution' && opts?.acceptCautionMedical) {
      dealFee = Math.round(offerFee * med.feeMul)
    }
  }

  // ROFR — ต้นสังกัดเก่าอาจบล็อก
  const rofr = resolveRofrForAi(save, playerId, dealFee)
  if (rofr.blocked) {
    return { ok: false, message: rofr.message, save: rofr.save }
  }
  save = rofr.save

  // คุยเอเยนต์เรื่องดีล → สนิทขึ้น (แม้ข้อเสนอจะไม่ผ่าน)
  save = bumpAgentRapport(save, playerId, 8)
  save = bumpPlayerRapport(save, playerId, 3)

  const seller = save.clubs.find((c) => c.id === player.clubId)
  const buyer = save.clubs.find((c) => c.id === save.humanClubId)!
  const isFreeAgent = player.clubId === '__free__' || !seller
  const minFee = isFreeAgent ? 0 : minAcceptableFee(player, seller!, save)
  const winterPrem = isFreeAgent ? 1 : marketSellPremium(save, player)

  const paymentPreset = opts?.paymentPreset ?? 'full'
  const schedule = buildFeePaymentSchedule(
    isFreeAgent ? 0 : dealFee,
    isFreeAgent ? 'full' : paymentPreset,
    save.season,
  )
  const sellerNpv = isFreeAgent ? 0 : sellerPresentValue(schedule, winterPrem > 1)

  if (schedule.dueNow > buyer.balance) {
    return {
      ok: false,
      message: `งบไม่พอจ่ายงวดแรก ${formatMoney(schedule.dueNow)} (มี ${formatMoney(buyer.balance)})`,
      save,
    }
  }

  const ffp = canAffordTransfer(save, schedule.dueNow, offerWage)
  if (!ffp.ok) return { ok: false, message: `FFP: ${ffp.reason}`, save }

  const sellerDepth = isFreeAgent
    ? 99
    : save.players.filter((p) => p.clubId === seller!.id && p.position === player.position).length
  // วินเทอร์: ลึกน้อยยิ่งไม่ปล่อย
  const depthPenalty =
    sellerDepth <= 2 ? (winterPrem > 1 ? 1.45 : 1.25) : sellerDepth <= 3 && winterPrem > 1 ? 1.18 : 1
  const rep = save.managerReputation ?? 50
  const repDiscount = 1 - (rep - 50) / 400
  let acceptFee = minFee * depthPenalty * Math.max(0.9, Math.min(1.08, repDiscount))

  // Rapport + Transfer → ค่าตัวที่ยอมรับได้ขยับจริง (ไม่ใช่แค่ข้อความ)
  {
    const scouting = ensureScouting(save)
    const aR = agentRapportOf(scouting, playerId)
    const pR = playerRapportOf(scouting, playerId)
    const rapportMul = 1 - Math.min(0.14, (aR * 0.7 + pR * 0.3) / 750)
    const intel = analyzeBuy(save, player)
    let intelMul = 1
    if (intel.verdict === 'strongly_yes') intelMul = 0.94
    else if (intel.verdict === 'yes') intelMul = 0.97
    else if (intel.verdict === 'no') intelMul = 1.05
    else if (intel.verdict === 'strongly_no') intelMul = 1.1
    acceptFee = Math.round(acceptFee * rapportMul * intelMul)
  }

  // ผู้ขายดูมูลค่าปัจจุบันของตารางผ่อน ไม่ใช่แค่ตัวเลขหน้าสัญญา
  if (!isFreeAgent && sellerNpv < acceptFee * 0.92) {
    const winterNote =
      winterPrem > 1
        ? ` (ตลาดวินเทอร์×${winterPrem.toFixed(2)} — ไม่ยอมปล่อยกลางทาง)`
        : ''
    const payNote =
      paymentPreset !== 'full'
        ? ` · ผ่อนแล้ว NPV ~${formatMoney(sellerNpv)} (ต้องการ ~${formatMoney(acceptFee)})`
        : ''
    return {
      ok: false,
      message: `${seller!.name} ปฏิเสธค่าตัว — ต้องการประมาณ ${formatMoney(acceptFee)} ขึ้นไป${winterNote}${payNote}`,
      save,
    }
  }

  const wageFloor = Math.round(
    player.wage * 1.05 * negotiationWageMul(player) * affinityWageMul(player, save.humanClubId),
  )
  if (offerWage < wageFloor) {
    return {
      ok: false,
      message: `นักเตะขอค่าเหนื่อยอย่างน้อย ${formatMoney(wageFloor)}/สัปดาห์${
        isAvoidClub(player, save.humanClubId)
          ? ''
          : affinityWageMul(player, save.humanClubId) < 1
            ? ' (ทีมในฝัน — ขอลดนิด)'
            : (player.form ?? 10) >= 15 || (player.marketHeat ?? 0) >= 7
              ? ' (ฟอร์ม/ความสนใจตลาดดันราคา)'
              : ''
      }`,
      save,
    }
  }

  const loanBack = Boolean(opts?.loanBackUntilNextSeason) && !isFreeAgent
  const sellerId = seller?.id ?? '__free__'
  const sellerName = seller?.name ?? 'ฟรีเอเยนต์'
  const sellerShort = seller?.shortName ?? 'FA'

  let players = save.players.map((p) =>
    p.id === playerId
      ? resetLoyaltyOnTransfer(
          {
            ...p,
            // ซื้อแล้วให้ต้นสังกัดยืมใช้ — ยังเล่นอยู่ทีมเดิมจนจบฤดูกาล
            clubId: loanBack ? sellerId : buyer.id,
            loanParentClubId: loanBack ? buyer.id : null,
            wage: offerWage,
            wageWeekly: offerWage,
            morale: Math.min(20, p.morale + 2),
            happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
            contractYears: contractYears,
            contractEndSeason: save.season + contractYears,
            wantAway: null,
            transferListed: false,
            marketHeat: 0,
            preContract: null,
            releaseClause:
              dealFee > estimatedValue(p) * 1.4
                ? Math.round(dealFee * 1.5)
                : (p.releaseClause ?? Math.round(dealFee * 1.8)),
          },
          loanBack ? sellerId : buyer.id,
        )
      : p,
  )

  let clubs = save.clubs.map((c) => {
    if (c.id === buyer.id) return { ...c, balance: c.balance - schedule.dueNow }
    if (!isFreeAgent && c.id === sellerId) return { ...c, balance: c.balance + schedule.dueNow }
    return c
  })

  let tacticsByClub = { ...save.tacticsByClub }
  if (loanBack) {
    // ยังอยู่ในแผนต้นสังกัด — ทีมผู้ซื้อยังไม่ใส่ XI
  } else {
    if (!isFreeAgent && tacticsByClub[sellerId]) {
      tacticsByClub[sellerId] = ensureXiFilled(
        sellerId,
        players,
        stripFromTactics(tacticsByClub[sellerId], playerId),
      )
    }
    tacticsByClub[buyer.id] = ensureXiFilled(buyer.id, players, {
      ...tacticsByClub[buyer.id],
      bench: [...(tacticsByClub[buyer.id]?.bench ?? []), playerId].slice(0, 7),
    })
  }

  const kind = classifyTransferForFans(
    player.overall,
    squadAvg(save, buyer.id),
    true,
    false,
    player.age,
  )
  const fanResult = applyTransferToFans(save.fans, kind, player.name)
  const finance = ensureClubFinance(save)

  const loanNote = loanBack
    ? ` · ยืมกลับให้ ${sellerShort} ใช้จนจบฤดูกาล ${save.season} — ฤดูกาลหน้าค่อยเข้าทีมคุณ`
    : ''
  const payNote = ` · ${describePaymentScheduleTh(schedule)}`

  const inbox: InboxMessage[] = [
    {
      id: `msg-buy-${Date.now()}`,
      date: save.currentDate,
      title: loanBack
        ? `ซื้อ+ยืมกลับ: ${player.name}`
        : paymentPreset !== 'full'
          ? `ซื้อ+ผ่อน: ${player.name}`
          : isFreeAgent
            ? `เซ็นฟรี: ${player.name}`
            : `เซ็นสัญญา: ${player.name}`,
      body: `${isFreeAgent ? 'เซ็นฟรีเอเยนต์' : `ซื้อจาก ${sellerName}`} · ค่าตัวรวม ${formatMoney(isFreeAgent ? 0 : dealFee)} · ค่าเหนื่อย ${formatMoney(offerWage)}/สัปดาห์ · สัญญา ${contractYears} ปี (หมด ${save.season + contractYears})${payNote}${loanNote}`,
      read: false,
    },
    fanInbox(save, 'เสียงจากอัฒจันทร์', fanResult.message),
    ...save.inbox,
  ]

  let next: GameSave = {
    ...save,
    players,
    clubs,
    tacticsByClub,
    fans: fanResult.fans,
    clubFinance: {
      ...finance,
      transferOutSeason: (finance.transferOutSeason ?? 0) + schedule.dueNow,
    },
    scouting: {
      ...ensureScouting(save),
      byPlayer: { ...ensureScouting(save).byPlayer, [playerId]: 100 },
    },
    inbox: inbox.slice(0, 40),
  }

  next = attachFeeInstallments(next, {
    playerId,
    playerName: player.name,
    buyerClubId: buyer.id,
    sellerClubId: sellerId,
    schedule,
  })

  if (loanBack && seller) {
    const deal = {
      id: `loan-blb-${Date.now().toString(36)}`,
      playerId,
      fromClubId: buyer.id,
      toClubId: seller.id,
      startMatchday: save.matchday,
      endMatchday: 9999,
      wageShareParent: 1,
      fee: 0,
      optionToBuy: null,
      recallable: false,
      status: 'active' as const,
      kind: 'buy_loan_back' as const,
      purchaseFee: dealFee,
    }
    next = {
      ...next,
      loans: [...(next.loans ?? []), deal],
    }
  }
  // แฟนต้นสังกัด (ทุกทีม) เกลียดถ้าขายดาว / อยากย้าย
  if (!isFreeAgent && seller) {
    const sellerKey =
      player.squadRole === 'key' ||
      player.overall >= squadAvg(save, seller.id) + 2
    next = recordHatredAfterLeave(next, seller.id, player, buyer.id, {
      wasKey: sellerKey,
    })
  }
  next = pushNews(next, newsAfterTransfer(next, player.name, true))
  next = applyFfpBreachSanction(next)
  next = markReleaseClauseKnown(next, playerId)
  next = appendPlayerMove(next, {
    playerId,
    playerName: player.name,
    fromClubId: isFreeAgent ? '__free__' : (seller?.id ?? player.clubId),
    toClubId: buyer.id,
    kind: isFreeAgent ? 'free' : 'transfer',
    fee: isFreeAgent ? 0 : dealFee,
    note: loanBack ? 'ซื้อ + ยืมกลับ' : undefined,
  })

  const payShort =
    !isFreeAgent && paymentPreset !== 'full'
      ? ` · ผ่อน: จ่ายตอนนี้ ${formatMoney(schedule.dueNow)} จาก ${formatMoney(dealFee)}`
      : ''

  return {
    ok: true,
    message: loanBack
      ? `ซื้อ ${player.name} สำเร็จ — ให้ ${sellerShort} ยืมใช้จนจบฤดูกาล · ฤดูกาลหน้าเข้าทีมคุณ${payShort} · ${fanResult.message}`
      : `สำเร็จ! ${player.name} ${isFreeAgent ? 'เซ็นฟรี' : 'ย้ายมาแล้ว'}${payShort} — ${fanResult.message}`,
    save: next,
  }
}

/** ขายนักเตะให้คลับ AI — ระบุ buyerClubId ได้เมื่อมีข้อเสนอเจาะจง */
export function sellPlayerToAi(
  save: GameSave,
  playerId: string,
  askFee: number,
  buyerClubId?: string,
  opts?: { allowToRival?: boolean; fireSale?: boolean },
): OfferResult {
  save = ensureFans(save)
  const inv = ensureInsolvency(save)
  const fireSale =
    Boolean(opts?.fireSale) ||
    inv.stage === 'administration' ||
    inv.fireSalePlayerIds.includes(playerId)
  if (!isTransferWindowOpen(save) && !fireSale) {
    return { ok: false, message: transferWindowLabel(save) }
  }
  if (isTransferFrozen(save) && !fireSale) {
    return {
      ok: false,
      message: `บอร์ดแช่แข็งตลาดถึง MD${save.board.transferFreezeUntil} — ขายไม่ได้ชั่วคราว`,
    }
  }
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId !== save.humanClubId) {
    return { ok: false, message: 'ขายได้เฉพาะนักเตะในทีมคุณ' }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const value = estimatedValue(player, save)
  const humanDepth = save.players.filter(
    (p) => p.clubId === human.id && p.position === player.position,
  ).length
  if (humanDepth <= 2) {
    return { ok: false, message: `ตำแหน่งนี้เหลือคนน้อยเกินไป — ขายไม่ได้` }
  }

  // แฟนโกรธมาก + ขายตัวจริงคุณภาพสูง = เตือนแรง (ยังขายได้ แต่ข้อความชัด)
  const inXi = save.tacticsByClub[human.id].startingXi.includes(playerId)
  if (save.fans.mood < 28 && inXi) {
    return {
      ok: false,
      message: `แฟนโกรธจัด (${save.fans.mood}/100) — บอร์ดบล็อกการขายตัวจริงชั่วคราวเพื่อกันวิกฤต`,
    }
  }

  const buyers = save.clubs
    .filter((c) => c.controlledBy === 'ai' && c.balance > askFee * 0.8)
    .filter((c) => !isAvoidClub(withEnsuredAffinity(player, save.clubs), c.id))
    .sort((a, b) => {
      const pa = withEnsuredAffinity(player, save.clubs)
      const da = affinityWageMul(pa, a.id) // lower wage mul = more desire — invert for sort
      const db = affinityWageMul(pa, b.id)
      if (da !== db) return da - db // dream first (0.94 before 1.0)
      return b.reputation - a.reputation
    })

  if (buyers.length === 0) {
    return {
      ok: false,
      message: 'ไม่มีคลับ AI ที่นักเตะยอมไปและมีงบพอ (อาจเลี่ยงทีมที่อยู่ในรายการ avoid)',
    }
  }

  const maxReasonable = Math.round(value * 1.35)
  if (askFee > maxReasonable) {
    return {
      ok: false,
      message: `ราคาสูงเกินไป — ตลาดประเมินราว ${formatMoney(value)} (สูงสุดที่ AI พอรับได้ ~${formatMoney(maxReasonable)})`,
    }
  }

  const preferred = buyerClubId ? buyers.find((c) => c.id === buyerClubId) : undefined
  let buyer =
    preferred ?? buyers[Math.floor(Math.random() * Math.min(5, buyers.length))]!
  if (preferred && preferred.balance < askFee * 0.8) {
    return { ok: false, message: `${preferred.name} งบไม่พอรับดีลนี้` }
  }

  // สุภาพบุรุษ: ห้ามขายให้คู่แข่ง (ยกเว้นยืนยันฝ่าฝืน)
  const rivalGate = rivalSellCheck(save, buyer.id, { allowToRival: opts?.allowToRival })
  if (rivalGate.policy === 'block') {
    // ถ้ายังไม่ระบุ buyer ให้สุ่มใหม่ที่ไม่ใช่คู่แข่ง
    if (!preferred) {
      const nonRival = buyers.filter((c) => !rivalGate.rivalIds.includes(c.id))
      if (nonRival.length) {
        buyer = nonRival[Math.floor(Math.random() * Math.min(5, nonRival.length))]!
      } else {
        return { ok: false, message: rivalGate.message }
      }
    } else {
      return { ok: false, message: rivalGate.message }
    }
  }

  const acceptChance = Math.min(0.95, 0.35 + (value / Math.max(askFee, 1)) * 0.5)
  if (!preferred && Math.random() > acceptChance && askFee > value) {
    return {
      ok: false,
      message: `${buyer.name} สนใจแต่ยังไม่ยอมจ่าย ${formatMoney(askFee)} — ลองลดราคา`,
    }
  }

  let players = save.players.map((p) =>
    p.id === playerId
      ? resetLoyaltyOnTransfer(
          {
            ...p,
            clubId: buyer.id,
            morale: Math.max(1, p.morale - 1),
            happiness: Math.max(1, (p.happiness ?? p.morale) - 1),
            wantAway: null,
          },
          buyer.id,
        )
      : p,
  )

  let clubs = save.clubs.map((c) => {
    if (c.id === human.id) return { ...c, balance: c.balance + askFee }
    if (c.id === buyer.id) return { ...c, balance: c.balance - askFee }
    return c
  })

  let tacticsByClub = { ...save.tacticsByClub }
  tacticsByClub[human.id] = ensureXiFilled(
    human.id,
    players,
    stripFromTactics(tacticsByClub[human.id], playerId),
  )
  tacticsByClub[buyer.id] = ensureXiFilled(buyer.id, players, {
    ...tacticsByClub[buyer.id],
    bench: [...tacticsByClub[buyer.id].bench, playerId].slice(0, 7),
  })

  const kind = classifyTransferForFans(
    player.overall,
    squadAvg(save, human.id),
    false,
    inXi,
    player.age,
  )
  const fanResult = applyTransferToFans(save.fans, kind, player.name)
  let nextSell: GameSave = {
    ...save,
    players,
    clubs,
    tacticsByClub,
    fans: fanResult.fans,
  }
  nextSell = recordHatredAfterLeave(nextSell, human.id, player, buyer.id, {
    wasKey: kind === 'sell_star',
  })
  const soldToRival = rivalSellCheck(save, buyer.id, { allowToRival: true }).policy === 'allow_with_hatred'
  if (soldToRival) {
    nextSell = heatRivalry(nextSell, human.id, buyer.id, 12, 'transfer', `ขายนักเตะให้คู่แข่ง`)
    nextSell = recordHatredWhileAtClub(
      nextSell,
      human.id,
      player,
      'want_away',
      `ฝ่าฝืนสุภาพบุรุษ — ขายให้คู่แข่ง ${buyer.shortName}`,
    )
    nextSell = {
      ...nextSell,
      fans: {
        ...nextSell.fans,
        mood: Math.max(5, nextSell.fans.mood - 8),
        protestActive: true,
        boycottUntilMatchday: Math.max(nextSell.fans.boycottUntilMatchday ?? -1, save.matchday + 2),
        lastEvent: `โกรธขายให้คู่แข่ง: ${player.name} → ${buyer.shortName}`,
      },
    }
  }
  let fansAfter = nextSell.fans
  if (kind === 'sell_star') {
    fansAfter = {
      ...fansAfter,
      protestActive: true,
      boycottUntilMatchday: save.matchday + 1,
      lastEvent: `ประท้วงขายดาว ${player.name}`,
    }
  }

  const inbox: InboxMessage[] = [
    {
      id: `msg-sell-${Date.now()}`,
      date: save.currentDate,
      title: `ขายนักเตะ: ${player.name}`,
      body: `ขายให้ ${buyer.name} ได้ ${formatMoney(askFee)} (มูลค่าประเมิน ${formatMoney(value)})`,
      read: false,
    },
    fanInbox(save, 'เสียงจากอัฒจันทร์', fanResult.message),
    ...save.inbox,
  ]

  const finance = ensureClubFinance(save)
  let next: GameSave = {
    ...nextSell,
    fans: fansAfter,
    clubFinance: {
      ...finance,
      transferInSeason: (finance.transferInSeason ?? 0) + askFee,
    },
    inbox: inbox.slice(0, 40),
    scouting: markPlayerAsAlumni(ensureScouting(save), playerId),
  }
  next = syncHumanFansToClub(next)
  next = pushNews(next, newsAfterTransfer(next, player.name, false))
  next = settleSellOnClauses(next, playerId, askFee)

  const invAfter = ensureInsolvency(next)
  if (invAfter.fireSalePlayerIds.includes(playerId)) {
    next = {
      ...next,
      insolvency: {
        ...invAfter,
        fireSalePlayerIds: invAfter.fireSalePlayerIds.filter((id) => id !== playerId),
        lastNote: `Fire sale: ขาย ${player.name} · ${formatMoney(askFee)}`,
      },
    }
  }

  next = appendPlayerMove(next, {
    playerId,
    playerName: player.name,
    fromClubId: human.id,
    toClubId: buyer.id,
    kind: 'transfer',
    fee: askFee,
    note: fireSale ? 'Fire sale' : undefined,
  })

  return {
    ok: true,
    message: `ขายสำเร็จให้ ${buyer.name} — ${fanResult.message}`,
    save: next,
  }
}

export function listMarketPlayers(save: GameSave): Array<
  Player & { clubName: string; value: number; originLeague?: string }
> {
  return save.players
    .filter(
      (p) =>
        (p.clubId !== save.humanClubId && !p.loanParentClubId) ||
        p.clubId === '__free__',
    )
    .filter((p) => p.clubId !== save.humanClubId)
    .map((p) => {
      const club = save.clubs.find((c) => c.id === p.clubId)
      return {
        ...p,
        clubName: p.clubId === '__free__' ? 'ฟรีเอเยนต์' : (club?.name ?? '—'),
        value: estimatedValue(p, save),
        originLeague: club?.originLeagueId,
      }
    })
    .sort((a, b) => b.overall - a.overall)
}

/** ต่อสัญญา / ปรับค่าเหนื่อยนักเตะในทีม — หลายรอบ · จุดติดตามนิสัยเอเยนต์/นักเตะ */
export function renewContract(
  save: GameSave,
  playerId: string,
  newWage: number,
  years: number,
  bonuses?: ContractBonusOffer,
): OfferResult {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId !== save.humanClubId) {
    return { ok: false, message: 'ต่อสัญญาได้เฉพาะนักเตะในทีมคุณ' }
  }
  if (years < 1 || years > 5) return { ok: false, message: 'สัญญาระหว่าง 1–5 ปี' }

  // คุยเอเยนต์/นักเตะเรื่องสัญญา
  if ((player.agentLockUntilMatchday ?? -1) >= save.matchday) {
    return {
      ok: false,
      message: `เอเยนต์ล็อกการเจรจาถึง MD${player.agentLockUntilMatchday}`,
    }
  }
  save = bumpAgentRapport(save, playerId, 10)
  save = bumpPlayerRapport(save, playerId, 8)
  save = markReleaseClauseKnown(save, playerId)

  const talks = save.contractTalks?.talks ?? []
  let talk = talks.find((t) => t.playerId === playerId && t.status === 'open')
  const style = agentStyleFor(player)
  const ambitionBump = player.overall >= 78 ? 1.12 : player.overall >= 72 ? 1.06 : 1.02
  const ageBump = player.age <= 24 ? 1.05 : player.age >= 32 ? 0.97 : 1
  const formWageMul = negotiationWageMul(player)
  const affinityPlayer = withEnsuredAffinity(player, save.clubs)
  const clubFitMul = renewAffinityWageMul(affinityPlayer, save.humanClubId)
  const loyaltyMul = loyaltyRenewWageMul(ensureClubLoyalty(affinityPlayer))
  const notDreamHere = clubDesireScore(affinityPlayer, save.humanClubId) < 0.4
  const highAmbition = (affinityPlayer.growth?.ambition ?? 10) >= 14 || affinityPlayer.overall >= 76
  // ไม่ใช่ทีมในฝัน + ambition สูง → มีโอกาสปฏิเสธต่อสัญญาทันที (ภักดีสูงลดโอกาส)
  if (
    !talk &&
    notDreamHere &&
    highAmbition &&
    !player.refuseContractRenewal &&
    Math.random() <
      (0.12 + (affinityPlayer.growth?.ambition ?? 10) / 200) *
        loyaltyRefuseRenewChanceMul(affinityPlayer)
  ) {
    const nextPlayers = save.players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            clubAffinity: affinityPlayer.clubAffinity,
            refuseContractRenewal: true,
            wantAway: {
              active: true,
              intensity: Math.min(20, (p.wantAway?.intensity ?? 6) + 3),
              publicNews: p.wantAway?.publicNews ?? false,
              refuseCount: (p.wantAway?.refuseCount ?? 0) + 1,
              sinceMatchday: p.wantAway?.sinceMatchday ?? save.matchday,
              reasonTh: 'อยากไปทีมในฝัน — ไม่ต่อสัญญา',
              boardForced: p.wantAway?.boardForced,
              preferredClubIds:
                p.wantAway?.preferredClubIds ?? affinityPlayer.clubAffinity?.dreamClubIds,
            },
          }
        : p,
    )
    return {
      ok: false,
      message: `${player.name} ปฏิเสธคุยต่อสัญญา — อยากไปทีมในฝัน / ไม่เห็นอนาคตที่นี่`,
      save: {
        ...save,
        players: nextPlayers,
        inbox: [
          {
            id: `msg-refuse-aff-${Date.now()}`,
            date: save.currentDate,
            title: `ไม่ต่อสัญญา: ${player.name}`,
            body: 'นักเตะอ้างเป้าหมายสโมสรใหญ่ — อาจรอหมดสัญญา (บอสแมน) หรือกดให้ย้าย',
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
    }
  }
  let askWage =
    talk?.askWage ??
    Math.round(
      player.wage *
        ambitionBump *
        ageBump *
        agentAskMul(style) *
        formWageMul *
        clubFitMul *
        loyaltyMul,
    )
  let askYears = talk?.askYears ?? Math.max(2, Math.min(4, years + (style === 'aggressive' ? 1 : 0)))
  const bonusSeed =
    talk != null
      ? {
          askSigningOn: talk.askSigningOn ?? 0,
          askPerAppearance: talk.askPerAppearance ?? 0,
          askPerGoal: talk.askPerGoal ?? 0,
        }
      : seedContractBonusAsks(player, askWage, style)
  let askSigningOn = bonusSeed.askSigningOn
  let askPerAppearance = bonusSeed.askPerAppearance
  let askPerGoal = bonusSeed.askPerGoal

  const prof = negotiationProfile(player, style)
  const agentRate =
    (0.06 + (player.overall >= 80 ? 0.04 : player.overall >= 74 ? 0.02 : 0)) *
    agentFeeMul(style) *
    agentKindFeeMul(player.agentKind ?? undefined)
  const offeredSigning = Math.max(0, Math.round(bonuses?.signingOnFee ?? talk?.lastOfferSigningOn ?? 0))
  const offeredApp = Math.max(0, Math.round(bonuses?.perAppearance ?? talk?.lastOfferPerAppearance ?? 0))
  const offeredGoal = Math.max(0, Math.round(bonuses?.perGoal ?? talk?.lastOfferPerGoal ?? 0))
  const agentFee = Math.round(newWage * 52 * years * agentRate)
  const maxRounds = Math.max(
    1,
    talk?.maxRounds ??
      prof.maxRounds - (notDreamHere && highAmbition ? 1 : 0),
  )

  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const otherWages = save.players
    .filter((p) => p.clubId === club.id && p.id !== playerId)
    .reduce((s, p) => s + p.wage, 0)
  if (otherWages + newWage > club.wageBudgetWeekly * 1.15) {
    return { ok: false, message: 'เกินงบค่าเหนื่อยรายสัปดาห์ของสโมสร' }
  }
  const upfront = agentFee + offeredSigning
  if (club.balance < upfront) {
    return {
      ok: false,
      message: `งบไม่พอค่าเอเยนต์+เงินเซ็น (~${formatMoney(upfront)})`,
    }
  }

  const round = (talk?.round ?? 0) + 1
  const draftTalk: ContractNegotiation = {
    id: talk?.id ?? `ct-${Date.now()}`,
    playerId,
    playerName: player.name,
    round: talk?.round ?? 0,
    maxRounds,
    lastOfferWage: newWage,
    lastOfferYears: years,
    askWage,
    askYears,
    askSigningOn,
    askPerAppearance,
    askPerGoal,
    lastOfferSigningOn: offeredSigning,
    lastOfferPerAppearance: offeredApp,
    lastOfferPerGoal: offeredGoal,
    focus: talk?.focus ?? 'wage',
    agentFee,
    status: 'open',
    note: talk?.note ?? '',
  }

  const stuck = findStickingPoints(
    draftTalk,
    {
      wage: newWage,
      years,
      signingOnFee: offeredSigning,
      perAppearance: offeredApp,
      perGoal: offeredGoal,
    },
    prof,
  )

  if (stuck.length > 0) {
    if (round >= maxRounds) {
      const walked: ContractNegotiation = {
        ...draftTalk,
        round,
        status: 'walked',
        focus: stuck[0],
        note: `เจรจาล้ม รอบ ${round}/${maxRounds} — จุดติด「${stickingDetailTh(stuck[0]!, draftTalk)}」· เอเยนต์(${AGENT_STYLE_LABEL[style]}) พาออกจากโต๊ะ`,
      }
      return {
        ok: false,
        message: walked.note,
        save: (() => {
          let s: GameSave = {
            ...save,
            contractTalks: {
              talks: [walked, ...talks.filter((t) => t.playerId !== playerId)].slice(0, 20),
            },
            players: save.players.map((p) =>
              p.id === playerId
                ? {
                    ...p,
                    happiness: Math.max(1, (p.happiness ?? 10) - 2),
                    refuseContractRenewal: true,
                    agentLockUntilMatchday: save.matchday + 10,
                    wantAway: {
                      active: true,
                      intensity: Math.min(20, (p.wantAway?.intensity ?? 6) + 4),
                      publicNews: p.wantAway?.publicNews ?? false,
                      refuseCount: p.wantAway?.refuseCount ?? 0,
                      sinceMatchday: p.wantAway?.sinceMatchday ?? save.matchday,
                      reasonTh: 'ไม่ยอมต่อสัญญา',
                      boardForced: p.wantAway?.boardForced,
                      preferredClubIds:
                        p.wantAway?.preferredClubIds ??
                        withEnsuredAffinity(p, save.clubs).clubAffinity?.dreamClubIds,
                    },
                  }
                : p,
            ),
            inbox: [
              {
                id: `msg-refuse-ct-${Date.now()}`,
                date: save.currentDate,
                title: `${player.name} ไม่ยอมต่อสัญญา`,
                body: `เจรจาไม่ลงตัวเรื่อง${stuck.map((f) => stickingDetailTh(f, draftTalk)).join(' · ')} — ล็อกถึง MD${save.matchday + 10}`,
                read: false,
              },
              ...save.inbox,
            ].slice(0, 40),
          }
          s = recordHatredWhileAtClub(
            s,
            save.humanClubId,
            player,
            'refuse_contract',
            'ไม่ยอมต่อสัญญา — แฟนเริ่มเกลียด',
          )
          return s
        })(),
      }
    }

    const countered = counterAsks(draftTalk, stuck, prof, round)
    const focus = countered.focus ?? stuck[0]!
    const nextTalk: ContractNegotiation = {
      ...draftTalk,
      ...countered,
      round,
      askWage: countered.askWage,
      askYears: countered.askYears,
      askSigningOn: countered.askSigningOn,
      askPerAppearance: countered.askPerAppearance,
      askPerGoal: countered.askPerGoal,
      focus,
      agentFee: Math.round(countered.askWage * 52 * countered.askYears * agentRate),
      status: 'open',
      note: roundNoteTh(
        round,
        maxRounds,
        focus,
        prof.labelTh,
        stickingDetailTh(focus, { ...draftTalk, ...countered }),
      ),
    }
    return {
      ok: false,
      message: nextTalk.note,
      save: {
        ...save,
        contractTalks: {
          talks: [
            nextTalk,
            ...talks.filter((t) => !(t.playerId === playerId && t.status === 'open')),
          ].slice(0, 20),
        },
      },
    }
  }

  const players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          wage: newWage,
          wageWeekly: newWage,
          contractYears: years,
          contractEndSeason: save.season + years,
          morale: Math.min(20, p.morale + 1),
          happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
          refuseContractRenewal: false,
          clubLoyalty: Math.min(20, (p.clubLoyalty ?? 10) + 2),
          loyaltyClubId: save.humanClubId,
          wantAway:
            p.wantAway?.reasonTh === 'ไม่ยอมต่อสัญญา' ? null : p.wantAway ?? null,
        }
      : p,
  )

  const signed: ContractNegotiation = {
    ...draftTalk,
    round: Math.max(1, round),
    lastOfferWage: newWage,
    lastOfferYears: years,
    lastOfferSigningOn: offeredSigning,
    lastOfferPerAppearance: offeredApp,
    lastOfferPerGoal: offeredGoal,
    askWage,
    askYears,
    askSigningOn,
    askPerAppearance,
    askPerGoal,
    focus: 'wage',
    agentFee,
    status: 'signed',
    note: `เซ็นแล้ว รอบ ${round}/${maxRounds} · ${prof.labelTh} · เอเยนต์ ${formatMoney(agentFee)}${
      offeredSigning > 0 ? ` · เงินเซ็น ${formatMoney(offeredSigning)}` : ''
    }`,
  }

  const watch = save.assistantContractWatch
  const clearedRemind = { ...(watch?.lastRemindByPlayer ?? {}) }
  delete clearedRemind[playerId]
  const clearedDemand = { ...(watch?.lastDemandByPlayer ?? {}) }
  delete clearedDemand[playerId]

  let nextSave: GameSave = {
    ...save,
    players: players.map((p) => (p.id === playerId ? { ...p, agentStyle: style } : p)),
    clubs: save.clubs.map((c) =>
      c.id === club.id ? { ...c, balance: c.balance - agentFee } : c,
    ),
    fans: {
      ...ensureFans(save).fans,
      hatedPlayers: (ensureFans(save).fans.hatedPlayers ?? []).filter(
        (h) =>
          !(h.playerId === playerId && h.stillAtClub && h.reason === 'refuse_contract'),
      ),
    },
    contractTalks: {
      talks: [
        signed,
        ...talks.filter((t) => !(t.playerId === playerId && t.status === 'open')),
      ].slice(0, 20),
    },
    assistantContractWatch: {
      lastRemindByPlayer: clearedRemind,
      lastDemandByPlayer: clearedDemand,
    },
    inbox: [
      {
        id: `msg-renew-${Date.now()}`,
        date: save.currentDate,
        title: `ต่อสัญญา: ${player.name}`,
        body: `สัญญาใหม่ ${years} ปี หมดฤดูกาล ${save.season + years} · ค่าเหนื่อย ${formatMoney(newWage)}/สัปดาห์ · จ่ายเอเยนต์(${AGENT_STYLE_LABEL[style]}) ${formatMoney(agentFee)}${
          offeredSigning > 0 ? ` · เงินเซ็น ${formatMoney(offeredSigning)}` : ''
        }${offeredApp > 0 ? ` · โบนัสนัด ${formatMoney(offeredApp)}` : ''}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }

  if (offeredSigning > 0 || offeredApp > 0 || offeredGoal > 0) {
    nextSave = attachClausesAfterBuy(nextSave, {
      playerId,
      playerName: player.name,
      buyerClubId: club.id,
      sellerClubId: club.id,
      addons: {
        ...emptyAddonPackage(),
        signingOnFee: offeredSigning,
        perAppearance: offeredApp,
        perGoal: offeredGoal,
      },
    })
  }

  return {
    ok: true,
    message: `ต่อสัญญา ${player.name} สำเร็จ · ${years} ปี · ${formatMoney(newWage)}/สัปดาห์ · เอเยนต์(${AGENT_STYLE_LABEL[style]}) ${formatMoney(agentFee)}`,
    save: pushNews(nextSave, newsAfterContract(save, player.name, years)),
  }
}

export function createContractTalks(): ContractTalkState {
  return { talks: [] }
}

export function ensureContractTalks(save: GameSave): ContractTalkState {
  return save.contractTalks ?? createContractTalks()
}

/**
 * ผู้จัดการยกเลิกโต๊ะต่อสัญญาเมื่อค่าเหนื่อย/ปีไม่ลงตัว
 * (เบากว่าเอเยนต์พาเดินออก — ยังคุยใหม่ได้ทีหลัง)
 */
export function cancelContractNegotiation(
  save: GameSave,
  playerId: string,
): OfferResult {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId !== save.humanClubId) {
    return { ok: false, message: 'ยกเลิกได้เฉพาะนักเตะในทีมคุณ' }
  }
  const talks = ensureContractTalks(save).talks
  const talk = talks.find((t) => t.playerId === playerId && t.status === 'open')
  if (!talk) {
    return { ok: false, message: 'ไม่มีโต๊ะเจรจาที่เปิดอยู่' }
  }

  const hardFeelings = talk.round >= 2
  const cancelled: ContractNegotiation = {
    ...talk,
    status: 'cancelled',
    note: hardFeelings
      ? `ยกเลิกหลังคุยไป ${talk.round} รอบ — ค่าเหนื่อย/โบนัสไม่ลงตัว`
      : 'ยกเลิกการเจรจา — ค่าเหนื่อย/โบนัสยังไม่ลงตัว',
  }

  const lockMd = save.matchday + (hardFeelings ? 4 : 2)
  const players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          happiness: Math.max(1, (p.happiness ?? 10) - (hardFeelings ? 2 : 1)),
          morale: Math.max(1, p.morale - (hardFeelings ? 1 : 0)),
          agentLockUntilMatchday: Math.max(p.agentLockUntilMatchday ?? 0, lockMd),
        }
      : p,
  )

  return {
    ok: true,
    message: cancelled.note,
    save: {
      ...save,
      players,
      contractTalks: {
        talks: [cancelled, ...talks.filter((t) => !(t.playerId === playerId && t.status === 'open'))].slice(
          0,
          20,
        ),
      },
      inbox: [
        {
          id: `msg-ct-cancel-${Date.now()}`,
          date: save.currentDate,
          title: `ยกเลิกเจรจาสัญญา: ${player.name}`,
          body: `${cancelled.note} · ล็อกคุยเอเยนต์ถึง MD${lockMd} · เปิดโต๊ะใหม่ได้ทีหลังถ้ายังอยากอยู่`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** กดเงื่อนไขซื้อขาด — จ่ายตาม releaseClause แล้วได้ตัวทันที */
export function triggerReleaseClause(
  save: GameSave,
  playerId: string,
  wage?: number,
  years = 3,
): OfferResult {
  if (!isTransferWindowOpen(save)) return { ok: false, message: transferWindowLabel(save) }
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId === save.humanClubId) return { ok: false, message: 'อยู่ในทีมแล้ว' }

  // ความลับ — ต้องสนิทเอเยนต์/นักเตะก่อน (ทีม AI ด้วย)
  if (!isReleaseClauseKnown(save, player)) {
    save = bumpAgentRapport(save, playerId, 5)
    return {
      ok: false,
      message:
        'ยังไม่ทราบเงื่อนไขซื้อขาด — ลองสนิทกับเอเยนต์ (เจรจาค่าตัว) หรือคุยกับนักเตะให้มากขึ้น',
      save,
    }
  }
  if (!player.releaseClause || player.releaseClause <= 0) {
    return { ok: false, message: 'นักเตะคนนี้ไม่มีเงื่อนไขซื้อขาด', save }
  }
  const offerWage = wage ?? Math.round(player.wage * 1.12)
  return buyPlayerFromAi(save, playerId, player.releaseClause, offerWage, years)
}
