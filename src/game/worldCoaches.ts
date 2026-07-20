import coachesDb from '@/data/worldCoaches.json'
import careerDb from '@/data/world/coachCareers.json'
import assocDb from '@/data/associations.json'
import type {
  Club,
  FormationId,
  GameSave,
  Mentality,
  PlayStyle,
  Pressing,
  TeamInstructions,
  Tempo,
  Width,
} from './types'

export type CoachStyleId =
  | 'possession'
  | 'balanced'
  | 'counter'
  | 'press'
  | 'direct'
  | 'low_block'

export type CoachTier = 'elite' | 'world' | 'top' | 'solid' | 'emerging' | 'national'

export interface WorldCoach {
  id: string
  name: string
  nation: string
  nationTh: string
  power: number
  attackingIQ: number
  defendingIQ: number
  manManagement: number
  adaptability: number
  preferredFormation: FormationId
  formationOop: FormationId
  style: CoachStyleId
  styleLabelTh: string
  mentality: Mentality
  pressing: Pressing
  tempo: Tempo
  width: Width
  solveGame: string[]
  strongVs: string[]
  weakVs: string[]
  inGameLosing: string
  inGameWinning: string
  wageWeekly: number
  hireFee: number
  tier: CoachTier
  nationalOnly?: boolean
}

export type CoachCareerRole = 'manager' | 'interim' | 'assistant' | 'national'

export interface CoachCareerStint {
  from: number
  to: number | null
  team: string
  teamTh?: string
  role: CoachCareerRole
  honours?: string[]
  noteTh?: string
}

export interface CoachCareer {
  summaryTh: string
  timeline: CoachCareerStint[]
}

const COACHES = coachesDb.coaches as WorldCoach[]
const CAREERS = (careerDb as { byId?: Record<string, CoachCareer> }).byId ?? {}
const STYLE_META = coachesDb.styles as Record<
  string,
  { labelTh: string; beats: string[]; losesTo: string[] }
>
const SOLVE_LABELS = coachesDb.solveLabels as Record<string, string>
const BY_ID = new Map(COACHES.map((c) => [c.id, c]))

export function getCoachCareer(coachId: string | null | undefined): CoachCareer | null {
  if (!coachId) return null
  return CAREERS[coachId] ?? null
}

export function formatCareerYears(from: number, to: number | null): string {
  if (to == null) return `${from}–ปัจจุบัน`
  if (to === from) return String(from)
  return `${from}–${to}`
}

export function careerRoleLabelTh(role: CoachCareerRole): string {
  if (role === 'national') return 'ทีมชาติ'
  if (role === 'assistant') return 'ผู้ช่วย'
  if (role === 'interim') return 'ชั่วคราว'
  return 'ผู้จัดการ'
}

/** โค้ชที่สมาคมจองไว้แล้ว (จาก seed หรือเซฟ) */
export function reservedAssociationCoachIds(
  associations?: Record<string, { coachId: string | null }> | null,
): Set<string> {
  const ids = new Set<string>()
  if (associations) {
    for (const a of Object.values(associations)) {
      if (a.coachId) ids.add(a.coachId)
    }
    return ids
  }
  const seeds = assocDb.associations as Record<string, { coachId?: string | null }>
  for (const a of Object.values(seeds)) {
    if (a.coachId) ids.add(a.coachId)
  }
  return ids
}

export function allWorldCoaches(): WorldCoach[] {
  return COACHES
}

export function getWorldCoach(id: string | null | undefined): WorldCoach | null {
  if (!id) return null
  return BY_ID.get(id) ?? null
}

export function styleLabelTh(style: string): string {
  return STYLE_META[style]?.labelTh ?? style
}

export function solveLabelTh(tag: string): string {
  return SOLVE_LABELS[tag] ?? tag
}

export function hireableCoaches(): WorldCoach[] {
  // รวมโค้ชทีมชาติด้วย — ว่างจากสมาคมแล้วรับงานคลับได้
  return COACHES.filter((c) => (c.hireFee > 0 || c.nationalOnly || c.power >= 70))
}

export function clubHireCost(coach: WorldCoach): number {
  const fee = coach.hireFee > 0 ? coach.hireFee : Math.round(coach.power * 110_000)
  const wage = coach.wageWeekly > 0 ? coach.wageWeekly : Math.round(40_000 + coach.power * 1_200)
  return fee + wage * 4
}

export function effectiveWageWeekly(coach: WorldCoach): number {
  return coach.wageWeekly > 0 ? coach.wageWeekly : Math.round(40_000 + coach.power * 1_200)
}

export function coachStyleToPlayStyle(style: CoachStyleId): PlayStyle {
  if (style === 'possession') return 'possession'
  if (style === 'counter' || style === 'direct' || style === 'low_block') return 'counter'
  return 'balanced'
}

export function instructionsFromCoach(coach: WorldCoach): TeamInstructions {
  return {
    mentality: coach.mentality,
    pressing: coach.pressing,
    tempo: coach.tempo,
    width: coach.width,
    style: coachStyleToPlayStyle(coach.style),
  }
}

export function assignedCoachIds(clubs: Club[]): Set<string> {
  return new Set(clubs.map((c) => c.coachId).filter(Boolean) as string[])
}

export function freeWorldCoaches(
  clubs: Club[],
  associations?: Record<string, { coachId: string | null }> | null,
): WorldCoach[] {
  const atClub = assignedCoachIds(clubs)
  // ว่างจริง — ไม่รวมที่คุมทีมชาติ (พวกนั้นแสดงแยกเป็นดึงจากชาติ)
  const atNt = reservedAssociationCoachIds(associations)
  return hireableCoaches()
    .filter((c) => !atClub.has(c.id) && !atNt.has(c.id))
    .sort((a, b) => b.power - a.power || a.hireFee - b.hireFee)
}

/** โค้ชที่คุมทีมชาติอยู่ — คลับดึงมาได้ (ลาออกจากชาติ) */
export function ntCoachesAvailableToPoach(
  clubs: Club[],
  associations?: Record<string, { coachId: string | null; nation?: string }> | null,
): { coach: WorldCoach; nation: string }[] {
  if (!associations) return []
  const atClub = assignedCoachIds(clubs)
  const out: { coach: WorldCoach; nation: string }[] = []
  for (const [nation, a] of Object.entries(associations)) {
    if (!a.coachId || atClub.has(a.coachId)) continue
    const coach = getWorldCoach(a.coachId)
    if (!coach) continue
    out.push({ coach, nation })
  }
  return out.sort((a, b) => b.coach.power - a.coach.power)
}

export function assignWorldCoaches(
  clubs: Club[],
  seed = 2026,
  associations?: Record<string, { coachId: string | null }> | null,
): Club[] {
  const reserved = reservedAssociationCoachIds(associations)
  const hireable = hireableCoaches()
    .filter((c) => !reserved.has(c.id))
    .slice()
    .sort((a, b) => b.power - a.power)
  const used = new Set<string>([...reserved])
  const sorted = clubs
    .map((c, i) => ({ c, i }))
    .sort((a, b) => b.c.reputation - a.c.reputation || a.i - b.i)

  const next = clubs.map((c) => {
    // ปลดโค้ชที่สมาคมจองออกจากคลับ
    if (c.coachId && reserved.has(c.coachId)) return { ...c, coachId: null }
    return { ...c }
  })

  for (const { c } of sorted) {
    const idx = clubs.findIndex((x) => x.id === c.id)
    if (idx < 0) continue
    if (next[idx]!.coachId && BY_ID.has(next[idx]!.coachId!)) {
      used.add(next[idx]!.coachId!)
      continue
    }

    const targetPower = Math.min(97, 58 + c.reputation * 0.45)
    const pool = hireable.filter((coach) => !used.has(coach.id))
    if (pool.length === 0) break

    let pick: WorldCoach | undefined
    if (c.controlledBy === 'human') {
      pick =
        pool.find((coach) => coach.power >= 78 && coach.power <= 88) ??
        pool[Math.floor(pool.length / 3)]
    } else {
      pick =
        pool.find((coach) => Math.abs(coach.power - targetPower) <= 6) ??
        pool.find((coach) => coach.power <= targetPower + 4) ??
        pool[0]
    }
    if (!pick) continue
    const jitter = (c.id.length * 17 + seed) % Math.min(3, pool.length)
    const candidates = pool
      .filter((coach) => Math.abs(coach.power - (pick?.power ?? targetPower)) <= 8)
      .slice(0, 5)
    const chosen = candidates[jitter % Math.max(1, candidates.length)] ?? pick
    used.add(chosen.id)
    next[idx] = { ...next[idx]!, coachId: chosen.id }
  }

  return next
}

export function ensureClubCoaches(
  clubs: Club[],
  associations?: Record<string, { coachId: string | null }> | null,
): Club[] {
  const reserved = reservedAssociationCoachIds(associations)
  const cleaned = clubs.map((c) =>
    c.coachId && reserved.has(c.coachId) ? { ...c, coachId: null } : c,
  )
  if (cleaned.every((c) => c.coachId && BY_ID.has(c.coachId))) return cleaned
  return assignWorldCoaches(cleaned, 2026, associations)
}

export function coachMatchModifiers(
  homeClub: Club,
  awayClub: Club,
  homeStyle: PlayStyle | CoachStyleId,
  awayStyle: PlayStyle | CoachStyleId,
  opts?: {
    humanClubId?: string
    manager?: {
      name: string
      style: CoachStyleId
      power: number
      attackingIQ: number
      defendingIQ: number
      manManagement: number
      adaptability: number
      strongVs: string[]
      weakVs: string[]
    } | null
  },
): { homeAtk: number; homeDef: number; awayAtk: number; awayDef: number; note: string | null } {
  const humanId = opts?.humanClubId
  const manager = opts?.manager ?? null

  const sideCoach = (club: Club) => {
    if (humanId && club.id === humanId && manager) {
      return {
        name: manager.name,
        style: manager.style,
        power: manager.power,
        attackingIQ: manager.attackingIQ,
        defendingIQ: manager.defendingIQ,
        manManagement: manager.manManagement,
        adaptability: manager.adaptability,
        strongVs: manager.strongVs,
        weakVs: manager.weakVs,
        isHuman: true,
      }
    }
    const w = getWorldCoach(club.coachId)
    if (!w) return null
    return {
      name: w.name,
      style: w.style,
      power: w.power,
      attackingIQ: w.attackingIQ,
      defendingIQ: w.defendingIQ,
      manManagement: w.manManagement,
      adaptability: w.adaptability,
      strongVs: w.strongVs,
      weakVs: w.weakVs,
      isHuman: false,
    }
  }

  const home = sideCoach(homeClub)
  const away = sideCoach(awayClub)
  let homeAtk = 1
  let homeDef = 1
  let awayAtk = 1
  let awayDef = 1
  const notes: string[] = []
  /** สเกลโค้ช 1–100 · 80 = กลาง */
  const powerFactor = (p: number) => 1 + (p - 80) * 0.0018
  const manFactor = (m: number) => 1 + (m - 80) * 0.0009
  /** ปรับตัวสูง → โทษแผนที่ไม่ถนัดเบาลง */
  const weakAtkMul = (adapt: number) => 0.955 + (adapt - 70) * 0.0009
  const weakDefMul = (adapt: number) => 0.97 + (adapt - 70) * 0.0005

  if (home) {
    homeAtk *= powerFactor(home.attackingIQ)
    homeDef *= powerFactor(home.defendingIQ)
    homeAtk *= 1 + (home.power - 80) * 0.0012
    homeDef *= 1 + (home.power - 80) * 0.0012
    homeAtk *= manFactor(home.manManagement)
    homeDef *= manFactor(home.manManagement)
    // ที่ปรึกษาแผนใต้ผู้จัดการ — โบนัสเล็ก
    if (home.isHuman) {
      const advisor = getWorldCoach(homeClub.coachId)
      if (advisor) {
        homeAtk *= 1 + (advisor.power - 75) * 0.0004
        homeDef *= 1 + (advisor.power - 75) * 0.0004
        homeAtk *= 1 + (advisor.manManagement - 75) * 0.00025
        homeDef *= 1 + (advisor.manManagement - 75) * 0.00025
      }
    }
  }
  if (away) {
    awayAtk *= powerFactor(away.attackingIQ)
    awayDef *= powerFactor(away.defendingIQ)
    awayAtk *= 1 + (away.power - 80) * 0.0012
    awayDef *= 1 + (away.power - 80) * 0.0012
    awayAtk *= manFactor(away.manManagement)
    awayDef *= manFactor(away.manManagement)
    if (away.isHuman) {
      const advisor = getWorldCoach(awayClub.coachId)
      if (advisor) {
        awayAtk *= 1 + (advisor.power - 75) * 0.0004
        awayDef *= 1 + (advisor.power - 75) * 0.0004
        awayAtk *= 1 + (advisor.manManagement - 75) * 0.00025
        awayDef *= 1 + (advisor.manManagement - 75) * 0.00025
      }
    }
  }

  const hStyle = home?.style ?? (homeStyle as CoachStyleId)
  const aStyle = away?.style ?? (awayStyle as CoachStyleId)

  if (home) {
    if (home.strongVs.includes(aStyle)) {
      homeAtk *= 1.045
      notes.push(`${home.name} ถนัดชนะแผน「${styleLabelTh(aStyle)}」`)
    }
    if (home.weakVs.includes(aStyle)) {
      homeAtk *= weakAtkMul(home.adaptability)
      homeDef *= weakDefMul(home.adaptability)
      notes.push(`${home.name} ไม่ถนัดกับ「${styleLabelTh(aStyle)}」`)
    }
  }
  if (away) {
    if (away.strongVs.includes(hStyle)) {
      awayAtk *= 1.045
      notes.push(`${away.name} ถนัดชนะแผน「${styleLabelTh(hStyle)}」`)
    }
    if (away.weakVs.includes(hStyle)) {
      awayAtk *= weakAtkMul(away.adaptability)
      awayDef *= weakDefMul(away.adaptability)
      notes.push(`${away.name} ไม่ถนัดกับ「${styleLabelTh(hStyle)}」`)
    }
  }

  const hMeta = STYLE_META[hStyle]
  const aMeta = STYLE_META[aStyle]
  if (hMeta?.beats.includes(aStyle)) homeAtk *= 1.02
  if (hMeta?.losesTo.includes(aStyle)) homeAtk *= 0.98
  if (aMeta?.beats.includes(hStyle)) awayAtk *= 1.02
  if (aMeta?.losesTo.includes(hStyle)) awayAtk *= 0.98

  return { homeAtk, homeDef, awayAtk, awayDef, note: notes[0] ?? null }
}

/**
 * เมื่อผู้จัดการคนใหม่รับงาน — โค้ชสโมสรเดิมว่างงาน แล้วมีคลับ AI อื่นจ้างแทน
 * (โค้ชที่ถูกแทนที่ในคลับปลายทางกลายเป็นว่างในตลาด)
 */
export function displaceClubCoachOnTakeover(
  clubs: Club[],
  clubId: string,
  associations?: Record<string, { coachId: string | null }> | null,
): {
  clubs: Club[]
  displaced: WorldCoach | null
  hiredAt: Club | null
  bumped: WorldCoach | null
} {
  const club = clubs.find((c) => c.id === clubId)
  if (!club?.coachId) {
    return { clubs, displaced: null, hiredAt: null, bumped: null }
  }
  const displaced = getWorldCoach(club.coachId)
  if (!displaced) {
    return {
      clubs: clubs.map((c) => (c.id === clubId ? { ...c, coachId: null } : c)),
      displaced: null,
      hiredAt: null,
      bumped: null,
    }
  }

  const reserved = reservedAssociationCoachIds(associations)
  const candidates = clubs.filter(
    (c) =>
      c.id !== clubId &&
      c.controlledBy === 'ai' &&
      !c.id.startsWith('ucl-') &&
      !c.id.startsWith('uel-') &&
      !c.id.startsWith('uecl-'),
  )

  // ชอบคลับที่โค้ชอ่อนกว่า / ไม่มีโค้ช
  const scored = candidates
    .map((c) => {
      const cur = getWorldCoach(c.coachId)
      if (cur && reserved.has(cur.id)) return null
      const gap = displaced.power - (cur?.power ?? 60)
      const fit = 20 - Math.abs(c.reputation * 0.45 + 40 - displaced.power)
      return { c, cur, score: gap * 2 + fit + (cur ? 0 : 15) }
    })
    .filter(Boolean) as { c: Club; cur: WorldCoach | null; score: number }[]

  scored.sort((a, b) => b.score - a.score)
  const pick = scored[0]

  if (!pick) {
    return {
      clubs: clubs.map((c) => (c.id === clubId ? { ...c, coachId: null } : c)),
      displaced,
      hiredAt: null,
      bumped: null,
    }
  }

  const bumped = pick.cur
  const next = clubs.map((c) => {
    if (c.id === clubId) return { ...c, coachId: null }
    if (c.id === pick.c.id) return { ...c, coachId: displaced.id }
    return c
  })

  return {
    clubs: next,
    displaced,
    hiredAt: pick.c,
    bumped,
  }
}

/** คลับ AI ที่ไม่มีโค้ช — จ้างจากตลาดว่าง */
export function fillVacantAiClubCoach(
  clubs: Club[],
  clubId: string,
  associations?: Record<string, { coachId: string | null }> | null,
): { clubs: Club[]; hired: WorldCoach | null } {
  const club = clubs.find((c) => c.id === clubId)
  if (!club || club.controlledBy !== 'ai' || club.coachId) {
    return { clubs, hired: null }
  }
  const free = freeWorldCoaches(clubs, associations)
  if (free.length === 0) return { clubs, hired: null }
  const sorted = [...free].sort(
    (a, b) =>
      Math.abs(a.power - (club.reputation * 0.45 + 40)) -
      Math.abs(b.power - (club.reputation * 0.45 + 40)),
  )
  const hired = sorted[0]!
  return {
    clubs: clubs.map((c) => (c.id === clubId ? { ...c, coachId: hired.id } : c)),
    hired,
  }
}

export function coachBlurb(coach: WorldCoach): string {
  const solve = coach.solveGame.slice(0, 2).map(solveLabelTh).join(' · ')
  const strong = coach.strongVs.slice(0, 2).map(styleLabelTh).join(', ')
  const weak = coach.weakVs.slice(0, 2).map(styleLabelTh).join(', ')
  return [
    `พลัง ${coach.power} · ${coach.styleLabelTh}`,
    solve ? `แก้เกม: ${solve}` : null,
    strong ? `ถนัดชนะ: ${strong}` : null,
    weak ? `ไม่ถนัด: ${weak}` : null,
  ]
    .filter(Boolean)
    .join(' — ')
}

export function hireWorldCoach(save: GameSave, coachId: string): {
  ok: boolean
  save: GameSave
  message: string
} {
  const coach = getWorldCoach(coachId)
  if (!coach) {
    return { ok: false, save, message: 'ไม่พบโค้ชนี้ในตลาด' }
  }
  if (assignedCoachIds(save.clubs).has(coachId)) {
    return { ok: false, save, message: 'โค้ชคนนี้คุมสโมสรอื่นอยู่แล้ว' }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)
  if (!human) return { ok: false, save, message: 'ไม่พบสโมสร' }

  // ดึงจากทีมชาติได้ — แต่โค้ชเพิ่งรับงานชาติยังไม่ยอมคุย (สภาพแวดล้อม)
  let associations = save.associations ? { ...save.associations } : save.associations
  let fromNation: string | null = null
  let ntComp = 0
  if (associations) {
    for (const [nation, a] of Object.entries(associations)) {
      if (a.coachId === coachId) {
        const windows = a.windowsInCharge ?? 0
        const form = a.form ?? 12
        // เกราะ: อย่างน้อย 3 หน้าต่าง ถึงจะยอมลาออกมาคลับ
        // ยกเว้นฟอร์มแย่มาก (≤6) หลังคุมมาแล้ว ≥2 หน้าต่าง
        const canLeave = windows >= 3 || (windows >= 2 && form <= 6)
        if (!canLeave) {
          return {
            ok: false,
            save,
            message: `${coach.name} เพิ่งรับงานทีมชาติ${nation} (คุมมา ${windows} หน้าต่าง) — ยังไม่พร้อมคุยกับคลับ`,
          }
        }
        // ฟอร์มดีมาก + ท็อปชาติ = ยากที่จะดึง
        if (form >= 14 && a.fifaRank <= 15 && windows < 6) {
          return {
            ok: false,
            save,
            message: `${coach.name} ฟอร์มชาติดี (${form}/20) และอยู่ชาติท็อป — ยังไม่สนใจงานคลับ`,
          }
        }
        fromNation = nation
        ntComp = Math.round(coach.power * 80_000)
        if (form >= 12) ntComp = Math.round(ntComp * 1.25)
        associations = {
          ...associations,
          [nation]: {
            ...a,
            coachId: null,
            wageWeekly: 0,
            form: 10,
            windowsInCharge: 0,
            vacantWindows: 1,
            budget: a.budget + Math.round(ntComp * 0.35),
          },
        }
        break
      }
    }
  }

  const cost = clubHireCost(coach) + ntComp
  if (human.balance < cost) {
    return {
      ok: false,
      save,
      message: fromNation
        ? `งบไม่พอดึงจากทีมชาติ (ต้องการ ${cost.toLocaleString()})`
        : `งบไม่พอจ้าง (ต้องการ ${cost.toLocaleString()})`,
    }
  }

  const clubs = save.clubs.map((c) => {
    if (c.id === save.humanClubId) return { ...c, coachId: coach.id, balance: c.balance - cost }
    return c
  })

  const tactics = { ...save.tacticsByClub }
  const current = tactics[save.humanClubId]
  if (current) {
    tactics[save.humanClubId] = {
      ...current,
      formation: coach.preferredFormation,
      formationOop: coach.formationOop,
      instructions: instructionsFromCoach(coach),
      familiarity: Math.min(current.familiarity, 48),
    }
  }

  const members = save.staff.members.map((m) =>
    m.role === 'coach'
      ? { ...m, name: coach.name, level: Math.min(20, Math.round(coach.power / 5)) }
      : m,
  )

  const leaveNt =
    fromNation != null
      ? `${coach.name} ลาออกจากทีมชาติ${fromNation} มาคุม ${human.shortName} (ค่าฉีกสัญญาชาติ ${ntComp.toLocaleString()})`
      : null

  return {
    ok: true,
    save: {
      ...save,
      clubs,
      associations: associations ?? save.associations,
      tacticsByClub: tactics,
      staff: { ...save.staff, members },
      inbox: [
        {
          id: `msg-hire-coach-${Date.now()}`,
          date: save.currentDate,
          title: fromNation
            ? `ดึงโค้ชจากทีมชาติ · ${coach.name}`
            : `จ้างที่ปรึกษาแผน · ${coach.name}`,
          body: [
            coachBlurb(coach),
            leaveNt,
            `ค่าจ้างรวม ${cost.toLocaleString()} · แผนถนัด ${coach.preferredFormation}`,
          ]
            .filter(Boolean)
            .join('\n'),
          read: false,
        },
        ...save.inbox,
      ].slice(0, 45),
    },
    message: fromNation
      ? `${coach.name} ลาออกจากทีมชาติมาคุมคลับคุณแล้ว`
      : `จ้าง ${coach.name} สำเร็จ`,
  }
}
