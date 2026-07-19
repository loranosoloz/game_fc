import ntDb from '@/data/nationalTeams.json'
import { bioForPlayerName } from '@/data/world/playerBios'
import type { GameSave, Player, PlayerAttributes } from './types'
import { getWorldCoach } from './worldCoaches'

export type NtCoachStyle = 'possession' | 'balanced' | 'counter' | 'press' | 'direct'
export type NtAgeBias = 'young' | 'peak' | 'veteran' | 'any'
export type NtAversion =
  | 'lowWorkRate'
  | 'inconsistent'
  | 'dirty'
  | 'fragile'
  | 'lowForm'
  | 'lowTechnique'
  | 'styleMismatch'

export interface NtTeamDef {
  coach: string
  minOvr: number
  maxCall: number
  labelTh: string
  style: NtCoachStyle
  styleLabelTh: string
  ageBias: NtAgeBias
  loyalty: number
  favor: string[]
  aversion: NtAversion[]
}

export interface NtCallUp {
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
}

export interface NtSnub {
  playerId: string
  playerName: string
  nation: string
  nationTh: string
  coachName: string
  clubId: string
  clubName: string
  score: number
  cutoffScore: number
  reasons: string[]
  rivalName: string | null
}

export interface NtCallUpResult {
  callUps: NtCallUp[]
  snubs: NtSnub[]
}

const TEAMS = ntDb.teams as Record<string, NtTeamDef>
const ALIASES = ntDb.aliases as Record<string, string>
const DOMESTIC = ntDb.leagueDomestic as Record<string, string>

const STYLE_ATTRS: Record<NtCoachStyle, (keyof PlayerAttributes)[]> = {
  possession: ['passing', 'technique', 'vision', 'composure', 'decision'],
  counter: ['pace', 'stamina', 'finishing', 'workRate', 'dribbling'],
  press: ['workRate', 'stamina', 'tackling', 'positioning', 'pace'],
  direct: ['strength', 'heading', 'jumping', 'finishing', 'workRate'],
  balanced: ['decision', 'composure', 'passing', 'positioning', 'stamina'],
}

function attrOf(p: Player, key: string): number {
  if (key === 'versatility') return p.hidden.versatility
  if (key === 'importantMatches') return p.hidden.importantMatches
  if (key === 'consistency') return p.hidden.consistency
  const a = p.attrs as unknown as Record<string, number>
  return a[key] ?? 50
}

function avg(nums: number[]): number {
  if (nums.length === 0) return 50
  return nums.reduce((s, n) => s + n, 0) / nums.length
}

export function normalizeNation(raw: string | null | undefined): string | null {
  if (!raw) return null
  const s = raw.trim()
  if (!s) return null
  if (TEAMS[s]) return s
  if (ALIASES[s]) return ALIASES[s]
  const lower = s.toLowerCase()
  for (const [k, v] of Object.entries(ALIASES)) {
    if (k.toLowerCase() === lower) return v
  }
  for (const name of Object.keys(TEAMS)) {
    if (name.toLowerCase() === lower) return name
  }
  return s
}

/** สัญชาตินักเตะ — จาก bio / pack / ลีกต้นทาง */
export function playerNationality(player: Player, save: GameSave): string {
  const fromBio = normalizeNation(player.bio?.nationality ?? null)
  if (fromBio && TEAMS[fromBio]) return fromBio
  if (fromBio) return fromBio

  const pack = normalizeNation(bioForPlayerName(player.name)?.nationality ?? null)
  if (pack && TEAMS[pack]) return pack
  if (pack) return pack

  const club = save.clubs.find((c) => c.id === player.clubId)
  const lid = club?.originLeagueId ?? save.leagueId ?? 'eng'
  if (player.overall >= 78) {
    const foreignPools: Record<string, string[]> = {
      eng: ['Brazil', 'Portugal', 'France', 'Netherlands', 'Belgium', 'Argentina'],
      esp: ['Brazil', 'Argentina', 'France', 'Portugal', 'Uruguay'],
      ger: ['France', 'Austria', 'Japan', 'Denmark', 'Switzerland'],
      fra: ['Brazil', 'Senegal', 'Portugal', 'Morocco', 'Spain'],
      ita: ['Argentina', 'France', 'Brazil', 'Croatia', 'Nigeria'],
      tha: ['Brazil', 'Japan', 'South Korea', 'Australia'],
      jpn: ['Brazil', 'South Korea', 'Spain', 'Netherlands'],
      kor: ['Brazil', 'Japan', 'Australia', 'Serbia'],
      bra: ['Argentina', 'Uruguay', 'Colombia', 'Paraguay'],
      tur: ['Brazil', 'Netherlands', 'Senegal', 'Nigeria'],
      ned: ['Brazil', 'Belgium', 'Denmark', 'Morocco'],
      prt: ['Brazil', 'Spain', 'France', 'Argentina'],
      bel: ['France', 'Netherlands', 'Nigeria', 'Morocco'],
      sco: ['England', 'Ireland', 'Nigeria', 'Australia'],
      aut: ['Germany', 'Croatia', 'Switzerland', 'Bosnia'],
      sui: ['France', 'Germany', 'Italy', 'Kosovo'],
      den: ['Sweden', 'Norway', 'Netherlands', 'Nigeria'],
      gre: ['Brazil', 'Argentina', 'Serbia', 'Nigeria'],
      vie: ['Brazil', 'South Korea', 'Japan', 'Thailand'],
      idn: ['Brazil', 'Japan', 'South Korea', 'Australia'],
      mys: ['Brazil', 'Japan', 'South Korea', 'Australia'],
      sgp: ['Japan', 'South Korea', 'Brazil', 'Australia'],
      sau: ['Brazil', 'France', 'Portugal', 'Senegal'],
    }
    const pool = foreignPools[lid] ?? foreignPools.eng
    const idx = (player.id.length * 13 + player.overall * 7) % pool.length
    const pick = normalizeNation(pool[idx]!) ?? pool[idx]!
    if (TEAMS[pick]) return pick
  }
  return DOMESTIC[lid] ?? 'England'
}

export function ntTeam(nation: string): NtTeamDef | null {
  const n = normalizeNation(nation)
  if (!n) return null
  return TEAMS[n] ?? null
}

/** ชื่อโค้ชทีมชาติจากสมาคมในเซฟ (fallback ชื่อใน JSON) */
export function resolveNtCoachName(save: GameSave, nation: string): string {
  const n = normalizeNation(nation) ?? nation
  if (save.career?.nationalNation === n || save.associations?.[n]?.coachId === '__human__') {
    return save.managerName
  }
  const id = save.associations?.[n]?.coachId
  if (id) {
    const c = getWorldCoach(id)
    if (c) return c.name
  }
  return TEAMS[n]?.coach ?? '—'
}

/** แคปทีมชาติในเซฟนี้ (+ seed จาก FMInside ถ้ามี) */
export function playerNtCaps(player: Player): number {
  if (typeof player.ntCaps === 'number') return Math.max(0, player.ntCaps)
  return Math.max(0, player.fmInside?.caps ?? 0)
}

function ageBiasScore(age: number, bias: NtAgeBias): { delta: number; note: string | null } {
  if (bias === 'young') {
    if (age <= 23) return { delta: 8, note: 'โค้ชชอบวัยรุ่นที่โตไปด้วยทีม' }
    if (age >= 30) return { delta: -10, note: 'อายุเกินโปรไฟล์ที่โค้ชต้องการ' }
    return { delta: 0, note: null }
  }
  if (bias === 'peak') {
    if (age >= 24 && age <= 29) return { delta: 6, note: 'อยู่ในช่วงพีคที่โค้ชต้องการ' }
    if (age <= 21) return { delta: -3, note: 'ยังอ่อนสำหรับสไตล์โค้ชชุดนี้' }
    if (age >= 32) return { delta: -6, note: 'อายุเลยพีคที่โค้ชโฟกัส' }
    return { delta: 0, note: null }
  }
  if (bias === 'veteran') {
    if (age >= 28) return { delta: 7, note: 'ประสบการณ์เข้าตาโค้ช' }
    if (age <= 22) return { delta: -8, note: 'โค้ชชุดนี้พึ่งแกนเก่ามากกว่า' }
    return { delta: 0, note: null }
  }
  return { delta: 0, note: null }
}

function styleFitScore(p: Player, style: NtCoachStyle): number {
  const keys = STYLE_ATTRS[style]
  return avg(keys.map((k) => attrOf(p, k)))
}

function aversionHits(
  p: Player,
  team: NtTeamDef,
  styleFit: number,
): { penalty: number; notes: string[] } {
  const notes: string[] = []
  let penalty = 0
  for (const a of team.aversion) {
    if (a === 'lowWorkRate' && p.attrs.workRate < 62) {
      penalty += 12
      notes.push('เวิร์กเรตต่ำ — ไม่เข้าสไตล์เพรส/วิ่ง')
    } else if (a === 'inconsistent' && p.hidden.consistency < 55) {
      penalty += 10
      notes.push('ฟอร์มไม่นิ่ง — โค้ชไม่ชอบความเสี่ยง')
    } else if (a === 'dirty' && p.hidden.dirtiness > 65) {
      penalty += 9
      notes.push('ใบเหลือง/สไตล์สกปรกเกินที่โค้ชรับได้')
    } else if (a === 'fragile' && p.hidden.injuryProneness > 62) {
      penalty += 11
      notes.push('เจ็บบ่อย — โค้ชกลัวเสียตัวกลางแคมป์')
    } else if (a === 'lowForm' && p.form < 10) {
      penalty += 10
      notes.push('ฟอร์มคลับช่วงนี้ไม่เข้าตา')
    } else if (a === 'lowTechnique' && p.attrs.technique < 64) {
      penalty += 10
      notes.push('เทคนิคไม่ถึงเกณฑ์ครองบอลของโค้ช')
    } else if (a === 'styleMismatch' && styleFit < 58) {
      penalty += 14
      notes.push(`ไม่เข้าสไตล์「${team.styleLabelTh}」`)
    }
  }
  return { penalty, notes }
}

export interface NtEval {
  player: Player
  score: number
  styleFit: number
  reasonsPos: string[]
  reasonsNeg: string[]
}

/** คะแนนที่โค้ชชาติให้ — ใช้ตัดสินเรียกตัว + อธิบายเหตุผล */
export function evaluateForNtCoach(player: Player, team: NtTeamDef): NtEval {
  const reasonsPos: string[] = []
  const reasonsNeg: string[] = []
  let score = player.overall * 1.05

  score += (player.form - 10) * 1.8
  if (player.form >= 14) reasonsPos.push('ฟอร์มคลับร้อนแรง')
  else if (player.form <= 8) {
    score -= 6
    reasonsNeg.push('ฟอร์มคลับแผ่ว')
  }

  score += (player.condition - 70) * 0.12
  score += (player.sharpness - 60) * 0.08
  if (player.condition < 55) {
    score -= 8
    reasonsNeg.push('สภาพร่างกายไม่พร้อมแคมป์ชาติ')
  }

  const styleFit = styleFitScore(player, team.style)
  score += (styleFit - 60) * 0.55
  if (styleFit >= 72) reasonsPos.push(`เข้าสไตล์「${team.styleLabelTh}」`)
  else if (styleFit < 55) reasonsNeg.push(`สไตล์ไม่ตรง「${team.styleLabelTh}」`)

  for (const key of team.favor) {
    const v = attrOf(player, key)
    score += (v - 60) * 0.22
    if (v >= 78) {
      const labels: Record<string, string> = {
        workRate: 'เวิร์กเรตสูง',
        stamina: 'ความอึดดี',
        pace: 'ความเร็วเด่น',
        passing: 'ผ่านบอลคม',
        technique: 'เทคนิคเยี่ยม',
        vision: 'วิสัยทัศน์กว้าง',
        finishing: 'จบสกอร์คม',
        positioning: 'ยืนตำแหน่งดี',
        decision: 'ตัดสินใจเฉียบ',
        composure: 'ใจเย็น',
        strength: 'กายภาพแข็ง',
        heading: 'โหม่งเด่น',
        dribbling: 'เลี้ยงทะลุ',
        tackling: 'แท็กเกิลแน่น',
        agility: 'คล่องตัว',
        versatility: 'เล่นได้หลายตำแหน่ง',
        importantMatches: 'เกมใหญ่ขึ้นรูป',
      }
      reasonsPos.push(labels[key] ?? `${key} เด่น`)
    }
  }

  const age = ageBiasScore(player.age, team.ageBias)
  score += age.delta
  if (age.delta > 0 && age.note) reasonsPos.push(age.note)
  if (age.delta < 0 && age.note) reasonsNeg.push(age.note)

  const caps = playerNtCaps(player)
  const loyaltyBonus = Math.min(14, (caps / 20) * (team.loyalty / 50) * 10)
  score += loyaltyBonus
  if (caps === 0 && player.overall >= team.minOvr + 2) {
    reasonsPos.push('โอกาสติดทีมชาติครั้งแรก')
  } else if (caps >= 25 && team.loyalty >= 60) {
    reasonsPos.push('แกนทีมชาติเดิม — โค้ชยังเชื่อใจ')
  } else if (caps === 0 && team.loyalty >= 70) {
    score -= 4
    reasonsNeg.push('โค้ชชุดนี้ค่อยให้โอกาสหน้าใหม่')
  }

  const av = aversionHits(player, team, styleFit)
  score -= av.penalty
  reasonsNeg.push(...av.notes)

  if (player.injuryDays > 0) {
    score -= 18
    reasonsNeg.push('ยังเจ็บอยู่ — ความเสี่ยงสูง')
  }
  if ((player.banMatches ?? 0) > 0) {
    score -= 20
    reasonsNeg.push('ติดโทษแบน')
  }

  const uniq = (xs: string[]) => [...new Set(xs)].slice(0, 4)
  return {
    player,
    score: Math.round(score * 10) / 10,
    styleFit: Math.round(styleFit),
    reasonsPos: uniq(reasonsPos),
    reasonsNeg: uniq(reasonsNeg),
  }
}

/**
 * โค้ชทีมชาติเลือกตัวตามสไตล์ + คุณสมบัติ + ความจงรักภักดี
 * คืนทั้งรายชื่อเรียกตัว และ “หลุดโผ” ที่ใกล้ติด (โฟกัสทีมผู้เล่น)
 */
export function nationalTeamCallUps(save: GameSave, _weeks: number): NtCallUpResult {
  const eligible = save.players.filter(
    (p) =>
      !p.isYouth &&
      p.injuryDays <= 2 &&
      (p.illnessDays ?? 0) <= 0 &&
      (p.banMatches ?? 0) <= 0 &&
      !p.loanParentClubId,
  )

  const byNation = new Map<string, Player[]>()
  for (const p of eligible) {
    const nat = playerNationality(p, save)
    if (!TEAMS[nat]) continue
    const list = byNation.get(nat) ?? []
    list.push(p)
    byNation.set(nat, list)
  }

  const callUps: NtCallUp[] = []
  const snubs: NtSnub[] = []
  const taken = new Set<string>()

  for (const [nation, list] of byNation) {
    const team = TEAMS[nation]!
    const evals = list
      .map((p) => evaluateForNtCoach(p, team))
      .filter((e) => e.player.overall >= team.minOvr - 3)
      .sort((a, b) => b.score - a.score || b.player.overall - a.player.overall)

    const hardPool = evals.filter((e) => e.player.overall >= team.minOvr)
    const pool = hardPool.length > 0 ? hardPool : evals.slice(0, team.maxCall)
    const pickN = Math.min(team.maxCall, pool.length)
    if (pickN < 1) continue

    const selected = pool.slice(0, pickN)
    const cutoff = selected[selected.length - 1]?.score ?? 0

    for (const e of selected) {
      if (taken.has(e.player.id)) continue
      if (selected.indexOf(e) >= 2 && e.player.overall < selected[0]!.player.overall - 10) continue
      taken.add(e.player.id)
      const club = save.clubs.find((c) => c.id === e.player.clubId)
      const caps = playerNtCaps(e.player)
      const reasons =
        e.reasonsPos.length > 0
          ? e.reasonsPos
          : [`OVR ${e.player.overall} · คะแนนโค้ช ${e.score}`]
      callUps.push({
        playerId: e.player.id,
        playerName: e.player.name,
        nation,
        nationTh: team.labelTh,
        coachName: resolveNtCoachName(save, nation),
        clubId: e.player.clubId,
        clubName: club?.shortName ?? club?.name ?? '—',
        score: e.score,
        reasons,
        firstCap: caps <= 0,
        styleFit: e.styleFit,
      })
    }

    for (const e of evals) {
      if (taken.has(e.player.id)) continue
      if (e.player.clubId !== save.humanClubId) continue
      if (e.player.overall < team.minOvr - 2) continue
      if (e.score < cutoff - 12) continue
      const club = save.clubs.find((c) => c.id === e.player.clubId)
      const rival = selected[selected.length - 1]?.player.name ?? null
      const reasons =
        e.reasonsNeg.length > 0
          ? e.reasonsNeg
          : [
              `คะแนนโค้ช ${e.score} ต่ำกว่าเส้นตัด ${cutoff.toFixed(0)}`,
              `สไตล์「${team.styleLabelTh}」ยังไม่เข้าตา`,
            ]
      snubs.push({
        playerId: e.player.id,
        playerName: e.player.name,
        nation,
        nationTh: team.labelTh,
        coachName: resolveNtCoachName(save, nation),
        clubId: e.player.clubId,
        clubName: club?.shortName ?? club?.name ?? '—',
        score: e.score,
        cutoffScore: cutoff,
        reasons: [...new Set(reasons)].slice(0, 4),
        rivalName: rival,
      })
    }
  }

  callUps.sort((a, b) => {
    const ah = a.clubId === save.humanClubId ? 0 : 1
    const bh = b.clubId === save.humanClubId ? 0 : 1
    if (ah !== bh) return ah - bh
    if (a.firstCap !== b.firstCap) return a.firstCap ? -1 : 1
    return b.score - a.score
  })

  snubs.sort((a, b) => b.score - a.score)
  return { callUps, snubs: snubs.slice(0, 8) }
}

export function formatCallUpLines(callUps: NtCallUp[], humanClubId: string): string[] {
  const human = callUps.filter((c) => c.clubId === humanClubId)
  if (human.length === 0) return ['ไม่มีนักเตะในทีมคุณถูกเรียกติดทีมชาติรอบนี้']
  return human.map((c) => {
    const why = c.reasons[0] ? ` — ${c.reasons[0]}` : ''
    const debut = c.firstCap ? ' ★ติดครั้งแรก' : ''
    return `โค้ช ${c.nationTh} (${c.coachName}) เรียก ${c.playerName}${debut}${why}`
  })
}

export function formatSnubLines(snubs: NtSnub[]): string[] {
  return snubs.slice(0, 4).map((s) => {
    const why = s.reasons[0] ?? 'ยังไม่เข้าตาโค้ช'
    return `${s.playerName} หลุดโผ${s.nationTh} — ${why}`
  })
}

/** เพิ่มแคปหลังถูกเรียก */
export function applyNtCaps(players: Player[], callUps: NtCallUp[]): Player[] {
  const ids = new Set(callUps.map((c) => c.playerId))
  return players.map((p) => {
    if (!ids.has(p.id)) return p
    return { ...p, ntCaps: playerNtCaps(p) + 1 }
  })
}
