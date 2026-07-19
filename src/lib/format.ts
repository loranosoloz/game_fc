/** แปลงตัวเลขเงินเป็นข้อความภาษาไทย */
export function formatMoney(n: number): string {
  return `฿${Math.round(n).toLocaleString('th-TH')}`
}

export function outcomeLabel(usGoals: number, themGoals: number): string {
  if (usGoals > themGoals) return 'ชนะ'
  if (usGoals === themGoals) return 'เสมอ'
  return 'แพ้'
}
