import type { GameSave } from './types'
import { ensureClubFinance, weeklyWageBillForClub } from './playerEconomy'

/** Soft→Hard FFP: ขาดทุนฤดูกาล · ค่าเหนื่อย · งบซื้อสุทธิ — ซาอุฯ ยกเว้น */
export function ffpStatus(save: GameSave) {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const leagueId = save.leagueId || club.originLeagueId || 'eng'

  /** Saudi Pro League — เงินถุงเงินถัง ไม่บังคับ FFP */
  if (leagueId === 'sau') {
    const finance = ensureClubFinance(save)
    const wages = weeklyWageBillForClub(save.players, club.id, save.loans)
    return {
      loss: club.seasonStartBalance - club.balance,
      maxLoss: Number.MAX_SAFE_INTEGER,
      wages,
      wageBudget: club.wageBudgetWeekly,
      netSpend: (finance.transferOutSeason ?? 0) - (finance.transferInSeason ?? 0),
      transferCap: Number.MAX_SAFE_INTEGER,
      transferOut: finance.transferOutSeason ?? 0,
      transferIn: finance.transferInSeason ?? 0,
      lossOk: true,
      wageOk: true,
      transferOk: true,
      boardFrozen: false,
      nearBreach: false,
      ok: true,
      warning: null as string | null,
      exempt: true as const,
      exemptLabel: 'ซาอุฯ Pro League — ไม่บังคับ FFP',
    }
  }

  const finance = ensureClubFinance(save)
  const loss = club.seasonStartBalance - club.balance
  const maxLoss = Math.max(1_500_000, Math.round(club.seasonStartBalance * 0.28))
  const wages = weeklyWageBillForClub(save.players, club.id, save.loans)
  const wageOk = wages <= club.wageBudgetWeekly * 1.05
  const lossOk = loss <= maxLoss

  const transferOut = finance.transferOutSeason ?? 0
  const transferIn = finance.transferInSeason ?? 0
  const netSpend = transferOut - transferIn
  const revenueBuffer =
    (finance.sponsorSeason ?? 0) +
    (finance.tvSeason ?? 0) +
    (finance.prizeSeason ?? 0) +
    (finance.ticketSeason ?? 0) +
    (finance.shirtSeason ?? 0)
  const transferCap = Math.max(
    2_000_000,
    Math.round(club.seasonStartBalance * 0.42 + revenueBuffer * 0.85),
  )
  const transferOk = netSpend <= transferCap

  const boardFrozen =
    (save.board?.transferFreezeUntil ?? -1) >= 0 &&
    save.matchday <= (save.board?.transferFreezeUntil ?? -1)

  let warning: string | null = null
  if (boardFrozen) warning = 'บอร์ดระงับตลาดชั่วคราว (FFP / วินัยงบ)'
  else if (!lossOk)
    warning = `ขาดทุนฤดูกาล ${loss.toLocaleString('th-TH')} เกินเพดาน FFP (${maxLoss.toLocaleString('th-TH')})`
  else if (!wageOk) warning = 'ค่าเหนื่อยรวมเกินงบประมาณรายสัปดาห์ (FFP)'
  else if (!transferOk)
    warning = `ซื้อสุทธิ ${netSpend.toLocaleString('th-TH')} เกินเพดานตลาด ${transferCap.toLocaleString('th-TH')}`

  const ok = lossOk && wageOk && transferOk && !boardFrozen
  const nearBreach =
    ok &&
    (loss > maxLoss * 0.8 ||
      wages > club.wageBudgetWeekly * 0.95 ||
      netSpend > transferCap * 0.85)

  return {
    loss,
    maxLoss,
    wages,
    wageBudget: club.wageBudgetWeekly,
    netSpend,
    transferCap,
    transferOut,
    transferIn,
    lossOk,
    wageOk,
    transferOk,
    boardFrozen,
    nearBreach,
    ok,
    warning,
  }
}

export function canAffordTransfer(save: GameSave, fee: number, newWage: number) {
  const status = ffpStatus(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  if (club.balance < fee) return { ok: false, reason: 'เงินในบัญชีไม่พอ' }
  if ('exempt' in status && status.exempt) return { ok: true, reason: '' }
  if (status.boardFrozen) return { ok: false, reason: status.warning ?? 'ตลาดถูกระงับ' }
  if (!status.lossOk) return { ok: false, reason: status.warning ?? 'FFP บล็อก — ขาดทุนเกินเพดาน' }
  if (!status.transferOk) return { ok: false, reason: status.warning ?? 'FFP บล็อก — ซื้อสุทธิเกินเพดาน' }

  // หลังจ่ายค่าตัว ขาดทุนจะเกินเพดานไหม
  const projectedLoss = club.seasonStartBalance - (club.balance - fee)
  if (projectedLoss > status.maxLoss) {
    return {
      ok: false,
      reason: `ดีลนี้จะทำให้ขาดทุนเกินเพดาน FFP (เหลือได้อีกประมาณ ${Math.max(0, status.maxLoss - status.loss).toLocaleString('th-TH')})`,
    }
  }

  const projectedNet = status.netSpend + fee
  if (projectedNet > status.transferCap) {
    return {
      ok: false,
      reason: `ดีลนี้เกินเพดานซื้อสุทธิ FFP (เหลือได้อีก ${Math.max(0, status.transferCap - status.netSpend).toLocaleString('th-TH')})`,
    }
  }

  const wages =
    weeklyWageBillForClub(save.players, club.id, save.loans) + newWage
  if (wages > club.wageBudgetWeekly * 1.08) {
    return { ok: false, reason: 'ค่าเหนื่อยจะเกินเพดาน FFP หลังเซ็นสัญญา' }
  }
  return { ok: true, reason: '' }
}

/** เมื่อ FFP พังหนัก — บอร์ดระงับตลาด 3 MD */
export function applyFfpBreachSanction(save: GameSave): GameSave {
  const status = ffpStatus(save)
  if ('exempt' in status && status.exempt) return save
  if (status.ok || !save.board) return save
  if (status.boardFrozen) return save
  const severe = !status.lossOk || status.netSpend > status.transferCap * 1.05
  if (!severe) return save
  return {
    ...save,
    board: {
      ...save.board,
      transferFreezeUntil: save.matchday + 3,
      lastNote: `FFP: ระงับตลาดถึง MD${save.matchday + 3} — ${status.warning}`,
    },
    inbox: [
      {
        id: `msg-ffp-${Date.now()}`,
        date: save.currentDate,
        title: 'FFP — บอร์ดระงับตลาด',
        body: status.warning ?? 'งบการเงินเสี่ยง · ห้ามซื้อนักเตะชั่วคราว',
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}
