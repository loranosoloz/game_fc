/**
 * ซีเนียร์ในสควอด — อิทธิพลลำดับชั้น · สงบทะเลาะ · พี่เลี้ยง
 */
import type { Player, SquadRole, Tactics } from './types'

export interface SquadSenior {
  player: Player
  score: number
  reasons: string[]
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

/** คะแนนความเป็นซีเนียร์ */
export function seniorScore(
  p: Player,
  opts?: { captainId?: string | null; viceCaptainId?: string | null },
): { score: number; reasons: string[] } {
  const reasons: string[] = []
  let score = 0

  if (p.age >= 32) {
    score += 28
    reasons.push('อาวุโส')
  } else if (p.age >= 28) {
    score += 18
    reasons.push('รุ่นพี่')
  } else if (p.age >= 25) {
    score += 6
  }

  if (p.squadRole === 'key') {
    score += 22
    reasons.push('ตัวหลัก')
  } else if (p.squadRole === 'regular') {
    score += 10
  } else if (p.squadRole === 'prospect') {
    score -= 8
  }

  if (opts?.captainId === p.id) {
    score += 25
    reasons.push('กัปตัน')
  } else if (opts?.viceCaptainId === p.id) {
    score += 14
    reasons.push('รองกัปตัน')
  }

  score += (p.growth?.professionalism ?? 10) * 0.9
  score += (p.growth?.determination ?? 10) * 0.35
  score += (p.overall - 65) * 0.35
  score += Math.min(12, (p.minutesPlayed ?? 0) / 800)

  if ((p.injuryDays ?? 0) > 0 || (p.illnessDays ?? 0) > 0) score *= 0.7

  return { score: Math.round(score * 10) / 10, reasons }
}

export function listSquadSeniors(
  squad: Player[],
  tactics?: Tactics | null,
  limit = 5,
): SquadSenior[] {
  const ranked = squad
    .filter((p) => (p.banMatches ?? 0) <= 0 && (p.leaveDays ?? 0) <= 0)
    .map((p) => {
      const { score, reasons } = seniorScore(p, {
        captainId: tactics?.captainId,
        viceCaptainId: tactics?.viceCaptainId,
      })
      return { player: p, score, reasons }
    })
    .filter((s) => s.score >= 28 || s.player.age >= 28 || s.player.squadRole === 'key')
    .sort((a, b) => b.score - a.score)
  return ranked.slice(0, limit)
}

export function isSquadSenior(p: Player, seniors: SquadSenior[]): boolean {
  return seniors.some((s) => s.player.id === p.id)
}

/** โอกาสซีเนียร์เข้าแทรกแซงทะเลาะ (0–1) */
export function seniorInterveneChance(senior: Player): number {
  const pro = senior.growth?.professionalism ?? 10
  const dirt = senior.hidden?.dirtiness ?? 10
  return clamp(0.25 + pro / 40 - dirt / 80, 0.1, 0.85)
}

/** ซีเนียร์แบบอารมณ์ร้อน — อาจทำให้เรื่องใหญ่ขึ้น */
export function seniorEscalates(senior: Player, rng: () => number): boolean {
  const pro = senior.growth?.professionalism ?? 10
  const dirt = senior.hidden?.dirtiness ?? 10
  if (pro >= 14) return false
  return rng() < 0.12 + (15 - pro) / 50 + dirt / 120
}

export function youthNeedsSenior(p: Player): boolean {
  return p.age <= 22 || p.squadRole === 'prospect'
}

export function roleLabelTh(role: SquadRole): string {
  if (role === 'key') return 'ตัวหลัก'
  if (role === 'regular') return 'ตัวจริง'
  if (role === 'prospect') return 'ดาวรุ่ง'
  return 'สควอด'
}
