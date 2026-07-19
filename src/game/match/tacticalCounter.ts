/**
 * Tactical Counter-Adaptation — AI อ่านแผนคู่แข่งแล้วตอบโต้
 */
import type { FormationId, Mentality, Pressing, Tactics, Tempo, Width } from '../types'

export interface OpponentScan {
  possessionShare: number
  formation: FormationId
  mentality: Mentality
  pressing: Pressing
  ourGoals: number
  theirGoals: number
  minute: number
}

export interface CounterAdaptation {
  formation?: FormationId
  formationOop?: FormationId
  mentality?: Mentality
  pressing?: Pressing
  tempo?: Tempo
  width?: Width
  note: string
}

function isTriangularAttack(f: FormationId): boolean {
  return (
    f === '4-3-3' ||
    f === '4-2-3-1' ||
    f === '4-2-1-3' ||
    f === '3-4-3' ||
    f === '4-2-4'
  )
}

function isWideAttack(f: FormationId, width: Width): boolean {
  return width === 'wide' || f.includes('3-4') || f === '4-2-4'
}

/**
 * Parser: สแกน Matrix คู่แข่ง → แผนตอบโต้
 * เรียกทุก ~15' หรือหลังประตู
 */
export function parseTacticalCounter(
  opp: OpponentScan,
  our: Tactics,
  rng: () => number,
): CounterAdaptation | null {
  const trailing = opp.ourGoals < opp.theirGoals
  const leading = opp.ourGoals > opp.theirGoals
  const late = opp.minute >= 70

  // คู่แข่งครองเกมหนัก + แผนสามเหลี่ยมบุก → Low Block Counter
  if (opp.possessionShare >= 0.62 && isTriangularAttack(opp.formation) && !trailing) {
    return {
      formation: '4-5-1',
      formationOop: '5-4-1',
      mentality: 'defensive',
      pressing: 'low',
      tempo: 'slow',
      width: 'narrow',
      note: 'อ่านแผนสามเหลี่ยมคู่แข่ง — ถอย Low Block Counter (4-5-1)',
    }
  }

  // คู่แข่งบุกกว้าง + นำอยู่ → ปิดปีก + สวน
  if (leading && isWideAttack(opp.formation, 'wide') && opp.mentality === 'attacking') {
    return {
      formationOop: '5-3-2',
      mentality: 'balanced',
      pressing: 'medium',
      tempo: 'fast',
      width: 'narrow',
      note: 'คู่แข่งเปิดกว้าง — ปิดช่องปีกแล้วรอสวน',
    }
  }

  // เราตามหลัง + คู่แข่งถอยรับ → ต้องเปิดเกม
  if (trailing && (opp.mentality === 'defensive' || opp.pressing === 'low')) {
    return {
      formation: late ? '4-2-1-3' : '4-2-3-1',
      mentality: 'attacking',
      pressing: 'high',
      tempo: 'fast',
      width: 'wide',
      note: 'คู่แข่งล็อคเกม — เปิดเกมบุกหาเสมอ',
    }
  }

  // คู่แข่งเพรสสูง → เล่นสั้นผ่านเพรส / หรือเตะยาว
  if (opp.pressing === 'high' && opp.possessionShare < 0.48 && rng() < 0.55) {
    return {
      mentality: 'balanced',
      pressing: 'medium',
      tempo: 'fast',
      note: 'เจอเพรสสูง — สลับจังหวะผ่านเพรส',
    }
  }

  // นำช่วงท้าย + คู่แข่งยังบุก → รถบัส
  if (leading && late && opp.mentality === 'attacking') {
    return {
      formation: '5-4-1',
      formationOop: '5-4-1',
      mentality: 'defensive',
      pressing: 'low',
      tempo: 'slow',
      width: 'narrow',
      note: 'นำท้ายเกม — รถบัสปิดช่อง',
    }
  }

  return null
}

export function applyCounterToTactics(tactics: Tactics, c: CounterAdaptation): Tactics {
  return {
    ...tactics,
    formation: c.formation ?? tactics.formation,
    formationOop: c.formationOop ?? tactics.formationOop,
    instructions: {
      ...tactics.instructions,
      mentality: c.mentality ?? tactics.instructions.mentality,
      pressing: c.pressing ?? tactics.instructions.pressing,
      tempo: c.tempo ?? tactics.instructions.tempo,
      width: c.width ?? tactics.instructions.width,
    },
  }
}
