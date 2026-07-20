/**
 * ปรีซีซั่น / พรีซีซันทัวร์
 * — เจ้าภาพเสนอให้อุ่นเครื่อง · ได้ค่าปรากฏตัว
 * — เชิญทีมดังร่วมทัวร์ด้วย (ไม่ใช่แค่คลับผู้เล่น)
 * — สนาม + ภูมิอากาศ ส่งผลต่อสภาพ / ความเสี่ยงเจ็บ
 * — วันที่ทัวร์จบก่อน Super Cup (seasonStart−3) และ MD1
 */
import type { GameSave, Player } from './types'
import { ALL_LEAGUES } from '@/data/world'
import { addDays } from './calendarDates'
import { applyInjury } from './medical'
import { ensureClubFinance } from './playerEconomy'

/** วันเปิดลีกมาตรฐานของฤดูกาล */
export function leagueSeasonStart(season: number): string {
  return `${season}-08-15`
}

/** ต้นช่วงปรีซีซั่นบนแถบวันที่ — หลังจบบอลโลก (15 ส.ค. − 26 วัน = 20 ก.ค.) */
export function preSeasonCalendarStart(seasonStart: string): string {
  return addDays(seasonStart, -26)
}

/** วันก่อน Community Shield / Super Cup */
export function dayBeforeSuperCup(seasonStart: string): string {
  return addDays(seasonStart, -4)
}

/**
 * จองวันที่นัดอุ่น — นัดสุดท้าย = seasonStart−5 (≥1 วันว่างก่อน Shield ที่ −3)
 * ห่างกัน gapDays (ค่าเริ่ม 3)
 */
export function scheduleTourDates(
  seasonStart: string,
  matchCount: number,
  gapDays = 3,
): string[] {
  const n = Math.max(0, matchCount)
  if (n === 0) return []
  const last = addDays(seasonStart, -5)
  const dates: string[] = []
  for (let i = 0; i < n; i++) {
    dates.push(addDays(last, -(n - 1 - i) * gapDays))
  }
  return dates
}

export function estimateTourDateRange(
  seasonStart: string,
  matches: number,
): { first: string; last: string } {
  const dates = scheduleTourDates(seasonStart, matches)
  return { first: dates[0] ?? addDays(seasonStart, -5), last: dates[dates.length - 1] ?? addDays(seasonStart, -5) }
}

export type PitchQuality = 'excellent' | 'good' | 'average' | 'poor' | 'terrible'
export type Climate = 'temperate' | 'hot' | 'humid' | 'cold' | 'altitude'

export interface PreSeasonOpponent {
  name: string
  shortName: string
  /** ความแข็งโดยประมาณ (ใช้ซิมสกอร์) */
  strength: number
  /** true = สโมสรดังจากลีกโลก */
  famous: boolean
}

export interface PreSeasonHostOffer {
  id: string
  hostName: string
  hostNameTh: string
  region: string
  regionTh: string
  venue: string
  venueTh: string
  /** ค่าปรากฏตัวรวมทั้งทัวร์ */
  feeTotal: number
  /** ค่าต่อนัดโดยประมาณ */
  feePerMatch: number
  matches: number
  pitchQuality: PitchQuality
  climate: Climate
  crowdEst: number
  riskNoteTh: string
  /** คู่แข่งทีละนัด (มักเป็นทีมดัง) */
  opponents: PreSeasonOpponent[]
  /** ทีมดังอื่นที่เจ้าภาพเชิญร่วมซีรีส์เดียวกัน */
  coInvitees: string[]
}

export interface PreSeasonMatchResult {
  opponent: string
  gf: number
  ga: number
  fee: number
  venueTh: string
  pitchQuality: PitchQuality
  climate: Climate
  injuredNames: string[]
  fatigueNote: string
  note: string
  /** วันที่เล่นจริงบนปฏิทิน */
  date?: string
}

export interface PreSeasonState {
  season: number
  /** วันเปิดลีกของฤดูกาลนี้ (อ้างอิงจองทัวร์ / Shield) */
  seasonStart: string
  phase: 'choosing' | 'active' | 'done' | 'skipped'
  offers: PreSeasonHostOffer[]
  acceptedOfferId: string | null
  matchesPlayed: number
  matchesTotal: number
  /** วันที่จองต่อนัด — ไม่ทับ Super Cup / MD1 */
  matchDates: string[]
  results: PreSeasonMatchResult[]
  totalFees: number
  note: string
}

export const PITCH_LABEL: Record<PitchQuality, string> = {
  excellent: 'สนามดีเยี่ยม',
  good: 'สนามดี',
  average: 'สนามปานกลาง',
  poor: 'สนามแย่',
  terrible: 'สนามแย่มาก / ไม่เรียบ',
}

export const CLIMATE_LABEL: Record<Climate, string> = {
  temperate: 'อากาศพอเหมาะ',
  hot: 'ร้อนจัด',
  humid: 'ร้อนชื้น',
  cold: 'หนาว',
  altitude: 'ที่สูง / อากาศบาง',
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

const TOUR_TEMPLATES: Omit<
  PreSeasonHostOffer,
  'id' | 'feeTotal' | 'feePerMatch' | 'opponents' | 'coInvitees'
>[] = [
  {
    hostName: 'Asia Cup Organisers',
    hostNameTh: 'ผู้จัดทัวร์เอเชีย',
    region: 'Southeast Asia',
    regionTh: 'เอเชียตะวันออกเฉียงใต้',
    venue: 'National Stadium, Bangkok',
    venueTh: 'ราชมังคลา · กรุงเทพ',
    matches: 3,
    pitchQuality: 'good',
    climate: 'humid',
    crowdEst: 28_000,
    riskNoteTh: 'ชื้นและร้อน — เหนื่อยง่าย แต่สนามใช้ได้',
  },
  {
    hostName: 'Gulf Sports Authority',
    hostNameTh: 'หน่วยงานกีฬากัลฟ์',
    region: 'Middle East',
    regionTh: 'ตะวันออกกลาง',
    venue: 'King Fahd Stadium',
    venueTh: 'สนามคิงฟาฮัด · ริยาด',
    matches: 3,
    pitchQuality: 'excellent',
    climate: 'hot',
    crowdEst: 45_000,
    riskNoteTh: 'ค่าตัวสูง · สนามดี แต่ร้อนจัดตอนกลางวัน',
  },
  {
    hostName: 'USA Summer Series',
    hostNameTh: 'ซีรีส์ซัมเมอร์สหรัฐ',
    region: 'North America',
    regionTh: 'อเมริกาเหนือ',
    venue: 'Hard Rock Stadium',
    venueTh: 'ไมอามี',
    matches: 4,
    pitchQuality: 'excellent',
    climate: 'humid',
    crowdEst: 52_000,
    riskNoteTh: 'ค่าตัวดี · เที่ยวบินไกล เหนื่อยจากการเดินทาง',
  },
  {
    hostName: 'Alpine Challenge',
    hostNameTh: 'ชาเลนจ์เทือกเขาแอลป์',
    region: 'Central Europe',
    regionTh: 'ยุโรปกลาง',
    venue: 'Municipal Ground, Tyrol',
    venueTh: 'สนามเทศบาล · ทีโรล',
    matches: 3,
    pitchQuality: 'average',
    climate: 'altitude',
    crowdEst: 8_000,
    riskNoteTh: 'ที่สูง — เหนื่อยเร็ว · ค่าตัวปานกลาง',
  },
  {
    hostName: 'Far East Invitation',
    hostNameTh: 'คำเชิญตะวันออกไกล',
    region: 'East Asia',
    regionTh: 'เอเชียตะวันออก',
    venue: 'Saitama Stadium',
    venueTh: 'ไซตามะ',
    matches: 2,
    pitchQuality: 'excellent',
    climate: 'temperate',
    crowdEst: 35_000,
    riskNoteTh: 'สนามดี อากาศดี · ค่าตัวดี',
  },
  {
    hostName: 'Provincial Charity Cup',
    hostNameTh: 'ถ้วยการกุศลต่างจังหวัด',
    region: 'Domestic tour',
    regionTh: 'ทัวร์ในประเทศ',
    venue: 'Municipal Pitch',
    venueTh: 'สนามเทศบาลต่างจังหวัด',
    matches: 3,
    pitchQuality: 'poor',
    climate: 'hot',
    crowdEst: 6_000,
    riskNoteTh: 'ค่าตัวต่ำ · สนามไม่ดี — เสี่ยงเจ็บ/ล้าสูง',
  },
  {
    hostName: 'Nordic Warm-up',
    hostNameTh: 'อุ่นเครื่องนอร์ดิก',
    region: 'Northern Europe',
    regionTh: 'ยุโรปเหนือ',
    venue: 'City Park Arena',
    venueTh: 'ออสโล / สตอกโฮล์ม',
    matches: 2,
    pitchQuality: 'good',
    climate: 'cold',
    crowdEst: 12_000,
    riskNoteTh: 'หนาว — กล้ามเนื้อตึงง่าย',
  },
  {
    hostName: 'Island Exhibition',
    hostNameTh: 'นัดอุ่นเกาะ',
    region: 'Island venue',
    regionTh: 'สนามเกาะ',
    venue: 'Coastal Ground',
    venueTh: 'สนามชายฝั่ง',
    matches: 2,
    pitchQuality: 'terrible',
    climate: 'humid',
    crowdEst: 4_500,
    riskNoteTh: 'สนามขรุขระมาก — เสี่ยงเจ็บยาว · ค่าตัวปานกลาง',
  },
]

/** แขกนอกลีกในเซฟ — ทีมดังทวีปอื่น */
const GUEST_FAMOUS: PreSeasonOpponent[] = [
  { name: 'Real Madrid', shortName: 'RMA', strength: 92, famous: true },
  { name: 'FC Barcelona', shortName: 'BAR', strength: 90, famous: true },
  { name: 'Bayern Munich', shortName: 'BAY', strength: 90, famous: true },
  { name: 'Paris Saint-Germain', shortName: 'PSG', strength: 89, famous: true },
  { name: 'Inter Milan', shortName: 'INT', strength: 88, famous: true },
  { name: 'Juventus', shortName: 'JUV', strength: 86, famous: true },
  { name: 'CR Flamengo', shortName: 'FLA', strength: 86, famous: true },
  { name: 'Boca Juniors', shortName: 'BOC', strength: 84, famous: true },
  { name: 'Al Ahly SC', shortName: 'AHL', strength: 82, famous: true },
  { name: 'Al-Hilal', shortName: 'HIL', strength: 85, famous: true },
  { name: 'Al-Nassr', shortName: 'NAS', strength: 84, famous: true },
  { name: 'LA Galaxy', shortName: 'LAG', strength: 76, famous: true },
  { name: 'Inter Miami', shortName: 'MIA', strength: 78, famous: true },
]

const LOCAL_FILLER: PreSeasonOpponent[] = [
  { name: 'Host Select XI', shortName: 'HST', strength: 68, famous: false },
  { name: 'Regional All-Stars', shortName: 'RAS', strength: 66, famous: false },
  { name: 'Charity XI', shortName: 'CHX', strength: 64, famous: false },
]

function famousClubPool(excludeNames: Set<string>): PreSeasonOpponent[] {
  const fromLeagues: PreSeasonOpponent[] = []
  for (const league of ALL_LEAGUES) {
    for (const c of league.clubs) {
      if (c.rep < 78) continue
      if (excludeNames.has(c.name)) continue
      fromLeagues.push({
        name: c.name,
        shortName: c.shortName,
        strength: Math.min(94, 55 + c.rep * 0.4),
        famous: true,
      })
    }
  }
  const guests = GUEST_FAMOUS.filter((g) => !excludeNames.has(g.name))
  // รวมแล้วตัดชื่อซ้ำ
  const seen = new Set<string>()
  const out: PreSeasonOpponent[] = []
  for (const o of [...fromLeagues, ...guests]) {
    if (seen.has(o.name)) continue
    seen.add(o.name)
    out.push(o)
  }
  return out.sort((a, b) => b.strength - a.strength)
}

function pickFromPool(pool: PreSeasonOpponent[], n: number, rng: () => number): PreSeasonOpponent[] {
  const copy = pool.slice()
  const out: PreSeasonOpponent[] = []
  for (let i = 0; i < n && copy.length; i++) {
    // ถ่วงน้ำหนักทีมดัง: ครึ่งบนของพูลมีโอกาสสูงกว่า
    const bias = copy.length > 4 && rng() < 0.65 ? Math.floor(copy.length * 0.45) : copy.length
    const idx = Math.floor(rng() * Math.max(1, bias))
    out.push(copy.splice(idx, 1)[0]!)
  }
  return out
}

function buildTourLineup(
  matches: number,
  humanName: string,
  humanRep: number,
  rng: () => number,
  premium: boolean,
): { opponents: PreSeasonOpponent[]; coInvitees: string[] } {
  const exclude = new Set<string>([humanName])
  const pool = famousClubPool(exclude)
  // ทัวร์พรีเมียม → คู่แข่งดังเกือบทุกนัด · ทัวร์ถูก → ผสม filler
  const famousSlots = premium
    ? matches
    : Math.max(1, Math.ceil(matches * (0.5 + humanRep / 200)))
  const famous = pickFromPool(pool, famousSlots + 4, rng)
  const opponents: PreSeasonOpponent[] = []
  for (let i = 0; i < matches; i++) {
    if (i < famous.length && (premium || i < famousSlots || rng() < 0.55)) {
      opponents.push(famous[i]!)
    } else {
      const fill = LOCAL_FILLER[Math.floor(rng() * LOCAL_FILLER.length)]!
      opponents.push({ ...fill, name: `${fill.name} (${i + 1})` })
    }
  }
  // คู่แข่งชื่อไม่ซ้ำในทัวร์เดียวกัน
  const seenOpp = new Set<string>()
  const uniqueOpponents = opponents.filter((o) => {
    if (seenOpp.has(o.name)) return false
    seenOpp.add(o.name)
    return true
  })
  while (uniqueOpponents.length < matches) {
    const fill = LOCAL_FILLER[uniqueOpponents.length % LOCAL_FILLER.length]!
    const name = `${fill.name} (${uniqueOpponents.length + 1})`
    if (seenOpp.has(name)) break
    seenOpp.add(name)
    uniqueOpponents.push({ ...fill, name })
  }
  // ทีมดังร่วมทัวร์ (ไม่ใช่คู่แข่งตรง) — เจ้าภาพเชิญหลายสโมสร
  const used = new Set(uniqueOpponents.map((o) => o.name))
  used.add(humanName)
  const coPool = pool.filter((p) => !used.has(p.name))
  const coInvitees = pickFromPool(coPool, 3 + Math.floor(rng() * 3), rng)
    .map((c) => c.name)
    .filter((n) => !used.has(n))
  return { opponents: uniqueOpponents.slice(0, matches), coInvitees }
}

function feeForOffer(
  tpl: (typeof TOUR_TEMPLATES)[0],
  clubRep: number,
  rng: () => number,
  avgOppStrength: number,
): { feeTotal: number; feePerMatch: number } {
  const base =
    tpl.pitchQuality === 'excellent'
      ? 1_800_000
      : tpl.pitchQuality === 'good'
        ? 1_200_000
        : tpl.pitchQuality === 'average'
          ? 700_000
          : tpl.pitchQuality === 'poor'
            ? 350_000
            : 500_000
  const climateBonus =
    tpl.climate === 'hot' || tpl.climate === 'humid' ? 1.15 : tpl.climate === 'altitude' ? 0.9 : 1
  const crowdMul = 0.85 + Math.min(1.4, tpl.crowdEst / 40_000)
  const repMul = 0.7 + clubRep / 120
  const starMul = 0.85 + avgOppStrength / 200
  const feePerMatch = Math.round(
    base * climateBonus * crowdMul * repMul * starMul * (0.9 + rng() * 0.25),
  )
  return { feePerMatch, feeTotal: feePerMatch * tpl.matches }
}

export function createPreSeasonDone(season: number, seasonStart?: string): PreSeasonState {
  return {
    season,
    seasonStart: seasonStart ?? leagueSeasonStart(season),
    phase: 'done',
    offers: [],
    acceptedOfferId: null,
    matchesPlayed: 0,
    matchesTotal: 0,
    matchDates: [],
    results: [],
    totalFees: 0,
    note: 'ปรีซีซั่นจบแล้ว',
  }
}

/** สร้างข้อเสนอเจ้าภาพตอนเปิดฤดูกาล / เกมใหม่ */
export function generatePreSeasonOffers(save: GameSave): PreSeasonState {
  const human = save.clubs.find((c) => c.id === save.humanClubId)
  const rep = human?.reputation ?? 60
  const humanName = human?.name ?? 'Your Club'
  const seasonStart =
    save.fixtures.find((f) => f.competition === 'league' && f.matchday === 1)?.date ??
    leagueSeasonStart(save.season)
  const rng = mulberry32(save.season * 911 + rep * 17 + humanName.length * 5)
  const shuffled = [...TOUR_TEMPLATES]
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!]
  }
  const take = shuffled.slice(0, 5)
  const offers: PreSeasonHostOffer[] = take.map((tpl, i) => {
    const premium =
      tpl.pitchQuality === 'excellent' ||
      tpl.crowdEst >= 35_000 ||
      tpl.region.includes('USA') ||
      tpl.region.includes('Middle') ||
      tpl.region.includes('East Asia')
    const { opponents, coInvitees } = buildTourLineup(tpl.matches, humanName, rep, rng, premium)
    const avgStr =
      opponents.reduce((s, o) => s + o.strength, 0) / Math.max(1, opponents.length)
    const fees = feeForOffer(tpl, rep, rng, avgStr)
    return {
      ...tpl,
      id: `pso-${save.season}-${i}`,
      ...fees,
      opponents,
      coInvitees,
    }
  })
  return {
    season: save.season,
    seasonStart,
    phase: 'choosing',
    offers,
    acceptedOfferId: null,
    matchesPlayed: 0,
    matchesTotal: 0,
    matchDates: [],
    results: [],
    totalFees: 0,
    note: 'เจ้าภาพเสนอทัวร์ — เชิญทั้งคุณและทีมดังร่วมซีรีส์ · ทัวร์จบก่อน Community Shield · เลือกทัวร์หรือข้าม',
  }
}

export function ensurePreSeason(save: GameSave): GameSave {
  const seasonStart =
    save.fixtures.find((f) => f.competition === 'league' && f.matchday === 1)?.date ??
    leagueSeasonStart(save.season)
  const leagueStarted =
    save.matchday > 0 ||
    save.fixtures.some((f) => f.played && (f.competition === 'league' || f.competition === 'super_cup'))

  // ปีไม่ตรง / ไม่มีสเตต — ต้องมีทัวร์ใหม่ทุกฤดูกาล (ไม่ใช่แค่ปีแรก)
  if (!save.preSeason || save.preSeason.season !== save.season) {
    if (leagueStarted) {
      return { ...save, preSeason: createPreSeasonDone(save.season, seasonStart) }
    }
    const ps = generatePreSeasonOffers(save)
    return {
      ...save,
      preSeason: ps,
      currentDate: preSeasonCalendarStart(ps.seasonStart || seasonStart),
    }
  }

  // เซฟเก่าที่เลย MD0 ไปแล้วยังค้าง choosing — ถือว่าจบปรีซีซั่น
  if (
    save.preSeason.phase === 'choosing' &&
    leagueStarted
  ) {
    return {
      ...save,
      preSeason: {
        ...save.preSeason,
        seasonStart: save.preSeason.seasonStart ?? seasonStart,
        matchDates: save.preSeason.matchDates ?? [],
        phase: 'done',
        note: 'ข้ามปรีซีซั่น (เซฟเก่า)',
      },
    }
  }

  // เติมฟิลด์ปฏิทินถ้าเซฟเก่ายังไม่มี
  if (!save.preSeason.seasonStart || save.preSeason.matchDates == null) {
    return {
      ...save,
      preSeason: {
        ...save.preSeason,
        seasonStart: save.preSeason.seasonStart ?? seasonStart,
        matchDates: save.preSeason.matchDates ?? [],
      },
    }
  }
  return save
}

/** เปิดหน้าต่างปรีซีซั่นของฤดูกาลนี้ — เรียกท้าย startNextSeason / เกมใหม่ทุกปี */
export function openPreSeasonWindow(save: GameSave, seasonStart: string): GameSave {
  const ps = generatePreSeasonOffers({
    ...save,
    currentDate: preSeasonCalendarStart(seasonStart),
  })
  return {
    ...save,
    preSeason: {
      ...ps,
      seasonStart: ps.seasonStart || seasonStart,
    },
    currentDate: preSeasonCalendarStart(seasonStart),
  }
}

export function isPreSeasonBlocking(save: GameSave): boolean {
  const ps = save.preSeason
  if (!ps) return false
  // บล็อกเฉพาะปรีซีซั่นของฤดูกาลปัจจุบัน
  if (ps.season !== save.season) return false
  return ps.phase === 'choosing' || ps.phase === 'active'
}

export function acceptPreSeasonOffer(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const base = ensurePreSeason(save)
  const ps = base.preSeason!
  if (ps.phase !== 'choosing') {
    return { ok: false, save: base, message: 'เลือกทัวร์ไปแล้วหรือจบปรีซีซั่นแล้ว' }
  }
  const offer = ps.offers.find((o) => o.id === offerId)
  if (!offer) return { ok: false, save: base, message: 'ไม่พบข้อเสนอ' }
  const seasonStart = ps.seasonStart || leagueSeasonStart(base.season)
  const matchDates = scheduleTourDates(seasonStart, offer.matches)
  const range = estimateTourDateRange(seasonStart, offer.matches)
  return {
    ok: true,
    save: {
      ...base,
      currentDate: matchDates[0] ?? preSeasonCalendarStart(seasonStart),
      preSeason: {
        ...ps,
        seasonStart,
        phase: 'active',
        acceptedOfferId: offerId,
        matchesPlayed: 0,
        matchesTotal: offer.matches,
        matchDates,
        note: `รับทัวร์${offer.hostNameTh} · ${offer.matches} นัด · ${range.first} → ${range.last} (ก่อน Shield) · ${offer.venueTh}`,
      },
      inbox: [
        {
          id: `msg-ps-accept-${Date.now()}`,
          date: matchDates[0] ?? base.currentDate,
          title: `รับทัวร์ปรีซีซั่น · ${offer.hostNameTh}`,
          body: `${offer.regionTh} · ${offer.venueTh} · ช่วง ${range.first}–${range.last} (จบก่อน Community Shield) · สนาม: ${PITCH_LABEL[offer.pitchQuality]} · ${CLIMATE_LABEL[offer.climate]} · ค่าปรากฏตัว ~${offer.feeTotal.toLocaleString('th-TH')} · คู่แข่ง: ${offer.opponents.map((o) => (typeof o === 'string' ? o : o.name)).join(', ')}${offer.coInvitees?.length ? ` · ร่วมทัวร์กับ ${offer.coInvitees.slice(0, 3).join(', ')}` : ''} · ${offer.riskNoteTh}`,
          read: false,
        },
        ...base.inbox,
      ].slice(0, 45),
    },
    message: `รับทัวร์${offer.hostNameTh} แล้ว`,
  }
}

export function skipPreSeason(save: GameSave): { ok: boolean; save: GameSave; message: string } {
  const base = ensurePreSeason(save)
  const ps = base.preSeason!
  if (ps.phase !== 'choosing') {
    return { ok: false, save: base, message: 'ข้ามไม่ได้ตอนนี้' }
  }
  // ซ้อมบ้าน — ได้เงินน้อย ไม่เสี่ยงทัวร์
  const human = base.clubs.find((c) => c.id === base.humanClubId)
  const fee = Math.round(80_000 + (human?.reputation ?? 50) * 2_000)
  let clubs = base.clubs.map((c) =>
    c.id === base.humanClubId ? { ...c, balance: c.balance + fee } : c,
  )
  const finance = ensureClubFinance(base)
  const players = base.players.map((p) => {
    if (p.clubId !== base.humanClubId || p.injuryDays > 0) return p
    return {
      ...p,
      condition: clamp(p.condition + 4, 40, 100),
      sharpness: clamp(p.sharpness + 2, 30, 100),
    }
  })
  const seasonStart = ps.seasonStart || leagueSeasonStart(base.season)
  const skipDate = dayBeforeSuperCup(seasonStart)
  return {
    ok: true,
    save: {
      ...base,
      clubs,
      players,
      currentDate: skipDate,
      clubFinance: {
        ...finance,
        ledger: [
          {
            id: `fin-ps-skip-${Date.now()}`,
            date: skipDate,
            kind: 'other' as const,
            amount: fee,
            note: 'ปรีซีซั่นบ้าน — สปอนเซอร์อุ่นเครื่องเล็กน้อย',
          },
          ...finance.ledger,
        ].slice(0, 50),
      },
      preSeason: {
        ...ps,
        seasonStart,
        matchDates: [],
        phase: 'skipped',
        note: `ข้ามทัวร์ · ซ้อมบ้าน · ได้ ${fee.toLocaleString('th-TH')} · พร้อม Shield (${addDays(seasonStart, -3)})`,
      },
      inbox: [
        {
          id: `msg-ps-skip-${Date.now()}`,
          date: skipDate,
          title: 'ข้ามทัวร์ปรีซีซั่น',
          body: `ซ้อมที่บ้าน · รายได้เล็กน้อย ${fee.toLocaleString('th-TH')} · สควอดฟื้นตัวเล็กน้อย · วันที่เลื่อนไปก่อน Community Shield`,
          read: false,
        },
        ...base.inbox,
      ].slice(0, 45),
    },
    message: 'ข้ามทัวร์ — พร้อมเปิดฤดูกาล',
  }
}

function pitchRisk(q: PitchQuality): number {
  return q === 'excellent' ? 0.02 : q === 'good' ? 0.04 : q === 'average' ? 0.07 : q === 'poor' ? 0.14 : 0.22
}

function climateFatigue(c: Climate): number {
  return c === 'temperate' ? 3 : c === 'hot' ? 7 : c === 'humid' ? 8 : c === 'cold' ? 5 : 9
}

function climateInjuryBonus(c: Climate): number {
  return c === 'cold' ? 0.03 : c === 'altitude' ? 0.04 : c === 'humid' ? 0.02 : 0
}

/** เล่นนัดอุ่นปรีซีซั่นถัดไป */
export function playNextPreSeasonMatch(save: GameSave): {
  ok: boolean
  save: GameSave
  message: string
} {
  const base = ensurePreSeason(save)
  const ps = base.preSeason!
  if (ps.phase !== 'active' || !ps.acceptedOfferId) {
    return { ok: false, save: base, message: 'ยังไม่ได้รับทัวร์' }
  }
  const offer = ps.offers.find((o) => o.id === ps.acceptedOfferId)
  if (!offer) return { ok: false, save: base, message: 'ไม่พบทัวร์' }
  if (ps.matchesPlayed >= ps.matchesTotal) {
    return { ok: false, save: base, message: 'แข่งครบแล้ว' }
  }

  const idx = ps.matchesPlayed
  const seasonStart = ps.seasonStart || leagueSeasonStart(base.season)
  const matchDates =
    ps.matchDates?.length === ps.matchesTotal
      ? ps.matchDates
      : scheduleTourDates(seasonStart, ps.matchesTotal)
  const matchDate = matchDates[idx] ?? addDays(seasonStart, -5)
  const rawOpp = offer.opponents[idx]
  const opponent: PreSeasonOpponent =
    typeof rawOpp === 'string'
      ? { name: rawOpp, shortName: rawOpp.slice(0, 3).toUpperCase(), strength: 70, famous: false }
      : rawOpp ?? {
          name: `Opponent ${idx + 1}`,
          shortName: 'OPP',
          strength: 70,
          famous: false,
        }
  const rng = mulberry32(base.season * 77 + idx * 131 + offer.id.length * 9)
  const human = base.clubs.find((c) => c.id === base.humanClubId)!
  const squad = base.players.filter(
    (p) => p.clubId === base.humanClubId && p.injuryDays <= 0 && !p.isYouth,
  )
  const avg =
    squad.reduce((s, p) => s + p.overall, 0) / Math.max(1, squad.length)
  const oppStr = opponent.strength + (rng() * 6 - 3)
  const edge = (avg - oppStr) / 14
  let gf = Math.max(0, Math.min(5, Math.floor(1.2 + edge + rng() * 2.2)))
  let ga = Math.max(0, Math.min(4, Math.floor(0.9 - edge + (1 - rng()) * 2.0)))

  const fatigue = climateFatigue(offer.climate) + (offer.pitchQuality === 'terrible' ? 3 : 0)
  const injChance = pitchRisk(offer.pitchQuality) + climateInjuryBonus(offer.climate)
  const injuredNames: string[] = []
  let players = base.players.map((p) => {
    if (p.clubId !== base.humanClubId || p.injuryDays > 0) return p
    if (p.isYouth && rng() > 0.25) return p
    let nextP: Player = {
      ...p,
      condition: clamp(p.condition - fatigue - rng() * 4, 25, 100),
      sharpness: clamp(p.sharpness + 1 + (rng() > 0.5 ? 1 : 0), 30, 100),
    }
    if (rng() < injChance && injuredNames.length < 3) {
      nextP = applyInjury(nextP, 'match', rng)
      // สนามแย่ → ยืดวันเจ็บ
      if (offer.pitchQuality === 'poor' || offer.pitchQuality === 'terrible') {
        const extra = offer.pitchQuality === 'terrible' ? 7 + Math.floor(rng() * 14) : 3 + Math.floor(rng() * 7)
        nextP = { ...nextP, injuryDays: nextP.injuryDays + extra }
      }
      if (nextP.injuryDays > 0) injuredNames.push(nextP.name)
    }
    return nextP
  })

  const fee = offer.feePerMatch
  const clubs = base.clubs.map((c) =>
    c.id === human.id ? { ...c, balance: c.balance + fee } : c,
  )
  const finance = ensureClubFinance(base)
  const fatigueNote =
    fatigue >= 8
      ? 'สควอดล้ามากจากอากาศ/สนาม'
      : fatigue >= 5
        ? 'ล้าปานกลาง'
        : 'ล้าเล็กน้อย'

  const result: PreSeasonMatchResult = {
    opponent: opponent.name,
    gf,
    ga,
    fee,
    venueTh: offer.venueTh,
    pitchQuality: offer.pitchQuality,
    climate: offer.climate,
    injuredNames,
    fatigueNote,
    date: matchDate,
    note:
      (opponent.famous ? `vs ${opponent.shortName} · ` : '') +
      (gf > ga ? `ชนะ ${gf}-${ga}` : gf === ga ? `เสมอ ${gf}-${ga}` : `แพ้ ${gf}-${ga}`),
  }

  const matchesPlayed = ps.matchesPlayed + 1
  const done = matchesPlayed >= ps.matchesTotal
  const totalFees = ps.totalFees + fee

  let next: GameSave = {
    ...base,
    clubs,
    players,
    currentDate: matchDate,
    clubFinance: {
      ...finance,
      ledger: [
        {
          id: `fin-ps-${Date.now()}-${idx}`,
          date: matchDate,
          kind: 'other' as const,
          amount: fee,
          note: `ปรีซีซั่น · ค่าปรากฏตัว vs ${opponent.name}`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    },
    preSeason: {
      ...ps,
      seasonStart,
      matchDates,
      matchesPlayed,
      results: [...ps.results, result],
      totalFees,
      phase: done ? 'done' : 'active',
      note: done
        ? `จบทัวร์${offer.hostNameTh} · ได้รวม ${totalFees.toLocaleString('th-TH')} · พร้อม Shield (${addDays(seasonStart, -3)})`
        : `ทัวร์นัด ${matchesPlayed}/${ps.matchesTotal} · ${result.note} · ${matchDate}`,
    },
    inbox: [
      {
        id: `msg-ps-m-${Date.now()}`,
        date: matchDate,
        title: `ปรีซีซั่น · vs ${opponent.name}`,
        body: [
          `${matchDate} · ${result.note} · ${offer.venueTh}`,
          opponent.famous ? `คู่แข่งทีมดัง (ความแข็ง ~${Math.round(opponent.strength)})` : 'คู่แข่งท้องถิ่น',
          `${PITCH_LABEL[offer.pitchQuality]} · ${CLIMATE_LABEL[offer.climate]} · ${fatigueNote}`,
          `ค่าปรากฏตัว +${fee.toLocaleString('th-TH')}`,
          injuredNames.length
            ? `เจ็บ: ${injuredNames.join(' · ')}${offer.pitchQuality === 'terrible' || offer.pitchQuality === 'poor' ? ' (สนามส่งผล)' : ''}`
            : 'ไม่มีเจ็บใหม่',
        ].join('\n'),
        read: false,
      },
      ...base.inbox,
    ].slice(0, 45),
  }

  return {
    ok: true,
    save: next,
    message: done
      ? `จบปรีซีซั่น · ได้ ${totalFees.toLocaleString('th-TH')}`
      : `${result.note} · +${fee.toLocaleString('th-TH')}`,
  }
}

export function acceptedPreSeasonOffer(save: GameSave): PreSeasonHostOffer | null {
  const ps = save.preSeason
  if (!ps?.acceptedOfferId) return null
  return ps.offers.find((o) => o.id === ps.acceptedOfferId) ?? null
}
