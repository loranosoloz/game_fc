import type { GameSave, MediaItem } from './types'
import type { NtCallUp, NtSnub, NtTeamDef } from './nationalTeams'
import { ntTeam } from './nationalTeams'
import { pickOutlet } from './mediaOutlets'
import { pushNews } from './media'

function story(
  save: GameSave,
  partial: Omit<MediaItem, 'id' | 'date' | 'channel'> & { idSuffix: string },
): MediaItem {
  const outlet = pickOutlet(save, partial.idSuffix.length + save.matchday)
  return {
    id: `news-nt-${partial.idSuffix}-${Date.now()}-${Math.abs(save.matchday * 31)}`,
    date: save.currentDate,
    channel: 'news',
    headline: partial.headline,
    body: partial.body,
    tone: partial.tone ?? 'neutral',
    tags: partial.tags,
    subjectName: partial.subjectName,
    outlet: partial.outlet ?? outlet.name,
  }
}

/** ข่าวเรียกตัว / ติดครั้งแรก / หลุดโผ จาก AI โค้ชชาติ */
export function pushNationalTeamNews(
  save: GameSave,
  callUps: NtCallUp[],
  snubs: NtSnub[],
  label: string,
): GameSave {
  let next = save
  const humanCalls = callUps.filter((c) => c.clubId === save.humanClubId)
  const humanSnubs = snubs.filter((s) => s.clubId === save.humanClubId)

  // ติดครั้งแรก — ข่าวเด่นต่อคน (สูงสุด 3)
  const debuts = humanCalls.filter((c) => c.firstCap).slice(0, 3)
  for (const c of debuts) {
    const team = ntTeam(c.nation)
    next = pushNews(
      next,
      story(next, {
        idSuffix: `debut-${c.playerId}`,
        headline: `${c.playerName} ติดทีมชาติ${c.nationTh}ครั้งแรก!`,
        body: [
          `${c.coachName} เปิดโผ${c.nationTh}ใน${label} — ${c.playerName} ได้แคปแรกของอาชีพ`,
          team ? `สไตล์โค้ช: ${team.styleLabelTh}` : null,
          c.reasons.length ? `เหตุผลหลัก: ${c.reasons.join(' · ')}` : null,
        ]
          .filter(Boolean)
          .join(' — '),
        tone: 'positive',
        tags: ['international', 'debut', 'callup', c.nation],
        subjectName: c.playerName,
      }),
    )
  }

  // เรียกตัวปกติ (ไม่ใช่ debut) — รวมสั้น ๆ หรือรายคนถ้ามีเหตุผลเด่น
  const regulars = humanCalls.filter((c) => !c.firstCap).slice(0, 4)
  for (const c of regulars) {
    const team = ntTeam(c.nation)
    next = pushNews(
      next,
      story(next, {
        idSuffix: `call-${c.playerId}`,
        headline: `${c.coachName} เรียก ${c.playerName} ติด${c.nationTh}`,
        body: [
          `โผทีมชาติ${c.nationTh} · ${label}`,
          team ? `โค้ชเล่นแนว「${team.styleLabelTh}」` : null,
          c.reasons.length ? `ทำไมถึงเรียก: ${c.reasons.join(' · ')}` : null,
          `คะแนนเข้าตาโค้ช ${c.score.toFixed(0)} (สไตล์ฟิต ${c.styleFit})`,
        ]
          .filter(Boolean)
          .join(' — '),
        tone: 'positive',
        tags: ['international', 'callup', c.nation],
        subjectName: c.playerName,
      }),
    )
  }

  // หลุดโผ — อธิบายทำไมไม่ติด
  for (const s of humanSnubs.slice(0, 3)) {
    const team = ntTeam(s.nation)
    const rivalBit = s.rivalName ? ` ที่นั่งสุดท้ายตกเป็นของ ${s.rivalName}` : ''
    next = pushNews(
      next,
      story(next, {
        idSuffix: `snub-${s.playerId}`,
        headline: `${s.playerName} หลุดโผทีมชาติ${s.nationTh}`,
        body: [
          `${s.coachName} ไม่เรียก ${s.playerName} ใน${label}${rivalBit}`,
          team ? `แนวเล่นโค้ช: ${team.styleLabelTh}` : null,
          `เหตุผล: ${s.reasons.join(' · ')}`,
          `คะแนน ${s.score.toFixed(0)} / เส้นตัด ${s.cutoffScore.toFixed(0)}`,
        ]
          .filter(Boolean)
          .join(' — '),
        tone: 'negative',
        tags: ['international', 'snub', s.nation],
        subjectName: s.playerName,
      }),
    )
  }

  // ภาพรวมถ้าไม่มีข่าว human เลย — ยังมีข่าวปฏิทิน
  if (humanCalls.length === 0 && humanSnubs.length === 0) {
    next = pushNews(
      next,
      story(next, {
        idSuffix: 'window',
        headline: `ช่วงทีมชาติ · ${label}`,
        body: 'โค้ชชาติเปิดแคมป์ตามสไตล์ตัวเอง — รอบนี้ไม่มีใครจากสโมสรคุณถูกเรียกหรือใกล้หลุดโผ',
        tone: 'neutral',
        tags: ['international', 'break'],
        outlet: 'FIFA Calendar',
      }),
    )
  }

  return next
}

export function coachStyleBlurb(team: NtTeamDef | null): string {
  if (!team) return ''
  return `${team.coach} · ${team.styleLabelTh}`
}
