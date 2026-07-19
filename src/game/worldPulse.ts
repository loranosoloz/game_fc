import type { GameSave, WorldPulseState, WorldLeaguePulse, WorldPulseClubRow } from './types'
import { ALL_LEAGUES, type LeagueId } from '@/data/world'
import { isEuropeLeague } from './europeAccess'

export type { WorldPulseState, WorldLeaguePulse }

function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function blankTable(league: (typeof ALL_LEAGUES)[0]): WorldPulseClubRow[] {
  return league.clubs.map((c) => ({
    key: c.key,
    name: c.name,
    shortName: c.shortName,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
    rep: c.rep,
  }))
}

function sortTable(rows: WorldPulseClubRow[]): WorldPulseClubRow[] {
  return rows.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

function applyResult(
  rows: WorldPulseClubRow[],
  homeKey: string,
  awayKey: string,
  hg: number,
  ag: number,
): WorldPulseClubRow[] {
  return rows.map((r) => {
    if (r.key === homeKey) {
      const won = hg > ag
      const drawn = hg === ag
      return {
        ...r,
        played: r.played + 1,
        won: r.won + (won ? 1 : 0),
        drawn: r.drawn + (drawn ? 1 : 0),
        lost: r.lost + (!won && !drawn ? 1 : 0),
        gf: r.gf + hg,
        ga: r.ga + ag,
        points: r.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    if (r.key === awayKey) {
      const won = ag > hg
      const drawn = hg === ag
      return {
        ...r,
        played: r.played + 1,
        won: r.won + (won ? 1 : 0),
        drawn: r.drawn + (drawn ? 1 : 0),
        lost: r.lost + (!won && !drawn ? 1 : 0),
        gf: r.gf + ag,
        ga: r.ga + hg,
        points: r.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    return r
  })
}

/** ซิมนัดหนึ่งจากค่า rep + ความฟอร์มจากแต้ม */
function simScore(
  home: WorldPulseClubRow,
  away: WorldPulseClubRow,
  rng: () => number,
): { hg: number; ag: number } {
  const hStr = home.rep / 100 + (home.points - away.points) * 0.01 + 0.08
  const aStr = away.rep / 100 + (away.points - home.points) * 0.01
  const hg = Math.max(0, Math.min(5, Math.floor(rng() * 2.4 + hStr * 1.8 + (rng() < 0.12 ? 1 : 0))))
  const ag = Math.max(0, Math.min(5, Math.floor(rng() * 2.2 + aStr * 1.6 + (rng() < 0.1 ? 1 : 0))))
  return { hg, ag }
}

/** จับคู่ครึ่งตารางต่อแมตช์เดย์ (หมุนเวียน) */
function pairRound(keys: string[], matchday: number): Array<[string, string]> {
  const n = keys.length
  if (n < 2) return []
  const arr = keys.slice()
  // circle method rotation
  const fixed = arr[0]!
  const rest = arr.slice(1)
  const rot = ((matchday - 1) % Math.max(1, rest.length) + rest.length) % Math.max(1, rest.length)
  const rotated = [...rest.slice(rot), ...rest.slice(0, rot)]
  const circle = [fixed, ...rotated]
  const pairs: Array<[string, string]> = []
  for (let i = 0; i < n / 2; i++) {
    const a = circle[i]!
    const b = circle[n - 1 - i]!
    if (matchday % 2 === 0) pairs.push([b, a])
    else pairs.push([a, b])
  }
  return pairs
}

export function createWorldPulse(homeLeagueId: string): WorldPulseState {
  const leagues = ALL_LEAGUES.filter((l) => l.id !== homeLeagueId)
    .slice(0, 10)
    .map((l) => {
      const table = blankTable(l)
      const sorted = sortTable(table)
      return {
        leagueId: l.id,
        name: l.name,
        nameTh: l.nameTh,
        matchday: 0,
        leader: sorted[0]?.name ?? '—',
        second: sorted[1]?.name ?? '—',
        note: 'เปิดฤดูกาล · ตารางจำลองเต็ม',
        orderedKeys: sorted.map((c) => c.key),
        table,
        recentResults: [] as string[],
        euroNote: isEuropeLeague(l.id)
          ? 'โควตาคาดการณ์: 1–4 UCL · 5–6 UEL · 7–8 UECL'
          : undefined,
      } satisfies WorldLeaguePulse
    })
  return { leagues, lastUpdateMatchday: -1 }
}

export function ensureWorldPulse(save: GameSave): WorldPulseState {
  if (!save.worldPulse) return createWorldPulse(save.leagueId || 'eng')
  // migrate เซฟเก่าที่ไม่มี table
  const leagues = save.worldPulse.leagues.map((row) => {
    if (row.table?.length) return row
    const league = ALL_LEAGUES.find((l) => l.id === row.leagueId)
    if (!league) return row
    const table = blankTable(league)
    return {
      ...row,
      table,
      recentResults: row.recentResults ?? [],
      euroNote:
        row.euroNote ??
        (isEuropeLeague(row.leagueId)
          ? 'โควตาคาดการณ์: 1–4 UCL · 5–6 UEL · 7–8 UECL'
          : undefined),
    }
  })
  return { ...save.worldPulse, leagues }
}

/**
 * ซิมลีกอื่นแบบเต็มรอบแมตช์เดย์ — คู่จริงจากตาราง · คะแนน/GD สะสม
 * (ไม่สร้าง Player ของลีกอื่น — ใช้คลับจากแพ็กโลก)
 */
export function tickWorldPulse(save: GameSave): GameSave {
  let pulse = ensureWorldPulse(save)
  if (pulse.lastUpdateMatchday === save.matchday) return { ...save, worldPulse: pulse }

  const leagues = pulse.leagues.map((row) => {
    const league = ALL_LEAGUES.find((l) => l.id === row.leagueId)
    if (!league) return { ...row, matchday: save.matchday }

    let table = (row.table?.length ? row.table : blankTable(league)).map((r) => {
      const def = league.clubs.find((c) => c.key === r.key)
      return def ? { ...r, rep: def.rep, name: def.name, shortName: def.shortName } : r
    })

    const md = save.matchday
    const rng = mulberry(save.season * 7919 + md * 97 + row.leagueId.length * 13)
    const keys = table.map((t) => t.key)
    const pairs = pairRound(keys, Math.max(1, md))
    const results: string[] = []

    for (const [hk, ak] of pairs) {
      const home = table.find((t) => t.key === hk)!
      const away = table.find((t) => t.key === ak)!
      const { hg, ag } = simScore(home, away, rng)
      table = applyResult(table, hk, ak, hg, ag)
      results.push(`${home.shortName} ${hg}–${ag} ${away.shortName}`)
    }

    const sorted = sortTable(table)
    const leader = sorted[0]!
    const second = sorted[1]!
    const third = sorted[2]
    const gap = leader.points - second.points
    const bottom = sorted[sorted.length - 1]!
    const relegZone = sorted.slice(-3).map((r) => r.shortName).join('/')

    let note = `${leader.shortName} นำ ${leader.points} แต้ม`
    if (gap >= 8) note = `${leader.name} ทิ้งห่างแชมป์ · +${gap} แต้ม`
    else if (gap <= 2 && third)
      note = `แย่งแชมป์เดือด · ${leader.shortName}/${second.shortName}/${third.shortName}`
    if (bottom.played >= 6 && bottom.points <= Math.max(3, md)) {
      note += ` · โซนตกชั้นตึง (${relegZone})`
    }

    const top4 = sorted.slice(0, 4).map((r) => r.shortName).join(', ')
    const euroNote = isEuropeLeague(row.leagueId)
      ? `โควตาคาดการณ์ UCL: ${top4}`
      : undefined

    return {
      ...row,
      matchday: md,
      leader: leader.name,
      second: second.name,
      note,
      orderedKeys: sorted.map((s) => s.key),
      table: sorted,
      recentResults: results.slice(0, 6),
      euroNote,
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
