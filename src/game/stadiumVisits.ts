/**
 * แขกเข้าสนาม — โค้ช/นักเตะ/คนดังมาดู
 * วางแผนก่อนเตะ → มีผลรูปเกมคนที่ถูกจ้อง · หลังแมตช์เขียนรายงานสเกาต์
 */
import celebrities from '@/data/celebrities.json'
import type {
  Fixture,
  GameSave,
  Player,
  StadiumVisit,
  StadiumVisitPurpose,
  StadiumVisitorKind,
} from './types'
import { bumpKnowledge, ensureScouting, knowledgeOf } from './scouting'
import { staffLevel } from './staff'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function clubHasMatchThisDay(
  save: GameSave,
  clubId: string,
  matchday: number,
): boolean {
  return save.fixtures.some(
    (f) =>
      f.matchday === matchday &&
      (f.homeClubId === clubId || f.awayClubId === clubId),
  )
}

export function playerBusyThisDay(save: GameSave, player: Player, matchday: number): boolean {
  if ((player.injuryDays ?? 0) > 0 || (player.illnessDays ?? 0) > 0) return false
  if ((player.banMatches ?? 0) > 0) return false
  if (!player.clubId) return false
  return clubHasMatchThisDay(save, player.clubId, matchday)
}

export function coachBusyThisDay(
  save: GameSave,
  clubId: string | null | undefined,
  matchday: number,
): boolean {
  if (!clubId) return false
  return clubHasMatchThisDay(save, clubId, matchday)
}

function verdictForPlayer(overall: number): string {
  if (overall >= 84) return 'เก่งจริง — ระดับท็อปของลีก'
  if (overall >= 78) return 'คุณภาพชัด ใช้ในทีมใหญ่ได้'
  if (overall >= 72) return 'ใช้ได้ แต่ยังไม่ใช่ดาวเด่น'
  if (overall >= 66) return 'ธรรมดา — อย่าจ่ายแพงเกิน'
  return 'ยังไม่ถึงเกณฑ์ที่สื่อพูดถึง'
}

function pickPurpose(rng: () => number): StadiumVisitPurpose {
  const r = rng()
  if (r < 0.34) return 'watch_team'
  if (r < 0.67) return 'check_form'
  return 'scout_player'
}

type Candidate = {
  kind: StadiumVisitorKind
  name: string
  visitorPlayerId?: string
  visitorStaffId?: string
  fromClubId?: string | null
}

function collectCandidates(save: GameSave, matchday: number, rng: () => number): Candidate[] {
  const out: Candidate[] = []

  for (const cel of celebrities) {
    out.push({ kind: 'celebrity', name: cel.name, fromClubId: null })
  }

  const freePlayers = save.players.filter((p) => !playerBusyThisDay(save, p, matchday))
  const pool = freePlayers
    .filter((p) => p.clubId !== save.humanClubId)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 40)
  for (const p of pool) {
    if (rng() > 0.55) continue
    out.push({
      kind: 'player',
      name: p.name,
      visitorPlayerId: p.id,
      fromClubId: p.clubId,
    })
  }

  const coaches = (save.staff.pool ?? []).filter(
    (s) => s.role === 'coach' && !coachBusyThisDay(save, s.clubId, matchday),
  )
  for (const c of coaches.slice(0, 30)) {
    if (rng() > 0.5) continue
    out.push({
      kind: 'coach',
      name: c.name,
      visitorStaffId: c.id,
      fromClubId: c.clubId,
    })
  }

  return out
}

function visitSeed(fixture: Fixture, season = 0): number {
  return (
    season * 1200 +
    fixture.matchday * 77 +
    fixture.homeClubId.length * 9 +
    fixture.id.length * 13
  )
}

/**
 * วางแผนแขกก่อนเตะ (นัดเหย้ามนุษย์) — คนที่มีแข่งวันนั้นมาไม่ได้
 */
export function planMatchVisitors(save: GameSave, fixture: Fixture): StadiumVisit[] {
  if (fixture.homeClubId !== save.humanClubId) return []

  const rng = mulberry32(visitSeed(fixture, save.season))
  const candidates = collectCandidates(save, fixture.matchday, rng)
  if (candidates.length === 0) return []

  const count = 1 + (rng() < 0.45 ? 1 : 0) + (rng() < 0.2 ? 1 : 0)
  const picked: Candidate[] = []
  const used = new Set<string>()
  for (let i = 0; i < count && candidates.length; i++) {
    const idx = Math.floor(rng() * candidates.length)
    const c = candidates.splice(idx, 1)[0]
    const key = `${c.kind}:${c.name}`
    if (used.has(key)) continue
    used.add(key)
    picked.push(c)
  }

  const humanSquad = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => b.overall - a.overall)
  const marketWatch = save.players
    .filter((p) => p.clubId !== save.humanClubId && knowledgeOf(ensureScouting(save), p.id) < 40)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 15)

  const visits: StadiumVisit[] = []
  for (const c of picked) {
    const purpose = pickPurpose(rng)
    let target: Player | undefined
    if (purpose === 'scout_player' || purpose === 'check_form') {
      target =
        rng() < 0.55
          ? humanSquad[Math.floor(rng() * Math.min(8, humanSquad.length))]
          : marketWatch[Math.floor(rng() * marketWatch.length)]
    }
    visits.push({
      id: uid('visit'),
      date: fixture.date,
      matchday: fixture.matchday,
      fixtureId: fixture.id,
      kind: c.kind,
      name: c.name,
      visitorPlayerId: c.visitorPlayerId,
      visitorStaffId: c.visitorStaffId,
      fromClubId: c.fromClubId,
      purpose,
      targetPlayerId: target?.id,
      report: '', // เติมหลังแมตช์
    })
  }
  return visits
}

/** ผลต่อจิตวิทยาในแมตช์ — คนถูกจ้อง / ทีมถูกดู */
export interface VisitorPsychEffect {
  playerId?: string
  /** ถ้าไม่มี playerId = ทั้งทีมเหย้า */
  side?: 'home' | 'away'
  moraleMod: number
  focusMod: number
  aggressionMod: number
  noteTh: string
}

export function visitorPsychEffects(
  visits: StadiumVisit[],
  players: Player[],
): VisitorPsychEffect[] {
  const out: VisitorPsychEffect[] = []
  for (const v of visits) {
    const kindLabel =
      v.kind === 'player' ? 'นักเตะ' : v.kind === 'coach' ? 'โค้ช' : 'คนดัง'

    if (v.purpose === 'watch_team') {
      if (v.kind === 'celebrity') {
        out.push({
          side: 'home',
          moraleMod: 1.04,
          focusMod: 1.0,
          aggressionMod: 1.0,
          noteTh: `${kindLabel} ${v.name} ในอัฒจันทร์ · มู้ดเหย้าขึ้นเล็กน้อย`,
        })
      } else if (v.kind === 'coach') {
        out.push({
          side: 'home',
          moraleMod: 1.0,
          focusMod: 1.05,
          aggressionMod: 0.97,
          noteTh: `โค้ช ${v.name} มาดูแผนทั้งทีม · ทุกคนระวังจังหวะมากขึ้น`,
        })
      } else {
        out.push({
          side: 'home',
          moraleMod: 1.03,
          focusMod: 1.02,
          aggressionMod: 1.0,
          noteTh: `นักเตะ ${v.name} แวะดูเกม · บรรยากาศในสนามเปลี่ยน`,
        })
      }
      continue
    }

    if (!v.targetPlayerId) continue
    const target = players.find((p) => p.id === v.targetPlayerId)
    if (!target) continue
    const composure = target.attrs.composure
    const young = target.age <= 22

    if (v.kind === 'coach') {
      // โค้ชมาเช็คตัว — คนนิ่งได้บัฟ · คนกดดันง่ายเสียโฟกัส
      if (composure >= 72) {
        out.push({
          playerId: target.id,
          moraleMod: 1.06,
          focusMod: 1.08,
          aggressionMod: 1.0,
          noteTh: `${target.name} รู้ว่าโค้ช ${v.name} จ้องอยู่ · อยากโชว์ฟอร์ม`,
        })
      } else {
        out.push({
          playerId: target.id,
          moraleMod: 0.96,
          focusMod: 0.9,
          aggressionMod: 1.06,
          noteTh: `${target.name} กดดัน — โค้ช ${v.name} นั่งดูอยู่ตรงๆ`,
        })
      }
    } else if (v.kind === 'player') {
      if (young) {
        out.push({
          playerId: target.id,
          moraleMod: 1.08,
          focusMod: 1.04,
          aggressionMod: 1.02,
          noteTh: `${target.name} ฮึกเหิม — มี ${v.name} มาดู`,
        })
      } else {
        out.push({
          playerId: target.id,
          moraleMod: 1.03,
          focusMod: 1.05,
          aggressionMod: 1.0,
          noteTh: `${v.name} จ้อง ${target.name} · อยากพิสูจน์ตัวเอง`,
        })
      }
    } else {
      // celebrity focus on one player
      out.push({
        playerId: target.id,
        moraleMod: 1.05,
        focusMod: young ? 0.94 : 1.02,
        aggressionMod: 1.0,
        noteTh: `คนดัง ${v.name} โฟกัส ${target.name} — กล้องโซเชียลจ่อ`,
      })
    }
  }
  return out
}

export function visitorKickoffLines(visits: StadiumVisit[]): string[] {
  return visits.map((v) => {
    const kind =
      v.kind === 'player' ? 'นักเตะ' : v.kind === 'coach' ? 'โค้ช' : 'คนดัง'
    if (v.targetPlayerId) {
      return `อัฒจันทร์ · ${kind} ${v.name} มาดู (โฟกัสตัวเป้าหมาย)`
    }
    if (v.purpose === 'watch_team') {
      return `อัฒจันทร์ · ${kind} ${v.name} มาดูภาพรวมทีม`
    }
    return `อัฒจันทร์ · ${kind} ${v.name} แวะสนาม`
  })
}

/** เดโมแมตช์ — สร้างแขกจำลองจากรายชื่อในสกวดที่ไม่ได้ลง */
export function planDemoVisitors(
  fixture: Fixture,
  players: Player[],
  homeXi: string[],
  awayXi: string[],
  seed: number,
): StadiumVisit[] {
  const rng = mulberry32(seed + 404)
  const onPitch = new Set([...homeXi, ...awayXi])
  const free = players
    .filter((p) => !onPitch.has(p.id) && (p.injuryDays ?? 0) <= 0)
    .sort((a, b) => b.overall - a.overall)
  const homeStars = players
    .filter((p) => p.clubId === fixture.homeClubId && onPitch.has(p.id))
    .sort((a, b) => b.overall - a.overall)

  const visits: StadiumVisit[] = []
  const n = 1 + (rng() < 0.5 ? 1 : 0)
  for (let i = 0; i < n && free.length; i++) {
    const guest = free[Math.floor(rng() * Math.min(12, free.length))]!
    const purpose = pickPurpose(rng)
    const target =
      purpose === 'watch_team'
        ? undefined
        : homeStars[Math.floor(rng() * Math.min(5, homeStars.length))]
    visits.push({
      id: `demo-visit-${i}`,
      date: fixture.date,
      matchday: fixture.matchday,
      fixtureId: fixture.id,
      kind: guest.overall >= 80 ? 'player' : rng() < 0.35 ? 'coach' : 'player',
      name: guest.name,
      visitorPlayerId: guest.id,
      fromClubId: guest.clubId,
      purpose: target ? purpose : 'watch_team',
      targetPlayerId: target?.id,
      report: '',
    })
  }
  // คนดังจำลอง 1 คนเป็นครั้งคราว
  if (rng() < 0.4 && celebrities.length) {
    const cel = celebrities[Math.floor(rng() * celebrities.length)]!
    visits.push({
      id: `demo-visit-cel`,
      date: fixture.date,
      matchday: fixture.matchday,
      fixtureId: fixture.id,
      kind: 'celebrity',
      name: cel.name,
      purpose: 'watch_team',
      report: '',
    })
  }
  return visits
}

/**
 * หลังแมตช์ — บันทึกแขก + รายงานสเกาต์ (ใช้รายชื่อที่วางไว้ก่อนเตะถ้ามี)
 */
export function generateStadiumVisits(
  save: GameSave,
  fixtureId: string,
  planned?: StadiumVisit[] | null,
): GameSave {
  const fx = save.fixtures.find((f) => f.id === fixtureId)
  if (!fx) return save
  if (fx.homeClubId !== save.humanClubId) return save

  const visitsBase = planned?.length ? planned : planMatchVisitors(save, fx)
  if (visitsBase.length === 0) return save

  const rng = mulberry32(visitSeed(fx, save.season) + 99)
  let scouting = ensureScouting(save)
  const scoutLevel = staffLevel(save.staff, 'scout')
  const inboxBits: string[] = []
  const visits: StadiumVisit[] = []

  for (const raw of visitsBase) {
    const target = raw.targetPlayerId
      ? save.players.find((p) => p.id === raw.targetPlayerId)
      : undefined
    let report = ''
    if (raw.purpose === 'watch_team') {
      report = `${raw.name} มาดูภาพรวมทีม — ชื่นชมบรรยากาศอัฒจันทร์และความหนาแน่นของสควอด`
      if (raw.kind === 'celebrity') report += ' · คลิปโซเชียลอาจดันมู้ดแฟนเล็กน้อย'
    } else if (raw.purpose === 'check_form' && target) {
      const formHint = 4 + Math.round(((target.overall - 60) / 40) * 5 + (rng() - 0.5) * 2)
      const form = Math.max(1, Math.min(10, formHint))
      report = `${raw.name} มาเช็คฟอร์ม ${target.name} ในนัดนี้ ≈ ${form}/10 — ${verdictForPlayer(target.overall).split('—')[0]!.trim()}`
      scouting = {
        ...scouting,
        formSightings: [
          {
            id: uid('form'),
            playerId: target.id,
            fixtureId: fx.id,
            date: fx.date,
            matchday: fx.matchday,
            form,
            note: `แขกสนาม: ${report}`,
            source: 'guest_tip' as const,
          },
          ...scouting.formSightings,
        ].slice(0, 80),
      }
      if (target.clubId !== save.humanClubId) {
        scouting = bumpKnowledge(scouting, target.id, 3 + Math.floor(scoutLevel * 0.2), 55)
      }
    } else if (raw.purpose === 'scout_player' && target) {
      const verdict = verdictForPlayer(target.overall)
      report = `${raw.name} ส่อง ${target.name}: ${verdict}`
      if (target.clubId !== save.humanClubId) {
        const gain = 8 + Math.floor(scoutLevel * 0.4)
        scouting = bumpKnowledge(scouting, target.id, gain, 65)
        report += ` · ความรู้สเกาต์ +${gain}% (ยังไม่ใช่ภาพรวมทั้งฤดูกาล)`
      } else {
        report += ' · แขกประเมินลูกทีมคุณต่อสาธารณะ'
      }
    } else {
      report = `${raw.name} แวะสนาม — สังเกตแท็กติกและชุดแข่ง`
    }

    const kindLabel =
      raw.kind === 'player' ? 'นักเตะ' : raw.kind === 'coach' ? 'โค้ช' : 'คนดัง'
    visits.push({ ...raw, report })
    inboxBits.push(`[${kindLabel}] ${raw.name}: ${report}`)
  }

  scouting = {
    ...scouting,
    visits: [...visits, ...scouting.visits].slice(0, 40),
  }

  let fans = save.fans
  if (visits.some((p) => p.kind === 'celebrity')) {
    fans = {
      ...fans,
      mood: Math.min(100, fans.mood + 1),
      lastVerdict: 'มีคนดังมาที่สนาม — แฟนชอบกระแส',
    }
  }

  return {
    ...save,
    fans,
    scouting,
    inbox: [
      {
        id: `msg-visit-${Date.now()}`,
        date: fx.date,
        title: `แขกเข้าสนาม · ${visits.length} คน`,
        body: inboxBits.join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}
