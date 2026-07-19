import type {
  GameSave,
  MatchResult,
  Player,
  TransferAddonPackage,
  TransferClause,
  TransferClauseKind,
  TransferDeskState,
} from './types'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function ensureClauses(desk: TransferDeskState): TransferClause[] {
  return (desk.clauses ?? []).map(normalizeClause)
}

function normalizeClause(cl: TransferClause): TransferClause {
  const payee =
    cl.payee ??
    (cl.kind === 'signing_on' || String(cl.kind).startsWith('per_') ? 'player' : 'seller')
  return { ...cl, payee }
}

export function emptyAddonPackage(): TransferAddonPackage {
  return {
    appearanceFee: 0,
    appearanceNeeded: 10,
    goalsFee: 0,
    goalsNeeded: 10,
    assistsFee: 0,
    assistsNeeded: 10,
    cleanSheetsFee: 0,
    cleanSheetsNeeded: 10,
    sellOnPercent: 0,
    promotionFee: 0,
    leagueTitleFee: 0,
    europeFee: 0,
    signingOnFee: 0,
    perAppearance: 0,
    perGoal: 0,
    perAssist: 0,
    perCleanSheet: 0,
  }
}

/** รวมแพ็กเก่า (appearanceAddon + sellOn) เข้ากับแพ็กใหม่ */
export function resolveAddonPackage(
  addons?: TransferAddonPackage | null,
  appearanceAddon = 0,
  sellOnPercent = 0,
): TransferAddonPackage {
  const base = addons ? { ...emptyAddonPackage(), ...addons } : emptyAddonPackage()
  if (!addons) {
    base.appearanceFee = appearanceAddon
    base.sellOnPercent = sellOnPercent
  }
  return base
}

type PayState = {
  clubs: GameSave['clubs']
  players: GameSave['players']
  finance: ReturnType<typeof ensureClubFinance>
  inbox: GameSave['inbox']
}

function payClause(
  state: PayState,
  save: GameSave,
  cl: TransferClause,
  due: number,
  title: string,
  body: string,
): { state: PayState; ok: boolean } {
  if (due <= 0) return { state, ok: true }
  const payer = state.clubs.find((c) => c.id === cl.fromClubId)
  if (!payer || payer.balance < due) return { state, ok: false }

  let clubs = state.clubs.map((c) =>
    c.id === cl.fromClubId ? { ...c, balance: c.balance - due } : c,
  )
  let players = state.players
  let finance = state.finance

  if (cl.payee === 'player') {
    players = players.map((p) =>
      p.id === cl.playerId ? { ...p, cash: (p.cash ?? 0) + due } : p,
    )
  } else {
    clubs = clubs.map((c) =>
      c.id === cl.toClubId ? { ...c, balance: c.balance + due } : c,
    )
  }

  if (cl.fromClubId === save.humanClubId) {
    finance = {
      ...finance,
      ledger: [
        {
          id: uid('led'),
          date: save.currentDate,
          kind: 'other' as const,
          amount: -due,
          note: `${title}: ${cl.playerName}`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    }
  }

  const inbox = [
    {
      id: uid('msg-cl'),
      date: save.currentDate,
      title,
      body,
      read: false,
    },
    ...state.inbox,
  ].slice(0, 40)

  return { state: { clubs, players, finance, inbox }, ok: true }
}

function pushClause(
  list: TransferClause[],
  partial: Omit<TransferClause, 'id' | 'status' | 'appearancesSoFar' | 'sellOnPercent'> & {
    sellOnPercent?: number
  },
) {
  list.unshift({
    id: uid(`cl-${partial.kind}`),
    status: 'active',
    appearancesSoFar: 0,
    sellOnPercent: 0,
    ...partial,
  })
}

/** หลังซื้อสำเร็จ — บันทึกเงื่อนไขพิเศษเต็มชุด */
export function attachClausesAfterBuy(
  save: GameSave,
  opts: {
    playerId: string
    playerName: string
    buyerClubId: string
    sellerClubId: string
    appearanceAddon?: number
    sellOnPercent?: number
    addons?: TransferAddonPackage | null
  },
): GameSave {
  const pkg = resolveAddonPackage(opts.addons, opts.appearanceAddon ?? 0, opts.sellOnPercent ?? 0)
  const desk = save.transferDesk ?? { offers: [], auctions: [], clauses: [] }
  const clauses = ensureClauses(desk).slice()
  const base = {
    playerId: opts.playerId,
    playerName: opts.playerName,
    fromClubId: opts.buyerClubId,
    toClubId: opts.sellerClubId,
  }

  const sellerNotes: string[] = []
  const playerNotes: string[] = []

  if (pkg.appearanceFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'appearance',
      payee: 'seller',
      amount: pkg.appearanceFee,
      appearancesNeeded: pkg.appearanceNeeded || 10,
      note: `Add-on ลงครบ ${pkg.appearanceNeeded || 10} นัด · ${formatMoney(pkg.appearanceFee)}`,
    })
    sellerNotes.push(`ลงแข่ง ${formatMoney(pkg.appearanceFee)}`)
  }
  if (pkg.goalsFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'goals',
      payee: 'seller',
      amount: pkg.goalsFee,
      appearancesNeeded: pkg.goalsNeeded || 10,
      note: `Add-on ยิงครบ ${pkg.goalsNeeded || 10} ประตู · ${formatMoney(pkg.goalsFee)}`,
    })
    sellerNotes.push(`ประตู ${formatMoney(pkg.goalsFee)}`)
  }
  if (pkg.assistsFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'assists',
      payee: 'seller',
      amount: pkg.assistsFee,
      appearancesNeeded: pkg.assistsNeeded || 10,
      note: `Add-on แอสซิสต์ครบ ${pkg.assistsNeeded || 10} · ${formatMoney(pkg.assistsFee)}`,
    })
    sellerNotes.push(`แอสซิสต์ ${formatMoney(pkg.assistsFee)}`)
  }
  if (pkg.cleanSheetsFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'clean_sheets',
      payee: 'seller',
      amount: pkg.cleanSheetsFee,
      appearancesNeeded: pkg.cleanSheetsNeeded || 10,
      note: `Add-on คลีนชีตครบ ${pkg.cleanSheetsNeeded || 10} · ${formatMoney(pkg.cleanSheetsFee)}`,
    })
    sellerNotes.push(`คลีนชีต ${formatMoney(pkg.cleanSheetsFee)}`)
  }
  if (pkg.sellOnPercent > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'sell_on',
      payee: 'seller',
      amount: 0,
      appearancesNeeded: 0,
      sellOnPercent: pkg.sellOnPercent,
      note: `Sell-on ${pkg.sellOnPercent}% เมื่อขายต่อ`,
    })
    sellerNotes.push(`Sell-on ${pkg.sellOnPercent}%`)
  }
  if (pkg.promotionFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'promotion',
      payee: 'seller',
      amount: pkg.promotionFee,
      appearancesNeeded: 1,
      note: `โบนัสเลื่อนชั้น · ${formatMoney(pkg.promotionFee)}`,
    })
    sellerNotes.push(`เลื่อนชั้น ${formatMoney(pkg.promotionFee)}`)
  }
  if (pkg.leagueTitleFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'league_title',
      payee: 'seller',
      amount: pkg.leagueTitleFee,
      appearancesNeeded: 1,
      note: `โบนัสแชมป์ลีก · ${formatMoney(pkg.leagueTitleFee)}`,
    })
    sellerNotes.push(`แชมป์ ${formatMoney(pkg.leagueTitleFee)}`)
  }
  if (pkg.europeFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'europe_qualify',
      payee: 'seller',
      amount: pkg.europeFee,
      appearancesNeeded: 1,
      note: `โบนัสโซนยุโรป · ${formatMoney(pkg.europeFee)}`,
    })
    sellerNotes.push(`ยุโรป ${formatMoney(pkg.europeFee)}`)
  }

  // โบนัสนักเตะ
  if (pkg.signingOnFee > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'signing_on',
      payee: 'player',
      amount: pkg.signingOnFee,
      appearancesNeeded: 1,
      note: `เงินเซ็นสัญญา · ${formatMoney(pkg.signingOnFee)}`,
    })
    playerNotes.push(`เซ็นสัญญา ${formatMoney(pkg.signingOnFee)}`)
  }
  if (pkg.perAppearance > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'per_appearance',
      payee: 'player',
      amount: pkg.perAppearance,
      appearancesNeeded: 0,
      note: `โบนัสลงแข่ง ${formatMoney(pkg.perAppearance)}/นัด`,
    })
    playerNotes.push(`ลงแข่ง ${formatMoney(pkg.perAppearance)}/นัด`)
  }
  if (pkg.perGoal > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'per_goal',
      payee: 'player',
      amount: pkg.perGoal,
      appearancesNeeded: 0,
      note: `โบนัสประตู ${formatMoney(pkg.perGoal)}/ลูก`,
    })
    playerNotes.push(`ประตู ${formatMoney(pkg.perGoal)}/ลูก`)
  }
  if (pkg.perAssist > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'per_assist',
      payee: 'player',
      amount: pkg.perAssist,
      appearancesNeeded: 0,
      note: `โบนัสแอสซิสต์ ${formatMoney(pkg.perAssist)}/ครั้ง`,
    })
    playerNotes.push(`แอสซิสต์ ${formatMoney(pkg.perAssist)}/ครั้ง`)
  }
  if (pkg.perCleanSheet > 0) {
    pushClause(clauses, {
      ...base,
      kind: 'per_clean_sheet',
      payee: 'player',
      amount: pkg.perCleanSheet,
      appearancesNeeded: 0,
      note: `โบนัสคลีนชีต ${formatMoney(pkg.perCleanSheet)}/นัด`,
    })
    playerNotes.push(`คลีนชีต ${formatMoney(pkg.perCleanSheet)}/นัด`)
  }

  if (clauses.length === (desk.clauses?.length ?? 0)) return save

  let next: GameSave = {
    ...save,
    transferDesk: { ...desk, clauses: clauses.slice(0, 80) },
    inbox: [
      {
        id: uid('msg-cl-pack'),
        date: save.currentDate,
        title: 'เงื่อนไขพิเศษมีผล',
        body: [
          sellerNotes.length ? `คลับขาย: ${sellerNotes.join(' · ')}` : '',
          playerNotes.length ? `นักเตะ: ${playerNotes.join(' · ')}` : '',
        ]
          .filter(Boolean)
          .join(' | '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }

  // จ่ายเงินเซ็นสัญญาทันที
  const signing = ensureClauses(next.transferDesk!).find(
    (c) =>
      c.kind === 'signing_on' &&
      c.playerId === opts.playerId &&
      c.status === 'active',
  )
  if (signing) {
    let state: PayState = {
      clubs: next.clubs,
      players: next.players,
      finance: ensureClubFinance(next),
      inbox: next.inbox,
    }
    const paid = payClause(
      state,
      next,
      signing,
      signing.amount,
      'เงินเซ็นสัญญา',
      `${signing.playerName} ได้รับ ${formatMoney(signing.amount)}`,
    )
    if (paid.ok) {
      next = {
        ...next,
        clubs: paid.state.clubs,
        players: paid.state.players,
        clubFinance: paid.state.finance,
        inbox: paid.state.inbox,
        transferDesk: {
          ...next.transferDesk!,
          clauses: ensureClauses(next.transferDesk!).map((c) =>
            c.id === signing.id
              ? { ...c, status: 'paid' as const, appearancesSoFar: 1, note: `จ่ายแล้ว ${formatMoney(c.amount)}` }
              : c,
          ),
        },
      }
    }
  }

  return next
}

type MatchTouch = {
  played: boolean
  goals: number
  assists: number
  cleanSheet: boolean
}

function matchTouchForPlayer(
  save: GameSave,
  result: MatchResult,
  player: Player,
): MatchTouch {
  const fixture = save.fixtures.find((f) => f.id === result.fixtureId)
  if (!fixture) return { played: false, goals: 0, assists: 0, cleanSheet: false }

  const isHome = fixture.homeClubId === player.clubId
  const isAway = fixture.awayClubId === player.clubId
  if (!isHome && !isAway) return { played: false, goals: 0, assists: 0, cleanSheet: false }

  const tactics = save.tacticsByClub[player.clubId]
  const played = tactics?.startingXi.includes(player.id) ?? false
  if (!played) return { played: false, goals: 0, assists: 0, cleanSheet: false }

  const goals = result.events.filter(
    (e) => e.kind === 'goal' && e.playerId === player.id,
  ).length
  const assists = result.events.filter(
    (e) => e.kind === 'goal' && e.assistPlayerId === player.id,
  ).length
  const conceded = isHome ? result.awayGoals : result.homeGoals
  const canCs = player.position === 'GK' || player.position === 'DF'
  const cleanSheet = canCs && conceded === 0

  return { played: true, goals, assists, cleanSheet }
}

const MILESTONE_KINDS: TransferClauseKind[] = [
  'appearance',
  'goals',
  'assists',
  'clean_sheets',
]

/** นับสถิติแมตช์ → จ่าย milestone / โบนัสรายนัด */
export function tickPerformanceClauses(
  save: GameSave,
  results: MatchResult[],
): GameSave {
  const desk = save.transferDesk
  if (!desk?.clauses?.length || !results.length) return save

  let state: PayState = {
    clubs: save.clubs,
    players: save.players,
    finance: ensureClubFinance(save),
    inbox: save.inbox,
  }
  let dirty = false

  const clauses = ensureClauses(desk).map((cl) => {
    if (cl.status !== 'active') return cl
    const player = state.players.find((p) => p.id === cl.playerId)
    if (!player || player.clubId !== cl.fromClubId) return cl

    let nextCl = cl
    for (const result of results) {
      if (nextCl.status !== 'active') break
      const touch = matchTouchForPlayer(
        { ...save, clubs: state.clubs, players: state.players },
        result,
        player,
      )
      if (!touch.played) continue

      // โบนัสรายนัด → นักเตะ
      if (cl.kind === 'per_appearance' || cl.kind === 'per_goal' || cl.kind === 'per_assist' || cl.kind === 'per_clean_sheet') {
        let units = 0
        if (cl.kind === 'per_appearance') units = 1
        if (cl.kind === 'per_goal') units = touch.goals
        if (cl.kind === 'per_assist') units = touch.assists
        if (cl.kind === 'per_clean_sheet') units = touch.cleanSheet ? 1 : 0
        if (units <= 0) continue

        const due = cl.amount * units
        const label =
          cl.kind === 'per_appearance'
            ? 'โบนัสลงแข่ง'
            : cl.kind === 'per_goal'
              ? 'โบนัสประตู'
              : cl.kind === 'per_assist'
                ? 'โบนัสแอสซิสต์'
                : 'โบนัสคลีนชีต'
        const paid = payClause(
          state,
          save,
          nextCl,
          due,
          label,
          `${cl.playerName} · ${label} ${formatMoney(due)}`,
        )
        if (!paid.ok) {
          nextCl = { ...nextCl, note: `${cl.note} · รอจ่าย (งบไม่พอ)` }
          continue
        }
        state = paid.state
        dirty = true
        const soFar = nextCl.appearancesSoFar + units
        const capped =
          nextCl.appearancesNeeded > 0 && soFar >= nextCl.appearancesNeeded
        nextCl = {
          ...nextCl,
          appearancesSoFar: soFar,
          status: capped ? 'paid' : 'active',
          note: capped ? `ครบเพดาน · จ่ายรวมแล้ว` : nextCl.note,
        }
        continue
      }

      // Milestone → คลับขาย
      if (!MILESTONE_KINDS.includes(cl.kind)) continue
      let add = 0
      if (cl.kind === 'appearance') add = 1
      if (cl.kind === 'goals') add = touch.goals
      if (cl.kind === 'assists') add = touch.assists
      if (cl.kind === 'clean_sheets') add = touch.cleanSheet ? 1 : 0
      if (add <= 0) continue

      const soFar = nextCl.appearancesSoFar + add
      if (soFar < nextCl.appearancesNeeded) {
        nextCl = { ...nextCl, appearancesSoFar: soFar }
        dirty = true
        continue
      }

      const seller = state.clubs.find((c) => c.id === cl.toClubId)
      const paid = payClause(
        state,
        save,
        nextCl,
        nextCl.amount,
        'จ่าย Add-on',
        `${cl.playerName} ครบเงื่อนไข「${cl.kind}」· จ่าย ${formatMoney(nextCl.amount)} ให้ ${seller?.name ?? cl.toClubId}`,
      )
      if (!paid.ok) {
        nextCl = {
          ...nextCl,
          appearancesSoFar: soFar,
          note: `${cl.note} · รอจ่าย (งบไม่พอ)`,
        }
        dirty = true
        continue
      }
      state = paid.state
      dirty = true
      nextCl = {
        ...nextCl,
        appearancesSoFar: soFar,
        status: 'paid',
        note: `จ่ายแล้ว ${formatMoney(nextCl.amount)}`,
      }
    }
    return nextCl
  })

  if (!dirty) return save
  return {
    ...save,
    clubs: state.clubs,
    players: state.players,
    clubFinance: state.finance,
    inbox: state.inbox,
    transferDesk: { ...desk, clauses },
  }
}

/** @deprecated ใช้ tickPerformanceClauses */
export function tickAppearanceClauses(save: GameSave): GameSave {
  const human = save.lastHumanResult
  return human ? tickPerformanceClauses(save, [human]) : save
}

/** เมื่อจบลีก — แชมป์ / โซนยุโรป */
export function tickEndOfSeasonClauses(save: GameSave): GameSave {
  if (!save.seasonComplete) return save
  const desk = save.transferDesk
  if (!desk?.clauses?.length) return save

  const human = save.clubs.find((c) => c.id === save.humanClubId)
  const div = human?.division ?? 1
  const table = div === 2 ? (save.tableDiv2 ?? []) : save.table
  const sorted = [...table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
  const rank = sorted.findIndex((r) => r.clubId === save.humanClubId) + 1
  const isChampion = rank === 1
  const europeOk = div === 1 && rank >= 1 && rank <= 4

  let state: PayState = {
    clubs: save.clubs,
    players: save.players,
    finance: ensureClubFinance(save),
    inbox: save.inbox,
  }
  let dirty = false

  const clauses = ensureClauses(desk).map((cl) => {
    if (cl.status !== 'active') return cl
    if (cl.fromClubId !== save.humanClubId) return cl
    if (cl.kind === 'league_title' && isChampion) {
      const paid = payClause(
        state,
        save,
        cl,
        cl.amount,
        'โบนัสแชมป์ลีก',
        `${cl.playerName} · แชมป์ลีก · จ่าย ${formatMoney(cl.amount)} ให้คลับเดิม`,
      )
      if (!paid.ok) return { ...cl, note: `${cl.note} · รอจ่าย` }
      state = paid.state
      dirty = true
      return { ...cl, status: 'paid' as const, appearancesSoFar: 1, note: `จ่ายแล้ว ${formatMoney(cl.amount)}` }
    }
    if (cl.kind === 'europe_qualify' && europeOk) {
      const paid = payClause(
        state,
        save,
        cl,
        cl.amount,
        'โบนัสโซนยุโรป',
        `${cl.playerName} · อันดับ ${rank} · จ่าย ${formatMoney(cl.amount)} ให้คลับเดิม`,
      )
      if (!paid.ok) return { ...cl, note: `${cl.note} · รอจ่าย` }
      state = paid.state
      dirty = true
      return { ...cl, status: 'paid' as const, appearancesSoFar: 1, note: `จ่ายแล้ว ${formatMoney(cl.amount)}` }
    }
    return cl
  })

  if (!dirty) return save
  return {
    ...save,
    clubs: state.clubs,
    players: state.players,
    clubFinance: state.finance,
    inbox: state.inbox,
    transferDesk: { ...desk, clauses },
  }
}

/** หลังเลื่อนชั้น — จ่ายโบนัส promotion */
export function tickPromotionClauses(save: GameSave, promotedClubIds: string[]): GameSave {
  const desk = save.transferDesk
  if (!desk?.clauses?.length || !promotedClubIds.length) return save
  const promoted = new Set(promotedClubIds)

  let state: PayState = {
    clubs: save.clubs,
    players: save.players,
    finance: ensureClubFinance(save),
    inbox: save.inbox,
  }
  let dirty = false

  const clauses = ensureClauses(desk).map((cl) => {
    if (cl.status !== 'active' || cl.kind !== 'promotion') return cl
    if (!promoted.has(cl.fromClubId)) return cl
    const paid = payClause(
      state,
      save,
      cl,
      cl.amount,
      'โบนัสเลื่อนชั้น',
      `${cl.playerName} · เลื่อนชั้น · จ่าย ${formatMoney(cl.amount)} ให้คลับเดิม`,
    )
    if (!paid.ok) return { ...cl, note: `${cl.note} · รอจ่าย` }
    state = paid.state
    dirty = true
    return { ...cl, status: 'paid' as const, appearancesSoFar: 1, note: `จ่ายแล้ว ${formatMoney(cl.amount)}` }
  })

  if (!dirty) return save
  return {
    ...save,
    clubs: state.clubs,
    players: state.players,
    clubFinance: state.finance,
    inbox: state.inbox,
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
  let state: PayState = {
    clubs: save.clubs,
    players: save.players,
    finance: ensureClubFinance(save),
    inbox: save.inbox,
  }

  const clauses = ensureClauses(desk).map((cl) => {
    if (cl.status !== 'active' || cl.kind !== 'sell_on' || cl.playerId !== playerId) return cl
    const due = Math.round(saleFee * (cl.sellOnPercent / 100))
    if (due <= 0) return { ...cl, status: 'paid' as const }
    const paid = payClause(
      state,
      save,
      cl,
      due,
      'Sell-on ถูกเรียกเก็บ',
      `ขาย ${cl.playerName} · จ่าย ${formatMoney(due)} (${cl.sellOnPercent}%) ให้คลับเดิม`,
    )
    if (!paid.ok) {
      return { ...cl, note: `${cl.note} · ค้างจ่าย ${formatMoney(due)}` }
    }
    state = paid.state
    return {
      ...cl,
      amount: due,
      status: 'paid' as const,
      note: `จ่าย sell-on ${formatMoney(due)}`,
    }
  })

  return {
    ...save,
    clubs: state.clubs,
    players: state.players,
    clubFinance: state.finance,
    inbox: state.inbox,
    transferDesk: { ...desk, clauses },
  }
}
