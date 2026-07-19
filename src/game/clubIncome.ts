import type { ClubIncomeState, GameSave, SponsorDeal } from './types'
import { ensureClubFinance } from './playerEconomy'
import prizeDb from '@/data/prizeMoney.json'
import { applyTitleClubReputation, type TitleRepKind } from './reputation'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

const DOMESTIC_PRIZE_KINDS = new Set(['cup', 'league_cup', 'trophy'])

/** ตัวคูณเงินรางวัลถ้วยในประเทศตามความเข้มของลีก (1.0 = พรีเมียร์ลีก) */
export function domesticPrizeScale(leagueId: string | undefined | null): number {
  const scales = (prizeDb as { leagueScale?: Record<string, number> }).leagueScale ?? {}
  const id = leagueId || 'eng'
  return scales[id] ?? 0.4
}

/** ปรับยอดตามลีก — ถ้วยทวีปไม่คูณ */
export function scaledPrizeAmount(
  base: number,
  kind: string,
  leagueId: string | undefined | null,
): number {
  if (!DOMESTIC_PRIZE_KINDS.has(kind)) return base
  const scale = domesticPrizeScale(leagueId)
  return Math.max(50_000, Math.round(base * scale))
}

export type PrizeKind =
  | 'cup'
  | 'ucl'
  | 'uel'
  | 'uecl'
  | 'acl'
  | 'acl_two'
  | 'asean_cup'
  | 'cwc'
  | 'super_cup'
  | 'league_cup'
  | 'trophy'

export function prizeAmountFor(
  save: GameSave,
  kind: PrizeKind,
  slot: 'champion' | 'runnerUp',
): number {
  const base =
    slot === 'champion'
      ? ((prizeDb.champion as Record<string, number>)[kind] ?? 1_000_000)
      : ((prizeDb.runnerUp as Record<string, number>)[kind] ?? 0)
  return scaledPrizeAmount(base, kind, save.leagueId)
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
        note: `TV MD${save.matchday}`,
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

function payPrize(
  save: GameSave,
  clubId: string,
  amount: number,
  note: string,
): GameSave {
  if (amount <= 0) return save
  const clubs = save.clubs.map((c) =>
    c.id === clubId ? { ...c, balance: c.balance + amount } : c,
  )
  if (clubId !== save.humanClubId) return { ...save, clubs }

  let finance = ensureClubFinance(save)
  finance = {
    ...finance,
    prizeSeason: (finance.prizeSeason ?? 0) + amount,
    ledger: [
      {
        id: uid('led'),
        date: save.currentDate,
        kind: 'prize' as const,
        amount,
        note,
      },
      ...finance.ledger,
    ].slice(0, 50),
  }
  return { ...save, clubs, clubFinance: finance }
}

export function prizeTable() {
  return prizeDb
}

/** ทีมแพ้ชิงชนะเลิศจากนัด final ที่เล่นแล้ว */
export function finalRunnerUpClubId(
  fixtures: GameSave['fixtures'],
  competition: string,
  championClubId: string,
): string | null {
  const finals = fixtures.filter(
    (f) => f.competition === competition && f.cupRound === 'final' && f.played,
  )
  const final = finals[finals.length - 1]
  if (!final) return null
  if (final.homeClubId === championClubId) return final.awayClubId
  if (final.awayClubId === championClubId) return final.homeClubId
  return null
}

/** ทีมที่เพิ่งเข้าสู่รอบ qf/sf (เพิ่งมีฟิกซ์เจอร์รอบนั้น) */
export function newlyQualifiedClubIds(
  prevFixtures: GameSave['fixtures'],
  nextFixtures: GameSave['fixtures'],
  competition: 'ucl' | 'uel' | 'uecl' | 'acl' | 'acl_two' | 'asean_cup',
  stage: 'qf' | 'sf',
): string[] {
  const had = prevFixtures.some(
    (f) => f.competition === competition && f.cupRound === stage,
  )
  if (had) return []
  const ids = new Set<string>()
  for (const f of nextFixtures) {
    if (f.competition === competition && f.cupRound === stage) {
      ids.add(f.homeClubId)
      ids.add(f.awayClubId)
    }
  }
  return [...ids]
}

/** เงินรางวัลแชมป์ (+รองชนะเลิศถ้ามี) — ถ้วยในประเทศสเกลตามลีก */
export function awardCompetitionPrize(
  save: GameSave,
  kind: PrizeKind,
  championClubId: string,
  runnerUpClubId?: string | null,
): GameSave {
  const champAmt = prizeAmountFor(save, kind, 'champion')
  const label = (prizeDb.labels as Record<string, string>)[kind] ?? kind
  const scaleNote =
    DOMESTIC_PRIZE_KINDS.has(kind) && save.leagueId
      ? ` · สเกลลีก ×${domesticPrizeScale(save.leagueId).toFixed(2)}`
      : ''
  let next = payPrize(save, championClubId, champAmt, `เงินรางวัลแชมป์ ${label}${scaleNote}`)

  if (runnerUpClubId) {
    const ru = prizeAmountFor(save, kind, 'runnerUp')
    if (ru > 0) {
      next = payPrize(next, runnerUpClubId, ru, `เงินรางวัลรองชนะเลิศ ${label}${scaleNote}`)
    }
  }
  return {
    ...next,
    clubs: applyTitleClubReputation(
      next.clubs,
      kind as TitleRepKind,
      championClubId,
      runnerUpClubId,
    ),
  }
}

/** โบนัสเข้ารอบลึก (QF / SF) — จ่ายทีมที่เพิ่งผ่านเข้ารอบ */
export function awardProgressPrize(
  save: GameSave,
  kind: 'ucl' | 'uel' | 'uecl' | 'acl' | 'acl_two' | 'asean_cup',
  stage: 'qf' | 'sf',
  clubIds: string[],
): GameSave {
  const amt =
    ((prizeDb.progress as Record<string, Record<string, number>>)[kind] ?? {})[stage] ?? 0
  if (amt <= 0 || !clubIds.length) return save
  const label = (prizeDb.labels as Record<string, string>)[kind] ?? kind
  const stageTh = stage === 'qf' ? 'รอบ 8 ทีม' : 'รอบรองชนะเลิศ'
  let next = save
  for (const id of clubIds) {
    next = payPrize(next, id, amt, `โบนัส${stageTh} ${label}`)
  }
  return next
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
