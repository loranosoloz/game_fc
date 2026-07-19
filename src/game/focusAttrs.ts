import type { IndividualFocus, PlayerAttributes } from './types'

/** แหล่งเดียวสำหรับโฟกัสซ้อม → แอตทริบิวต์ */
export const FOCUS_ATTRS: Record<IndividualFocus, (keyof PlayerAttributes)[]> = {
  finishing: ['finishing', 'composure'],
  passing: ['passing', 'vision', 'technique'],
  defending: ['tackling', 'positioning', 'heading'],
  athleticism: ['pace', 'stamina', 'agility', 'strength'],
  goalkeeping: ['handling', 'reflexes', 'aerialReach'],
  none: [],
}

/** โฟกัสเข้ากับกลุ่มตำแหน่งไหม */
export function focusMatchesRole(
  focus: IndividualFocus,
  position: 'GK' | 'DF' | 'MF' | 'FW' | string,
): boolean {
  if (focus === 'none') return true
  if (focus === 'goalkeeping') return position === 'GK'
  if (focus === 'finishing') return position === 'FW' || position === 'MF'
  if (focus === 'defending') return position === 'DF' || position === 'MF'
  if (focus === 'passing') return position === 'MF' || position === 'DF'
  if (focus === 'athleticism') return true
  return false
}
