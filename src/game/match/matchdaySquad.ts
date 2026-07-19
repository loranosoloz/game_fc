/**
 * Matchday squad — ตัวจริง 11 + ตัวสำรองบนม้านั่ง
 */
import type { GameSave, Player, Tactics } from '../types'
import { isUnavailable } from '../discipline'

/** จำนวนตัวสำรองมาตรฐานบนม้านั่ง */
export const MATCH_BENCH_SIZE = 7

/** ขั้นต่ำที่ยืนยัน XI ได้ (นอกจากตัวจริง 11) */
export const MIN_BENCH_REQUIRED = 5

export function availableSquadPlayers(save: GameSave, clubId: string): Player[] {
  return save.players
    .filter((p) => p.clubId === clubId && !isUnavailable(p))
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
): Tactics {
  const pool = availableSquadPlayers(save, clubId)
  return fillBench(tactics, pool, MATCH_BENCH_SIZE)
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
    if (p.injuryDays > 0) issues.push(`สำรอง ${p.name} เจ็บอยู่`)
    if ((p.banMatches ?? 0) > 0) issues.push(`สำรอง ${p.name} ติดแบน`)
    if ((p.leaveDays ?? 0) > 0) issues.push(`สำรอง ${p.name} ลา`)
    if ((p.illnessDays ?? 0) > 0) issues.push(`สำรอง ${p.name} ป่วย`)
  }
  return issues
}
