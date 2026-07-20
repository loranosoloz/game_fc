import type {
  GameSave,
  Player,
  PreMatchState,
  TeamTalkKind,
} from './types'
import { roleShort } from './positions'
import { createDynamics } from './dynamics'
import { buildOppositionReport } from './opposition'
import type { TouchlineShout } from './match/touchlineShouts'
import { benchIssues, ensureClubMatchdaySquad, MATCH_BENCH_SIZE } from './match/matchdaySquad'
import { isPlayerRegisteredForMatch } from './squadRegistration'
import {
  canPlayMatch,
  medicalStaminaProfile,
} from './medicalStamina'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export const TEAM_TALK_OPTIONS: Array<{
  id: TeamTalkKind
  label: string
  blurb: string
  bonus: number
}> = [
  {
    id: 'calm',
    label: 'ใจเย็น · โฟกัสแผน',
    blurb: 'ลดความกดดัน · โมราเลนิ่ง · โบนัสเล็ก',
    bonus: 1.02,
  },
  {
    id: 'inspire',
    label: 'จุดไฟห้องแต่งตัว',
    blurb: 'โมราเลพุ่ง · ความเสี่ยงอารมณ์ร้อน · โบนัสกลาง',
    bonus: 1.05,
  },
  {
    id: 'focus_weakness',
    label: 'เจาะจุดอ่อนคู่แข่ง',
    blurb: 'ย้ำจุดอ่อนจากรายงาน · โบนัสต่อแผน',
    bonus: 1.06,
  },
  {
    id: 'trust_xi',
    label: 'เชื่อมั่นใน XI',
    blurb: 'ปล่อยให้ผู้เล่นนำ · ความสัมพันธ์ห้องแต่งตัวดี',
    bonus: 1.03,
  },
]

export function nextHumanFixture(save: GameSave) {
  return save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
}

export function createPreMatchState(fixtureId: string): PreMatchState {
  return {
    fixtureId,
    lineupConfirmed: false,
    talkKind: null,
    talkMatchBonus: 1,
    touchlineShouts: [],
  }
}

export function ensurePreMatch(save: GameSave): PreMatchState | null {
  const fx = nextHumanFixture(save)
  if (!fx) return null
  if (save.preMatch?.fixtureId === fx.id) return save.preMatch
  return createPreMatchState(fx.id)
}

export function withPreMatch(save: GameSave, prep: PreMatchState | null): GameSave {
  return { ...save, preMatch: prep }
}

/** ฟอร์มล่าสุด W/D/L จากมุมมองคลับ */
export function clubFormGuide(
  save: GameSave,
  clubId: string,
  n = 5,
): Array<'W' | 'D' | 'L'> {
  const played = save.fixtures
    .filter(
      (f) =>
        f.played &&
        f.homeGoals != null &&
        f.awayGoals != null &&
        (f.homeClubId === clubId || f.awayClubId === clubId),
    )
    .sort((a, b) => b.matchday - a.matchday)
    .slice(0, n)

  return played.map((f) => {
    const home = f.homeClubId === clubId
    const us = home ? f.homeGoals! : f.awayGoals!
    const them = home ? f.awayGoals! : f.homeGoals!
    if (us > them) return 'W'
    if (us < them) return 'L'
    return 'D'
  })
}

export function formatFormStrip(form: Array<'W' | 'D' | 'L'>): string {
  if (form.length === 0) return 'ยังไม่มีผล'
  return form.join(' ')
}

/** XI จากแท็กติก — ข้ามคนเจ็บ/แบน/ลา ถ้าเป็นไปได้ */
export function predictedStartingXi(save: GameSave, clubId: string): Player[] {
  const tactics = save.tacticsByClub[clubId]
  const squad = save.players.filter((p) => p.clubId === clubId)
  const byId = new Map(squad.map((p) => [p.id, p]))
  const available = (p: Player) => canPlayMatch(p)

  const xi: Player[] = []
  for (const id of tactics?.startingXi ?? []) {
    const p = byId.get(id)
    if (p && available(p)) xi.push(p)
  }
  if (xi.length >= 11) return xi.slice(0, 11)

  const rest = squad
    .filter((p) => available(p) && !xi.some((x) => x.id === p.id))
    .sort((a, b) => b.overall - a.overall)
  for (const p of rest) {
    if (xi.length >= 11) break
    xi.push(p)
  }
  return xi
}

export function humanMatchAbsentees(save: GameSave): {
  injured: Player[]
  banned: Player[]
  other: Player[]
} {
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  return {
    injured: squad.filter((p) => p.injuryDays > 0 || (p.illnessDays ?? 0) > 0),
    banned: squad.filter((p) => (p.banMatches ?? 0) > 0),
    other: squad.filter((p) => (p.leaveDays ?? 0) > 0),
  }
}

export function lineupIssues(save: GameSave): string[] {
  const issues: string[] = []
  const tactics = save.tacticsByClub[save.humanClubId]
  const fx = nextHumanFixture(save)
  const xi = (tactics?.startingXi ?? [])
    .map((id) => save.players.find((p) => p.id === id))
    .filter(Boolean) as Player[]
  if (xi.length < 11) issues.push(`XI ไม่ครบ 11 คน (มี ${xi.length})`)
  if (!tactics?.captainId) {
    issues.push('ยังไม่เลือกกัปตัน — ไปหน้าทีมเลือกก่อน')
  } else if (!tactics.startingXi.includes(tactics.captainId)) {
    const name =
      save.players.find((p) => p.id === tactics.captainId)?.name ?? 'กัปตัน'
    issues.push(`กัปตัน ${name} ไม่อยู่ใน XI — จัดลงตัวจริงหรือเปลี่ยนกัปตันที่หน้าทีม`)
  }
  for (const p of xi) {
    const med = medicalStaminaProfile(p)
    if (med.status === 'out') {
      if (p.injuryDays > 0) issues.push(`${p.name} เจ็บหนัก — ห้ามลง (${med.noteTh})`)
      else if ((p.illnessDays ?? 0) > 0) issues.push(`${p.name} ป่วย — ห้ามลง`)
      else if ((p.banMatches ?? 0) > 0) issues.push(`${p.name} ติดแบน`)
      else if ((p.leaveDays ?? 0) > 0) issues.push(`${p.name} ลา`)
      else issues.push(`${p.name} ไม่พร้อมลง`)
    } else if (med.status === 'limited') {
      issues.push(
        `${p.name} ลงได้แบบประคอง · stamina สูงสุด ~${med.staminaCap}% · ฟื้นช้า`,
      )
    }
    if (
      fx &&
      !isPlayerRegisteredForMatch(save, save.humanClubId, p.id, fx.competition)
    ) {
      issues.push(`${p.name} ไม่ได้อยู่ในทะเบียนนัดนี้ — ไปหน้าลงทะเบียน`)
    }
  }
  issues.push(...benchIssues(tactics, save.players))
  return issues
}

export function confirmLineup(save: GameSave): { ok: boolean; save: GameSave; message: string } {
  const fx = nextHumanFixture(save)
  if (!fx) return { ok: false, save, message: 'ไม่มีนัดถัดไป' }
  const filled = ensureClubMatchdaySquad(
    save,
    save.humanClubId,
    save.tacticsByClub[save.humanClubId]!,
    fx.competition,
  )
  const nextSave: GameSave = {
    ...save,
    tacticsByClub: { ...save.tacticsByClub, [save.humanClubId]: filled },
  }
  const issues = lineupIssues(nextSave)
  if (issues.length > 0) {
    return { ok: false, save: nextSave, message: issues[0] }
  }
  const prep = ensurePreMatch(nextSave) ?? createPreMatchState(fx.id)
  return {
    ok: true,
    message: `ยืนยัน XI 11 + สำรอง ${filled.bench.length}/${MATCH_BENCH_SIZE} คน — พร้อมขึ้นสนาม`,
    save: withPreMatch(nextSave, { ...prep, fixtureId: fx.id, lineupConfirmed: true }),
  }
}

export function chooseTeamTalk(
  save: GameSave,
  kind: TeamTalkKind,
): { ok: boolean; save: GameSave; message: string } {
  const fx = nextHumanFixture(save)
  if (!fx) return { ok: false, save, message: 'ไม่มีนัดถัดไป' }
  const opt = TEAM_TALK_OPTIONS.find((o) => o.id === kind)!
  const prep = ensurePreMatch(save) ?? createPreMatchState(fx.id)

  let players = save.players.map((p) => {
    if (p.clubId !== save.humanClubId) return p
    let morale = p.morale
    let happiness = p.happiness ?? p.morale
    if (kind === 'inspire') {
      morale = Math.min(20, morale + 2)
      happiness = Math.min(20, happiness + 1)
    } else if (kind === 'calm') {
      morale = Math.min(20, morale + 1)
    } else if (kind === 'trust_xi') {
      happiness = Math.min(20, happiness + 2)
    } else {
      morale = Math.min(20, morale + 1)
      happiness = Math.min(20, happiness + 1)
    }
    return { ...p, morale, happiness }
  })

  let dynamics = save.dynamics ?? createDynamics()
  if (kind === 'inspire') {
    dynamics = {
      ...dynamics,
      dressingRoomMood: clamp(dynamics.dressingRoomMood + 4, 0, 100),
      lastNote: 'ทีมทอล์คจุดไฟก่อนแข่ง',
    }
  } else if (kind === 'calm') {
    dynamics = {
      ...dynamics,
      dressingRoomMood: clamp(dynamics.dressingRoomMood + 2, 0, 100),
      cohesion: clamp(dynamics.cohesion + 1, 0, 100),
      lastNote: 'ทีมทอล์คใจเย็นก่อนแข่ง',
    }
  } else if (kind === 'trust_xi') {
    dynamics = {
      ...dynamics,
      hierarchyStability: clamp(dynamics.hierarchyStability + 3, 0, 100),
      lastNote: 'ผู้จัดการเชื่อมั่นใน XI',
    }
  } else {
    dynamics = {
      ...dynamics,
      cohesion: clamp(dynamics.cohesion + 2, 0, 100),
      lastNote: 'ทีมทอล์คเจาะจุดอ่อนคู่แข่ง',
    }
  }

  return {
    ok: true,
    message: `ทีมทอล์ค: ${opt.label}`,
    save: withPreMatch(
      { ...save, players, dynamics },
      {
        ...prep,
        fixtureId: fx.id,
        talkKind: kind,
        talkMatchBonus: opt.bonus,
      },
    ),
  }
}

export function preMatchChecklist(save: GameSave): {
  prep: PreMatchState | null
  steps: Array<{ id: string; label: string; done: boolean; detail?: string }>
  ready: boolean
  canForce: boolean
} {
  const fx = nextHumanFixture(save)
  const prep = ensurePreMatch(save)
  if (!fx || !prep) {
    return { prep: null, steps: [], ready: false, canForce: false }
  }
  const issues = lineupIssues(save)
  const captainOk =
    Boolean(save.tacticsByClub[save.humanClubId]?.captainId) &&
    (save.tacticsByClub[save.humanClubId]?.startingXi ?? []).includes(
      save.tacticsByClub[save.humanClubId]?.captainId ?? '',
    )
  const steps = [
    {
      id: 'brief',
      label: 'อ่านรายงานคู่แข่ง',
      done: true,
      detail: 'ดูฟอร์ม · จุดอ่อน · XI คาดการณ์ด้านล่าง',
    },
    {
      id: 'captain',
      label: 'เลือกกัปตัน (หน้าทีม)',
      done: captainOk,
      detail: captainOk
        ? (() => {
            const id = save.tacticsByClub[save.humanClubId]?.captainId
            return save.players.find((p) => p.id === id)?.name ?? 'เลือกแล้ว'
          })()
        : 'ต้องเลือกกัปตันใน XI ที่หน้าทีมก่อนเตะ',
    },
    {
      id: 'lineup',
      label: 'ยืนยัน XI',
      done: prep.lineupConfirmed && issues.length === 0,
      detail: issues[0] ?? 'XI พร้อม',
    },
    {
      id: 'talk',
      label: 'ทีมทอล์คห้องแต่งตัว',
      done: prep.talkKind != null,
      detail: prep.talkKind
        ? TEAM_TALK_OPTIONS.find((o) => o.id === prep.talkKind)?.label
        : 'ยังไม่ได้พูด',
    },
  ]
  const ready = steps.every((s) => s.done)
  // กัปตันบังคับ — ห้าม force ข้าม
  const canForce = captainOk
  return { prep, steps, ready, canForce }
}

export function enrichOppositionBrief(save: GameSave, opponentId: string) {
  const base = buildOppositionReport(save, opponentId)
  const xi = predictedStartingXi(save, opponentId)
  const form = clubFormGuide(save, opponentId, 5)
  const ourForm = clubFormGuide(save, save.humanClubId, 5)
  return {
    ...base,
    predictedXi: xi.map((p) => ({
      id: p.id,
      name: p.name,
      role: roleShort(p.role),
      overall: p.overall,
    })),
    form,
    ourForm,
    formLabel: formatFormStrip(form),
    ourFormLabel: formatFormStrip(ourForm),
  }
}

/** หลังจบนัด — เคลียร์ prep */
export function clearPreMatch(save: GameSave): GameSave {
  return { ...save, preMatch: null }
}

export function talkBonusFromSave(save: GameSave): number {
  const prep = save.preMatch
  if (!prep?.talkKind) return 1
  return prep.talkMatchBonus || 1
}

export const TOUCHLINE_SHOUT_OPTIONS: { id: TouchlineShout; label: string }[] = [
  { id: 'demand_more', label: 'Demand More' },
  { id: 'berate', label: 'Berate' },
  { id: 'praise', label: 'Praise' },
  { id: 'encourage', label: 'Encourage' },
  { id: 'focus', label: 'Focus' },
]

export function queueTouchlineShout(
  save: GameSave,
  shout: TouchlineShout,
): { ok: boolean; save: GameSave; message: string } {
  const fx = nextHumanFixture(save)
  if (!fx) return { ok: false, save, message: 'ไม่มีนัดถัดไป' }
  const prep = ensurePreMatch(save) ?? createPreMatchState(fx.id)
  const prev = prep.touchlineShouts ?? []
  const nextShouts = [...prev.filter((s) => s !== shout), shout].slice(-3)
  return {
    ok: true,
    save: withPreMatch(save, { ...prep, fixtureId: fx.id, touchlineShouts: nextShouts }),
    message: `ตะโกน「${TOUCHLINE_SHOUT_OPTIONS.find((o) => o.id === shout)?.label ?? shout}」คิวแล้ว (${nextShouts.length})`,
  }
}
