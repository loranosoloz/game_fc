import type { Club, GameSave, Player } from './types'
import { ensureAssociations, type AssociationState } from './associations'
import { ensureClubSocial, ensurePlayerSocial } from './social'
import { playerNationality } from './nationalTeams'

export type TitleRepKind =
  | 'league'
  | 'cup'
  | 'league_cup'
  | 'trophy'
  | 'ucl'
  | 'uel'
  | 'uecl'
  | 'acl'
  | 'acl_two'
  | 'asean_cup'
  | 'cwc'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function mulberry32(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
}

/** ชื่อเสียงสโมสรที่ได้จากแชมป์/รองชนะเลิศ */
export const TITLE_CLUB_REP: Record<
  TitleRepKind,
  { champion: number; runnerUp: number }
> = {
  league: { champion: 3, runnerUp: 1 },
  cup: { champion: 2, runnerUp: 1 },
  league_cup: { champion: 1, runnerUp: 0 },
  trophy: { champion: 1, runnerUp: 0 },
  ucl: { champion: 5, runnerUp: 2 },
  uel: { champion: 3, runnerUp: 1 },
  uecl: { champion: 2, runnerUp: 1 },
  acl: { champion: 4, runnerUp: 2 },
  acl_two: { champion: 2, runnerUp: 1 },
  asean_cup: { champion: 2, runnerUp: 1 },
  cwc: { champion: 5, runnerUp: 2 },
}

export function bumpClubReputation(club: Club, delta: number): Club {
  if (!delta) return club
  const next = ensureClubSocial(club)
  const rep = clamp(next.reputation + delta, 1, 99)
  const brandBump = delta > 0 ? delta * 0.6 : delta * 0.4
  const followerMult = 1 + delta * 0.012
  return {
    ...next,
    reputation: rep,
    social: {
      ...next.social,
      brand: clamp(next.social.brand + brandBump, 15, 99),
      followers: Math.max(
        5_000,
        Math.round(next.social.followers * followerMult + (delta > 0 ? delta * 8_000 : 0)),
      ),
      lastPostNote:
        delta > 0
          ? `ชื่อเสียงพุ่งหลังคว้าถ้วย · เรตติ้ง ${rep}`
          : next.social.lastPostNote,
    },
  }
}

export function applyTitleClubReputation(
  clubs: Club[],
  kind: TitleRepKind,
  championClubId: string,
  runnerUpClubId?: string | null,
): Club[] {
  const table = TITLE_CLUB_REP[kind]
  if (!table) return clubs
  return clubs.map((c) => {
    if (c.id === championClubId) return bumpClubReputation(c, table.champion)
    if (runnerUpClubId && c.id === runnerUpClubId) return bumpClubReputation(c, table.runnerUp)
    return c
  })
}

function bumpAssocRank(a: AssociationState, improveBy: number): AssociationState {
  // improveBy > 0 = อันดับดีขึ้น (เลขน้อยลง)
  const fifaRank = clamp(a.fifaRank - improveBy, 1, 210)
  return {
    ...a,
    fifaRank,
    form: clamp(a.form + Math.max(1, Math.round(improveBy / 2)), 1, 20),
  }
}

/** แชมป์/เข้ารอบทัวร์นาเมนต์ชาติ → อันดับ FIFA + ฟอร์มสมาคม */
export function applyNationTournamentReputation(
  save: GameSave,
  championNation: string,
  runnerUpNation?: string | null,
  semiNations: string[] = [],
): GameSave {
  const next = ensureAssociations(save)
  const assocs = { ...next.associations }
  const champ = championNation
  if (assocs[champ]) assocs[champ] = bumpAssocRank(assocs[champ]!, 5)
  if (runnerUpNation && assocs[runnerUpNation]) {
    assocs[runnerUpNation] = bumpAssocRank(assocs[runnerUpNation]!, 2)
  }
  for (const n of semiNations) {
    if (n === champ || n === runnerUpNation) continue
    if (assocs[n]) assocs[n] = bumpAssocRank(assocs[n]!, 1)
  }
  return { ...next, associations: assocs }
}

/**
 * จบ FIFA window — ผลงานนักเตะชาติ → followers/heat + ชื่อเสียงคลับเล็กน้อย
 * + ขยับฟอร์ม/อันดับสมาคมตามคุณภาพโผ
 */
export function applyIntlBreakRecognition(save: GameSave): GameSave {
  const br = save.internationalBreak
  if (!br?.calledUpIds?.length) return save

  const rng = mulberry32(save.season * 91 + save.matchday * 17 + br.totalWeeks * 3)
  const called = new Set(br.calledUpIds)
  const callById = new Map((br.callUps ?? []).map((c) => [c.playerId, c]))

  const nationScores = new Map<string, { sum: number; n: number }>()
  const clubStar = new Map<string, number>() // clubId → star performances

  let players = save.players.map((p) => {
    if (!called.has(p.id)) return p
    const club = save.clubs.find((c) => c.id === p.clubId)
    const pl = ensurePlayerSocial(p, club?.social?.followers)
    const call = callById.get(p.id)
    const nat = call?.nation ?? playerNationality(pl, save)

    // คะแนนผลงานชาติ 0–100 (ovr/form + สุ่ม)
    const base = pl.overall * 0.55 + pl.form * 3.2 + pl.sharpness * 0.12
    const roll = rng()
    const performance = clamp(base + (roll - 0.35) * 28, 35, 98)
    const star = performance >= 78 || (pl.overall >= 80 && performance >= 70)
    const solid = performance >= 62

    const followerGain = star
      ? Math.round(12_000 + pl.overall * 220 + performance * 90)
      : solid
        ? Math.round(3_500 + pl.overall * 80 + performance * 35)
        : Math.round(800 + pl.overall * 25)
    const heatGain = star ? 10 + Math.floor(performance / 12) : solid ? 4 : 1

    const prev = nationScores.get(nat) ?? { sum: 0, n: 0 }
    nationScores.set(nat, { sum: prev.sum + performance, n: prev.n + 1 })
    if (star) clubStar.set(pl.clubId, (clubStar.get(pl.clubId) ?? 0) + 1)

    return {
      ...pl,
      morale: clamp(pl.morale + (star ? 2 : solid ? 1 : 0), 1, 20),
      form: clamp(pl.form + (star ? 1 : 0), 1, 20),
      social: {
        ...pl.social,
        followers: Math.max(800, pl.social.followers + followerGain),
        heat: clamp(pl.social.heat + heatGain, 0, 100),
        verified: pl.social.verified || star || pl.overall >= 78,
      },
    }
  })

  let clubs = save.clubs.map((c) => {
    const stars = clubStar.get(c.id) ?? 0
    if (!stars) return c
    let next = ensureClubSocial(c)
    next = {
      ...next,
      social: {
        ...next.social,
        followers: Math.round(next.social.followers * (1 + 0.008 * stars) + stars * 4_500),
        brand: clamp(next.social.brand + stars * 0.5, 15, 99),
        engagement: clamp(next.social.engagement + stars, 15, 98),
        lastPostNote: `ลูกทีมโชว์ฟอร์มทีมชาติ · +${stars} คนเด่น`,
      },
    }
    // ดาวชาติหลายคน → ชื่อเสียงคลับ +1 (สูงสุด +2 ต่อ window)
    if (stars >= 1) next = bumpClubReputation(next, Math.min(2, stars >= 3 ? 2 : 1))
    return next
  })

  let nextSave = ensureAssociations({ ...save, players, clubs })
  const assocs = { ...nextSave.associations }
  for (const [nation, { sum, n }] of nationScores) {
    if (!assocs[nation] || n <= 0) continue
    const avg = sum / n
    const a = assocs[nation]!
    let formDelta = 0
    let rankImprove = 0
    if (avg >= 78) {
      formDelta = 2
      rankImprove = 2
    } else if (avg >= 68) {
      formDelta = 1
      rankImprove = 1
    } else if (avg < 52) {
      formDelta = -1
      rankImprove = -1
    }
    assocs[nation] = {
      ...a,
      form: clamp(a.form + formDelta, 1, 20),
      fifaRank: clamp(a.fifaRank - rankImprove, 1, 210),
    }
  }

  const humanCalled = players.filter((p) => called.has(p.id) && p.clubId === save.humanClubId)
  const starNames = humanCalled
    .slice()
    .sort((a, b) => b.social.followers - a.social.followers)
    .slice(0, 4)
    .map((p) => p.name)

  const inbox =
    starNames.length > 0
      ? [
          {
            id: `msg-nt-fame-${Date.now()}`,
            date: save.currentDate,
            title: 'ชื่อเสียงจากทีมชาติ',
            body: `ลูกทีมโชว์ฟอร์มชาติ · ผู้ติดตามพุ่ง: ${starNames.join(' · ')} · สโมสรได้รับกระแสจากสื่อโลก`,
            read: false,
          },
          ...nextSave.inbox,
        ].slice(0, 45)
      : nextSave.inbox

  return { ...nextSave, associations: assocs, inbox }
}

/** นักเตะที่ไปทัวร์นาเมนต์ชาติใหญ่ — บูสต์ followers ตามระดับทัวร์ */
export function applyTournamentPlayerFame(
  save: GameSave,
  calledPlayerIds: string[],
  opts: { championNation?: string; multiplier?: number } = {},
): Player[] {
  const called = new Set(calledPlayerIds)
  const mult = opts.multiplier ?? 1
  const champ = opts.championNation
  return save.players.map((p) => {
    if (!called.has(p.id)) return p
    const club = save.clubs.find((c) => c.id === p.clubId)
    const pl = ensurePlayerSocial(p, club?.social?.followers)
    const nat = playerNationality(pl, save)
    const champBonus = champ && nat === champ ? 1.6 : 1
    const gain = Math.round((8_000 + pl.overall * 180) * mult * champBonus)
    return {
      ...pl,
      social: {
        ...pl.social,
        followers: Math.max(800, pl.social.followers + gain),
        heat: clamp(pl.social.heat + 6 * mult, 0, 100),
        verified: pl.social.verified || pl.overall >= 76,
      },
    }
  })
}
