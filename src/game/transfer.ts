import type { Club, GameSave, InboxMessage, Player, Tactics } from './types'
import { autoPickTactics } from './seed'
import { formatMoney } from '@/lib/format'
import {
  applyTransferToFans,
  classifyTransferForFans,
  ensureFans,
  fanInbox,
} from './fans'
import { canAffordTransfer } from './financeFfp'
import { newsAfterTransfer, newsAfterContract, pushNews } from './media'
import { injuryHistoryPenalty } from './medical'
import { ensureScouting, markPlayerAsAlumni } from './scouting'

export function estimatedValue(player: Player): number {
  const ageFactor = player.age <= 24 ? 1.25 : player.age <= 29 ? 1.0 : player.age <= 32 ? 0.7 : 0.45
  const injuryFactor = injuryHistoryPenalty(player) * (player.injuryDays > 0 ? 0.85 : 1)
  return Math.round(player.overall ** 2 * 900 * ageFactor * injuryFactor)
}

export function minAcceptableFee(player: Player, seller: Club): number {
  return Math.round(estimatedValue(player) * (0.85 + seller.reputation / 400))
}

export type OfferResult =
  | { ok: true; message: string; save: GameSave }
  | { ok: false; message: string }

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
): OfferResult {
  save = ensureFans(save)
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId === save.humanClubId) {
    return { ok: false, message: 'นักเตะคนนี้อยู่ในทีมคุณแล้ว' }
  }

  const seller = save.clubs.find((c) => c.id === player.clubId)!
  const buyer = save.clubs.find((c) => c.id === save.humanClubId)!
  const minFee = minAcceptableFee(player, seller)

  if (offerFee > buyer.balance) {
    return { ok: false, message: `งบไม่พอ (มี ${formatMoney(buyer.balance)})` }
  }

  const ffp = canAffordTransfer(save, offerFee, offerWage)
  if (!ffp.ok) return { ok: false, message: `FFP: ${ffp.reason}` }

  const sellerDepth = save.players.filter(
    (p) => p.clubId === seller.id && p.position === player.position,
  ).length
  const depthPenalty = sellerDepth <= 2 ? 1.25 : 1
  const rep = save.managerReputation ?? 50
  const repDiscount = 1 - (rep - 50) / 400
  const acceptFee = minFee * depthPenalty * Math.max(0.9, Math.min(1.08, repDiscount))

  if (offerFee < acceptFee * 0.92) {
    return {
      ok: false,
      message: `${seller.name} ปฏิเสธค่าตัว — ต้องการประมาณ ${formatMoney(acceptFee)} ขึ้นไป`,
    }
  }

  const wageFloor = Math.round(player.wage * 1.05)
  if (offerWage < wageFloor) {
    return {
      ok: false,
      message: `นักเตะขอค่าเหนื่อยอย่างน้อย ${formatMoney(wageFloor)}/สัปดาห์`,
    }
  }

  let players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          clubId: buyer.id,
          wage: offerWage,
          morale: Math.min(20, p.morale + 2),
          happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
          contractYears: contractYears,
          contractEndSeason: save.season + contractYears,
          releaseClause:
            offerFee > estimatedValue(p) * 1.4
              ? Math.round(offerFee * 1.5)
              : (p.releaseClause ?? Math.round(offerFee * 1.8)),
        }
      : p,
  )

  let clubs = save.clubs.map((c) => {
    if (c.id === buyer.id) return { ...c, balance: c.balance - offerFee }
    if (c.id === seller.id) return { ...c, balance: c.balance + offerFee }
    return c
  })

  let tacticsByClub = { ...save.tacticsByClub }
  tacticsByClub[seller.id] = ensureXiFilled(
    seller.id,
    players,
    stripFromTactics(tacticsByClub[seller.id], playerId),
  )
  tacticsByClub[buyer.id] = ensureXiFilled(buyer.id, players, {
    ...tacticsByClub[buyer.id],
    bench: [...tacticsByClub[buyer.id].bench, playerId].slice(0, 7),
  })

  const kind = classifyTransferForFans(
    player.overall,
    squadAvg(save, buyer.id),
    true,
    false,
    player.age,
  )
  const fanResult = applyTransferToFans(save.fans, kind, player.name)

  const inbox: InboxMessage[] = [
    {
      id: `msg-buy-${Date.now()}`,
      date: save.currentDate,
      title: `เซ็นสัญญา: ${player.name}`,
      body: `ซื้อจาก ${seller.name} ด้วยค่าตัว ${formatMoney(offerFee)} · ค่าเหนื่อย ${formatMoney(offerWage)}/สัปดาห์ · สัญญา ${contractYears} ปี (หมด ${save.season + contractYears})`,
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
    scouting: {
      ...ensureScouting(save),
      byPlayer: { ...ensureScouting(save).byPlayer, [playerId]: 100 },
    },
    inbox: inbox.slice(0, 40),
  }
  next = pushNews(next, newsAfterTransfer(next, player.name, true))

  return {
    ok: true,
    message: `สำเร็จ! ${player.name} ย้ายมาแล้ว — ${fanResult.message}`,
    save: next,
  }
}

/** ขายนักเตะให้คลับ AI */
export function sellPlayerToAi(save: GameSave, playerId: string, askFee: number): OfferResult {
  save = ensureFans(save)
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId !== save.humanClubId) {
    return { ok: false, message: 'ขายได้เฉพาะนักเตะในทีมคุณ' }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const value = estimatedValue(player)
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
    .sort((a, b) => b.reputation - a.reputation)

  if (buyers.length === 0) {
    return { ok: false, message: 'ไม่มีคลับ AI ที่มีงบพอสนใจข้อเสนอนี้' }
  }

  const maxReasonable = Math.round(value * 1.35)
  if (askFee > maxReasonable) {
    return {
      ok: false,
      message: `ราคาสูงเกินไป — ตลาดประเมินราว ${formatMoney(value)} (สูงสุดที่ AI พอรับได้ ~${formatMoney(maxReasonable)})`,
    }
  }

  const buyer = buyers[Math.floor(Math.random() * Math.min(5, buyers.length))]
  const acceptChance = Math.min(0.95, 0.35 + (value / Math.max(askFee, 1)) * 0.5)
  if (Math.random() > acceptChance && askFee > value) {
    return {
      ok: false,
      message: `${buyer.name} สนใจแต่ยังไม่ยอมจ่าย ${formatMoney(askFee)} — ลองลดราคา`,
    }
  }

  let players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          clubId: buyer.id,
          morale: Math.max(1, p.morale - 1),
          happiness: Math.max(1, (p.happiness ?? p.morale) - 1),
        }
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
  let fansAfter = fanResult.fans
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

  let next: GameSave = {
    ...save,
    players,
    clubs,
    tacticsByClub,
    fans: fansAfter,
    inbox: inbox.slice(0, 40),
    scouting: markPlayerAsAlumni(ensureScouting(save), playerId),
  }
  next = pushNews(next, newsAfterTransfer(next, player.name, false))

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
    .filter((p) => p.clubId !== save.humanClubId && !p.loanParentClubId)
    .map((p) => {
      const club = save.clubs.find((c) => c.id === p.clubId)
      return {
        ...p,
        clubName: club?.name ?? '—',
        value: estimatedValue(p),
        originLeague: club?.originLeagueId,
      }
    })
    .sort((a, b) => b.overall - a.overall)
}

/** ต่อสัญญา / ปรับค่าเหนื่อยนักเตะในทีม */
export function renewContract(
  save: GameSave,
  playerId: string,
  newWage: number,
  years: number,
): OfferResult {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId !== save.humanClubId) {
    return { ok: false, message: 'ต่อสัญญาได้เฉพาะนักเตะในทีมคุณ' }
  }
  if (years < 1 || years > 5) return { ok: false, message: 'สัญญาระหว่าง 1–5 ปี' }

  const floor = Math.round(player.wage * 0.95)
  const ambitionBump = player.overall >= 78 ? 1.08 : 1
  const want = Math.round(player.wage * ambitionBump)
  if (newWage < floor) {
    return { ok: false, message: `ค่าเหนื่อยต่ำเกินไป (อย่างน้อย ${formatMoney(floor)})` }
  }
  if (newWage < want * 0.92 && years < 3) {
    return {
      ok: false,
      message: `${player.name} อยากได้ ~${formatMoney(want)}/สัปดาห์ หรือสัญญา ≥3 ปี`,
    }
  }

  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const otherWages = save.players
    .filter((p) => p.clubId === club.id && p.id !== playerId)
    .reduce((s, p) => s + p.wage, 0)
  if (otherWages + newWage > club.wageBudgetWeekly * 1.15) {
    return { ok: false, message: 'เกินงบค่าเหนื่อยรายสัปดาห์ของสโมสร' }
  }

  const players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          wage: newWage,
          contractYears: years,
          contractEndSeason: save.season + years,
          morale: Math.min(20, p.morale + 1),
          happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
        }
      : p,
  )

  return {
    ok: true,
    message: `ต่อสัญญา ${player.name} สำเร็จ · ${years} ปี · ${formatMoney(newWage)}/สัปดาห์`,
    save: pushNews(
      {
        ...save,
        players,
        inbox: [
          {
            id: `msg-renew-${Date.now()}`,
            date: save.currentDate,
            title: `ต่อสัญญา: ${player.name}`,
            body: `สัญญาใหม่ ${years} ปี หมดฤดูกาล ${save.season + years} · ค่าเหนื่อย ${formatMoney(newWage)}/สัปดาห์`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
      newsAfterContract(save, player.name, years),
    ),
  }
}
