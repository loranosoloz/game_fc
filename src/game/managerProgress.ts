import type { Club, GameSave, PlayStyle } from './types'
import {
  ATTR_MAX,
  ATTR_MIN,
  MANAGER_ATTR_KEYS,
  type ManagerAttrKey,
  type ManagerProfile,
  ensureManagerProfile,
} from './managerProfile'

/** ความก้าวหน้าอาชีพโค้ช — XP / เลเวล / ฟอร์มล่าสุด */
export interface ManagerProgress {
  level: number
  xp: number
  /** ผลนัดล่าสุด W/D/L (เก็บ 8 นัด) */
  recent: Array<'W' | 'D' | 'L'>
  lastNote: string | null
}

export function xpToNextLevel(level: number): number {
  return Math.round(36 + level * 16)
}

export function createManagerProgress(profile?: ManagerProfile | null): ManagerProgress {
  const power = profile?.power ?? 70
  const level = Math.max(1, Math.min(12, Math.round((power - 58) / 3)))
  return {
    level,
    xp: 0,
    recent: [],
    lastNote: null,
  }
}

export function ensureManagerProgress(save: GameSave): ManagerProgress {
  const p = save.managerProgress
  if (p && typeof p.level === 'number') {
    return {
      level: Math.max(1, Math.min(40, p.level)),
      xp: Math.max(0, p.xp ?? 0),
      recent: Array.isArray(p.recent) ? p.recent.slice(0, 8) : [],
      lastNote: p.lastNote ?? null,
    }
  }
  return createManagerProgress(save.managerProfile)
}

export function recomputeProfileFromAttrs(profile: ManagerProfile): ManagerProfile {
  const attrs = profile.attrs
  const avg = (...keys: ManagerAttrKey[]) =>
    keys.reduce((s, k) => s + attrs[k], 0) / keys.length
  const toStat = (n: number) => Math.max(50, Math.min(96, Math.round(48 + n * 2.2)))
  const attackingIQ = toStat(avg('attacking', 'tactical', 'technical'))
  const defendingIQ = toStat(avg('defending', 'tactical', 'fitness'))
  const manManagement = toStat(avg('manManagement', 'motivating', 'discipline'))
  const adaptability = toStat(avg('adaptability', 'tacticalKnowledge', 'determination'))
  const power = Math.max(
    58,
    Math.min(
      94,
      Math.round(
        (attackingIQ + defendingIQ + manManagement + adaptability) / 4 +
          attrs.tacticalKnowledge * 0.15,
      ),
    ),
  )
  return { ...profile, attackingIQ, defendingIQ, manManagement, adaptability, power }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 4)}`
}

/** XP จากผลแมตช์ — ทีมเล็กชนะ/ทำเกินเป้าได้เยอะ · ทีมใหญ่ชนะตามเป้าได้น้อย */
export function matchManagerXp(opts: {
  won: boolean
  drawn: boolean
  clubRep: number
  oppRep: number
  competition: string
}): number {
  const { won, drawn, clubRep, oppRep, competition } = opts
  if (!won && !drawn) return 0

  let xp = won ? 10 : 3
  const gap = oppRep - clubRep
  if (won && gap >= 10) xp += 8
  else if (won && gap >= 5) xp += 4
  else if (won && clubRep >= 75 && gap < -12) xp = Math.max(4, xp - 4)

  // ทีมเล็ก/กลาง — ชนะแต่ละนัดมีค่า
  if (won && clubRep < 55) xp += 4
  else if (won && clubRep < 65) xp += 2

  if (competition === 'cup' || competition === 'ucl' || competition === 'uel' || competition === 'uecl' || competition === 'acl' || competition === 'acl_two' || competition === 'asean_cup' || competition === 'cwc' || competition === 'super_cup') {
    xp = Math.round(xp * 1.35)
  }
  return xp
}

function pickAttrToBoost(profile: ManagerProfile, preferStyle: boolean): ManagerAttrKey {
  const styleBias: ManagerAttrKey[] =
    profile.style === 'press' || profile.style === 'possession'
      ? ['attacking', 'tactical', 'fitness', 'motivating']
      : profile.style === 'low_block' || profile.style === 'counter'
        ? ['defending', 'tactical', 'discipline', 'setPieces']
        : ['tactical', 'tacticalKnowledge', 'manManagement', 'adaptability']

  const pool = preferStyle
    ? [...styleBias, ...MANAGER_ATTR_KEYS.filter((k) => !styleBias.includes(k))]
    : [...MANAGER_ATTR_KEYS].sort((a, b) => profile.attrs[a] - profile.attrs[b])

  for (const k of pool) {
    if (profile.attrs[k] < ATTR_MAX) return k
  }
  return 'adaptability'
}

function pickAttrToDrop(profile: ManagerProfile): ManagerAttrKey | null {
  const candidates = MANAGER_ATTR_KEYS.filter((k) => profile.attrs[k] > ATTR_MIN + 2)
  if (candidates.length === 0) return null
  // ลดด้านที่สูงก่อน (ฟอร์มแย่กระทบจุดแข็ง)
  candidates.sort((a, b) => profile.attrs[b] - profile.attrs[a])
  return candidates[Math.floor(Math.random() * Math.min(4, candidates.length))]!
}

export function applyManagerMatchProgress(
  save: GameSave,
  opts: {
    won: boolean
    drawn: boolean
    lost: boolean
    clubRep: number
    oppRep: number
    competition: string
  },
): GameSave {
  let progress = ensureManagerProgress(save)
  let profile = ensureManagerProfile(save.managerProfile)
  let rep = save.managerReputation ?? 50
  const notes: string[] = []
  const inbox = [...save.inbox]

  const result: 'W' | 'D' | 'L' = opts.won ? 'W' : opts.drawn ? 'D' : 'L'
  const recent = [result, ...progress.recent].slice(0, 8)

  let gained = matchManagerXp({
    won: opts.won,
    drawn: opts.drawn,
    clubRep: opts.clubRep,
    oppRep: opts.oppRep,
    competition: opts.competition,
  })
  if (gained > 0) {
    progress = { ...progress, xp: progress.xp + gained }
    notes.push(`+${gained} XP`)
  }

  // ชนะบ่อย → โอกาสอัพแอตฯ
  const wins = recent.filter((r) => r === 'W').length
  const losses = recent.filter((r) => r === 'L').length
  if (opts.won && wins >= 3 && Math.random() < 0.22) {
    const key = pickAttrToBoost(profile, true)
    if (profile.attrs[key] < ATTR_MAX) {
      profile = recomputeProfileFromAttrs({
        ...profile,
        attrs: { ...profile.attrs, [key]: profile.attrs[key] + 1 },
      })
      notes.push(`แอตฯ ${key} +1 (ฟอร์มดี)`)
    }
  }

  // แพ้บ่อย → ลดแอตฯ
  if (opts.lost && losses >= 3 && Math.random() < 0.28) {
    const key = pickAttrToDrop(profile)
    if (key) {
      profile = recomputeProfileFromAttrs({
        ...profile,
        attrs: { ...profile.attrs, [key]: profile.attrs[key] - 1 },
      })
      notes.push(`แอตฯ ${key} −1 (แพ้ต่อเนื่อง)`)
    }
  } else if (opts.lost && losses >= 5 && Math.random() < 0.4) {
    const key = pickAttrToDrop(profile)
    if (key) {
      profile = recomputeProfileFromAttrs({
        ...profile,
        attrs: { ...profile.attrs, [key]: profile.attrs[key] - 1 },
      })
      notes.push(`แอตฯ ${key} −1 (วิกฤตฟอร์ม)`)
    }
  }

  // เลเวลอัพ
  let leveled = 0
  while (progress.level < 40 && progress.xp >= xpToNextLevel(progress.level)) {
    progress = {
      ...progress,
      xp: progress.xp - xpToNextLevel(progress.level),
      level: progress.level + 1,
    }
    leveled += 1
    const key = pickAttrToBoost(profile, true)
    if (profile.attrs[key] < ATTR_MAX) {
      profile = recomputeProfileFromAttrs({
        ...profile,
        attrs: { ...profile.attrs, [key]: profile.attrs[key] + 1 },
      })
    }
    rep = Math.min(100, rep + 1)
  }
  if (leveled > 0) {
    notes.push(`เลเวลอัพ → Lv.${progress.level}`)
    inbox.unshift({
      id: uid('msg-lvl'),
      date: save.currentDate,
      title: `เลเวลอัพผู้จัดการ · Lv.${progress.level}`,
      body: `ประสบการณ์จากการคุมทีมทำให้คุณเก่งขึ้น · ${notes.join(' · ')}`,
      read: false,
    })
  }

  progress = {
    ...progress,
    recent,
    lastNote: notes.length ? notes.join(' · ') : progress.lastNote,
  }

  return {
    ...save,
    managerProgress: progress,
    managerProfile: profile,
    managerReputation: rep,
    inbox: inbox.slice(0, 45),
  }
}

/** ให้ XP จากเควสสโมสร (ทำตามความหวังคลับ — ทีมเล็กก็เลเวลได้) */
export function grantManagerQuestXp(
  save: GameSave,
  rewardXp: number,
  questTitle: string,
): GameSave {
  let progress = ensureManagerProgress(save)
  let profile = ensureManagerProfile(save.managerProfile)
  let rep = save.managerReputation ?? 50
  progress = { ...progress, xp: progress.xp + rewardXp }

  const notes = [`เควส「${questTitle}」+${rewardXp} XP`]
  const inbox = [...save.inbox]
  let leveled = 0
  while (progress.level < 40 && progress.xp >= xpToNextLevel(progress.level)) {
    progress = {
      ...progress,
      xp: progress.xp - xpToNextLevel(progress.level),
      level: progress.level + 1,
    }
    leveled += 1
    const key = pickAttrToBoost(profile, false)
    if (profile.attrs[key] < ATTR_MAX) {
      profile = recomputeProfileFromAttrs({
        ...profile,
        attrs: { ...profile.attrs, [key]: profile.attrs[key] + 1 },
      })
    }
    rep = Math.min(100, rep + 1)
  }

  inbox.unshift({
    id: uid('msg-quest'),
    date: save.currentDate,
    title: leveled ? `เควสสำเร็จ + เลเวลอัพ Lv.${progress.level}` : `เควสสำเร็จ: ${questTitle}`,
    body: `${notes.join(' · ')}${leveled ? ` · เลเวลอัพ → Lv.${progress.level}` : ''} · ทีมเล็กหรือใหญ่ ทำตามเป้าสโมสรได้ก็เก่งขึ้น`,
    read: false,
  })

  progress = { ...progress, lastNote: notes.join(' · ') }
  return {
    ...save,
    managerProgress: progress,
    managerProfile: profile,
    managerReputation: rep,
    inbox: inbox.slice(0, 45),
  }
}

export type ClubQuestKind =
  | 'league_rank'
  | 'min_points'
  | 'avoid_bottom'
  | 'win_streak'
  | 'youth_minutes'
  | 'style'
  | 'finance_buffer'
  | 'cup_wins'
  | 'promotion_push'

export interface ClubQuest {
  id: string
  clubId: string
  season: number
  kind: ClubQuestKind
  title: string
  body: string
  target: number
  current: number
  rewardXp: number
  status: 'active' | 'completed' | 'failed'
  /** core = ความหวังหลักของคลับ · stretch = โบนัส */
  tier: 'core' | 'stretch'
}

function qid(kind: string, season: number) {
  return `quest-${kind}-${season}`
}

/** สร้างเควสตามขนาด/เป้าของสโมสร — ทีมเล็กไม่ได้บังคับแชมป์ */
export function createClubQuests(
  club: Club,
  season: number,
  preferredStyle: PlayStyle,
): ClubQuest[] {
  const rep = club.reputation
  const div2 = club.division === 2
  const quests: ClubQuest[] = []

  if (div2) {
    quests.push({
      id: qid('promotion_push', season),
      clubId: club.id,
      season,
      kind: 'promotion_push',
      title: 'ลุ้นเลื่อนชั้น',
      body: 'จบลีกในท็อป 2 (หรืออย่างน้อยท็อป 6)',
      target: 2,
      current: 20,
      rewardXp: 55,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('min_points', season),
      clubId: club.id,
      season,
      kind: 'min_points',
      title: 'เก็บแต้มให้พอ',
      body: 'สะสมอย่างน้อย 45 แต้มในลีก',
      target: 45,
      current: 0,
      rewardXp: 35,
      status: 'active',
      tier: 'stretch',
    })
  } else if (rep >= 78) {
    quests.push({
      id: qid('league_rank', season),
      clubId: club.id,
      season,
      kind: 'league_rank',
      title: 'ลุ้นท็อป 4',
      body: 'บอร์ดคาดหวังโซนแชมเปียนส์ลีก — จบในท็อป 4',
      target: 4,
      current: 20,
      rewardXp: 70,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('cup_wins', season),
      clubId: club.id,
      season,
      kind: 'cup_wins',
      title: 'ถ้วยชาติ — ไปให้ไกล',
      body: 'ชนะถ้วยชาติอย่างน้อย 3 นัด',
      target: 3,
      current: 0,
      rewardXp: 40,
      status: 'active',
      tier: 'stretch',
    })
  } else if (rep >= 65) {
    quests.push({
      id: qid('league_rank', season),
      clubId: club.id,
      season,
      kind: 'league_rank',
      title: 'ครึ่งตารางบนชัด',
      body: 'จบลีกในท็อป 8',
      target: 8,
      current: 20,
      rewardXp: 50,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('cup_wins', season),
      clubId: club.id,
      season,
      kind: 'cup_wins',
      title: 'สร้างชื่อในถ้วย',
      body: 'ชนะถ้วยอย่างน้อย 2 นัด',
      target: 2,
      current: 0,
      rewardXp: 30,
      status: 'active',
      tier: 'stretch',
    })
  } else if (rep >= 52) {
    quests.push({
      id: qid('league_rank', season),
      clubId: club.id,
      season,
      kind: 'league_rank',
      title: 'อยู่นอกโซนอันตราย',
      body: 'จบลีกไม่ต่ำกว่าอันดับ 14',
      target: 14,
      current: 20,
      rewardXp: 45,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('min_points', season),
      clubId: club.id,
      season,
      kind: 'min_points',
      title: 'แต้มรอดตกชั้น',
      body: 'เก็บให้ได้ 38 แต้ม',
      target: 38,
      current: 0,
      rewardXp: 40,
      status: 'active',
      tier: 'core',
    })
  } else {
    // ทีมเล็ก — ไม่บังคับแชมป์
    quests.push({
      id: qid('avoid_bottom', season),
      clubId: club.id,
      season,
      kind: 'avoid_bottom',
      title: 'รอดตกชั้นให้ได้',
      body: 'อย่าจบใน 3 อันดับท้าย',
      target: 3,
      current: 0,
      rewardXp: 50,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('min_points', season),
      clubId: club.id,
      season,
      kind: 'min_points',
      title: 'สร้างฐานแต้ม',
      body: 'เก็บอย่างน้อย 32 แต้ม — พิสูจน์ว่าคุมทีมเล็กได้',
      target: 32,
      current: 0,
      rewardXp: 45,
      status: 'active',
      tier: 'core',
    })
    quests.push({
      id: qid('win_streak', season),
      clubId: club.id,
      season,
      kind: 'win_streak',
      title: 'ชนะติด 3 นัด',
      body: 'สร้างความเชื่อมั่นด้วยชัยชนะติดต่อกัน 3 ครั้ง (ลีกหรือถ้วย)',
      target: 3,
      current: 0,
      rewardXp: 35,
      status: 'active',
      tier: 'stretch',
    })
  }

  // ร่วมทุกคลับ
  quests.push({
    id: qid('youth_minutes', season),
    clubId: club.id,
    season,
    kind: 'youth_minutes',
    title: rep >= 65 ? 'ให้โอกาสเยาวชน' : 'ปั้นเด็กท้องถิ่น',
    body: `ให้นักเตะเยาวชนลงรวม ≥ ${rep >= 65 ? 400 : 700} นาที`,
    target: rep >= 65 ? 400 : 700,
    current: 0,
    rewardXp: 28,
    status: 'active',
    tier: 'stretch',
  })

  quests.push({
    id: qid('style', season),
    clubId: club.id,
    season,
    kind: 'style',
    title: `อัตลักษณ์สโมสร (${preferredStyle})`,
    body: `เล่นสไตล์ที่บอร์ดอยากเห็น: ${preferredStyle}`,
    target: 1,
    current: 0,
    rewardXp: 22,
    status: 'active',
    tier: 'stretch',
  })

  if (rep < 70) {
    quests.push({
      id: qid('finance_buffer', season),
      clubId: club.id,
      season,
      kind: 'finance_buffer',
      title: 'บัญชีไม่แดง',
      body: 'รักษาเงินคลับไม่ติดลบ',
      target: 0,
      current: club.balance,
      rewardXp: 20,
      status: 'active',
      tier: 'stretch',
    })
  }

  return quests
}

function sortedTable(table: GameSave['table']) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

/** อัปเดตความคืบหน้าเควส + จ่าย XP เมื่อครบ */
export function tickClubQuests(
  save: GameSave,
  matchHint?: { won: boolean; competition: string },
): GameSave {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  if (!club || save.board?.sacked || save.career?.unemployed) return save

  let quests = (save.clubQuests ?? []).filter(
    (q) => q.clubId === save.humanClubId && q.season === save.season,
  )
  if (quests.length === 0) {
    quests = createClubQuests(
      club,
      save.season,
      save.board?.preferredStyle ?? 'balanced',
    )
  }

  const useDiv2 = club.division === 2
  const table = sortedTable(useDiv2 ? save.tableDiv2 ?? save.table : save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1 || 20
  const points = table.find((r) => r.clubId === save.humanClubId)?.points ?? 0
  const youthMins = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .reduce((s, p) => s + p.minutesPlayed, 0)
  const styleOk =
    save.tacticsByClub[save.humanClubId]?.instructions.style ===
    (save.board?.preferredStyle ?? 'balanced')
      ? 1
      : 0

  let nextSave: GameSave = { ...save, clubQuests: quests }
  const updated: ClubQuest[] = []

  for (const q of quests) {
    if (q.status !== 'active') {
      updated.push(q)
      continue
    }
    let current = q.current
    let status: ClubQuest['status'] = q.status

    if (q.kind === 'league_rank' || q.kind === 'promotion_push') {
      current = rank
      if (rank > 0 && rank <= q.target && (save.seasonComplete || save.matchday >= 28)) {
        status = 'completed'
      }
    } else if (q.kind === 'avoid_bottom') {
      current = rank
      const bottom = table.length
      if (save.seasonComplete || save.matchday >= 28) {
        status =
          rank > 0 && rank <= bottom - q.target
            ? 'completed'
            : save.seasonComplete
              ? 'failed'
              : 'active'
      }
    } else if (q.kind === 'min_points') {
      current = points
      if (points >= q.target) status = 'completed'
    } else if (q.kind === 'youth_minutes') {
      current = youthMins
      if (youthMins >= q.target) status = 'completed'
    } else if (q.kind === 'style') {
      current = styleOk
      if (styleOk === 1 && save.matchday >= 8) status = 'completed'
    } else if (q.kind === 'finance_buffer') {
      current = club.balance
      if (club.balance >= q.target && save.matchday >= 10) status = 'completed'
    } else if (q.kind === 'cup_wins') {
      if (matchHint?.won && matchHint.competition === 'cup') {
        current = q.current + 1
      }
      if (current >= q.target) status = 'completed'
    } else if (q.kind === 'win_streak') {
      const recent = ensureManagerProgress(nextSave).recent
      let streak = 0
      for (const r of recent) {
        if (r === 'W') streak += 1
        else break
      }
      current = Math.max(q.current, streak)
      if (streak >= q.target) status = 'completed'
    }

    const row: ClubQuest = { ...q, current, status }
    updated.push(row)
    if (status === 'completed' && q.status === 'active') {
      nextSave = grantManagerQuestXp(nextSave, q.rewardXp, q.title)
      if (nextSave.board) {
        nextSave = {
          ...nextSave,
          board: {
            ...nextSave.board,
            confidence: Math.min(100, nextSave.board.confidence + (q.tier === 'core' ? 5 : 3)),
            lastNote: `เควสสำเร็จ: ${q.title}`,
          },
        }
      }
    }
  }

  return { ...nextSave, clubQuests: updated }
}

export function ensureClubQuests(save: GameSave): GameSave {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  if (!club) return save
  const existing = (save.clubQuests ?? []).filter(
    (q) => q.clubId === save.humanClubId && q.season === save.season,
  )
  if (existing.length > 0) return { ...save, clubQuests: save.clubQuests ?? existing }
  const quests = createClubQuests(
    club,
    save.season,
    save.board?.preferredStyle ?? 'balanced',
  )
  return { ...save, clubQuests: quests }
}
