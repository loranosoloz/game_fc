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
  for (let i = 0; i < count; i++) {
    maxId += 1
    const role = YOUTH_ROLES[Math.floor(rng() * YOUTH_ROLES.length)]
    const overall = Math.round(48 + save.youth.academyLevel * 0.9 + rng() * 8)
    const age = 16 + Math.floor(rng() * 3)
    const ca = caFromOverall(overall)
    const personality = pickPersonality(rng, age, overall)
    const name = pickYouthName(rng, usedNames)
    newPlayers.push({
      id: `p-${maxId}`,
      clubId: human.id,
      name,
      age,
      role,
      position: roleGroup(role),
      overall: overallFromCa(ca),
      ca,
      pa: makePa(rng, ca, age) + Math.round(save.youth.academyLevel * 0.8),
      attrs: makeAttrs(rng, overall, role),
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

export function upgradeAcademy(save: GameSave): { save: GameSave; ok: boolean; message: string } {
  const cost = 250_000 + save.youth.academyLevel * 120_000
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  if (club.balance < cost) return { save, ok: false, message: 'งบไม่พออัปเกรดอะคาเดมี่' }
  if (save.youth.academyLevel >= 20) return { save, ok: false, message: 'อะคาเดมี่ระดับสูงสุดแล้ว' }
  return {
    ok: true,
    message: `อัปเกรดอะคาเดมี่เป็นระดับ ${save.youth.academyLevel + 1}`,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - cost } : c,
      ),
      youth: { ...save.youth, academyLevel: save.youth.academyLevel + 1 },
    },
  }
}
