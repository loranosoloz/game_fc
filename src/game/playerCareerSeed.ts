/**
 * สถิติ + ประวัติอาชีพ
 * — ข้อมูลจริงอยู่ IndexedDB ([careerDb.ts]) โหลดตอนเปิดโปรไฟล์
 * — ไม่ seed ก้อนใหญ่เข้า GameSave / ไม่ import JSON ใน bundle
 */
import { getLeague, type LeagueId } from '@/data/world'
import { getWorldHistory } from './worldHistory'
import type {
  BodyPartId,
  Club,
  GameSave,
  InjuryRecord,
  InjuryType,
  Player,
  PlayerCareerClubStint,
  PlayerCareerIntl,
  PlayerCareerProfile,
  PlayerCareerSeason,
  PlayerCareerTitle,
  PlayerCareerTransfer,
  PlayerWorldCupEntry,
  RoleCode,
} from './types'

export const CAREER_SEED_LEAGUES = new Set([
  'eng',
  'esp',
  'ger',
  'ita',
  'fra',
  'tha',
])

/** เวอร์ชันโปรไฟล์ — UI อ่านจาก IDB ไม่เก็บในเซฟ */
export const CAREER_PROFILE_VERSION = 4 as const

const BODY_PARTS: BodyPartId[] = [
  'thighL',
  'thighR',
  'kneeL',
  'kneeR',
  'ankleL',
  'ankleR',
  'groin',
  'calfL',
  'calfR',
  'shoulderL',
  'shoulderR',
  'back',
  'footL',
  'footR',
  'abdomen',
]

const INJURY_TYPES: InjuryType[] = ['muscle', 'ligament', 'bone']

const NATION_TH: Record<string, string> = {
  England: 'อังกฤษ',
  Spain: 'สเปน',
  Germany: 'เยอรมนี',
  Italy: 'อิตาลี',
  France: 'ฝรั่งเศส',
  Thailand: 'ไทย',
  Portugal: 'โปรตุเกส',
  Brazil: 'บราซิล',
  Argentina: 'อาร์เจนตินา',
  Netherlands: 'เนเธอร์แลนด์',
  Belgium: 'เบลเยียม',
  Croatia: 'โครเอเชีย',
  Norway: 'นอร์เวย์',
  Egypt: 'อียิปต์',
}

const LEAGUE_CUP_TH: Record<string, string> = {
  eng: 'FA Cup',
  esp: 'Copa del Rey',
  ger: 'DFB-Pokal',
  ita: 'Coppa Italia',
  fra: 'Coupe de France',
  tha: 'FA Cup Thailand',
}

const WC_YEARS = [2018, 2022, 2026] as const
const EURO_YEARS = [2016, 2021, 2024] as const

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function seasonLabel(endYear: number) {
  return `${endYear - 1}/${String(endYear).slice(2)}`
}

function leagueNation(leagueId: string): string {
  try {
    return getLeague(leagueId as LeagueId).nation
  } catch {
    return 'England'
  }
}

function clubPool(leagueId: string): Array<{ name: string; key: string; rep: number }> {
  try {
    return getLeague(leagueId as LeagueId).clubs.map((c) => ({
      name: c.name,
      key: c.key,
      rep: c.rep,
    }))
  } catch {
    return [{ name: 'Unknown FC', key: 'unk', rep: 50 }]
  }
}

type RoleRate = { goalsPerApp: number; assistsPerApp: number; appsBase: number }

function roleRates(role: RoleCode): RoleRate {
  switch (role) {
    case 'GK':
      return { goalsPerApp: 0, assistsPerApp: 0.01, appsBase: 34 }
    case 'CB':
      return { goalsPerApp: 0.06, assistsPerApp: 0.03, appsBase: 30 }
    case 'LB':
    case 'RB':
      return { goalsPerApp: 0.05, assistsPerApp: 0.12, appsBase: 28 }
    case 'CDM':
      return { goalsPerApp: 0.05, assistsPerApp: 0.08, appsBase: 30 }
    case 'CM':
      return { goalsPerApp: 0.1, assistsPerApp: 0.14, appsBase: 30 }
    case 'CAM':
      return { goalsPerApp: 0.22, assistsPerApp: 0.28, appsBase: 28 }
    case 'LM':
    case 'RM':
      return { goalsPerApp: 0.14, assistsPerApp: 0.2, appsBase: 28 }
    case 'LW':
    case 'RW':
      return { goalsPerApp: 0.28, assistsPerApp: 0.22, appsBase: 30 }
    case 'SS':
      return { goalsPerApp: 0.35, assistsPerApp: 0.2, appsBase: 28 }
    case 'ST':
      return { goalsPerApp: 0.48, assistsPerApp: 0.14, appsBase: 32 }
    default:
      return { goalsPerApp: 0.12, assistsPerApp: 0.1, appsBase: 26 }
  }
}

function leagueSeasonAppsCap(leagueId: string): number {
  if (leagueId === 'tha') return 32
  if (leagueId === 'ger') return 36
  return 42
}

function leagueVolume(leagueId: string): number {
  if (leagueId === 'tha') return 0.82
  return 1
}

function pickOtherClub(
  pool: Array<{ name: string; key: string; rep: number }>,
  exclude: string,
  rng: () => number,
  preferLower: boolean,
): { name: string; key: string; rep: number } {
  const candidates = pool.filter((c) => c.name !== exclude)
  if (candidates.length === 0) return pool[0]!
  const sorted = [...candidates].sort((a, b) =>
    preferLower ? a.rep - b.rep : b.rep - a.rep,
  )
  const band = sorted.slice(0, Math.min(8, sorted.length))
  return band[Math.floor(rng() * band.length)]!
}

function transferFee(ovr: number, age: number, rng: () => number): number {
  const base = Math.pow(Math.max(55, ovr), 2) * (80 + rng() * 120)
  const ageMul = age <= 23 ? 1.25 : age >= 32 ? 0.45 : 1
  return Math.round(base * ageMul)
}

/**
 * เส้นทางสโมสร + ประวัติย้าย
 */
export function buildClubPathAndTransfers(
  player: Pick<Player, 'id' | 'name' | 'age' | 'overall' | 'isYouth'>,
  opts: { leagueId: string; clubName: string; clubKey?: string; currentSeason: number },
): {
  clubs: PlayerCareerClubStint[]
  transfers: PlayerCareerTransfer[]
  debutYear: number
  clubBySeason: Map<number, { name: string; key?: string }>
} {
  const rng = mulberry32(hashStr(`${player.id}|${player.name}|path`))
  const pool = clubPool(opts.leagueId)
  const careerYears = clamp(player.age - 16, 1, 14)
  const debutYear = Math.max(2012, opts.currentSeason - careerYears)
  const clubBySeason = new Map<number, { name: string; key?: string }>()

  if (player.isYouth && player.age < 18) {
    const stint: PlayerCareerClubStint = {
      clubName: opts.clubName,
      clubKey: opts.clubKey,
      leagueId: opts.leagueId,
      fromYear: debutYear,
      toYear: opts.currentSeason,
    }
    for (let y = debutYear; y <= opts.currentSeason; y++) {
      clubBySeason.set(y, { name: opts.clubName, key: opts.clubKey })
    }
    return {
      clubs: [stint],
      transfers: [
        {
          year: debutYear,
          fromClub: 'Academy',
          toClub: opts.clubName,
          feeEur: null,
          kind: 'youth',
          noteTh: 'เลื่อนจากชุดเยาวชน',
        },
      ],
      debutYear,
      clubBySeason,
    }
  }

  // จำนวนสโมสรในอาชีพ
  const clubCount = clamp(
    1 + Math.floor((careerYears / 3) * (0.6 + rng())) + (player.overall >= 82 ? 0 : 1),
    1,
    5,
  )

  const stints: PlayerCareerClubStint[] = []
  const transfers: PlayerCareerTransfer[] = []
  let year = debutYear
  let currentName = ''
  let currentKey: string | undefined

  // สโมสรแรก — มักทีมเล็กกว่า / academy
  const first =
    clubCount === 1
      ? { name: opts.clubName, key: opts.clubKey ?? pool.find((c) => c.name === opts.clubName)?.key, rep: 70 }
      : pickOtherClub(pool, opts.clubName, rng, true)
  currentName = first.name
  currentKey = first.key
  transfers.push({
    year: debutYear,
    fromClub: `${first.name} Academy`,
    toClub: first.name,
    feeEur: null,
    kind: 'youth',
    noteTh: 'เปิดตัวชุดใหญ่',
  })

  const span = Math.max(1, opts.currentSeason - debutYear)
  const yearsPer = Math.max(2, Math.floor(span / clubCount))

  for (let i = 0; i < clubCount; i++) {
    const isLast = i === clubCount - 1
    const toYear = isLast
      ? opts.currentSeason
      : Math.min(opts.currentSeason - 1, year + yearsPer + Math.floor(rng() * 2))
    const fromYear = year

    if (isLast) {
      currentName = opts.clubName
      currentKey = opts.clubKey ?? pool.find((c) => c.name === opts.clubName)?.key
      if (stints.length > 0 && stints[stints.length - 1]!.clubName !== currentName) {
        const fee = transferFee(player.overall, player.age - (opts.currentSeason - fromYear), rng)
        const kind: PlayerCareerTransfer['kind'] =
          rng() < 0.12 ? 'free' : rng() < 0.18 ? 'loan' : 'transfer'
        transfers.push({
          year: fromYear,
          fromClub: stints[stints.length - 1]!.clubName,
          toClub: currentName,
          feeEur: kind === 'transfer' ? fee : kind === 'free' ? 0 : Math.round(fee * 0.15),
          kind: kind === 'loan' ? 'loan' : kind,
          noteTh:
            kind === 'loan'
              ? 'ยืมตัวแล้วซื้อขาด / ย้ายถาวร'
              : kind === 'free'
                ? 'ย้ายฟรี'
                : 'ย้ายถาวร',
        })
      }
    } else if (i > 0) {
      const next = pickOtherClub(pool, currentName, rng, player.overall < 75)
      const fee = transferFee(
        player.overall - 3 + Math.floor(rng() * 4),
        17 + (fromYear - debutYear),
        rng,
      )
      const kind: PlayerCareerTransfer['kind'] =
        rng() < 0.15 ? 'loan' : rng() < 0.1 ? 'free' : 'transfer'
      transfers.push({
        year: fromYear,
        fromClub: currentName,
        toClub: next.name,
        feeEur: kind === 'transfer' ? fee : kind === 'free' ? 0 : Math.round(fee * 0.12),
        kind,
        noteTh:
          kind === 'loan' ? 'ยืมตัว' : kind === 'free' ? 'หมดสัญญา · ย้ายฟรี' : 'ซื้อขาด',
      })
      currentName = next.name
      currentKey = next.key
    }

    stints.push({
      clubName: currentName,
      clubKey: currentKey,
      leagueId: opts.leagueId,
      fromYear,
      toYear,
    })
    for (let y = fromYear; y <= toYear; y++) {
      clubBySeason.set(y, { name: currentName, key: currentKey })
    }
    year = toYear + (isLast ? 0 : 1)
    if (year >= opts.currentSeason && !isLast) break
  }

  // ให้ฤดูกาลสถิติปีล่าสุดอยู่ทีมปัจจุบัน
  for (let y = opts.currentSeason - 1; y <= opts.currentSeason; y++) {
    clubBySeason.set(y, { name: opts.clubName, key: opts.clubKey })
  }

  return { clubs: stints, transfers, debutYear, clubBySeason }
}

export function buildCareerSeasons(
  player: Pick<Player, 'id' | 'name' | 'age' | 'role' | 'overall' | 'isYouth'>,
  opts: {
    leagueId: string
    clubName: string
    currentSeason: number
    clubBySeason?: Map<number, { name: string; key?: string }>
  },
): PlayerCareerSeason[] {
  if (player.isYouth && player.age < 17) return []

  const rng = mulberry32(hashStr(`${player.id}|${player.name}|career`))
  const rates = roleRates(player.role)
  const vol = leagueVolume(opts.leagueId)
  const appsCap = leagueSeasonAppsCap(opts.leagueId)
  const ovrFactor = 0.65 + (player.overall / 100) * 0.7

  const careerYears = clamp(player.age - 16, 1, 12)
  const firstEnd = Math.max(2016, opts.currentSeason - careerYears)
  const lastEnd = opts.currentSeason - 1

  const rows: PlayerCareerSeason[] = []
  for (let end = firstEnd; end <= lastEnd; end++) {
    const yearsPro = end - (opts.currentSeason - careerYears)
    const youthFactor =
      player.age - (opts.currentSeason - end) < 20 ? 0.45 + rng() * 0.35 : 1
    const formSwing = 0.75 + rng() * 0.5
    let apps = rates.appsBase * vol * ovrFactor * youthFactor * formSwing
    apps = clamp(apps + (rng() - 0.5) * 8, 0, appsCap)
    if (player.role === 'GK' && apps > 0) apps = clamp(apps, 8, appsCap)
    if (yearsPro <= 1) apps = clamp(apps * 0.55, 0, appsCap)

    const gRate = rates.goalsPerApp * ovrFactor * (0.8 + rng() * 0.45)
    const aRate = rates.assistsPerApp * ovrFactor * (0.8 + rng() * 0.45)
    let goals = player.role === 'GK' ? (rng() < 0.02 ? 1 : 0) : apps * gRate
    let assists = apps * aRate
    goals = clamp(goals + (rng() - 0.5) * 2, 0, player.role === 'ST' ? 42 : 28)
    assists = clamp(assists + (rng() - 0.5) * 2, 0, 28)

    const at = opts.clubBySeason?.get(end)
    rows.push({
      season: end,
      label: seasonLabel(end),
      clubName: at?.name ?? opts.clubName,
      leagueId: opts.leagueId,
      apps,
      goals,
      assists,
      minutes: clamp(apps * (55 + rng() * 30), 0, apps * 90),
      yellows: clamp(apps * (0.08 + rng() * 0.12), 0, 14),
      reds: rng() < 0.08 ? 1 : rng() < 0.02 ? 2 : 0,
    })
  }
  return rows
}

function buildTitles(
  player: Pick<Player, 'id' | 'name' | 'overall' | 'role'>,
  opts: {
    leagueId: string
    clubBySeason: Map<number, { name: string; key?: string }>
    currentSeason: number
  },
): PlayerCareerTitle[] {
  const rng = mulberry32(hashStr(`${player.id}|${player.name}|titles`))
  const titles: PlayerCareerTitle[] = []
  const hist = getWorldHistory()
  const leagueChamps = hist.leagues[opts.leagueId]?.champions ?? []
  const cupName = LEAGUE_CUP_TH[opts.leagueId] ?? 'Cup'

  for (const row of leagueChamps) {
    const at = opts.clubBySeason.get(row.endYear)
    if (!at) continue
    const nameMatch =
      at.name === row.club ||
      (at.key && row.clubKey && at.key === row.clubKey) ||
      at.name.includes(row.club.split(' ').pop() ?? '___')
    if (!nameMatch) continue
    // ดาวหลักมีโอกาสสูงว่าได้เหรียญ
    const chance = player.overall >= 85 ? 0.92 : player.overall >= 78 ? 0.7 : 0.35
    if (rng() > chance) continue
    titles.push({
      year: row.endYear,
      label: `${hist.leagues[opts.leagueId]?.name ?? 'League'} ${row.season}`,
      labelTh: `${hist.leagues[opts.leagueId]?.nameTh ?? 'ลีก'} ${row.season}`,
      competition: 'league',
      clubName: row.club,
    })
  }

  // ถ้วยในประเทศสุ่มตาม OVR
  for (let y = Math.max(2016, opts.currentSeason - 10); y < opts.currentSeason; y++) {
    const at = opts.clubBySeason.get(y)
    if (!at) continue
    const p = player.overall >= 84 ? 0.22 : player.overall >= 76 ? 0.1 : 0.04
    if (rng() > p) continue
    titles.push({
      year: y,
      label: `${cupName} ${seasonLabel(y)}`,
      labelTh: `${cupName} ${seasonLabel(y)}`,
      competition: 'cup',
      clubName: at.name,
    })
  }

  // UCL จาก timeline ถ้าอยู่ทีมแชมป์ปีนั้น
  for (const ev of hist.timeline) {
    if (ev.comp !== 'ucl' || !ev.winner) continue
    const y = ev.year
    const at = opts.clubBySeason.get(y)
    if (!at) continue
    const match =
      at.name === ev.winner ||
      (ev.winnerKey && at.key === ev.winnerKey) ||
      at.name.includes(ev.winner.split(' ').pop() ?? '___')
    if (!match) continue
    if (player.overall < 78 && rng() > 0.4) continue
    titles.push({
      year: y,
      label: `UCL ${ev.season ?? y}`,
      labelTh: `แชมเปียนส์ลีก ${ev.season ?? y}`,
      competition: 'ucl',
      clubName: ev.winner,
    })
  }

  // ดึงจาก worldHistory players ชื่อตรง
  const known = hist.players.find((p) => p.name.toLowerCase() === player.name.toLowerCase())
  if (known) {
    for (const h of known.honours) {
      if (h.kind === 'ballon_dor') continue
      const comp =
        h.kind === 'ucl'
          ? 'ucl'
          : h.kind === 'nation'
            ? h.label.toLowerCase().includes('world')
              ? 'world_cup'
              : h.label.toLowerCase().includes('euro')
                ? 'euro'
                : 'other'
            : h.kind === 'league'
              ? 'league'
              : 'other'
      if (titles.some((t) => t.label === h.label && t.year === h.year)) continue
      titles.push({
        year: h.year,
        label: h.label,
        labelTh: h.label,
        competition: comp,
        clubName: known.clubs[0],
        nation: known.nation,
      })
    }
  }

  return titles.sort((a, b) => b.year - a.year)
}

function buildIntl(
  player: Pick<Player, 'id' | 'name' | 'age' | 'overall' | 'role' | 'nationality' | 'fmInside'>,
  opts: { leagueId: string; currentSeason: number; titles: PlayerCareerTitle[] },
): PlayerCareerIntl {
  const rng = mulberry32(hashStr(`${player.id}|${player.name}|intl`))
  const nation =
    player.nationality ||
    leagueNation(opts.leagueId)
  const nationTh = NATION_TH[nation] ?? nation

  const histPlayer = getWorldHistory().players.find(
    (p) => p.name.toLowerCase() === player.name.toLowerCase(),
  )

  // โอกาสติดทีมชาติ
  const ntChance =
    player.overall >= 86
      ? 0.95
      : player.overall >= 80
        ? 0.75
        : player.overall >= 74
          ? 0.4
          : player.overall >= 68
            ? 0.15
            : 0.05

  if (rng() > ntChance && !histPlayer) {
    return {
      nation,
      nationTh,
      caps: player.fmInside?.caps ?? 0,
      goals: player.fmInside?.goalsIntl ?? 0,
      worldCups: [],
      majorTournaments: [],
    }
  }

  const yearsIntl = clamp(player.age - 19, 1, 12)
  let caps =
    player.fmInside?.caps ??
    clamp((player.overall - 60) * (1.2 + rng()) * yearsIntl * 0.35, 0, 140)
  let goals =
    player.fmInside?.goalsIntl ??
    (player.role === 'GK'
      ? 0
      : clamp(caps * roleRates(player.role).goalsPerApp * 0.7, 0, 80))

  const worldCups: PlayerWorldCupEntry[] = []
  for (const year of WC_YEARS) {
    if (year > opts.currentSeason) continue
    const ageThen = player.age - (opts.currentSeason - year)
    if (ageThen < 18 || ageThen > 38) continue
    const makeSquad =
      histPlayer?.honours.some((h) => h.label.includes(`World Cup ${year}`)) ||
      opts.titles.some((t) => t.competition === 'world_cup' && t.year === year) ||
      (player.overall >= 78 && rng() < 0.55) ||
      (player.overall >= 72 && rng() < 0.25)
    if (!makeSquad) continue

    const champion =
      year === 2026 && nation === 'Spain'
        ? player.overall >= 70 && rng() < 0.85
        : year === 2022 && nation === 'Argentina'
          ? player.overall >= 72 && rng() < 0.8
          : year === 2018 && nation === 'France'
            ? player.overall >= 72 && rng() < 0.8
            : false

    const stages = champion
      ? [
          { bestStage: 'Winner', bestStageTh: 'แชมป์โลก' },
          { bestStage: 'Final', bestStageTh: 'ชิงชนะเลิศ' },
        ]
      : [
          { bestStage: 'Group', bestStageTh: 'รอบกลุ่ม' },
          { bestStage: 'R16', bestStageTh: 'รอบ 16' },
          { bestStage: 'QF', bestStageTh: 'รอบ 8' },
          { bestStage: 'SF', bestStageTh: 'รองชิง' },
          { bestStage: 'Final', bestStageTh: 'ชิงชนะเลิศ' },
        ]
    const stage = champion
      ? stages[0]!
      : stages[Math.min(stages.length - 1, Math.floor(rng() * (player.overall >= 84 ? 5 : 3)))]!

    const apps = clamp(1 + rng() * (champion ? 6 : 4), 0, 7)
    const g =
      player.role === 'GK' ? 0 : clamp(apps * roleRates(player.role).goalsPerApp * 1.2, 0, 5)
    const a = clamp(apps * roleRates(player.role).assistsPerApp, 0, 4)
    worldCups.push({
      year,
      apps,
      goals: g,
      assists: a,
      bestStage: stage.bestStage,
      bestStageTh: stage.bestStageTh,
      champion: champion || stage.bestStage === 'Winner',
    })
    caps = Math.max(caps, caps + apps)
    goals += g

    if (champion) {
      opts.titles.push({
        year,
        label: `FIFA World Cup ${year}`,
        labelTh: `ฟุตบอลโลก ${year}`,
        competition: 'world_cup',
        nation,
      })
    }
  }

  const majorTournaments: PlayerCareerIntl['majorTournaments'] = []
  const euroEligible = ['England', 'Spain', 'Germany', 'Italy', 'France', 'Portugal', 'Croatia', 'Netherlands', 'Belgium'].includes(
    nation,
  )
  if (euroEligible) {
    for (const year of EURO_YEARS) {
      if (year > opts.currentSeason) continue
      const ageThen = player.age - (opts.currentSeason - year)
      if (ageThen < 18) continue
      if (player.overall < 74 && rng() > 0.3) continue
      if (player.overall < 70) continue
      const apps = clamp(1 + rng() * 4, 0, 6)
      const winner =
        (year === 2024 && nation === 'Spain') ||
        (year === 2021 && nation === 'Italy') ||
        (year === 2016 && nation === 'Portugal')
      majorTournaments.push({
        year,
        name: `UEFA Euro ${year}`,
        nameTh: `ยูโร ${year}`,
        apps,
        goals:
          player.role === 'GK' ? 0 : clamp(apps * roleRates(player.role).goalsPerApp, 0, 4),
        bestStageTh: winner ? 'แชมป์' : rng() < 0.3 ? 'รอบน็อกเอาต์' : 'รอบกลุ่ม',
      })
      if (winner && player.overall >= 72 && rng() < 0.7) {
        opts.titles.push({
          year,
          label: `UEFA Euro ${year}`,
          labelTh: `ยูโร ${year}`,
          competition: 'euro',
          nation,
        })
      }
    }
  }

  if (nation === 'Thailand' && player.overall >= 68) {
    majorTournaments.push({
      year: 2022,
      name: 'AFF Championship',
      nameTh: 'ซูซูกิ คัพ / อาเซียน',
      apps: clamp(2 + rng() * 4, 1, 6),
      goals: player.role === 'GK' ? 0 : clamp(rng() * 3, 0, 3),
      bestStageTh: rng() < 0.4 ? 'ชิงชนะเลิศ' : 'รอบรอง',
    })
  }

  return {
    nation,
    nationTh,
    caps: clamp(caps, 0, 180),
    goals: clamp(goals, 0, 100),
    worldCups,
    majorTournaments,
  }
}

export function buildInjuryHistory(
  player: Pick<Player, 'id' | 'name' | 'age' | 'hidden' | 'bio' | 'isYouth'>,
  opts: { currentSeason: number },
): InjuryRecord[] {
  if (player.isYouth && player.age < 18) return []

  const prone = player.hidden?.injuryProneness ?? 8
  const bioProne = Boolean(player.bio?.injuryProne)
  const rng = mulberry32(hashStr(`${player.id}|${player.name}|inj`))

  const baseCount = (prone / 20) * 5 + (bioProne ? 2 : 0) + rng() * 2
  const count = clamp(baseCount, 0, 10)
  if (count === 0) return []

  const partCounts = new Map<BodyPartId, number>()
  const records: InjuryRecord[] = []
  const startYear = Math.max(2016, opts.currentSeason - Math.min(10, player.age - 16))

  for (let i = 0; i < count; i++) {
    const season = startYear + Math.floor(rng() * Math.max(1, opts.currentSeason - startYear))
    const month = 1 + Math.floor(rng() * 11)
    const day = 1 + Math.floor(rng() * 27)
    const date = `${season}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    const bodyPart = BODY_PARTS[Math.floor(rng() * BODY_PARTS.length)]!
    const prev = partCounts.get(bodyPart) ?? 0
    partCounts.set(bodyPart, prev + 1)

    const type = INJURY_TYPES[Math.floor(rng() * (prone >= 14 ? 3 : 2))] ?? 'muscle'
    let days =
      type === 'bone'
        ? 40 + Math.floor(rng() * 80)
        : type === 'ligament'
          ? 25 + Math.floor(rng() * 70)
          : 7 + Math.floor(rng() * 35)
    if (bioProne) days = Math.round(days * 1.25)

    const chronic =
      (prev >= 1 && prone >= 11) || (bioProne && prev >= 1) || (prone >= 15 && rng() < 0.35)
    if (chronic) days = Math.round(days * (1.2 + rng() * 0.5))

    const typeTh =
      type === 'bone' ? 'กระดูก' : type === 'ligament' ? 'เอ็น' : 'กล้ามเนื้อ'
    records.push({
      type,
      days,
      source: 'history',
      bodyPart,
      date,
      season,
      chronic,
      noteTh: chronic
        ? `เจ็บ${typeTh}ซ้ำบริเวณเดิม — เสี่ยงเรื้อรัง`
        : `เจ็บ${typeTh}ช่วง ${seasonLabel(season)}`,
    })
  }

  return records.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 12)
}

function buildProfileSummary(
  player: Pick<Player, 'name' | 'overall'>,
  profile: Omit<PlayerCareerProfile, 'summaryTh'>,
  seasons: PlayerCareerSeason[],
): string {
  const apps = seasons.reduce((s, r) => s + r.apps, 0)
  const goals = seasons.reduce((s, r) => s + r.goals, 0)
  const clubs = profile.clubs.map((c) => c.clubName).join(' → ')
  const titles = profile.titles.length
  const wc = profile.intl.worldCups.length
  return `${player.name} · เปิดตัว ${profile.debutYear} · สโมสร: ${clubs || '—'} · สถิติย้อนหลัง ${apps} นัด ${goals} ประตู · แชมป์ ${titles} รายการ · ฟุตบอลโลก ${wc} สมัย · แคปชาติ ${profile.intl.caps}`
}

export function buildCareerProfile(
  player: Player,
  opts: { leagueId: string; clubName: string; clubKey?: string; currentSeason: number },
): { profile: PlayerCareerProfile; seasons: PlayerCareerSeason[] } {
  const path = buildClubPathAndTransfers(player, opts)
  const seasons = buildCareerSeasons(player, {
    leagueId: opts.leagueId,
    clubName: opts.clubName,
    currentSeason: opts.currentSeason,
    clubBySeason: path.clubBySeason,
  })
  const titles = buildTitles(player, {
    leagueId: opts.leagueId,
    clubBySeason: path.clubBySeason,
    currentSeason: opts.currentSeason,
  })
  const intl = buildIntl(player, {
    leagueId: opts.leagueId,
    currentSeason: opts.currentSeason,
    titles,
  })
  const base: Omit<PlayerCareerProfile, 'summaryTh'> = {
    version: CAREER_PROFILE_VERSION,
    source: 'transfermarkt',
    debutYear: path.debutYear,
    clubs: path.clubs,
    transfers: path.transfers,
    titles: titles.sort((a, b) => b.year - a.year),
    intl,
  }
  return {
    profile: { ...base, summaryTh: buildProfileSummary(player, base, seasons) },
    seasons,
  }
}

/**
 * ไม่คัดลอก career เข้าเซฟ — ข้อมูลอยู่ IndexedDB
 * ล้างก้อนหนักจากเซฟเก่าถ้ามี
 */
export function seedPlayerCareer(
  player: Player,
  _opts: { leagueId: string; clubName: string; clubKey?: string; currentSeason: number },
): Player {
  const hasHeavy =
    (player.careerSeasons?.length ?? 0) > 0 ||
    Boolean(player.careerProfile) ||
    (player.injuryHistory ?? []).some((r) => r.source === 'history')
  if (!hasHeavy) return player
  return {
    ...player,
    careerSeasons: undefined,
    careerProfile: undefined,
    injuryHistory: (player.injuryHistory ?? []).filter((r) => r.source !== 'history'),
  }
}

export function careerSeasonTotals(seasons: PlayerCareerSeason[] | undefined) {
  const list = seasons ?? []
  return {
    apps: list.reduce((s, r) => s + r.apps, 0),
    goals: list.reduce((s, r) => s + r.goals, 0),
    assists: list.reduce((s, r) => s + r.assists, 0),
    seasons: list.length,
  }
}

/** ล้างประวัติอาชีพก้อนใหญ่จากเซฟ (ย้ายไป IDB แล้ว) */
export function ensurePlayerCareerSeeds(save: GameSave): GameSave {
  let changed = false
  const players = save.players.map((p) => {
    const next = seedPlayerCareer(p, {
      leagueId: save.leagueId,
      clubName: 'Club',
      currentSeason: save.season,
    })
    if (next !== p) changed = true
    return next
  })
  return changed ? { ...save, players } : save
}

export function clubNameForSeed(club: Club): string {
  return club.name
}
