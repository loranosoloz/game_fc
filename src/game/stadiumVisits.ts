import celebrities from '@/data/celebrities.json'
import type { GameSave, Player, StadiumVisit, StadiumVisitPurpose, StadiumVisitorKind } from './types'
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

/** สโมสรมีนัดในแมตช์เดย์นี้หรือไม่ */
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

/**
 * นักเตะ “มีแข่ง” = สโมสรมีนัด และตัวเองพร้อมลง (ไม่เจ็บ/ไม่แบน)
 * เจ็บหรือแบน → ว่างมาเข้าสนามได้
 */
export function playerBusyThisDay(save: GameSave, player: Player, matchday: number): boolean {
  if ((player.injuryDays ?? 0) > 0) return false
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
  // prefer non-human, decent overall, or injured stars
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

/**
 * สร้างแขกเข้าสนามบ้านหลังแมตช์ (เฉพาะเมื่อคุณเปิดบ้าน)
 * คนที่มีแข่งวันนั้นมาไม่ได้
 */
export function generateStadiumVisits(
  save: GameSave,
  fixtureId: string,
): GameSave {
  const fx = save.fixtures.find((f) => f.id === fixtureId)
  if (!fx) return save
  if (fx.homeClubId !== save.humanClubId) return save

  const rng = mulberry32(save.season * 1200 + fx.matchday * 77 + fx.homeClubId.length * 9)
  const candidates = collectCandidates(save, fx.matchday, rng)
  if (candidates.length === 0) return save

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

  let scouting = ensureScouting(save)
  const visits: StadiumVisit[] = []
  const inboxBits: string[] = []
  const scoutLevel = staffLevel(save.staff, 'scout')

  for (const c of picked) {
    const purpose = pickPurpose(rng)
    let target: Player | undefined
    if (purpose === 'scout_player' || purpose === 'check_form') {
      // แขกส่องทีมเรา หรือชี้เป้าตลาดให้เราได้ยิน
      target =
        rng() < 0.55
          ? humanSquad[Math.floor(rng() * Math.min(6, humanSquad.length))]
          : marketWatch[Math.floor(rng() * marketWatch.length)]
    }

    let report = ''
    if (purpose === 'watch_team') {
      report = `${c.name} มาดูภาพรวมทีม — ชื่นชมบรรยากาศอัฒจันทร์และความหนาแน่นของสควอด`
      if (c.kind === 'celebrity') {
        report += ' · คลิปโซเชียลอาจดันมู้ดแฟนเล็กน้อย'
      }
    } else if (purpose === 'check_form' && target) {
      const formHint = 4 + Math.round(((target.overall - 60) / 40) * 5 + (rng() - 0.5) * 2)
      const form = Math.max(1, Math.min(10, formHint))
      report = `${c.name} มาเช็คฟอร์ม ${target.name} ในนัดนี้ ≈ ${form}/10 — ${verdictForPlayer(target.overall).split('—')[0].trim()}`
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
    } else if (purpose === 'scout_player' && target) {
      const verdict = verdictForPlayer(target.overall)
      report = `${c.name} ส่อง ${target.name}: ${verdict}`
      if (target.clubId !== save.humanClubId) {
        const gain = 8 + Math.floor(scoutLevel * 0.4)
        scouting = bumpKnowledge(scouting, target.id, gain, 65)
        report += ` · ความรู้สเกาต์ +${gain}% (ยังไม่ใช่ภาพรวมทั้งฤดูกาล)`
      } else {
        report += ' · แขกประเมินลูกทีมคุณต่อสาธารณะ'
      }
    } else {
      report = `${c.name} แวะสนาม — สังเกตแท็กติกและชุดแข่ง`
    }

    const kindLabel =
      c.kind === 'player' ? 'นักเตะ' : c.kind === 'coach' ? 'โค้ช' : 'คนดัง'
    visits.push({
      id: uid('visit'),
      date: fx.date,
      matchday: fx.matchday,
      fixtureId: fx.id,
      kind: c.kind,
      name: c.name,
      visitorPlayerId: c.visitorPlayerId,
      visitorStaffId: c.visitorStaffId,
      fromClubId: c.fromClubId,
      purpose,
      targetPlayerId: target?.id,
      report,
    })
    inboxBits.push(`[${kindLabel}] ${c.name}: ${report}`)
  }

  if (visits.length === 0) return save

  scouting = {
    ...scouting,
    visits: [...visits, ...scouting.visits].slice(0, 40),
  }

  // celebrity watch_team → tiny fan bump
  let fans = save.fans
  if (picked.some((p) => p.kind === 'celebrity')) {
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
