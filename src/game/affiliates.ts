import type { AffiliatesState, FeederClub, GameSave } from './types'
import { mulberry32 } from './seed'

const FEEDER_NAMES = [
  'Riverside FC',
  'Harbor United',
  'Ashford Town',
  'Millbrook Athletic',
  'Cedar Grove',
  'Northfield Rovers',
  'Eastbank FC',
  'Willow Park',
  'Stonebridge United',
  'Lakeview Albion',
]

const FEEDER_NATIONS = ['ENG', 'WAL', 'SCO', 'IRL', 'NIR', 'NED', 'BEL', 'POR']

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function createAffiliates(clubRep: number, seed = 2026): AffiliatesState {
  const rng = mulberry32(seed + Math.round(clubRep * 13))
  const count = clubRep >= 70 ? 2 : 1
  const used = new Set<string>()
  const feeders: FeederClub[] = []
  for (let i = 0; i < count; i++) {
    let name = FEEDER_NAMES[Math.floor(rng() * FEEDER_NAMES.length)]
    let tries = 0
    while (used.has(name) && tries < 20) {
      name = FEEDER_NAMES[Math.floor(rng() * FEEDER_NAMES.length)]
      tries += 1
    }
    used.add(name)
    const baseLevel = clamp(1 + Math.floor(clubRep / 28) + (rng() > 0.6 ? 1 : 0), 1, 5)
    feeders.push({
      id: `feeder-${i + 1}`,
      name,
      nation: FEEDER_NATIONS[Math.floor(rng() * FEEDER_NATIONS.length)],
      level: baseLevel,
    })
  }
  return {
    feeders,
    lastNote: `มีพันธมิตร ${feeders.length} สโมสร · ช่วยคุณภาพ youth intake`,
  }
}

export function ensureAffiliates(save: GameSave): AffiliatesState {
  if (save.affiliates?.feeders?.length) {
    return {
      ...save.affiliates,
      feeders: save.affiliates.feeders.map((f) => ({
        ...f,
        level: clamp(f.level, 1, 5),
      })),
      lastNote: save.affiliates.lastNote ?? '',
    }
  }
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  return createAffiliates(club?.reputation ?? 50, save.season * 97 + (club?.id.length ?? 0))
}

/** รวมระดับ feeder สำหรับโบนัส intake */
export function feederLevelSum(save: GameSave): number {
  return ensureAffiliates(save).feeders.reduce((s, f) => s + f.level, 0)
}

export function affiliateBoostCost(save: GameSave): number {
  const aff = ensureAffiliates(save)
  const avg =
    aff.feeders.length === 0
      ? 1
      : aff.feeders.reduce((s, f) => s + f.level, 0) / aff.feeders.length
  return Math.round(75_000 + avg * 35_000)
}

/** ใช้เงินคลับเสริมความสัมพันธ์ — ยก level feeder ที่ต่ำสุด (direct spend) */
export function boostAffiliateRelations(
  save: GameSave,
): { ok: boolean; save: GameSave; message: string } {
  const aff = ensureAffiliates(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const cost = affiliateBoostCost(save)
  if (club.balance < cost) {
    return { ok: false, save, message: 'งบไม่พอเสริมความสัมพันธ์พันธมิตร' }
  }
  const target = aff.feeders.slice().sort((a, b) => a.level - b.level)[0]
  if (!target) {
    return { ok: false, save, message: 'ยังไม่มีสโมสรพันธมิตร' }
  }
  if (target.level >= 5) {
    const allMax = aff.feeders.every((f) => f.level >= 5)
    if (allMax) {
      return { ok: false, save, message: 'พันธมิตรทุกรายอยู่ระดับสูงสุดแล้ว' }
    }
  }
  const feeders = aff.feeders.map((f) =>
    f.id === target.id ? { ...f, level: Math.min(5, f.level + 1) } : f,
  )
  const raised = feeders.find((f) => f.id === target.id)!
  const note = `เสริมความสัมพันธ์กับ ${raised.name} → Lv.${raised.level}`
  return {
    ok: true,
    message: note,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - cost } : c,
      ),
      affiliates: { feeders, lastNote: note },
      inbox: [
        {
          id: `msg-aff-${Date.now()}`,
          date: save.currentDate,
          title: 'พันธมิตรเยาวชน',
          body: `${note} · หัก ฿${cost.toLocaleString('th-TH')}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}
