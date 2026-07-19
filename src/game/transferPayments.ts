import type {
  FeeInstallment,
  FeePaymentPreset,
  FeePaymentSchedule,
  GameSave,
  TransferDeskState,
} from './types'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export const FEE_PAYMENT_PRESETS: {
  id: FeePaymentPreset
  labelTh: string
  hintTh: string
}[] = [
  { id: 'full', labelTh: 'จ่ายก้อนเดียว', hintTh: '100% ทันที' },
  { id: 'half_2y', labelTh: 'ผ่อน 2 ปี (2 งวด)', hintTh: '50% ตอนนี้ · 50% ฤดูกาลหน้า' },
  {
    id: 'split_3y',
    labelTh: 'ผ่อน 3 ปี (40/30/30)',
    hintTh: '40% ตอนนี้ · 30% ปี 2 · 30% ปี 3',
  },
  {
    id: 'equal_3y',
    labelTh: 'ผ่อน 3 ปี เท่ากัน',
    hintTh: '~33% × 3 ฤดูกาล',
  },
  {
    id: 'front_heavy_3y',
    labelTh: 'ผ่อน 3 ปี (หนักหน้า)',
    hintTh: '60% ตอนนี้ · 20% · 20%',
  },
  {
    id: 'back_heavy_3y',
    labelTh: 'ผ่อน 3 ปี (หนักท้าย)',
    hintTh: '25% ตอนนี้ · 37.5% · 37.5% — ผู้ขายไม่ค่อยชอบ',
  },
]

/** สัดส่วนจ่ายทันที + งวดถัดไป (รวม = 1) */
function ratiosForPreset(preset: FeePaymentPreset): number[] {
  switch (preset) {
    case 'full':
      return [1]
    case 'half_2y':
      return [0.5, 0.5]
    case 'split_3y':
      return [0.4, 0.3, 0.3]
    case 'equal_3y':
      return [1 / 3, 1 / 3, 1 / 3]
    case 'front_heavy_3y':
      return [0.6, 0.2, 0.2]
    case 'back_heavy_3y':
      return [0.25, 0.375, 0.375]
    default:
      return [1]
  }
}

/** สร้างตารางผ่อนจากค่าตัวรวม (face value) */
export function buildFeePaymentSchedule(
  totalFee: number,
  preset: FeePaymentPreset,
  startSeason: number,
): FeePaymentSchedule {
  const ratios = ratiosForPreset(preset)
  const parts = ratios.map((r, i) => {
    if (i < ratios.length - 1) return Math.round(totalFee * r)
    return totalFee - ratios.slice(0, -1).reduce((s, x) => s + Math.round(totalFee * x), 0)
  })
  const dueNow = parts[0] ?? totalFee
  const installments: FeePaymentSchedule['installments'] = []
  for (let i = 1; i < parts.length; i++) {
    installments.push({
      amount: parts[i]!,
      dueSeason: startSeason + i,
      installmentIndex: i,
      totalInstallments: parts.length - 1,
    })
  }
  return { preset, totalFee, dueNow, installments }
}

/** มูลค่าปัจจุบันที่ผู้ขายมอง (ผ่อนยิ่งยาว / หนักท้าย → ลด NPV) */
export function sellerPresentValue(schedule: FeePaymentSchedule, winterHarsh = false): number {
  const disc = winterHarsh ? 0.86 : 0.9
  let npv = schedule.dueNow
  schedule.installments.forEach((inst, idx) => {
    npv += Math.round(inst.amount * Math.pow(disc, idx + 1))
  })
  return npv
}

export function describePaymentScheduleTh(schedule: FeePaymentSchedule): string {
  const preset = FEE_PAYMENT_PRESETS.find((p) => p.id === schedule.preset)
  if (schedule.preset === 'full' || schedule.installments.length === 0) {
    return `จ่ายทันที ${formatMoney(schedule.dueNow)}`
  }
  const future = schedule.installments
    .map((i) => `${formatMoney(i.amount)} (ฤดูกาล ${i.dueSeason})`)
    .join(' · ')
  return `${preset?.labelTh ?? 'ผ่อน'} · ตอนนี้ ${formatMoney(schedule.dueNow)} · งวดถัดไป: ${future}`
}

export function ensureFeeInstallments(desk: TransferDeskState): FeeInstallment[] {
  return desk.feeInstallments ?? []
}

export function attachFeeInstallments(
  save: GameSave,
  opts: {
    playerId: string
    playerName: string
    buyerClubId: string
    sellerClubId: string
    schedule: FeePaymentSchedule
  },
): GameSave {
  if (opts.schedule.installments.length === 0) return save
  const desk = save.transferDesk ?? { offers: [], auctions: [], clauses: [] }
  const rows: FeeInstallment[] = opts.schedule.installments.map((inst) => ({
    id: uid('fee-inst'),
    playerId: opts.playerId,
    playerName: opts.playerName,
    fromClubId: opts.buyerClubId,
    toClubId: opts.sellerClubId,
    amount: inst.amount,
    dueSeason: inst.dueSeason,
    installmentIndex: inst.installmentIndex,
    totalInstallments: inst.totalInstallments,
    status: 'pending',
    note: `งวดที่ ${inst.installmentIndex}/${inst.totalInstallments} · ${opts.playerName}`,
  }))
  return {
    ...save,
    transferDesk: {
      ...desk,
      feeInstallments: [...rows, ...ensureFeeInstallments(desk)].slice(0, 80),
    },
  }
}

/**
 * จ่ายงวดที่ครบกำหนดเมื่อขึ้นฤดูกาลใหม่ (dueSeason === season ปัจจุบัน)
 * งบไม่พอ → ค้าง overdue ลองใหม่รอบหน้า
 */
export function tickFeeInstallments(save: GameSave): GameSave {
  const desk = save.transferDesk
  if (!desk?.feeInstallments?.length) return save

  let clubs = save.clubs
  let finance = ensureClubFinance(save)
  let inbox = save.inbox
  let dirty = false

  const nextRows = desk.feeInstallments.map((inst) => {
    if (inst.status === 'paid') return inst
    if (inst.dueSeason > save.season) return inst
    // due หรือ overdue
    const payer = clubs.find((c) => c.id === inst.fromClubId)
    if (!payer || payer.balance < inst.amount) {
      dirty = true
      const seller = clubs.find((c) => c.id === inst.toClubId)
      inbox = [
        {
          id: uid('msg-fee-od'),
          date: save.currentDate,
          title: 'ค้างงวดค่าตัว',
          body: `งบไม่พอจ่ายงวด ${formatMoney(inst.amount)} ของ ${inst.playerName} ให้ ${seller?.name ?? inst.toClubId} — จะลองใหม่ภายหลัง`,
          read: false,
        },
        ...inbox,
      ].slice(0, 40)
      return { ...inst, status: 'overdue' as const, note: `${inst.note} · ค้างจ่าย` }
    }

    clubs = clubs.map((c) => {
      if (c.id === inst.fromClubId) return { ...c, balance: c.balance - inst.amount }
      if (c.id === inst.toClubId) return { ...c, balance: c.balance + inst.amount }
      return c
    })

    if (inst.fromClubId === save.humanClubId) {
      finance = {
        ...finance,
        transferOutSeason: (finance.transferOutSeason ?? 0) + inst.amount,
        ledger: [
          {
            id: uid('led-fee'),
            date: save.currentDate,
            kind: 'other' as const,
            amount: -inst.amount,
            note: `ผ่อนค่าตัว: ${inst.playerName} งวด ${inst.installmentIndex}/${inst.totalInstallments}`,
          },
          ...finance.ledger,
        ].slice(0, 50),
      }
    }

    dirty = true
    inbox = [
      {
        id: uid('msg-fee-ok'),
        date: save.currentDate,
        title: 'จ่ายงวดค่าตัว',
        body: `จ่าย ${formatMoney(inst.amount)} สำหรับ ${inst.playerName} (งวด ${inst.installmentIndex}/${inst.totalInstallments})`,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)

    return {
      ...inst,
      status: 'paid' as const,
      note: `จ่ายแล้ว ${formatMoney(inst.amount)} · ฤดูกาล ${save.season}`,
    }
  })

  if (!dirty) return save
  return {
    ...save,
    clubs,
    clubFinance: finance,
    inbox,
    transferDesk: { ...desk, feeInstallments: nextRows },
  }
}

export function pendingInstallmentsForClub(save: GameSave, clubId: string): FeeInstallment[] {
  return ensureFeeInstallments(save.transferDesk ?? { offers: [], auctions: [] }).filter(
    (i) =>
      (i.status === 'pending' || i.status === 'overdue') &&
      (i.fromClubId === clubId || i.toClubId === clubId),
  )
}

export function outstandingFeeCommitment(save: GameSave, clubId: string): number {
  return pendingInstallmentsForClub(save, clubId)
    .filter((i) => i.fromClubId === clubId)
    .reduce((s, i) => s + i.amount, 0)
}
