import mentoringDb from '@/data/mentoring.json'
import developmentDb from '@/data/development.json'
import type {
  DevelopmentState,
  GameSave,
  IndividualFocus,
  Player,
  PlayerAttributes,
  Tactics,
} from './types'
import { overallFromCa } from './attributes'
import { FOCUS_ATTRS, focusMatchesRole } from './focusAttrs'
import { trainingFacilityBonus } from './facilities'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function ageMul(age: number): { growth: number; decline: number } {
  for (const row of developmentDb.ageCurves) {
    if (age <= row.maxAge) return { growth: row.growthMul, decline: row.declineMul }
  }
  const last = developmentDb.ageCurves[developmentDb.ageCurves.length - 1]
  return { growth: last.growthMul, decline: last.declineMul }
}

function mentorBonus(player: Player, allPlayers: Player[], xiMates: Player[]): number {
  const cfg = developmentDb.mentor
  if (player.age > cfg.maxAge) return 0
  let best = 0

  // Explicit assigned mentor
  if (player.mentorId) {
    const m = allPlayers.find((x) => x.id === player.mentorId)
    if (m && m.clubId === player.clubId) {
      const gap = m.ca - player.ca
      if (gap >= cfg.minCaGap * 0.6) {
        best = Math.max(
          best,
          cfg.baseBonus * 1.4 + gap * 0.025 + player.growth.determination * cfg.determinationScale,
        )
      }
    }
  }

  for (const m of xiMates) {
    if (m.id === player.id) continue
    const gap = m.ca - player.ca
    if (gap >= cfg.minCaGap) {
      const b =
        cfg.baseBonus + gap * 0.02 + player.growth.determination * cfg.determinationScale
      best = Math.max(best, b)
    }
  }
  return best
}

export function createDevelopmentState(): DevelopmentState {
  return { lastMentorNote: 'ยังไม่ได้จัดคู่ mentoring', personalityLog: [] }
}

/** Develop / decline players after a matchday. */
export function applyDevelopmentTick(
  players: Player[],
  tacticsByClub: Record<string, Tactics>,
  individual: Record<string, IndividualFocus>,
  clubFilter?: string,
  facilityBonus = 0,
): { players: Player[]; notes: string[]; mentorNotes: string[] } {
  const notes: string[] = []
  const mentorNotes: string[] = []
  const next = players.map((p) => {
    if (clubFilter && p.clubId !== clubFilter) return p
    if (p.injuryDays > 0) return p

    const tactics = tacticsByClub[p.clubId]
    const inXi = tactics?.startingXi.includes(p.id) ?? false
    const xiMates = (tactics?.startingXi ?? [])
      .map((id) => players.find((x) => x.id === id))
      .filter((x): x is Player => !!x)

    const mins = inXi ? 90 : Math.min(p.minutesPlayed % 200, 45)
    const playFactor = Math.max(
      developmentDb.playingTime.minBoost,
      Math.min(1, mins / developmentDb.playingTime.minutesForFullBoost),
    )

    const curve = ageMul(p.age)
    const learn = p.growth.learningRate / 20
    const det = p.growth.determination / 20
    const pro = p.growth.professionalism / 20
    const ment = mentorBonus(p, players, xiMates)
    let growth = { ...p.growth }
    let personalityId = p.personalityId
    if (ment > 0.5 && p.mentorId) {
      const mentor = players.find((x) => x.id === p.mentorId)
      if (mentor) {
        mentorNotes.push(`${p.name} ← mentor ${mentor.name}`)
        // ส่งต่อ growth เล็กน้อย
        growth = {
          ...growth,
          determination: Math.min(20, growth.determination + (Math.random() < 0.08 ? 1 : 0)),
          professionalism: Math.min(
            20,
            growth.professionalism + (Math.random() < 0.06 ? 1 : 0),
          ),
          learningRate: Math.min(20, growth.learningRate + (Math.random() < 0.05 ? 1 : 0)),
        }
        if (Math.random() < 0.03 && mentor.personalityId !== personalityId) {
          personalityId = mentor.personalityId
          notes.push(`${p.name} รับบุคลิกจาก mentor ${mentor.name}`)
        }
      }
    }

    const focus = individual[p.id] ?? 'none'
    const focusFit = focusMatchesRole(focus, p.position)
    const focusMul = focus === 'none' ? 1 : focusFit ? 1.15 : 0.85
    if (focus !== 'none' && !focusFit && (!clubFilter || p.clubId === clubFilter) && Math.random() < 0.12) {
      notes.push(`${p.name}: โฟกัส ${focus} ไม่ค่อยเข้ากับตำแหน่ง ${p.position}`)
    }

    let caDelta = 0
    if (curve.growth > 0 && learn > 0.15) {
      const chance =
        0.12 * curve.growth * learn * (0.5 + playFactor) * (0.6 + det) * focusMul *
          (1 + facilityBonus) +
        ment * 0.1
      if (Math.random() < chance && p.ca < p.pa) {
        caDelta = 1
        if (Math.random() < learn * 0.25 && p.ca + 1 < p.pa) caDelta = 2
      }
    }
    if (curve.decline > 0) {
      const declineChance = 0.08 * curve.decline * (1.2 - pro)
      if (Math.random() < declineChance) caDelta -= 1
    }

    if (p.growth.learningRate <= 5 && caDelta > 0 && Math.random() > 0.15) caDelta = 0

    const focusKeys = FOCUS_ATTRS[focus]
    let attrs = { ...p.attrs }

    // Individual training nudge even without CA change
    const focusChance = 0.18 * learn * focusMul * (1 + facilityBonus * 0.5)
    if (focusKeys.length && Math.random() < focusChance) {
      const k = focusKeys[Math.floor(Math.random() * focusKeys.length)]
      attrs[k] = clamp(attrs[k] + 1, 1, 20)
      if (!clubFilter || p.clubId === clubFilter) {
        notes.push(`${p.name} ซ้อมเฉพาะทาง ${focus}: ${k}↑`)
      }
    }

    if (caDelta === 0) {
      return { ...p, attrs, growth, personalityId }
    }

    const ca = clamp(p.ca + caDelta, 40, Math.max(p.pa, p.ca))
    const overall = overallFromCa(ca)
    if (caDelta > 0 && (!clubFilter || p.clubId === clubFilter)) {
      notes.push(`${p.name} พัฒนา CA ${p.ca}→${ca} (OVR ${overall})`)
    } else if (caDelta < 0 && (!clubFilter || p.clubId === clubFilter)) {
      notes.push(`${p.name} ถดถอยเล็กน้อย CA ${p.ca}→${ca}`)
    }

    const keys =
      focusKeys.length > 0
        ? focusKeys
        : (Object.keys(attrs) as (keyof PlayerAttributes)[])
    const bump = caDelta > 0 ? 1 : -1
    for (let i = 0; i < 2; i++) {
      const k = keys[Math.floor(Math.random() * keys.length)]
      attrs[k] = clamp(attrs[k] + bump, 1, 20)
    }

    return { ...p, ca, overall, attrs, growth, personalityId }
  })

  return {
    players: next,
    notes: notes.slice(0, 10),
    mentorNotes: [...new Set(mentorNotes)].slice(0, 5),
  }
}

export function applyPersonalityEvents(save: GameSave): GameSave {
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const events = mentoringDb.personalityEvents
  const log = [...(save.development?.personalityLog ?? [])]
  const inbox = [...save.inbox]
  let players = save.players
  let dynamics = save.dynamics

  for (const p of squad) {
    if (Math.random() > 0.12) continue
    for (const ev of events) {
      if ('minAmbition' in ev && ev.minAmbition && p.growth.ambition < ev.minAmbition) continue
      if ('maxMorale' in ev && ev.maxMorale != null && p.morale > ev.maxMorale) continue
      if (
        'minProfessionalism' in ev &&
        ev.minProfessionalism &&
        p.growth.professionalism < ev.minProfessionalism
      )
        continue
      if (
        'maxProfessionalism' in ev &&
        ev.maxProfessionalism != null &&
        p.growth.professionalism > ev.maxProfessionalism
      )
        continue
      if (
        'minDetermination' in ev &&
        ev.minDetermination &&
        p.growth.determination < ev.minDetermination
      )
        continue
      if ('maxAge' in ev && ev.maxAge != null && p.age > ev.maxAge) continue
      if ('minLearning' in ev && ev.minLearning && p.growth.learningRate < ev.minLearning) continue

      if (Math.random() > 0.35) continue

      const body = ev.body.replace('{name}', p.name)
      log.unshift({
        id: `pe-${Date.now()}-${p.id}`,
        date: save.currentDate,
        playerId: p.id,
        title: ev.title,
        body,
      })
      inbox.unshift({
        id: `msg-pe-${Date.now()}-${p.id}`,
        date: save.currentDate,
        title: ev.title,
        body,
        read: false,
      })

      if (ev.id === 'ambition_clash') {
        players = players.map((x) =>
          x.id === p.id ? { ...x, morale: Math.max(1, x.morale - 2) } : x,
        )
        dynamics = {
          ...dynamics,
          cohesion: Math.max(0, dynamics.cohesion - 3),
          lastNote: `${p.name} กดดันเรื่องเวลาลงเล่น`,
        }
      } else if (ev.id === 'pro_boost') {
        players = players.map((x) => {
          if (x.id !== p.id) return x
          const ca = Math.min(x.pa, x.ca + (Math.random() < 0.4 ? 1 : 0))
          return { ...x, ca, overall: overallFromCa(ca) }
        })
      } else if (ev.id === 'temper_flare') {
        dynamics = {
          ...dynamics,
          cohesion: Math.max(0, dynamics.cohesion - 5),
          dressingRoomMood: Math.max(0, dynamics.dressingRoomMood - 4),
          lastNote: `บรรยากาศตึงจาก ${p.name}`,
        }
      } else if (ev.id === 'wonder_spark') {
        players = players.map((x) =>
          x.id === p.id && x.ca < x.pa
            ? { ...x, ca: x.ca + 1, overall: overallFromCa(x.ca + 1) }
            : x,
        )
      }
      break
    }
  }

  return {
    ...save,
    players,
    dynamics,
    development: {
      ...save.development,
      personalityLog: log.slice(0, 40),
    },
    inbox: inbox.slice(0, 40),
  }
}

export function applyDevelopmentForSave(save: GameSave): GameSave {
  const individual = save.training.individual ?? {}
  const facBonus = trainingFacilityBonus(save)
  const { players, notes, mentorNotes } = applyDevelopmentTick(
    save.players,
    save.tacticsByClub,
    individual,
    save.humanClubId,
    facBonus,
  )
  const all = applyDevelopmentTick(players, save.tacticsByClub, individual, undefined, facBonus)
  const mentorLine =
    mentorNotes.length > 0 ? `Mentoring: ${mentorNotes.join(' · ')}` : save.development?.lastMentorNote

  let next: GameSave = {
    ...save,
    players: all.players,
    development: {
      lastMentorNote: mentorLine || 'ยังไม่มีคู่ mentoring ที่ทำงาน',
      personalityLog: save.development?.personalityLog ?? [],
    },
    inbox:
      notes.length > 0
        ? [
            {
              id: `msg-dev-${Date.now()}`,
              date: save.currentDate,
              title: 'รายงานพัฒนาการนักเตะ',
              body: notes.join(' · '),
              read: false,
            },
            ...save.inbox,
          ].slice(0, 40)
        : save.inbox,
  }
  next = applyPersonalityEvents(next)
  return next
}

export function assignMentor(
  save: GameSave,
  menteeId: string,
  mentorId: string | null,
): { save: GameSave; message: string } {
  const mentee = save.players.find((p) => p.id === menteeId)
  if (!mentee || mentee.clubId !== save.humanClubId) {
    return { save, message: 'ไม่พบนักเตะ' }
  }
  if (mentorId) {
    const mentor = save.players.find((p) => p.id === mentorId)
    if (!mentor || mentor.clubId !== save.humanClubId) {
      return { save, message: 'เมนเทอร์ต้องอยู่ในทีมคุณ' }
    }
    if (mentor.id === mentee.id) return { save, message: 'เลือกคนอื่นเป็นเมนเทอร์' }
    if (mentor.ca < mentee.ca + 5) {
      return { save, message: 'เมนเทอร์ควรเก่งกว่าอย่างน้อย CA +5' }
    }
    if (mentee.age > 23) return { save, message: 'Mentoring สำหรับอายุ ≤ 23' }
  }
  const players = save.players.map((p) =>
    p.id === menteeId ? { ...p, mentorId } : p,
  )
  const mentorName = mentorId
    ? save.players.find((p) => p.id === mentorId)?.name
    : null
  return {
    save: {
      ...save,
      players,
      development: {
        ...save.development,
        lastMentorNote: mentorName
          ? `${mentee.name} มีเมนเทอร์: ${mentorName}`
          : `ยกเลิกเมนเทอร์ของ ${mentee.name}`,
      },
    },
    message: mentorName
      ? `ตั้ง ${mentorName} เป็นเมนเทอร์ของ ${mentee.name}`
      : `ยกเลิกเมนเทอร์ของ ${mentee.name}`,
  }
}
