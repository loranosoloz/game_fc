import type {
  FormWatchAssignment,
  GameSave,
  Player,
  PlayerAttributes,
  PlayerGrowth,
  PlayerHidden,
  ScoutFormSighting,
  ScoutKnowledge,
  StaffState,
} from './types'
import { staffLevel } from './staff'
import attributesDb from '@/data/attributes.json'

const ALUMNI_FLOOR = 50

export function emptyScoutExtras(): Pick<
  ScoutKnowledge,
  | 'alumniIds'
  | 'formSightings'
  | 'visits'
  | 'pendingWatches'
  | 'knownReleaseClauseIds'
  | 'agentRapport'
  | 'playerRapport'
> {
  return {
    alumniIds: [],
    formSightings: [],
    visits: [],
    pendingWatches: [],
    knownReleaseClauseIds: [],
    agentRapport: {},
    playerRapport: {},
  }
}

export function createScouting(players: Player[], humanClubId: string): ScoutKnowledge {
  const byPlayer: Record<string, number> = {}
  const knownReleaseClauseIds: string[] = []
  for (const p of players) {
    byPlayer[p.id] = p.clubId === humanClubId ? 100 : 0
    if (p.clubId === humanClubId) knownReleaseClauseIds.push(p.id)
  }
  return { byPlayer, ...emptyScoutExtras(), knownReleaseClauseIds }
}

export function ensureScouting(save: GameSave): ScoutKnowledge {
  const raw = save.scouting
  if (!raw?.byPlayer) return createScouting(save.players, save.humanClubId)
  const known = raw.knownReleaseClauseIds ?? []
  // ทีมตัวเองต้องรู้ค่าฉีกเสมอ
  const ownIds = save.players.filter((p) => p.clubId === save.humanClubId).map((p) => p.id)
  const knownSet = new Set([...known, ...ownIds])
  return {
    byPlayer: raw.byPlayer,
    alumniIds: raw.alumniIds ?? [],
    formSightings: raw.formSightings ?? [],
    visits: raw.visits ?? [],
    pendingWatches: raw.pendingWatches ?? [],
    knownReleaseClauseIds: [...knownSet],
    agentRapport: raw.agentRapport ?? {},
    playerRapport: raw.playerRapport ?? {},
  }
}

export function knowledgeOf(scouting: ScoutKnowledge, playerId: string): number {
  return scouting.byPlayer[playerId] ?? 0
}

/** เมื่อนักเตะย้ายออกจากทีมคุณ — เหลือความรู้พื้น 50% */
export function markPlayerAsAlumni(scouting: ScoutKnowledge, playerId: string): ScoutKnowledge {
  const alumniIds = scouting.alumniIds.includes(playerId)
    ? scouting.alumniIds
    : [...scouting.alumniIds, playerId]
  return {
    ...scouting,
    alumniIds,
    byPlayer: {
      ...scouting.byPlayer,
      [playerId]: ALUMNI_FLOOR,
    },
  }
}

export function bumpKnowledge(
  scouting: ScoutKnowledge,
  playerId: string,
  gain: number,
  cap = 100,
): ScoutKnowledge {
  const prev = knowledgeOf(scouting, playerId)
  const floor = scouting.alumniIds.includes(playerId) ? ALUMNI_FLOOR : 0
  const next = Math.min(cap, Math.max(floor, prev + gain))
  return {
    ...scouting,
    byPlayer: { ...scouting.byPlayer, [playerId]: next },
  }
}

export function scoutPlayer(
  save: GameSave,
  playerId: string,
): { save: GameSave; message: string } {
  const scouting = ensureScouting(save)
  const level = staffLevel(save.staff, 'scout')
  const gain = 12 + Math.floor(level * 1.2)
  const prev = knowledgeOf(scouting, playerId)
  const updated = bumpKnowledge(scouting, playerId, gain)
  const next = knowledgeOf(updated, playerId)
  return {
    save: { ...save, scouting: updated },
    message: `สเกาต์สำเร็จ ความรู้ ${prev}→${next}%`,
  }
}

/** OVR แบบหมอกตามความรู้ — ฟอร์มนัดต่อนัดไม่แทนที่ตัวนี้ */
export function revealOverall(overall: number, knowledge: number): string {
  if (knowledge >= 75) return String(overall)
  if (knowledge >= 50) {
    const band = Math.round(overall / 5) * 5
    return `~${band}`
  }
  if (knowledge >= 25) {
    if (overall >= 82) return 'สูง'
    if (overall >= 74) return 'กลาง+'
    if (overall >= 68) return 'กลาง'
    return 'ต่ำ'
  }
  return '???'
}

export function maskAttrValue(
  value: number,
  knowledge: number,
  group: string,
): number | null | { band: string } {
  const groupNeed =
    group === 'goalkeeping' ? 50 : group === 'technical' ? 35 : group === 'mental' ? 45 : 40
  if (knowledge < groupNeed - 15) return null
  if (knowledge < groupNeed) {
    if (value >= 75) return { band: 'สูง' }
    if (value >= 50) return { band: 'กลาง' }
    return { band: 'ต่ำ' }
  }
  if (knowledge < 70) {
    const step = knowledge < 55 ? 5 : 3
    const stepped = Math.round(value / step) * step
    return Math.max(1, Math.min(99, stepped))
  }
  return value
}

export function revealPa(pa: number, knowledge: number): string {
  if (knowledge >= 85) return String(pa)
  if (knowledge >= 55) {
    const band = Math.round(pa / 10) * 10
    return `~${band}`
  }
  if (knowledge >= 30) return pa >= 140 ? 'สูง' : pa >= 110 ? 'กลาง' : 'จำกัด'
  return '???'
}

export function revealHidden(
  hidden: PlayerHidden,
  knowledge: number,
): Partial<Record<keyof PlayerHidden, number | string | null>> {
  if (knowledge < 40) {
    return {
      consistency: null,
      importantMatches: null,
      dirtiness: null,
      injuryProneness: knowledge >= 25 ? (hidden.injuryProneness >= 12 ? 'เสี่ยง' : 'ปกติ') : null,
      versatility: null,
    }
  }
  if (knowledge < 75) {
    return {
      consistency: Math.round(hidden.consistency / 2) * 2,
      importantMatches: Math.round(hidden.importantMatches / 2) * 2,
      dirtiness: null,
      injuryProneness: hidden.injuryProneness,
      versatility: Math.round(hidden.versatility / 2) * 2,
    }
  }
  return { ...hidden }
}

export function revealGrowth(
  growth: PlayerGrowth,
  knowledge: number,
): Partial<Record<keyof PlayerGrowth, number | null>> {
  if (knowledge < 50) {
    return {
      determination: null,
      ambition: knowledge >= 35 ? growth.ambition : null,
      professionalism: null,
      adaptability: null,
      learningRate: knowledge >= 40 ? Math.round(growth.learningRate / 2) * 2 : null,
    }
  }
  if (knowledge < 80) {
    return {
      determination: Math.round(growth.determination / 2) * 2,
      ambition: growth.ambition,
      professionalism: Math.round(growth.professionalism / 2) * 2,
      adaptability: Math.round(growth.adaptability / 2) * 2,
      learningRate: growth.learningRate,
    }
  }
  return { ...growth }
}

export type MaskedAttrView = {
  key: keyof PlayerAttributes
  group: string
  display: string
  known: boolean
}

export function visibleAttrsDetailed(
  attrs: PlayerAttributes,
  knowledge: number,
): MaskedAttrView[] {
  return attributesDb.attributes.map((def) => {
    const key = def.key as keyof PlayerAttributes
    const masked = maskAttrValue(attrs[key], knowledge, def.group)
    if (masked === null) {
      return { key, group: def.group, display: '???', known: false }
    }
    if (typeof masked === 'object' && 'band' in masked) {
      return { key, group: def.group, display: masked.band, known: false }
    }
    return { key, group: def.group, display: String(masked), known: true }
  })
}

/** @deprecated use visibleAttrsDetailed */
export function visibleAttrs(
  attrs: PlayerAttributes,
  knowledge: number,
): Partial<Record<keyof PlayerAttributes, number | null>> {
  const out: Partial<Record<keyof PlayerAttributes, number | null>> = {}
  for (const row of visibleAttrsDetailed(attrs, knowledge)) {
    out[row.key] = row.known ? Number(row.display) : null
  }
  return out
}

export function weeklyScoutPassive(save: GameSave, staff: StaffState): ScoutKnowledge {
  const scouting = ensureScouting(save)
  const level = staffLevel(staff, 'scout')
  let byPlayer = { ...scouting.byPlayer }
  for (const p of save.players) {
    if (p.clubId === save.humanClubId) {
      byPlayer[p.id] = 100
      continue
    }
    const floor = scouting.alumniIds.includes(p.id) ? ALUMNI_FLOOR : 0
    const cur = byPlayer[p.id] ?? floor
    if (Math.random() < 0.06 + level * 0.004) {
      byPlayer[p.id] = Math.min(100, Math.max(floor, cur + 2))
    } else if (byPlayer[p.id] == null) {
      byPlayer[p.id] = floor
    }
  }
  return { ...scouting, byPlayer }
}

export function formWatchCost(save: GameSave): number {
  const level = staffLevel(save.staff, 'scout')
  return Math.round(180_000 + (20 - Math.min(20, level)) * 22_000)
}

export function assignFormWatch(
  save: GameSave,
  fixtureId: string,
  targetPlayerIds: string[],
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const scouting = ensureScouting(save)
  const fx = save.fixtures.find((f) => f.id === fixtureId)
  if (!fx) return { ok: false, message: 'ไม่พบนัดแข่ง' }
  if (fx.played) return { ok: false, message: 'นัดนี้แข่งไปแล้ว' }
  if (scouting.pendingWatches.some((w) => w.status === 'pending' && w.fixtureId === fixtureId)) {
    return { ok: false, message: 'มีสเกาต์ดูนัดนี้อยู่แล้ว' }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const cost = formWatchCost(save)
  if (human.balance < cost) {
    return { ok: false, message: `งบไม่พอ (ต้องการ ${cost.toLocaleString('th-TH')} ฿)` }
  }

  const assignment: FormWatchAssignment = {
    id: `watch-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    fixtureId,
    targetPlayerIds: targetPlayerIds.slice(0, 4),
    cost,
    status: 'pending',
  }

  return {
    ok: true,
    message: `ส่งสเกาต์ดูนัด MD${fx.matchday} · ค่าใช้จ่าย ${cost.toLocaleString('th-TH')} ฿`,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === human.id ? { ...c, balance: c.balance - cost } : c,
      ),
      scouting: {
        ...scouting,
        pendingWatches: [...scouting.pendingWatches, assignment],
      },
    },
  }
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function formFromOverall(overall: number, rng: () => number, teamWon: boolean | null): number {
  let base = 3 + ((overall - 60) / 40) * 5
  base += (rng() - 0.5) * 2.5
  if (teamWon === true) base += 0.6
  if (teamWon === false) base -= 0.5
  return Math.max(1, Math.min(10, Math.round(base * 10) / 10))
}

function formLabel(form: number): string {
  if (form >= 8.5) return 'เด่นมากในนัดนี้'
  if (form >= 7) return 'ฟอร์มดีในนัดนี้'
  if (form >= 5.5) return 'เล่นได้มาตรฐานในนัดนี้'
  if (form >= 4) return 'ฟอร์มแผ่วในนัดนี้'
  return 'ฟอร์มแย่ในนัดนี้ — อย่าเพิ่งสรุปภาพรวม'
}

/** หลังแมตช์เดย์: สเกาต์ที่สั่งดู → บันทึกฟอร์มทีละนัด + ความรู้เล็กน้อย */
export function resolveFormWatches(
  save: GameSave,
  results: { fixtureId: string; homeGoals: number; awayGoals: number }[],
): GameSave {
  const scouting = ensureScouting(save)
  const pending = scouting.pendingWatches.filter((w) => w.status === 'pending')
  if (pending.length === 0) return { ...save, scouting }

  let nextScout = scouting
  const sightings: ScoutFormSighting[] = []
  const doneIds = new Set<string>()
  const inboxNotes: string[] = []

  for (const watch of pending) {
    const result = results.find((r) => r.fixtureId === watch.fixtureId)
    const fx = save.fixtures.find((f) => f.id === watch.fixtureId)
    if (!result || !fx) continue

    doneIds.add(watch.id)
    const rng = mulberry32(save.season * 800 + fx.matchday * 33 + watch.cost)
    const level = staffLevel(save.staff, 'scout')

    let targets = watch.targetPlayerIds
      .map((id) => save.players.find((p) => p.id === id))
      .filter((p): p is Player => !!p)

    if (targets.length === 0) {
      targets = save.players
        .filter((p) => p.clubId === fx.homeClubId || p.clubId === fx.awayClubId)
        .filter((p) => p.clubId !== save.humanClubId)
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 3)
    }

    for (const p of targets) {
      const sideHome = p.clubId === fx.homeClubId
      const teamWon =
        result.homeGoals === result.awayGoals
          ? null
          : sideHome
            ? result.homeGoals > result.awayGoals
            : result.awayGoals > result.homeGoals
      const form = formFromOverall(p.overall, rng, teamWon)
      const note = formLabel(form)
      sightings.push({
        id: `form-${Date.now()}-${p.id.slice(-4)}-${Math.random().toString(36).slice(2, 5)}`,
        playerId: p.id,
        fixtureId: fx.id,
        date: fx.date,
        matchday: fx.matchday,
        form,
        note,
        source: 'staff_watch',
      })
      const gain = 4 + Math.floor(level * 0.35)
      nextScout = bumpKnowledge(nextScout, p.id, gain, 70)
      inboxNotes.push(`${p.name}: ฟอร์ม ${form}/10 (${note})`)
    }
  }

  if (doneIds.size === 0) return { ...save, scouting }

  nextScout = {
    ...nextScout,
    formSightings: [...sightings, ...nextScout.formSightings].slice(0, 80),
    pendingWatches: nextScout.pendingWatches.map((w) =>
      doneIds.has(w.id) ? { ...w, status: 'done' as const } : w,
    ),
  }

  return {
    ...save,
    scouting: nextScout,
    inbox:
      inboxNotes.length > 0
        ? [
            {
              id: `msg-form-${Date.now()}`,
              date: save.currentDate,
              title: 'รายงานฟอร์มจากสเกาต์',
              body: `เห็นความเก่งแค่นัดนี้เท่านั้น — ${inboxNotes.join(' · ')}`,
              read: false,
            },
            ...save.inbox,
          ].slice(0, 40)
        : save.inbox,
  }
}

export function recentFormForPlayer(
  scouting: ScoutKnowledge,
  playerId: string,
  limit = 5,
): ScoutFormSighting[] {
  return (scouting.formSightings ?? [])
    .filter((s) => s.playerId === playerId)
    .slice(0, limit)
}
