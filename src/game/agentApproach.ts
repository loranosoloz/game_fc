/**
 * เอเยนต์มายื่นขายลูกค้าให้ human
 * — เอเยนต์คนเดียวดูแลหลายนักเตะได้ · ปัจจัยหลายอย่างกำหนดว่าจะมาคุย
 */
import type { GameSave, PendingTransferOffer, Player } from './types'
import { formatMoney } from '@/lib/format'
import {
  agentClientKey,
  agentStyleFor,
  clientsOfAgent,
  resolveAgentIdentity,
  withAgentIdentity,
} from './agents'
import {
  affinityWageMul,
  clubDesireScore,
  isAvoidClub,
  sellerBlocksBuyer,
  withEnsuredAffinity,
} from './playerAmbition'
import { loyaltyApproachPenalty } from './playerLoyalty'
import { estimatedValue, negotiationWageMul } from './transfer'
import { ensureTransferDesk } from './transferDesk'
import { isTransferWindowOpen } from './transferWindow'
import { yearsLeftOnContract } from './contractLifecycle'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export type ApproachScore = {
  player: Player
  score: number
  reasons: string[]
}

/** คะแนนว่าเอเยนต์จะยื่นนักเตะคนนี้ให้ human แค่ไหน */
export function scoreAgentApproachCandidate(
  save: GameSave,
  player: Player,
): ApproachScore | null {
  if (player.clubId === save.humanClubId || player.clubId === '__free__') return null
  if (player.loanParentClubId) return null
  if ((player.agentLockUntilMatchday ?? -1) >= save.matchday) return null

  const p = withEnsuredAffinity(withAgentIdentity(player), save.clubs)
  if (isAvoidClub(p, save.humanClubId)) return null

  const seller = save.clubs.find((c) => c.id === p.clubId)
  if (!seller) return null
  if (sellerBlocksBuyer(seller, save.humanClubId, save.matchday)) return null

  const desire = clubDesireScore(p, save.humanClubId)
  const happy = p.happiness ?? p.morale ?? 10
  const style = agentStyleFor(p)
  const left = yearsLeftOnContract(p, save.season)
  const reasons: string[] = []
  let score = 0

  if (p.wantAway?.active) {
    const inten = p.wantAway.intensity ?? 8
    score += 18 + inten
    reasons.push(p.wantAway.publicNews ? 'อยากย้าย (ข่าวสาธารณะ)' : 'อยากย้าย')
  }
  if (happy <= 8) {
    score += 16
    reasons.push('ไม่พอใจในทีม')
  } else if (happy <= 11) {
    score += 8
    reasons.push('ความสุขต่ำ')
  }
  if (p.refuseContractRenewal) {
    score += 14
    reasons.push('ไม่ต่อสัญญา')
  }
  if (p.transferListed) {
    score += 12
    reasons.push('ขึ้นขาย')
  }
  if (desire >= 1) {
    score += 22
    reasons.push('ทีมคุณคือทีมในฝัน')
  } else if (desire >= 0.4) {
    score += 12
    reasons.push('สนใจสโมสรคุณ')
  } else if (desire < 0) {
    score -= 20
  }
  if (left <= 1) {
    score += 10
    reasons.push('สัญญาใกล้หมด')
  }
  if ((p.form ?? 10) >= 15) {
    score += 6
    reasons.push('ฟอร์มร้อน — เอเยนต์รีบขายแพง')
  }
  if ((p.marketHeat ?? 0) >= 10) {
    score += 5
    reasons.push('ตลาดสนใจ')
  }

  // นิสัยเอเยนต์
  if (style === 'greedy') score += 8
  if (style === 'aggressive') score += 6
  if (style === 'loyal') score -= 6
  if (p.agentKind === 'family') {
    score -= 10
    if (happy > 12 && !p.wantAway?.active) score -= 15
  }
  score += loyaltyApproachPenalty(p)
  if ((p.clubLoyalty ?? 10) >= 15) {
    reasons.push('ภักดียังสูง — เอเยนต์ยื่นยาก')
  } else if ((p.clubLoyalty ?? 10) <= 6) {
    reasons.push('ภักดีต่ำ')
  }

  // ชื่อเสียงสโมสรเรา vs ต้นสังกัด
  const human = save.clubs.find((c) => c.id === save.humanClubId)
  if (human && seller.reputation - human.reputation > 18 && desire < 0.4) {
    score -= 12
  } else if (human && human.reputation >= seller.reputation - 5) {
    score += 4
  }

  if (score < 18) return null
  return { player: p, score, reasons }
}

function askFeeForApproach(save: GameSave, player: Player, score: number): number {
  const value = estimatedValue(player, save)
  const style = agentStyleFor(player)
  let mul = 1.02
  if (style === 'greedy') mul = 1.12
  if (style === 'aggressive') mul = 1.08
  if (style === 'loyal') mul = 0.97
  if (player.wantAway?.active && (player.happiness ?? 10) <= 8) mul *= 0.9
  if (player.transferListed) mul *= 0.92
  if (score >= 50) mul *= 0.94
  if ((player.form ?? 10) >= 16) mul *= 1.06
  return Math.max(100_000, Math.round(value * mul))
}

/**
 * หลังแมตช์เดย์: เอเยนต์สุ่มมายื่นขายลูกค้า (กลุ่มตามเอเยนต์คนเดียวกัน)
 */
export function tickAgentApproaches(save: GameSave): GameSave {
  if (!isTransferWindowOpen(save)) return save
  // ไม่ยื่นทุกแมตช์เดย์
  if (Math.random() > 0.42) return save

  const desk = ensureTransferDesk(save)
  const pendingPlayerIds = new Set(
    desk.offers
      .filter(
        (o) =>
          o.source === 'agent_approach' &&
          (o.status === 'pending' || o.status === 'countered') &&
          o.expiresMatchday >= save.matchday,
      )
      .map((o) => o.playerId),
  )

  const watch = save.agentApproachWatch ?? {
    lastByAgentKey: {},
    lastByPlayerId: {},
  }

  // จัดกลุ่มลูกค้าตามเอเยนต์
  const byAgent = new Map<string, Player[]>()
  for (const raw of save.players) {
    if (raw.clubId === save.humanClubId) continue
    const p = withAgentIdentity(raw)
    const key = agentClientKey(p)
    const list = byAgent.get(key) ?? []
    list.push(p)
    byAgent.set(key, list)
  }

  type Pitch = {
    key: string
    scored: ApproachScore
    clients: number
    idn: ReturnType<typeof resolveAgentIdentity>
  }
  const pitches: Pitch[] = []

  for (const [key, clients] of byAgent) {
    const lastAg = watch.lastByAgentKey[key]
    if (lastAg != null && save.matchday - lastAg < 3) continue

    const candidates: ApproachScore[] = []
    for (const c of clients) {
      if (pendingPlayerIds.has(c.id)) continue
      const lastP = watch.lastByPlayerId[c.id]
      if (lastP != null && save.matchday - lastP < 5) continue
      const scored = scoreAgentApproachCandidate(save, c)
      if (scored) candidates.push(scored)
    }
    if (!candidates.length) continue
    candidates.sort((a, b) => b.score - a.score)
    const best = candidates[0]!
    // เอเยนต์ใหญ่มีลูกค้าหลายคน → โอกาสคุยสูงขึ้นเล็กน้อย
    const rosterBoost = Math.min(8, clients.length)
    if (best.score + rosterBoost < 22) continue
    const idn = resolveAgentIdentity(best.player)
    const style = agentStyleFor(best.player)
    let chance = 0.2 + best.score / 120 + clients.length * 0.015
    if (style === 'greedy') chance += 0.12
    if (style === 'aggressive') chance += 0.08
    if (idn.agentKind === 'family') chance *= 0.55
    if (Math.random() > Math.min(0.72, chance)) continue
    pitches.push({
      key,
      scored: { ...best, score: best.score + rosterBoost },
      clients: clients.length,
      idn,
    })
  }

  if (!pitches.length) return save
  pitches.sort((a, b) => b.scored.score - a.scored.score)
  const pickN = Math.min(2, pitches.length)
  const chosen = pitches.slice(0, pickN)

  const newOffers: PendingTransferOffer[] = []
  const inboxNotes: string[] = []
  const lastByAgentKey = { ...watch.lastByAgentKey }
  const lastByPlayerId = { ...watch.lastByPlayerId }

  for (const pitch of chosen) {
    const p = pitch.scored.player
    const fee = askFeeForApproach(save, p, pitch.scored.score)
    const wage = Math.round(
      p.wage * 1.05 * negotiationWageMul(p) * affinityWageMul(p, save.humanClubId),
    )
    const years = Math.max(2, Math.min(4, (p.contractYears ?? 2) + 1))
    const reason = pitch.scored.reasons.slice(0, 3).join(' · ')
    const offer: PendingTransferOffer = {
      id: uid('ag-offer'),
      kind: 'buy',
      playerId: p.id,
      fromClubId: p.clubId,
      toClubId: save.humanClubId,
      fee,
      wage,
      contractYears: years,
      appearanceAddon: 0,
      sellOnPercent: 0,
      status: 'pending',
      expiresMatchday: save.matchday + 4,
      source: 'agent_approach',
      agentName: pitch.idn.agentName,
      agentAgency: pitch.idn.agentAgency,
      agentClientCount: pitch.clients,
      approachReasonTh: reason,
      note: `${pitch.idn.agentName} (${pitch.idn.agentAgency}) ยื่นขาย ${p.name} · ขอ ${formatMoney(fee)} · ค่าเหนื่อย ~${formatMoney(wage)} · ดูแลลูกค้า ${pitch.clients} คนในตลาด · ${reason}`,
    }
    newOffers.push(offer)
    lastByAgentKey[pitch.key] = save.matchday
    lastByPlayerId[p.id] = save.matchday
    inboxNotes.push(
      `${pitch.idn.agentName}: เสนอ ${p.name} (${formatMoney(fee)}) — ${reason}`,
    )
  }

  return {
    ...save,
    agentApproachWatch: { lastByAgentKey, lastByPlayerId },
    transferDesk: {
      ...desk,
      offers: [...newOffers, ...desk.offers].slice(0, 40),
    },
    inbox: [
      {
        id: uid('msg-ag'),
        date: save.currentDate,
        title: `เอเยนต์มาคุย · ${newOffers.length} ข้อเสนอ`,
        body: inboxNotes.join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

export function listAgentApproachOffers(save: GameSave): PendingTransferOffer[] {
  const desk = ensureTransferDesk(save)
  return desk.offers.filter(
    (o) =>
      o.source === 'agent_approach' &&
      o.status === 'pending' &&
      o.toClubId === save.humanClubId &&
      o.expiresMatchday >= save.matchday,
  )
}

export function declineAgentApproach(
  save: GameSave,
  offerId: string,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const desk = ensureTransferDesk(save)
  const offer = desk.offers.find((o) => o.id === offerId && o.source === 'agent_approach')
  if (!offer || offer.status !== 'pending') {
    return { ok: false, message: 'ไม่พบข้อเสนอเอเยนต์' }
  }
  return {
    ok: true,
    message: `ปฏิเสธข้อเสนอของ ${offer.agentName ?? 'เอเยนต์'}`,
    save: {
      ...save,
      transferDesk: {
        ...desk,
        offers: desk.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
      },
    },
  }
}

/** จำนวนลูกค้าของเอเยนต์คนนี้ในเซฟ (ทุกสโมสร) */
export function agentRosterSize(save: GameSave, player: Player): number {
  return clientsOfAgent(save.players, player).length
}
