import type { GameSave, WorldPulseState, WorldLeaguePulse } from './types'
import { ALL_LEAGUES, type LeagueId } from '@/data/world'
import { isEuropeLeague } from './europeAccess'

export type { WorldPulseState, WorldLeaguePulse }

export function createWorldPulse(homeLeagueId: string): WorldPulseState {
  const leagues = ALL_LEAGUES.filter((l) => l.id !== homeLeagueId)
    .slice(0, 8)
    .map((l) => {
      const sorted = l.clubs.slice().sort((a, b) => b.rep - a.rep)
      return {
        leagueId: l.id,
        name: l.name,
        nameTh: l.nameTh,
        matchday: 0,
        leader: sorted[0]?.name ?? '—',
        second: sorted[1]?.name ?? '—',
        note: 'เปิดฤดูกาล',
        orderedKeys: sorted.map((c) => c.key),
      }
    })
  return { leagues, lastUpdateMatchday: -1 }
}

export function ensureWorldPulse(save: GameSave): WorldPulseState {
  if (!save.worldPulse) return createWorldPulse(save.leagueId || 'eng')
  return save.worldPulse
}

/** อัปเดตตารางลีกอื่นแบบเบา — สุ่มคะแนน + เก็บอันดับคีย์ */
export function tickWorldPulse(save: GameSave): GameSave {
  let pulse = ensureWorldPulse(save)
  if (pulse.lastUpdateMatchday === save.matchday) return { ...save, worldPulse: pulse }

  const leagues = pulse.leagues.map((row) => {
    const league = ALL_LEAGUES.find((l) => l.id === row.leagueId)
    if (!league) return { ...row, matchday: save.matchday }
    const clubs = league.clubs.slice()
    const scored = clubs.map((c) => ({
      key: c.key,
      name: c.name,
      pts: Math.round(c.rep * 0.35 + Math.random() * 18 + save.matchday * (0.4 + Math.random() * 0.5)),
    }))
    scored.sort((a, b) => b.pts - a.pts)
    const leader = scored[0]
    const second = scored[1]
    const note =
      leader.pts - second.pts >= 8
        ? `${leader.name} ทิ้งห่าง`
        : `${leader.name} นำเฉียด ${second.name}`
    return {
      ...row,
      matchday: save.matchday,
      leader: leader.name,
      second: second.name,
      note,
      orderedKeys: scored.map((s) => s.key),
    }
  })

  return {
    ...save,
    worldPulse: { leagues, lastUpdateMatchday: save.matchday },
  }
}

export function homeLeagueLabel(save: GameSave): string {
  const id = (save.leagueId || 'eng') as LeagueId
  return ALL_LEAGUES.find((l) => l.id === id)?.nameTh ?? save.leagueName
}

export function europePulseNote(save: GameSave): string {
  if (!isEuropeLeague(save.leagueId || 'eng')) {
    return 'ลีกนอกยุโรป — ไม่มีโควตา UCL / Europa / Conference'
  }
  return 'โควตา: อันดับ 1–4 UCL · 5–6 Europa · 7–8 Conference (ตัดจากจบฤดูกาลก่อน)'
}
