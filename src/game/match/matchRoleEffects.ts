/**
 * ผลบทบาทในแมตช์ — ทุก TacticalRoleId มี bias แอ็กชัน / รับบอล / เหนื่อย / คอมเมนต์
 */
import type { RoleCode } from '../types'
import { TACTICAL_ROLE_BY_ID, type TacticalRoleId } from '../tacticalRoles'
import { resolveRoleVectors } from './attractors'

export type MatchActionKind = 'pass' | 'dribble' | 'shoot'

export interface RoleMatchEffects {
  /** คูณ utility แอ็กชัน */
  pass: number
  dribble: number
  shoot: number
  /** ชอบรับบอลเมื่อลึก/กว้าง/กลาง */
  receiveDeep: number
  receiveWide: number
  receiveCentral: number
  /** ชอบเป็นผู้ครองบอลใกล้ลูก */
  carryBall: number
  /** คูณความหนัก fatigue */
  fatigue: number
  /** คอมเมนต์สั้นเมื่อบทบาทเด่น */
  noteTh?: string
}

const E = (partial: Partial<RoleMatchEffects>): RoleMatchEffects => ({
  pass: 1,
  dribble: 1,
  shoot: 1,
  receiveDeep: 1,
  receiveWide: 1,
  receiveCentral: 1,
  carryBall: 1,
  fatigue: 1,
  ...partial,
})

/** ตารางผลต่อบทบาท — ครบทุก id ในแคตตาล็อก */
export const ROLE_MATCH_EFFECTS: Record<TacticalRoleId, RoleMatchEffects> = {
  shot_stopper: E({
    pass: 0.85,
    dribble: 0.4,
    shoot: 0.2,
    carryBall: 0.35,
    fatigue: 0.45,
    noteTh: 'คุมเขต',
  }),
  sweeper_keeper: E({
    pass: 1.15,
    dribble: 0.55,
    shoot: 0.2,
    carryBall: 0.55,
    fatigue: 0.55,
    noteTh: 'กวาดหลัง',
  }),
  no_nonsense_cb: E({
    pass: 0.82,
    dribble: 0.55,
    shoot: 0.35,
    receiveDeep: 0.7,
    fatigue: 0.75,
    noteTh: 'เคลียร์ทิ้ง',
  }),
  ball_playing_cb: E({
    pass: 1.22,
    dribble: 0.75,
    shoot: 0.4,
    receiveDeep: 0.85,
    fatigue: 0.8,
    noteTh: 'ต่อเกมจากหลัง',
  }),
  cover_cb: E({
    pass: 0.9,
    dribble: 0.6,
    shoot: 0.3,
    receiveDeep: 0.65,
    fatigue: 0.72,
    noteTh: 'คัฟเวอร์ลึก',
  }),
  full_back: E({
    pass: 1.05,
    dribble: 1.05,
    shoot: 0.55,
    receiveWide: 1.2,
    receiveDeep: 0.85,
    fatigue: 1.05,
    noteTh: 'ซ้อนปีก',
  }),
  wing_back: E({
    pass: 1.0,
    dribble: 1.2,
    shoot: 0.7,
    receiveWide: 1.35,
    receiveDeep: 1.15,
    fatigue: 1.35,
    noteTh: 'วิงแบ็กสุดเส้น',
  }),
  inverted_fb: E({
    pass: 1.18,
    dribble: 0.95,
    shoot: 0.55,
    receiveWide: 0.75,
    receiveCentral: 1.3,
    fatigue: 1.0,
    noteTh: 'แบ็กตัดเข้าใน',
  }),
  anchor: E({
    pass: 0.95,
    dribble: 0.7,
    shoot: 0.4,
    receiveDeep: 0.75,
    receiveCentral: 1.1,
    fatigue: 0.85,
    noteTh: 'สมอหน้าแนวรับ',
  }),
  destroyer: E({
    pass: 0.85,
    dribble: 0.8,
    shoot: 0.45,
    receiveDeep: 0.8,
    fatigue: 1.15,
    noteTh: 'ทำลายเกม',
  }),
  dlp: E({
    pass: 1.35,
    dribble: 0.85,
    shoot: 0.55,
    receiveCentral: 1.2,
    receiveDeep: 0.9,
    carryBall: 1.15,
    fatigue: 0.9,
    noteTh: 'เพลย์เมกเกอร์ลึก',
  }),
  box_to_box: E({
    pass: 1.05,
    dribble: 1.05,
    shoot: 0.95,
    receiveDeep: 1.1,
    receiveCentral: 1.1,
    fatigue: 1.4,
    noteTh: 'บ็อกซ์ทูบ็อกซ์',
  }),
  mezzala: E({
    pass: 1.1,
    dribble: 1.15,
    shoot: 1.15,
    receiveWide: 1.15,
    receiveDeep: 1.2,
    fatigue: 1.2,
    noteTh: 'เมซซาลาปีกใน',
  }),
  advanced_playmaker: E({
    pass: 1.4,
    dribble: 1.05,
    shoot: 0.9,
    receiveCentral: 1.35,
    receiveDeep: 1.15,
    carryBall: 1.2,
    fatigue: 1.0,
    noteTh: 'เพลย์เมกเกอร์หน้า',
  }),
  shadow_striker: E({
    pass: 0.95,
    dribble: 1.1,
    shoot: 1.35,
    receiveDeep: 1.4,
    receiveCentral: 1.2,
    fatigue: 1.1,
    noteTh: 'เงากองหน้าตัดหลัง',
  }),
  winger: E({
    pass: 1.05,
    dribble: 1.35,
    shoot: 0.85,
    receiveWide: 1.45,
    receiveDeep: 1.15,
    fatigue: 1.25,
    noteTh: 'ปีกวิ่งขอบ',
  }),
  inside_forward: E({
    pass: 1.0,
    dribble: 1.25,
    shoot: 1.25,
    receiveWide: 1.1,
    receiveCentral: 1.35,
    receiveDeep: 1.25,
    fatigue: 1.2,
    noteTh: 'ปีกตัดเข้าใน',
  }),
  advanced_forward: E({
    pass: 0.95,
    dribble: 1.1,
    shoot: 1.3,
    receiveDeep: 1.35,
    fatigue: 1.2,
    noteTh: 'กองหน้าบุกกด',
  }),
  poacher: E({
    pass: 0.7,
    dribble: 0.85,
    shoot: 1.55,
    receiveDeep: 1.55,
    receiveWide: 0.75,
    receiveCentral: 1.2,
    fatigue: 0.85,
    noteTh: 'นักล่าในกรอบ',
  }),
  target_man: E({
    pass: 1.15,
    dribble: 0.65,
    shoot: 1.1,
    receiveDeep: 1.25,
    receiveCentral: 1.3,
    carryBall: 0.9,
    fatigue: 0.95,
    noteTh: 'เป้าหมายรับลูกยาว',
  }),
  pressing_forward: E({
    pass: 0.9,
    dribble: 1.0,
    shoot: 1.15,
    receiveDeep: 1.15,
    fatigue: 1.35,
    noteTh: 'เพรสแรก',
  }),
  false_nine: E({
    pass: 1.3,
    dribble: 1.1,
    shoot: 0.95,
    receiveDeep: 0.85,
    receiveCentral: 1.4,
    carryBall: 1.25,
    fatigue: 1.05,
    noteTh: 'ฟอลส์ไนน์ดรอป',
  }),
  complete_forward: E({
    pass: 1.1,
    dribble: 1.1,
    shoot: 1.25,
    receiveDeep: 1.25,
    receiveCentral: 1.15,
    fatigue: 1.15,
    noteTh: 'กองหน้าครบเครื่อง',
  }),
}

export function roleEffectsFor(
  roleCode: RoleCode,
  tacticalRoleId?: string | null,
): RoleMatchEffects {
  if (tacticalRoleId && tacticalRoleId in ROLE_MATCH_EFFECTS) {
    const def = TACTICAL_ROLE_BY_ID[tacticalRoleId as TacticalRoleId]
    if (!def || def.slots.includes(roleCode) || roleCode === 'SS') {
      return ROLE_MATCH_EFFECTS[tacticalRoleId as TacticalRoleId]
    }
  }
  // fallback จากเวกเตอร์บทบาทช่อง
  const v = resolveRoleVectors(roleCode, tacticalRoleId).vectors
  return E({
    pass: 0.85 + v.passingRiskTolerance * 0.4,
    dribble: 0.75 + v.forwardRunTendency * 0.35,
    shoot: 0.7 + v.forwardRunTendency * 0.45,
    receiveDeep: 0.8 + v.forwardRunTendency * 0.4,
    receiveWide: 0.85 + v.overlapTendency * 0.35,
    receiveCentral: 0.85 + v.centralCutInAttractor * 0.4,
    fatigue: 0.7 + v.forwardRunTendency * 0.45 + v.overlapTendency * 0.25,
  })
}

export function applyRoleToActionU(
  kind: MatchActionKind,
  baseU: number,
  roleCode: RoleCode,
  tacticalRoleId?: string | null,
): number {
  const e = roleEffectsFor(roleCode, tacticalRoleId)
  const mul = kind === 'pass' ? e.pass : kind === 'dribble' ? e.dribble : e.shoot
  return baseU * mul
}

/** คะแนนว่า mate เหมาะรับลูกจาก carrier ตามบทบาททั้งคู่ */
export function roleReceiveScore(
  carrierRoleId: string | null | undefined,
  mateRole: RoleCode,
  mateRoleId: string | null | undefined,
  mateProg: number,
  mateWide: number,
): number {
  const mateE = roleEffectsFor(mateRole, mateRoleId)
  let s = 1
  if (mateProg > 70) s *= mateE.receiveDeep
  else if (mateProg < 45) s *= 0.85 + (1 - mateE.receiveDeep) * 0.3
  if (mateWide > 28) s *= mateE.receiveWide
  else s *= mateE.receiveCentral

  // Carrier ชอบหาเป้าเฉพาะ
  if (carrierRoleId === 'dlp' || carrierRoleId === 'advanced_playmaker' || carrierRoleId === 'false_nine') {
    if (mateRoleId === 'poacher' || mateRoleId === 'shadow_striker' || mateRole === 'ST') s *= 1.18
    if (mateRoleId === 'winger' || mateRoleId === 'inside_forward') s *= 1.1
  }
  if (carrierRoleId === 'target_man' || carrierRoleId === 'ball_playing_cb') {
    if (mateRoleId === 'advanced_forward' || mateRoleId === 'poacher' || mateRoleId === 'winger')
      s *= 1.15
  }
  if (carrierRoleId === 'winger' || carrierRoleId === 'wing_back') {
    if (mateRoleId === 'target_man' || mateRoleId === 'poacher' || mateRole === 'ST') s *= 1.2
  }
  return s
}

export function roleCarryWeight(
  roleCode: RoleCode,
  tacticalRoleId?: string | null,
): number {
  return roleEffectsFor(roleCode, tacticalRoleId).carryBall
}

export function roleFatigueMul(
  roleCode: RoleCode,
  tacticalRoleId?: string | null,
): number {
  return roleEffectsFor(roleCode, tacticalRoleId).fatigue
}

export function roleActionNote(
  roleCode: RoleCode,
  tacticalRoleId: string | null | undefined,
  kind: MatchActionKind,
): string | null {
  const e = roleEffectsFor(roleCode, tacticalRoleId)
  if (!e.noteTh) return null
  if (kind === 'shoot' && e.shoot >= 1.2) return e.noteTh
  if (kind === 'pass' && e.pass >= 1.15) return e.noteTh
  if (kind === 'dribble' && e.dribble >= 1.2) return e.noteTh
  return null
}

/** ข้อความพาสตามบทบาท — ให้ฟีดอ่านรู้ว่า AI จ่ายทำไม */
export function rolePassLine(
  fromName: string,
  toName: string,
  carrierRoleId: string | null | undefined,
  passDist: number,
): string {
  const long = passDist >= 26
  switch (carrierRoleId) {
    case 'dlp':
      return long
        ? `${fromName} (DLP) ส่งยาวทะลุหา ${toName}`
        : `${fromName} (DLP) หมุนเกมสั้นหา ${toName}`
    case 'advanced_playmaker':
      return `${fromName} (AP) เจาะช่องหา ${toName}`
    case 'ball_playing_cb':
      return long
        ? `${fromName} (BPC) ต่อเกมจากหลังหา ${toName}`
        : `${fromName} (BPC) ออกบอลสั้นหา ${toName}`
    case 'target_man':
      return `${fromName} (Target) ปาด/ผ่อนลูกหา ${toName}`
    case 'false_nine':
      return `${fromName} (F9) ดรอปแล้วจ่ายหา ${toName}`
    case 'winger':
    case 'wing_back':
      return long
        ? `${fromName} เปิดบอลปีกหา ${toName}`
        : `${fromName} ส่งตัดเข้าในหา ${toName}`
    case 'box_to_box':
      return `${fromName} (B2B) ส่งต่อจังหวะหา ${toName}`
    case 'anchor':
      return `${fromName} (Anchor) กระจายบอลหา ${toName}`
    case 'sweeper_keeper':
      return `${fromName} (SK) เปิดเกมสั้นหา ${toName}`
    default:
      return long
        ? `${fromName} ส่งยาวหา ${toName}`
        : `${fromName} จ่ายสั้นหา ${toName}`
  }
}

/** ชอบบังคับพาสตอนสร้างเกม (ไม่ใช่โซนยิง) */
export function roleWantsBuildPass(tacticalRoleId?: string | null): boolean {
  if (!tacticalRoleId) return false
  return (
    tacticalRoleId === 'dlp' ||
    tacticalRoleId === 'advanced_playmaker' ||
    tacticalRoleId === 'ball_playing_cb' ||
    tacticalRoleId === 'false_nine' ||
    tacticalRoleId === 'anchor' ||
    tacticalRoleId === 'mezzala' ||
    tacticalRoleId === 'inverted_fb' ||
    tacticalRoleId === 'sweeper_keeper'
  )
}

/** ข้อความดริบเบิลตามบทบาท */
export function roleDribbleLine(
  name: string,
  tacticalRoleId: string | null | undefined,
  ok: boolean,
): string {
  if (!ok) return `${name} พาลูกหลุด · เสียจังหวะ`
  switch (tacticalRoleId) {
    case 'winger':
      return `${name} (Winger) พาลูกขอบเส้นทะลุ`
    case 'inside_forward':
      return `${name} (IF) ตัดเข้าในพร้อมลูก`
    case 'wing_back':
      return `${name} (WB) ซ้อนสูงพาลูก`
    case 'advanced_forward':
    case 'complete_forward':
      return `${name} พาลูกกดลึก`
    case 'box_to_box':
      return `${name} (B2B) อุ้มลูกทะลุกลาง`
    case 'mezzala':
      return `${name} (Mezzala) พาลูกเฉียง`
    default:
      return `${name} พาลูกไปข้างหน้า`
  }
}

/** โน้ตสร้างเกมตามโซน — ให้ฟีดแน่นขึ้น */
export function rolePhaseNote(
  name: string,
  tacticalRoleId: string | null | undefined,
  prog: number,
  pressure: number,
): string | null {
  if (pressure > 1.4 && prog < 55) {
    return `${name} โดนกด · พยายามหมุนเกม`
  }
  if (prog < 35) {
    if (tacticalRoleId === 'ball_playing_cb' || tacticalRoleId === 'sweeper_keeper') {
      return `${name} สร้างจากแดนหลัง`
    }
    return `${name} ออกจากเขตตัวเอง`
  }
  if (prog >= 35 && prog < 58) {
    if (roleWantsBuildPass(tacticalRoleId)) {
      return `${name} คุมจังหวะกลางสนาม`
    }
    return null
  }
  if (prog >= 70 && prog < 82) {
    return `${name} เข้าโซนอันตราย`
  }
  return null
}
