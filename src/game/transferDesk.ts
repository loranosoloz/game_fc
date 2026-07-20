import type {
  FeePaymentPreset,
  GameSave,
  MatchResult,
  MediaItem,
  PendingTransferOffer,
  TransferAddonPackage,
  TransferDeskState,
} from './types'
import { buyPlayerFromAi, estimatedValue, marketSellPremium, negotiationWageMul, sellPlayerToAi, bumpMarketHeat, clampMarketHeat } from './transfer'
import { bumpAgentRapport, bumpPlayerRapport } from './releaseClauseIntel'
import { formatMoney } from '@/lib/format'
import { isTransferWindowOpen, transferWindowLabel } from './transferWindow'
import { attachClausesAfterBuy, tickPerformanceClauses, resolveAddonPackage, tickIntlCapsClauses } from './transferClauses'
import { processWantAwayAiBids } from './wantAway'
import { processAiSecretHandshakes } from './playerAmbition'
import {
  attachFeeInstallments,
  buildFeePaymentSchedule,
  describePaymentScheduleTh,
  sellerPresentValue,
  tickFeeInstallments,
} from './transferPayments'
import { isAgentLocked } from './transferAdvanced'
import { offerRofrMatchToHuman } from './transferExtras'
import { autoPickTactics } from './seed'
import {
  applyTransferToFans,
  classifyTransferForFans,
  ensureFans,
  fanInbox,
  recordHatredAfterLeave,
} from './fans'
import { ensureClubFinance } from './playerEconomy'
import { isTransferFrozen } from './clubAtmosphere'
import { ensureMediaFeed, pushNews } from './media'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createTransferDesk(): TransferDeskState {
  return { offers: [], auctions: [], clauses: [], feeInstallments: [] }
}

export function ensureTransferDesk(save: GameSave): TransferDeskState {
  const d = save.transferDesk ?? createTransferDesk()
  return { ...d, clauses: d.clauses ?? [], feeInstallments: d.feeInstallments ?? [] }
}

export type DeskResult =
  | { ok: true; message: string; save: GameSave }
  | { ok: false; message: string; save?: GameSave }

/** ส่งข้อเสนอแบบเจรจา (อาจได้ counter) */
export function submitNegotiatedBuy(
  save: GameSave,
  playerId: string,
  fee: number,
  wage: number,
  contractYears = 3,
  appearanceAddon = 0,
  sellOnPercent = 0,
  addons?: TransferAddonPackage | null,
  opts?: {
    loanBackUntilNextSeason?: boolean
    paymentPreset?: FeePaymentPreset
    acceptCautionMedical?: boolean
  },
): DeskResult {
  if (!isTransferWindowOpen(save)) return { ok: false, message: transferWindowLabel(save) }
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId === save.humanClubId) return { ok: false, message: 'อยู่ในทีมแล้ว' }

  save = bumpAgentRapport(save, playerId, 10)
  save = bumpPlayerRapport(save, playerId, 4)

  const seller = save.clubs.find((c) => c.id === player.clubId)!
  const value = estimatedValue(player)
  const winterPrem = marketSellPremium(save, player)
  const want = Math.round(value * (0.95 + seller.reputation / 350) * winterPrem)
  const pkg = resolveAddonPackage(addons, appearanceAddon, sellOnPercent)
  const loanBack = Boolean(opts?.loanBackUntilNextSeason)
  const paymentPreset = opts?.paymentPreset ?? 'full'
  const schedule = buildFeePaymentSchedule(fee, paymentPreset, save.season)
  const npv = sellerPresentValue(schedule, winterPrem > 1)

  // ถ้าราคาใกล้เคียง → ปิดทันที (หัก add-on เล็กน้อยจากความพึงพอใจ)
  // วินเทอร์ต้องใกล้ want มากขึ้น — ดู NPV ถ้าผ่อน
  const instantCut = winterPrem > 1 ? 0.99 : 0.97
  if (npv >= want * instantCut && wage >= player.wage * 1.05 * negotiationWageMul(player)) {
    const closed = buyPlayerFromAi(save, playerId, fee, wage, contractYears, opts)
    if (!closed.ok) return closed
    const withClauses = attachClausesAfterBuy(closed.save, {
      playerId,
      playerName: player.name,
      buyerClubId: save.humanClubId,
      sellerClubId: seller.id,
      addons: pkg,
    })
    return { ok: true, message: closed.message + ' (ปิดดีลทันที)', save: withClauses }
  }

  // counter หรือปฏิเสธ — วินเทอร์ปฏิเสธง่ายกว่า
  const rejectCut = winterPrem > 1 ? 0.82 : 0.75
  if (npv < want * rejectCut) {
    return {
      ok: false,
      message: `${seller.name} ปฏิเสธทันที — ต่ำเกินไป (เป้า ~${formatMoney(want)}${
        winterPrem > 1 ? ` · วินเทอร์×${winterPrem.toFixed(2)}` : ''
      }${paymentPreset !== 'full' ? ` · NPV ผ่อน ~${formatMoney(npv)}` : ''})`,
      save,
    }
  }

  const counter = Math.round(want * (0.98 + Math.random() * 0.08) * (winterPrem > 1 ? 1.04 : 1))
  const offer: PendingTransferOffer = {
    id: uid('offer'),
    kind: 'buy',
    playerId,
    fromClubId: seller.id,
    toClubId: save.humanClubId,
    fee,
    wage,
    contractYears,
    appearanceAddon: pkg.appearanceFee,
    sellOnPercent: pkg.sellOnPercent,
    addons: pkg,
    status: 'countered',
    counterFee: counter,
    expiresMatchday: save.matchday + 3,
    note: `${seller.name} โต้กลับค่าตัว ${formatMoney(counter)}${
      loanBack ? ' · (ซื้อ+ยืมกลับ)' : ''
    }${paymentPreset !== 'full' ? ` · (${describePaymentScheduleTh(schedule)})` : ''}`,
    loanBackUntilNextSeason: loanBack || undefined,
    paymentPreset: paymentPreset !== 'full' ? paymentPreset : undefined,
  }

  const desk = ensureTransferDesk(save)
  return {
    ok: true,
    message: offer.note,
    save: {
      ...save,
      transferDesk: { ...desk, offers: [offer, ...desk.offers].slice(0, 30) },
      inbox: [
        {
          id: uid('msg'),
          date: save.currentDate,
          title: 'ข้อเสนอโต้กลับ',
          body: offer.note,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

export function acceptCounterOffer(save: GameSave, offerId: string): DeskResult {
  const desk = ensureTransferDesk(save)
  const offer = desk.offers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'countered' || !offer.counterFee) {
    return { ok: false, message: 'ไม่พบข้อเสนอโต้กลับ' }
  }
  const closed = buyPlayerFromAi(
    save,
    offer.playerId,
    offer.counterFee,
    offer.wage,
    offer.contractYears,
    {
      loanBackUntilNextSeason: offer.loanBackUntilNextSeason,
      paymentPreset: offer.paymentPreset,
    },
  )
  if (!closed.ok) return closed
  const player = save.players.find((p) => p.id === offer.playerId)
  let next = closed.save
  next = attachClausesAfterBuy(next, {
    playerId: offer.playerId,
    playerName: player?.name ?? offer.playerId,
    buyerClubId: offer.toClubId,
    sellerClubId: offer.fromClubId,
    appearanceAddon: offer.appearanceAddon,
    sellOnPercent: offer.sellOnPercent,
    addons: offer.addons,
  })
  return {
    ok: true,
    message: closed.message,
    save: {
      ...next,
      transferDesk: {
        ...ensureTransferDesk(next),
        offers: ensureTransferDesk(next).offers.map((o) =>
          o.id === offerId ? { ...o, status: 'accepted' as const } : o,
        ),
      },
    },
  }
}

/** แลกนักเตะ + เงินปรับ (รองรับผ่อนค่าตัวส่วนต่าง + ยืมกลับ) */
export function proposePlayerExchange(
  save: GameSave,
  theirPlayerId: string,
  ourPlayerId: string,
  cashAdjust = 0,
  opts?: {
    paymentPreset?: FeePaymentPreset
    loanBackUntilNextSeason?: boolean
  },
): DeskResult {
  save = ensureFans(save)
  if (!isTransferWindowOpen(save)) return { ok: false, message: transferWindowLabel(save) }
  if (isTransferFrozen(save)) {
    return {
      ok: false,
      message: `บอร์ดแช่แข็งตลาดถึง MD${save.board.transferFreezeUntil}`,
    }
  }

  const theirs = save.players.find((p) => p.id === theirPlayerId)
  const ours = save.players.find((p) => p.id === ourPlayerId)
  if (!theirs || !ours) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (ours.clubId !== save.humanClubId) return { ok: false, message: 'เลือกนักเตะในทีมคุณ' }
  if (theirs.clubId === save.humanClubId) return { ok: false, message: 'เป้าหมายต้องเป็นทีมอื่น' }
  if (ours.loanParentClubId || theirs.loanParentClubId) {
    return { ok: false, message: 'นักเตะที่ยืมอยู่แลกไม่ได้' }
  }

  const theirClub = save.clubs.find((c) => c.id === theirs.clubId)!
  const ourClub = save.clubs.find((c) => c.id === save.humanClubId)!
  const theirVal = estimatedValue(theirs)
  const ourVal = estimatedValue(ours)
  const gap = theirVal - ourVal
  const needCash = Math.max(0, Math.round(gap - 500_000))
  const cashTotal = Math.max(0, Math.round(cashAdjust))
  const paymentPreset = opts?.paymentPreset ?? 'full'
  const schedule = buildFeePaymentSchedule(cashTotal, paymentPreset, save.season)
  const cashNpv = sellerPresentValue(schedule, marketSellPremium(save, theirs) > 1)

  // มูลค่าที่ฝั่งเขาได้รับ = นักเตะเรา + NPV เงิน
  const packageNpv = ourVal + cashNpv
  if (packageNpv < theirVal * 0.85 || cashTotal < needCash * 0.85) {
    return {
      ok: false,
      message: `คลับเขาต้องการแพ็กเกจ ~${formatMoney(theirVal)} (คุณเสนอ NPV ~${formatMoney(packageNpv)} · เงินแนะนำอย่างน้อย ~${formatMoney(needCash)})`,
    }
  }

  // ตรวจรับสัญญาทั้งสองฝั่งก่อน commit — ถ้าฝ่ายใดไม่ผ่าน = rollback (ไม่แตะเซฟ)
  const theirWageOk = Math.round(theirs.wage * 1.05)
  const offerTheirWage = Math.round(theirs.wage * 1.08)
  if (offerTheirWage < theirWageOk) {
    return { ok: false, message: `${theirs.name} ปฏิเสธค่าเหนื่อย — ดีลโมฆะ` }
  }
  if (ours.squadRole === 'key' && (ours.happiness ?? 10) >= 14 && Math.random() < 0.35) {
    return {
      ok: false,
      message: `${ours.name} ปฏิเสธการย้าย (คีย์แมนยังมีความสุข) — ดีลโมฆะทั้งหมด`,
    }
  }
  if (isAgentLocked(ours, save) || isAgentLocked(theirs, save)) {
    return { ok: false, message: 'เอเยนต์ล็อกเจรจา — ดีลโมฆะ' }
  }

  if (schedule.dueNow > ourClub.balance) {
    return {
      ok: false,
      message: `งบไม่พอจ่ายงวดแรก ${formatMoney(schedule.dueNow)}`,
    }
  }

  const loanBack = Boolean(opts?.loanBackUntilNextSeason)
  const offerWage = Math.round(theirs.wage * 1.08)

  let players = save.players.map((p) => {
    if (p.id === ourPlayerId) {
      return {
        ...p,
        clubId: theirClub.id,
        loanParentClubId: null,
        morale: Math.min(20, p.morale + 1),
        wantAway: null,
      }
    }
    if (p.id === theirPlayerId) {
      return {
        ...p,
        clubId: loanBack ? theirClub.id : ourClub.id,
        loanParentClubId: loanBack ? ourClub.id : null,
        wage: offerWage,
        wageWeekly: offerWage,
        morale: Math.min(20, p.morale + 2),
        happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
        contractYears: 3,
        contractEndSeason: save.season + 3,
        wantAway: null,
      }
    }
    return p
  })

  let clubs = save.clubs.map((c) => {
    if (c.id === ourClub.id) return { ...c, balance: c.balance - schedule.dueNow }
    if (c.id === theirClub.id) return { ...c, balance: c.balance + schedule.dueNow }
    return c
  })

  let tacticsByClub = { ...save.tacticsByClub }
  // เราส่งคนออก — เติม XI เรา
  tacticsByClub[ourClub.id] = autoPickTactics(
    ourClub.id,
    players,
    tacticsByClub[ourClub.id]?.formation,
    tacticsByClub[ourClub.id]?.formationOop,
  )
  // ฝั่งเขาได้คนเรา / ส่งคนมา (ถ้า loan-back คนเขายังอยู่)
  tacticsByClub[theirClub.id] = autoPickTactics(
    theirClub.id,
    players,
    tacticsByClub[theirClub.id]?.formation,
    tacticsByClub[theirClub.id]?.formationOop,
  )

  const finance = ensureClubFinance(save)
  const fanIn = applyTransferToFans(
    save.fans,
    classifyTransferForFans(theirs.overall, 70, true, false, theirs.age),
    theirs.name,
  )
  let next: GameSave = {
    ...save,
    players,
    clubs,
    tacticsByClub,
    fans: fanIn.fans,
    clubFinance: {
      ...finance,
      transferOutSeason: (finance.transferOutSeason ?? 0) + schedule.dueNow,
    },
    inbox: [
      {
        id: uid('msg-ex'),
        date: save.currentDate,
        title: `แลกตัว: ได้ ${theirs.name}`,
        body: `ส่ง ${ours.name} (มูลค่า ~${formatMoney(ourVal)}) แลก ${theirs.name} (~${formatMoney(theirVal)}) · เงินรวม ${formatMoney(cashTotal)} · ${describePaymentScheduleTh(schedule)}${
          loanBack
            ? ` · ให้ ${theirClub.shortName} ยืม ${theirs.name} ใช้จนจบฤดูกาล`
            : ''
        }`,
        read: false,
      },
      fanInbox(save, 'เสียงจากอัฒจันทร์', fanIn.message),
      ...save.inbox,
    ].slice(0, 40),
  }

  next = attachFeeInstallments(next, {
    playerId: theirPlayerId,
    playerName: theirs.name,
    buyerClubId: ourClub.id,
    sellerClubId: theirClub.id,
    schedule,
  })

  if (loanBack) {
    next = {
      ...next,
      loans: [
        ...(next.loans ?? []),
        {
          id: uid('loan-ex-blb'),
          playerId: theirPlayerId,
          fromClubId: ourClub.id,
          toClubId: theirClub.id,
          startMatchday: save.matchday,
          endMatchday: 9999,
          wageShareParent: 1,
          fee: 0,
          optionToBuy: null,
          recallable: false,
          status: 'active' as const,
          kind: 'buy_loan_back' as const,
          purchaseFee: cashTotal,
        },
      ],
    }
  }

  next = recordHatredAfterLeave(next, theirClub.id, theirs, ourClub.id, {
    wasKey: theirs.squadRole === 'key',
  })
  next = recordHatredAfterLeave(next, ourClub.id, ours, theirClub.id, {
    wasKey: ours.squadRole === 'key',
  })

  return {
    ok: true,
    message: `แลกตัวสำเร็จ: ได้ ${theirs.name} ส่ง ${ours.name}${
      cashTotal > 0 ? ` + ${describePaymentScheduleTh(schedule)}` : ''
    }${loanBack ? ' · ยืมกลับจนจบฤดูกาล' : ''}`,
    save: next,
  }
}

/** เปิดประมูลขายนักเตะของคุณ */
export function startAuction(save: GameSave, playerId: string, minBid?: number): DeskResult {
  const player = save.players.find((p) => p.id === playerId)
  if (!player || player.clubId !== save.humanClubId) {
    return { ok: false, message: 'เลือกนักเตะในทีมคุณ' }
  }
  const desk = ensureTransferDesk(save)
  if (desk.auctions.some((a) => a.playerId === playerId && a.endsMatchday >= save.matchday)) {
    return { ok: false, message: 'มีประมูลค้างอยู่แล้ว' }
  }
  const min = minBid ?? Math.round(estimatedValue(player) * 0.9)
  return {
    ok: true,
    message: `เปิดประมูล ${player.name} เริ่ม ${formatMoney(min)}`,
    save: {
      ...save,
      transferDesk: {
        ...desk,
        auctions: [
          {
            id: uid('auc'),
            playerId,
            sellerClubId: save.humanClubId,
            minBid: min,
            currentBid: min,
            currentBidderId: null,
            endsMatchday: save.matchday + 2,
          },
          ...desk.auctions,
        ].slice(0, 15),
      },
    },
  }
}

/** AI ประมูล + ปิดดีลเมื่อครบ + clauses + shortlist rival bids */
export function processTransferDeskMatchday(save: GameSave, results: MatchResult[] = []): GameSave {
  let desk = ensureTransferDesk(save)
  let next = save

  // AI bids on our auctions
  const auctions = desk.auctions.map((a) => {
    if (a.endsMatchday < save.matchday) return a
    if (a.sellerClubId !== save.humanClubId) return a
    const bidders = save.clubs.filter((c) => c.controlledBy === 'ai' && c.balance > a.currentBid)
    if (!bidders.length || Math.random() > 0.55) return a
    const bidder = bidders[Math.floor(Math.random() * bidders.length)]
    const bump = Math.round(a.currentBid * (1.04 + Math.random() * 0.08))
    if (bidder.balance < bump) return a
    return {
      ...a,
      currentBid: bump,
      currentBidderId: bidder.id,
    }
  })

  // resolve ended
  const still = []
  for (const a of auctions) {
    if (a.endsMatchday > save.matchday) {
      still.push(a)
      continue
    }
    if (a.currentBidderId && a.currentBid >= a.minBid) {
      const sold = sellPlayerToAi(next, a.playerId, a.currentBid)
      if (sold.ok) {
        next = sold.save
        next = {
          ...next,
          inbox: [
            {
              id: uid('msg'),
              date: save.currentDate,
              title: 'ปิดประมูล',
              body: sold.message,
              read: false,
            },
            ...next.inbox,
          ].slice(0, 40),
        }
      }
    } else {
      next = {
        ...next,
        inbox: [
          {
            id: uid('msg'),
            date: save.currentDate,
            title: 'ประมูลไม่สำเร็จ',
            body: 'ไม่มีผู้ประมูลถึงราคาขั้นต่ำ',
            read: false,
          },
          ...next.inbox,
        ].slice(0, 40),
      }
    }
  }

  // expire offers
  const offers = desk.offers.map((o) =>
    o.status === 'countered' && o.expiresMatchday < save.matchday
      ? { ...o, status: 'rejected' as const }
      : o,
  )

  desk = { ...desk, offers, auctions: still, clauses: desk.clauses ?? [] }
  next = { ...next, transferDesk: desk }
  const matchResults =
    results.length > 0
      ? results
      : next.lastHumanResult
        ? [next.lastHumanResult]
        : []
  next = tickPerformanceClauses(next, matchResults)

  // ความสนใจตลาด: shortlist · ฟอร์มร้อน · listed/wantAway · คลาย heat · ปาดหน้า
  next = tickMarketHeatAndGazumps(next)

  // AI สัญญาใจกับดาวในทีมคุณ (tapping-up สองทาง)
  next = processAiSecretHandshakes(next)

  // ROFR: มีทีมยื่นซื้อนักเตะที่คุณเคยขาย (ถือสิทธิ์ปฏิเสธครั้งแรก)
  if (Math.random() < 0.4) {
    const rofrTargets = next.players.filter(
      (p) =>
        p.firstRefusalClubId === next.humanClubId &&
        p.clubId !== next.humanClubId &&
        !p.loanParentClubId,
    )
    if (rofrTargets.length) {
      const target = rofrTargets[Math.floor(Math.random() * rofrTargets.length)]!
      const bidder = next.clubs
        .filter((c) => c.controlledBy === 'ai' && c.id !== target.clubId)
        .sort((a, b) => b.reputation - a.reputation)[0]
      if (bidder) {
        const fee = Math.round(estimatedValue(target, next) * (0.95 + Math.random() * 0.2))
        next = offerRofrMatchToHuman(next, target.id, fee, bidder.id)
      }
    }
  }

  // ข่าวอยากย้ายสาธารณะ → AI แห่ยื่น
  next = processWantAwayAiBids(next)

  // ลองจ่ายงวดค่าตัวที่ครบกำหนด / ค้าง
  next = tickFeeInstallments(next)
  next = tickIntlCapsClauses(next)

  return next
}

function pushRomano(save: GameSave, story: Omit<MediaItem, 'channel'> & { channel?: MediaItem['channel'] }): GameSave {
  const media = ensureMediaFeed(save)
  const item: MediaItem = {
    ...story,
    channel: 'romano',
  }
  return {
    ...save,
    media: {
      ...media,
      romano: [item, ...media.romano].slice(0, 40),
    },
  }
}

/**
 * มิติตลาด: ดัน/คลาย marketHeat · ข่าวสนใจ · AI ปาดหน้าข้อเสนอซื้อที่ค้าง
 */
export function tickMarketHeatAndGazumps(save: GameSave): GameSave {
  let next = save
  const inbox: GameSave['inbox'] = []
  const heatById = new Map<string, number>()

  const getHeat = (id: string, base: number) => heatById.get(id) ?? base
  const setHeat = (id: string, h: number) => heatById.set(id, clampMarketHeat(h))

  for (const p of next.players) {
    setHeat(p.id, p.marketHeat ?? 0)
  }

  // 1) คู่แข่งสนใจคนใน shortlist
  const shortlist = next.shortlist?.entries ?? []
  if (shortlist.length && Math.random() < 0.4) {
    const entry = shortlist[Math.floor(Math.random() * shortlist.length)]!
    const target = next.players.find((p) => p.id === entry.playerId)
    if (target && target.clubId !== next.humanClubId) {
      const rival = next.clubs
        .filter((c) => c.controlledBy === 'ai' && c.id !== target.clubId && c.id !== next.humanClubId)
        .sort((a, b) => b.reputation - a.reputation)[0]
      if (rival) {
        const h = getHeat(target.id, target.marketHeat ?? 0)
        setHeat(target.id, h + 3 + Math.floor(Math.random() * 3))
        const bump = Math.round(estimatedValue({ ...target, marketHeat: getHeat(target.id, h) }, next))
        inbox.push({
          id: uid('msg-sl'),
          date: next.currentDate,
          title: 'คู่แข่งสนใจ Shortlist',
          body: `${rival.name} สนใจ ${target.name} — มูลค่าตลาดขยับ ~${formatMoney(bump)} · รีบเจรจาก่อนโดนแย่ง`,
          read: false,
        })
        next = pushRomano(next, {
          id: uid('rom-heat'),
          date: next.currentDate,
          headline: `วงใน: ${rival.shortName} จับตา ${target.name}`,
          body: `แหล่งข่าวใกล้ตลาดบอกว่ามีสโมสรอื่นคุยเบื้องต้น — ความสนใจตลาดเพิ่มขึ้น`,
          tone: 'rumor',
          reliability: Math.round(45 + Math.random() * 30),
          subjectName: target.name,
          tags: ['transfer', 'market_heat', target.id],
        })
      }
    }
  }

  // 2) ฟอร์มร้อน + OVR สูง → สุ่มความสนใจ
  if (Math.random() < 0.28) {
    const hot = next.players
      .filter(
        (p) =>
          p.clubId !== next.humanClubId &&
          (p.form ?? 10) >= 15 &&
          p.overall >= 74 &&
          !p.loanParentClubId,
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 8)
    if (hot.length) {
      const target = hot[Math.floor(Math.random() * hot.length)]!
      setHeat(target.id, getHeat(target.id, target.marketHeat ?? 0) + 2 + Math.floor(Math.random() * 2))
      if (Math.random() < 0.55) {
        inbox.push({
          id: uid('msg-form'),
          date: next.currentDate,
          title: 'ข่าวสนใจซื้อ',
          body: `${target.name} ฟอร์มร้อน (${target.form}/20) — มีสโมสรสอบถามต้นสังกัด`,
          read: false,
        })
      }
    }
  }

  // 3) ขึ้นขาย / want away สาธารณะ → +heat
  for (const p of next.players) {
    let delta = 0
    if (p.transferListed) delta += 1
    if (p.wantAway?.active && p.wantAway.publicNews) delta += 2
    else if (p.wantAway?.active) delta += 1
    if (delta > 0 && Math.random() < 0.5) {
      setHeat(p.id, getHeat(p.id, p.marketHeat ?? 0) + delta)
    }
  }

  // 4) คลาย heat ทุกแมตช์เดย์
  for (const p of next.players) {
    const h = getHeat(p.id, p.marketHeat ?? 0)
    if (h <= 0) continue
    const decay = 1 + (Math.random() < 0.35 ? 1 : 0)
    setHeat(p.id, h - decay)
  }

  next = {
    ...next,
    players: next.players.map((p) => {
      const h = heatById.get(p.id)
      if (h == null || h === (p.marketHeat ?? 0)) return p
      return { ...p, marketHeat: h }
    }),
  }

  // 5) ปาดหน้า: AI ยื่นสูงกว่าข้อเสนอซื้อของ human ที่ค้าง
  const desk = ensureTransferDesk(next)
  const openBuys = desk.offers.filter(
    (o) =>
      (o.status === 'pending' || o.status === 'countered') &&
      o.kind === 'buy' &&
      o.toClubId === next.humanClubId,
  )

  if (openBuys.length && Math.random() < 0.45) {
    const offer = openBuys[Math.floor(Math.random() * openBuys.length)]!
    const target = next.players.find((p) => p.id === offer.playerId)
    if (target && target.clubId !== next.humanClubId) {
      const heat = target.marketHeat ?? 0
      const form = target.form ?? 10
      const gazumpChance = 0.2 + heat / 40 + (form >= 15 ? 0.15 : 0) + (target.overall >= 78 ? 0.1 : 0)
      if (Math.random() < gazumpChance) {
        const rival = next.clubs
          .filter(
            (c) =>
              c.controlledBy === 'ai' &&
              c.id !== target.clubId &&
              c.id !== next.humanClubId,
          )
          .sort((a, b) => b.reputation - a.reputation)[Math.floor(Math.random() * 3)]
        if (rival) {
          const humanFee = offer.counterFee ?? offer.fee
          const snipedFee = Math.round(humanFee * (1.08 + Math.random() * 0.12))
          next = {
            ...next,
            players: next.players.map((p) =>
              p.id === target.id ? bumpMarketHeat(p, 4) : p,
            ),
            transferDesk: {
              ...desk,
              offers: desk.offers.map((o) =>
                o.id === offer.id
                  ? {
                      ...o,
                      status: 'rejected' as const,
                      note: `โดนปาดหน้าโดย ${rival.shortName} (~${formatMoney(snipedFee)})`,
                    }
                  : o,
              ),
            },
          }
          inbox.push({
            id: uid('msg-gz'),
            date: next.currentDate,
            title: 'โดนปาดหน้า!',
            body: `${rival.name} ยื่น ${formatMoney(snipedFee)} สำหรับ ${target.name} — สูงกว่าข้อคุณ · ดีลของคุณถูกปฏิเสธ ต้นสังกัดขึ้นราคาจากความสนใจ`,
            read: false,
          })
          next = pushRomano(next, {
            id: uid('rom-gz'),
            date: next.currentDate,
            headline: `Here we go?: ${rival.shortName} ปาดหน้าดีล ${target.name}`,
            body: `มีข้อเสนอสูงกว่าที่ ${next.clubs.find((c) => c.id === next.humanClubId)?.shortName ?? 'คุณ'} ยื่นไว้ — ความเชื่อมั่นข่าวสูง`,
            tone: 'rumor',
            reliability: Math.round(70 + Math.random() * 20),
            subjectName: target.name,
            tags: ['transfer', 'gazump', target.id],
          })
          next = pushNews(next, {
            id: uid('news-gz'),
            date: next.currentDate,
            channel: 'news',
            headline: `${rival.shortName} แย่ง ${target.name} จากวงเจรจา`,
            body: `ตลาดเดือด — ค่าตัวถูกดันขึ้นจากความสนใจหลายฝ่าย`,
            tone: 'rumor',
            tags: ['gazump', target.id],
            subjectName: target.name,
          })
        }
      }
    }
  }

  if (inbox.length) {
    next = {
      ...next,
      inbox: [...inbox, ...next.inbox].slice(0, 40),
    }
  }

  return next
}
