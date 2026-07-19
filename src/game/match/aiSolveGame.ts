/**
 * AI แก้เกมตลอดนัด — แผน / mentality / pressing / เปลี่ยนตัว
 * ตามสกอร์ · นาที · สไตล์โค้ช (solveGame / inGameLosing / inGameWinning)
 */
import type { FormationId, Mentality, Player, Pressing, Tactics, Tempo, Width } from '../types'
import type { WorldCoach } from '../worldCoaches'
import { aiAutoSubs, type HalfTimeSub } from './halfTime'
import { MAX_MATCH_SUBS } from './knockout'

export interface AiSolveContext {
  tactics: Tactics
  players: Player[]
  conditions: Record<string, number>
  ourGoals: number
  theirGoals: number
  minute: number
  remainingSubs: number
  coach: WorldCoach | null | undefined
  rng: () => number
  sentOffIds?: Set<string>
}

export interface AiSolveResult {
  tactics: Tactics
  subs: HalfTimeSub[]
  notes: string[]
  /** สำหรับฟีดแมตช์ */
  shout: string | null
}

function goalDiff(our: number, their: number) {
  return our - their
}

function pickAttackingForm(current: FormationId, coach?: WorldCoach | null): FormationId {
  const prefer = coach?.preferredFormation
  const attacking: FormationId[] = ['4-2-1-3', '4-2-4', '4-3-3', '3-4-3', '4-2-3-1']
  if (prefer && attacking.includes(prefer)) return prefer
  if (current === '5-4-1' || current === '5-3-2' || current === '4-5-1') return '4-2-3-1'
  if (current === '4-1-4-1') return '4-2-3-1'
  return attacking.includes(current) ? current : '4-3-3'
}

function pickDefensiveForm(current: FormationId, coach?: WorldCoach | null): FormationId {
  const oop = coach?.formationOop
  const defensive: FormationId[] = ['5-4-1', '5-3-2', '4-5-1', '4-1-4-1', '4-4-2']
  if (oop && defensive.includes(oop)) return oop
  if (current.startsWith('3-')) return '5-3-2'
  return defensive.includes(current) ? current : '4-5-1'
}

function solveLabels(coach: WorldCoach | null | undefined): string[] {
  return coach?.solveGame ?? []
}

/**
 * AI ปรับแผนทั้งชุดตามสถานการณ์ — เรียกได้ทุกจังหวะสำคัญ
 */
export function aiSolveGame(ctx: AiSolveContext): AiSolveResult {
  const diff = goalDiff(ctx.ourGoals, ctx.theirGoals)
  const late = ctx.minute >= 75
  const mid = ctx.minute >= 55 && ctx.minute < 75
  const early2h = ctx.minute >= 45 && ctx.minute < 55
  const notes: string[] = []
  const solve = solveLabels(ctx.coach)
  const rng = ctx.rng

  let mentality: Mentality = ctx.tactics.instructions.mentality
  let pressing: Pressing = ctx.tactics.instructions.pressing
  let tempo: Tempo = ctx.tactics.instructions.tempo
  let width: Width = ctx.tactics.instructions.width
  let formation = ctx.tactics.formation
  let formationOop = ctx.tactics.formationOop

  // —— ตามสกอร์ ——
  if (diff <= -2) {
    mentality = 'attacking'
    pressing = solve.includes('gegenpress') || solve.includes('press') ? 'high' : 'high'
    tempo = 'fast'
    width = 'wide'
    formation = pickAttackingForm(formation, ctx.coach)
    formationOop = formation
    notes.push('ตามสองลูก — เปิดเกมบุกเต็ม')
  } else if (diff === -1) {
    mentality = 'attacking'
    pressing = solve.includes('low_block') ? 'medium' : 'high'
    tempo = late ? 'fast' : 'normal'
    width = solve.includes('wing_play') ? 'wide' : 'normal'
    if (late || mid) formation = pickAttackingForm(formation, ctx.coach)
    notes.push('ตามหนึ่ง — ดันไล่ตีเสมอ')
  } else if (diff === 0) {
    if (late) {
      mentality = 'attacking'
      pressing = 'medium'
      tempo = 'fast'
      notes.push('เสมอช่วงท้าย — หาประตูชัย')
    } else if (early2h) {
      mentality = ctx.coach?.mentality ?? 'balanced'
      pressing = ctx.coach?.pressing ?? 'medium'
      notes.push('เสมอต้นครึ่งหลัง — คุมจังหวะ')
    } else {
      mentality = ctx.coach?.mentality ?? mentality
      pressing = ctx.coach?.pressing ?? pressing
    }
  } else if (diff === 1) {
    if (late) {
      mentality = 'defensive'
      pressing = 'low'
      tempo = 'slow'
      formationOop = pickDefensiveForm(formationOop, ctx.coach)
      notes.push('นำหนึ่งช่วงท้าย — ล็อคผล')
    } else {
      mentality = 'balanced'
      pressing = solve.includes('gegenpress') ? 'high' : 'medium'
      notes.push('นำหนึ่ง — คุมเกมไม่ประมาท')
    }
  } else {
    // leading 2+
    mentality = 'defensive'
    pressing = 'low'
    tempo = 'slow'
    width = 'narrow'
    formation = pickDefensiveForm(formation, ctx.coach)
    formationOop = pickDefensiveForm(formationOop, ctx.coach)
    notes.push('นำขาด — รถบัส / ถ่วงเวลา')
  }

  // —— สไตล์โค้ชทับบางส่วน ——
  if (diff < 0 && solve.includes('transitions')) {
    tempo = 'fast'
    notes.push('เน้นสวนกลับ')
  }
  if (diff < 0 && solve.includes('positional')) {
    width = 'wide'
    pressing = 'medium'
  }
  if (diff > 0 && solve.includes('low_block')) {
    formationOop = '5-4-1'
    pressing = 'low'
  }
  if (solve.includes('set_pieces') && diff <= 0 && late) {
    notes.push('ลุ้นลูกตั้ง')
  }

  let tactics: Tactics = {
    ...ctx.tactics,
    formation,
    formationOop,
    instructions: {
      ...ctx.tactics.instructions,
      mentality,
      pressing,
      tempo,
      width,
    },
  }

  // —— เปลี่ยนตัว ——
  const trailing = diff < 0
  const protectLead = diff > 0 && late
  const wantSubs =
    trailing || protectLead || (diff === 0 && late) || (mid && rng() < 0.45) || (early2h && trailing)

  let subs: HalfTimeSub[] = []
  if (wantSubs && ctx.remainingSubs > 0) {
    const auto = aiAutoSubs(
      tactics,
      ctx.players,
      ctx.conditions,
      trailing || (diff === 0 && late),
      ctx.remainingSubs,
      rng,
    )
    tactics = auto.tactics
    subs = auto.subs
    notes.push(...auto.notes.map((n) => `ซับ: ${n}`))
  }

  // ถ้าตามและยังเหลือซับ — พยายามเอาตัวโจมตีจากม้านั่งเพิ่ม 1 คน
  if (trailing && ctx.remainingSubs - subs.length > 0 && rng() < 0.55) {
    const byId = new Map(ctx.players.map((p) => [p.id, p]))
    const xi = [...tactics.startingXi]
    const bench = [...tactics.bench]
    const weakAtk = xi
      .map((id) => byId.get(id))
      .filter((p): p is Player => !!p && (p.position === 'FW' || p.role === 'CAM'))
      .sort((a, b) => (ctx.conditions[a.id] ?? a.condition) - (ctx.conditions[b.id] ?? b.condition))[0]
    const fresh = bench
      .map((id) => byId.get(id))
      .filter((p): p is Player => !!p && (p.position === 'FW' || p.role === 'ST' || p.role === 'LW' || p.role === 'RW'))
      .sort((a, b) => b.overall - a.overall)[0]
    if (weakAtk && fresh && !subs.some((s) => s.outId === weakAtk.id)) {
      const idx = xi.indexOf(weakAtk.id)
      if (idx >= 0) {
        xi[idx] = fresh.id
        const nextBench = bench.map((id) => (id === fresh.id ? weakAtk.id : id))
        tactics = { ...tactics, startingXi: xi, bench: nextBench }
        subs = [...subs, { outId: weakAtk.id, inId: fresh.id }]
        notes.push(`ซับรุก: ${weakAtk.name} ↔ ${fresh.name}`)
      }
    }
  }

  const shout =
    diff < 0
      ? ctx.coach?.inGameLosing
        ? `AI แก้เกม: ${ctx.coach.inGameLosing}`
        : `AI เปิดเกมไล่ (${mentality}/${pressing})`
      : diff > 0
        ? ctx.coach?.inGameWinning
          ? `AI คุมเกม: ${ctx.coach.inGameWinning}`
          : `AI ล็อคผล (${mentality}/${pressing})`
        : `AI ปรับแผน (${formation} · ${mentality})`

  return { tactics, subs, notes, shout }
}

export function clubSubsUsed(
  mid: { homeSubsUsed?: number; awaySubsUsed?: number; subsUsed?: number },
  side: 'home' | 'away',
): number {
  if (side === 'home') return mid.homeSubsUsed ?? 0
  return mid.awaySubsUsed ?? 0
}

export { MAX_MATCH_SUBS }
