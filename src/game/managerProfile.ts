import type {
  FormationId,
  Mentality,
  Pressing,
  Tempo,
  Width,
  TeamInstructions,
} from './types'
import { ALL_FORMATIONS } from './types'
import {
  coachStyleToPlayStyle,
  styleLabelTh,
  type CoachStyleId,
} from './worldCoaches'
import coachesDb from '@/data/worldCoaches.json'
import assocDb from '@/data/associations.json'
import ntDb from '@/data/nationalTeams.json'

const STYLE_META = coachesDb.styles as Record<
  string,
  { labelTh: string; beats: string[]; losesTo: string[] }
>

export type ManagerBackground = 'ex_pro' | 'academy' | 'analyst' | 'journeyman'

/**
 * แอตทริบิวต์ผู้จัดการแบบ FM (1–20)
 * — ภาษา/สื่อสารตามสัญชาติ: เก็บ nation ไว้ก่อน ดิเทลคุยกับนักเตะค่อยใส่ทีหลัง
 */
export type ManagerAttrKey =
  | 'attacking'
  | 'defending'
  | 'fitness'
  | 'mental'
  | 'tactical'
  | 'technical'
  | 'setPieces'
  | 'workingWithYoungsters'
  | 'adaptability'
  | 'determination'
  | 'discipline'
  | 'manManagement'
  | 'motivating'
  | 'tacticalKnowledge'
  | 'judgingAbility'
  | 'judgingPotential'

export const MANAGER_ATTR_KEYS: ManagerAttrKey[] = [
  'attacking',
  'defending',
  'fitness',
  'mental',
  'tactical',
  'technical',
  'setPieces',
  'workingWithYoungsters',
  'adaptability',
  'determination',
  'discipline',
  'manManagement',
  'motivating',
  'tacticalKnowledge',
  'judgingAbility',
  'judgingPotential',
]

export type ManagerAttrs = Record<ManagerAttrKey, number>

export const MANAGER_ATTR_META: Record<
  ManagerAttrKey,
  { labelTh: string; group: 'coaching' | 'mental' | 'judging'; blurb: string }
> = {
  attacking: { labelTh: 'โจมตี', group: 'coaching', blurb: 'โค้ชเกมรุก · สร้างโอกาส' },
  defending: { labelTh: 'รับ', group: 'coaching', blurb: 'โครงสร้างรับ · มาร์ก · แทคเกิล' },
  fitness: { labelTh: 'ฟิตเนส', group: 'coaching', blurb: 'สภาพร่างกาย · ความอึดของทีม' },
  mental: { labelTh: 'เมนทัล (โค้ช)', group: 'coaching', blurb: 'สมาธิ · ตัดสินใจภายใต้กดดัน' },
  tactical: { labelTh: 'แทคติก', group: 'coaching', blurb: 'วางแผน · รูปขบวน · บทบาท' },
  technical: { labelTh: 'เทคนิค', group: 'coaching', blurb: 'สัมผัสบอล · ทักษะรายบุคคล' },
  setPieces: { labelTh: 'ลูกตั้งเตะ', group: 'coaching', blurb: 'มุม · ฟรีคิก · ลูกโทษ' },
  workingWithYoungsters: {
    labelTh: 'ทำงานกับเยาวชน',
    group: 'coaching',
    blurb: 'พัฒนาเด็ก · อะคาเดมี',
  },
  adaptability: { labelTh: 'ปรับตัว', group: 'mental', blurb: 'เข้ากับลีก/วัฒนธรรมใหม่' },
  determination: { labelTh: 'ความมุ่งมั่น', group: 'mental', blurb: 'ไม่ยอมแพ้ · ดันทีมต่อ' },
  discipline: { labelTh: 'วินัย', group: 'mental', blurb: 'มาตรฐานในห้องแต่งตัว' },
  manManagement: { labelTh: 'จัดการคน', group: 'mental', blurb: 'ความสัมพันธ์ · บทบาทในทีม' },
  motivating: { labelTh: 'สร้างแรงจูงใจ', group: 'mental', blurb: 'ทีมทอล์ค · ปลุกใจ' },
  tacticalKnowledge: {
    labelTh: 'ความรู้แทคติก',
    group: 'mental',
    blurb: 'อ่านเกม · แก้แผนระหว่างแมตช์',
  },
  judgingAbility: {
    labelTh: 'ประเมินความสามารถ',
    group: 'judging',
    blurb: 'อ่าน CA นักเตะปัจจุบัน',
  },
  judgingPotential: {
    labelTh: 'ประเมินศักยภาพ',
    group: 'judging',
    blurb: 'อ่าน PA / อนาคตนักเตะ',
  },
}

export const ATTR_MIN = 1
export const ATTR_MAX = 20
export const ATTR_BASE = 8

export type ManagerNationOption = {
  id: string
  name: string
  nameTh: string
}

export function listManagerNations(): ManagerNationOption[] {
  const teams = ntDb.teams as Record<string, { labelTh: string }>
  const assoc = assocDb.associations as Record<
    string,
    { name: string; nameTh: string; fifaRank: number }
  >
  const out: ManagerNationOption[] = []
  const seen = new Set<string>()
  for (const [id, a] of Object.entries(assoc)) {
    seen.add(id)
    out.push({
      id,
      name: id,
      nameTh: teams[id]?.labelTh ?? a.nameTh,
    })
  }
  for (const [id, t] of Object.entries(teams)) {
    if (seen.has(id)) continue
    out.push({ id, name: id, nameTh: t.labelTh })
  }
  return out.sort((a, b) => a.nameTh.localeCompare(b.nameTh, 'th'))
}

export interface ManagerProfile {
  background: ManagerBackground
  nation: string
  nationTh: string
  /** stub — ระบบภาษา/สื่อสารค่อยใส่ทีหลัง */
  languages?: string[]
  style: CoachStyleId
  styleLabelTh: string
  preferredFormation: FormationId
  formationOop: FormationId
  mentality: Mentality
  pressing: Pressing
  tempo: Tempo
  width: Width
  attrs: ManagerAttrs
  attackingIQ: number
  defendingIQ: number
  manManagement: number
  adaptability: number
  power: number
  strongVs: string[]
  weakVs: string[]
  solveGame: string[]
}

export interface ManagerBuildInput {
  background: ManagerBackground
  nation: string
  style: CoachStyleId
  preferredFormation: FormationId
  attrs: ManagerAttrs
}

export const MANAGER_BACKGROUNDS: Record<
  ManagerBackground,
  {
    labelTh: string
    blurb: string
    repBonus: number
    attrPoints: number
    baseBoost: Partial<ManagerAttrs>
  }
> = {
  ex_pro: {
    labelTh: 'อดีตนักเตะอาชีพ',
    blurb: 'ห้องแต่งตัวเชื่อ · ชื่อเสียงเริ่มสูง · จัดการคนเก่ง',
    repBonus: 8,
    attrPoints: 48,
    baseBoost: { manManagement: 2, motivating: 2, determination: 1 },
  },
  academy: {
    labelTh: 'เส้นทางโค้ชเยาวชน',
    blurb: 'พัฒนาคนเก่ง · ชื่อเสียงเริ่มกลาง · ปรับแผนได้',
    repBonus: 0,
    attrPoints: 52,
    baseBoost: { workingWithYoungsters: 3, adaptability: 1, judgingPotential: 1 },
  },
  analyst: {
    labelTh: 'นักวิเคราะห์ / โค้ชวิดีโอ',
    blurb: 'อ่านเกมคม · แทคติก/เทคนิคเด่น · ชื่อเสียงเริ่มต่ำกว่า',
    repBonus: -4,
    attrPoints: 54,
    baseBoost: { tactical: 2, tacticalKnowledge: 2, technical: 1 },
  },
  journeyman: {
    labelTh: 'โค้ชเร่ร่อนหลายคลับ',
    blurb: 'สมดุล · เคยเจอหลายสภาพแวดล้อม',
    repBonus: 2,
    attrPoints: 50,
    baseBoost: { adaptability: 2, determination: 1 },
  },
}

export const MANAGER_STYLES: Array<{
  id: CoachStyleId
  labelTh: string
  blurb: string
  mentality: Mentality
  pressing: Pressing
  tempo: Tempo
  width: Width
  solveGame: string[]
  formation: FormationId
  formationOop: FormationId
}> = [
  {
    id: 'press',
    labelTh: 'เพรสสูง',
    blurb: 'กดสูง · แย่งคืนเร็ว · เกมเร็ว',
    mentality: 'attacking',
    pressing: 'high',
    tempo: 'fast',
    width: 'wide',
    solveGame: ['gegenpress', 'transitions'],
    formation: '4-3-3',
    formationOop: '4-2-3-1',
  },
  {
    id: 'possession',
    labelTh: 'ครองบอล',
    blurb: 'ครองเกม · สร้างจากหลัง · โอเวอร์โหลด',
    mentality: 'attacking',
    pressing: 'high',
    tempo: 'normal',
    width: 'wide',
    solveGame: ['positional', 'build_up', 'overloads'],
    formation: '4-3-3',
    formationOop: '4-2-3-1',
  },
  {
    id: 'counter',
    labelTh: 'โต้กลับ',
    blurb: 'ตั้งรับแล้วพุ่ง · เปลี่ยนเกมคม',
    mentality: 'balanced',
    pressing: 'medium',
    tempo: 'fast',
    width: 'narrow',
    solveGame: ['transitions', 'vertical'],
    formation: '4-2-3-1',
    formationOop: '4-4-2',
  },
  {
    id: 'low_block',
    labelTh: 'ตั้งรับแน่น',
    blurb: 'บล็อกต่ำ · รอจังหวะ · ลูกตั้งเตะ',
    mentality: 'defensive',
    pressing: 'low',
    tempo: 'slow',
    width: 'narrow',
    solveGame: ['low_block', 'set_pieces'],
    formation: '4-4-2',
    formationOop: '4-4-2',
  },
  {
    id: 'direct',
    labelTh: 'ตรง ๆ / ยาว',
    blurb: 'เล่นตรง · ฟิสิกส์ · เปิดปีก',
    mentality: 'balanced',
    pressing: 'medium',
    tempo: 'fast',
    width: 'wide',
    solveGame: ['direct', 'wing_play', 'chaos'],
    formation: '4-4-2',
    formationOop: '4-3-3',
  },
  {
    id: 'balanced',
    labelTh: 'สมดุล',
    blurb: 'ยืดหยุ่น · ไม่สุดโต่งด้านใดด้านหนึ่ง',
    mentality: 'balanced',
    pressing: 'medium',
    tempo: 'normal',
    width: 'normal',
    solveGame: ['control', 'man_management'],
    formation: '4-2-3-1',
    formationOop: '4-3-3',
  },
]

const FORMATIONS = ALL_FORMATIONS

function clampAttr(n: number) {
  return Math.max(ATTR_MIN, Math.min(ATTR_MAX, Math.round(n)))
}

function clampPower(n: number, lo = 55, hi = 94) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function baseAttrsForBackground(bg: ManagerBackground): ManagerAttrs {
  const boost = MANAGER_BACKGROUNDS[bg].baseBoost
  const out = {} as ManagerAttrs
  for (const key of MANAGER_ATTR_KEYS) {
    out[key] = clampAttr(ATTR_BASE + (boost[key] ?? 0))
  }
  return out
}

export function sumAttrs(attrs: ManagerAttrs): number {
  return MANAGER_ATTR_KEYS.reduce((s, k) => s + attrs[k], 0)
}

export function attrPointBudget(bg: ManagerBackground): number {
  return sumAttrs(baseAttrsForBackground(bg)) + MANAGER_BACKGROUNDS[bg].attrPoints
}

export function remainingAttrPoints(bg: ManagerBackground, attrs: ManagerAttrs): number {
  return attrPointBudget(bg) - sumAttrs(attrs)
}

export function defaultManagerBuild(): ManagerBuildInput {
  const background: ManagerBackground = 'academy'
  return {
    background,
    nation: 'Thailand',
    style: 'balanced',
    preferredFormation: '4-2-3-1',
    attrs: baseAttrsForBackground(background),
  }
}

export function adjustManagerAttr(
  build: ManagerBuildInput,
  key: ManagerAttrKey,
  delta: number,
): ManagerBuildInput {
  const cur = build.attrs[key]
  if (delta > 0) {
    const remain = remainingAttrPoints(build.background, build.attrs)
    if (remain <= 0) return build
    const spend = Math.min(delta, remain, ATTR_MAX - cur)
    if (spend <= 0) return build
    return { ...build, attrs: { ...build.attrs, [key]: cur + spend } }
  }
  const drop = Math.min(-delta, cur - ATTR_MIN)
  if (drop <= 0) return build
  return { ...build, attrs: { ...build.attrs, [key]: cur - drop } }
}

export function setManagerBackground(
  build: ManagerBuildInput,
  background: ManagerBackground,
): ManagerBuildInput {
  return {
    ...build,
    background,
    attrs: baseAttrsForBackground(background),
  }
}

function attrToMatchStat(...parts: number[]): number {
  const avg = parts.reduce((a, b) => a + b, 0) / parts.length
  return clampPower(48 + avg * 2.2, 50, 96)
}

export function buildManagerProfile(input: ManagerBuildInput): ManagerProfile {
  const stylePreset =
    MANAGER_STYLES.find((s) => s.id === input.style) ?? MANAGER_STYLES[5]!
  const meta = STYLE_META[input.style]
  const nations = listManagerNations()
  const nationOpt =
    nations.find((n) => n.id === input.nation) ??
    nations.find((n) => n.id === 'Thailand') ??
    nations[0]!

  let attrs = { ...input.attrs }
  for (const k of MANAGER_ATTR_KEYS) {
    attrs[k] = clampAttr(attrs[k] ?? ATTR_BASE)
  }
  let remain = remainingAttrPoints(input.background, attrs)
  while (remain < 0) {
    const richest = [...MANAGER_ATTR_KEYS].sort((a, b) => attrs[b] - attrs[a])[0]!
    if (attrs[richest] <= ATTR_MIN) break
    attrs[richest] -= 1
    remain += 1
  }

  const attackingIQ = attrToMatchStat(attrs.attacking, attrs.tactical, attrs.technical)
  const defendingIQ = attrToMatchStat(attrs.defending, attrs.tactical, attrs.fitness)
  const manManagement = attrToMatchStat(
    attrs.manManagement,
    attrs.motivating,
    attrs.discipline,
  )
  const adaptability = attrToMatchStat(
    attrs.adaptability,
    attrs.tacticalKnowledge,
    attrs.determination,
  )
  const power = clampPower(
    (attackingIQ + defendingIQ + manManagement + adaptability) / 4 +
      attrs.tacticalKnowledge * 0.15,
    58,
    94,
  )

  const formation = FORMATIONS.includes(input.preferredFormation)
    ? input.preferredFormation
    : stylePreset.formation

  return {
    background: input.background,
    nation: nationOpt.id,
    nationTh: nationOpt.nameTh,
    languages: [nationOpt.id],
    style: input.style,
    styleLabelTh: stylePreset.labelTh,
    preferredFormation: formation,
    formationOop: stylePreset.formationOop,
    mentality: stylePreset.mentality,
    pressing: stylePreset.pressing,
    tempo: stylePreset.tempo,
    width: stylePreset.width,
    attrs,
    attackingIQ,
    defendingIQ,
    manManagement,
    adaptability,
    power,
    strongVs: meta?.beats?.slice(0, 2) ?? [],
    weakVs: meta?.losesTo?.slice(0, 2) ?? [],
    solveGame: stylePreset.solveGame,
  }
}

export function ensureManagerProfile(
  profile: ManagerProfile | null | undefined,
): ManagerProfile {
  if (profile?.attrs && profile.style && profile.nation) {
    const attrs = { ...baseAttrsForBackground(profile.background ?? 'academy') }
    for (const k of MANAGER_ATTR_KEYS) {
      if (typeof profile.attrs[k] === 'number') attrs[k] = clampAttr(profile.attrs[k])
    }
    return {
      ...profile,
      attrs,
      nationTh: profile.nationTh || profile.nation,
    }
  }
  if (profile?.style && profile.power) {
    const bg = profile.background ?? 'academy'
    const attrs = baseAttrsForBackground(bg)
    const map = (v: number) => clampAttr(Math.round(((v ?? 70) - 48) / 2.2))
    attrs.attacking = map(profile.attackingIQ)
    attrs.defending = map(profile.defendingIQ)
    attrs.manManagement = map(profile.manManagement)
    attrs.adaptability = map(profile.adaptability)
    attrs.tactical = clampAttr(Math.round((attrs.attacking + attrs.defending) / 2))
    attrs.tacticalKnowledge = attrs.tactical
    return buildManagerProfile({
      background: bg,
      nation: profile.nation ?? 'Thailand',
      style: profile.style,
      preferredFormation: profile.preferredFormation ?? '4-2-3-1',
      attrs,
    })
  }
  return buildManagerProfile(defaultManagerBuild())
}

export function instructionsFromManager(profile: ManagerProfile): TeamInstructions {
  return {
    mentality: profile.mentality,
    pressing: profile.pressing,
    tempo: profile.tempo,
    width: profile.width,
    style: coachStyleToPlayStyle(profile.style),
  }
}

export function managerBlurb(profile: ManagerProfile): string {
  const bg = MANAGER_BACKGROUNDS[profile.background]?.labelTh ?? profile.background
  const top = [...MANAGER_ATTR_KEYS]
    .sort((a, b) => profile.attrs[b] - profile.attrs[a])
    .slice(0, 3)
    .map((k) => `${MANAGER_ATTR_META[k].labelTh} ${profile.attrs[k]}`)
    .join(' · ')
  return [
    `${profile.nationTh} · ${bg} · ${profile.styleLabelTh || styleLabelTh(profile.style)}`,
    `แผน ${profile.preferredFormation} · พลัง ~${profile.power}`,
    top,
  ]
    .filter(Boolean)
    .join(' — ')
}

export function startingReputationFromProfile(
  clubRep: number,
  profile: ManagerProfile,
): number {
  const bg = MANAGER_BACKGROUNDS[profile.background]?.repBonus ?? 0
  return Math.max(
    28,
    Math.min(78, Math.round(42 + clubRep / 6 + bg + (profile.power - 72) * 0.35)),
  )
}

export function attrsByGroup(group: 'coaching' | 'mental' | 'judging'): ManagerAttrKey[] {
  return MANAGER_ATTR_KEYS.filter((k) => MANAGER_ATTR_META[k].group === group)
}
