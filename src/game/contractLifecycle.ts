/**
 * วงจรสัญญา: ฟอร์มย้อนหลังค่าตัว · ทวงต่อสัญญา · ผู้ช่วยเตือนหมดสัญญา
 * ค่าเหนื่อยเปลี่ยนเฉพาะตอนซื้อ/ต่อสัญญา/พรี-คอนแทรกต์ — ไม่ตามฟอร์มรายสัปดาห์
 */
import type {
  ContractNegotiation,
  GameSave,
  Player,
} from './types'
import { formatMoney } from '@/lib/format'
import { agentAskMul, agentStyleFor } from './agents'
import {
  focusLabelTh,
  negotiationProfile,
  seedContractBonusAsks,
} from './contractNegotiation'

const FORM_HISTORY_MAX = 16
/** ~1 เดือนของฤดูกาล (MD ≈ สัปดาห์) */
export const CONTRACT_REMIND_INTERVAL_MD = 4

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

function negotiationWageMulLocal(player: Player): number {
  const f = formWindowAvg(player, 4)
  let m = 0.94 + (Math.min(20, Math.max(1, f)) / 20) * 0.16
  const h = Math.min(20, Math.max(0, player.marketHeat ?? 0))
  if (h >= 12) m *= 1.04
  else if (h >= 7) m *= 1.02
  return Math.round(m * 1000) / 1000
}

function ensureTalksList(save: GameSave): ContractNegotiation[] {
  return save.contractTalks?.talks ?? []
}

export function yearsLeftOnContract(player: Player, season: number): number {
  if (typeof player.contractEndSeason === 'number' && player.contractEndSeason > 0) {
    return Math.max(0, player.contractEndSeason - season)
  }
  return Math.max(0, player.contractYears ?? 0)
}

/** ซิงก์ contractYears จากวันหมด — เรียกตอนแมตช์เดย์/ต้นฤดูกาล */
export function syncContractYears(player: Player, season: number): Player {
  const left = yearsLeftOnContract(player, season)
  if (player.contractYears === left) return player
  return { ...player, contractYears: left }
}

export function pushFormHistory(player: Player): Player {
  const cur = Math.min(20, Math.max(1, player.form ?? 10))
  const prev = player.formHistory ?? []
  const next = [...prev, cur].slice(-FORM_HISTORY_MAX)
  return { ...player, formHistory: next }
}

export function recordAllFormHistory(save: GameSave): GameSave {
  return {
    ...save,
    players: save.players.map((p) => pushFormHistory(p)),
  }
}

export function formWindowAvg(player: Player, window: number): number {
  const hist = player.formHistory
  if (!hist?.length) return Math.min(20, Math.max(1, player.form ?? 10))
  const slice = hist.slice(-Math.max(1, window))
  return slice.reduce((s, n) => s + n, 0) / slice.length
}

/** ค่าตัวจากฟอร์มรายสัปดาห์ (4 MD) + รายเดือน (12 MD) · ร้อนต่อเนื่องโก่งได้ */
export function rollingFormMarketMul(player: Player): number {
  const week = formWindowAvg(player, 4)
  const month = formWindowAvg(player, 12)
  const toMul = (f: number) => 0.9 + (Math.min(20, Math.max(1, f)) / 20) * 0.22
  let m = toMul(week) * 0.55 + toMul(month) * 0.45
  // โก่งค่าตัว: ฟอร์มร้อนทั้งสัปดาห์+เดือน
  if (week >= 15 && month >= 14) m *= 1.06
  if (week >= 17 && month >= 15 && (player.marketHeat ?? 0) >= 10) m *= 1.05
  return Math.round(m * 1000) / 1000
}

export function rollingFormHints(player: Player): string[] {
  const hints: string[] = []
  const week = formWindowAvg(player, 4)
  const month = formWindowAvg(player, 12)
  if (week >= 15 && month >= 14) {
    hints.push(
      `ฟอร์มร้อนต่อเนื่อง (สัปดาห์ ${week.toFixed(0)} · เดือน ${month.toFixed(0)}) · ค่าตัวโก่ง`,
    )
  } else if (week >= 14) {
    hints.push(`ฟอร์ม 4 นัดล่าสุดดี (${week.toFixed(1)}/20)`)
  } else if (week <= 7) {
    hints.push(`ฟอร์ม 4 นัดล่าสุดเย็น (${week.toFixed(1)}/20)`)
  } else if (month <= 8 && (player.formHistory?.length ?? 0) >= 6) {
    hints.push(`ฟอร์มรายเดือนอ่อน (${month.toFixed(1)}/20)`)
  }
  return hints
}

function seedAskWage(player: Player, save: GameSave): number {
  const style = agentStyleFor(player)
  const ambitionBump = player.overall >= 78 ? 1.12 : player.overall >= 72 ? 1.06 : 1.02
  return Math.round(
    player.wage * ambitionBump * agentAskMul(style) * negotiationWageMulLocal(player),
  )
}

/** เปิดโต๊ะต่อสัญญา (ถ้ายังไม่มีรอบเปิด) */
export function openContractNegotiation(
  save: GameSave,
  playerId: string,
  note?: string,
): GameSave {
  const player = save.players.find((p) => p.id === playerId)
  if (!player || player.clubId !== save.humanClubId) return save
  if (player.refuseContractRenewal) return save
  const talks = ensureTalksList(save)
  if (talks.some((t) => t.playerId === playerId && t.status === 'open')) return save

  const askWage = seedAskWage(player, save)
  const askYears = Math.max(2, Math.min(4, (player.contractYears ?? 1) + 2))
  const style = agentStyleFor(player)
  const prof = negotiationProfile(player, style)
  const bonuses = seedContractBonusAsks(player, askWage, style)
  const agentFee = Math.round(askWage * 52 * askYears * 0.06)
  const focus =
    bonuses.askSigningOn > 0 || bonuses.askPerAppearance > 0 ? 'wage' : 'wage'
  const bonusBits = [
    bonuses.askSigningOn > 0 ? `เงินเซ็น ~${formatMoney(bonuses.askSigningOn)}` : null,
    bonuses.askPerAppearance > 0
      ? `โบนัสนัด ~${formatMoney(bonuses.askPerAppearance)}`
      : null,
    bonuses.askPerGoal > 0 ? `โบนัสประตู ~${formatMoney(bonuses.askPerGoal)}` : null,
  ].filter(Boolean)
  const entry: ContractNegotiation = {
    id: uid('ct'),
    playerId,
    playerName: player.name,
    round: 0,
    maxRounds: prof.maxRounds,
    lastOfferWage: 0,
    lastOfferYears: 0,
    askWage,
    askYears,
    askSigningOn: bonuses.askSigningOn,
    askPerAppearance: bonuses.askPerAppearance,
    askPerGoal: bonuses.askPerGoal,
    focus,
    agentFee,
    status: 'open',
    note:
      note ??
      `เปิดโต๊ะ (${prof.labelTh}) · สูงสุด ${prof.maxRounds} รอบ · ขอ ~${formatMoney(askWage)}/สัปดาห์ · ${askYears} ปี${
        bonusBits.length ? ` · ${bonusBits.join(' · ')}` : ''
      } · จุดแรก: ${focusLabelTh('wage')}`,
  }

  return {
    ...save,
    contractTalks: {
      talks: [entry, ...talks.filter((t) => t.playerId !== playerId)].slice(0, 24),
    },
  }
}

function wantsToStay(player: Player, humanClubId: string): boolean {
  if (player.refuseContractRenewal) return false
  if (player.wantAway?.active && player.wantAway.publicNews) return false
  if (player.secretHandshake && player.secretHandshake.fromClubId !== humanClubId) {
    return false
  }
  const a = player.clubAffinity
  if (a?.avoidClubIds?.includes(humanClubId)) return false
  const happy = player.happiness ?? player.morale ?? 10
  if (a?.dreamClubIds?.includes(humanClubId)) return true
  if (a?.likedClubIds?.includes(humanClubId) && happy >= 11) return true
  if (happy >= 12) return true
  if (happy >= 14) return true
  return false
}

/**
 * นักเตะ/เอเยนต์ทวงต่อสัญญาเมื่ออยากอยู่ + สัญญาใกล้หมด
 * → inbox + เปิด contractTalks
 */
export function tickPlayerContractDemands(save: GameSave): GameSave {
  const humanId = save.humanClubId
  const talks = ensureTalksList(save)
  const openIds = new Set(
    talks.filter((t) => t.status === 'open').map((t) => t.playerId),
  )
  const candidates = save.players.filter((p) => {
    if (p.clubId !== humanId) return false
    if (yearsLeftOnContract(p, save.season) > 1) return false
    if (openIds.has(p.id)) return false
    if ((p.agentLockUntilMatchday ?? -1) >= save.matchday) return false
    if (!wantsToStay(p, humanId)) return false
    // ไม่ทวงซ้ำถี่เกิน
    const last = save.assistantContractWatch?.lastDemandByPlayer?.[p.id]
    if (last != null && save.matchday - last < 3) return false
    return true
  })

  if (!candidates.length) return save

  // สุ่มไม่เกิน 2 คน/แมตช์เดย์
  const shuffled = [...candidates].sort(
    (a, b) =>
      (b.overall + (b.happiness ?? 10)) - (a.overall + (a.happiness ?? 10)),
  )
  const pickN = Math.min(2, shuffled.length)
  const picks: Player[] = []
  for (let i = 0; i < shuffled.length && picks.length < pickN; i++) {
    const p = shuffled[i]!
    const chance =
      0.28 +
      (p.squadRole === 'key' ? 0.2 : 0) +
      ((p.growth?.ambition ?? 10) >= 14 ? 0.1 : 0)
    if (Math.random() < chance) picks.push(p)
  }
  if (!picks.length && Math.random() < 0.35) picks.push(shuffled[0]!)
  if (!picks.length) return save

  let next = save
  const demandMap = {
    ...(save.assistantContractWatch?.lastDemandByPlayer ?? {}),
  }
  const inboxNotes: string[] = []

  for (const p of picks) {
    next = openContractNegotiation(
      next,
      p.id,
      `นักเตะ/เอเยนต์ทวงต่อสัญญา — อยากอยู่ต่อที่สโมสร`,
    )
    demandMap[p.id] = save.matchday
    inboxNotes.push(
      `${p.name}: อยากต่อสัญญา (เหลือ ~${yearsLeftOnContract(p, save.season)} ปี) · เปิดโต๊ะเจรจาแล้ว`,
    )
  }

  return {
    ...next,
    assistantContractWatch: {
      lastRemindByPlayer: next.assistantContractWatch?.lastRemindByPlayer ?? {},
      lastDemandByPlayer: demandMap,
    },
    inbox: [
      {
        id: uid('msg-ct-demand'),
        date: next.currentDate,
        title: `ทวงสัญญาใหม่ · ${picks.length} คน`,
        body: inboxNotes.join(' · '),
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }
}

/**
 * ผู้ช่วยเตือน: เข้าปีสุดท้ายครั้งแรก · แล้วทุก ~1 เดือน จนกว่าจะต่อ/ขาย
 */
export function tickAssistantContractReminders(save: GameSave): GameSave {
  const humanId = save.humanClubId
  const watch = save.assistantContractWatch ?? {
    lastRemindByPlayer: {},
    lastDemandByPlayer: {},
  }
  const lastRemind = { ...watch.lastRemindByPlayer }
  const due: Player[] = []

  for (const p of save.players) {
    if (p.clubId !== humanId) {
      if (lastRemind[p.id] != null) delete lastRemind[p.id]
      continue
    }
    const left = yearsLeftOnContract(p, save.season)
    if (left > 1) {
      delete lastRemind[p.id]
      continue
    }
    // ต่อสัญญาไปแล้วในโต๊ะ — ยังเตือนถ้ายังไม่เซ็น (years ยัง ≤1)
    const prev = lastRemind[p.id]
    if (prev == null) {
      due.push(p)
      lastRemind[p.id] = { matchday: save.matchday, season: save.season }
      continue
    }
    if (
      prev.season === save.season &&
      save.matchday - prev.matchday >= CONTRACT_REMIND_INTERVAL_MD
    ) {
      due.push(p)
      lastRemind[p.id] = { matchday: save.matchday, season: save.season }
    } else if (prev.season !== save.season) {
      // ฤดูกาลใหม่ — เตือนใหม่ถ้ายังปีสุดท้าย
      due.push(p)
      lastRemind[p.id] = { matchday: save.matchday, season: save.season }
    }
  }

  if (!due.length) {
    return {
      ...save,
      assistantContractWatch: {
        ...watch,
        lastRemindByPlayer: lastRemind,
      },
      players: save.players.map((p) => syncContractYears(p, save.season)),
    }
  }

  const lines = due
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 12)
    .map((p) => {
      const left = yearsLeftOnContract(p, save.season)
      const tip = p.refuseContractRenewal
        ? 'ไม่ยอมต่อ — พิจารณาขาย/รอบอสแมน'
        : p.transferListed
          ? 'ขึ้นขายอยู่'
          : 'แนะนำต่อสัญญาหรือขาย'
      return `${p.name} (OVR ${p.overall}) · เหลือ ~${left} ปี · ${tip}`
    })

  const firstWave = due.some((p) => {
    const prev = watch.lastRemindByPlayer[p.id]
    return prev == null
  })

  return {
    ...save,
    players: save.players.map((p) => syncContractYears(p, save.season)),
    assistantContractWatch: {
      ...watch,
      lastRemindByPlayer: lastRemind,
    },
    inbox: [
      {
        id: uid('msg-asst-ct'),
        date: save.currentDate,
        title: firstWave
          ? `ผู้ช่วย: สัญญาใกล้หมด (${due.length} คน)`
          : `ผู้ช่วย: เตือนสัญญาประจำเดือน (${due.length} คน)`,
        body: firstWave
          ? `เหลือสัญญาไม่เกิน 1 ปี — ${lines.join(' · ')}`
          : `เตือนซ้ำทุก ~1 เดือนจนกว่าจะต่อหรือขาย — ${lines.join(' · ')}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** รวมทิกสัญญาหลังแมตช์เดย์ */
export function tickContractLifecycle(save: GameSave): GameSave {
  let next = recordAllFormHistory(save)
  next = {
    ...next,
    players: next.players.map((p) => syncContractYears(p, next.season)),
  }
  next = tickAssistantContractReminders(next)
  next = tickPlayerContractDemands(next)
  return next
}
