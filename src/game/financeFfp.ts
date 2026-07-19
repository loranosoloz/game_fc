import type { GameSave } from './types'

/** Soft FFP: max season loss relative to starting balance + wage ratio. */
export function ffpStatus(save: GameSave) {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const loss = club.seasonStartBalance - club.balance
  const maxLoss = Math.max(2_000_000, club.seasonStartBalance * 0.35)
  const wages = save.players
    .filter((p) => p.clubId === club.id)
    .reduce((s, p) => s + p.wage, 0)
  const wageOk = wages <= club.wageBudgetWeekly * 1.15
  const lossOk = loss <= maxLoss
  return {
    loss,
    maxLoss,
    wages,
    wageBudget: club.wageBudgetWeekly,
    lossOk,
    wageOk,
    ok: lossOk && wageOk,
    warning: !lossOk
      ? `ขาดทุนฤดูกาล ${loss.toLocaleString('th-TH')} เกินเพดาน FFP`
      : !wageOk
        ? 'ค่าเหนื่อยรวมเกินงบประมาณรายสัปดาห์'
        : null as string | null,
  }
}

export function canAffordTransfer(save: GameSave, fee: number, newWage: number) {
  const status = ffpStatus(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  if (club.balance < fee) return { ok: false, reason: 'เงินในบัญชีไม่พอ' }
  if (!status.lossOk) return { ok: false, reason: status.warning ?? 'FFP บล็อก' }
  const wages =
    save.players.filter((p) => p.clubId === club.id).reduce((s, p) => s + p.wage, 0) + newWage
  if (wages > club.wageBudgetWeekly * 1.2) {
    return { ok: false, reason: 'ค่าเหนื่อยจะเกินเพดาน FFP' }
  }
  return { ok: true, reason: '' }
}
