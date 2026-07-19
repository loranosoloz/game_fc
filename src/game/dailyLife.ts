import activitiesDb from '@/data/dailyActivities.json'
import type {
  DailyActivityDef,
  DailyActivityLog,
  GameSave,
  Player,
  StaffPerson,
} from './types'
import { ensureLivingStaff, finalizePool, pricingFromSkills } from './staff'
import { applyLifestyleFines } from './disciplineFines'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DAILY_ACTIVITIES: DailyActivityDef[] = activitiesDb.activities as DailyActivityDef[]

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

export function getActivity(id: string): DailyActivityDef | undefined {
  return DAILY_ACTIVITIES.find((a) => a.id === id)
}

type LifeStats = {
  professionalism: number
  ambition: number
  determination: number
  personalityId: string
  injuryDays?: number
  banMatches?: number
  happiness?: number
  role?: string
}

function pickWeightedActivity(stats: LifeStats, rng: () => number, staffMode: boolean): DailyActivityDef {
  const pro = stats.professionalism
  const amb = stats.ambition
  const det = stats.determination
  const temp =
    stats.personalityId === 'temperamental'
      ? 14
      : stats.personalityId === 'model_pro'
        ? 4
        : stats.personalityId === 'unambitious'
          ? 8
          : 10

  const weighted: Array<{ act: DailyActivityDef; w: number }> = []
  for (const act of DAILY_ACTIVITIES) {
    let w =
      act.weightBase +
      act.wPro * ((pro - 10) / 5) +
      act.wAmb * ((amb - 10) / 5) +
      act.wDet * ((det - 10) / 5) +
      act.wTemp * ((temp - 10) / 5)

    if ((stats.injuryDays ?? 0) > 0 && act.category === 'recovery') w += 6
    if ((stats.injuryDays ?? 0) > 0 && act.missTraining) w *= 0.2
    if ((stats.banMatches ?? 0) > 0 && act.category === 'lapse') w += 1.5
    if ((stats.happiness ?? 12) < 8 && act.category === 'conflict') w += 2
    if ((stats.happiness ?? 12) < 8 && act.category === 'ambition') w += 1.5
    if (stats.role === 'GK' && act.id === 'goalkeeper_extra') w += 4

    if (staffMode) {
      // Staff: coaching study / analysis more relevant; gym still ok; pub still bad
      if (act.category === 'training' || act.category === 'growth') w += 2
      if (act.id === 'tactics_board' || act.id === 'video_analysis') w += 3
      if (act.id === 'goalkeeper_extra' || act.id === 'solo_crossing') w *= 0.3
      if (amb >= 13 && act.category === 'ambition') w += 2
    }

    if (pro >= 15 && act.missTraining) w *= 0.15
    if (pro >= 16 && act.category === 'lapse') w *= 0.35
    if (pro >= 14 && act.category === 'training') w += 3

    w = Math.max(0.05, w)
    weighted.push({ act, w })
  }

  const total = weighted.reduce((s, x) => s + x.w, 0)
  let roll = rng() * total
  for (const row of weighted) {
    roll -= row.w
    if (roll <= 0) return row.act
  }
  return weighted[weighted.length - 1].act
}

export function pickDailyActivity(player: Player, rng: () => number): DailyActivityDef {
  return pickWeightedActivity(
    {
      professionalism: player.growth?.professionalism ?? 10,
      ambition: player.growth?.ambition ?? 10,
      determination: player.growth?.determination ?? 10,
      personalityId: player.personalityId,
      injuryDays: player.injuryDays,
      banMatches: player.banMatches,
      happiness: player.happiness,
      role: player.role,
    },
    rng,
    false,
  )
}

export function pickStaffActivity(staff: StaffPerson, rng: () => number): DailyActivityDef {
  return pickWeightedActivity(
    {
      professionalism: staff.professionalism,
      ambition: staff.ambition,
      determination: staff.determination,
      personalityId: staff.personalityId,
      happiness: staff.morale,
      role: staff.role,
    },
    rng,
    true,
  )
}

export function applyActivityToPlayer(player: Player, act: DailyActivityDef): Player {
  const e = act.effects
  return {
    ...player,
    sharpness: clamp(player.sharpness + e.sharpness, 20, 100),
    condition: clamp(player.condition + e.condition, 25, 100),
    morale: clamp(player.morale + e.morale, 1, 20),
    happiness: clamp((player.happiness ?? player.morale) + Math.sign(e.morale), 1, 20),
    lastActivityId: act.id,
  }
}

export function applyActivityToStaff(staff: StaffPerson, act: DailyActivityDef, rng: () => number): StaffPerson {
  const e = act.effects
  let next: StaffPerson = {
    ...staff,
    energy: clamp(staff.energy + e.condition * 3, 25, 100),
    morale: clamp(staff.morale + e.morale, 1, 20),
    lastActivityId: act.id,
  }
  // Growth from lifestyle
  if (act.category === 'training' || act.category === 'growth') {
    if (rng() < 0.35) next.coachSkill = Math.min(20, next.coachSkill + 1)
    if (rng() < 0.2) next.determination = Math.min(20, next.determination + 1)
  }
  if (act.category === 'lapse' || act.missTraining) {
    next.professionalism = Math.max(1, next.professionalism - (rng() < 0.4 ? 1 : 0))
    next.reputation = Math.max(1, next.reputation - 0.3)
  }
  if (act.category === 'discipline' && rng() < 0.25) {
    next.professionalism = Math.min(20, next.professionalism + 1)
  }
  const price = pricingFromSkills(next)
  return { ...next, ...price }
}

function addDays(iso: string, days: number) {
  const d = new Date(iso + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function simulateDailyLife(save: GameSave, dayCount = 7): GameSave {
  const rng = mulberry32(save.season * 9000 + save.matchday * 131 + dayCount * 17)
  let players = save.players.slice()
  let pool = (save.staff.pool ?? []).map((p) =>
    ensureLivingStaff(p as StaffPerson & { level?: number }),
  )
  const logs: DailyActivityLog[] = []
  const humanId = save.humanClubId

  for (let day = 0; day < dayCount; day++) {
    const date = addDays(save.currentDate, day - dayCount + 1)

    for (let i = 0; i < players.length; i++) {
      const p = players[i]
      if (p.clubId !== humanId && rng() > 0.15) continue
      const act = pickDailyActivity(p, rng)
      players[i] = applyActivityToPlayer(p, act)
      if (p.clubId === humanId) {
        logs.push({
          id: `day-${date}-${p.id}-${act.id}`,
          date,
          playerId: p.id,
          playerName: p.name,
          activityId: act.id,
          labelTh: act.labelTh,
          category: act.category,
          missTraining: act.missTraining,
          effects: act.effects,
          subject: 'player',
        })
      }
    }

    // Staff lifestyle (full for human club staff, sample others)
    for (let i = 0; i < pool.length; i++) {
      const s = pool[i]
      const isHumanStaff = s.clubId === humanId
      if (!isHumanStaff && rng() > 0.12) continue
      const act = pickStaffActivity(s, rng)
      pool[i] = applyActivityToStaff(s, act, rng)
      if (isHumanStaff) {
        logs.push({
          id: `day-${date}-${s.id}-${act.id}`,
          date,
          playerId: s.id,
          playerName: `[สตาฟ] ${s.name}`,
          activityId: act.id,
          labelTh: act.labelTh,
          category: act.category,
          missTraining: act.missTraining,
          effects: act.effects,
          subject: 'staff',
        })
      }
    }
  }

  const missed = logs.filter((l) => l.missTraining)
  const inbox =
    missed.length > 0
      ? [
          {
            id: `msg-daily-${Date.now()}`,
            date: save.currentDate,
            title: `วินัยรายวัน · ${missed.length} เคส`,
            body: missed
              .slice(0, 6)
              .map((m) => `${m.playerName}: ${m.labelTh}`)
              .join(' · '),
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40)
      : save.inbox

  const fin = finalizePool(pool, humanId)

  let next: GameSave = {
    ...save,
    players,
    staff: {
      ...save.staff,
      pool: fin.pool,
      members: fin.members,
    },
    dailyLogs: [...logs, ...(save.dailyLogs ?? [])].slice(0, 500),
    inbox,
  }

  // ค่าปรับวินัย — สุ่มตามหน้างานเมื่อผิดกฎ / ขาดซ้อม / อบายมุข
  next = applyLifestyleFines(
    next,
    logs
      .filter((l) => l.subject === 'player')
      .map((l) => ({
        playerId: l.playerId,
        activityId: l.activityId,
        category: l.category,
        missTraining: l.missTraining,
        date: l.date,
      })),
    rng,
  )

  return next
}

export function recentLogsForPlayer(save: GameSave, playerId: string, limit = 14): DailyActivityLog[] {
  return (save.dailyLogs ?? []).filter((l) => l.playerId === playerId).slice(0, limit)
}

export function latestSquadDay(save: GameSave): DailyActivityLog[] {
  const logs = save.dailyLogs ?? []
  if (!logs.length) return []
  const latest = logs[0]?.date
  return logs.filter((l) => l.date === latest)
}
