import staffRoles from '@/data/staffRoles.json'
import staffPoolDb from '@/data/staffPool.json'
import type { Club, GameSave, StaffMember, StaffPerson, StaffRole, StaffState } from './types'

export const STAFF_ROLES: StaffRole[] = [
  'coach',
  'attacking',
  'defending',
  'fitness',
  'scout',
  'physio',
]

export function staffRoleLabelTh(role: StaffRole): string {
  const hit = (staffRoles.roles as { id: string; labelTh: string }[]).find((r) => r.id === role)
  return hit?.labelTh ?? role
}

const PERSONALITIES = [
  'model_pro',
  'driven',
  'balanced',
  'unambitious',
  'temperamental',
  'wonderkid',
] as const

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, min = 1, max = 20) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

/** Effective working level for a role slot from living skills. */
export function skillForRole(person: StaffPerson, role: StaffRole): number {
  switch (role) {
    case 'coach':
      return person.coachSkill
    case 'attacking':
      return person.attackSkill ?? person.coachSkill
    case 'defending':
      return person.defendSkill ?? person.coachSkill
    case 'fitness':
      return person.fitnessSkill ?? person.coachSkill
    case 'scout':
      return person.scoutSkill
    case 'physio':
      return person.physioSkill
  }
}

export function effectiveStaffLevel(person: StaffPerson, role: StaffRole = person.role): number {
  return clamp((skillForRole(person, role) + person.professionalism) / 2, 1, staffRoles.maxLevel)
}

export function pricingFromSkills(
  person: Pick<
    StaffPerson,
    | 'coachSkill'
    | 'attackSkill'
    | 'defendSkill'
    | 'fitnessSkill'
    | 'scoutSkill'
    | 'physioSkill'
    | 'reputation'
    | 'professionalism'
  >,
) {
  const peak = Math.max(
    person.coachSkill,
    person.attackSkill ?? 0,
    person.defendSkill ?? 0,
    person.fitnessSkill ?? 0,
    person.scoutSkill,
    person.physioSkill,
  )
  const wageWeekly = Math.round(
    6_000 + peak * 2_800 + person.reputation * 1_400 + person.professionalism * 400,
  )
  const hireFee = Math.round(30_000 + peak * 16_000 + person.reputation * 9_000)
  return { wageWeekly, hireFee }
}

function rollPerson(id: string, name: string, rng: () => number, origin: StaffPerson['origin'] = 'career'): StaffPerson {
  const personalityId = PERSONALITIES[Math.floor(rng() * PERSONALITIES.length)]
  const pro =
    personalityId === 'model_pro'
      ? 14 + Math.floor(rng() * 6)
      : personalityId === 'temperamental'
        ? 4 + Math.floor(rng() * 7)
        : 7 + Math.floor(rng() * 10)
  const amb =
    personalityId === 'driven' || personalityId === 'wonderkid'
      ? 13 + Math.floor(rng() * 7)
      : personalityId === 'unambitious'
        ? 3 + Math.floor(rng() * 7)
        : 7 + Math.floor(rng() * 10)
  const det = 6 + Math.floor(rng() * 12)

  // Aptitudes — anyone can move roles if skill is high enough
  let coachSkill = 4 + Math.floor(rng() * 12)
  let attackSkill = 4 + Math.floor(rng() * 12)
  let defendSkill = 4 + Math.floor(rng() * 12)
  let fitnessSkill = 4 + Math.floor(rng() * 12)
  let scoutSkill = 4 + Math.floor(rng() * 12)
  let physioSkill = 4 + Math.floor(rng() * 12)
  const bias = Math.floor(rng() * 6)
  if (bias === 0) coachSkill = Math.min(20, coachSkill + 4)
  if (bias === 1) attackSkill = Math.min(20, attackSkill + 4)
  if (bias === 2) defendSkill = Math.min(20, defendSkill + 4)
  if (bias === 3) fitnessSkill = Math.min(20, fitnessSkill + 4)
  if (bias === 4) scoutSkill = Math.min(20, scoutSkill + 4)
  if (bias === 5) physioSkill = Math.min(20, physioSkill + 4)

  const skills: Record<StaffRole, number> = {
    coach: coachSkill,
    attacking: attackSkill,
    defending: defendSkill,
    fitness: fitnessSkill,
    scout: scoutSkill,
    physio: physioSkill,
  }
  const role = (Object.entries(skills).sort((a, b) => b[1] - a[1])[0]![0] as StaffRole)

  const reputation = clamp(
    (coachSkill + attackSkill + defendSkill + fitnessSkill + scoutSkill + physioSkill) / 6 +
      rng() * 3,
  )
  const base = {
    coachSkill,
    attackSkill,
    defendSkill,
    fitnessSkill,
    scoutSkill,
    physioSkill,
    reputation,
    professionalism: clamp(pro),
  }
  const { wageWeekly, hireFee } = pricingFromSkills(base)

  return {
    id,
    name,
    role,
    clubId: null,
    origin,
    formerPlayerName: null,
    age: 32 + Math.floor(rng() * 28),
    energy: 70 + Math.floor(rng() * 30),
    morale: 8 + Math.floor(rng() * 10),
    professionalism: clamp(pro),
    ambition: clamp(amb),
    determination: clamp(det),
    personalityId,
    coachSkill,
    attackSkill,
    defendSkill,
    fitnessSkill,
    scoutSkill,
    physioSkill,
    reputation,
    wageWeekly,
    hireFee,
    lastActivityId: null,
    yearsInRole: Math.floor(rng() * 8),
  }
}

/** Migrate old JSON-shaped staff into living people. */
export function ensureLivingStaff(p: StaffPerson & { level?: number }): StaffPerson {
  if (typeof p.coachSkill === 'number' && typeof p.energy === 'number') {
    const coachSkill = p.coachSkill
    return {
      ...p,
      attackSkill: p.attackSkill ?? clamp(coachSkill - 1 + Math.random() * 3),
      defendSkill: p.defendSkill ?? clamp(coachSkill - 1 + Math.random() * 3),
      fitnessSkill: p.fitnessSkill ?? clamp(coachSkill - 1 + Math.random() * 3),
      lastActivityId: p.lastActivityId ?? null,
      yearsInRole: p.yearsInRole ?? 0,
      formerPlayerName: p.formerPlayerName ?? null,
    }
  }
  const level = p.level ?? 10
  const coachSkill = p.role === 'coach' ? level : clamp(level - 3 + Math.random() * 4)
  const attackSkill = p.role === 'attacking' ? level : clamp(level - 3 + Math.random() * 4)
  const defendSkill = p.role === 'defending' ? level : clamp(level - 3 + Math.random() * 4)
  const fitnessSkill = p.role === 'fitness' ? level : clamp(level - 3 + Math.random() * 4)
  const scoutSkill = p.role === 'scout' ? level : clamp(level - 3 + Math.random() * 4)
  const physioSkill = p.role === 'physio' ? level : clamp(level - 3 + Math.random() * 4)
  const living: StaffPerson = {
    id: p.id,
    name: p.name,
    role: p.role,
    clubId: p.clubId,
    origin: p.origin ?? 'career',
    formerPlayerName: p.formerPlayerName ?? null,
    age: p.age ?? 40,
    energy: p.energy ?? 80,
    morale: p.morale ?? 12,
    professionalism: p.professionalism ?? 10,
    ambition: p.ambition ?? 10,
    determination: p.determination ?? 10,
    personalityId: p.personalityId ?? 'balanced',
    coachSkill,
    attackSkill,
    defendSkill,
    fitnessSkill,
    scoutSkill,
    physioSkill,
    reputation: p.reputation ?? level,
    wageWeekly: p.wageWeekly,
    hireFee: p.hireFee,
    lastActivityId: null,
    yearsInRole: p.yearsInRole ?? 2,
  }
  const price = pricingFromSkills(living)
  return { ...living, ...price }
}

export function createStaffPool(clubs: Club[], seed = 2026): StaffPerson[] {
  const rng = mulberry32(seed)
  const names: string[] = staffPoolDb.names ?? []
  const pool: StaffPerson[] = names.map((name, i) =>
    rollPerson(`stf-${String(i + 1).padStart(3, '0')}`, name, rng),
  )

  for (const role of STAFF_ROLES) {
    const candidates = pool
      .filter((p) => !p.clubId)
      .sort(
        (a, b) =>
          effectiveStaffLevel(b, role) - effectiveStaffLevel(a, role) ||
          b.reputation - a.reputation,
      )
    for (const club of clubs) {
      const idx = Math.min(
        candidates.length - 1,
        Math.max(0, Math.floor((100 - club.reputation) / 8) + Math.floor(rng() * 3)),
      )
      const pick = candidates.splice(idx, 1)[0] ?? candidates.shift()
      if (pick) {
        pick.clubId = club.id
        pick.role = role
      }
    }
  }
  return pool
}

export function membersFromPool(pool: StaffPerson[], clubId: string): StaffMember[] {
  return STAFF_ROLES.map((role) => {
    const p = pool.find((s) => s.clubId === clubId && s.role === role)
    return p
      ? {
          role,
          name: p.name,
          level: effectiveStaffLevel(p, role),
          staffId: p.id,
        }
      : {
          role,
          name: `${staffRoleLabelTh(role)} (ว่าง)`,
          level: staffRoles.defaultLevel,
          staffId: null,
        }
  })
}

/** แต่ละตำแหน่งต่อคลับมีได้ 1 คน — คนเกินถูกปล่อยเป็นฟรีเอเยนต์ */
export function enforceOneHeadCoachPerClub(pool: StaffPerson[]): StaffPerson[] {
  const drop = new Set<string>()
  for (const role of STAFF_ROLES) {
    const byClub = new Map<string, StaffPerson[]>()
    for (const p of pool) {
      if (!p.clubId || p.role !== role) continue
      const list = byClub.get(p.clubId) ?? []
      list.push(p)
      byClub.set(p.clubId, list)
    }
    for (const [, list] of byClub) {
      if (list.length <= 1) continue
      list
        .slice()
        .sort(
          (a, b) =>
            skillForRole(b, role) - skillForRole(a, role) || b.reputation - a.reputation,
        )
        .slice(1)
        .forEach((p) => drop.add(p.id))
    }
  }
  if (drop.size === 0) return pool
  return pool.map((p) => {
    if (!drop.has(p.id)) return p
    const scores: [StaffRole, number][] = STAFF_ROLES.map((r) => [r, skillForRole(p, r)])
    scores.sort((a, b) => b[1] - a[1])
    const fallback = scores.find(([r]) => r !== p.role)?.[0] ?? 'scout'
    return { ...p, clubId: null, role: fallback, yearsInRole: 0 }
  })
}

function finalizePool(pool: StaffPerson[], humanClubId: string): { pool: StaffPerson[]; members: StaffMember[] } {
  const fixed = enforceOneHeadCoachPerClub(pool)
  return { pool: fixed, members: membersFromPool(fixed, humanClubId) }
}

export { finalizePool }

export function createStaff(clubs: Club[], humanClubId: string, seed = 2026): StaffState {
  const pool = createStaffPool(clubs, seed)
  const fin = finalizePool(pool, humanClubId)
  return {
    members: fin.members,
    pool: fin.pool,
    marketRefreshMatchday: 0,
  }
}

export function ensureStaffState(staff: StaffState, clubs: Club[], humanClubId: string): StaffState {
  if (staff.pool && staff.pool.length >= 50) {
    const pool = staff.pool.map((p) => ensureLivingStaff(p as StaffPerson & { level?: number }))
    const fin = finalizePool(pool, humanClubId)
    return {
      ...staff,
      pool: fin.pool,
      members: fin.members,
      marketRefreshMatchday: staff.marketRefreshMatchday ?? 0,
    }
  }
  return createStaff(clubs, humanClubId)
}

export function staffLevel(staff: StaffState, role: StaffRole): number {
  const person = staff.pool?.find(
    (p) => p.clubId && staff.members.some((m) => m.role === role && m.staffId === p.id),
  )
  if (person) return effectiveStaffLevel(person, role)
  const fromMembers = staff.members.find((m) => m.role === role)?.level
  if (typeof fromMembers === 'number') return fromMembers
  return staffRoles.defaultLevel
}

export function listFreeAgents(staff: StaffState, role?: StaffRole): StaffPerson[] {
  return (staff.pool ?? [])
    .filter((p) => !p.clubId)
    .map((p) => ensureLivingStaff(p as StaffPerson & { level?: number }))
    .sort((a, b) => {
      if (role) return effectiveStaffLevel(b, role) - effectiveStaffLevel(a, role)
      return (
        Math.max(b.coachSkill, b.scoutSkill, b.physioSkill) -
        Math.max(a.coachSkill, a.scoutSkill, a.physioSkill)
      )
    })
}

export function staffUpgradeCost(level: number) {
  return 80_000 + level * 45_000
}

export function upgradeStaff(staff: StaffState, role: StaffRole, humanClubId: string, costOk: boolean) {
  if (!costOk) return { staff, ok: false as const, message: 'งบไม่พออัปเกรดสตาฟ' }
  const pool = (staff.pool ?? []).map((p) => {
    if (p.clubId !== humanClubId || p.role !== role) return p
    const next = { ...p }
    if (role === 'coach') next.coachSkill = Math.min(20, next.coachSkill + 1)
    if (role === 'attacking') next.attackSkill = Math.min(20, (next.attackSkill ?? next.coachSkill) + 1)
    if (role === 'defending') next.defendSkill = Math.min(20, (next.defendSkill ?? next.coachSkill) + 1)
    if (role === 'fitness') next.fitnessSkill = Math.min(20, (next.fitnessSkill ?? next.coachSkill) + 1)
    if (role === 'scout') next.scoutSkill = Math.min(20, next.scoutSkill + 1)
    if (role === 'physio') next.physioSkill = Math.min(20, next.physioSkill + 1)
    next.professionalism = Math.min(20, next.professionalism + (Math.random() < 0.3 ? 1 : 0))
    next.reputation = Math.min(20, next.reputation + 0.5)
    const price = pricingFromSkills(next)
    return { ...next, ...price }
  })
  const fin = finalizePool(pool, humanClubId)
  return {
    staff: {
      ...staff,
      pool: fin.pool,
      members: fin.members,
    },
    ok: true as const,
    message: `อัปสกิล ${staffRoleLabelTh(role)} สำเร็จ`,
  }
}

/** จ้างคนเข้าสล็อต role ที่เลือก — สตาฟเปลี่ยนบทบาทได้ (เช่น สเกาต์ → โค้ช) */
export function hireStaff(
  save: GameSave,
  staffId: string,
  asRole: StaffRole,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const person = save.staff.pool?.find((p) => p.id === staffId)
  if (!person) return { ok: false, message: 'ไม่พบสตาฟ' }
  if (person.clubId) return { ok: false, message: 'สตาฟคนนี้มีสัญญาแล้ว' }

  const skill = skillForRole(person, asRole)
  if (skill < 6) {
    return {
      ok: false,
      message: `${person.name} ยังไม่พร้อมเป็น${staffRoleLabelTh(asRole)} (สกิล ${skill}/20 — ต้องการอย่างน้อย 6)`,
    }
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const totalCost = person.hireFee + person.wageWeekly * 4
  if (human.balance < totalCost) {
    return { ok: false, message: `งบไม่พอ (ต้องการ ~${totalCost.toLocaleString('en-US')} €)` }
  }

  const old = save.staff.pool!.find((p) => p.clubId === human.id && p.role === asRole)

  const pool = save.staff.pool!.map((p) => {
    if (old && p.id === old.id) return { ...p, clubId: null }
    if (p.id === staffId) {
      return {
        ...p,
        clubId: human.id,
        role: asRole,
        yearsInRole: p.role === asRole ? p.yearsInRole : 0,
      }
    }
    return p
  })

  const clubs = save.clubs.map((c) =>
    c.id === human.id ? { ...c, balance: c.balance - person.hireFee } : c,
  )

  const fin = finalizePool(pool, human.id)

  return {
    ok: true,
    message: `เชิญ ${person.name} เข้าทีมงานเป็น${staffRoleLabelTh(asRole)}${old ? ` (ปล่อย ${old.name})` : ''}`,
    save: {
      ...save,
      clubs,
      staff: {
        ...save.staff,
        pool: fin.pool,
        members: fin.members,
      },
      inbox: [
        {
          id: `msg-hire-${Date.now()}`,
          date: save.currentDate,
          title: `เชิญสตาฟ: ${person.name}`,
          body: `ตำแหน่ง ${staffRoleLabelTh(asRole)} · พลังงาน ${person.energy}% · สกิล ${skill}/20 · ค่าเซ็น ${person.hireFee.toLocaleString('en-US')} €`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** เปลี่ยนบทบาทสตาฟในทีมคุณ → โค้ช (ถ้ามี aptitude) */
export function promoteStaffToCoach(
  save: GameSave,
  staffId: string,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const person = save.staff.pool?.find((p) => p.id === staffId)
  if (!person) return { ok: false, message: 'ไม่พบสตาฟ' }
  if (person.clubId !== save.humanClubId) return { ok: false, message: 'ต้องเป็นสตาฟในทีมคุณ' }
  if (person.role === 'coach') return { ok: false, message: 'เป็นโค้ชอยู่แล้ว' }
  if (person.coachSkill < 8) {
    return {
      ok: false,
      message: `สกิลโค้ชยังต่ำ (${person.coachSkill}/20) — ต้องการอย่างน้อย 8 หรืออัปเกรด/ใช้ชีวิตเพิ่ม`,
    }
  }

  const oldCoach = save.staff.pool!.find((p) => p.clubId === save.humanClubId && p.role === 'coach')
  const pool = save.staff.pool!.map((p) => {
    if (oldCoach && p.id === oldCoach.id) return { ...p, clubId: null, role: p.role }
    if (p.id === staffId) return { ...p, role: 'coach' as const, yearsInRole: 0, ambition: Math.min(20, p.ambition + 1) }
    return p
  })

  const fin = finalizePool(pool, save.humanClubId)

  return {
    ok: true,
    message: `${person.name} เป็นผู้ช่วยผู้จัดการ${oldCoach ? ` · ${oldCoach.name} พ้นตำแหน่ง` : ''}`,
    save: {
      ...save,
      staff: {
        ...save.staff,
        pool: fin.pool,
        members: fin.members,
      },
      inbox: [
        {
          id: `msg-promo-${Date.now()}`,
          date: save.currentDate,
          title: `ผู้ช่วยผู้จัดการคนใหม่: ${person.name}`,
          body: `จาก ${staffRoleLabelTh(person.role)} → ผู้ช่วยผู้จัดการ · สกิลโค้ช ${person.coachSkill}/20`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

export function refreshStaffMarket(save: GameSave): GameSave {
  if (!save.staff.pool?.length) return save
  if (save.matchday === save.staff.marketRefreshMatchday) return save
  const rng = mulberry32(save.season * 1000 + save.matchday * 97)

  let pool = save.staff.pool.map((p) => ensureLivingStaff(p as StaffPerson & { level?: number }))

  for (const club of save.clubs.filter((c) => c.controlledBy === 'ai')) {
    if (rng() > 0.12) continue
    const role = STAFF_ROLES[Math.floor(rng() * STAFF_ROLES.length)]!
    const free = pool
      .filter((p) => !p.clubId)
      .sort((a, b) => effectiveStaffLevel(b, role) - effectiveStaffLevel(a, role))
    if (!free.length) continue
    const candidate = free[Math.floor(rng() * Math.min(8, free.length))]
    if (effectiveStaffLevel(candidate, role) < 6) continue
    const current = pool.find((p) => p.clubId === club.id && p.role === role)
    if (
      current &&
      effectiveStaffLevel(candidate, role) <= effectiveStaffLevel(current, role) + 1 &&
      rng() > 0.4
    ) {
      continue
    }
    pool = pool.map((p) => {
      if (current && p.id === current.id) return { ...p, clubId: null }
      if (p.id === candidate.id) return { ...p, clubId: club.id, role }
      return p
    })
  }

  // Ambitious non-coaches sometimes self-train toward coaching
  pool = pool.map((p) => {
    if (p.role === 'coach') return p
    if (p.ambition < 12 || rng() > 0.08) return p
    return {
      ...p,
      coachSkill: Math.min(20, p.coachSkill + 1),
      energy: Math.max(40, p.energy - 2),
    }
  })

  pool = pool.map((p) => {
    if (p.clubId) return p
    if (rng() > 0.15) return p
    const jitter = 0.92 + rng() * 0.16
    return {
      ...p,
      wageWeekly: Math.round(p.wageWeekly * jitter),
      hireFee: Math.round(p.hireFee * jitter),
    }
  })

  const fin = finalizePool(pool, save.humanClubId)

  return {
    ...save,
    staff: {
      ...save.staff,
      pool: fin.pool,
      members: fin.members,
      marketRefreshMatchday: save.matchday,
    },
  }
}

export function convertPlayerToStaff(
  save: GameSave,
  playerId: string,
  role: StaffRole = 'coach',
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.age < 32) return { ok: false, message: 'อายุยังน้อย — ควร ≥ 32 ปี' }

  const id = `stf-ex-${player.id}`
  if (save.staff.pool?.some((p) => p.id === id)) {
    return { ok: false, message: 'คนนี้เป็นสตาฟอยู่แล้ว' }
  }

  const pro = player.growth?.professionalism ?? 10
  const coachSkill = clamp(player.overall / 6 + (role === 'coach' ? 4 : 0))
  const attackSkill = clamp(player.overall / 7 + (role === 'attacking' ? 5 : 1))
  const defendSkill = clamp(player.overall / 7 + (role === 'defending' ? 5 : 1))
  const fitnessSkill = clamp(player.overall / 8 + (role === 'fitness' ? 5 : 2))
  const scoutSkill = clamp(player.overall / 7 + (role === 'scout' ? 4 : 2))
  const physioSkill = clamp(8 + (role === 'physio' ? 4 : 0))
  const reputation = clamp(player.overall / 5)
  const price = pricingFromSkills({
    coachSkill,
    attackSkill,
    defendSkill,
    fitnessSkill,
    scoutSkill,
    physioSkill,
    reputation,
    professionalism: pro,
  })

  const person: StaffPerson = {
    id,
    name: player.name,
    role,
    clubId: null,
    origin: 'ex_player',
    formerPlayerName: player.name,
    age: player.age,
    energy: Math.min(100, player.condition),
    morale: player.morale,
    professionalism: clamp(pro),
    ambition: clamp(player.growth?.ambition ?? 10),
    determination: clamp(player.growth?.determination ?? 10),
    personalityId: player.personalityId,
    coachSkill,
    attackSkill,
    defendSkill,
    fitnessSkill,
    scoutSkill,
    physioSkill,
    reputation,
    ...price,
    lastActivityId: null,
    yearsInRole: 0,
  }

  const players = save.players.filter((p) => p.id !== playerId)
  const pool = [...(save.staff.pool ?? []), person]
  const tacticsByClub = { ...save.tacticsByClub }
  for (const clubId of Object.keys(tacticsByClub)) {
    const t = tacticsByClub[clubId]
    tacticsByClub[clubId] = {
      ...t,
      startingXi: t.startingXi.filter((pid) => pid !== playerId),
      bench: t.bench.filter((pid) => pid !== playerId),
    }
  }

  const fin = finalizePool(pool, save.humanClubId)

  return {
    ok: true,
    message: `${player.name} แขวนสตั๊ด → สมัครเป็นสตาฟ (พร้อมเลื่อนเป็นโค้ชหลักได้ถ้าสกิลพอ)`,
    save: {
      ...save,
      players,
      tacticsByClub,
      staff: {
        ...save.staff,
        pool: fin.pool,
        members: fin.members,
      },
      inbox: [
        {
          id: `msg-retire-${Date.now()}`,
          date: save.currentDate,
          title: `แขวนสตั๊ด: ${player.name}`,
          body: `เข้าตลาดสตาฟ · โค้ชสกิล ${coachSkill} · สเกาต์ ${scoutSkill} · แพทย์ ${physioSkill}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

export function maybePlayersBecomeStaff(save: GameSave): GameSave {
  const rng = mulberry32(save.season * 333 + save.matchday * 19)
  let next = save
  const candidates = next.players.filter(
    (p) => p.age >= 34 && p.overall < 72 && p.clubId !== next.humanClubId,
  )
  for (const p of candidates) {
    if (rng() > 0.04) continue
    const role = STAFF_ROLES[Math.floor(rng() * STAFF_ROLES.length)]!
    const res = convertPlayerToStaff(next, p.id, role)
    if (res.ok) next = res.save
  }
  return next
}
