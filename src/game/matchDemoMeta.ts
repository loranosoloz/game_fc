import type { MatchEvent } from './types'

export const DEMO_WALL_MS = 4 * 60 * 1000
export const DEMO_MATCH_MINUTES = 90

/** เวลาบนนาฬิกาจอ (ms) จากนาทีแมตช์ — ใช้เป็นแรงดึงเบาๆ */
export function demoWallMsAtMinute(minute: number): number {
  const m = Math.max(0, Math.min(DEMO_MATCH_MINUTES + 8, minute))
  return (m / (DEMO_MATCH_MINUTES + 8)) * DEMO_WALL_MS
}

/**
 * ไทม์ไลน์ต่อ event — กระจายเกือบเท่าๆ กันทั้ง DEMO_WALL_MS
 * (ไม่ให้หลาย event นาทีเดียวกันระเบิดพร้อมกัน / ไม่ให้รอนานแล้วกระชาก)
 */
export function buildDemoTimeline(events: MatchEvent[]): number[] {
  const n = events.length
  if (n === 0) return []
  if (n === 1) return [0]

  const times: number[] = []
  for (let i = 0; i < n; i++) {
    const even = (i / (n - 1)) * DEMO_WALL_MS
    const byMin = demoWallMsAtMinute(events[i]!.minute)
    times.push(even * 0.78 + byMin * 0.22)
  }

  const minGap = Math.max(280, DEMO_WALL_MS / (n * 2.2))
  for (let i = 1; i < n; i++) {
    const prev = events[i - 1]!
    const cur = events[i]!
    let extra = 0
    if (prev.kind === 'save' && cur.kind === 'shot') extra += 750
    if (prev.kind === 'shot' && cur.kind === 'save') extra += 450
    if (prev.kind === 'save' && cur.kind === 'save') extra += 850
    if (prev.kind === 'corner') extra += 420
    if (cur.text.includes('เข้ากรอบ') || cur.text.includes('ลูกทุ่ม')) extra += 380
    if (cur.kind === 'tactical_window' || prev.kind === 'tactical_window') extra += 520
    times[i] = Math.max(times[i]!, times[i - 1]! + minGap + extra)
  }
  const max = times[n - 1]!
  if (max > 0 && Math.abs(max - DEMO_WALL_MS) > 1) {
    const scale = DEMO_WALL_MS / max
    for (let i = 0; i < n; i++) times[i]! *= scale
  }
  return times
}

export function demoIndexAtWallMs(timeline: number[], wallMs: number): number {
  if (timeline.length === 0) return 0
  let idx = 0
  for (let i = 0; i < timeline.length; i++) {
    if (timeline[i]! <= wallMs) idx = i
    else break
  }
  return idx
}

/** ช่วงระหว่าง event ปัจจุบันกับถัดไป — สำหรับ lerp ตำแหน่ง */
export function demoBlendAtWallMs(
  timeline: number[],
  wallMs: number,
): { index: number; t: number } {
  const index = demoIndexAtWallMs(timeline, wallMs)
  const a = timeline[index] ?? 0
  const b = timeline[index + 1]
  if (b == null || b <= a) return { index, t: 0 }
  const t = Math.max(0, Math.min(1, (wallMs - a) / (b - a)))
  return { index, t }
}

const BIG_KINDS = new Set([
  'goal',
  'shot',
  'save',
  'penalty',
  'card',
  'foul',
  'corner',
  'var',
  'offside',
  'halftime',
  'secondhalf',
  'fulltime',
  'substitution',
  'tactical_window',
])

/** shortcut ไปไฮไลต์สำคัญถัดไป */
export function nextBigEventIndex(events: MatchEvent[], from: number): number {
  for (let i = from + 1; i < events.length; i++) {
    if (BIG_KINDS.has(events[i]!.kind)) return i
  }
  return Math.max(0, events.length - 1)
}

export function isBigDemoEvent(kind: MatchEvent['kind']): boolean {
  return BIG_KINDS.has(kind)
}

const FEED_COMMENTARY =
  /เปลี่ยนตัว|ขอเปลี่ยน|แก้เกม|ปรับแผน|สกัด|สไลด|แท็ก|ดักตัด|บังไลน์|บาดเจ็บ|เจ็บ|ลูกทุ่ม|เข้ากรอบ|ซับ|AI เปิด|AI คุม|AI ล็อค|หยุดเกม|10 คน|จ่าย|ส่ง|เปิดบอล|หมุนเกม|เจาะช่อง|ต่อเกม|ปาด|กระจาย|พาลูก|ตัดเข้า|ซ้อน|อุ้ม|สร้างจาก|ออกจากเขต|คุมจังหวะ|โซนอันตราย|โดนกด|สลับเกม|ตัดพาส|รับบอล|แผน |ฟอร์ม|OOP|ครองบอล|โต้กลับ|เพรส|จังหวะ|ถ่วงเวลา|เถียง|บ่นใส่|ล้ำ|VAR|อัฒจันทร์|จ้อง|มาดู|กดดัน|ฮึกเหิม|โค้ช |คนดัง|นักเตะ |กัปตัน|รวบรวม|ห้าม |DLP|Target|BPC|B2B|Anchor|F9|AP\)|SK\)|Winger|IF\)|WB\)|Mezzala|ลูกมุม|ฟรีคิก|เสาใกล้|เสาไกล|สั้นครอง|ยิงตรง|ตามแผน|แผนทำงาน|รีสตาร์ท|เป้า|พักครึ่ง|stamina|ฟื้นแรง/

/** ฟีด demo — โชว์จังหวะแข่งหลัก + คอมเมนต์ที่อ่านรู้เรื่อง */
export function isDemoFeedEvent(ev: MatchEvent): boolean {
  if (ev.kind === 'kickoff') return true
  if (BIG_KINDS.has(ev.kind)) return true
  if (ev.kind === 'commentary') {
    // กรองเฉพาะ noise สั้นๆ ที่ไม่เกี่ยวกับแอ็กชัน
    if (/^Overload|^คุ้นแผน|Perception|free player/i.test(ev.text)) return false
    return FEED_COMMENTARY.test(ev.text) || ev.text.length >= 18
  }
  return false
}
