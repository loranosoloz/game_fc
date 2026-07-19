import type { FormationId, GameSave, OppositionReport } from './types'
import { formationLabel } from './types'
import { roleShort } from './positions'
import { coachBlurb, getWorldCoach, styleLabelTh } from './worldCoaches'

export function buildOppositionReport(save: GameSave, opponentId: string): OppositionReport {
  const tactics = save.tacticsByClub[opponentId]
  const oppClub = save.clubs.find((c) => c.id === opponentId)
  const coach = getWorldCoach(oppClub?.coachId)
  const squad = save.players
    .filter((p) => p.clubId === opponentId && p.injuryDays <= 0 && (p.illnessDays ?? 0) <= 0)
    .sort((a, b) => b.overall - a.overall)
  const avg =
    squad.slice(0, 11).reduce((s, p) => s + p.overall, 0) / Math.max(1, Math.min(11, squad.length))
  const threats = squad.slice(0, 3)

  const weaknessByFormation: Record<FormationId, string> = {
    '4-4-2': 'แดนกลางตรงกลาง — โดนรุม 3 ต่อ 2 ง่าย',
    '4-4-2-diamond': 'ปีกโล่ง — ต้องพึ่งแบ็กเติมเกม',
    '4-3-3': 'ช่องว่างระหว่างแบ็กกับปีกตอนถูกโต้กลับ',
    '4-3-3-false9': 'ไม่มีหน้าเป้าชัด — กรอบเขตโทษคู่อาจว่าง',
    '4-2-3-1': 'ปีกหลังอาจโล่งถ้า CAM/ปีกดันสูง',
    '4-1-4-1': 'แนวรุกบาง — ถ้าถูกกดสูงยากสวน',
    '4-3-2-1': 'ปีกแคบ — โดนเปิดข้างง่าย',
    '3-5-2': 'ปีกโล่งเมื่อวิงแบ็กยกสูง',
    '3-4-3': 'กลาง 2 คนแบกแรงกดหนัก',
    '3-4-2-1': 'ปีกหลังวิงแบ็กเป็นจุดบอด',
    '3-1-4-2': 'ปีกบางถ้าแบ็กไม่เติม',
    '5-3-2': 'พื้นที่ริมเส้นบาง — โดนรุมปีกง่าย',
    '5-4-1': 'เกมรุกช้า — โดนกดในแดนตัวเอง',
    '3-4-3-diamond': 'ช่องระหว่าง MF–CB ถ้าเพรสไม่ติด',
    '4-2-4': 'กลางบางมาก — เสียบอลแล้วโดนโต้',
    '4-2-2-2': 'ปีกโล่ง — โดนเปิดข้าง',
    '4-5-1': 'แนวรุกบาง — ยากจบสกอร์',
    '3-3-3-1': 'กรอบเขตโทษตัวเองบางถ้าเพรสสูงพลาด',
    '3-6-1': 'หน้าเป้าเดียว — จบสกอร์ยาก',
    '4-2-1-3': 'ช่องระหว่าง MF–CB ตอนโต้กลับ',
  }

  const style = coach?.style ?? tactics.instructions.style
  const coachWeak =
    coach && coach.weakVs.length > 0
      ? `โค้ช${coach.name} ไม่ถนัด: ${coach.weakVs.slice(0, 2).map(styleLabelTh).join(', ')}`
      : null
  const formWeak = weaknessByFormation[tactics.formationOop] ?? weaknessByFormation[tactics.formation]

  const advice =
    style === 'counter' || style === 'direct'
      ? 'อย่าเสียบอลแดนกลาง — พวกเขาพร้อมพุ่งโต้'
      : style === 'possession'
        ? 'กดสูงช่วงออกบอล แล้วปิดช่องผ่านกลาง'
        : style === 'press'
          ? 'เล่นสั้นหลังแนวเพรส หรือโยงยาวข้ามเพรส'
          : style === 'low_block'
            ? 'อย่าใจร้อน — เปิดปีก / ลูกตั้งเตะ / เปลี่ยนจังหวะ'
            : 'เล่นสมดุล รอจังหวะผิดพลาดจากแนวรับ'

  const coachLine = coach
    ? `โค้ช ${coach.name} (พลัง ${coach.power}) · ${coach.styleLabelTh}`
    : null

  return {
    opponentId,
    formation: tactics.formation,
    strength: Math.round(avg),
    weakness: [coachWeak, formWeak].filter(Boolean).join(' · ') || formWeak,
    threatPlayers: threats.map((p) => `${p.name} (${roleShort(p.role)} ${p.overall})`),
    advice: [
      coachLine,
      coach ? coachBlurb(coach) : null,
      `แผนคู่แข่ง IP ${formationLabel(tactics.formation, true)} / OOP ${formationLabel(tactics.formationOop, true)} · กด ${tactics.instructions.pressing}`,
      advice,
    ]
      .filter(Boolean)
      .join(' — '),
  }
}
