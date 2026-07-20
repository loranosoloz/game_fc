/**
 * บทบาท/สไตล์เล่นต่อช่อง (FM-style) — แยกจาก RoleCode (ST/CM/…)
 * ใช้จัดแผน: ใครอยู่ช่องไหน + เล่นแบบไหน
 */
import type { BehavioralVectors, RoleCode, RoleDuty } from './types'

export type TacticalRoleId =
  | 'shot_stopper'
  | 'sweeper_keeper'
  | 'no_nonsense_cb'
  | 'ball_playing_cb'
  | 'cover_cb'
  | 'full_back'
  | 'wing_back'
  | 'inverted_fb'
  | 'anchor'
  | 'destroyer'
  | 'dlp'
  | 'box_to_box'
  | 'mezzala'
  | 'advanced_playmaker'
  | 'shadow_striker'
  | 'winger'
  | 'inside_forward'
  | 'advanced_forward'
  | 'poacher'
  | 'target_man'
  | 'pressing_forward'
  | 'false_nine'
  | 'complete_forward'

export interface TacticalRoleDef {
  id: TacticalRoleId
  /** ช่องตำแหน่งที่ใช้ได้ */
  slots: RoleCode[]
  labelTh: string
  shortTh: string
  duty: RoleDuty
  /** อธิบายหน้าที่สั้นๆ */
  descTh: string
  vectors: BehavioralVectors
}

const v = (partial: Partial<BehavioralVectors>): BehavioralVectors => ({
  forwardRunTendency: 0.3,
  lateralHoldTendency: 0.5,
  centralCutInAttractor: 0.2,
  passingRiskTolerance: 0.45,
  defensiveTrackingDrop: 0.5,
  overlapTendency: 0.2,
  ...partial,
})

export const TACTICAL_ROLES: TacticalRoleDef[] = [
  {
    id: 'shot_stopper',
    slots: ['GK'],
    labelTh: 'นายทวารคุมเขต',
    shortTh: 'เซฟ',
    duty: 'defend',
    descTh: 'ยืนในกรอบ · โฟกัสเซฟและเคลมลูก · ไม่พุ่งออกนอกเขตมาก',
    vectors: v({
      forwardRunTendency: 0.02,
      lateralHoldTendency: 0.95,
      passingRiskTolerance: 0.25,
      defensiveTrackingDrop: 0.05,
    }),
  },
  {
    id: 'sweeper_keeper',
    slots: ['GK'],
    labelTh: 'นายทวารกวาดหลัง',
    shortTh: 'กวาด',
    duty: 'support',
    descTh: 'ออกนอกเขตตัดบอลยาว · ช่วยต่อเกมจากด้านหลัง',
    vectors: v({
      forwardRunTendency: 0.18,
      lateralHoldTendency: 0.7,
      passingRiskTolerance: 0.55,
      defensiveTrackingDrop: 0.15,
    }),
  },
  {
    id: 'no_nonsense_cb',
    slots: ['CB'],
    labelTh: 'เซ็นเตอร์เคลียร์ทิ้ง',
    shortTh: 'เคลียร์',
    duty: 'defend',
    descTh: 'เคลียร์พ้นเขตอันตรายก่อน · ลดการพาสเสี่ยงกลางสนาม',
    vectors: v({
      forwardRunTendency: 0.08,
      lateralHoldTendency: 0.85,
      passingRiskTolerance: 0.25,
      defensiveTrackingDrop: 0.15,
    }),
  },
  {
    id: 'ball_playing_cb',
    slots: ['CB'],
    labelTh: 'เซ็นเตอร์ต่อเกม',
    shortTh: 'ต่อเกม',
    duty: 'support',
    descTh: 'รับบอลจากนายทวาร · ส่งสั้น/ยาวขึ้นหน้า · ช่วยสร้างจังหวะ',
    vectors: v({
      forwardRunTendency: 0.2,
      lateralHoldTendency: 0.65,
      passingRiskTolerance: 0.7,
      defensiveTrackingDrop: 0.25,
    }),
  },
  {
    id: 'cover_cb',
    slots: ['CB'],
    labelTh: 'เซ็นเตอร์คัฟเวอร์',
    shortTh: 'คัฟเวอร์',
    duty: 'defend',
    descTh: 'ยืนลึกกว่าคู่ · ปิดช่องหลังแนวรับ · ไล่กวาดเมื่อคู่พุ่งขึ้น',
    vectors: v({
      forwardRunTendency: 0.05,
      lateralHoldTendency: 0.9,
      passingRiskTolerance: 0.35,
      defensiveTrackingDrop: 0.1,
    }),
  },
  {
    id: 'full_back',
    slots: ['LB', 'RB'],
    labelTh: 'แบ็กซ้อนปีก',
    shortTh: 'แบ็ก',
    duty: 'support',
    descTh: 'ซ้อนขึ้นช่วยปีก · กลับรับทัน · สมดุลรุก/รับ',
    vectors: v({
      forwardRunTendency: 0.55,
      overlapTendency: 0.7,
      lateralHoldTendency: 0.4,
      defensiveTrackingDrop: 0.55,
    }),
  },
  {
    id: 'wing_back',
    slots: ['LB', 'RB'],
    labelTh: 'วิงแบ็กบุกสุดเส้น',
    shortTh: 'วิงแบ็ก',
    duty: 'attack',
    descTh: 'วิ่งขึ้นสุดเส้นบ่อย · ให้ครอส · ใช้ร่างกายหนัก',
    vectors: v({
      forwardRunTendency: 0.85,
      overlapTendency: 0.95,
      lateralHoldTendency: 0.25,
      defensiveTrackingDrop: 0.7,
    }),
  },
  {
    id: 'inverted_fb',
    slots: ['LB', 'RB'],
    labelTh: 'แบ็กตัดเข้าใน',
    shortTh: 'ตัดใน',
    duty: 'support',
    descTh: 'ไม่วิ่งขอบ · ตัดเข้ากลางช่วยครองบอล · เปิดช่องให้ปีก',
    vectors: v({
      forwardRunTendency: 0.4,
      overlapTendency: 0.25,
      centralCutInAttractor: 0.75,
      lateralHoldTendency: 0.35,
      passingRiskTolerance: 0.6,
    }),
  },
  {
    id: 'anchor',
    slots: ['CDM'],
    labelTh: 'สมอหน้าแนวรับ',
    shortTh: 'สมอ',
    duty: 'defend',
    descTh: 'ยืนหน้าเซ็นเตอร์ · ตัดพาส · ไม่บุกเกิน · รักษารูปแบบ',
    vectors: v({
      forwardRunTendency: 0.12,
      lateralHoldTendency: 0.8,
      passingRiskTolerance: 0.35,
      defensiveTrackingDrop: 0.25,
    }),
  },
  {
    id: 'destroyer',
    slots: ['CDM', 'CM'],
    labelTh: 'ตัวทำลายเกม',
    shortTh: 'ทำลาย',
    duty: 'defend',
    descTh: 'ไล่แท็กเกิล · แย่งบอล · ลดการสร้างเกมของตัวเอง',
    vectors: v({
      forwardRunTendency: 0.25,
      lateralHoldTendency: 0.55,
      passingRiskTolerance: 0.3,
      defensiveTrackingDrop: 0.45,
    }),
  },
  {
    id: 'dlp',
    slots: ['CDM', 'CM'],
    labelTh: 'เพลย์เมกเกอร์ลึก',
    shortTh: 'DLP',
    duty: 'support',
    descTh: 'รับบอลลึก · ส่งทะลุช่อง · ควบคุมจังหวะเกม',
    vectors: v({
      forwardRunTendency: 0.22,
      lateralHoldTendency: 0.7,
      passingRiskTolerance: 0.75,
      defensiveTrackingDrop: 0.35,
    }),
  },
  {
    id: 'box_to_box',
    slots: ['CM'],
    labelTh: 'บ็อกซ์ทูบ็อกซ์',
    shortTh: 'B2B',
    duty: 'support',
    descTh: 'วิ่งทั้งรับทั้งรุก · ครบกล่องโทษสองฝั่ง · ใช้ร่างกายเยอะ',
    vectors: v({
      forwardRunTendency: 0.55,
      lateralHoldTendency: 0.4,
      passingRiskTolerance: 0.55,
      defensiveTrackingDrop: 0.55,
    }),
  },
  {
    id: 'mezzala',
    slots: ['CM'],
    labelTh: 'เมซซาลาปีกใน',
    shortTh: 'เมซซาลา',
    duty: 'attack',
    descTh: 'เฉียงขึ้นช่องปีกใน · ยิงจากระยะกลาง · น้อยลงรับ',
    vectors: v({
      forwardRunTendency: 0.7,
      centralCutInAttractor: 0.55,
      lateralHoldTendency: 0.3,
      defensiveTrackingDrop: 0.45,
    }),
  },
  {
    id: 'advanced_playmaker',
    slots: ['CAM', 'CM'],
    labelTh: 'เพลย์เมกเกอร์หน้า',
    shortTh: 'AP',
    duty: 'attack',
    descTh: 'รับระหว่างแนว · ส่งคีย์พาส · ดึงเซ็นเตอร์คู่แข่งออก',
    vectors: v({
      forwardRunTendency: 0.7,
      centralCutInAttractor: 0.6,
      passingRiskTolerance: 0.7,
      defensiveTrackingDrop: 0.4,
    }),
  },
  {
    id: 'shadow_striker',
    slots: ['CAM', 'SS'],
    labelTh: 'เงากองหน้า',
    shortTh: 'เงา',
    duty: 'attack',
    descTh: 'วิ่งตัดหลังแนวรับ · ตามจังหวะสอง · ไม่ดรอปลึก',
    vectors: v({
      forwardRunTendency: 0.85,
      centralCutInAttractor: 0.7,
      defensiveTrackingDrop: 0.3,
    }),
  },
  {
    id: 'winger',
    slots: ['LW', 'RW', 'LM', 'RM'],
    labelTh: 'ปีกวิ่งขอบ',
    shortTh: 'ปีกขอบ',
    duty: 'attack',
    descTh: 'ยืนขอบสนาม · ดริเบิลทะลุ · เปิดครอสเข้ากรอบ',
    vectors: v({
      forwardRunTendency: 0.8,
      overlapTendency: 0.7,
      centralCutInAttractor: 0.15,
      lateralHoldTendency: 0.65,
      defensiveTrackingDrop: 0.4,
    }),
  },
  {
    id: 'inside_forward',
    slots: ['LW', 'RW'],
    labelTh: 'ปีกตัดเข้าใน',
    shortTh: 'ตัดใน',
    duty: 'attack',
    descTh: 'ตัดเข้ากลางยิง/ผ่านบอล · เปิดช่องให้แบ็กซ้อน',
    vectors: v({
      forwardRunTendency: 0.85,
      centralCutInAttractor: 0.9,
      defensiveTrackingDrop: 0.35,
      passingRiskTolerance: 0.5,
    }),
  },
  {
    id: 'advanced_forward',
    slots: ['ST'],
    labelTh: 'กองหน้าบุกกด',
    shortTh: 'บุกกด',
    duty: 'attack',
    descTh: 'กดไล่แนวรับ · วิ่งช่อง · เป็นตัวแรกของเกมรุก',
    vectors: v({
      forwardRunTendency: 0.9,
      centralCutInAttractor: 0.4,
      defensiveTrackingDrop: 0.25,
    }),
  },
  {
    id: 'poacher',
    slots: ['ST'],
    labelTh: 'นักล่าในกรอบ',
    shortTh: 'ล่ากรอบ',
    duty: 'attack',
    descTh: 'ยืนรอในเขตโทษ · โฟกัสจังหวะสุดท้าย · ไม่ดรอปมารับ',
    vectors: v({
      forwardRunTendency: 0.95,
      lateralHoldTendency: 0.35,
      centralCutInAttractor: 0.25,
      defensiveTrackingDrop: 0.1,
      passingRiskTolerance: 0.3,
    }),
  },
  {
    id: 'target_man',
    slots: ['ST'],
    labelTh: 'เป้าหมายรับลูกยาว',
    shortTh: 'เป้าหมาย',
    duty: 'support',
    descTh: 'ยืนประจันหลัง · รับลูกยาว/ครอส · ปัดให้เพื่อนวิ่งตัด',
    vectors: v({
      forwardRunTendency: 0.35,
      lateralHoldTendency: 0.75,
      centralCutInAttractor: 0.2,
      defensiveTrackingDrop: 0.2,
      passingRiskTolerance: 0.45,
    }),
  },
  {
    id: 'pressing_forward',
    slots: ['ST', 'SS'],
    labelTh: 'กองหน้าเพรสแรก',
    shortTh: 'เพรส',
    duty: 'attack',
    descTh: 'เป็นคนแรกไล่เพรส · บังทิศทางนายทวาร/เซ็นเตอร์',
    vectors: v({
      forwardRunTendency: 0.75,
      lateralHoldTendency: 0.4,
      defensiveTrackingDrop: 0.55,
    }),
  },
  {
    id: 'false_nine',
    slots: ['ST', 'SS'],
    labelTh: 'ฟอลส์ไนน์',
    shortTh: 'F9',
    duty: 'support',
    descTh: 'ดรอปมารับกลาง · ดึงเซ็นเตอร์ออก · เปิดช่องปีก/เงาวิ่งตัด',
    vectors: v({
      forwardRunTendency: 0.35,
      centralCutInAttractor: 0.55,
      lateralHoldTendency: 0.45,
      passingRiskTolerance: 0.7,
      defensiveTrackingDrop: 0.35,
    }),
  },
  {
    id: 'complete_forward',
    slots: ['ST'],
    labelTh: 'กองหน้าครบเครื่อง',
    shortTh: 'ครบ',
    duty: 'attack',
    descTh: 'ผสมล่ากรอบ + ดรอปรับ + กดเพรส · ยืดหยุ่นตามจังหวะ',
    vectors: v({
      forwardRunTendency: 0.75,
      centralCutInAttractor: 0.45,
      lateralHoldTendency: 0.45,
      passingRiskTolerance: 0.55,
      defensiveTrackingDrop: 0.35,
    }),
  },
]

export const TACTICAL_ROLE_BY_ID: Record<TacticalRoleId, TacticalRoleDef> =
  Object.fromEntries(TACTICAL_ROLES.map((r) => [r.id, r])) as Record<
    TacticalRoleId,
    TacticalRoleDef
  >

/** ค่าเริ่มต้นต่อช่องตำแหน่ง */
export const DEFAULT_ROLE_FOR_SLOT: Record<RoleCode, TacticalRoleId> = {
  GK: 'shot_stopper',
  CB: 'ball_playing_cb',
  LB: 'full_back',
  RB: 'full_back',
  CDM: 'anchor',
  CM: 'box_to_box',
  CAM: 'advanced_playmaker',
  LM: 'winger',
  RM: 'winger',
  LW: 'inside_forward',
  RW: 'inside_forward',
  ST: 'advanced_forward',
  SS: 'shadow_striker',
}

export function rolesForSlot(slot: RoleCode): TacticalRoleDef[] {
  return TACTICAL_ROLES.filter((r) => r.slots.includes(slot))
}

export function defaultRoleForSlot(slot: RoleCode): TacticalRoleId {
  return DEFAULT_ROLE_FOR_SLOT[slot]
}

export function ensureSlotRoles(
  slots: RoleCode[],
  current?: (TacticalRoleId | null | undefined)[] | null,
): TacticalRoleId[] {
  return slots.map((slot, i) => {
    const prev = current?.[i]
    if (prev && TACTICAL_ROLE_BY_ID[prev]?.slots.includes(slot)) return prev
    return defaultRoleForSlot(slot)
  })
}

export function tacticalRoleLabel(id: TacticalRoleId): string {
  return TACTICAL_ROLE_BY_ID[id]?.labelTh ?? id
}

export function tacticalRoleShort(id: TacticalRoleId): string {
  return TACTICAL_ROLE_BY_ID[id]?.shortTh ?? id
}

export function dutyLabelTh(duty: RoleDuty): string {
  if (duty === 'attack') return 'บุก'
  if (duty === 'defend') return 'รับ'
  return 'ซัพพอร์ต'
}
