import finesDb from '@/data/disciplineFines.json'
import type {
  ClubFinanceState,
  DisciplineFineDef,
  GameSave,
  Player,
  PlayerFineLog,
} from './types'
import { ensureClubFinance } from './playerEconomy'

export const DISCIPLINE_FINES: DisciplineFineDef[] = finesDb.fines as DisciplineFineDef[]

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function matchingFines(triggerKeys: string[]): DisciplineFineDef[] {
  const keys = new Set(triggerKeys)
  return DISCIPLINE_FINES.filter((f) => f.triggers.some((t) => keys.has(t)))
}

function rollAmount(def: DisciplineFineDef, wage: number, rng: () => number): number {
  const fromWage =
    wage * (def.wageShareMin + rng() * (def.wageShareMax - def.wageShareMin))
  const flat = def.fineMin + rng() * (def.fineMax - def.fineMin)
  // mix: mostly wage-based, floor/ceil by flat range
  const raw = fromWage * 0.65 + flat * 0.35
  return Math.round(clamp(raw, def.fineMin, def.fineMax * 1.15))
}

export type FineContext = {
  /** activity id, category, or match tags like red_card */
  triggers: string[]
  date: string
  /** force catch (match cards) */
  alwaysCatch?: boolean
}

/**
 * สุ่มว่าจะโดนจับและปรับเงินหรือไม่ — แล้วแต่หน้างาน (pool ที่ match trigger)
 * เงินหักจากกระเป๋านักเตะ · ส่วนใหญ่เข้าบัญชีสโมสร
 */
export function tryDisciplineFine(
  player: Player,
  ctx: FineContext,
  rng: () => number,
): { player: Player; log: PlayerFineLog | null; clubGain: number } {
  const pool = matchingFines(ctx.triggers)
  if (pool.length === 0) {
    return { player, log: null, clubGain: 0 }
  }

  const pro = player.growth?.professionalism ?? 10
  // low professionalism → easier to get caught
  const proFactor = clamp(1.15 - (pro - 10) * 0.06, 0.45, 1.35)

  const candidates = pool
    .map((def) => {
      const chance = ctx.alwaysCatch ? 1 : clamp(def.caughtBase * proFactor, 0.05, 0.98)
      return { def, chance }
    })
    .filter((c) => rng() < c.chance)

  if (candidates.length === 0) {
    return { player, log: null, clubGain: 0 }
  }

  // pick one random among those that "fired"
  const picked = candidates[Math.floor(rng() * candidates.length)].def
  const amount = Math.min(
    player.cash ?? 0,
    rollAmount(picked, player.wage, rng),
  )
  if (amount <= 0) {
    // still log attempt with 0 if broke — club notes debt lite: skip
    return { player, log: null, clubGain: 0 }
  }

  const e = picked.effects ?? {}
  const next: Player = {
    ...player,
    cash: Math.max(0, (player.cash ?? 0) - amount),
    morale: clamp(player.morale + (e.morale ?? -1), 1, 20),
    happiness: clamp(
      (player.happiness ?? player.morale) + (e.happiness ?? -1),
      1,
      20,
    ),
  }

  const trigger = ctx.triggers.find((t) => picked.triggers.includes(t)) ?? ctx.triggers[0]
  const log: PlayerFineLog = {
    id: uid('fine'),
    date: ctx.date,
    playerId: player.id,
    playerName: player.name,
    fineId: picked.id,
    labelTh: picked.labelTh,
    amount,
    trigger,
    note: picked.note,
  }

  return { player: next, log, clubGain: amount }
}

export function appendFineToFinance(
  finance: ClubFinanceState,
  log: PlayerFineLog,
  clubGain: number,
): ClubFinanceState {
  return {
    ...finance,
    fineSeason: (finance.fineSeason ?? 0) + clubGain,
    fineLogs: [log, ...(finance.fineLogs ?? [])].slice(0, 80),
    ledger: [
      {
        id: uid('fin'),
        date: log.date,
        kind: 'fine' as const,
        amount: clubGain,
        note: `ปรับวินัย: ${log.playerName} · ${log.labelTh}`,
      },
      ...finance.ledger,
    ].slice(0, 50),
  }
}

/** Apply fines for a batch of lifestyle events (human squad focus for logs). */
export function applyLifestyleFines(
  save: GameSave,
  events: Array<{
    playerId: string
    activityId: string
    category: string
    missTraining: boolean
    date: string
  }>,
  rng: () => number,
): GameSave {
  let players = save.players.slice()
  let finance = ensureClubFinance(save)
  let clubs = save.clubs.slice()
  const inboxBits: string[] = []
  let humanClubGain = 0

  for (const ev of events) {
    const idx = players.findIndex((p) => p.id === ev.playerId)
    if (idx < 0) continue
    const triggers = [
      ev.activityId,
      ev.category,
      ...(ev.missTraining ? ['missTraining'] : []),
    ]
    // only attempt when there's something to catch
    if (!ev.missTraining && ev.category !== 'lapse' && ev.category !== 'conflict') {
      // still allow specific activity triggers (pub, gamble, etc.)
      if (!matchingFines([ev.activityId]).length) continue
    }

    const result = tryDisciplineFine(players[idx], { triggers, date: ev.date }, rng)
    if (!result.log) continue
    players[idx] = result.player
    finance = appendFineToFinance(finance, result.log, result.clubGain)
    const clubId = players[idx].clubId
    clubs = clubs.map((c) =>
      c.id === clubId ? { ...c, balance: c.balance + result.clubGain } : c,
    )
    if (clubId === save.humanClubId) {
      humanClubGain += result.clubGain
      inboxBits.push(
        `${result.log.playerName}: ${result.log.labelTh} (−${result.log.amount.toLocaleString('th-TH')} ฿)`,
      )
    }
  }

  if (inboxBits.length === 0 && humanClubGain === 0) {
    return { ...save, players, clubs, clubFinance: finance }
  }

  return {
    ...save,
    players,
    clubs,
    clubFinance: finance,
    inbox:
      inboxBits.length > 0
        ? [
            {
              id: `msg-fine-${Date.now()}`,
              date: save.currentDate,
              title: `ค่าปรับวินัย · ${inboxBits.length} เคส`,
              body: inboxBits.slice(0, 6).join(' · '),
              read: false,
            },
            ...save.inbox,
          ].slice(0, 40)
        : save.inbox,
  }
}

/** After match cards — red / yellow-ban always roll fine. */
export function applyMatchCardFines(
  save: GameSave,
  notes: Array<{ playerId: string; kind: 'red_card' | 'yellow_ban' }>,
  date: string,
  rng: () => number,
): GameSave {
  let players = [...save.players]
  let finance = ensureClubFinance(save)
  let clubs = [...save.clubs]
  const bits: string[] = []

  for (const n of notes) {
    const idx = players.findIndex((p) => p.id === n.playerId)
    if (idx < 0) continue
    const result = tryDisciplineFine(
      players[idx],
      { triggers: [n.kind], date, alwaysCatch: true },
      rng,
    )
    if (!result.log) continue
    players[idx] = result.player
    finance = appendFineToFinance(finance, result.log, result.clubGain)
    const clubId = players[idx].clubId
    clubs = clubs.map((c) =>
      c.id === clubId ? { ...c, balance: c.balance + result.clubGain } : c,
    )
    if (clubId === save.humanClubId) {
      bits.push(
        `${result.log.playerName}: ${result.log.labelTh} (−${result.log.amount.toLocaleString('th-TH')} ฿)`,
      )
    }
  }

  if (bits.length === 0) return { ...save, players, clubs, clubFinance: finance }

  return {
    ...save,
    players,
    clubs,
    clubFinance: finance,
    inbox: [
      {
        id: `msg-card-fine-${Date.now()}`,
        date,
        title: 'ปรับวินัยในสนาม',
        body: bits.join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** When vice spending is logged — chance club also fines them. */
export function maybeFineAfterSpend(
  player: Player,
  spendId: string,
  date: string,
  rng: () => number,
): { player: Player; log: PlayerFineLog | null; clubGain: number } {
  return tryDisciplineFine(
    player,
    { triggers: [spendId, 'lapse', 'vice'], date },
    rng,
  )
}
