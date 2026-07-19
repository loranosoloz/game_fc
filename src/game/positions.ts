import type { PositionGroup, RoleCode, SquadRole } from './types'

export function roleGroup(role: RoleCode): PositionGroup {
  switch (role) {
    case 'GK':
      return 'GK'
    case 'CB':
    case 'LB':
    case 'RB':
      return 'DF'
    case 'CDM':
    case 'CM':
    case 'CAM':
    case 'LM':
    case 'RM':
      return 'MF'
    case 'LW':
    case 'RW':
    case 'ST':
    case 'SS':
      return 'FW'
  }
}

/** ชื่อไทย + รหัสอังกฤษ */
export function roleLabel(role: RoleCode): string {
  const map: Record<RoleCode, string> = {
    GK: 'ผู้รักษาประตู (GK)',
    CB: 'เซ็นเตอร์แบ็ก (CB)',
    LB: 'แบ็กซ้าย (LB)',
    RB: 'แบ็กขวา (RB)',
    CDM: 'กองกลางตัวรับ (CDM)',
    CM: 'กองกลาง (CM)',
    CAM: 'กองกลางตัวรุก (CAM)',
    LM: 'ปีกซ้ายกลาง (LM)',
    RM: 'ปีกขวากลาง (RM)',
    LW: 'ปีกซ้าย (LW)',
    RW: 'ปีกขวา (RW)',
    ST: 'กองหน้า (ST)',
    SS: 'กองหน้าตัวรอง (SS)',
  }
  return map[role]
}

export function roleShort(role: RoleCode): string {
  return role
}

export function groupLabel(group: PositionGroup): string {
  switch (group) {
    case 'GK':
      return 'ผู้รักษาประตู (GK)'
    case 'DF':
      return 'กองหลัง (DF)'
    case 'MF':
      return 'กองกลาง (MF)'
    case 'FW':
      return 'กองหน้า (FW)'
  }
}

export function squadRoleLabel(role: SquadRole): string {
  switch (role) {
    case 'key':
      return 'ตัวหลัก (Key)'
    case 'regular':
      return 'ตัวประจำ (Regular)'
    case 'squad':
      return 'ชุดใหญ่ (Squad)'
    case 'prospect':
      return 'อนาคต (Prospect)'
  }
}

export function rolesForGroup(group: PositionGroup | 'ALL'): RoleCode[] | null {
  if (group === 'ALL') return null
  const all: RoleCode[] = [
    'GK',
    'CB',
    'LB',
    'RB',
    'CDM',
    'CM',
    'CAM',
    'LM',
    'RM',
    'LW',
    'RW',
    'ST',
    'SS',
  ]
  return all.filter((r) => roleGroup(r) === group)
}
