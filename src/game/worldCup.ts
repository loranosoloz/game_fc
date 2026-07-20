/**
 * ฟุตบอลโลก 32 ทีม — คัดเลือกตาม confederation (กลุ่มเก็บแต้ม)
 * + รอบสุดท้าย 8 กลุ่ม × 4 แล้วเข้าน็อกเอาต์
 */
import type { GameSave } from './types'
import { allAssociationNations, ensureAssociations } from './associations'
import { ntTeam, normalizeNation, applyNtCaps, playerNationality } from './nationalTeams'
import { pushNews } from './media'
import { pickOutlet } from './mediaOutlets'
import type { IntlTournamentReport, IntlMatchResultLite } from './intlTournaments'
import {
  applyNationTournamentReputation,
  applyTournamentPlayerFame,
  bumpClubReputation,
} from './reputation'

export type Confederation = 'UEFA' | 'CONMEBOL' | 'CAF' | 'AFC' | 'CONCACAF' | 'OFC'

export interface WcTableRow {
  nation: string
  nationTh: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
  /** true = สมาคมในเซฟ / false = ชาติจำลองเสริมโควต้า */
  real: boolean
}

export interface WcGroup {
  id: string
  confederation: Confederation
  label: string
  rows: WcTableRow[]
}

export interface WcFixture {
  id: string
  groupId: string
  confederation: Confederation
  home: string
  away: string
  matchday: number
  played: boolean
  hg?: number
  ag?: number
}

export interface WcFinalsGroup {
  id: string
  label: string
  rows: WcTableRow[]
}

export interface WorldCupState {
  /** ปีทัวร์นาเมนต์สุดท้ายที่กำลังคัด / จะแข่ง */
  finalsYear: number
  /** ฤดูกาลที่เริ่มเก็บแต้มคัดเลือก (= finalsYear - 2) */
  qualStartSeason: number
  phase: 'waiting' | 'qualifying' | 'qualified' | 'finals_done'
  /** แมตช์เดย์คัดเลือกที่เล่นไปแล้ว */
  qualMatchday: number
  qualMaxMatchday: number
  qualGroups: WcGroup[]
  qualFixtures: WcFixture[]
  /** 32 ชาติที่ผ่าน (ว่างจนกว่าจะปิดคัด) */
  qualified: string[]
  /** โควต้าต่อโซน */
  slots: Record<Confederation, number>
  finalsGroups?: WcFinalsGroup[]
  finalsMatches?: IntlMatchResultLite[]
  champion?: string
  championTh?: string
  note: string
}

/** โควต้า 32 ทีม */
export const WC_SLOTS: Record<Confederation, number> = {
  UEFA: 13,
  CAF: 5,
  AFC: 5,
  CONMEBOL: 5,
  CONCACAF: 3,
  OFC: 1,
}

const REAL_CONFED: Record<string, Confederation> = {
  England: 'UEFA',
  Spain: 'UEFA',
  Germany: 'UEFA',
  France: 'UEFA',
  Italy: 'UEFA',
  Portugal: 'UEFA',
  Netherlands: 'UEFA',
  Belgium: 'UEFA',
  Croatia: 'UEFA',
  Switzerland: 'UEFA',
  Denmark: 'UEFA',
  Austria: 'UEFA',
  Scotland: 'UEFA',
  Wales: 'UEFA',
  Ireland: 'UEFA',
  Poland: 'UEFA',
  Sweden: 'UEFA',
  Norway: 'UEFA',
  Serbia: 'UEFA',
  Turkey: 'UEFA',
  Greece: 'UEFA',
  Argentina: 'CONMEBOL',
  Brazil: 'CONMEBOL',
  Uruguay: 'CONMEBOL',
  Colombia: 'CONMEBOL',
  Morocco: 'CAF',
  Senegal: 'CAF',
  Nigeria: 'CAF',
  Egypt: 'CAF',
  Japan: 'AFC',
  'South Korea': 'AFC',
  Australia: 'AFC',
  Thailand: 'AFC',
  USA: 'CONCACAF',
  Mexico: 'CONCACAF',
  Canada: 'CONCACAF',
}

/** ชาติจำลองเสริมให้กลุ่มคัดเลือกเต็ม */
const FILLER: { nation: string; nationTh: string; confederation: Confederation; strength: number }[] =
  [
    { nation: 'Chile', nationTh: 'ชิลี', confederation: 'CONMEBOL', strength: 74 },
    { nation: 'Ecuador', nationTh: 'เอกวาดอร์', confederation: 'CONMEBOL', strength: 72 },
    { nation: 'Peru', nationTh: 'เปรู', confederation: 'CONMEBOL', strength: 70 },
    { nation: 'Paraguay', nationTh: 'ปารากวัย', confederation: 'CONMEBOL', strength: 71 },
    { nation: 'Venezuela', nationTh: 'เวเนซุเอลา', confederation: 'CONMEBOL', strength: 68 },
    { nation: 'Algeria', nationTh: 'แอลจีเรีย', confederation: 'CAF', strength: 73 },
    { nation: 'Cameroon', nationTh: 'แคเมอรูน', confederation: 'CAF', strength: 72 },
    { nation: 'Ghana', nationTh: 'กานา', confederation: 'CAF', strength: 71 },
    { nation: 'Ivory Coast', nationTh: 'โกตดิวัวร์', confederation: 'CAF', strength: 72 },
    { nation: 'Tunisia', nationTh: 'ตูนิเซีย', confederation: 'CAF', strength: 70 },
    { nation: 'Mali', nationTh: 'มาลี', confederation: 'CAF', strength: 69 },
    { nation: 'Iran', nationTh: 'อิหร่าน', confederation: 'AFC', strength: 74 },
    { nation: 'Saudi Arabia', nationTh: 'ซาอุดีอาระเบีย', confederation: 'AFC', strength: 72 },
    { nation: 'Qatar', nationTh: 'กาตาร์', confederation: 'AFC', strength: 70 },
    { nation: 'Iraq', nationTh: 'อิรัก', confederation: 'AFC', strength: 68 },
    { nation: 'Uzbekistan', nationTh: 'อุซเบกิสถาน', confederation: 'AFC', strength: 69 },
    { nation: 'China', nationTh: 'จีน', confederation: 'AFC', strength: 66 },
    { nation: 'Costa Rica', nationTh: 'คอสตาริกา', confederation: 'CONCACAF', strength: 70 },
    { nation: 'Jamaica', nationTh: 'จาเมกา', confederation: 'CONCACAF', strength: 68 },
    { nation: 'Panama', nationTh: 'ปานามา', confederation: 'CONCACAF', strength: 67 },
    { nation: 'Honduras', nationTh: 'ฮอนดูรัส', confederation: 'CONCACAF', strength: 65 },
    { nation: 'New Zealand', nationTh: 'นิวซีแลนด์', confederation: 'OFC', strength: 66 },
    { nation: 'Fiji', nationTh: 'ฟิจิ', confederation: 'OFC', strength: 55 },
    { nation: 'Solomon Islands', nationTh: 'หมู่เกาะโซโลมอน', confederation: 'OFC', strength: 52 },
    { nation: 'Ukraine', nationTh: 'ยูเครน', confederation: 'UEFA', strength: 75 },
    { nation: 'Czechia', nationTh: 'เช็ก', confederation: 'UEFA', strength: 74 },
    { nation: 'Hungary', nationTh: 'ฮังการี', confederation: 'UEFA', strength: 73 },
    { nation: 'Romania', nationTh: 'โรมาเนีย', confederation: 'UEFA', strength: 71 },
    { nation: 'Slovakia', nationTh: 'สโลวาเกีย', confederation: 'UEFA', strength: 70 },
    { nation: 'Finland', nationTh: 'ฟินแลนด์', confederation: 'UEFA', strength: 69 },
    { nation: 'Bosnia', nationTh: 'บอสเนีย', confederation: 'UEFA', strength: 70 },
    { nation: 'Albania', nationTh: 'แอลเบเนีย', confederation: 'UEFA', strength: 68 },
    { nation: 'Iceland', nationTh: 'ไอซ์แลนด์', confederation: 'UEFA', strength: 67 },
    { nation: 'North Macedonia', nationTh: 'มาซิโดเนียเหนือ', confederation: 'UEFA', strength: 66 },
  ]

export const CONFED_LABEL: Record<Confederation, string> = {
  UEFA: 'ยุโรป (UEFA)',
  CONMEBOL: 'อเมริกาใต้ (CONMEBOL)',
  CAF: 'แอฟริกา (CAF)',
  AFC: 'เอเชีย (AFC)',
  CONCACAF: 'อเมริกาเหนือ (CONCACAF)',
  OFC: 'โอเชียเนีย (OFC)',
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

export function nextWorldCupYear(fromYear: number): number {
  let y = fromYear
  for (let i = 0; i < 8; i++) {
    if ((y - 2) % 4 === 0) return y
    y++
  }
  return fromYear + (4 - ((fromYear - 2) % 4))
}

/**
 * ปีชิงฟุตบอลโลกที่ผูกกับฤดูกาลคลับนี้
 * — ฤดูร้อนปีนั้น = ชิงก่อนเปิดลีก ส.ค. (เช่น ฤดูกาล 2026 → บอลโลก 2026 จบแล้วค่อยปรีซีซั่น)
 */
export function pickFinalsYear(season: number): number {
  return nextWorldCupYear(season)
}

export function qualStartForFinals(finalsYear: number): number {
  return finalsYear - 2
}

export function labelThOfNation(nation: string): string {
  const fill = FILLER.find((f) => f.nation === nation)
  if (fill) return fill.nationTh
  return ntTeam(nation)?.labelTh ?? nation
}

export function confederationOf(nation: string): Confederation | null {
  const n = normalizeNation(nation) ?? nation
  if (REAL_CONFED[n]) return REAL_CONFED[n]!
  const fill = FILLER.find((f) => f.nation === n || f.nation === nation)
  return fill?.confederation ?? null
}

export function nationStrengthWc(save: GameSave, nation: string): number {
  const fill = FILLER.find((f) => f.nation === nation)
  if (fill) return fill.strength
  const n = normalizeNation(nation) ?? nation
  const players = save.players.filter((p) => playerNationality(p, save) === n)
  if (players.length === 0) {
    const assoc = save.associations?.[n]
    return assoc ? Math.max(55, 100 - assoc.fifaRank * 0.45) : 62
  }
  const top = [...players].sort((a, b) => b.overall - a.overall).slice(0, 16)
  return top.reduce((s, p) => s + p.overall, 0) / top.length
}

function blankRow(nation: string, real: boolean): WcTableRow {
  return {
    nation,
    nationTh: labelThOfNation(nation),
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    gf: 0,
    ga: 0,
    points: 0,
    real,
  }
}

export function sortWcRows(rows: WcTableRow[]): WcTableRow[] {
  return rows.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    if (b.gf !== a.gf) return b.gf - a.gf
    return a.nation.localeCompare(b.nation)
  })
}

function applyResult(rows: WcTableRow[], home: string, away: string, hg: number, ag: number): WcTableRow[] {
  return rows.map((r) => {
    if (r.nation !== home && r.nation !== away) return r
    const isHome = r.nation === home
    const gf = isHome ? hg : ag
    const ga = isHome ? ag : hg
    const won = gf > ga
    const drawn = gf === ga
    return {
      ...r,
      played: r.played + 1,
      won: r.won + (won ? 1 : 0),
      drawn: r.drawn + (drawn ? 1 : 0),
      lost: r.lost + (!won && !drawn ? 1 : 0),
      gf: r.gf + gf,
      ga: r.ga + ga,
      points: r.points + (won ? 3 : drawn ? 1 : 0),
    }
  })
}

function simScore(
  save: GameSave,
  home: string,
  away: string,
  rng: () => number,
  mustDecide: boolean,
): { hg: number; ag: number } {
  const hs = nationStrengthWc(save, home)
  const as_ = nationStrengthWc(save, away)
  const hp = hs / (hs + as_)
  let hg = 0
  let ag = 0
  for (let i = 0; i < 4; i++) {
    if (rng() < hp * 0.42) hg++
    if (rng() < (1 - hp) * 0.42) ag++
  }
  if (mustDecide && hg === ag) {
    if (rng() < hp) hg++
    else ag++
  }
  return { hg, ag }
}

function shuffleInPlace<T>(arr: T[], rng: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
  }
}

function buildQualifying(save: GameSave, finalsYear: number): Omit<WorldCupState, 'phase' | 'note'> {
  const rng = mulberry32(finalsYear * 7919 + save.season * 13)
  const realSet = new Set(allAssociationNations().map((n) => normalizeNation(n) ?? n))

  const byConfed: Record<Confederation, string[]> = {
    UEFA: [],
    CONMEBOL: [],
    CAF: [],
    AFC: [],
    CONCACAF: [],
    OFC: [],
  }

  for (const n of realSet) {
    const c = REAL_CONFED[n]
    if (c) byConfed[c].push(n)
  }
  for (const f of FILLER) {
    if (!byConfed[f.confederation].includes(f.nation)) {
      byConfed[f.confederation].push(f.nation)
    }
  }

  const qualGroups: WcGroup[] = []
  const qualFixtures: WcFixture[] = []
  let maxMd = 0

  for (const confed of Object.keys(byConfed) as Confederation[]) {
    const pool = byConfed[confed]!
    shuffleInPlace(pool, rng)
    const groupSize = 4
    const groupCount = Math.max(1, Math.ceil(pool.length / groupSize))
    for (let g = 0; g < groupCount; g++) {
      const slice = pool.slice(g * groupSize, (g + 1) * groupSize)
      if (slice.length < 2) {
        if (slice.length === 1 && qualGroups.length > 0) {
          const prev = qualGroups[qualGroups.length - 1]!
          if (prev.confederation === confed) {
            prev.rows.push(blankRow(slice[0]!, realSet.has(slice[0]!)))
            continue
          }
        }
        continue
      }
      const id = `Q-${confed}-${String.fromCharCode(65 + g)}`
      const rows = slice.map((n) => blankRow(n, realSet.has(n)))
      qualGroups.push({
        id,
        confederation: confed,
        label: `${CONFED_LABEL[confed]} · กลุ่ม ${String.fromCharCode(65 + g)}`,
        rows,
      })
      const teams = slice.slice()
      if (teams.length % 2 === 1) teams.push('__BYE__')
      const n = teams.length
      const rounds = n - 1
      const half = n / 2
      const rot = teams.slice()
      const leg1: WcFixture[] = []
      for (let r = 0; r < rounds; r++) {
        const md = r + 1
        maxMd = Math.max(maxMd, md)
        for (let i = 0; i < half; i++) {
          const home = rot[i]!
          const away = rot[n - 1 - i]!
          if (home === '__BYE__' || away === '__BYE__') continue
          leg1.push({
            id: `${id}-md${md}-${home}-${away}`,
            groupId: id,
            confederation: confed,
            home,
            away,
            matchday: md,
            played: false,
          })
        }
        const fixed = rot[0]!
        const rest = rot.slice(1)
        rest.unshift(rest.pop()!)
        rot.splice(0, rot.length, fixed, ...rest)
      }
      // เลก 2 เหย้า-เยือนสลับ — รวม ~6 MD (กลุ่ม 4 ทีม) กินเวลา ~2 ฤดูกาล FIFA window
      const leg1Count = rounds
      for (const f of leg1) {
        qualFixtures.push(f)
        const md2 = f.matchday + leg1Count
        maxMd = Math.max(maxMd, md2)
        qualFixtures.push({
          id: `${id}-md${md2}-${f.away}-${f.home}`,
          groupId: id,
          confederation: confed,
          home: f.away,
          away: f.home,
          matchday: md2,
          played: false,
        })
      }
    }
  }

  return {
    finalsYear,
    qualStartSeason: qualStartForFinals(finalsYear),
    qualMatchday: 0,
    qualMaxMatchday: maxMd,
    qualGroups,
    qualFixtures,
    qualified: [],
    slots: { ...WC_SLOTS },
  }
}

function resolveQualifiers(state: WorldCupState): string[] {
  const picked: string[] = []
  for (const confed of Object.keys(WC_SLOTS) as Confederation[]) {
    const need = WC_SLOTS[confed]
    const groups = state.qualGroups.filter((g) => g.confederation === confed)
    type Cand = { nation: string; groupRank: number; points: number; gd: number; gf: number }
    const cands: Cand[] = []
    for (const g of groups) {
      const sorted = sortWcRows(g.rows)
      sorted.forEach((r, idx) => {
        cands.push({
          nation: r.nation,
          groupRank: idx + 1,
          points: r.points,
          gd: r.gf - r.ga,
          gf: r.gf,
        })
      })
    }
    cands.sort((a, b) => {
      if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank
      if (b.points !== a.points) return b.points - a.points
      if (b.gd !== a.gd) return b.gd - a.gd
      return b.gf - a.gf
    })
    for (const c of cands) {
      if (picked.filter((n) => confederationOf(n) === confed).length >= need) break
      if (!picked.includes(c.nation)) picked.push(c.nation)
    }
  }
  if (picked.length < 32) {
    const all = state.qualGroups
      .flatMap((g) => sortWcRows(g.rows).map((r, idx) => ({ ...r, groupRank: idx + 1 })))
      .sort((a, b) => {
        if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank
        if (b.points !== a.points) return b.points - a.points
        return b.gf - b.ga - (a.gf - a.ga)
      })
    for (const r of all) {
      if (picked.length >= 32) break
      if (!picked.includes(r.nation)) picked.push(r.nation)
    }
  }
  return picked.slice(0, 32)
}

function runFinalsTournament(
  save: GameSave,
  qualified: string[],
  year: number,
): { groups: WcFinalsGroup[]; matches: IntlMatchResultLite[]; champion: string } {
  const rng = mulberry32(year * 4243 + qualified.length * 17)
  const pots = qualified.slice()
  shuffleInPlace(pots, rng)
  const groups: WcFinalsGroup[] = []
  const matches: IntlMatchResultLite[] = []

  for (let g = 0; g < 8; g++) {
    const slice = pots.slice(g * 4, g * 4 + 4)
    const label = `กลุ่ม ${String.fromCharCode(65 + g)}`
    let rows = slice.map((n) => blankRow(n, true))
    for (let i = 0; i < slice.length; i++) {
      for (let j = i + 1; j < slice.length; j++) {
        const home = slice[i]!
        const away = slice[j]!
        const { hg, ag } = simScore(save, home, away, rng, false)
        rows = applyResult(rows, home, away, hg, ag)
        matches.push({
          home,
          away,
          homeTh: labelThOfNation(home),
          awayTh: labelThOfNation(away),
          hg,
          ag,
          stage: label,
        })
      }
    }
    groups.push({ id: `F-${String.fromCharCode(65 + g)}`, label, rows: sortWcRows(rows) })
  }

  const adv: string[] = []
  for (const g of groups) {
    const s = sortWcRows(g.rows)
    adv.push(s[0]!.nation, s[1]!.nation)
  }
  let round = adv
  const stages = ['R16', 'QF', 'SF', 'Final']
  let stageIdx = 0
  while (round.length >= 2) {
    const stage = stages[Math.min(stageIdx, stages.length - 1)]!
    const nextRound: string[] = []
    for (let i = 0; i + 1 < round.length; i += 2) {
      const home = round[i]!
      const away = round[i + 1]!
      const { hg, ag } = simScore(save, home, away, rng, true)
      matches.push({
        home,
        away,
        homeTh: labelThOfNation(home),
        awayTh: labelThOfNation(away),
        hg,
        ag,
        stage,
      })
      nextRound.push(hg >= ag ? home : away)
    }
    round = nextRound
    stageIdx++
    if (stageIdx > 6) break
  }

  return { groups, matches, champion: round[0] ?? qualified[0]! }
}

export function createWorldCupState(save: GameSave, finalsYear?: number): WorldCupState {
  const year = finalsYear ?? pickFinalsYear(save.season)
  const base = buildQualifying(save, year)
  const start = base.qualStartSeason
  const waiting = save.season < start
  return {
    ...base,
    phase: waiting ? 'waiting' : 'qualifying',
    note: waiting
      ? `รอเปิดคัดเลือกฟุตบอลโลก ${year} · เริ่มฤดูกาล ${start} (คัด ~2 ปี แล้วเข้า 32 ทีมปี ${year})`
      : `คัดเลือกฟุตบอลโลก ${year} · ฤดูกาล ${start}–${year} · เหย้า-เยือน เก็บแต้มทุก FIFA window`,
  }
}

export function ensureWorldCup(save: GameSave): GameSave {
  const withA = ensureAssociations(save)
  const target = pickFinalsYear(withA.season)
  const wc = withA.worldCup

  // เซฟเก่า: ไม่มี qualStart / ตารางสั้นเกินไป → สร้างรอบคัดแบบ 2 ปีใหม่
  const needsRebuild =
    !wc?.qualGroups?.length ||
    wc.qualStartSeason == null ||
    (wc.phase === 'qualifying' && (wc.qualMaxMatchday ?? 0) < 6 && (wc.qualMatchday ?? 0) === 0)

  if (needsRebuild) {
    const created = createWorldCupState(withA, wc?.finalsYear && wc.finalsYear > withA.season ? wc.finalsYear : target)
    return {
      ...withA,
      worldCup: {
        ...created,
        finalsGroups: wc?.finalsGroups,
        finalsMatches: wc?.finalsMatches,
        champion: wc?.champion,
        championTh: wc?.championTh,
        note: wc?.championTh
          ? `แชมป์ล่าสุด ${wc.championTh} · ${created.note}`
          : created.note,
      },
    }
  }

  // อัปเดต phase waiting → qualifying เมื่อถึงปีเปิดคัด
  if (wc.phase === 'waiting' && withA.season >= wc.qualStartSeason) {
    return {
      ...withA,
      worldCup: {
        ...wc,
        phase: 'qualifying',
        note: `เปิดคัดเลือกฟุตบอลโลก ${wc.finalsYear} แล้ว · เก็บแต้มทุก FIFA window จนถึงก่อนฤดูร้อน ${wc.finalsYear}`,
      },
      inbox: [
        {
          id: `msg-wc-qual-open-${Date.now()}`,
          date: withA.currentDate,
          title: `เปิดคัดเลือกบอลโลก ${wc.finalsYear}`,
          body: `ช่วงคัดเลือก ~2 ปี (${wc.qualStartSeason}–${wc.finalsYear}) · แบ่งกลุ่มตามทวีป เก็บแต้มเหย้า-เยือน`,
          read: false,
        },
        ...withA.inbox,
      ].slice(0, 45),
    }
  }

  // ปีเป้าหมายผ่านไปแล้ว → เริ่มคัดรอบใหม่
  if (wc.finalsYear < withA.season) {
    const nextTarget = pickFinalsYear(withA.season)
    const created = createWorldCupState(withA, nextTarget)
    return {
      ...withA,
      worldCup: {
        ...created,
        finalsGroups: wc.finalsGroups,
        finalsMatches: wc.finalsMatches,
        champion: wc.champion,
        championTh: wc.championTh,
        note: wc.championTh
          ? `แชมป์ล่าสุด ${wc.championTh} · ${created.note}`
          : created.note,
      },
    }
  }

  return withA
}

/** เล่นแมตช์เดย์คัดเลือกถัดไป (เรียกตอน FIFA window) — เฉพาะช่วง 2 ปีคัดเลือก */
export function advanceWorldCupQualifiers(save: GameSave): GameSave {
  let next = ensureWorldCup(save)
  const wc = next.worldCup
  if (!wc) return next
  if (wc.phase === 'waiting') return next
  if (wc.phase !== 'qualifying') return next
  if (next.season < wc.qualStartSeason) return next
  // ปีชิง: ไม่ซิมคัดต่อ (รอรอบ 32 ทีมฤดูร้อน)
  if (next.season >= wc.finalsYear) return next

  const nextMd = wc.qualMatchday + 1
  if (nextMd > wc.qualMaxMatchday) {
    const qualified = resolveQualifiers(wc)
    return {
      ...next,
      worldCup: {
        ...wc,
        phase: 'qualified',
        qualified,
        note: `จบคัดเลือก · ${qualified.length} ชาติผ่านเข้าฟุตบอลโลก ${wc.finalsYear} (รอฤดูร้อน)`,
      },
      inbox: [
        {
          id: `msg-wc-qual-done-${Date.now()}`,
          date: next.currentDate,
          title: `จบคัดเลือกบอลโลก ${wc.finalsYear}`,
          body: `ผ่าน ${qualified.length} ชาติหลังคัดเลือก ~2 ปี: ${qualified
            .slice(0, 12)
            .map(labelThOfNation)
            .join(' · ')}${qualified.length > 12 ? '…' : ''}`,
          read: false,
        },
        ...next.inbox,
      ].slice(0, 45),
    }
  }

  const rng = mulberry32(next.season * 333 + nextMd * 77 + wc.finalsYear)
  let groups = wc.qualGroups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r })) }))
  const fixtures = wc.qualFixtures.map((f) => ({ ...f }))

  for (const f of fixtures) {
    if (f.played || f.matchday !== nextMd) continue
    const { hg, ag } = simScore(next, f.home, f.away, rng, false)
    f.played = true
    f.hg = hg
    f.ag = ag
    groups = groups.map((g) => {
      if (g.id !== f.groupId) return g
      return { ...g, rows: sortWcRows(applyResult(g.rows, f.home, f.away, hg, ag)) }
    })
  }

  const doneAll = fixtures.every((f) => f.played)
  let phase = wc.phase
  let qualified = wc.qualified
  let note = `คัดเลือก WC ${wc.finalsYear} · MD ${nextMd}/${wc.qualMaxMatchday} · เปิดคัดตั้งแต่ฤดูกาล ${wc.qualStartSeason}`

  if (doneAll || nextMd >= wc.qualMaxMatchday) {
    qualified = resolveQualifiers({ ...wc, qualGroups: groups, qualFixtures: fixtures })
    phase = 'qualified'
    note = `จบคัดเลือก · ผ่าน ${qualified.length} ชาติเข้าฟุตบอลโลก ${wc.finalsYear}`
  }

  next = {
    ...next,
    worldCup: {
      ...wc,
      qualMatchday: nextMd,
      qualGroups: groups,
      qualFixtures: fixtures,
      phase,
      qualified,
      note,
    },
  }

  next = {
    ...next,
    inbox: [
      {
        id: `msg-wc-md-${nextMd}-${Date.now()}`,
        date: next.currentDate,
        title: `คัดเลือกบอลโลก · MD ${nextMd}/${wc.qualMaxMatchday}`,
        body:
          note +
          (phase === 'qualified'
            ? `\nโควต้า: UEFA ${WC_SLOTS.UEFA} · CAF ${WC_SLOTS.CAF} · AFC ${WC_SLOTS.AFC} · CONMEBOL ${WC_SLOTS.CONMEBOL} · CONCACAF ${WC_SLOTS.CONCACAF} · OFC ${WC_SLOTS.OFC}`
            : ''),
        read: false,
      },
      ...next.inbox,
    ].slice(0, 45),
  }

  return next
}

/** ฤดูร้อนปีชิงพร้อมรันรอบ 32 หรือยัง */
export function canRunWorldCupFinals(save: GameSave, year: number): boolean {
  const wc = save.worldCup
  if (!wc) return false
  return wc.finalsYear === year && (wc.phase === 'qualified' || wc.phase === 'qualifying')
}

/** รอบสุดท้ายฟุตบอลโลก 32 ทีม — เรียกเฉพาะฤดูร้อนปีชิง หลังคัดเลือก ~2 ปี */
export function runWorldCupFinals(save: GameSave, year: number): {
  save: GameSave
  report: IntlTournamentReport
} | null {
  let next = ensureWorldCup(save)
  let wc = next.worldCup!

  // ไม่ใช่ปีเป้าของแคมเปญคัดเลือกนี้ → ไม่รัน (รอคัดให้ครบก่อน)
  if (wc.finalsYear !== year) {
    return null
  }
  if (wc.phase === 'waiting') {
    return null
  }

  // ถ้าคัดยังไม่จบตอนถึงฤดูร้อนปีชิง — ซิม MD ที่เหลือให้จบ (catch-up)
  if (wc.phase === 'qualifying') {
    let guard = 0
    // ข้ามเช็ค season >= finalsYear ชั่วคราวด้วยการบังคับจบจากตาราง
    while (next.worldCup?.phase === 'qualifying' && guard < 24) {
      const cur = next.worldCup!
      const md = cur.qualMatchday + 1
      if (md > cur.qualMaxMatchday) {
        const qualified = resolveQualifiers(cur)
        next = {
          ...next,
          worldCup: {
            ...cur,
            phase: 'qualified',
            qualified,
            note: `จบคัดเลือก · ${qualified.length} ชาติผ่านเข้าฟุตบอลโลก ${year}`,
          },
        }
        break
      }
      const rng = mulberry32(year * 333 + md * 77)
      let groups = cur.qualGroups.map((g) => ({ ...g, rows: g.rows.map((r) => ({ ...r })) }))
      const fixtures = cur.qualFixtures.map((f) => ({ ...f }))
      for (const f of fixtures) {
        if (f.played || f.matchday !== md) continue
        const { hg, ag } = simScore(next, f.home, f.away, rng, false)
        f.played = true
        f.hg = hg
        f.ag = ag
        groups = groups.map((g) =>
          g.id !== f.groupId
            ? g
            : { ...g, rows: sortWcRows(applyResult(g.rows, f.home, f.away, hg, ag)) },
        )
      }
      const done = fixtures.every((f) => f.played) || md >= cur.qualMaxMatchday
      next = {
        ...next,
        worldCup: {
          ...cur,
          qualMatchday: md,
          qualGroups: groups,
          qualFixtures: fixtures,
          phase: done ? 'qualified' : 'qualifying',
          qualified: done
            ? resolveQualifiers({ ...cur, qualGroups: groups, qualFixtures: fixtures })
            : cur.qualified,
          note: done
            ? `จบคัดเลือก · เข้าฟุตบอลโลก ${year}`
            : `คัดเลือก WC ${year} · MD ${md}/${cur.qualMaxMatchday}`,
        },
      }
      guard++
    }
    wc = next.worldCup!
  }

  let qualified = wc.qualified
  if (qualified.length < 32) {
    qualified = resolveQualifiers(wc)
  }

  const { groups, matches, champion } = runFinalsTournament(next, qualified, year)

  const nationSet = new Set(qualified.map((n) => normalizeNation(n) ?? n))
  let affected = 0
  const callRecords: {
    playerId: string
    playerName: string
    nation: string
    nationTh: string
    coachName: string
    clubId: string
    clubName: string
    score: number
    reasons: string[]
    firstCap: boolean
    styleFit: number
  }[] = []
  const rng = mulberry32(year * 99 + next.season)

  let players = next.players.map((p) => {
    const nat = playerNationality(p, next)
    if (!nationSet.has(nat)) return p
    if (p.overall < 68 && rng() > 0.35) return p
    if (p.clubId === next.humanClubId) affected += 1
    const injure = rng() < 0.06
    callRecords.push({
      playerId: p.id,
      playerName: p.name,
      nation: nat,
      nationTh: labelThOfNation(nat),
      coachName: 'NT',
      clubId: p.clubId,
      clubName: next.clubs.find((c) => c.id === p.clubId)?.shortName ?? '',
      score: p.overall,
      reasons: [`ติดโผฟุตบอลโลก ${year}`],
      firstCap: (p.ntCaps ?? 0) < 1,
      styleFit: 1,
    })
    return {
      ...p,
      leaveDays: Math.max(p.leaveDays ?? 0, 5),
      condition: clamp(p.condition - (10 + rng() * 8), 25, 100),
      sharpness: clamp(p.sharpness + 3, 1, 100),
      morale: clamp(p.morale + 2, 1, 20),
      injuryDays: injure ? Math.max(p.injuryDays, 5 + Math.floor(rng() * 10)) : p.injuryDays,
      injuryType: injure ? (p.injuryType ?? ('muscle' as const)) : p.injuryType,
    }
  })
  players = applyNtCaps(players, callRecords)

  const finalMatch = [...matches].reverse().find((m) => m.stage === 'Final')
  const runnerUp = finalMatch
    ? finalMatch.hg >= finalMatch.ag
      ? finalMatch.away
      : finalMatch.home
    : null
  const semis = matches
    .filter((m) => m.stage === 'SF')
    .flatMap((m) => [m.home, m.away])
    .filter((n) => n !== champion && n !== runnerUp)

  next = applyNationTournamentReputation(
    { ...next, players },
    champion,
    runnerUp,
    semis,
  )
  players = applyTournamentPlayerFame(
    { ...next, players },
    callRecords.map((c) => c.playerId),
    { championNation: champion, multiplier: 2.2 },
  )
  const champPlayerClubs = new Set(
    callRecords.filter((c) => c.nation === champion).map((c) => c.clubId),
  )
  next = {
    ...next,
    players,
    clubs: next.clubs.map((c) =>
      champPlayerClubs.has(c.id) ? bumpClubReputation(c, 2) : c,
    ),
  }

  const report: IntlTournamentReport = {
    eventId: 'world_cup',
    labelTh: 'ฟุตบอลโลก',
    year,
    champion,
    championTh: labelThOfNation(champion),
    matches: matches.filter((m) => ['R16', 'QF', 'SF', 'Final'].includes(m.stage)).slice(-15),
    humanClubPlayersAffected: affected,
    note: `ฟุตบอลโลก ${year} · 32 ทีม · แชมป์ ${labelThOfNation(champion)}`,
  }

  const nextCycleYear = year + 4
  const fresh = createWorldCupState({ ...next, players }, nextCycleYear)
  next = {
    ...next,
    players,
    worldCup: {
      ...fresh,
      finalsGroups: groups,
      finalsMatches: matches,
      champion,
      championTh: labelThOfNation(champion),
      note: `แชมป์ฟุตบอลโลก ${year}: ${labelThOfNation(champion)} · กำลังคัดเลือก ${nextCycleYear}`,
    },
  }

  next = pushNews(next, {
    id: `news-wc-${year}`,
    date: next.currentDate,
    channel: 'news',
    headline: `ฟุตบอลโลก ${year}: แชมป์ ${labelThOfNation(champion)}`,
    body: report.note + (affected ? ` · นักเตะคลับคุณไป ${affected} คน` : ''),
    tone: 'neutral',
    tags: ['international', 'world_cup'],
    subjectName: labelThOfNation(champion),
    outlet: pickOutlet(next, 3).name,
  })

  return { save: next, report }
}

/** อันดับชั่วคราวต่อโซน (ใครจะผ่านถ้าจบวันนี้) */
export function worldCupQualStandingPreview(wc: WorldCupState): {
  confederation: Confederation
  label: string
  slots: number
  provisional: { nation: string; nationTh: string; points: number; gd: number }[]
}[] {
  return (Object.keys(WC_SLOTS) as Confederation[]).map((confed) => {
    const need = WC_SLOTS[confed]
    type Cand = { nation: string; nationTh: string; points: number; gd: number; groupRank: number }
    const cands: Cand[] = []
    for (const g of wc.qualGroups.filter((x) => x.confederation === confed)) {
      sortWcRows(g.rows).forEach((r, idx) => {
        cands.push({
          nation: r.nation,
          nationTh: r.nationTh,
          points: r.points,
          gd: r.gf - r.ga,
          groupRank: idx + 1,
        })
      })
    }
    cands.sort((a, b) => {
      if (a.groupRank !== b.groupRank) return a.groupRank - b.groupRank
      if (b.points !== a.points) return b.points - a.points
      return b.gd - a.gd
    })
    return {
      confederation: confed,
      label: CONFED_LABEL[confed],
      slots: need,
      provisional: cands.slice(0, need).map((c) => ({
        nation: c.nation,
        nationTh: c.nationTh,
        points: c.points,
        gd: c.gd,
      })),
    }
  })
}
