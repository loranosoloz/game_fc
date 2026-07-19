import type { GameSave, LoanDeal, Player, Tactics } from './types'
import { autoPickTactics } from './seed'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'
import { estimatedValue } from './transfer'
import { isTransferWindowOpen, transferWindowLabel } from './transferWindow'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function stripFromTactics(tactics: Tactics, playerId: string): Tactics {
  return {
    ...tactics,
    startingXi: tactics.startingXi.filter((id) => id !== playerId),
    bench: tactics.bench.filter((id) => id !== playerId),
  }
}

function refillTactics(clubId: string, players: Player[], tactics: Tactics): Tactics {
  if (tactics.startingXi.length >= 11) return tactics
  const picked = autoPickTactics(clubId, players, tactics.formation, tactics.formationOop)
  return {
    ...picked,
    instructions: tactics.instructions,
    familiarity: tactics.familiarity,
    setPieces: tactics.setPieces,
    opposition: tactics.opposition,
  }
}

export function createLoansState(): LoanDeal[] {
  return []
}

export function ensureLoans(save: GameSave): LoanDeal[] {
  return save.loans ?? []
}

export type LoanResult =
  | { ok: true; message: string; save: GameSave }
  | { ok: false; message: string }

/** ยืมนักเตะเข้าทีมคุณ / หรือปล่อยยืมออก */
export function arrangeLoan(
  save: GameSave,
  playerId: string,
  toClubId: string,
  opts: {
    durationMatchdays?: number
    fee?: number
    wageShareParent?: number
    optionToBuy?: number | null
    recallable?: boolean
  } = {},
): LoanResult {
  if (!isTransferWindowOpen(save)) {
    return { ok: false, message: `${transferWindowLabel(save)} — ยืมตัวได้เฉพาะช่วงตลาดเปิด` }
  }
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.loanParentClubId) return { ok: false, message: 'นักเตะคนนี้อยู่ในสัญญายืมอยู่แล้ว' }
  if (player.clubId === toClubId) return { ok: false, message: 'อยู่คลับนี้อยู่แล้ว' }

  const fromClubId = player.clubId
  const from = save.clubs.find((c) => c.id === fromClubId)
  const to = save.clubs.find((c) => c.id === toClubId)
  if (!from || !to) return { ok: false, message: 'ไม่พบสโมสร' }

  const human = save.humanClubId
  const involvesHuman = fromClubId === human || toClubId === human
  if (!involvesHuman && from.controlledBy === 'ai' && to.controlledBy === 'ai') {
    // AI–AI ok for sim
  }

  const duration = opts.durationMatchdays ?? 12
  const fee = opts.fee ?? Math.round(estimatedValue(player) * 0.08)
  const wageShareParent = opts.wageShareParent ?? 0.5
  const optionToBuy =
    opts.optionToBuy === undefined
      ? Math.round(estimatedValue(player) * 1.1)
      : opts.optionToBuy

  if (toClubId === human && to.balance < fee) {
    return { ok: false, message: `งบไม่พอค่าธรรมเนียมยืม (${formatMoney(fee)})` }
  }
  if (fromClubId === human && to.controlledBy === 'ai') {
    // loaning out — parent receives fee
  }

  let clubs = save.clubs.map((c) => {
    if (c.id === toClubId) return { ...c, balance: c.balance - fee }
    if (c.id === fromClubId) return { ...c, balance: c.balance + fee }
    return c
  })

  let players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          clubId: toClubId,
          loanParentClubId: fromClubId,
          morale: Math.min(20, p.morale + 1),
          happiness: Math.min(20, (p.happiness ?? p.morale) + 2),
        }
      : p,
  )

  let tacticsByClub = { ...save.tacticsByClub }
  if (tacticsByClub[fromClubId]) {
    tacticsByClub[fromClubId] = refillTactics(
      fromClubId,
      players,
      stripFromTactics(tacticsByClub[fromClubId], playerId),
    )
  }
  if (tacticsByClub[toClubId]) {
    tacticsByClub[toClubId] = refillTactics(toClubId, players, tacticsByClub[toClubId])
  }

  const deal: LoanDeal = {
    id: uid('loan'),
    playerId,
    fromClubId,
    toClubId,
    startMatchday: save.matchday,
    endMatchday: save.matchday + duration,
    wageShareParent,
    fee,
    optionToBuy,
    recallable: opts.recallable ?? true,
    status: 'active',
  }

  let finance = ensureClubFinance(save)
  if (toClubId === human || fromClubId === human) {
    const amount = toClubId === human ? -fee : fee
    finance = {
      ...finance,
      ledger: [
        {
          id: uid('led'),
          date: save.currentDate,
          kind: 'loan' as const,
          amount,
          note: `ยืมตัว ${player.name} · ${from.shortName}→${to.shortName}`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    }
  }

  const inbox = [
    {
      id: uid('msg'),
      date: save.currentDate,
      title: 'สัญญายืมตัว',
      body: `${player.name} ย้ายแบบยืม ${from.name} → ${to.name} จน MD${deal.endMatchday}${
        optionToBuy ? ` · ออปชันซื้อ ${formatMoney(optionToBuy)}` : ''
      }`,
      read: false,
    },
    ...save.inbox,
  ].slice(0, 40)

  return {
    ok: true,
    message: `ยืม ${player.name} สำเร็จ (${duration} แมตช์เดย์)`,
    save: {
      ...save,
      clubs,
      players,
      tacticsByClub,
      loans: [...ensureLoans(save), deal],
      clubFinance: finance,
      inbox,
    },
  }
}

export function recallLoan(save: GameSave, dealId: string): LoanResult {
  const deals = ensureLoans(save)
  const deal = deals.find((d) => d.id === dealId && d.status === 'active')
  if (!deal) return { ok: false, message: 'ไม่พบสัญญายืม' }
  if (!deal.recallable) return { ok: false, message: 'สัญญานี้เรียกกลับไม่ได้' }
  if (deal.fromClubId !== save.humanClubId) {
    return { ok: false, message: 'เรียกกลับได้เฉพาะต้นสังกัดของคุณ' }
  }
  return endLoan(save, deal, 'recalled')
}

export function exerciseLoanOption(save: GameSave, dealId: string): LoanResult {
  const deals = ensureLoans(save)
  const deal = deals.find((d) => d.id === dealId && d.status === 'active')
  if (!deal || !deal.optionToBuy) return { ok: false, message: 'ไม่มีออปชันซื้อ' }
  if (deal.toClubId !== save.humanClubId) {
    return { ok: false, message: 'ใช้สิทธิ์ได้เฉพาะคลับที่ยืมอยู่' }
  }
  const buyer = save.clubs.find((c) => c.id === deal.toClubId)!
  if (buyer.balance < deal.optionToBuy) {
    return { ok: false, message: `งบไม่พอ (${formatMoney(deal.optionToBuy)})` }
  }

  let clubs = save.clubs.map((c) => {
    if (c.id === deal.toClubId) return { ...c, balance: c.balance - deal.optionToBuy! }
    if (c.id === deal.fromClubId) return { ...c, balance: c.balance + deal.optionToBuy! }
    return c
  })
  const players = save.players.map((p) =>
    p.id === deal.playerId
      ? { ...p, loanParentClubId: null, clubId: deal.toClubId }
      : p,
  )
  const loans = deals.map((d) =>
    d.id === dealId ? { ...d, status: 'bought' as const } : d,
  )

  return {
    ok: true,
    message: `ใช้สิทธิ์ซื้อสำเร็จ · ${formatMoney(deal.optionToBuy)}`,
    save: { ...save, clubs, players, loans },
  }
}

function endLoan(
  save: GameSave,
  deal: LoanDeal,
  status: 'ended' | 'recalled',
): LoanResult {
  const player = save.players.find((p) => p.id === deal.playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }

  let players = save.players.map((p) =>
    p.id === deal.playerId
      ? { ...p, clubId: deal.fromClubId, loanParentClubId: null }
      : p,
  )
  let tacticsByClub = { ...save.tacticsByClub }
  if (tacticsByClub[deal.toClubId]) {
    tacticsByClub[deal.toClubId] = refillTactics(
      deal.toClubId,
      players,
      stripFromTactics(tacticsByClub[deal.toClubId], deal.playerId),
    )
  }
  if (tacticsByClub[deal.fromClubId]) {
    tacticsByClub[deal.fromClubId] = refillTactics(
      deal.fromClubId,
      players,
      tacticsByClub[deal.fromClubId],
    )
  }

  const loans = ensureLoans(save).map((d) =>
    d.id === deal.id ? { ...d, status } : d,
  )

  return {
    ok: true,
    message:
      status === 'recalled'
        ? `${player.name} ถูกเรียกกลับต้นสังกัด`
        : `${player.name} กลับต้นสังกัดหลังหมดสัญญายืม`,
    save: { ...save, players, tacticsByClub, loans },
  }
}

/** จบยืมที่ครบกำหนด + AI ยืมอัตโนมัติเล็กน้อย */
export function processLoansMatchday(save: GameSave): GameSave {
  let next = save
  const active = ensureLoans(next).filter((d) => d.status === 'active')

  for (const deal of active) {
    if (next.matchday < deal.endMatchday) continue
    const result = endLoan(next, deal, 'ended')
    if (result.ok) next = result.save
  }

  // AI loan restless bench players occasionally
  if (Math.random() < 0.12) {
    const aiClubs = next.clubs.filter((c) => c.controlledBy === 'ai')
    if (aiClubs.length >= 2) {
      const from = aiClubs[Math.floor(Math.random() * aiClubs.length)]
      const to = aiClubs.filter((c) => c.id !== from.id)[
        Math.floor(Math.random() * (aiClubs.length - 1))
      ]
      const candidates = next.players.filter(
        (p) =>
          p.clubId === from.id &&
          !p.loanParentClubId &&
          p.squadRole !== 'key' &&
          p.overall >= 68 &&
          p.overall <= 78,
      )
      if (to && candidates.length) {
        const p = candidates[Math.floor(Math.random() * candidates.length)]
        const result = arrangeLoan(next, p.id, to.id, {
          durationMatchdays: 10,
          fee: Math.round(estimatedValue(p) * 0.05),
          recallable: true,
        })
        if (result.ok) next = result.save
      }
    }
  }

  return next
}

export function activeLoansForClub(save: GameSave, clubId: string): LoanDeal[] {
  return ensureLoans(save).filter(
    (d) =>
      d.status === 'active' && (d.fromClubId === clubId || d.toClubId === clubId),
  )
}
