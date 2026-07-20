import mentoringDb from '@/data/mentoring.json'
import developmentDb from '@/data/development.json'
import type { DynamicsState, GameSave, Player, Tactics, TrainingFocus, TrainingState } from './types'
import { ATTR_BUMP, ATTR_MAX, ATTR_MIN, overallFromCa } from './attributes'
import { applyInjury, tickPlayerInjury } from './medical'
import { applyTrainingWear, bodyWearInjuryBonus } from './bodyMap'
import { FOCUS_ATTRS } from './focusAttrs'
import { tryUnlockPlayerSkill } from './playerSkills'
import { progressStyleTraining, type StyleTrainEvent } from './styleTraining'
import { scaleStaminaGain, scaleStaminaLoss } from './playerStamina'
import { clampStaminaToMedical, medicalStaminaProfile } from './medicalStamina'
import {
  resolveTrainingIncidents,
  type TrainingIncident,
} from './trainingIncidents'

export function defaultTraining(): TrainingState {
  return {
    focus: 'tactics',
    intensity: 'medium',
    individual: {},
    weekPlan: ['tactics', 'fitness', 'attacking', 'defending', 'tactics', 'setpieces', 'rest'],
  }
}

/** โฟกัสที่ใช้จริงในรอบนี้ — หมุนตามวันในสัปดาห์ถ้ามี weekPlan */
export function resolveTrainingFocus(training: TrainingState, matchday = 0): TrainingFocus {
  const plan = training.weekPlan
  if (!plan?.length) return training.focus
  const idx = ((matchday % 7) + 7) % 7
  return plan[idx] ?? training.focus
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function individualFocusOptions() {
  return mentoringDb.individualFocuses
}

/** รันซ้อมหลังแมตช์เดย์ / วันพัก — ไม่นับถอยหลังวันเจ็บ (ให้ recoverSquad / tick เดียว) */
export function applyTrainingWeek(
  players: Player[],
  humanClubId: string,
  training: TrainingState,
  facilityBonus = 0,
  matchday = 0,
  staffBoost: { coach?: number; attacking?: number; defending?: number; fitness?: number } = {},
  extras?: {
    tactics?: Tactics | null
    dynamics?: DynamicsState | null
    season?: number
  },
): {
  players: Player[]
  note: string
  injuries: string[]
  styleEvents: StyleTrainEvent[]
  incidents: TrainingIncident[]
  dynamics?: DynamicsState
} {
  const focus = resolveTrainingFocus(training, matchday)
  const specialist =
    focus === 'attacking'
      ? (staffBoost.attacking ?? 0)
      : focus === 'defending'
        ? (staffBoost.defending ?? 0)
        : focus === 'fitness'
          ? (staffBoost.fitness ?? 0)
          : focus === 'tactics' || focus === 'setpieces'
            ? (staffBoost.coach ?? 0)
            : (staffBoost.coach ?? 0) * 0.5
  const staffMul = 1 + specialist / 28
  const intensityMul =
    (training.intensity === 'high' ? 1.35 : training.intensity === 'low' ? 0.7 : 1) * staffMul
  const facMul = 1 + facilityBonus
  const injuries: string[] = []
  const styleEvents: StyleTrainEvent[] = []
  const individual = training.individual ?? {}
  let next = players.map((p) => {
    if (p.clubId !== humanClubId) return p
    if (p.injuryDays > 0 || (p.illnessDays ?? 0) > 0) {
      const med = medicalStaminaProfile(p)
      const condBoost =
        scaleStaminaGain(
          p.treatment === 'rest' || (p.illnessDays ?? 0) > 0 ? 8 : 5,
          p.attrs?.stamina ?? 70,
        ) * med.recoveryMul
      return {
        ...p,
        condition: clampStaminaToMedical(p, p.condition + condBoost),
      }
    }

    let condition = p.condition
    let sharpness = p.sharpness
    let form = p.form
    let overall = p.overall
    let ca = p.ca
    let attrs = { ...p.attrs }
    const fit = p.attrs?.stamina ?? 70

    if (focus === 'rest') {
      condition = clamp(condition + scaleStaminaGain(8 * intensityMul, fit), 40, 100)
      sharpness = clamp(sharpness - 2, 30, 100)
    } else {
      condition = clamp(condition - scaleStaminaLoss(3 * intensityMul, fit), 40, 100)
      sharpness = clamp(sharpness + 2 * intensityMul, 30, 100)
      if (focus === 'fitness')
        condition = clamp(
          condition + scaleStaminaGain(1 + (staffBoost.fitness ?? 0) / 20, fit),
          40,
          100,
        )
      if (focus === 'tactics') form = clamp(form + (Math.random() > 0.6 ? 1 : 0), 1, 20)
      if (focus === 'attacking' && (p.position === 'FW' || p.role === 'CAM')) {
        if (Math.random() < 0.12 * intensityMul * facMul * (p.growth.learningRate / 20)) {
          ca = Math.min(p.pa, ca + 1)
          overall = overallFromCa(ca)
        }
      }
      if (focus === 'defending' && p.position === 'DF') {
        if (Math.random() < 0.12 * intensityMul * facMul * (p.growth.learningRate / 20)) {
          ca = Math.min(p.pa, ca + 1)
          overall = overallFromCa(ca)
        }
      }
    }

    const ind = individual[p.id] ?? 'none'
    const keys = FOCUS_ATTRS[ind]
    if (keys.length && focus !== 'rest' && Math.random() < 0.38 * intensityMul * facMul) {
      const k = keys[Math.floor(Math.random() * keys.length)]
      const learnMul = p.growth.learningRate / 20
      if (learnMul > 0.15 || Math.random() < 0.3) {
        attrs[k] = clamp(attrs[k] + ATTR_BUMP, ATTR_MIN, ATTR_MAX)
      }
    }

    let skills = p.skills
    if (focus !== 'rest') {
      const unlockChance =
        (developmentDb.skillUnlock?.baseChance ?? 0.14) *
        0.7 *
        intensityMul *
        facMul *
        (p.growth.learningRate / 20)
      if (Math.random() < unlockChance) {
        const unlocked = tryUnlockPlayerSkill({ ...p, skills })
        if (unlocked) skills = unlocked.skills
      }
    }

    let out: Player = {
      ...p,
      condition,
      sharpness,
      form,
      overall,
      ca,
      attrs,
      skills,
    }
    out = applyTrainingWear(out, focus !== 'rest' && training.intensity === 'high')

    const injuryChance =
      (0.045 * (training.intensity === 'high' ? 1.15 : 0.4) * (p.hidden.injuryProneness / 12) +
        bodyWearInjuryBonus(out)) *
      (focus === 'rest' ? 0 : 1)
    // ฟิตเนส/เกมรับ เสี่ยงเจ็บซ้อมมากกว่า
    const focusInj =
      focus === 'fitness' ? 1.25 : focus === 'defending' ? 1.15 : focus === 'attacking' ? 1.05 : 1
    if (focus !== 'rest' && Math.random() < injuryChance * focusInj) {
      out = applyInjury(out, 'training')
      injuries.push(p.name)
    }

    if (focus !== 'rest' || training.intensity !== 'high') {
      const styleR = progressStyleTraining(out, {
        intensity: focus === 'rest' ? 'low' : training.intensity,
        matchday,
        xpMul: focus === 'tactics' ? 1.15 : focus === 'rest' ? 0.45 : 1,
      })
      out = styleR.player
      styleEvents.push(...styleR.events)
    }

    return out
  })

  // ทะเลาะ / ซีเนียร์ / พี่เลี้ยง
  let dynamicsOut: DynamicsState | undefined
  let incidents: TrainingIncident[] = []
  if (extras?.dynamics) {
    const resolved = resolveTrainingIncidents(next, humanClubId, {
      training,
      focus,
      tactics: extras.tactics,
      dynamics: extras.dynamics,
      matchday,
      season: extras.season,
    })
    next = resolved.players
    dynamicsOut = resolved.dynamics
    incidents = resolved.incidents
    // จับเจ็บจากทะเลาะที่เพิ่งเกิด
    for (const p of next) {
      if (p.clubId !== humanClubId) continue
      const prev = players.find((x) => x.id === p.id)
      if (prev && prev.injuryDays <= 0 && p.injuryDays > 0 && !injuries.includes(p.name)) {
        injuries.push(p.name)
      }
    }
  }

  const focusTh: Record<TrainingFocus, string> = {
    tactics: 'แท็กติก',
    fitness: 'ฟิตเนส',
    attacking: 'เกมรุก',
    defending: 'เกมรับ',
    setpieces: 'ลูกตั้งเตะ',
    rest: 'พักฟื้น',
  }
  const parts: string[] = [
    `ซ้อมโฟกัส「${focusTh[focus]}」ความเข้ม ${training.intensity}`,
  ]
  if (injuries.length > 0) parts.push(`เจ็บจากซ้อม: ${injuries.join(', ')}`)
  if (incidents.length > 0) {
    parts.push(...incidents.slice(0, 3).map((i) => i.text))
  } else {
    parts.push('เสร็จสิ้น')
  }
  const note = parts.join(' — ')

  return { players: next, note, injuries, styleEvents, incidents, dynamics: dynamicsOut }
}

export function recoverInjuriesOneDay(players: Player[], physioLevel = 8): Player[] {
  return players.map((p) => (p.injuryDays > 0 ? tickPlayerInjury(p, physioLevel) : p))
}

export function updatePlayingTimeMorale(save: GameSave): Player[] {
  return save.players.map((p) => {
    if (p.clubId !== save.humanClubId) return p
    const tactics = save.tacticsByClub[save.humanClubId]
    const inXi = tactics.startingXi.includes(p.id)
    let happiness = p.happiness ?? p.morale
    let morale = p.morale
    if (p.squadRole === 'key' && !inXi) {
      happiness = clamp(happiness - 2, 1, 20)
      morale = clamp(morale - 1, 1, 20)
    } else if (p.squadRole === 'regular' && !inXi && p.minutesPlayed > 0) {
      happiness = clamp(happiness - 1, 1, 20)
    } else if (p.squadRole === 'prospect' && inXi) {
      happiness = clamp(happiness + 2, 1, 20)
      morale = clamp(morale + 1, 1, 20)
    } else if (inXi) {
      happiness = clamp(happiness + 1, 1, 20)
      morale = clamp(morale + 1, 1, 20)
    }
    return { ...p, happiness, morale }
  })
}
