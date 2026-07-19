import type { Club, ClubRivalry, GameSave, RivalryOrigin, TableRow } from './types'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function pairKey(a: string, b: string) {
  return a < b ? `${a}__${b}` : `${b}__${a}`
}

export function ensureRivalries(save: GameSave): ClubRivalry[] {
  return save.rivalries ?? []
}

export function areRivals(save: GameSave, clubAId: string, clubBId: string): boolean {
  if (clubAId === clubBId) return false
  const key = pairKey(clubAId, clubBId)
  return ensureRivalries(save).some((r) => pairKey(r.clubAId, r.clubBId) === key && r.heat >= 25)
}

export function getRivalClubIds(save: GameSave, clubId: string): string[] {
  return ensureRivalries(save)
    .filter((r) => r.heat >= 25 && (r.clubAId === clubId || r.clubBId === clubId))
    .map((r) => (r.clubAId === clubId ? r.clubBId : r.clubAId))
}

export function findRivalry(
  save: GameSave,
  clubAId: string,
  clubBId: string,
): ClubRivalry | undefined {
  const key = pairKey(clubAId, clubBId)
  return ensureRivalries(save).find((r) => pairKey(r.clubAId, r.clubBId) === key)
}

/**
 * เพิ่ม/เร่งความร้อนคู่อริ
 * เกิดใหม่ได้ถ้ายังไม่มีคู่
 */
export function heatRivalry(
  save: GameSave,
  clubAId: string,
  clubBId: string,
  heatDelta: number,
  origin: RivalryOrigin,
  labelTh: string,
): GameSave {
  if (clubAId === clubBId) return save
  const list = [...ensureRivalries(save)]
  const key = pairKey(clubAId, clubBId)
  const idx = list.findIndex((r) => pairKey(r.clubAId, r.clubBId) === key)
  if (idx >= 0) {
    const cur = list[idx]!
    list[idx] = {
      ...cur,
      heat: Math.min(100, cur.heat + heatDelta),
      labelTh: cur.heat + heatDelta >= cur.heat ? labelTh || cur.labelTh : cur.labelTh,
      origin: cur.origin === 'seed' ? cur.origin : origin,
    }
  } else {
    list.push({
      id: uid('riv'),
      clubAId,
      clubBId,
      heat: Math.min(100, Math.max(20, 28 + heatDelta)),
      origin,
      labelTh,
      sinceSeason: save.season,
    })
  }
  return { ...save, rivalries: list }
}

/** Seed คู่อริเริ่มต้น: ชื่อคล้าย / ชื่อสั้นชน / ชื่อดังในลีกเดียวกัน */
export function seedLeagueRivalries(save: GameSave): GameSave {
  if ((save.rivalries?.length ?? 0) > 0) return save
  const clubs = save.clubs.filter((c) => c.division === 1)
  const pairs: Array<[Club, Club, string]> = []

  // Top reputation clubs in same league — classic big-club rivalries
  const byRep = clubs.slice().sort((a, b) => b.reputation - a.reputation)
  for (let i = 0; i < Math.min(4, byRep.length - 1); i++) {
    pairs.push([byRep[i]!, byRep[i + 1]!, 'คู่แข่งระดับหัวตาราง'])
  }

  // Name / city-ish heuristics (shortName share prefix, or known patterns)
  for (let i = 0; i < clubs.length; i++) {
    for (let j = i + 1; j < clubs.length; j++) {
      const a = clubs[i]!
      const b = clubs[j]!
      const an = a.name.toLowerCase()
      const bn = b.name.toLowerCase()
      if (
        (an.includes('united') && bn.includes('city')) ||
        (an.includes('city') && bn.includes('united')) ||
        (an.includes('real') && bn.includes('barcelona')) ||
        (an.includes('barcelona') && bn.includes('real')) ||
        (an.includes('inter') && bn.includes('milan')) ||
        (an.includes('milan') && bn.includes('inter')) ||
        (an.includes('liverpool') && bn.includes('everton')) ||
        (an.includes('everton') && bn.includes('liverpool')) ||
        (an.includes('arsenal') && bn.includes('tottenham')) ||
        (an.includes('tottenham') && bn.includes('arsenal')) ||
        (an.includes('dortmund') && bn.includes('schalke')) ||
        Math.abs(a.reputation - b.reputation) <= 4 &&
          a.reputation >= 78 &&
          ((a.id.charCodeAt(0) + b.id.charCodeAt(0)) % 7 === 0)
      ) {
        pairs.push([a, b, 'ดาร์บี้ / คู่ปรับดั้งเดิม'])
      }
    }
  }

  let next = { ...save, rivalries: [] as ClubRivalry[] }
  const seen = new Set<string>()
  for (const [a, b, label] of pairs) {
    const k = pairKey(a.id, b.id)
    if (seen.has(k)) continue
    seen.add(k)
    next = heatRivalry(next, a.id, b.id, 40 + Math.floor(Math.random() * 25), 'seed', label)
  }
  return next
}

/**
 * คู่อริเกิดเองจากผลแมตช์:
 * - ถล่ม (ต่างสกอร์ ≥ 4)
 * - ใบแดง / เกมเดือด (ใช้ความต่างสกอร์ + นัดสำคัญ)
 * - สู้กันหัวตาราง
 */
export function tickEmergentRivalries(
  save: GameSave,
  results: Array<{
    homeClubId: string
    awayClubId: string
    homeGoals: number
    awayGoals: number
    competition?: string
    fixtureId?: string
  }>,
  table: TableRow[],
): GameSave {
  let next = save
  const sorted = table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.gf - b.ga - (a.gf - a.ga)
  })
  const rank = (id: string) => sorted.findIndex((r) => r.clubId === id)

  for (const r of results) {
    const margin = Math.abs(r.homeGoals - r.awayGoals)
    const rh = rank(r.homeClubId)
    const ra = rank(r.awayClubId)
    const titleFight =
      rh >= 0 && ra >= 0 && rh < 6 && ra < 6 && Math.abs(rh - ra) <= 3

    if (margin >= 4) {
      next = heatRivalry(
        next,
        r.homeClubId,
        r.awayClubId,
        8 + margin,
        'thrashing',
        'แค้นหลังโดนถล่ม',
      )
    }
    if (titleFight) {
      next = heatRivalry(
        next,
        r.homeClubId,
        r.awayClubId,
        5,
        'table',
        'คู่แข่งแย่งตำแหน่งหัวตาราง',
      )
    }
    // สุ่มเกิดจากเกมดุ (สกอร์สูงทั้งสองฝ่าย)
    if (r.homeGoals + r.awayGoals >= 5 && Math.random() < 0.35) {
      next = heatRivalry(
        next,
        r.homeClubId,
        r.awayClubId,
        6,
        'incident',
        'เกมเดือดกลายเป็นคู่อริ',
      )
    }
    // นัดถ้วยสำคัญ
    if (
      (r.competition === 'cup' ||
        r.competition === 'ucl' ||
        r.competition === 'uel') &&
      margin <= 1 &&
      Math.random() < 0.4
    ) {
      next = heatRivalry(
        next,
        r.homeClubId,
        r.awayClubId,
        7,
        'derby_run',
        'แค้นจากนัดถ้วย',
      )
    }

    const existing = findRivalry(next, r.homeClubId, r.awayClubId)
    if (existing && r.fixtureId) {
      next = {
        ...next,
        rivalries: ensureRivalries(next).map((x) =>
          x.id === existing.id ? { ...x, lastFixtureId: r.fixtureId, heat: Math.min(100, x.heat + 2) } : x,
        ),
      }
    }
  }

  // ค่อยๆ เย็นลงถ้าไม่เจอกัน
  if (save.matchday % 8 === 0) {
    next = {
      ...next,
      rivalries: ensureRivalries(next)
        .map((r) => ({ ...r, heat: Math.max(0, r.heat - 1) }))
        .filter((r) => r.heat >= 12 || r.origin === 'seed'),
    }
  }

  return next
}

/** สำหรับข่าวคู่อริ — รวม seed + เกิดเอง + เพื่อนบ้านตาราง */
export function rivalIdsForClub(save: GameSave, clubId: string, table: TableRow[]): Set<string> {
  const ids = new Set(getRivalClubIds(save, clubId))
  const sorted = table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.gf - b.ga - (a.gf - a.ga)
  })
  const humanRank = sorted.findIndex((r) => r.clubId === clubId)
  if (humanRank >= 0) {
    for (let i = 0; i < sorted.length; i++) {
      if (Math.abs(i - humanRank) <= 2 && i !== humanRank) {
        ids.add(sorted[i]!.clubId)
      }
    }
  }
  return ids
}

export function rivalryLabel(save: GameSave, clubAId: string, clubBId: string): string | null {
  const r = findRivalry(save, clubAId, clubBId)
  if (!r || r.heat < 25) return null
  return r.labelTh
}
