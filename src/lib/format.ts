/** แสดงเงินเป็นยูโร (€) — หน่วยในเกมเป็น EUR */
export function formatMoney(n: number): string {
  const v = Math.round(n)
  const abs = Math.abs(v).toLocaleString('en-US')
  return v < 0 ? `−€${abs}` : `€${abs}`
}

/** แปลง stat โค้ชจากสเกล 1–100 เป็นสเกล FM 1–20 */
export function coachStatTo20(value100: number): number {
  return Math.min(20, Math.max(1, Math.round(value100 / 5)))
}

export function formatCoachStat(value100: number): string {
  return `${coachStatTo20(value100)}/20`
}

export function outcomeLabel(usGoals: number, themGoals: number): string {
  if (usGoals > themGoals) return 'ชนะ'
  if (usGoals === themGoals) return 'เสมอ'
  return 'แพ้'
}
