import assocDb from '@/data/associations.json'
import type { Club, GameSave, MediaItem } from './types'
import {
  allWorldCoaches,
  getWorldCoach,
  type WorldCoach,
} from './worldCoaches'
import { normalizeNation, ntTeam } from './nationalTeams'
import { pushNews } from './media'
import { pickOutlet } from './mediaOutlets'

export interface AssocTier {
  maxRank: number
  label: string
  labelTh: string
  minCoachPower: number
  preferTiers: string[]
}

export interface AssocSeed {
  code: string
  name: string
  nameTh: string
  fifaRank: number
  budget: number
  coachId: string | null
  wageWeekly: number
}

/** สถานะสมาคมในเซฟ (งบ + โค้ชปัจจุบัน) */
export interface AssociationState {
  nation: string
  code: string
  name: string
  nameTh: string
  fifaRank: number
  budget: number
  coachId: string | null
  wageWeekly: number
  hiredMatchday: number
  /** ฟอร์มผลงานโค้ชชาติ 1–20 (สมาคมใช้ตัดสินใจไล่) */
  form: number
  /** หน้าต่าง FIFA ที่โค้ชคนนี้คุมมาแล้ว */
  windowsInCharge: number
  /** นับหน้าต่างที่เก้าอี้ว่าง (ก่อนดึงจากคลับ) */
  vacantWindows: number
}

const SEEDS = assocDb.associations as Record<string, AssocSeed>
const TIERS = assocDb.fifaTiers as AssocTier[]

/** โค้ชทีมชาติคือผู้เล่น (ไม่ใช่ world coach) */
export const HUMAN_NT_COACH_ID = '__human__'

export function isHumanNtCoachId(coachId: string | null | undefined): boolean {
  return coachId === HUMAN_NT_COACH_ID
}

export function allAssociationNations(): string[] {
  return Object.keys(SEEDS)
}

export function assocSeed(nation: string): AssocSeed | null {
  const n = normalizeNation(nation) ?? nation
  return SEEDS[n] ?? null
}

export function fifaTierForRank(rank: number): AssocTier {
  return TIERS.find((t) => rank <= t.maxRank) ?? TIERS[TIERS.length - 1]!
}

export function createAssociationsState(): Record<string, AssociationState> {
  const out: Record<string, AssociationState> = {}
  for (const [nation, seed] of Object.entries(SEEDS)) {
    out[nation] = {
      nation,
      code: seed.code,
      name: seed.name,
      nameTh: seed.nameTh,
      fifaRank: seed.fifaRank,
      budget: seed.budget,
      coachId: seed.coachId,
      wageWeekly: seed.wageWeekly,
      hiredMatchday: 0,
      form: 12,
      windowsInCharge: 2,
      vacantWindows: 0,
    }
  }
  return out
}

export function ensureAssociations(save: GameSave): GameSave {
  if (save.associations && Object.keys(save.associations).length >= 20) {
    const next = { ...save.associations }
    let changed = false
    for (const [nation, seed] of Object.entries(SEEDS)) {
      if (!next[nation]) {
        next[nation] = {
          nation,
          code: seed.code,
          name: seed.name,
          nameTh: seed.nameTh,
          fifaRank: seed.fifaRank,
          budget: seed.budget,
          coachId: seed.coachId,
          wageWeekly: seed.wageWeekly,
          hiredMatchday: 0,
          form: 12,
          windowsInCharge: 2,
          vacantWindows: 0,
        }
        changed = true
      } else {
        const a = next[nation]!
        if (
          typeof a.form !== 'number' ||
          typeof a.windowsInCharge !== 'number' ||
          typeof a.vacantWindows !== 'number'
        ) {
          next[nation] = {
            ...a,
            form: typeof a.form === 'number' ? a.form : 12,
            windowsInCharge: typeof a.windowsInCharge === 'number' ? a.windowsInCharge : 2,
            vacantWindows: typeof a.vacantWindows === 'number' ? a.vacantWindows : 0,
          }
          changed = true
        }
      }
    }
    return changed ? { ...save, associations: next } : save
  }
  return { ...save, associations: createAssociationsState() }
}

export function associationCoachIds(
  save: GameSave | { associations?: Record<string, AssociationState> } | null,
): Set<string> {
  const ids = new Set<string>()
  const map = save?.associations
  if (!map) {
    for (const seed of Object.values(SEEDS)) {
      if (seed.coachId) ids.add(seed.coachId)
    }
    return ids
  }
  for (const a of Object.values(map)) {
    if (a.coachId && !isHumanNtCoachId(a.coachId)) ids.add(a.coachId)
  }
  return ids
}

export function getAssociation(save: GameSave, nation: string): AssociationState | null {
  const n = normalizeNation(nation) ?? nation
  return save.associations?.[n] ?? null
}

export function ntCoachForNation(save: GameSave, nation: string): WorldCoach | null {
  const assoc = getAssociation(save, nation)
  if (assoc?.coachId && !isHumanNtCoachId(assoc.coachId)) {
    return getWorldCoach(assoc.coachId)
  }
  if (isHumanNtCoachId(assoc?.coachId)) return null
  const seed = assocSeed(nation)
  if (seed?.coachId) return getWorldCoach(seed.coachId)
  const team = ntTeam(nation)
  if (!team) return null
  return allWorldCoaches().find((c) => c.name === team.coach) ?? null
}

export function ntCoachName(save: GameSave, nation: string): string {
  const n = normalizeNation(nation) ?? nation
  if (save.career?.nationalNation === n || isHumanNtCoachId(save.associations?.[n]?.coachId)) {
    return save.managerName
  }
  const coach = ntCoachForNation(save, nation)
  if (coach) return coach.name
  return ntTeam(nation)?.coach ?? '—'
}

export function canAssociationHire(
  assoc: AssociationState,
  coach: WorldCoach,
  otherAssocCoachIds: Set<string>,
  fromClub: Club | null,
): { ok: boolean; reason: string; cost: number } {
  if (otherAssocCoachIds.has(coach.id) && assoc.coachId !== coach.id) {
    return { ok: false, reason: 'โค้ชคนนี้อยู่กับสมาคมอื่นแล้ว', cost: 0 }
  }
  const tier = fifaTierForRank(assoc.fifaRank)
  if (coach.power < tier.minCoachPower) {
    return {
      ok: false,
      reason: `${assoc.nameTh} (FIFA #${assoc.fifaRank}) เข้มงวด — ต้องการพลังโค้ช ≥ ${tier.minCoachPower} (คนนี้ ${coach.power})`,
      cost: 0,
    }
  }
  if (assoc.fifaRank <= 10 && !['elite', 'world', 'national', 'top'].includes(coach.tier)) {
    return { ok: false, reason: `ท็อป 10 FIFA มักไม่จ้างโค้ชระดับ ${coach.tier}`, cost: 0 }
  }
  let cost =
    Math.max(coach.hireFee, Math.round(coach.power * 120_000)) +
    Math.max(coach.wageWeekly, 50_000) * 8
  if (fromClub) cost += Math.round(coach.power * 90_000)
  if (assoc.budget < cost) {
    return {
      ok: false,
      reason: `งบสมาคมไม่พอ (ต้องการ ${cost.toLocaleString()} มี ${assoc.budget.toLocaleString()})`,
      cost,
    }
  }
  return { ok: true, reason: 'ผ่านเกณฑ์', cost }
}

/** @deprecated ใช้ canAssociationHire */
export function associationHireCost(
  assoc: AssociationState,
  coach: WorldCoach,
  fromClub: Club | null,
): { ok: boolean; reason: string; cost: number } {
  return canAssociationHire(assoc, coach, new Set(), fromClub)
}

export function hireAssociationCoach(
  save: GameSave,
  nation: string,
  coachId: string,
): { ok: boolean; save: GameSave; message: string } {
  const n = normalizeNation(nation) ?? nation
  const assoc = save.associations?.[n]
  if (!assoc) return { ok: false, save, message: 'ไม่พบสมาคม' }
  const coach = getWorldCoach(coachId)
  if (!coach) return { ok: false, save, message: 'ไม่พบโค้ช' }

  const otherAssoc = associationCoachIds(save)
  if (assoc.coachId) otherAssoc.delete(assoc.coachId)

  const fromClub = save.clubs.find((c) => c.coachId === coachId) ?? null
  const check = canAssociationHire(assoc, coach, otherAssoc, fromClub)
  if (!check.ok) return { ok: false, save, message: check.reason }

  // โค้ชลาออกจากคลับมาคุมทีมชาติ
  let clubs = save.clubs.map((c) => {
    if (c.coachId !== coachId) return c
    return {
      ...c,
      coachId: null,
      balance: fromClub ? c.balance + Math.round(coach.power * 90_000) : c.balance,
    }
  })

  const associations = { ...save.associations }
  for (const [key, a] of Object.entries(associations)) {
    if (key !== n && a.coachId === coachId) {
      associations[key] = { ...a, coachId: null, wageWeekly: 0, form: 10, windowsInCharge: 0 }
    }
  }

  associations[n] = {
    ...assoc,
    coachId: coach.id,
    wageWeekly: Math.max(coach.wageWeekly, 50_000),
    budget: assoc.budget - check.cost,
    hiredMatchday: save.matchday,
    form: 12,
    windowsInCharge: 0,
    vacantWindows: 0,
  }

  const leaveClub = fromClub
    ? `${coach.name} ลาออกจาก ${fromClub.name} มาคุมทีมชาติ — สมาคมจ่ายค่าฉีกให้คลับ`
    : null

  let next: GameSave = {
    ...save,
    clubs,
    associations,
    inbox: [
      {
        id: `msg-assoc-hire-${Date.now()}`,
        date: save.currentDate,
        title: fromClub
          ? `${assoc.nameTh} ดึง ${coach.name} จาก ${fromClub.shortName}`
          : `${assoc.nameTh} จ้าง ${coach.name}`,
        body: [
          `FIFA #${assoc.fifaRank} · ${fifaTierForRank(assoc.fifaRank).labelTh}`,
          leaveClub,
          `จ่าย ${check.cost.toLocaleString()} · เหลืองบ ${associations[n]!.budget.toLocaleString()}`,
        ]
          .filter(Boolean)
          .join('\n'),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 45),
  }

  const story: MediaItem = {
    id: `news-assoc-${coach.id}-${Date.now()}`,
    date: save.currentDate,
    channel: 'news',
    headline: fromClub
      ? `${coach.name} ลาออกจาก ${fromClub.shortName} ไปคุมทีมชาติ${ntTeam(n)?.labelTh ?? n}`
      : `${assoc.name} แต่งตั้ง ${coach.name} คุมทีมชาติ${ntTeam(n)?.labelTh ?? n}`,
    body: `สมาคมจัดงบตาม FIFA #${assoc.fifaRank} — พลังโค้ช ${coach.power} · ${coach.styleLabelTh}`,
    tone: fromClub ? 'rumor' : 'neutral',
    tags: ['association', 'national', n, fromClub ? 'poach' : 'hire'],
    subjectName: coach.name,
    outlet: pickOutlet(save, assoc.fifaRank).name,
  }
  next = pushNews(next, story)

  return {
    ok: true,
    save: next,
    message: fromClub
      ? `${coach.name} ลาออกจากคลับไปคุมทีมชาติแล้ว`
      : `${assoc.nameTh} จ้าง ${coach.name} สำเร็จ`,
  }
}

function assocRng(save: GameSave, nation: string, salt: number) {
  const a = save.associations?.[nation]
  const n =
    save.matchday * 997 +
    save.season * 131 +
    (a?.fifaRank ?? 50) * 17 +
    nation.length * 41 +
    salt * 13
  const x = Math.sin(n) * 10000
  return x - Math.floor(x)
}

export type AssocExitKind = 'sacked' | 'resigned'

/** ไล่ / ลาออก — ปลดโค้ชทีมชาติว่างที่นั่ง */
export function removeAssociationCoach(
  save: GameSave,
  nation: string,
  kind: AssocExitKind,
  reason: string,
): { ok: boolean; save: GameSave; message: string; coachName: string | null } {
  const n = normalizeNation(nation) ?? nation
  const assoc = save.associations?.[n]
  if (!assoc?.coachId) return { ok: false, save, message: 'ไม่มีโค้ชให้ปลด', coachName: null }
  const humanSeat = isHumanNtCoachId(assoc.coachId)
  const coach = humanSeat ? null : getWorldCoach(assoc.coachId)
  const coachName = humanSeat ? save.managerName : (coach?.name ?? assoc.coachId)

  const associations = {
    ...save.associations,
    [n]: {
      ...assoc,
      coachId: null,
      wageWeekly: 0,
      form: 10,
      windowsInCharge: 0,
      vacantWindows: 1,
    },
  }

  const title =
    kind === 'sacked'
      ? `${assoc.nameTh} ไล่ ${coachName}`
      : `${coachName} ลาออกจากทีมชาติ${ntTeam(n)?.labelTh ?? n}`

  let next: GameSave = {
    ...save,
    associations,
    career: humanSeat
      ? {
          ...(save.career ?? {
            unemployed: true,
            sackedFromClubId: null,
            sackedSeason: null,
            jobOffers: [],
            clubsManaged: [save.humanClubId],
            lastJobNote: null,
          }),
          nationalNation: null,
          unemployed: true,
          lastJobNote: title,
        }
      : save.career,
    inbox: [
      {
        id: `msg-assoc-exit-${Date.now()}-${n}`,
        date: save.currentDate,
        title,
        body: `${reason} · FIFA #${assoc.fifaRank} · สมาคมจะเปิดรับสมัครโค้ชคนใหม่`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 45),
  }

  next = pushNews(next, {
    id: `news-assoc-exit-${n}-${Date.now()}`,
    date: save.currentDate,
    channel: 'news',
    headline: title,
    body: reason,
    tone: kind === 'sacked' ? 'negative' : 'rumor',
    tags: ['association', kind, n],
    subjectName: coachName,
    outlet: pickOutlet(save, assoc.fifaRank + 3).name,
  } satisfies MediaItem)

  // หลังออกจากทีมชาติ — ถ้ามีคลับว่างอาจรับงานสโมสรทันที
  if (coach) {
    next = placeCoachAtVacantClub(next, coach.id, kind === 'resigned')
  }

  return { ok: true, save: next, message: title, coachName }
}

/** โค้ชว่างจากชาติ → นั่งคลับ AI ที่ว่าง (พลังใกล้เคียงชื่อเสียง) */
export function placeCoachAtVacantClub(
  save: GameSave,
  coachId: string,
  preferResignPath: boolean,
): GameSave {
  const coach = getWorldCoach(coachId)
  if (!coach) return save
  if (save.clubs.some((c) => c.coachId === coachId)) return save
  if (associationCoachIds(save).has(coachId)) return save

  const vacant = save.clubs
    .filter((c) => c.controlledBy === 'ai' && !c.coachId)
    .sort((a, b) => {
      const da = Math.abs(a.reputation / 1.1 - coach.power)
      const db = Math.abs(b.reputation / 1.1 - coach.power)
      return da - db
    })
  if (vacant.length === 0) return save
  // ไม่รับงานคลับทันทีหลังออก — ต้องมีโอกาสชัด + โอกาสต่ำ
  const roll = assocRng(save, vacant[0]!.id, coach.power)
  if (!preferResignPath && roll > 0.22) return save
  if (preferResignPath && roll > 0.55) return save

  const club = vacant[0]!
  const clubs = save.clubs.map((c) => (c.id === club.id ? { ...c, coachId: coach.id } : c))
  const tactics = { ...save.tacticsByClub }
  const t = tactics[club.id]
  if (t) {
    tactics[club.id] = {
      ...t,
      formation: coach.preferredFormation,
      formationOop: coach.formationOop,
      instructions: {
        mentality: coach.mentality,
        pressing: coach.pressing,
        tempo: coach.tempo,
        width: coach.width,
        style:
          coach.style === 'possession'
            ? 'possession'
            : coach.style === 'counter' || coach.style === 'direct' || coach.style === 'low_block'
              ? 'counter'
              : 'balanced',
      },
    }
  }

  let next: GameSave = {
    ...save,
    clubs,
    tacticsByClub: tactics,
    inbox: [
      {
        id: `msg-coach-club-${Date.now()}`,
        date: save.currentDate,
        title: `${coach.name} รับงาน ${club.shortName}`,
        body: `หลังออกจากทีมชาติ — ${club.name} เปิดสัญญาหัวหน้าโค้ช (พลัง ${coach.power})`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 45),
  }
  next = pushNews(next, {
    id: `news-coach-club-${coach.id}-${Date.now()}`,
    date: save.currentDate,
    channel: 'news',
    headline: `${coach.name} ย้ายไปคุม ${club.name}`,
    body: `ตลาดโค้ชเปิด — อดีตโค้ชทีมชาติรับงานสโมสร`,
    tone: 'neutral',
    tags: ['coach', 'club', 'market'],
    subjectName: coach.name,
    outlet: pickOutlet(save, 9).name,
  } satisfies MediaItem)
  return next
}

/** สมาคมไล่ผู้เล่นจากเก้าอี้ทีมชาติเมื่อฟอร์มแย่ต่อเนื่อง */
function maybeExitHumanNtCoach(save: GameSave, nation: string): GameSave {
  const assoc = save.associations?.[nation]
  if (!assoc || !isHumanNtCoachId(assoc.coachId)) return save
  const form = assoc.form ?? 12
  const windows = assoc.windowsInCharge ?? 0
  if (windows < 3) return save

  const topPressure = assoc.fifaRank <= 10
  let sackChance = 0
  const reasons: string[] = []
  if (form <= 7 && windows >= 4) {
    sackChance += 0.2
    reasons.push(`ฟอร์มชาติแย่ (${form}/20)`)
  } else if (form <= 9 && windows >= 5 && topPressure) {
    sackChance += 0.1
    reasons.push(`ท็อป FIFA กดดันหลังผลงานแผ่ว`)
  }
  if (form >= 12) sackChance *= 0.2
  if (form >= 14) sackChance = 0
  if (windows === 3) sackChance *= 0.4

  const r = assocRng(save, nation, 11)
  if (sackChance > 0 && r < sackChance && reasons.length > 0) {
    return removeAssociationCoach(save, nation, 'sacked', reasons.join(' · ')).save
  }
  return save
}

function maybeExitCoach(save: GameSave, nation: string): GameSave {
  const assoc = save.associations?.[nation]
  if (!assoc?.coachId) return save

  // ผู้เล่นคุมชาติ — สมาคมไล่ได้จากฟอร์ม (ไม่ลาออกเองแบบ AI)
  if (isHumanNtCoachId(assoc.coachId)) {
    return maybeExitHumanNtCoach(save, nation)
  }

  const coach = getWorldCoach(assoc.coachId)
  if (!coach) return save

  const tier = fifaTierForRank(assoc.fifaRank)
  const form = assoc.form ?? 12
  const windows = assoc.windowsInCharge ?? 0
  const r1 = assocRng(save, nation, 1)
  const r2 = assocRng(save, nation, 2)

  // ——— เกราะคุ้มกันหลังจ้าง: อย่างน้อย 3 หน้าต่าง FIFA ก่อนมีสิทธิ์ไล่/ลา ———
  // (จ้างมาแล้วออกเลยไม่ได้ — ต้องมีสภาพแวดล้อม/ผลงานก่อน)
  if (windows < 3) return save

  // ความกดดันจากสภาพแวดล้อม
  const budgetTight = assoc.budget < Math.max(assoc.wageWeekly, 50_000) * 24
  const topPressure = assoc.fifaRank <= 10
  const highPressure = assoc.fifaRank <= 20
  const underQualified = coach.power < tier.minCoachPower - 3
  const poorForm = form <= 7
  const mediocreForm = form <= 9
  const solidForm = form >= 12
  const longTenure = windows >= 6

  // ——— ไล่: ต้องมีเหตุผลสะสม ไม่ใช่สุ่ม ———
  let sackChance = 0
  const sackReasons: string[] = []

  if (poorForm && windows >= 4) {
    sackChance += 0.22
    sackReasons.push(`ฟอร์มชาติแย่ต่อเนื่อง (${form}/20)`)
  } else if (mediocreForm && windows >= 5 && topPressure) {
    sackChance += 0.12
    sackReasons.push(`ท็อป FIFA กดดันหลังฟอร์มแผ่ว (${form}/20)`)
  }

  if (underQualified && windows >= 4) {
    sackChance += 0.18
    sackReasons.push(
      `พลังโค้ช ${coach.power} ต่ำกว่ามาตรฐาน FIFA #${assoc.fifaRank} (≥ ${tier.minCoachPower})`,
    )
  }

  if (budgetTight && mediocreForm && windows >= 5) {
    sackChance += 0.1
    sackReasons.push('งบสมาคมตึงและผลงานไม่คุ้ม')
  }

  if (topPressure && form <= 10 && windows >= 5) {
    sackChance += 0.08
  }

  // ฟอร์มดี = แทบไม่ไล่
  if (solidForm) sackChance *= 0.15
  if (form >= 14) sackChance = 0

  // เพิ่งผ่านเกราะ 3 หน้าต่าง — ยังไม่ดุ
  if (windows === 3) sackChance *= 0.4
  if (windows === 4) sackChance *= 0.7

  sackChance = Math.min(0.42, sackChance)

  if (sackChance > 0 && r1 < sackChance && sackReasons.length > 0) {
    return removeAssociationCoach(save, nation, 'sacked', sackReasons.join(' · ')).save
  }

  // ——— ลาออก: ต้องมีแรงจูงใจจากสภาพแวดล้อม ———
  let resignChance = 0
  const resignReasons: string[] = []

  // มีคลับใหญ่ว่างและฟอร์มตัวเองยังโอเค → อาจรับงานคลับ (ไม่ใช่หนีทันที)
  const bigVacant = save.clubs.some(
    (c) =>
      c.controlledBy === 'ai' &&
      !c.coachId &&
      c.reputation >= 72 &&
      Math.abs(c.reputation * 0.45 + 55 - coach.power) <= 12,
  )
  if (bigVacant && solidForm && windows >= 4 && coach.power >= 84) {
    resignChance += 0.1
    resignReasons.push('มีสโมสรใหญ่เปิดเก้าอี้ — อยากกลับงานคลับ')
  }

  if (budgetTight && windows >= 5) {
    resignChance += 0.07
    resignReasons.push('งบสมาคมไม่นิ่ง · ไม่ต่อสัญญา')
  }

  if (coach.adaptability < 62 && poorForm && windows >= 5) {
    resignChance += 0.08
    resignReasons.push('ปรับเข้ากับแรงกดดันทีมชาติไม่ได้')
  }

  if (longTenure && windows >= 8 && coach.power >= 88) {
    resignChance += 0.06
    resignReasons.push(`คุมมานาน ${windows} หน้าต่าง · ต้องการทิศทางใหม่`)
  }

  // ท็อปชาติ + ฟอร์มดี = ภักดีกว่า
  if (topPressure && solidForm) resignChance *= 0.35
  if (highPressure && form >= 13) resignChance *= 0.5
  if (windows < 5) resignChance *= 0.5

  resignChance = Math.min(0.28, resignChance)

  if (resignChance > 0 && r2 < resignChance && resignReasons.length > 0) {
    return removeAssociationCoach(save, nation, 'resigned', resignReasons.join(' · ')).save
  }

  return save
}

function bumpAssocForm(save: GameSave, nation: string): GameSave {
  const assoc = save.associations?.[nation]
  if (!assoc) return save
  const humanSeat = isHumanNtCoachId(assoc.coachId)
  const coach = assoc.coachId && !humanSeat ? getWorldCoach(assoc.coachId) : null
  const r = assocRng(save, nation, 7)

  if (!assoc.coachId) {
    return {
      ...save,
      associations: {
        ...save.associations,
        [nation]: {
          ...assoc,
          vacantWindows: (assoc.vacantWindows ?? 0) + 1,
          form: assoc.form ?? 10,
        },
      },
    }
  }

  let delta = Math.floor(r * 5) - 2 // -2..+2
  if (humanSeat) {
    const rep = save.managerReputation ?? 50
    if (rep >= 70) delta += 1
    if (rep < 40) delta -= 1
    if ((assoc.windowsInCharge ?? 0) < 2) delta = Math.max(-1, delta)
  } else if (coach) {
    if (coach.power >= 90) delta += 1
    if (coach.power < 75) delta -= 1
    // หน้าต่างแรกๆ หลังจ้าง — ฟอร์มไม่พังง่าย (ให้เวลาปรับตัว)
    if ((assoc.windowsInCharge ?? 0) < 2) delta = Math.max(-1, delta)
  }
  const form = Math.max(1, Math.min(20, (assoc.form ?? 12) + delta))
  const windowsInCharge = (assoc.windowsInCharge ?? 0) + 1
  return {
    ...save,
    associations: {
      ...save.associations,
      [nation]: { ...assoc, form, windowsInCharge, vacantWindows: 0 },
    },
  }
}

function tryHireForNation(save: GameSave, nation: string): GameSave {
  const assoc = save.associations?.[nation]
  if (!assoc || assoc.coachId) return save
  const tier = fifaTierForRank(assoc.fifaRank)
  const otherAssoc = associationCoachIds(save)
  const vacantFor = assoc.vacantWindows ?? 0

  // ว่างรอบแรก: จ้างแค่คนว่างในตลาด — ยังไม่ดึงจากคลับ
  const allowPoachClub = vacantFor >= 2

  const scored = allWorldCoaches()
    .filter((c) => !otherAssoc.has(c.id))
    .map((c) => {
      const fromClub = save.clubs.find((cl) => cl.coachId === c.id) ?? null
      if (fromClub?.controlledBy === 'human') return null
      if (fromClub && !allowPoachClub) return null
      const check = canAssociationHire(assoc, c, otherAssoc, fromClub)
      if (!check.ok) return null
      const freeBonus = fromClub ? 0 : 25
      const pref = tier.preferTiers.includes(c.tier) ? 10 : 0
      // ดึงจากคลับต้อง “คุ้ม” จริง — พลังสูงกว่าคนว่างชัด
      const poachPenalty = fromClub ? -8 : 0
      return { coach: c, fromClub, score: c.power + freeBonus + pref + poachPenalty }
    })
    .filter(Boolean) as { coach: WorldCoach; fromClub: Club | null; score: number }[]

  scored.sort((a, b) => b.score - a.score)
  const pick = scored[0]
  if (!pick) return save
  const result = hireAssociationCoach(save, nation, pick.coach.id)
  return result.ok ? result.save : save
}

/**
 * ช่วง FIFA window: อัปเดตฟอร์ม → ไล่/ลาออก → จ้างคนใหม่ถ้าว่าง
 */
export function tickAssociationHiring(save: GameSave): GameSave {
  let next = ensureAssociations(save)
  const nations = Object.keys(next.associations ?? {}).sort(
    (a, b) => next.associations![a]!.fifaRank - next.associations![b]!.fifaRank,
  )

  for (const nation of nations) {
    next = bumpAssocForm(next, nation)
    next = maybeExitCoach(next, nation)
  }
  for (const nation of nations) {
    next = tryHireForNation(next, nation)
  }
  return next
}

export function excludeAssociationCoachesFromClubs(
  clubs: Club[],
  assocCoachIds: Set<string>,
): Club[] {
  return clubs.map((c) =>
    c.coachId && assocCoachIds.has(c.coachId) ? { ...c, coachId: null } : c,
  )
}

export function associationBlurb(assoc: AssociationState, managerName?: string): string {
  const tier = fifaTierForRank(assoc.fifaRank)
  const humanSeat = isHumanNtCoachId(assoc.coachId)
  const coach = assoc.coachId && !humanSeat ? getWorldCoach(assoc.coachId) : null
  const form = assoc.form ?? 12
  const coachLabel = humanSeat
    ? `โค้ช ${managerName ?? 'คุณ'} (ผู้จัดการ · ฟอร์ม ${form}/20 · ${assoc.windowsInCharge ?? 0} หน้าต่าง)`
    : coach
      ? `โค้ช ${coach.name} (พลัง ${coach.power} · ฟอร์ม ${form}/20 · ${assoc.windowsInCharge ?? 0} หน้าต่าง)`
      : 'ยังไม่มีโค้ชทีมชาติ'
  return [
    `${assoc.nameTh} (${assoc.name})`,
    `FIFA #${assoc.fifaRank} · ${tier.labelTh}`,
    `งบ ${assoc.budget.toLocaleString()}`,
    coachLabel,
  ].join(' — ')
}

