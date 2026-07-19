/**
 * วันที่นัด — ลีก = เสาร์ (weekend) · ถ้วย/ยุโรป = พุธ (midweek)
 */
export function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

/** เสาร์ลีกสัปดาห์ที่ matchdayOffset (1-based จาก season start) */
export function weekendMatchDate(seasonStartDate: string, matchdayOffset: number): string {
  return addDays(seasonStartDate, (matchdayOffset - 1) * 7)
}

/** พุธกลางสัปดาห์ของช่อง MD นั้น (3 วันก่อนเสาร์) */
export function midweekMatchDate(seasonStartDate: string, matchdayOffset: number): string {
  return addDays(weekendMatchDate(seasonStartDate, matchdayOffset), -3)
}

/** จากวันที่อ้างอิง (มักเป็นเสาร์ลีก) → พุธของสัปดาห์นั้น */
export function midweekFromAnchor(anchorDate: string): string {
  return addDays(anchorDate, -3)
}

/** เลื่อนช่อง MD แล้วยังอยู่กลางสัปดาห์ — ถ้า anchor เป็นพุธอยู่แล้ว ใช้ +7*delta */
export function shiftMidweekDate(fromMidweekDate: string, matchdayDelta: number): string {
  return addDays(fromMidweekDate, matchdayDelta * 7)
}
