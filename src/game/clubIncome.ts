import type { ClubIncomeState, GameSave, SponsorDeal } from './types'
import { ensureClubFinance } from './playerEconomy'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const SPONSOR_NAMES = [
  'AeroTel',
  'NexBank',
  'Summit Energy',
  'UrbanWear',
  'BlueChip Motors',
  'Harbor Insurance',
]

export function createClubIncome(clubRep: number): ClubIncomeState {
  const tier = Math.max(1, Math.round(clubRep / 20))
  const main: SponsorDeal = {
    id: 'spon-main',
    name: SPONSOR_NAMES[tier % SPONSOR_NAMES.length],
    perMatchday: Math.round(80_000 + clubRep * 4_500),
    seasonTotal: Math.round(2_500_000 + clubRep * 120_000),
    paid: 0,
  }
  const sleeve: SponsorDeal = {
    id: 'spon-sleeve',
    name: SPONSOR_NAMES[(tier + 2) % SPONSOR_NAMES.length],
    perMatchday: Math.round(25_000 + clubRep * 1_200),
    seasonTotal: Math.round(800_000 + clubRep * 40_000),
    paid: 0,
  }
  return {
    sponsors: [main, sleeve],
    tvPerMatchday: Math.round(120_000 + clubRep * 6_000),
    tvSeasonPaid: 0,
  }
}

export function ensureClubIncome(save: GameSave): ClubIncomeState {
  if (save.clubIncome?.sponsors?.length) return save.clubIncome
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  return createClubIncome(club?.reputation ?? 50)
}

/** จ่ายสปอนเซอร์ + TV หลังแมตช์เดย์ (ทีมคุณ) */
export function applyMatchdayIncome(save: GameSave): GameSave {
  const income = ensureClubIncome(save)
  let finance = ensureClubFinance(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  if (!club) return { ...save, clubIncome: income }

  let sponsorPay = 0
  const sponsors = income.sponsors.map((s) => {
    const left = Math.max(0, s.seasonTotal - s.paid)
    const chunk = Math.min(left, s.perMatchday)
    sponsorPay += chunk
    return { ...s, paid: s.paid + chunk }
  })
  const tv = income.tvPerMatchday
  const total = sponsorPay + tv

  const clubs = save.clubs.map((c) =>
    c.id === save.humanClubId ? { ...c, balance: c.balance + total } : c,
  )

  finance = {
    ...finance,
    sponsorSeason: (finance.sponsorSeason ?? 0) + sponsorPay,
    tvSeason: (finance.tvSeason ?? 0) + tv,
    ledger: [
      {
        id: uid('led'),
        date: save.currentDate,
        kind: 'sponsor' as const,
        amount: sponsorPay,
        note: `สปอนเซอร์ MD${save.matchday}`,
      },
      {
        id: uid('led'),
        date: save.currentDate,
        kind: 'tv' as const,
        amount: tv,
        note: `ค่าสิทธิ์ถ่ายทอด MD${save.matchday}`,
      },
      ...finance.ledger,
    ].slice(0, 50),
  }

  return {
    ...save,
    clubs,
    clubFinance: finance,
    clubIncome: {
      ...income,
      sponsors,
      tvSeasonPaid: income.tvSeasonPaid + tv,
    },
  }
}

export function awardCompetitionPrize(
  save: GameSave,
  kind: 'cup' | 'ucl',
  championClubId: string,
): GameSave {
  const prize = kind === 'ucl' ? 12_000_000 : 4_500_000
  if (championClubId !== save.humanClubId) {
    // still pay AI quietly
    const clubs = save.clubs.map((c) =>
      c.id === championClubId ? { ...c, balance: c.balance + prize } : c,
    )
    return { ...save, clubs }
  }

  let finance = ensureClubFinance(save)
  const clubs = save.clubs.map((c) =>
    c.id === save.humanClubId ? { ...c, balance: c.balance + prize } : c,
  )
  finance = {
    ...finance,
    prizeSeason: (finance.prizeSeason ?? 0) + prize,
    ledger: [
      {
        id: uid('led'),
        date: save.currentDate,
          kind: 'prize' as const,
        amount: prize,
        note: kind === 'ucl' ? 'เงินรางวัลแชมป์ UCL' : 'เงินรางวัลแชมป์ถ้วย',
      },
      ...finance.ledger,
    ].slice(0, 50),
  }
  return { ...save, clubs, clubFinance: finance }
}

/** พยากรณ์กระแสเงิน 6 แมตช์เดย์ถัดไป */
export function cashflowForecast(save: GameSave): {
  matchday: number
  income: number
  wages: number
  net: number
  projectedBalance: number
}[] {
  const income = ensureClubIncome(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const wages = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .reduce((s, p) => s + p.wage, 0)
  const perMd =
    income.tvPerMatchday + income.sponsors.reduce((s, x) => s + x.perMatchday, 0)
  const rows = []
  let bal = club.balance
  for (let i = 1; i <= 6; i++) {
    const net = perMd - wages
    bal += net
    rows.push({
      matchday: save.matchday + i,
      income: perMd,
      wages,
      net,
      projectedBalance: bal,
    })
  }
  return rows
}
