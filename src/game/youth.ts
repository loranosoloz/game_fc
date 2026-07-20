import type { GameSave, Player, RoleCode, YouthState } from './types'
import { roleGroup } from './positions'
import {
  caFromOverall,
  makeAttrs,
  makeHidden,
  makePa,
  overallFromCa,
  pickPersonality,
} from './attributes'
import { FIRST, LAST, mulberry32 } from './seed'
import { REAL_NAME_OVERFLOW } from '@/data/world/realNameOverflow'
import { REAL_NAME_BANKS } from '@/data/world/realNameBanks'
import { ensureScouting } from './scouting'
import { newsAfterYouth, pushNews } from './media'
import { createBodyMap } from './bodyMap'
import { rollPlayerSkills } from './playerSkills'
import { createPlayerSocial } from './social'
import { feederLevelSum } from './affiliates'
import { proposeFacilityUpgrade } from './facilities'
import { buildPlayerTacticalRoles } from './playerTacticalRoles'

const YOUTH_NAME_POOL = [
  ...new Set([...Object.values(REAL_NAME_BANKS).flat(), ...REAL_NAME_OVERFLOW]),
]

const YOUTH_ROLES: RoleCode[] = ['CB', 'CM', 'ST', 'LW', 'RW', 'CDM', 'CAM', 'LB', 'RB', 'GK']

function pickYouthName(rng: () => number, used: Set<string>): string {
  const start = Math.floor(rng() * YOUTH_NAME_POOL.length)
  for (let i = 0; i < YOUTH_NAME_POOL.length; i++) {
    const name = YOUTH_NAME_POOL[(start + i) % YOUTH_NAME_POOL.length]
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  // Rare: invent from legacy pools only if every real name is taken
  return `${FIRST[Math.floor(rng() * FIRST.length)]} ${LAST[Math.floor(rng() * LAST.length)]}`
}

export function createYouthState(): YouthState {
  return {
    academyLevel: 8,
    nextIntakeMatchday: 8,
    lastIntakeNote: 'อะคาเดมี่พร้อมผลิตเด็กชุดแรกช่วงกลางฤดูกาล',
  }
}

export function maybePromoteYouth(save: GameSave): GameSave {
  if (save.matchday < save.youth.nextIntakeMatchday) return save
  if (save.matchday > save.youth.nextIntakeMatchday) return save

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const rng = mulberry32(save.season * 1000 + save.matchday * 17)
  const count = 1 + (rng() > 0.55 ? 1 : 0)
  const newPlayers: Player[] = []
  let maxId = save.players.reduce((m, p) => {
    const n = Number(p.id.replace(/\D/g, ''))
    return Number.isFinite(n) ? Math.max(m, n) : m
  }, 0)

  const usedNames = new Set(save.players.map((p) => p.name))
  const affiliateBoost = feederLevelSum(save)
  for (let i = 0; i < count; i++) {
    maxId += 1
    const role = YOUTH_ROLES[Math.floor(rng() * YOUTH_ROLES.length)]
    const overall = Math.round(
      48 + save.youth.academyLevel * 0.9 + rng() * 8 + affiliateBoost * 0.35,
    )
    const age = 16 + Math.floor(rng() * 3)
    const ca = caFromOverall(overall)
    const personality = pickPersonality(rng, age, overall)
    const name = pickYouthName(rng, usedNames)
    const attrs = makeAttrs(rng, overall, role)
    const ovr = overallFromCa(ca)
    newPlayers.push({
      id: `p-${maxId}`,
      clubId: human.id,
      name,
      age,
      role,
      position: roleGroup(role),
      overall: ovr,
      ca,
      pa:
        makePa(rng, ca, age) +
        Math.round(save.youth.academyLevel * 0.8) +
        Math.round(affiliateBoost * 0.55),
      attrs,
      hidden: makeHidden(rng),
      growth: { ...personality.growth, learningRate: Math.min(20, personality.growth.learningRate + 2) },
      personalityId: personality.personalityId,
      condition: 95,
      sharpness: 60,
      form: 10,
      morale: 14,
      happiness: 14,
      wage: 400 + overall * 20,
      cash: Math.round((400 + overall * 20) * (3 + rng() * 6)),
      squadRole: 'prospect',
      injuryDays: 0,
      injuryType: null,
      treatment: null,
      injuryBodyPart: null,
      bodyMap: createBodyMap(rng),
      injuryHistory: [],
      illnessDays: 0,
      illnessType: null,
      seasonYellows: 0,
      banMatches: 0,
      leaveDays: 0,
      contractYears: 3,
      contractEndSeason: save.season + 3,
      releaseClause: null,
      minutesPlayed: 0,
      isYouth: true,
      mentorId: null,
      mediaHandling: 5 + Math.floor(rng() * 8),
      skills: rollPlayerSkills(roleGroup(role), ovr, rng, {
        role,
        attrs,
        id: `p-${maxId}`,
      }),
      preferredTacticalRoles: buildPlayerTacticalRoles({
        role,
        attrs,
        fmInside: null,
      }),
      social: createPlayerSocial(
        {
          id: `p-${maxId}`,
          name,
          overall: overallFromCa(ca),
          age,
          mediaHandling: 5 + Math.floor(rng() * 8),
          isYouth: true,
        },
        human.social?.followers ?? 50_000,
      ),
    })
  }

  const names = newPlayers.map((p) => `${p.name} (${p.role})`).join(', ')
  const scouting = ensureScouting(save)
  let next: GameSave = {
    ...save,
    players: [...save.players, ...newPlayers],
    youth: {
      ...save.youth,
      nextIntakeMatchday: save.matchday + 12,
      lastIntakeNote: `โปรโมตจากอะคาเดมี่: ${names}`,
    },
    inbox: [
      {
        id: `msg-youth-${Date.now()}`,
        date: save.currentDate,
        title: 'Youth intake',
        body: `นักเตะเยาวชนขึ้นชุดใหญ่: ${names}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
    scouting: {
      ...scouting,
      byPlayer: {
        ...scouting.byPlayer,
        ...Object.fromEntries(newPlayers.map((p) => [p.id, 85])),
      },
    },
  }
  return pushNews(next, newsAfterYouth(next, names))
}

/** @deprecated ใช้ proposeFacilityUpgrade('youth') — คงไว้เป็น thin wrapper */
export function upgradeAcademy(save: GameSave): { save: GameSave; ok: boolean; message: string } {
  return proposeFacilityUpgrade(save, 'youth')
}

/**
 * จบเส้นทางเยาวชน → ขึ้นชุดใหญ่ถาวร
 * เงื่อนไข: อายุ ≥ 17 และ (นาที ≥ 180 หรือ อายุ ≥ 19 หรือ OVR ≥ 68)
 */
export function graduateYouthPlayer(
  save: GameSave,
  playerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p || p.clubId !== save.humanClubId) {
    return { ok: false, save, message: 'ไม่พบนักเตะในคลับคุณ' }
  }
  if (!p.isYouth) {
    return { ok: false, save, message: `${p.name} ไม่ได้อยู่สถานะเยาวชนแล้ว` }
  }
  const ready =
    p.age >= 17 && (p.minutesPlayed >= 180 || p.age >= 19 || p.overall >= 68)
  if (!ready) {
    return {
      ok: false,
      save,
      message: `${p.name} ยังไม่พร้อม — ต้องการอายุ≥17 และ (นาที≥180 หรือ อายุ≥19 หรือ OVR≥68)`,
    }
  }
  const wageBump = Math.round(p.wage * 1.35 + 400)
  const players = save.players.map((x) =>
    x.id === playerId
      ? {
          ...x,
          isYouth: false,
          wage: wageBump,
          squadRole: x.squadRole === 'youth' ? 'squad' : x.squadRole,
          morale: Math.min(20, x.morale + 2),
          happiness: Math.min(20, (x.happiness ?? x.morale) + 2),
        }
      : x,
  )
  return {
    ok: true,
    save: {
      ...save,
      players,
      inbox: [
        {
          id: `msg-grad-${Date.now()}`,
          date: save.currentDate,
          title: 'ขึ้นชุดใหญ่',
          body: `${p.name} จบสถานะเยาวชน · ค่าเหนื่อย ${wageBump.toLocaleString('th-TH')}/สัปดาห์`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
    message: `${p.name} ขึ้นชุดใหญ่แล้ว`,
  }
}
