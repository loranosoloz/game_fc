import type { GameSave, TransferClause, TransferDeskState } from './types'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function ensureClauses(desk: TransferDeskState): TransferClause[] {
  return desk.clauses ?? []
}

/** หลังซื้อสำเร็จ — บันทึกเงื่อนไขพิเศษให้จ่ายทีหลัง */
export function attachClausesAfterBuy(
  save: GameSave,
  opts: {
    playerId: string
    playerName: string
    buyerClubId: string
    sellerClubId: string
    appearanceAddon: number
    sellOnPercent: number
  },
): GameSave {
  const desk = save.transferDesk ?? { offers: [], auctions: [], clauses: [] }
  const clauses = ensureClauses(desk).slice()
  if (opts.appearanceAddon > 0) {
    clauses.unshift({
      id: uid('cl-app'),
      kind: 'appearance',
      playerId: opts.playerId,
      playerName: opts.playerName,
      fromClubId: opts.buyerClubId,
      toClubId: opts.sellerClubId,
      amount: opts.appearanceAddon,
      appearancesNeeded: 10,
      appearancesSoFar: 0,
      sellOnPercent: 0,
      status: 'active',
      note: `Add-on ลงครบ 10 นัด · ${formatMoney(opts.appearanceAddon)} → คลับเดิม`,
    })
  }
  if (opts.sellOnPercent > 0) {
    clauses.unshift({
      id: uid('cl-so'),
      kind: 'sell_on',
      playerId: opts.playerId,
      playerName: opts.playerName,
      fromClubId: opts.buyerClubId,
      toClubId: opts.sellerClubId,
      amount: 0,
      appearancesNeeded: 0,
      appearancesSoFar: 0,
      sellOnPercent: opts.sellOnPercent,
      status: 'active',
      note: `Sell-on ${opts.sellOnPercent}% เมื่อขายต่อ`,
    })
  }
  if (clauses.length === (desk.clauses?.length ?? 0)) return save
  return {
    ...save,
    transferDesk: { ...desk, clauses: clauses.slice(0, 40) },
    inbox: [
      {
        id: uid('msg-cl'),
        date: save.currentDate,
        title: 'เงื่อนไขพิเศษมีผล',
        body: [
          opts.appearanceAddon > 0 ? `Add-on ${formatMoney(opts.appearanceAddon)} หลังลง 10 นัด` : '',
          opts.sellOnPercent > 0 ? `Sell-on ${opts.sellOnPercent}%` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** นับนัดลงแข่งของนักเตะในทีมเรา → จ่าย appearance add-on */
export function tickAppearanceClauses(save: GameSave): GameSave {
  const desk = save.transferDesk
  if (!desk?.clauses?.length) return save
  let clubs = save.clubs
  let finance = ensureClubFinance(save)
  let inbox = save.inbox
  const clauses = desk.clauses.map((cl) => {
    if (cl.status !== 'active' || cl.kind !== 'appearance') return cl
    const p = save.players.find((x) => x.id === cl.playerId)
    if (!p || p.clubId !== cl.fromClubId) return cl
    const tactics = save.tacticsByClub[p.clubId]
    const played = tactics?.startingXi.includes(p.id)
    if (!played) return cl
    const soFar = cl.appearancesSoFar + 1
    if (soFar < cl.appearancesNeeded) {
      return { ...cl, appearancesSoFar: soFar }
    }
    // pay buyer → seller
    const payer = clubs.find((c) => c.id === cl.fromClubId)
    const payee = clubs.find((c) => c.id === cl.toClubId)
    if (!payer || payer.balance < cl.amount) {
      return { ...cl, appearancesSoFar: soFar, note: `${cl.note} · รอจ่าย (งบไม่พอ)` }
    }
    clubs = clubs.map((c) => {
      if (c.id === cl.fromClubId) return { ...c, balance: c.balance - cl.amount }
      if (c.id === cl.toClubId) return { ...c, balance: c.balance + cl.amount }
      return c
    })
    if (cl.fromClubId === save.humanClubId) {
      finance = {
        ...finance,
        ledger: [
          {
            id: uid('led'),
            date: save.currentDate,
            kind: 'other' as const,
            amount: -cl.amount,
            note: `Add-on: ${cl.playerName}`,
          },
          ...finance.ledger,
        ].slice(0, 50),
      }
    }
    inbox = [
      {
        id: uid('msg-app'),
        date: save.currentDate,
        title: 'จ่าย Add-on ลงแข่ง',
        body: `${cl.playerName} ครบ ${cl.appearancesNeeded} นัด · จ่าย ${formatMoney(cl.amount)} ให้ ${payee?.name ?? cl.toClubId}`,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
    return { ...cl, appearancesSoFar: soFar, status: 'paid' as const, note: `จ่ายแล้ว ${formatMoney(cl.amount)}` }
  })
  return {
    ...save,
    clubs,
    clubFinance: finance,
    inbox,
    transferDesk: { ...desk, clauses },
  }
}

/** เมื่อขายนักเตะ — จ่าย sell-on ให้คลับเดิม */
export function settleSellOnClauses(
  save: GameSave,
  playerId: string,
  saleFee: number,
): GameSave {
  const desk = save.transferDesk
  if (!desk?.clauses?.length) return save
  let clubs = save.clubs
  let finance = ensureClubFinance(save)
  let inbox = save.inbox
  const clauses = desk.clauses.map((cl) => {
    if (cl.status !== 'active' || cl.kind !== 'sell_on' || cl.playerId !== playerId) return cl
    const due = Math.round(saleFee * (cl.sellOnPercent / 100))
    if (due <= 0) return { ...cl, status: 'paid' as const }
    const payerId = cl.fromClubId // club that bought (now selling)
    const payeeId = cl.toClubId
    const payer = clubs.find((c) => c.id === payerId)
    if (!payer || payer.balance < due) {
      return { ...cl, note: `${cl.note} · ค้างจ่าย ${formatMoney(due)}` }
    }
    clubs = clubs.map((c) => {
      if (c.id === payerId) return { ...c, balance: c.balance - due }
      if (c.id === payeeId) return { ...c, balance: c.balance + due }
      return c
    })
    if (payerId === save.humanClubId) {
      finance = {
        ...finance,
        ledger: [
          {
            id: uid('led'),
            date: save.currentDate,
            kind: 'other' as const,
            amount: -due,
            note: `Sell-on ${cl.sellOnPercent}%: ${cl.playerName}`,
          },
          ...finance.ledger,
        ].slice(0, 50),
      }
    }
    inbox = [
      {
        id: uid('msg-so'),
        date: save.currentDate,
        title: 'Sell-on ถูกเรียกเก็บ',
        body: `ขาย ${cl.playerName} · จ่าย ${formatMoney(due)} (${cl.sellOnPercent}%) ให้คลับเดิม`,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
    return {
      ...cl,
      amount: due,
      status: 'paid' as const,
      note: `จ่าย sell-on ${formatMoney(due)}`,
    }
  })
  return {
    ...save,
    clubs,
    clubFinance: finance,
    inbox,
    transferDesk: { ...desk, clauses },
  }
}
