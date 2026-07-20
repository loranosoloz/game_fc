/**
 * Stamina ถาวร = Player.condition (0–100) ติดเซฟตลอด
 * attrs.stamina = ฟิตเนสธรรมชาติ — เหนื่อยช้า / ฟื้นเร็ว
 */
import type { Player, Tactics } from './types'
import { applyInjury } from './medical'
import { applyMatchWear, bodyWearInjuryBonus } from './bodyMap'
import type { BurstState } from './match/matchFatigue'
import {
  clampStaminaToMedical,
  isLimitedPlay,
  medicalStaminaProfile,
} from './medicalStamina'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** คูณฟื้น — ฟิตสูงฟื้นดี (0.75–1.35) */
export function staminaRecoveryMul(fitnessAttr: number): number {
  return 0.75 + (Math.max(1, Math.min(99, fitnessAttr)) / 99) * 0.6
}

/** คูณเหนื่อย — ฟิตสูงเหนื่อยน้อย (0.78–1.25) */
export function staminaFatigueMul(fitnessAttr: number): number {
  return 1.25 - (Math.max(1, Math.min(99, fitnessAttr)) / 99) * 0.47
}

export function scaleStaminaGain(base: number, fitnessAttr: number): number {
  return base * staminaRecoveryMul(fitnessAttr)
}

export function scaleStaminaLoss(base: number, fitnessAttr: number): number {
  return base * staminaFatigueMul(fitnessAttr)
}

type AgentLike = {
  id: string
  condition: number
  burst: BurstState
  player: { attrs: { stamina: number }; name: string }
}

/**
 * พักครึ่ง ~15 นาที — ฟื้น condition + matchStamina นิดหน่อย
 * ฟิตเนสดีฟื้นมากกว่า
 */
export function applyHalftimeStaminaRecovery(agents: AgentLike[]): {
  recovered: number
  noteTh: string
} {
  let sum = 0
  let n = 0
  for (const a of agents) {
    const fit = a.player.attrs.stamina ?? 70
    const base = 3.2 + (fit / 99) * 4.2 // ~3–7.5
    const gain = scaleStaminaGain(base, fit)
    a.condition = clamp(a.condition + gain, 35, 100)
    a.burst = {
      ...a.burst,
      matchStamina: clamp(a.burst.matchStamina + gain * 1.25, 28, 100),
      heartRate: Math.max(38, a.burst.heartRate - 18),
      burstTicks: 0,
    }
    sum += gain
    n += 1
  }
  const avg = n ? sum / n : 0
  return {
    recovered: Math.round(avg * 10) / 10,
    noteTh:
      avg >= 5.5
        ? `พักครึ่ง 15 นาที · สควอดฟื้นแรงดี (+${avg.toFixed(0)} stamina)`
        : `พักครึ่ง 15 นาที · ฟื้นแรงเล็กน้อย (+${avg.toFixed(0)} stamina)`,
  }
}

/** ประมาณนาทีลงจากเรตติ้ง / เหตุการณ์ — fallback */
export function estimateMinutesFromRatings(
  playerId: string,
  ratings?: Array<{ playerId: string; minutes: number }>,
  fallback = 90,
): number {
  const hit = ratings?.find((r) => r.playerId === playerId)
  return hit?.minutes ?? fallback
}

/**
 * หลังแมตช์ — เขียน stamina ถาวรตามนาทีลง + สภาพจบแมตช์
 * ลงเยอะ = เหนื่อยเยอะ · ไม่ได้ลง = ฟื้น · ฟิตดี = เหนื่อยน้อย/ฟื้นดี
 */
export function applyPersistentMatchStamina(
  players: Player[],
  tactics: Tactics,
  opts: {
    played: boolean
    injuryMult?: number
    minutesById?: Record<string, number>
    finalConditions?: Record<string, number>
    ratings?: Array<{ playerId: string; minutes: number }>
    /** จำกัดเฉพาะนักเตะสโมสรนี้ — กันซ้ำตอนเรียก home/away */
    clubId?: string
    rng?: () => number
  },
): Player[] {
  if (!opts.played) return players
  const rng = opts.rng ?? Math.random
  const xi = new Set(tactics.startingXi)
  const bench = new Set(tactics.bench)
  const injuryMult = opts.injuryMult ?? 1

  return players.map((p) => {
    if (opts.clubId && p.clubId !== opts.clubId) return p
    const fit = p.attrs?.stamina ?? 70
    const minsRaw =
      opts.minutesById?.[p.id] ??
      (xi.has(p.id)
        ? estimateMinutesFromRatings(p.id, opts.ratings, 90)
        : bench.has(p.id)
          ? estimateMinutesFromRatings(p.id, opts.ratings, 0)
          : 0)
    const mins = Math.max(0, Math.min(120, Math.round(minsRaw)))

    // ไม่ได้อยู่ในแผนวันนี้ — พักฟื้น (เจ็บ/ป่วยฟื้นช้า + มีเพดาน)
    if (!xi.has(p.id) && !bench.has(p.id)) {
      const med = medicalStaminaProfile(p)
      const heal = scaleStaminaGain(4.5, fit) * med.recoveryMul
      let next = {
        ...p,
        condition: clampStaminaToMedical(p, p.condition + heal),
        sharpness: Math.max(30, p.sharpness - 1),
      }
      next = applyMatchWear(next, 'unused')
      return next
    }

    // ม้านั่ง / ลงน้อยมาก — ฟื้นเบา
    if (mins < 8) {
      const med = medicalStaminaProfile(p)
      const heal = scaleStaminaGain(2.2, fit) * med.recoveryMul
      let next = {
        ...p,
        condition: clampStaminaToMedical(p, p.condition + heal),
        sharpness: Math.max(30, p.sharpness - 0.4),
      }
      next = applyMatchWear(next, 'unused')
      return next
    }

    // ลงแข่ง — เหนื่อยตามนาที + ฟิตเนส (+ เจ็บแบบ limited เหนื่อยเพิ่ม)
    const load = mins / 90
    const med = medicalStaminaProfile(p)
    let drop = scaleStaminaLoss(5.5 + rng() * 5.5, fit) * load * med.matchFatigueMul
    const finalC = opts.finalConditions?.[p.id]
    if (typeof finalC === 'number') {
      const fromMatch = Math.max(0, p.condition - finalC)
      drop = Math.max(drop * 0.55, fromMatch * 0.85)
    }
    drop = Math.max(2, Math.min(32, drop))

    let next: Player = {
      ...p,
      condition: clampStaminaToMedical(p, p.condition - drop),
      sharpness: Math.min(100, p.sharpness + (mins >= 60 ? 3 : 1.5)),
      form: Math.min(20, Math.max(1, p.form + (rng() > 0.5 ? 1 : -1))),
      minutesPlayed: p.minutesPlayed + mins,
    }
    next = applyMatchWear(next, mins >= 45 ? 'starter' : 'unused')
    const wearBonus = bodyWearInjuryBonus(next)
    const limitedRisk = isLimitedPlay(p) ? 1.6 : 1
    if (
      p.injuryDays <= 0 &&
      (p.illnessDays ?? 0) <= 0 &&
      (p.banMatches ?? 0) <= 0 &&
      next.condition < 58 &&
      rng() < (0.02 + p.hidden.injuryProneness / 400 + wearBonus) * injuryMult * limitedRisk
    ) {
      next = applyInjury(next, 'match')
    }
    return next
  })
}

/** ฟื้นระหว่างสัปดาห์พัก / ไม่ได้แข่ง — ฟิตดีฟื้นดี · เจ็บฟื้นช้า */
export function applyRestDayStamina(player: Player, baseHeal: number): Player {
  const fit = player.attrs?.stamina ?? 70
  const med = medicalStaminaProfile(player)
  const heal = scaleStaminaGain(baseHeal, fit) * med.recoveryMul
  return {
    ...player,
    condition: clampStaminaToMedical(player, player.condition + heal),
  }
}

/**
 * สัปดาห์ทีมชาติ — ถูกเรียก = สะสมเหนื่อย · ไม่ถูกเรียก = ฟื้น
 */
export function applyIntlWeekStamina(
  player: Player,
  calledUp: boolean,
  opts?: { baseHealHome?: number; baseHealAway?: number },
): Player {
  const fit = player.attrs?.stamina ?? 70
  if (calledUp) {
    // แคมป์ชาติ — ฟื้นน้อยมาก (ซ้อมหนัก) แล้วจะโดน wear แยก
    const heal = scaleStaminaGain(opts?.baseHealAway ?? 2.5, fit)
    return {
      ...player,
      condition: clamp(player.condition + heal, 20, 100),
    }
  }
  const heal = scaleStaminaGain(opts?.baseHealHome ?? 12, fit)
  return {
    ...player,
    condition: clamp(player.condition + heal, 25, 100),
  }
}

/** ล้าจากนัดทีมชาติในช่วงพัก */
export function applyIntlMatchWearStamina(player: Player, intensity = 1, rng = Math.random): Player {
  const fit = player.attrs?.stamina ?? 70
  const drop = scaleStaminaLoss(4 + rng() * 6, fit) * intensity
  return {
    ...player,
    condition: clamp(player.condition - drop, 25, 100),
  }
}

/** กลับจากทีมชาติ — ค่าเหนื่อยสะสมตอนกลับคลับ */
export function applyIntlReturnStamina(player: Player, rng = Math.random): Player {
  const fit = player.attrs?.stamina ?? 70
  const drop = scaleStaminaLoss(7 + rng() * 4, fit)
  return {
    ...player,
    condition: clamp(player.condition - drop, 25, 100),
  }
}

export function staminaLabelTh(condition: number): string {
  if (condition >= 85) return 'สดมาก'
  if (condition >= 70) return 'พร้อม'
  if (condition >= 55) return 'เริ่มล้า'
  if (condition >= 40) return 'เหนื่อย'
  return 'หมดแรง'
}
