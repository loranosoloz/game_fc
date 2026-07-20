import type { IllnessType, Player } from './types'
import {
  clampStaminaToMedical,
  medicalDailyStaminaGain,
  medicalPlayStatus,
  staminaHitOnIllness,
} from './medicalStamina'

export const ILLNESS_TYPE_LABEL: Record<IllnessType, string> = {
  cold: 'หวัด',
  flu: 'ไข้หวัดใหญ่',
  stomach: 'ท้องเสีย',
  virus: 'ไวรัส',
  fever: 'มีไข้',
}

const ILLNESS_WEIGHTS: { type: IllnessType; w: number; minDays: number; maxDays: number }[] = [
  { type: 'cold', w: 40, minDays: 2, maxDays: 5 },
  { type: 'flu', w: 22, minDays: 4, maxDays: 9 },
  { type: 'stomach', w: 18, minDays: 1, maxDays: 4 },
  { type: 'virus', w: 12, minDays: 5, maxDays: 12 },
  { type: 'fever', w: 8, minDays: 2, maxDays: 6 },
]

export function isIll(player: Player): boolean {
  return (player.illnessDays ?? 0) > 0
}

export function formatIllnessStatus(player: Player): string | null {
  if (!isIll(player)) return null
  const t = player.illnessType ? ILLNESS_TYPE_LABEL[player.illnessType] : 'ป่วย'
  const status = medicalPlayStatus(player)
  const tag = status === 'out' ? ' · ห้ามลง' : status === 'limited' ? ' · ลงได้·ล้า' : ''
  return `${t} ${player.illnessDays}ว${tag}`
}

function pickIllness(rng: () => number): { type: IllnessType; days: number } {
  const total = ILLNESS_WEIGHTS.reduce((s, r) => s + r.w, 0)
  let roll = rng() * total
  for (const row of ILLNESS_WEIGHTS) {
    roll -= row.w
    if (roll <= 0) {
      const span = row.maxDays - row.minDays + 1
      return { type: row.type, days: row.minDays + Math.floor(rng() * span) }
    }
  }
  return { type: 'cold', days: 3 }
}

export function applyIllness(player: Player, rng = Math.random): Player {
  if ((player.illnessDays ?? 0) > 0 || player.injuryDays > 0) return player
  const rolled = pickIllness(rng)
  const hit = staminaHitOnIllness(rolled.type, player.attrs?.stamina ?? 70)
  const next: Player = {
    ...player,
    illnessDays: rolled.days,
    illnessType: rolled.type,
    condition: Math.max(28, player.condition - hit),
    sharpness: Math.max(30, player.sharpness - 4),
    morale: Math.max(1, player.morale - 1),
  }
  return {
    ...next,
    condition: clampStaminaToMedical(next, next.condition),
  }
}

export function tickIllness(player: Player, physioLevel = 8): Player {
  const days = player.illnessDays ?? 0
  if (days <= 0) {
    return { ...player, illnessDays: 0, illnessType: null }
  }
  const heal = 1 + (physioLevel >= 12 ? 1 : 0)
  const next = Math.max(0, days - heal)
  const gain = medicalDailyStaminaGain(
    { ...player, illnessDays: next > 0 ? next : 0 },
    physioLevel,
  )
  const extra = next <= 0 ? 3 : 0
  const withDays: Player = {
    ...player,
    illnessDays: next,
    illnessType: next > 0 ? player.illnessType : null,
    condition: player.condition + gain + extra,
  }
  return {
    ...withDays,
    condition:
      next > 0
        ? clampStaminaToMedical(withDays, withDays.condition)
        : Math.min(100, withDays.condition),
  }
}

/**
 * Roll illness for a whole squad (human + AI).
 * Risk: low condition, age, lifestyle flags, squad contagion.
 */
export function rollSquadIllnesses(
  players: Player[],
  opts: {
    matchday: number
    season: number
    /** activity ids that raise risk this week by player id */
    riskyByPlayer?: Record<string, number>
  },
  rng = Math.random,
): { players: Player[]; newlyIll: { name: string; type: IllnessType; days: number; clubId: string }[] } {
  const newlyIll: { name: string; type: IllnessType; days: number; clubId: string }[] = []
  // Contagion: clubs that already have sick players
  const sickClubs = new Set(
    players.filter((p) => (p.illnessDays ?? 0) > 0).map((p) => p.clubId),
  )

  const winter =
    opts.matchday >= 15 && opts.matchday <= 28
      ? 1.35
      : opts.matchday >= 10 && opts.matchday <= 32
        ? 1.15
        : 1

  const next = players.map((p) => {
    if ((p.illnessDays ?? 0) > 0 || p.injuryDays > 0) return p
    let chance = 0.012 * winter
    if (p.condition < 55) chance += 0.025
    else if (p.condition < 70) chance += 0.01
    if (p.age >= 33) chance += 0.01
    if (p.age <= 18) chance += 0.008
    if (sickClubs.has(p.clubId)) chance += 0.018
    const lifestyle = opts.riskyByPlayer?.[p.id] ?? 0
    chance += lifestyle
    // professionalism lowers illness risk slightly
    chance *= 1 - (p.growth.professionalism / 20) * 0.25

    if (rng() < Math.min(0.12, chance)) {
      const ill = applyIllness(p, rng)
      newlyIll.push({
        name: ill.name,
        type: ill.illnessType!,
        days: ill.illnessDays,
        clubId: ill.clubId,
      })
      sickClubs.add(ill.clubId)
      return ill
    }
    return p
  })

  return { players: next, newlyIll }
}

/** Lifestyle activity ids that raise illness risk */
export const ILLNESS_RISK_ACTIVITIES: Record<string, number> = {
  pub_night: 0.04,
  club_party: 0.05,
  late_netflix: 0.015,
  junk_food: 0.02,
  casino_night: 0.03,
  late_gaming: 0.012,
}
