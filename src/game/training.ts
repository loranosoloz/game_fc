import mentoringDb from '@/data/mentoring.json'
import type { GameSave, IndividualFocus, Player, PlayerAttributes, TrainingFocus, TrainingState } from './types'
import { overallFromCa } from './attributes'
import { applyInjury, tickPlayerInjury } from './medical'

export function defaultTraining(): TrainingState {
  return { focus: 'tactics', intensity: 'medium', individual: {} }
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

const FOCUS_ATTRS: Record<IndividualFocus, (keyof PlayerAttributes)[]> = {
  finishing: ['finishing', 'composure'],
  passing: ['passing', 'vision', 'technique'],
  defending: ['tackling', 'positioning', 'heading'],
  athleticism: ['pace', 'stamina', 'agility', 'strength'],
  goalkeeping: ['handling', 'reflexes', 'aerialReach'],
  none: [],
}

export function individualFocusOptions() {
  return mentoringDb.individualFocuses
}

/** รันซ้อมหลังแมตช์เดย์ / วันพัก — ไม่นับถอยหลังวันเจ็บ (ให้ recoverSquad / tick เดียว) */
export function applyTrainingWeek(
  players: Player[],
  humanClubId: string,
  training: TrainingState,
): { players: Player[]; note: string; injuries: string[] } {
  const intensityMul = training.intensity === 'high' ? 1.35 : training.intensity === 'low' ? 0.7 : 1
  const injuries: string[] = []
  const individual = training.individual ?? {}
  const next = players.map((p) => {
    if (p.clubId !== humanClubId) return p
    if (p.injuryDays > 0) {
      const condBoost = p.treatment === 'rest' ? 8 : 5
      return {
        ...p,
        condition: clamp(p.condition + condBoost, 40, 100),
      }
    }

    let condition = p.condition
    let sharpness = p.sharpness
    let form = p.form
    let overall = p.overall
    let ca = p.ca
    let attrs = { ...p.attrs }

    if (training.focus === 'rest') {
      condition = clamp(condition + 8 * intensityMul, 40, 100)
      sharpness = clamp(sharpness - 2, 30, 100)
    } else {
      condition = clamp(condition - 3 * intensityMul, 40, 100)
      sharpness = clamp(sharpness + 2 * intensityMul, 30, 100)
      if (training.focus === 'fitness') condition = clamp(condition + 1, 40, 100)
      if (training.focus === 'tactics') form = clamp(form + (Math.random() > 0.6 ? 1 : 0), 1, 20)
      if (training.focus === 'attacking' && (p.position === 'FW' || p.role === 'CAM')) {
        if (Math.random() < 0.06 * intensityMul * (p.growth.learningRate / 20)) {
          ca = Math.min(p.pa, ca + 1)
          overall = overallFromCa(ca)
        }
      }
      if (training.focus === 'defending' && p.position === 'DF') {
        if (Math.random() < 0.06 * intensityMul * (p.growth.learningRate / 20)) {
          ca = Math.min(p.pa, ca + 1)
          overall = overallFromCa(ca)
        }
      }
    }

    const ind = individual[p.id] ?? 'none'
    const keys = FOCUS_ATTRS[ind]
    if (keys.length && training.focus !== 'rest' && Math.random() < 0.22 * intensityMul) {
      const k = keys[Math.floor(Math.random() * keys.length)]
      const learnMul = p.growth.learningRate / 20
      if (learnMul > 0.2 || Math.random() < 0.2) {
        attrs[k] = clamp(attrs[k] + 1, 1, 20)
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
    }

    const injuryChance =
      0.04 * (training.intensity === 'high' ? 1 : 0.4) * (p.hidden.injuryProneness / 12)
    if (training.focus !== 'rest' && Math.random() < injuryChance) {
      out = applyInjury(out, 'training')
      injuries.push(p.name)
    }

    return out
  })

  const focusTh: Record<TrainingFocus, string> = {
    tactics: 'แท็กติก',
    fitness: 'ฟิตเนส',
    attacking: 'เกมรุก',
    defending: 'เกมรับ',
    setpieces: 'ลูกตั้งเตะ',
    rest: 'พักฟื้น',
  }
  const note =
    injuries.length > 0
      ? `ซ้อมโฟกัส「${focusTh[training.focus]}」(${training.intensity}) — เจ็บจากซ้อม: ${injuries.join(', ')}`
      : `ซ้อมโฟกัส「${focusTh[training.focus]}」ความเข้ม ${training.intensity} เสร็จสิ้น`

  return { players: next, note, injuries }
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
