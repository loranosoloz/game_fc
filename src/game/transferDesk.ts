import type {
  GameSave,
  MatchResult,
  PendingTransferOffer,
  TransferAddonPackage,
  TransferDeskState,
} from './types'
import { buyPlayerFromAi, estimatedValue, sellPlayerToAi } from './transfer'
import { formatMoney } from '@/lib/format'
import { isTransferWindowOpen, transferWindowLabel } from './transferWindow'
import { attachClausesAfterBuy, tickPerformanceClauses, resolveAddonPackage } from './transferClauses'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function createTransferDesk(): TransferDeskState {
  return { offers: [], auctions: [], clauses: [] }
}

export function ensureTransferDesk(save: GameSave): TransferDeskState {
  const d = save.transferDesk ?? createTransferDesk()
  return { ...d, clauses: d.clauses ?? [] }
}

export type DeskResult =
  | { ok: true; message: string; save: GameSave }
  | { ok: false; message: string }

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
): DeskResult {
  if (!isTransferWindowOpen(save)) return { ok: false, message: transferWindowLabel(save) }
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId === save.humanClubId) return { ok: false, message: 'อยู่ในทีมแล้ว' }

  const seller = save.clubs.find((c) => c.id === player.clubId)!
  const value = estimatedValue(player)
  const want = Math.round(value * (0.95 + seller.reputation / 350))
  const pkg = resolveAddonPackage(addons, appearanceAddon, sellOnPercent)

  // ถ้าราคาใกล้เคียง → ปิดทันที (หัก add-on เล็กน้อยจากความพึงพอใจ)
  if (fee >= want * 0.97 && wage >= player.wage * 1.05) {
    const closed = buyPlayerFromAi(save, playerId, fee, wage, contractYears)
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

  // counter หรือปฏิเสธ
  if (fee < want * 0.75) {
    return {
      ok: false,
      message: `${seller.name} ปฏิเสธทันที — ต่ำเกินไป (เป้า ~${formatMoney(want)})`,
    }
  }

  const counter = Math.round(want * (0.98 + Math.random() * 0.08))
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
    note: `${seller.name} โต้กลับค่าตัว ${formatMoney(counter)}`,
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

/** แลกนักเตะ + ค่าตัวปรับ */
export function proposePlayerExchange(
  save: GameSave,
  theirPlayerId: string,
  ourPlayerId: string,
  cashAdjust = 0,
): DeskResult {
  const theirs = save.players.find((p) => p.id === theirPlayerId)
  const ours = save.players.find((p) => p.id === ourPlayerId)
  if (!theirs || !ours) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (ours.clubId !== save.humanClubId) return { ok: false, message: 'เลือกนักเตะในทีมคุณ' }
  if (theirs.clubId === save.humanClubId) return { ok: false, message: 'เป้าหมายต้องเป็นทีมอื่น' }

  const theirVal = estimatedValue(theirs)
  const ourVal = estimatedValue(ours)
  const gap = theirVal - ourVal
  const needCash = Math.max(0, gap - 500_000)
  if (cashAdjust < needCash * 0.85) {
    return {
      ok: false,
      message: `คลับเขาต้องการเงินเพิ่มอย่างน้อย ~${formatMoney(needCash)} (หรือคนที่มีค่าใกล้กัน)`,
    }
  }

  // sell ours to them conceptually then buy theirs
  const sell = sellPlayerToAi(save, ourPlayerId, Math.round(ourVal * 0.9))
  if (!sell.ok) return sell
  const buy = buyPlayerFromAi(
    sell.save,
    theirPlayerId,
    Math.round(theirVal * 0.9 + cashAdjust),
    Math.round(theirs.wage * 1.08),
    3,
  )
  if (!buy.ok) return { ok: false, message: buy.message }

  return {
    ok: true,
    message: `แลกตัวสำเร็จ: ได้ ${theirs.name} ส่ง ${ours.name}`,
    save: buy.save,
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

  // Shortlist rival interest — AI กดดันค่าตัว
  const shortlist = next.shortlist?.entries ?? []
  if (shortlist.length && Math.random() < 0.35) {
    const entry = shortlist[Math.floor(Math.random() * shortlist.length)]
    const target = next.players.find((p) => p.id === entry.playerId)
    if (target && target.clubId !== next.humanClubId) {
      const rival = next.clubs
        .filter((c) => c.controlledBy === 'ai' && c.id !== target.clubId)
        .sort((a, b) => b.reputation - a.reputation)[0]
      if (rival) {
        const bump = Math.round(estimatedValue(target) * (1.05 + Math.random() * 0.12))
        next = {
          ...next,
          inbox: [
            {
              id: uid('msg-sl'),
              date: next.currentDate,
              title: 'คู่แข่งสนใจ Shortlist',
              body: `${rival.name} สนใจ ${target.name} — ตลาดประเมินแรงขึ้น ~${formatMoney(bump)} · รีบเจรจาก่อนโดนแย่ง`,
              read: false,
            },
            ...next.inbox,
          ].slice(0, 40),
        }
      }
    }
  }

  return next
}
