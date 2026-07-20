/**
 * จังหวะดราม่าในแมตช์ — สไตล์/ฟอร์เมชัน · ล้ำหน้า · เถียงกรรมการ · ถ่วงเวลา
 * เน้นข้อความให้อ่านรู้ว่าทีมเล่นยังไง (ซิมคร่าวๆ)
 */
import type {
  FormationId,
  Mentality,
  PlayStyle,
  Pressing,
  SetPiecePlan,
  Tempo,
  Width,
} from '../types'
import { formationLabel } from '../types'
import { FORMATION_SPATIAL } from './formationAnchors'

export function setPiecePlanTh(plan: SetPiecePlan): string {
  switch (plan) {
    case 'near_post':
      return 'เสาใกล้'
    case 'far_post':
      return 'เสาไกล'
    case 'short':
      return 'สั้นครอง'
    case 'direct':
      return 'ยิงตรง'
    default:
      return 'ผสม'
  }
}

/** โน้ตว่าแผน set-piece กำลังทำงาน */
export function setPiecePlanWorkingLine(
  shortName: string,
  kind: 'corner' | 'freeKick' | 'throw',
  plan: SetPiecePlan,
  success: boolean,
): string {
  const p = setPiecePlanTh(plan)
  if (kind === 'corner') {
    return success
      ? `${shortName} ลูกมุมตามแผน「${p}」ได้จังหวะ`
      : `${shortName} เปิดมุมแผน「${p}」แต่ยังไม่คม`
  }
  if (kind === 'freeKick') {
    return success
      ? `${shortName} ฟรีคิกแผน「${p}」ทำงาน`
      : `${shortName} ฟรีคิกแผน「${p}」ยังไม่เข้าที่`
  }
  return `${shortName} ลูกทุ่มเร็ว · รีสตาร์ทเกม`
}

function styleTh(style: PlayStyle): string {
  return style === 'possession' ? 'ครองบอล' : style === 'counter' ? 'โต้กลับ' : 'สมดุล'
}

function mentTh(m: Mentality): string {
  return m === 'attacking' ? 'บุก' : m === 'defensive' ? 'รับ' : 'สมดุล'
}

function pressTh(p: Pressing): string {
  return p === 'high' ? 'เพรสสูง' : p === 'low' ? 'เพรสต่ำ' : 'เพรสกลาง'
}

function tempoTh(t: Tempo): string {
  return t === 'fast' ? 'จังหวะเร็ว' : t === 'slow' ? 'จังหวะช้า' : 'จังหวะปกติ'
}

function widthTh(w: Width): string {
  return w === 'wide' ? 'กว้าง' : w === 'narrow' ? 'แคบ' : 'ความกว้างปกติ'
}

function passBiasTh(bias: string): string {
  switch (bias) {
    case 'triangulation':
      return 'หมุนสามเหลี่ยมสั้น'
    case 'direct':
      return 'เล่นตรงทะลุ'
    case 'flank':
      return 'เปิดปีก'
    case 'central_am':
      return 'เจาะกลางผ่าน AM'
    case 'long_to_st':
      return 'ลูกยาวหาหน้าเป้า'
    default:
      return 'ผสมผสาน'
  }
}

export function tacticsShapeNote(
  shortName: string,
  formation: FormationId,
  formationOop: FormationId,
  style: PlayStyle,
  mentality: Mentality,
  pressing: Pressing,
  tempo: Tempo,
  width: Width,
): string {
  const ip = formationLabel(formation, true)
  const oop = formationOop !== formation ? ` / OOP ${formationLabel(formationOop, true)}` : ''
  const bias = FORMATION_SPATIAL[formation]?.passBias ?? 'triangulation'
  return (
    `${shortName} แผน ${ip}${oop} · ${styleTh(style)} · ${mentTh(mentality)} · ` +
    `${pressTh(pressing)} · ${tempoTh(tempo)} · ${widthTh(width)} · แนวทาง: ${passBiasTh(bias)}`
  )
}

/** โน้ตกลางเกมว่าฟอร์เมชันกำลังทำงานยังไง */
export function formationInPlayNote(
  shortName: string,
  formation: FormationId,
  style: PlayStyle,
  prog: number,
): string | null {
  const bias = FORMATION_SPATIAL[formation]?.passBias ?? 'triangulation'
  if (prog < 40) {
    if (bias === 'long_to_st') return `${shortName} เปิดยาวจากหลังตามแผน ${formationLabel(formation, true)}`
    if (style === 'possession') return `${shortName} สร้างเกมช้าจากแนวรับ`
    return null
  }
  if (prog >= 40 && prog < 65) {
    if (bias === 'flank') return `${shortName} ดันเกมไปปีกตามรูป ${formationLabel(formation, true)}`
    if (bias === 'triangulation') return `${shortName} หมุนบอลสั้นกลางสนาม`
    if (bias === 'central_am') return `${shortName} หาช่องผ่านแดนกลาง`
    if (style === 'counter') return `${shortName} รอจังหวะโต้`
    return null
  }
  if (prog >= 65) {
    if (bias === 'long_to_st') return `${shortName} ยัดลูกเข้ากรอบหาหน้าเป้า`
    if (bias === 'flank') return `${shortName} เปิดตัดจากข้าง`
    return null
  }
  return null
}

/** โอกาสล้ำหน้าเมื่อจ่ายทะลุ/ยิงจากโซนสูง */
export function offsideChance(opts: {
  passDist: number
  mateProg: number
  carrierProg: number
  throughBall: boolean
  style: PlayStyle
}): number {
  let p = 0
  if (opts.mateProg < 72) return 0
  if (opts.throughBall || opts.passDist >= 24) p += 0.1
  if (opts.mateProg > 82) p += 0.08
  if (opts.carrierProg > 55 && opts.mateProg - opts.carrierProg > 18) p += 0.07
  if (opts.style === 'counter') p += 0.04
  return Math.min(0.28, p)
}

export function offsideText(attacker: string, kind: 'pass' | 'shot'): string {
  return kind === 'shot'
    ? `ล้ำหน้า! ${attacker} อยู่ในตำแหน่งล้ำก่อนยิง`
    : `ล้ำหน้า! ธงยก · ${attacker} ตัดหลังเร็วเกินไป`
}

/** ถ่วงเวลาเมื่อนำช่วงท้าย */
export function timeWasteChance(opts: {
  minute: number
  goalDiff: number
  mentality: Mentality
  tempo: Tempo
  style: PlayStyle
}): number {
  if (opts.minute < 75 || opts.goalDiff <= 0) return 0
  let p = 0.12 + Math.min(0.25, (opts.minute - 75) * 0.015)
  if (opts.mentality === 'defensive') p += 0.18
  if (opts.tempo === 'slow') p += 0.12
  if (opts.style === 'possession') p += 0.06
  if (opts.goalDiff >= 2) p += 0.1
  return Math.min(0.55, p)
}

export function timeWasteLine(name: string, minute: number): string {
  if (minute >= 88) return `${name} ถ่วงเวลาที่มุม · นาฬิกาวิ่ง`
  if (minute >= 82) return `${name} เล่นช้า · ถือลูกที่ขอบสนาม`
  return `${name} หมุนบอลช้าเพื่อกินเวลา`
}

/** เถียงกรรมการหลังฟาวล์/ใบ */
export function refArgueChance(opts: {
  card: boolean
  nearBox: boolean
  aggression: number
  refStrictness: number
}): number {
  let p = opts.card ? 0.28 : 0.12
  if (opts.nearBox) p += 0.1
  p += (opts.aggression / 99) * 0.15
  p -= (opts.refStrictness / 20) * 0.08
  return Math.min(0.48, Math.max(0.05, p))
}

export function refArgueLine(
  player: string,
  refName: string,
  level: 'moan' | 'dissent' | 'booked',
): string {
  if (level === 'booked') return `${player} เถียงกรรมการ · ${refName} ใบเหลืองเพิ่ม!`
  if (level === 'dissent') return `${player} วิ่งไปเถียง ${refName} อย่างรุนแรง`
  return `${player} บ่นใส่ ${refName} หลังจังหวะนั้น`
}

/** โอกาสได้ใบจาก dissent */
export function dissentBookingChance(refStrictness: number, alreadyArguing: boolean): number {
  const base = 0.08 + (refStrictness / 20) * 0.18
  return alreadyArguing ? base + 0.12 : base
}
