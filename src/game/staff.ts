import staffDb from '@/data/staffRoles.json'
import type { StaffState } from './types'

const NAMES = ['Reed', 'Cole', 'Hayes', 'Brooks', 'Frost', 'Nash', 'Shaw', 'Lane']

export function createStaff(clubRep: number): StaffState {
  const base = Math.round(6 + clubRep / 12)
  return {
    members: [
      { role: 'coach', name: `Coach ${NAMES[0]}`, level: Math.min(staffDb.maxLevel, base + 1) },
      { role: 'scout', name: `Scout ${NAMES[1]}`, level: Math.min(staffDb.maxLevel, base) },
      { role: 'physio', name: `Physio ${NAMES[2]}`, level: Math.min(staffDb.maxLevel, base - 1) },
    ],
  }
}

export function staffLevel(staff: StaffState, role: 'coach' | 'scout' | 'physio'): number {
  return staff.members.find((m) => m.role === role)?.level ?? staffDb.defaultLevel
}

export function upgradeStaff(staff: StaffState, role: 'coach' | 'scout' | 'physio', costOk: boolean) {
  if (!costOk) return { staff, ok: false as const, message: 'งบไม่พออัปเกรดสตาฟ' }
  const members = staff.members.map((m) =>
    m.role === role
      ? { ...m, level: Math.min(staffDb.maxLevel, m.level + 1) }
      : m,
  )
  return { staff: { members }, ok: true as const, message: `อัปเกรด ${role} สำเร็จ` }
}

export function staffUpgradeCost(level: number) {
  return 80_000 + level * 45_000
}
