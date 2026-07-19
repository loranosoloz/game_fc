import type { FormationId, GameSave, OppositionReport } from './types'
import { roleShort } from './positions'

export function buildOppositionReport(save: GameSave, opponentId: string): OppositionReport {
  const tactics = save.tacticsByClub[opponentId]
  const squad = save.players
    .filter((p) => p.clubId === opponentId && p.injuryDays <= 0 && (p.illnessDays ?? 0) <= 0)
    .sort((a, b) => b.overall - a.overall)
  const avg = squad.slice(0, 11).reduce((s, p) => s + p.overall, 0) / Math.max(1, Math.min(11, squad.length))
  const threats = squad.slice(0, 3)

  const weaknessByFormation: Record<FormationId, string> = {
    '4-3-3': 'ช่องว่างระหว่างแบ็กกับปีกตอนถูกโต้กลับ',
    '4-4-2': 'แดนกลางแน่นยาก — ถ้าครองบอลกลางได้จะคุมเกม',
    '4-2-3-1': 'ปีกหลังอาจโล่งถ้า CAM ดันสูง',
  }

  const style = tactics.instructions.style
  const advice =
    style === 'counter'
      ? 'อย่าเสียบอลแดนกลาง — พวกเขาพร้อมพุ่งโต้'
      : style === 'possession'
        ? 'กดสูงช่วงออกบอล แล้วปิดช่องผ่านกลาง'
        : 'เล่นสมดุล รอจังหวะผิดพลาดจากแนวรับ'

  return {
    opponentId,
    formation: tactics.formation,
    strength: Math.round(avg),
    weakness: weaknessByFormation[tactics.formationOop] ?? weaknessByFormation[tactics.formation],
    threatPlayers: threats.map((p) => `${p.name} (${roleShort(p.role)} ${p.overall})`),
    advice: `แผนคู่แข่ง IP ${tactics.formation} / OOP ${tactics.formationOop} · กด ${tactics.instructions.pressing} · ${advice}`,
  }
}
