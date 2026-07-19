import type { GameSave, LoanDeal, Player, Tactics } from './types'
import { autoPickTactics } from './seed'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'
import { estimatedValue } from './transfer'
import { isTransferWindowOpen, transferWindowKind, transferWindowLabel } from './transferWindow'
import { canRegisterIncoming } from './transferExtras'
import { appendPlayerMove } from './playerWorldDb'

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
    blockVsParent?: boolean
    obligationToBuy?: number | null
    obligationMode?: 'always' | 'avoid_relegation' | 'appearances' | null
    obligationAppearances?: number
    recallWinterOnly?: boolean
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

  if (toClubId === human) {
    const reg = canRegisterIncoming(save, player)
    if (!reg.ok) return { ok: false, message: `ทะเบียนสควอด: ${reg.reason}` }
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
    blockVsParent: opts.blockVsParent ?? true,
    obligationToBuy: opts.obligationToBuy ?? null,
    obligationMode: opts.obligationMode ?? null,
    obligationAppearances: opts.obligationAppearances ?? 15,
    appearancesOnLoan: 0,
    recallWinterOnly: opts.recallWinterOnly ?? true,
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
    save: appendPlayerMove(
      {
        ...save,
        clubs,
        players,
        tacticsByClub,
        loans: [...ensureLoans(save), deal],
        clubFinance: finance,
        inbox,
      },
      {
        playerId,
        playerName: player.name,
        fromClubId,
        toClubId,
        kind: 'loan_out',
        fee,
      },
    ),
  }
}

export function recallLoan(save: GameSave, dealId: string): LoanResult {
  const deals = ensureLoans(save)
  const deal = deals.find((d) => d.id === dealId && d.status === 'active')
  if (!deal) return { ok: false, message: 'ไม่พบสัญญายืม' }
  if (deal.kind === 'buy_loan_back') {
    return {
      ok: false,
      message: 'ดีลซื้อ+ยืมกลับเรียกกลับไม่ได้ — นักเตะอยู่กับต้นสังกัดเดิมจนจบฤดูกาล',
    }
  }
  if (!deal.recallable) return { ok: false, message: 'สัญญานี้ระบุว่าเรียกกลับไม่ได้' }
  if (deal.fromClubId !== save.humanClubId) {
    return { ok: false, message: 'เรียกกลับได้เฉพาะเมื่อคุณเป็นต้นสังกัด (ปล่อยยืมออก)' }
  }
  // ให้คลับที่ยืมได้ใช้สักพักก่อน
  const earliest = deal.startMatchday + 3
  if (save.matchday < earliest) {
    return {
      ok: false,
      message: `เรียกกลับได้ตั้งแต่ MD${earliest} เป็นต้นไป (ตอนนี้อยู่ MD${save.matchday})`,
    }
  }
  // ค่าเริ่มต้น: เรียกได้เฉพาะหน้าต่างวินเทอร์ (ม.ค.)
  if (deal.recallWinterOnly !== false && transferWindowKind(save) !== 'winter') {
    return {
      ok: false,
      message: 'สัญญานี้เรียกกลับได้เฉพาะหน้าต่างตลาดฤดูหนาว',
    }
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
    save: appendPlayerMove(
      { ...save, clubs, players, loans },
      {
        playerId: deal.playerId,
        playerName: save.players.find((p) => p.id === deal.playerId)?.name ?? deal.playerId,
        fromClubId: deal.fromClubId,
        toClubId: deal.toClubId,
        kind: 'transfer',
        fee: deal.optionToBuy,
        note: 'ออปชันซื้อหลังยืม',
      },
    ),
  }
}

function endLoan(
  save: GameSave,
  deal: LoanDeal,
  status: 'ended' | 'recalled',
): LoanResult {
  const player = save.players.find((p) => p.id === deal.playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }

  const host = save.clubs.find((c) => c.id === deal.toClubId)
  const parent = save.clubs.find((c) => c.id === deal.fromClubId)

  let players = save.players.map((p) => {
    if (p.id !== deal.playerId) return p
    const earlyRecall = status === 'recalled' && save.matchday < deal.endMatchday - 2
    return {
      ...p,
      clubId: deal.fromClubId,
      loanParentClubId: null,
      // เรียกกลับก่อนกำหนด — นักเตะอาจไม่พอใจเล็กน้อย
      morale: earlyRecall ? Math.max(1, p.morale - 1) : p.morale,
      happiness: earlyRecall
        ? Math.max(1, (p.happiness ?? p.morale) - 1)
        : (p.happiness ?? p.morale),
    }
  })
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

  const title =
    status === 'recalled' ? `เรียกกลับจากยืม: ${player.name}` : `หมดสัญญายืม: ${player.name}`
  const body =
    status === 'recalled'
      ? `${player.name} ถูกเรียกกลับจาก ${host?.name ?? deal.toClubId} ไปยัง ${parent?.name ?? deal.fromClubId} (MD${save.matchday})`
      : `${player.name} กลับ ${parent?.name ?? deal.fromClubId} หลังครบกำหนดยืมที่ ${host?.name ?? deal.toClubId}`

  const inbox = [
    {
      id: uid('msg-loan-end'),
      date: save.currentDate,
      title,
      body,
      read: false,
    },
    ...save.inbox,
  ].slice(0, 40)

  return {
    ok: true,
    message:
      status === 'recalled'
        ? `เรียกกลับ ${player.name} จาก ${host?.shortName ?? 'ทีมยืม'} สำเร็จ`
        : `${player.name} กลับต้นสังกัดหลังหมดสัญญายืม`,
    save: appendPlayerMove(
      { ...save, players, tacticsByClub, loans, inbox },
      {
        playerId: deal.playerId,
        playerName: player.name,
        fromClubId: deal.toClubId,
        toClubId: deal.fromClubId,
        kind: 'loan_return',
        note: status === 'recalled' ? 'เรียกกลับ' : 'ครบกำหนดยืม',
      },
    ),
  }
}

/** จบยืมที่ครบกำหนด + AI ยืมอัตโนมัติเล็กน้อย */
export function processLoansMatchday(save: GameSave): GameSave {
  let next = save
  const active = ensureLoans(next).filter((d) => d.status === 'active')

  for (const deal of active) {
    // ซื้อ+ยืมกลับ จบได้เฉพาะตอนขึ้นฤดูกาลใหม่
    if (deal.kind === 'buy_loan_back') continue
    if (next.matchday < deal.endMatchday) continue
    // บังคับซื้อเมื่อหมดยืม (always)
    if (deal.obligationToBuy && deal.obligationMode === 'always') {
      const forced = forceObligationBuy(next, deal)
      if (forced.ok) {
        next = forced.save
        continue
      }
    }
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
          recallWinterOnly: true,
          blockVsParent: true,
        })
        if (result.ok) next = result.save
      }
    }
  }

  return next
}

/** นับนัดยืม + เช็ค obligation ตามนัด */
export function tickLoanAppearances(
  save: GameSave,
  playedPlayerIds: string[],
): GameSave {
  if (!playedPlayerIds.length) return save
  const set = new Set(playedPlayerIds)
  let next = save
  const loans = ensureLoans(next).map((d) => {
    if (d.status !== 'active' || d.kind === 'buy_loan_back') return d
    if (!set.has(d.playerId)) return d
    return { ...d, appearancesOnLoan: (d.appearancesOnLoan ?? 0) + 1 }
  })
  next = { ...next, loans }

  for (const deal of loans) {
    if (deal.status !== 'active' || !deal.obligationToBuy) continue
    if (deal.obligationMode !== 'appearances') continue
    const need = deal.obligationAppearances ?? 15
    if ((deal.appearancesOnLoan ?? 0) < need) continue
    const forced = forceObligationBuy(next, deal)
    if (forced.ok) next = forced.save
  }
  return next
}

/** บังคับซื้อเมื่อรอดตกชั้น (เรียกตอนจบฤดูกาล) */
export function processLoanObligationsOnSeasonEnd(
  save: GameSave,
  relegatedIds: string[],
): GameSave {
  const releg = new Set(relegatedIds)
  let next = save
  for (const deal of ensureLoans(next).filter((d) => d.status === 'active')) {
    if (!deal.obligationToBuy || deal.kind === 'buy_loan_back') continue
    if (deal.obligationMode === 'avoid_relegation') {
      if (releg.has(deal.toClubId)) continue // ตกชั้น → ไม่บังคับซื้อ
      const forced = forceObligationBuy(next, deal)
      if (forced.ok) next = forced.save
    } else if (deal.obligationMode === 'always') {
      const forced = forceObligationBuy(next, deal)
      if (forced.ok) next = forced.save
    }
  }
  return next
}

function forceObligationBuy(save: GameSave, deal: LoanDeal): LoanResult {
  if (!deal.obligationToBuy) return { ok: false, message: 'ไม่มี obligation' }
  const fee = deal.obligationToBuy
  const buyer = save.clubs.find((c) => c.id === deal.toClubId)
  if (!buyer) return { ok: false, message: 'ไม่พบคลับ' }
  if (buyer.balance < fee) {
    // งบไม่พอ — จบยืมอย่างเดียว + inbox
    const ended = endLoan(save, deal, 'ended')
    if (!ended.ok) return ended
    return {
      ok: true,
      message: `Obligation ซื้อไม่สำเร็จ (งบไม่พอ) — ${ended.message}`,
      save: {
        ...ended.save,
        inbox: [
          {
            id: uid('msg-ob-fail'),
            date: save.currentDate,
            title: 'Obligation to buy ล้มเหลว',
            body: `${save.players.find((p) => p.id === deal.playerId)?.name ?? deal.playerId}: งบไม่พอ ${formatMoney(fee)} — กลับต้นสังกัด`,
            read: false,
          },
          ...ended.save.inbox,
        ].slice(0, 40),
      },
    }
  }

  let clubs = save.clubs.map((c) => {
    if (c.id === deal.toClubId) return { ...c, balance: c.balance - fee }
    if (c.id === deal.fromClubId) return { ...c, balance: c.balance + fee }
    return c
  })
  const players = save.players.map((p) =>
    p.id === deal.playerId
      ? { ...p, loanParentClubId: null, clubId: deal.toClubId }
      : p,
  )
  const loans = ensureLoans(save).map((d) =>
    d.id === deal.id ? { ...d, status: 'bought' as const } : d,
  )
  const name = save.players.find((p) => p.id === deal.playerId)?.name ?? deal.playerId

  return {
    ok: true,
    message: `Obligation: ซื้อ ${name} บังคับ · ${formatMoney(fee)}`,
    save: {
      ...save,
      clubs,
      players,
      loans,
      inbox: [
        {
          id: uid('msg-ob'),
          date: save.currentDate,
          title: `บังคับซื้อ: ${name}`,
          body: `Obligation to buy · ${formatMoney(fee)}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

export function activeLoansForClub(save: GameSave, clubId: string): LoanDeal[] {
  return ensureLoans(save).filter(
    (d) =>
      d.status === 'active' && (d.fromClubId === clubId || d.toClubId === clubId),
  )
}

/** ปล่อยยืมออก — ต้นสังกัดเป็นคุณ */
export function outgoingLoansOwnedBy(save: GameSave, clubId: string): LoanDeal[] {
  return ensureLoans(save).filter(
    (d) => d.status === 'active' && d.fromClubId === clubId && d.kind !== 'buy_loan_back',
  )
}

/** ยืมเข้า — คุณเป็นคลับที่ยืม */
export function incomingLoansAtClub(save: GameSave, clubId: string): LoanDeal[] {
  return ensureLoans(save).filter(
    (d) => d.status === 'active' && d.toClubId === clubId && d.kind !== 'buy_loan_back',
  )
}

export function canRecallLoanDeal(
  save: GameSave,
  deal: LoanDeal,
): { ok: true } | { ok: false; reason: string } {
  if (deal.status !== 'active') return { ok: false, reason: 'สัญญายืมไม่ active' }
  if (deal.kind === 'buy_loan_back') {
    return { ok: false, reason: 'ซื้อ+ยืมกลับ — เรียกกลับไม่ได้' }
  }
  if (!deal.recallable) return { ok: false, reason: 'สัญญาระบุเรียกกลับไม่ได้' }
  if (deal.fromClubId !== save.humanClubId) {
    return { ok: false, reason: 'ไม่ใช่ต้นสังกัดของคุณ' }
  }
  const earliest = deal.startMatchday + 3
  if (save.matchday < earliest) {
    return { ok: false, reason: `ได้ตั้งแต่ MD${earliest}` }
  }
  if (deal.recallWinterOnly !== false && transferWindowKind(save) !== 'winter') {
    return { ok: false, reason: 'เฉพาะตลาดวินเทอร์' }
  }
  return { ok: true }
}
