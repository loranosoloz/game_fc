/**
 * Dynamic IP / OOP shapes — ฟอเมชั่นฐาน + เมทริกซ์พิกัดแยกตอนบุก/รับ
 * Slot index ตรงกับ FORMATION_SLOTS / FORMATION_ANCHORS ของแผนนั้น
 */
import type { FormationId, RoleCode } from '../types'
import { FORMATION_ANCHORS, type AnchorPoint } from './formationAnchors'

function a(role: RoleCode, x: number, y: number): AnchorPoint {
  return { role, x, y }
}

/**
 * In-possession morphs (เช่น 4-3-3 → 3-2-4-1: แบ็กหุบเข้ากลาง ปีกสูง)
 * ถ้าไม่มีในแมป → ใช้พิกัดฐานของแผน IP
 */
export const FORMATION_SHAPE_IP: Partial<Record<FormationId, AnchorPoint[]>> = {
  '4-3-3': [
    a('GK', 50, 4),
    a('LB', 28, 40), // invert
    a('CB', 38, 22),
    a('CB', 62, 22),
    a('RB', 72, 40),
    a('CDM', 50, 36),
    a('CM', 32, 58),
    a('CM', 68, 58),
    a('LW', 12, 82),
    a('ST', 50, 88),
    a('RW', 88, 82),
  ],
  '4-3-3-false9': [
    a('GK', 50, 4),
    a('LB', 26, 42),
    a('CB', 38, 22),
    a('CB', 62, 22),
    a('RB', 74, 42),
    a('CDM', 50, 38),
    a('CM', 30, 56),
    a('CM', 70, 56),
    a('LW', 14, 84),
    a('SS', 50, 70),
    a('RW', 86, 84),
  ],
  '4-2-3-1': [
    a('GK', 50, 4),
    a('LB', 14, 36),
    a('CB', 38, 22),
    a('CB', 62, 22),
    a('RB', 86, 36),
    a('CDM', 36, 40),
    a('CDM', 64, 40),
    a('LM', 16, 70),
    a('CAM', 50, 72),
    a('RM', 84, 70),
    a('ST', 50, 88),
  ],
  '4-2-1-3': [
    a('GK', 50, 4),
    a('LB', 22, 38),
    a('CB', 38, 22),
    a('CB', 62, 22),
    a('RB', 78, 38),
    a('CDM', 36, 40),
    a('CDM', 64, 40),
    a('CAM', 50, 64),
    a('LW', 12, 84),
    a('ST', 50, 90),
    a('RW', 88, 84),
  ],
  '4-4-2': [
    a('GK', 50, 4),
    a('LB', 14, 32),
    a('CB', 38, 20),
    a('CB', 62, 20),
    a('RB', 86, 32),
    a('LM', 16, 58),
    a('CM', 40, 52),
    a('CM', 60, 52),
    a('RM', 84, 58),
    a('ST', 40, 84),
    a('ST', 60, 84),
  ],
  '3-5-2': [
    a('GK', 50, 4),
    a('CB', 30, 22),
    a('CB', 50, 18),
    a('CB', 70, 22),
    a('LM', 10, 62),
    a('CDM', 50, 38),
    a('CM', 34, 56),
    a('CM', 66, 56),
    a('RM', 90, 62),
    a('ST', 40, 86),
    a('ST', 60, 86),
  ],
  '3-4-3': [
    a('GK', 50, 4),
    a('CB', 30, 22),
    a('CB', 50, 20),
    a('CB', 70, 22),
    a('LM', 10, 58),
    a('CM', 38, 50),
    a('CM', 62, 50),
    a('RM', 90, 58),
    a('LW', 18, 84),
    a('ST', 50, 88),
    a('RW', 82, 84),
  ],
  '4-2-4': [
    a('GK', 50, 4),
    a('LB', 14, 30),
    a('CB', 38, 20),
    a('CB', 62, 20),
    a('RB', 86, 30),
    a('CDM', 38, 44),
    a('CDM', 62, 44),
    a('LW', 12, 82),
    a('ST', 38, 88),
    a('ST', 62, 88),
    a('RW', 88, 82),
  ],
}

/**
 * Out-of-possession morphs (เช่น ปีกถอยเป็น 4-5-1 / บล็อกแน่น)
 */
export const FORMATION_SHAPE_OOP: Partial<Record<FormationId, AnchorPoint[]>> = {
  '4-3-3': [
    a('GK', 50, 4),
    a('LB', 16, 20),
    a('CB', 38, 18),
    a('CB', 62, 18),
    a('RB', 84, 20),
    a('CDM', 50, 34),
    a('CM', 36, 46),
    a('CM', 64, 46),
    a('LW', 16, 48), // wing drops to mid band
    a('ST', 50, 68),
    a('RW', 84, 48),
  ],
  '4-3-3-false9': [
    a('GK', 50, 4),
    a('LB', 16, 20),
    a('CB', 38, 18),
    a('CB', 62, 18),
    a('RB', 84, 20),
    a('CDM', 50, 34),
    a('CM', 36, 46),
    a('CM', 64, 46),
    a('LW', 16, 50),
    a('SS', 50, 58),
    a('RW', 84, 50),
  ],
  '4-2-3-1': [
    a('GK', 50, 4),
    a('LB', 16, 20),
    a('CB', 38, 18),
    a('CB', 62, 18),
    a('RB', 84, 20),
    a('CDM', 38, 36),
    a('CDM', 62, 36),
    a('LM', 16, 48),
    a('CAM', 50, 50),
    a('RM', 84, 48),
    a('ST', 50, 70),
  ],
  '4-2-1-3': [
    a('GK', 50, 4),
    a('LB', 16, 20),
    a('CB', 38, 18),
    a('CB', 62, 18),
    a('RB', 84, 20),
    a('CDM', 38, 36),
    a('CDM', 62, 36),
    a('CAM', 50, 48),
    a('LW', 16, 50),
    a('ST', 50, 68),
    a('RW', 84, 50),
  ],
  '4-4-2': [
    a('GK', 50, 4),
    a('LB', 16, 18),
    a('CB', 38, 16),
    a('CB', 62, 16),
    a('RB', 84, 18),
    a('LM', 16, 42),
    a('CM', 40, 40),
    a('CM', 60, 40),
    a('RM', 84, 42),
    a('ST', 40, 68),
    a('ST', 60, 68),
  ],
  '3-5-2': [
    a('GK', 50, 4),
    a('CB', 28, 18),
    a('CB', 50, 16),
    a('CB', 72, 18),
    a('LM', 12, 36), // WB drop → 5-3-2 feel
    a('CDM', 50, 34),
    a('CM', 35, 44),
    a('CM', 65, 44),
    a('RM', 88, 36),
    a('ST', 40, 66),
    a('ST', 60, 66),
  ],
  '3-4-3': [
    a('GK', 50, 4),
    a('CB', 30, 18),
    a('CB', 50, 16),
    a('CB', 70, 18),
    a('LM', 12, 38),
    a('CM', 38, 42),
    a('CM', 62, 42),
    a('RM', 88, 38),
    a('LW', 22, 52),
    a('ST', 50, 66),
    a('RW', 78, 52),
  ],
  '4-2-4': [
    a('GK', 50, 4),
    a('LB', 16, 20),
    a('CB', 38, 18),
    a('CB', 62, 18),
    a('RB', 84, 20),
    a('CDM', 38, 40),
    a('CDM', 62, 40),
    a('LW', 16, 52),
    a('ST', 40, 68),
    a('ST', 60, 68),
    a('RW', 84, 52),
  ],
  '4-5-1': [
    a('GK', 50, 4),
    a('LB', 16, 18),
    a('CB', 38, 16),
    a('CB', 62, 16),
    a('RB', 84, 18),
    a('LM', 14, 42),
    a('CDM', 50, 34),
    a('CM', 36, 44),
    a('CM', 64, 44),
    a('RM', 86, 42),
    a('ST', 50, 66),
  ],
  '5-3-2': [
    a('GK', 50, 4),
    a('LB', 10, 24),
    a('CB', 32, 16),
    a('CB', 50, 14),
    a('CB', 68, 16),
    a('RB', 90, 24),
    a('CM', 35, 40),
    a('CM', 50, 38),
    a('CM', 65, 40),
    a('ST', 40, 64),
    a('ST', 60, 64),
  ],
}

/**
 * พิกัดเป้าหมายของสล็อต ตามครองบอล
 * - IP: แผน formation (หรือ morph IP)
 * - OOP: แผน formationOop ของแทคติก (หรือ morph OOP ของแผนนั้น)
 */
export function resolveShapeAnchor(
  slotIndex: number,
  formationIp: FormationId,
  formationOop: FormationId,
  inPossession: boolean,
): AnchorPoint {
  if (inPossession) {
    const morph = FORMATION_SHAPE_IP[formationIp]
    if (morph?.[slotIndex]) return morph[slotIndex]!
    return FORMATION_ANCHORS[formationIp][slotIndex] ?? a('CM', 50, 50)
  }
  const morph = FORMATION_SHAPE_OOP[formationOop]
  if (morph?.[slotIndex]) return morph[slotIndex]!
  return (
    FORMATION_ANCHORS[formationOop][slotIndex] ??
    FORMATION_ANCHORS[formationIp][slotIndex] ??
    a('CM', 50, 50)
  )
}

export function shapeNoteTh(formationIp: FormationId, formationOop: FormationId): string {
  const ip = FORMATION_SHAPE_IP[formationIp] ? 'มี morph บุก' : 'พิกัดฐาน'
  const oop = FORMATION_SHAPE_OOP[formationOop] ? 'มี morph รับ' : 'พิกัดฐาน OOP'
  return `รูปไดนามิก IP(${formationIp}:${ip}) / OOP(${formationOop}:${oop})`
}
