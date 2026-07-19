import poolDb from '@/data/pressPool.json'
import type { GameSave, PressAnswerOption, PressQuestion } from './types'
import { pickOutlet } from './mediaOutlets'
import { transferWindowKind } from './transferWindow'
import { ffpStatus } from './financeFfp'

export type PressWhen =
  | 'always'
  | 'win'
  | 'lose'
  | 'draw'
  | 'big_win'
  | 'heavy_loss'
  | 'injury'
  | 'transfer_window'
  | 'board_pressure'
  | 'fans_low'
  | 'talks_pending'
  | 'early_season'
  | 'late_season'
  | 'top_half'
  | 'bottom_half'
  | 'ffp'
  | 'youth'
  | 'cup_week'

interface PressTemplate {
  id: string
  category: string
  when: PressWhen[]
  weight: number
  slot?: string
  prompt: string
  answers: PressAnswerOption[]
}

export interface PressContext {
  usGoals: number
  themGoals: number
  oppName: string
  score: string
  won: boolean
  lost: boolean
  drawn: boolean
  margin: number
  tags: Set<PressWhen>
  vars: Record<string, string>
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function fill(text: string, vars: Record<string, string>): string {
  return text.replace(/\{(\w+)\}/g, (_, key: string) => vars[key] ?? `{${key}}`)
}

function leagueRank(save: GameSave): number {
  const table = [...save.table].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.gf - b.ga - (a.gf - a.ga)
  })
  const i = table.findIndex((r) => r.clubId === save.humanClubId)
  return i >= 0 ? i + 1 : 10
}

export function buildPressContext(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): PressContext {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const won = usGoals > themGoals
  const lost = usGoals < themGoals
  const drawn = usGoals === themGoals
  const margin = Math.abs(usGoals - themGoals)
  const injuryCount = squad.filter((p) => p.injuryDays > 0).length
  const injured =
    squad.filter((p) => p.injuryDays > 0).sort((a, b) => b.injuryDays - a.injuryDays)[0]
      ?.name ?? 'นักเตะเจ็บ'
  const star =
    [...squad].sort((a, b) => b.overall - a.overall || b.form - a.form)[0]?.name ?? 'ดาวทีม'
  const young =
    squad.filter((p) => p.isYouth || p.age <= 21).sort((a, b) => b.form - a.form)[0]?.name ??
    'ดาวรุ่ง'
  const talksPending = (save.talks?.requests ?? []).filter(
    (r) => r.status === 'pending' && r.clubId === save.humanClubId,
  ).length
  const rank = leagueRank(save)
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      f.matchday > save.matchday &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const nextOppId = nextFx
    ? nextFx.homeClubId === save.humanClubId
      ? nextFx.awayClubId
      : nextFx.homeClubId
    : null
  const nextOpp = nextOppId
    ? (save.clubs.find((c) => c.id === nextOppId)?.name ?? 'คู่แข่งนัดหน้า')
    : 'คู่แข่งนัดหน้า'

  const hasCupSoon = save.fixtures.some(
    (f) =>
      !f.played &&
      f.matchday <= save.matchday + 2 &&
      (f.competition === 'cup' ||
        f.competition === 'league_cup' ||
        f.competition === 'ucl' ||
        f.competition === 'uel' ||
        f.competition === 'uecl' ||
        f.competition === 'acl' ||
        f.competition === 'acl_two' ||
        f.competition === 'asean_cup' ||
        f.competition === 'cwc' ||
        f.competition === 'super_cup') &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )

  const windowOpen = transferWindowKind(save) !== 'closed'
  const ffp = ffpStatus(save)
  const tags = new Set<PressWhen>(['always'])
  if (won) tags.add('win')
  if (lost) tags.add('lose')
  if (drawn) tags.add('draw')
  if (won && margin >= 3) tags.add('big_win')
  if (lost && margin >= 3) tags.add('heavy_loss')
  if (injuryCount > 0) tags.add('injury')
  if (windowOpen) tags.add('transfer_window')
  if ((save.board?.confidence ?? 60) < 45 || save.board?.ultimatum) tags.add('board_pressure')
  if ((save.fans?.mood ?? 50) < 40) tags.add('fans_low')
  if (talksPending > 0) tags.add('talks_pending')
  if (save.matchday <= 8) tags.add('early_season')
  if (save.matchday >= 28) tags.add('late_season')
  if (rank <= 10) tags.add('top_half')
  if (rank >= 14) tags.add('bottom_half')
  if (!ffp.ok || ffp.nearBreach) tags.add('ffp')
  if (squad.some((p) => p.isYouth || p.age <= 21)) tags.add('youth')
  if (hasCupSoon) tags.add('cup_week')

  const outlet = pickOutlet(save, usGoals * 3 + themGoals + save.matchday).name

  return {
    usGoals,
    themGoals,
    oppName,
    score: `${usGoals}–${themGoals}`,
    won,
    lost,
    drawn,
    margin,
    tags,
    vars: {
      outlet,
      opp: oppName,
      score: `${usGoals}–${themGoals}`,
      usGoals: String(usGoals),
      themGoals: String(themGoals),
      manager: save.managerName,
      club: club.shortName,
      clubFull: club.name,
      star,
      injured,
      young,
      injuryCount: String(injuryCount),
      talksPending: String(talksPending),
      rank: String(rank),
      nextOpp,
    },
  }
}

function templateMatches(t: PressTemplate, tags: Set<PressWhen>): boolean {
  return t.when.some((w) => tags.has(w))
}

function materialize(t: PressTemplate, ctx: PressContext, outletSalt: number, save: GameSave): PressQuestion {
  const outlet = pickOutlet(save, outletSalt).name
  const vars = { ...ctx.vars, outlet }
  return {
    id: t.id,
    prompt: fill(t.prompt, vars),
    answers: t.answers.map((a) => ({
      ...a,
      label: fill(a.label, vars),
      socialHeadline: a.socialHeadline ? fill(a.socialHeadline, vars) : undefined,
    })),
  }
}

/** สร้างคำถามแถลงข่าวจากพูลตามบริบท */
export function pickPressQuestions(save: GameSave, ctx: PressContext): PressQuestion[] {
  const templates = (poolDb.templates as PressTemplate[]) ?? []
  const per = (poolDb.questionsPerConference as number) ?? 6
  const rng = mulberry32(
    save.season * 10007 +
      save.matchday * 97 +
      ctx.usGoals * 13 +
      ctx.themGoals * 29 +
      ctx.oppName.length * 7,
  )

  const eligible = templates.filter((t) => templateMatches(t, ctx.tags))
  const bySlot = new Map<string, PressTemplate[]>()
  const general: PressTemplate[] = []
  for (const t of eligible) {
    if (t.slot === 'result') {
      const list = bySlot.get('result') ?? []
      list.push(t)
      bySlot.set('result', list)
    } else {
      general.push(t)
    }
  }

  const picked: PressQuestion[] = []
  const usedCategories = new Set<string>()
  const usedIds = new Set<string>()

  // 1) บังคับมีคำถามผลเกม
  const resultPool = bySlot.get('result') ?? []
  if (resultPool.length) {
    const totalW = resultPool.reduce((s, t) => s + (t.weight || 1), 0)
    let roll = rng() * totalW
    let chosen = resultPool[0]!
    for (const t of resultPool) {
      roll -= t.weight || 1
      if (roll <= 0) {
        chosen = t
        break
      }
    }
    picked.push(materialize(chosen, ctx, 0, save))
    usedIds.add(chosen.id)
    usedCategories.add(chosen.category)
  }

  // 2) เติมจากพูลทั่วไป — ถ่วงน้ำหนัก + หลีกหมวดซ้ำ
  const bag = [...general]
  while (picked.length < per && bag.length) {
    const available = bag.filter((t) => !usedIds.has(t.id))
    if (!available.length) break
    // prefer unused categories
    const prefer = available.filter((t) => !usedCategories.has(t.category))
    const pool = prefer.length ? prefer : available
    const totalW = pool.reduce((s, t) => s + (t.weight || 1), 0)
    let roll = rng() * totalW
    let chosen = pool[0]!
    for (const t of pool) {
      roll -= t.weight || 1
      if (roll <= 0) {
        chosen = t
        break
      }
    }
    picked.push(materialize(chosen, ctx, picked.length * 3 + 1, save))
    usedIds.add(chosen.id)
    usedCategories.add(chosen.category)
    const idx = bag.findIndex((t) => t.id === chosen.id)
    if (idx >= 0) bag.splice(idx, 1)
  }

  return picked
}

export function pressPoolStats() {
  const templates = (poolDb.templates as PressTemplate[]) ?? []
  const cats = new Map<string, number>()
  for (const t of templates) cats.set(t.category, (cats.get(t.category) ?? 0) + 1)
  return { total: templates.length, perConference: poolDb.questionsPerConference, byCategory: Object.fromEntries(cats) }
}
