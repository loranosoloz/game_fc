/**
 * Half-time / tactical window — แก้เกม + เปลี่ยนตัว (รวมสูงสุด MAX_MATCH_SUBS)
 */
import type {
  FormationId,
  MatchEvent,
  Mentality,
  Pressing,
  Tactics,
  TeamMatchStats,
  TeamTalkKind,
  Tempo,
  Width,
  Player,
} from '../types'
import type { TouchlineShout } from './touchlineShouts'
import { MAX_MATCH_SUBS } from './knockout'

export interface MatchMidState {
  homeGoals: number
  awayGoals: number
  homeStats: TeamMatchStats
  awayStats: TeamMatchStats
  events: MatchEvent[]
  matchYellows: Array<[string, number]>
  sentOffIds: string[]
  conditions: Record<string, number>
  /** พลังงานแมตช์หลังพักครึ่ง */
  matchStaminas?: Record<string, number>
  /** นาทีลงสะสมถึงพักครึ่ง */
  minutesOnPitch?: Record<string, number>
  homeXi: string[]
  awayXi: string[]
  possessing: 'home' | 'away'
  nextEid: number
  fidelity: 'human' | 'ai'
  /** จำนวนเปลี่ยนตัวที่ใช้ไปแล้ว (แยกฝั่ง) */
  homeSubsUsed: number
  awaySubsUsed: number
  /** @deprecated ใช้ home/away — คงไว้เพื่อเซฟเก่า */
  subsUsed?: number
  maxSubs: number
  /** นาทีล่าสุดที่ซิมถึง */
  clockMinute: number
}

export interface HalfTimeSub {
  outId: string
  inId: string
}

export interface HalfTimeAdjustments {
  formation?: FormationId
  formationOop?: FormationId
  mentality?: Mentality
  pressing?: Pressing
  tempo?: Tempo
  width?: Width
  subs?: HalfTimeSub[]
  teamTalk?: TeamTalkKind | null
  shouts?: TouchlineShout[]
  /** คำสั่งเจาะจงคู่แข่งกลางเกม */
  opposition?: import('../types').OppositionInstructions
}

export function subsRemaining(mid: Pick<MatchMidState, 'subsUsed' | 'maxSubs'>): number {
  return Math.max(0, (mid.maxSubs ?? MAX_MATCH_SUBS) - (mid.subsUsed ?? 0))
}

export function applyHalfTimeTactics(
  tactics: Tactics,
  adj: HalfTimeAdjustments,
  sentOffIds: Set<string>,
  maxNewSubs = 3,
): { tactics: Tactics; subsApplied: number } {
  let xi = [...tactics.startingXi]
  let bench = [...tactics.bench]
  const used = new Set<string>()
  let subsApplied = 0
  for (const sub of adj.subs ?? []) {
    if (subsApplied >= maxNewSubs) break
    if (used.has(sub.outId) || used.has(sub.inId)) continue
    if (sentOffIds.has(sub.outId)) continue
    const outIdx = xi.indexOf(sub.outId)
    const inOnBench = bench.includes(sub.inId)
    if (outIdx < 0 || !inOnBench) continue
    if (sentOffIds.has(sub.inId)) continue
    xi[outIdx] = sub.inId
    bench = bench.map((id) => (id === sub.inId ? sub.outId : id))
    used.add(sub.outId)
    used.add(sub.inId)
    subsApplied += 1
  }
  xi = xi.filter((id) => !sentOffIds.has(id))
  return {
    tactics: {
      ...tactics,
      formation: adj.formation ?? tactics.formation,
      formationOop: adj.formationOop ?? tactics.formationOop,
      startingXi: xi,
      bench,
      instructions: {
        ...tactics.instructions,
        mentality: adj.mentality ?? tactics.instructions.mentality,
        pressing: adj.pressing ?? tactics.instructions.pressing,
        tempo: adj.tempo ?? tactics.instructions.tempo,
        width: adj.width ?? tactics.instructions.width,
      },
      opposition: adj.opposition ?? tactics.opposition,
    },
    subsApplied,
  }
}

/** AI เปลี่ยนตัวอัตโนมัติเมื่อตามสกอร์ / หมดแรง */
export function aiAutoSubs(
  tactics: Tactics,
  players: Player[],
  conditions: Record<string, number>,
  trailing: boolean,
  remaining: number,
  rng: () => number,
  minute = 45,
): { tactics: Tactics; subs: HalfTimeSub[]; notes: string[] } {
  if (remaining <= 0) return { tactics, subs: [], notes: [] }
  const byId = new Map(players.map((p) => [p.id, p]))
  const notes: string[] = []
  const subs: HalfTimeSub[] = []
  let xi = [...tactics.startingXi]
  let bench = [...tactics.bench]
  const want = Math.min(remaining, trailing ? 2 : minute >= 60 ? 2 : 1)
  const fatigueLine = minute >= 75 ? 90 : minute >= 60 ? 84 : minute >= 45 ? 78 : 65
  for (let n = 0; n < want; n++) {
    const tired = [...xi]
      .map((id) => ({ id, c: conditions[id] ?? byId.get(id)?.condition ?? 70 }))
      .sort((a, b) => a.c - b.c)[0]
    if (!tired) break
    if (tired.c > fatigueLine && !(trailing && minute >= 55 && rng() < 0.5)) break
    const outP = byId.get(tired.id)
    const incoming = bench
      .map((id) => byId.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => {
        if (trailing) return b.overall - a.overall
        return (b.condition ?? 0) - (a.condition ?? 0)
      })[0]
    if (!outP || !incoming) break
    const subRoll = trailing ? 0.92 : minute >= 70 ? 0.82 : minute >= 55 ? 0.72 : 0.58
    if (rng() > subRoll) break
    const outIdx = xi.indexOf(tired.id)
    if (outIdx < 0) break
    xi[outIdx] = incoming.id
    bench = bench.map((id) => (id === incoming.id ? tired.id : id))
    subs.push({ outId: tired.id, inId: incoming.id })
    notes.push(`${outP.name} ↔ ${incoming.name}`)
    conditions[incoming.id] = incoming.condition
  }
  return {
    tactics: { ...tactics, startingXi: xi, bench },
    subs,
    notes,
  }
}

export function pickInjuryReplacement(
  tactics: Tactics,
  players: Player[],
  outId: string,
  sentOffIds: Set<string>,
): HalfTimeSub | null {
  const outP = players.find((p) => p.id === outId)
  if (!outP) return null
  const incoming = tactics.bench
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => !!p && !sentOffIds.has(p.id))
    .sort((a, b) => {
      const score = (p: Player) =>
        p.overall +
        (p.role === outP.role ? 12 : 0) +
        (p.position === outP.position ? 6 : 0)
      return score(b) - score(a)
    })[0]
  if (!incoming || !tactics.startingXi.includes(outId)) return null
  return { outId, inId: incoming.id }
}

export function halfTimeScoreLine(home: number, away: number, humanIsHome: boolean): string {
  const trail = humanIsHome ? home - away : away - home
  if (trail > 0) return 'นำอยู่ — คุมเกมหรือปิดเกม'
  if (trail < 0) return 'ตามอยู่ — เวลาแก้เกม'
  return 'เสมอกัน — เลือกแผนครึ่งหลัง'
}

export { MAX_MATCH_SUBS }
