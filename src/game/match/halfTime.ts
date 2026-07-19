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
): { tactics: Tactics; subs: HalfTimeSub[]; notes: string[] } {
  if (remaining <= 0) return { tactics, subs: [], notes: [] }
  const byId = new Map(players.map((p) => [p.id, p]))
  const notes: string[] = []
  const subs: HalfTimeSub[] = []
  let xi = [...tactics.startingXi]
  let bench = [...tactics.bench]
  const want = Math.min(remaining, trailing ? 2 : 1)
  for (let n = 0; n < want; n++) {
    const tired = [...xi]
      .map((id) => ({ id, c: conditions[id] ?? byId.get(id)?.condition ?? 70 }))
      .sort((a, b) => a.c - b.c)[0]
    if (!tired || tired.c > 62) break
    const outP = byId.get(tired.id)
    const incoming = bench
      .map((id) => byId.get(id))
      .filter((p): p is Player => !!p)
      .sort((a, b) => {
        if (trailing) return b.overall - a.overall
        return (b.condition ?? 0) - (a.condition ?? 0)
      })[0]
    if (!outP || !incoming) break
    if (rng() > (trailing ? 0.85 : 0.55)) break
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

export function halfTimeScoreLine(home: number, away: number, humanIsHome: boolean): string {
  const trail = humanIsHome ? home - away : away - home
  if (trail > 0) return 'นำอยู่ — คุมเกมหรือปิดเกม'
  if (trail < 0) return 'ตามอยู่ — เวลาแก้เกม'
  return 'เสมอกัน — เลือกแผนครึ่งหลัง'
}

export { MAX_MATCH_SUBS }
