/**
 * บาดเจ็บ / ป่วย / เหตุการณ์ → ส่งผล stamina + สถานะลงแข่ง
 * - out: ห้ามลง
 * - limited: ลงได้แต่ stamina ต่ำ · ฟื้นช้า · ในแมตช์เหนื่อยเร็ว
 * - ok: ปกติ
 */
import type { IllnessType, InjuryType, Player } from './types'
import { scaleStaminaGain, scaleStaminaLoss, staminaRecoveryMul } from './playerStamina'

const INJ_LABEL: Record<InjuryType, string> = {
  muscle: 'กล้ามเนื้อ',
  ligament: 'เอ็น',
  bone: 'กระดูก',
}

const ILL_LABEL: Record<IllnessType, string> = {
  cold: 'หวัด',
  flu: 'ไข้หวัดใหญ่',
  stomach: 'ท้องเสีย',
  virus: 'ไวรัส',
  fever: 'มีไข้',
}

export type MedicalPlayStatus = 'ok' | 'limited' | 'out'

export interface MedicalStaminaProfile {
  status: MedicalPlayStatus
  /** เพดาน condition ขณะยังเจ็บ/ป่วย */
  staminaCap: number
  /** คูณฟื้นรายวัน (<1 = ฟื้นช้า) */
  recoveryMul: number
  /** คูณเหนื่อยในแมตช์ (>1 = เหนื่อยเร็ว) */
  matchFatigueMul: number
  /** โน้ตสั้นไทย */
  noteTh: string
  /** รายละเอียดสำหรับ UI */
  detailTh: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** สถานะจากชนิดบาดเจ็บ + วันเหลือ */
export function injuryPlayStatus(
  type: InjuryType | null | undefined,
  days: number,
): MedicalPlayStatus {
  if (days <= 0 || !type) return 'ok'
  // กระดูก — ห้ามลงเสมอ
  if (type === 'bone') return 'out'
  // เอ็น — หนักถ้าเหลือหลายวัน
  if (type === 'ligament') return days >= 6 ? 'out' : 'limited'
  // กล้ามเนื้อ — นiggle ลงได้ · หนักห้ามลง
  if (type === 'muscle') return days >= 8 ? 'out' : 'limited'
  return 'out'
}

export function illnessPlayStatus(
  type: IllnessType | null | undefined,
  days: number,
): MedicalPlayStatus {
  if (days <= 0 || !type) return 'ok'
  // หวัด / ท้องเสียเบา — ลงได้แบบจำกัด
  if (type === 'cold' && days <= 3) return 'limited'
  if (type === 'stomach' && days <= 2) return 'limited'
  // ไข้ / ไวรัส / ไข้หวัดใหญ่ — ห้ามลง
  return 'out'
}

/** รวมสถานะ — เอาที่รุนแรงสุด */
export function medicalPlayStatus(player: Player): MedicalPlayStatus {
  if ((player.banMatches ?? 0) > 0) return 'out'
  if ((player.leaveDays ?? 0) > 0) return 'out'
  const inj = injuryPlayStatus(player.injuryType, player.injuryDays)
  const ill = illnessPlayStatus(player.illnessType, player.illnessDays ?? 0)
  if (inj === 'out' || ill === 'out') return 'out'
  if (inj === 'limited' || ill === 'limited') return 'limited'
  return 'ok'
}

export function canPlayMatch(player: Player): boolean {
  return medicalPlayStatus(player) !== 'out'
}

export function isLimitedPlay(player: Player): boolean {
  return medicalPlayStatus(player) === 'limited'
}

export function medicalStaminaProfile(player: Player): MedicalStaminaProfile {
  const status = medicalPlayStatus(player)
  const fit = player.attrs?.stamina ?? 70
  const injDays = player.injuryDays
  const illDays = player.illnessDays ?? 0
  const injType = player.injuryType
  const illType = player.illnessType

  if (status === 'ok') {
    return {
      status: 'ok',
      staminaCap: 100,
      recoveryMul: 1,
      matchFatigueMul: 1,
      noteTh: 'พร้อม',
      detailTh: 'ไม่มีข้อจำกัดทางการแพทย์',
    }
  }

  // ค่าเริ่มตามชนิด
  let staminaCap = 72
  let recoveryMul = 0.55
  let matchFatigueMul = 1.35
  let noteTh = 'จำกัด'
  let detailTh = ''

  if (injDays > 0 && injType) {
    const label = INJ_LABEL[injType]
    if (injType === 'bone') {
      staminaCap = 48
      recoveryMul = 0.35
      matchFatigueMul = 1.8
      noteTh = 'ห้ามลง · กระดูก'
      detailTh = `กระดูก${injDays}ว — ห้ามลง · stamina ฟื้นช้ามาก`
    } else if (injType === 'ligament') {
      if (status === 'out') {
        staminaCap = 52
        recoveryMul = 0.4
        noteTh = 'ห้ามลง · เอ็น'
        detailTh = `เอ็น${injDays}ว — ห้ามลงจนกว่าจะเบาลง`
      } else {
        staminaCap = 58
        recoveryMul = 0.42
        matchFatigueMul = 1.55
        noteTh = 'ลงได้ · เอ็นยังไม่หาย'
        detailTh = `เอ็น${injDays}ว — ลงได้แต่ stamina ต่ำ · ฟื้นลำบาก · เหนื่อยเร็ว`
      }
    } else {
      // muscle
      if (status === 'out') {
        staminaCap = 55
        recoveryMul = 0.45
        noteTh = 'ห้ามลง · กล้ามเนื้อ'
        detailTh = `กล้ามเนื้อหนัก${injDays}ว — ห้ามลง`
      } else {
        staminaCap = injDays >= 5 ? 60 : 68
        recoveryMul = 0.5
        matchFatigueMul = 1.35 + Math.min(0.25, injDays * 0.04)
        noteTh = 'ลงได้ · กล้ามเนื้อยังเจ็บ'
        detailTh = `กล้ามเนื้อ${injDays}ว — ลงได้ · stamina ลด · ฟื้นช้า`
      }
    }
    if (player.treatment === 'injection' && status === 'limited') {
      // ฉีดยา = ลงง่ายขึ้นแต่ฟื้นสภาพแย่
      staminaCap = Math.min(staminaCap + 6, 75)
      recoveryMul *= 0.85
      matchFatigueMul += 0.1
      detailTh += ' · ฉีดยา: ลงได้แต่ฟื้น stamina แย่'
    }
    if (player.treatment === 'rest') {
      recoveryMul = Math.min(1, recoveryMul + 0.12)
      detailTh += ' · พัก: ฟื้น stamina ดีขึ้น'
    }
  }

  if (illDays > 0 && illType) {
    const label = ILL_LABEL[illType]
    if (status === 'out') {
      staminaCap = Math.min(staminaCap, illType === 'virus' || illType === 'flu' ? 45 : 55)
      recoveryMul = Math.min(recoveryMul, 0.4)
      noteTh = `ห้ามลง · ${label}`
      detailTh = `${label}${illDays}ว — ห้ามลง · stamina ทรุด`
    } else {
      staminaCap = Math.min(staminaCap, 65)
      recoveryMul = Math.min(recoveryMul, 0.55)
      matchFatigueMul = Math.max(matchFatigueMul, 1.4)
      noteTh = `ลงได้ · ${label}`
      detailTh = `${label}${illDays}ว — ลงได้แบบประคอง · stamina ฟื้นช้า`
    }
  }

  if ((player.leaveDays ?? 0) > 0) {
    noteTh = 'ลา / ทีมชาติ'
    detailTh = `ไม่อยู่คลับ ${player.leaveDays}ว — stamina ไม่ซ้อมกับทีม`
    staminaCap = Math.min(staminaCap, 70)
    recoveryMul = Math.min(recoveryMul, 0.5)
  }

  if ((player.banMatches ?? 0) > 0) {
    noteTh = 'โดนแบน'
    detailTh = `แบน ${player.banMatches} นัด`
  }

  // ฟิตเนสธรรมชาติช่วยเพดาน/ฟื้นเล็กน้อยแม้เจ็บ
  const fitHelp = staminaRecoveryMul(fit)
  staminaCap = clamp(Math.round(staminaCap + (fitHelp - 1) * 8), 40, 85)
  recoveryMul = clamp(recoveryMul * (0.85 + fitHelp * 0.15), 0.25, 0.95)

  return {
    status,
    staminaCap,
    recoveryMul,
    matchFatigueMul,
    noteTh,
    detailTh: detailTh || noteTh,
  }
}

/** หัก stamina ตอนเกิดบาดเจ็บใหม่ */
export function staminaHitOnInjury(
  type: InjuryType,
  source: 'match' | 'training',
  fitnessAttr: number,
): number {
  let base = source === 'training' ? 14 : 10
  if (type === 'ligament') base += 6
  if (type === 'bone') base += 12
  if (type === 'muscle') base += 2
  return Math.round(scaleStaminaLoss(base, fitnessAttr))
}

/** หัก stamina ตอนป่วยใหม่ */
export function staminaHitOnIllness(type: IllnessType, fitnessAttr: number): number {
  let base = 10
  if (type === 'flu' || type === 'virus') base = 20
  else if (type === 'fever') base = 15
  else if (type === 'stomach') base = 12
  else base = 9
  return Math.round(scaleStaminaLoss(base, fitnessAttr))
}

/** ฟื้นรายวันขณะเจ็บ/ป่วย — ช้าตามโปรไฟล์ */
export function medicalDailyStaminaGain(player: Player, physioLevel: number): number {
  const profile = medicalStaminaProfile(player)
  if (profile.status === 'ok') {
    return scaleStaminaGain(2 + Math.floor(physioLevel / 10), player.attrs?.stamina ?? 70)
  }
  const treatment = player.treatment ?? 'physio'
  let base = treatment === 'rest' ? 4.5 : treatment === 'injection' ? 1.5 : 2.5
  base += Math.floor(physioLevel / 12)
  const gain = scaleStaminaGain(base, player.attrs?.stamina ?? 70) * profile.recoveryMul
  return Math.max(0.5, gain)
}

/** บังคับไม่เกินเพดานตอนเจ็บ/ป่วย */
export function clampStaminaToMedical(player: Player, condition: number): number {
  const profile = medicalStaminaProfile(player)
  if (profile.status === 'ok') return clamp(condition, 25, 100)
  return clamp(condition, 25, profile.staminaCap)
}

/** เหตุการณ์ลา / นอกคลับ — หัก stamina เล็กน้อยต่อสัปดาห์ */
export function staminaHitOnLeaveEvent(player: Player): number {
  return Math.round(scaleStaminaLoss(3, player.attrs?.stamina ?? 70))
}
