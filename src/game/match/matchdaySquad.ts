/**
 * Matchday squad — ตัวจริง 11 + ตัวสำรองบนม้านั่ง
 */
import type { CompetitionKind, GameSave, Player, Tactics } from '../types'
import { isUnavailable } from '../discipline'
import {
  competitionNeedsRegistration,
  isPlayerRegisteredForMatch,
} from '../squadRegistration'
import { medicalStaminaProfile } from '../medicalStamina'

/** จำนวนตัวสำรองมาตรฐานบนม้านั่ง */
export const MATCH_BENCH_SIZE = 7

/** ขั้นต่ำที่ยืนยัน XI ได้ (นอกจากตัวจริง 11) */
export const MIN_BENCH_REQUIRED = 5

export function availableSquadPlayers(
  save: GameSave,
  clubId: string,
  competition?: CompetitionKind,
): Player[] {
  return save.players
    .filter((p) => {
      if (p.clubId !== clubId || isUnavailable(p)) return false
      if (competition && competitionNeedsRegistration(competition)) {
        return isPlayerRegisteredForMatch(save, clubId, p.id, competition)
      }
      return true
    })
    .slice()
    .sort((a, b) => b.overall - a.overall)
}

/** เติมม้านั่งให้ครบจากสกวาดที่ว่าง (ไม่ทับ XI) */
export function fillBench(tactics: Tactics, squad: Player[], size = MATCH_BENCH_SIZE): Tactics {
  const xi = new Set(tactics.startingXi)
  const bench: string[] = []
  for (const id of tactics.bench) {
    if (bench.length >= size) break
    if (xi.has(id)) continue
    const p = squad.find((x) => x.id === id)
    if (p && !isUnavailable(p)) bench.push(id)
  }
  for (const p of squad) {
    if (bench.length >= size) break
    if (xi.has(p.id) || bench.includes(p.id)) continue
    if (isUnavailable(p)) continue
    bench.push(p.id)
  }
  return { ...tactics, bench }
}

export function ensureClubMatchdaySquad(
  save: GameSave,
  clubId: string,
  tactics: Tactics,
  competition?: CompetitionKind,
): Tactics {
  const pool = availableSquadPlayers(save, clubId, competition)
  // ตัดคนไม่อยู่ในทะเบียนออกจาก XI แล้วเติมใหม่
  let xi = tactics.startingXi.filter((id) => pool.some((p) => p.id === id))
  if (xi.length < 11) {
    for (const p of pool) {
      if (xi.length >= 11) break
      if (xi.includes(p.id)) continue
      xi.push(p.id)
    }
  }
  xi = xi.slice(0, 11)
  return fillBench({ ...tactics, startingXi: xi }, pool, MATCH_BENCH_SIZE)
}

export function benchIssues(
  tactics: Tactics | undefined,
  players: Player[],
): string[] {
  const issues: string[] = []
  const bench = (tactics?.bench ?? [])
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[]
  if (bench.length < MIN_BENCH_REQUIRED) {
    issues.push(
      `ตัวสำรองไม่ครบ (มี ${bench.length}/${MIN_BENCH_REQUIRED} — ต้องมีม้านั่งอย่างน้อย ${MIN_BENCH_REQUIRED} คน นอกจาก XI 11 คน)`,
    )
  }
  for (const p of bench) {
    const med = medicalStaminaProfile(p)
    if (med.status === 'out') {
      if (p.injuryDays > 0) issues.push(`สำรอง ${p.name} เจ็บหนัก — ห้ามลง`)
      else if ((p.banMatches ?? 0) > 0) issues.push(`สำรอง ${p.name} ติดแบน`)
      else if ((p.leaveDays ?? 0) > 0) issues.push(`สำรอง ${p.name} ลา`)
      else if ((p.illnessDays ?? 0) > 0) issues.push(`สำรอง ${p.name} ป่วย — ห้ามลง`)
    } else if (med.status === 'limited') {
      issues.push(`สำรอง ${p.name} ลงได้แบบประคอง (stamina ~${med.staminaCap}%)`)
    }
  }
  return issues
}
