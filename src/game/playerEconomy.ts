import spendingsDb from '@/data/playerSpendings.json'
import type {
  Club,
  ClubFinanceState,
  FanState,
  FinanceLedgerEntry,
  GameSave,
  Player,
  PlayerSpendDef,
  PlayerSpendLog,
} from './types'

export const PLAYER_SPENDINGS: PlayerSpendDef[] = spendingsDb.spendings as PlayerSpendDef[]

export function createClubFinance(): ClubFinanceState {
  return {
    ticketSeason: 0,
    shirtSeason: 0,
    wageSeason: 0,
    fineSeason: 0,
    sponsorSeason: 0,
    tvSeason: 0,
    prizeSeason: 0,
    lastMatchTickets: 0,
    lastMatchShirts: 0,
    lastMatchCrowd: 0,
    ledger: [],
    spendLogs: [],
    fineLogs: [],
  }
}

export function ensureClubFinance(save: GameSave): ClubFinanceState {
  const raw = save.clubFinance
  if (!raw) return createClubFinance()
  return {
    ...createClubFinance(),
    ...raw,
    fineSeason: raw.fineSeason ?? 0,
    sponsorSeason: raw.sponsorSeason ?? 0,
    tvSeason: raw.tvSeason ?? 0,
    prizeSeason: raw.prizeSeason ?? 0,
    fineLogs: raw.fineLogs ?? [],
  }
}

export function getSpend(id: string): PlayerSpendDef | undefined {
  return PLAYER_SPENDINGS.find((s) => s.id === id)
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

/** เงินเริ่มต้นตามค่าเหนื่อย (สัปดาห์ที่สะสมมา) */
export function initialPlayerCash(wage: number, rng = Math.random): number {
  return Math.round(wage * (6 + rng() * 14))
}

export type GateReceipt = {
  crowd: number
  tickets: number
  shirts: number
  shirtUnits: number
  total: number
}

/** รายได้ตั๋ว + ขายเสื้อนัดเหย้า */
export function calcGateReceipt(
  club: Club,
  goalsFor: number,
  goalsAgainst: number,
  fans?: FanState,
): GateReceipt {
  const fanMult = fans
    ? 0.62 + (fans.mood / 100) * 0.66
    : 1
  const fill = 0.55 + Math.min(0.35, club.reputation / 200)
  const crowd = Math.round(club.stadiumCapacity * fill * fanMult)
  const resultMood = goalsFor > goalsAgainst ? 1.08 : goalsFor === goalsAgainst ? 1 : 0.92
  const ticketPrice = 180 + club.reputation * 2.2
  const tickets = Math.round(crowd * ticketPrice * resultMood)

  const shirtRate =
    0.06 +
    club.reputation / 900 +
    (fans ? fans.mood / 2000 : 0.02) +
    (goalsFor > goalsAgainst ? 0.04 : goalsFor === goalsAgainst ? 0.01 : -0.015)
  const shirtUnits = Math.max(0, Math.round(crowd * Math.max(0.02, shirtRate)))
  const shirtPrice = 650 + club.reputation * 18
  const shirts = Math.round(shirtUnits * shirtPrice * (goalsFor > goalsAgainst ? 1.12 : 1))

  return {
    crowd,
    tickets,
    shirts,
    shirtUnits,
    total: tickets + shirts,
  }
}

export function applyGateReceiptToClub(
  club: Club,
  receipt: GateReceipt,
): Club {
  return {
    ...club,
    balance: club.balance + receipt.total,
    ticketRevenueSeason: (club.ticketRevenueSeason ?? 0) + receipt.tickets,
    shirtRevenueSeason: (club.shirtRevenueSeason ?? 0) + receipt.shirts,
  }
}

export function recordHumanGate(
  finance: ClubFinanceState,
  date: string,
  receipt: GateReceipt,
  clubName: string,
): ClubFinanceState {
  const entries: FinanceLedgerEntry[] = [
    {
      id: uid('fin'),
      date,
      kind: 'tickets' as const,
      amount: receipt.tickets,
      note: `ตั๋ว ${clubName} · ผู้ชม ~${receipt.crowd.toLocaleString('th-TH')}`,
    },
    {
      id: uid('fin'),
      date,
      kind: 'shirts' as const,
      amount: receipt.shirts,
      note: `ขายเสื้อ ${receipt.shirtUnits.toLocaleString('th-TH')} ตัว`,
    },
    ...finance.ledger,
  ].slice(0, 50)

  return {
    ...finance,
    ticketSeason: finance.ticketSeason + receipt.tickets,
    shirtSeason: finance.shirtSeason + receipt.shirts,
    lastMatchTickets: receipt.tickets,
    lastMatchShirts: receipt.shirts,
    lastMatchCrowd: receipt.crowd,
    ledger: entries,
  }
}

/** จ่ายค่าเหนื่อย: หักคลับ + เข้ากระเป๋านักเตะ */
export function payWeeklyWagesWithCash(
  clubs: Club[],
  players: Player[],
): { clubs: Club[]; players: Player[]; wageTotalByClub: Record<string, number> } {
  const wageTotalByClub: Record<string, number> = {}
  for (const p of players) {
    wageTotalByClub[p.clubId] = (wageTotalByClub[p.clubId] ?? 0) + p.wage
  }
  const clubsNext = clubs.map((c) => ({
    ...c,
    balance: c.balance - (wageTotalByClub[c.id] ?? 0),
  }))
  const playersNext = players.map((p) => ({
    ...p,
    cash: Math.max(0, (p.cash ?? 0) + p.wage),
  }))
  return { clubs: clubsNext, players: playersNext, wageTotalByClub }
}

function pickSpend(player: Player, rng: () => number): PlayerSpendDef | null {
  const pro = player.growth?.professionalism ?? 10
  const amb = player.growth?.ambition ?? 10
  const temp =
    player.personalityId === 'temperamental'
      ? 14
      : player.personalityId === 'model_pro'
        ? 4
        : 10
  const cash = player.cash ?? 0
  if (cash < 800) return null

  const weighted: Array<{ s: PlayerSpendDef; w: number }> = []
  for (const s of PLAYER_SPENDINGS) {
    if (s.costMin > cash * 1.05) continue
    let w =
      s.weightBase +
      s.wPro * ((pro - 10) / 5) +
      s.wAmb * ((amb - 10) / 5) +
      s.wTemp * ((temp - 10) / 5)
    if (s.category === 'vice' && pro >= 15) w *= 0.25
    if (s.category === 'career' && pro >= 14) w += 2
    if (s.category === 'luxury' && cash < player.wage * 20) w *= 0.4
    if (s.category === 'trouble' && temp < 10) w *= 0.3
    w = Math.max(0.02, w)
    weighted.push({ s, w })
  }
  if (!weighted.length) return null

  // chance to spend at all
  const urge = 0.22 + amb / 80 + (temp > 12 ? 0.08 : 0) - pro / 120
  if (rng() > Math.min(0.55, urge)) return null

  const total = weighted.reduce((a, x) => a + x.w, 0)
  let roll = rng() * total
  for (const row of weighted) {
    roll -= row.w
    if (roll <= 0) return row.s
  }
  return weighted[weighted.length - 1].s
}

function rollCost(def: PlayerSpendDef, cash: number, rng: () => number): number {
  const raw = def.costMin + rng() * (def.costMax - def.costMin)
  // crypto/stocks: maybe lose or gain extra from wallet after
  return Math.round(Math.min(cash, raw))
}

/**
 * จำลองนักเตะใช้เงินส่วนตัว (โฟกัสล็อกทีมคุณ + สุ่ม AI น้อย)
 * เรียกหลัง daily life / แมตช์เดย์
 */
export function simulatePlayerSpending(save: GameSave, days = 7): GameSave {
  const finance = ensureClubFinance(save)
  const rng = mulberry32(save.season * 440 + save.matchday * 29 + 3)
  let players = save.players.slice()
  const logs: PlayerSpendLog[] = []
  let clubExtra = 0 // merch buy-back

  const humanIds = new Set(
    players.filter((p) => p.clubId === save.humanClubId).map((p) => p.id),
  )

  for (let day = 0; day < days; day++) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      const isHuman = humanIds.has(p.id)
      // AI players spend less often (perf)
      if (!isHuman && rng() > 0.12) continue

      const def = pickSpend(p, rng)
      if (!def) continue

      let amount = rollCost(def, p.cash ?? 0, rng)
      if (amount <= 0 || amount > (p.cash ?? 0)) continue

      // invest variance
      if (def.id === 'crypto_fomo' || def.id === 'stock_app') {
        const boom = rng()
        if (boom > 0.62) {
          const gain = Math.round(amount * (0.1 + rng() * 0.45))
          amount = amount // still spent
          players[i] = {
            ...players[i],
            cash: (players[i].cash ?? 0) - amount + gain,
            morale: clamp(players[i].morale + 1, 1, 20),
          }
          if (isHuman) {
            logs.push({
              id: uid('spend'),
              date: save.currentDate,
              playerId: p.id,
              playerName: p.name,
              spendId: def.id,
              labelTh: def.labelTh,
              category: def.category,
              amount,
              note: `${def.note} · กำไรกลับ +${gain.toLocaleString('th-TH')} ฿`,
            })
          }
          continue
        }
        if (boom < 0.28) {
          // total loss already in amount
        }
      }

      if (def.id === 'fan_merch_buy') {
        clubExtra += Math.round(amount * 0.55)
      }

      const e = def.effects
      players[i] = {
        ...players[i],
        cash: (players[i].cash ?? 0) - amount,
        sharpness: clamp(players[i].sharpness + (e.sharpness ?? 0), 0, 100),
        condition: clamp(players[i].condition + (e.condition ?? 0), 0, 100),
        morale: clamp(players[i].morale + (e.morale ?? 0), 1, 20),
        happiness: clamp((players[i].happiness ?? players[i].morale) + (e.happiness ?? 0), 1, 20),
        lastActivityId: def.id,
      }

      if (isHuman) {
        logs.push({
          id: uid('spend'),
          date: save.currentDate,
          playerId: p.id,
          playerName: p.name,
          spendId: def.id,
          labelTh: def.labelTh,
          category: def.category,
          amount,
          note: def.note,
        })
      }
    }
  }

  let clubs = save.clubs
  if (clubExtra > 0) {
    clubs = clubs.map((c) =>
      c.id === save.humanClubId
        ? {
            ...c,
            balance: c.balance + clubExtra,
            shirtRevenueSeason: (c.shirtRevenueSeason ?? 0) + clubExtra,
          }
        : c,
    )
  }

  const nextFinance: ClubFinanceState = {
    ...finance,
    shirtSeason: finance.shirtSeason + (clubExtra > 0 ? clubExtra : 0),
    spendLogs: [...logs, ...finance.spendLogs].slice(0, 120),
    ledger:
      clubExtra > 0
        ? [
            {
              id: uid('fin'),
              date: save.currentDate,
              kind: 'shirts' as const,
              amount: clubExtra,
              note: 'นักเตะซื้อเสื้อทีมแจก (ไหลกลับคลับ)',
            },
            ...finance.ledger,
          ].slice(0, 50)
        : finance.ledger,
  }

  const inbox =
    logs.length >= 3
      ? [
          {
            id: `msg-spend-${Date.now()}`,
            date: save.currentDate,
            title: 'การใช้เงินนักเตะ',
            body: logs
              .slice(0, 5)
              .map((l) => `${l.playerName}: ${l.labelTh} (−${l.amount.toLocaleString('th-TH')} ฿)`)
              .join(' · '),
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40)
      : save.inbox

  return {
    ...save,
    players,
    clubs,
    clubFinance: nextFinance,
    inbox,
  }
}
