/**
 * กัปตัน / รองกัปตัน — คัดจาก XI + ผลในแมตช์
 */
import type { Player, Tactics } from '../types'

export function captainLeadershipScore(p: Player): number {
  const det = p.growth?.determination ?? 10
  const pro = p.growth?.professionalism ?? 10
  const composure = p.attrs.composure / 99
  const ageBonus = p.age >= 28 ? 8 : p.age >= 24 ? 4 : p.age <= 20 ? -4 : 0
  const roleBonus =
    p.squadRole === 'key' ? 10 : p.squadRole === 'regular' ? 5 : p.squadRole === 'prospect' ? -6 : 0
  return det * 2.2 + pro * 1.6 + composure * 18 + p.overall * 0.35 + ageBonus + roleBonus
}

/** เลือกกัปตัน / รอง จาก XI (ไม่ซ้ำ) */
export function pickCaptainsFromXi(
  xi: string[],
  players: Player[],
): { captainId: string | null; viceCaptainId: string | null } {
  const ranked = xi
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => captainLeadershipScore(b) - captainLeadershipScore(a))
  const captainId = ranked[0]?.id ?? null
  const viceCaptainId = ranked.find((p) => p.id !== captainId)?.id ?? null
  return { captainId, viceCaptainId }
}

export function ensureCaptains(tactics: Tactics, players: Player[]): Tactics {
  const xi = tactics.startingXi.filter(Boolean)
  const onPitch = new Set(xi)
  let captainId = tactics.captainId && onPitch.has(tactics.captainId) ? tactics.captainId : null
  let viceCaptainId =
    tactics.viceCaptainId && onPitch.has(tactics.viceCaptainId) ? tactics.viceCaptainId : null
  if (captainId && viceCaptainId && captainId === viceCaptainId) viceCaptainId = null
  if (!captainId || !viceCaptainId) {
    const picked = pickCaptainsFromXi(xi, players)
    captainId = captainId ?? picked.captainId
    viceCaptainId =
      viceCaptainId && viceCaptainId !== captainId ? viceCaptainId : picked.viceCaptainId
    if (viceCaptainId === captainId) {
      viceCaptainId = xi.find((id) => id !== captainId) ?? null
    }
  }
  return { ...tactics, captainId, viceCaptainId }
}

/** คงกัปตันที่ยังอยู่ใน XI — ไม่เลือกใหม่อัตโนมัติ (มนุษย์ต้องเลือกเอง) */
export function syncCaptainsWithXi(tactics: Tactics): Tactics {
  const xi = new Set(tactics.startingXi.filter(Boolean))
  let captainId = tactics.captainId && xi.has(tactics.captainId) ? tactics.captainId : null
  let viceCaptainId =
    tactics.viceCaptainId && xi.has(tactics.viceCaptainId) ? tactics.viceCaptainId : null
  if (viceCaptainId && viceCaptainId === captainId) viceCaptainId = null
  return { ...tactics, captainId, viceCaptainId }
}

/** มีกัปตันใน XI หรือยัง */
export function hasCaptainInXi(tactics: Tactics | undefined | null): boolean {
  if (!tactics?.captainId) return false
  return tactics.startingXi.includes(tactics.captainId)
}

export function captainOnPitch(
  tactics: Tactics,
  agents: { id: string }[],
): { captainId: string | null; viceId: string | null; leaderId: string | null } {
  const ids = new Set(agents.map((a) => a.id))
  const captainId = tactics.captainId && ids.has(tactics.captainId) ? tactics.captainId : null
  const viceId = tactics.viceCaptainId && ids.has(tactics.viceCaptainId) ? tactics.viceCaptainId : null
  return { captainId, viceId, leaderId: captainId ?? viceId }
}

/** กัปตันห้ามเถียง — คืนโอกาสคูณ (0 = ห้ามเกือบหมด) */
export function captainArgueMul(opts: {
  hasCaptainOnPitch: boolean
  captainDetermination: number
  arguerIsCaptain: boolean
}): number {
  if (!opts.hasCaptainOnPitch) return 1
  if (opts.arguerIsCaptain) {
    // กัปตันเองเถียงได้น้อยลงถ้า determination สูง (เป็นแบบอย่าง)
    return opts.captainDetermination >= 14 ? 0.35 : 0.55
  }
  // กัปตันคุมลูกทีม — determination สูง = ห้ามเถียงได้ดี
  const det = opts.captainDetermination
  if (det >= 16) return 0.12
  if (det >= 13) return 0.28
  if (det >= 10) return 0.45
  return 0.65
}

export function captainOrganizeLine(captainName: string, trailing: boolean): string {
  return trailing
    ? `กัปตัน ${captainName} รวบรวมทีม · อย่าแตกแถวตอนตามหลัง`
    : `กัปตัน ${captainName} สั่งเกม · ให้ทุกคนโฟกัส`
}

export function captainCalmArgueLine(captainName: string, hotHead: string): string {
  return `กัปตัน ${captainName} ห้าม ${hotHead} · อย่าไปเถียงกรรมการ`
}
