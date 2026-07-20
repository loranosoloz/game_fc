/**
 * ฝึกสไตล์เล่น — AI เลือกเป้า · สะสม XP · เลื่อนดาว · แทนที่ชุด 3 อัน
 */
import type { GameSave, Player } from './types'
import {
  COACH_STYLE_ROLES,
  MAX_PLAYER_TACTICAL_ROLES,
  ensurePlayerTacticalRoles,
  scoreTacticalRoleFromAttrs,
  type PlayerTacticalStyle,
  type StyleTrainOrder,
  type TacticalStyleLevel,
} from './playerTacticalRoles'
import {
  TACTICAL_ROLE_BY_ID,
  rolesForSlot,
  tacticalRoleLabel,
  type TacticalRoleId,
} from './tacticalRoles'
import { getWorldCoach, type WorldCoach } from './worldCoaches'
import { activateWantAway } from './wantAway'
import { bumpClubLoyalty } from './playerLoyalty'

/** XP ต่อแมตช์เดย์ซ้อม (ก่อนคูณ intensity) */
const BASE_XP = 18
/** ถึง 100 = เลื่อนระดับ หรือปลดล็อกเข้าชุด */
export const STYLE_XP_CAP = 100

export interface StyleTrainEvent {
  playerId: string
  playerName: string
  kind: 'level_up' | 'unlocked' | 'swapped' | 'target_set'
  styleId: TacticalRoleId
  level?: TacticalStyleLevel
  noteTh: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function hashPick(seed: string, n: number): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return Math.abs(h) % Math.max(1, n)
}

export function styleTrainOrderLabel(order: StyleTrainOrder | null | undefined): string {
  if (!order || order === 'ai') return 'AI เลือก'
  if (order === 'lock') return 'ล็อกเป้า'
  return `บังคับ: ${tacticalRoleLabel(order)}`
}

/** สไตล์ที่ฝึกได้จากตำแหน่งธรรมชาติ */
export function trainableStylesForPlayer(player: Pick<Player, 'role'>): TacticalRoleId[] {
  const direct = rolesForSlot(player.role).map((r) => r.id)
  const extra: TacticalRoleId[] = []
  if (player.role === 'ST') extra.push('shadow_striker', 'false_nine', 'pressing_forward')
  if (player.role === 'CAM') extra.push('shadow_striker', 'mezzala', 'box_to_box')
  if (player.role === 'CM') extra.push('dlp', 'destroyer', 'advanced_playmaker', 'mezzala')
  if (player.role === 'CDM') extra.push('dlp', 'box_to_box', 'destroyer')
  if (player.role === 'LW' || player.role === 'RW') extra.push('winger', 'advanced_forward')
  if (player.role === 'LM' || player.role === 'RM') extra.push('inside_forward', 'wing_back')
  if (player.role === 'CB') extra.push('no_nonsense_cb', 'ball_playing_cb', 'cover_cb')
  if (player.role === 'LB' || player.role === 'RB')
    extra.push('full_back', 'wing_back', 'inverted_fb')
  return [...new Set([...direct, ...extra])]
}

/**
 * AI เลือกเป้าฝึก — โค้ช / แอต / ambition / dislike / ยังไม่ ★★★
 */
export function pickAiStyleTarget(
  player: Player,
  coach: WorldCoach | null | undefined,
  matchday = 0,
): TacticalRoleId {
  const p = ensurePlayerTacticalRoles(player)
  const disliked = new Set(p.styleDisliked ?? [])
  const styles = (p.preferredTacticalRoles ?? []) as PlayerTacticalStyle[]
  const pool = trainableStylesForPlayer(p).filter((id) => !disliked.has(id))
  if (pool.length === 0) return styles[0]?.id ?? rolesForSlot(p.role)[0]!.id

  const liked = new Set(coach ? COACH_STYLE_ROLES[coach.style] ?? [] : [])
  const amb = p.growth?.ambition ?? 10
  const happy = p.happiness ?? p.morale ?? 12

  type Cand = { id: TacticalRoleId; score: number }
  const cands: Cand[] = []

  for (const id of pool) {
    let score = scoreTacticalRoleFromAttrs(id, p.attrs, p.role, p.fmInside?.heightCm ?? null)
    if (liked.has(id)) score += 14
    const owned = styles.find((s) => s.id === id)
    if (owned) {
      if (owned.level >= 3) score -= 25 // มี ★★★ แล้ว — หันไปฝึกอย่างอื่น
      else score += 8 + (3 - owned.level) * 6 // อยากเลื่อนดาว
    } else {
      score += 10 // สไตล์ใหม่น่าสนใจ
    }
    if (amb >= 14 && TACTICAL_ROLE_BY_ID[id]?.duty === 'attack') score += 8
    if (happy <= 9) score += 5 // ไม่สุข — อยากเปลี่ยนมากขึ้น
    // จิตรถัง: สุ่มเบาๆ ตามแมตช์เดย์
    score += hashPick(`${p.id}:${id}:${matchday}`, 7)
    cands.push({ id, score })
  }

  cands.sort((a, b) => b.score - a.score)
  return cands[0]!.id
}

function resolveTrainTarget(player: Player, coach: WorldCoach | null | undefined, matchday: number) {
  const p = ensurePlayerTacticalRoles(player)
  const order = p.styleTrainOrder ?? 'ai'
  if (order === 'lock') {
    return p.styleTrainTarget ?? pickAiStyleTarget(p, coach, matchday)
  }
  if (order !== 'ai' && TACTICAL_ROLE_BY_ID[order as TacticalRoleId]) {
    return order as TacticalRoleId
  }
  // ai — เปลี่ยนเป้าเป็นระยะถ้ายังไม่มี หรือครบแล้ว
  if (p.styleTrainTarget && (p.styleTrainProgress ?? 0) < 100) {
    const owned = (p.preferredTacticalRoles ?? []).find((s) => s.id === p.styleTrainTarget)
    if (!owned || (owned.level ?? 1) < 3) return p.styleTrainTarget
  }
  return pickAiStyleTarget(p, coach, matchday)
}

function replaceWeakestStyle(
  styles: PlayerTacticalStyle[],
  incoming: PlayerTacticalStyle,
  disliked: TacticalRoleId[],
): { styles: PlayerTacticalStyle[]; dropped: TacticalRoleId | null } {
  if (styles.some((s) => s.id === incoming.id)) {
    return {
      styles: styles.map((s) => (s.id === incoming.id ? { ...s, ...incoming } : s)),
      dropped: null,
    }
  }
  if (styles.length < MAX_PLAYER_TACTICAL_ROLES) {
    return { styles: [...styles, incoming].slice(0, MAX_PLAYER_TACTICAL_ROLES), dropped: null }
  }
  // แทนที่ disliked ก่อน · แล้ว level ต่ำสุด · xp ต่ำ
  let dropIdx = styles.findIndex((s) => disliked.includes(s.id))
  if (dropIdx < 0) {
    dropIdx = 0
    for (let i = 1; i < styles.length; i++) {
      const a = styles[i]!
      const b = styles[dropIdx]!
      if (a.level < b.level || (a.level === b.level && (a.xp ?? 0) < (b.xp ?? 0))) dropIdx = i
    }
  }
  const dropped = styles[dropIdx]!.id
  const next = styles.slice()
  next[dropIdx] = incoming
  return { styles: next, dropped }
}

/**
 * เติม XP สไตล์หลังซ้อมหนึ่งรอบ
 */
export function progressStyleTraining(
  player: Player,
  opts: {
    intensity: 'low' | 'medium' | 'high'
    coach?: WorldCoach | null
    matchday?: number
    /** คูณ XP (AI ทีม = ช้ากว่า) */
    xpMul?: number
  },
): { player: Player; events: StyleTrainEvent[] } {
  let p = ensurePlayerTacticalRoles(player)
  if (p.injuryDays > 0 || (p.illnessDays ?? 0) > 0) {
    return { player: p, events: [] }
  }

  const events: StyleTrainEvent[] = []
  const coach = opts.coach
  const md = opts.matchday ?? 0
  const target = resolveTrainTarget(p, coach, md)
  const intensityMul = opts.intensity === 'high' ? 1.35 : opts.intensity === 'low' ? 0.7 : 1
  const gain = Math.round(BASE_XP * intensityMul * (opts.xpMul ?? 1))

  const prevTarget = p.styleTrainTarget
  p = {
    ...p,
    styleTrainTarget: target,
    styleTrainProgress: p.styleTrainProgress ?? 0,
  }
  if (prevTarget !== target) {
    events.push({
      playerId: p.id,
      playerName: p.name,
      kind: 'target_set',
      styleId: target,
      noteTh: `${p.name} ตั้งเป้าฝึก「${tacticalRoleLabel(target)}」`,
    })
    // เปลี่ยนเป้า — รีเซ็ต progress ของคิวปลดล็อกถ้าเป็นสไตล์ใหม่
    if (!(p.preferredTacticalRoles ?? []).some((s) => s.id === target)) {
      p = { ...p, styleTrainProgress: 0 }
    }
  }

  const styles = [...((p.preferredTacticalRoles ?? []) as PlayerTacticalStyle[])]
  const idx = styles.findIndex((s) => s.id === target)

  if (idx >= 0) {
    // มีในชุดแล้ว — เลื่อนดาว
    let s = { ...styles[idx]!, xp: styles[idx]!.xp ?? 0 }
    if (s.level >= 3) {
      // ★★★ แล้ว — เลือกเป้าใหม่รอบหน้า
      p = { ...p, styleTrainTarget: pickAiStyleTarget({ ...p, styleTrainTarget: null }, coach, md + 1) }
      return { player: { ...p, preferredTacticalRoles: styles }, events }
    }
    s.xp = (s.xp ?? 0) + gain
    if (s.xp >= STYLE_XP_CAP) {
      const nextLevel = Math.min(3, s.level + 1) as TacticalStyleLevel
      s = { ...s, level: nextLevel, xp: 0 }
      events.push({
        playerId: p.id,
        playerName: p.name,
        kind: 'level_up',
        styleId: target,
        level: nextLevel,
        noteTh: `${p.name} เลื่อน「${tacticalRoleLabel(target)}」เป็น ${'★'.repeat(nextLevel)}`,
      })
    }
    styles[idx] = s
    p = { ...p, preferredTacticalRoles: styles }
  } else {
    // สไตล์ใหม่ — สะสม progress แล้วปลดล็อกเข้าชุดที่ ★
    let prog = (p.styleTrainProgress ?? 0) + gain
    if (prog >= STYLE_XP_CAP) {
      const incoming: PlayerTacticalStyle = { id: target, level: 1, xp: 0 }
      const { styles: nextStyles, dropped } = replaceWeakestStyle(
        styles,
        incoming,
        p.styleDisliked ?? [],
      )
      events.push({
        playerId: p.id,
        playerName: p.name,
        kind: 'unlocked',
        styleId: target,
        level: 1,
        noteTh: `${p.name} ปลดล็อกสไตล์「${tacticalRoleLabel(target)}」★${
          dropped ? ` · แทนที่ ${tacticalRoleLabel(dropped)}` : ''
        }`,
      })
      if (dropped) {
        events.push({
          playerId: p.id,
          playerName: p.name,
          kind: 'swapped',
          styleId: dropped,
          noteTh: `${p.name} เลิกใช้สไตล์「${tacticalRoleLabel(dropped)}」ในชุดถนัด`,
        })
      }
      // เอาออกจาก disliked ถ้าเคยไม่ชอบแล้วกลับมาฝึก
      const disliked = (p.styleDisliked ?? []).filter((id) => id !== target)
      p = {
        ...p,
        preferredTacticalRoles: nextStyles,
        styleTrainProgress: 0,
        styleDisliked: disliked,
        styleTrainTarget: target, // ต่อยอดเลื่อนดาว
      }
    } else {
      p = { ...p, styleTrainProgress: prog, preferredTacticalRoles: styles }
    }
  }

  return { player: p, events }
}

/** ซ้อมทั้งสควอด — คืน players + events */
export function progressSquadStyleTraining(
  players: Player[],
  clubId: string,
  opts: {
    intensity: 'low' | 'medium' | 'high'
    coach?: WorldCoach | null
    matchday?: number
    xpMul?: number
    /** จำกัดจำนวน (AI sample) */
    maxPlayers?: number
  },
): { players: Player[]; events: StyleTrainEvent[] } {
  const pool = players.filter(
    (p) =>
      p.clubId === clubId &&
      p.injuryDays <= 0 &&
      (p.illnessDays ?? 0) <= 0 &&
      (p.leaveDays ?? 0) <= 0,
  )
  const sorted = pool.slice().sort((a, b) => b.overall - a.overall)
  const take = opts.maxPlayers != null ? sorted.slice(0, opts.maxPlayers) : sorted
  const takeIds = new Set(take.map((p) => p.id))
  const events: StyleTrainEvent[] = []
  const next = players.map((p) => {
    if (!takeIds.has(p.id)) return ensurePlayerTacticalRoles(p)
    const r = progressStyleTraining(p, opts)
    events.push(...r.events)
    return r.player
  })
  return { players: next, events }
}

/**
 * Tick ทีม AI เบาๆ + human ที่ยังไม่ได้ซ้อมสไตล์ในรอบ (เรียกหลัง training week)
 */
export function tickStyleTrainingForSave(
  save: GameSave,
  opts?: { humanAlreadyTrained?: boolean },
): { save: GameSave; events: StyleTrainEvent[] } {
  let players = save.players
  const allEvents: StyleTrainEvent[] = []
  const intensity = save.training?.intensity ?? 'medium'

  for (const club of save.clubs) {
    const coach = getWorldCoach(club.coachId)
    const isHuman = club.id === save.humanClubId
    if (isHuman && opts?.humanAlreadyTrained) continue
    const r = progressSquadStyleTraining(players, club.id, {
      intensity: isHuman ? intensity : 'medium',
      coach,
      matchday: save.matchday,
      xpMul: isHuman ? 1 : 0.55,
      maxPlayers: isHuman ? undefined : 8,
    })
    players = r.players
    if (isHuman) allEvents.push(...r.events)
    else allEvents.push(...r.events.filter((e) => e.kind === 'level_up' || e.kind === 'unlocked').slice(0, 2))
  }

  return { save: { ...save, players }, events: allEvents }
}

/**
 * ความสุขจากบทบาทช่องหลังแมตช์ + wantAway ถ้า mismatch นาน
 */
export function tickStyleSlotMood(save: GameSave): GameSave {
  const humanId = save.humanClubId
  let players = save.players.map((raw) => {
    const p = ensurePlayerTacticalRoles(raw)
    const tac = save.tacticsByClub[p.clubId]
    if (!tac?.startingXi.includes(p.id)) {
      return { ...p, styleMismatchStreak: Math.max(0, (p.styleMismatchStreak ?? 0) - 1) }
    }
    const idx = tac.startingXi.indexOf(p.id)
    const slotRole = tac.slotRoles?.[idx]
    if (!slotRole) return p

    const styles = (p.preferredTacticalRoles ?? []) as PlayerTacticalStyle[]
    const hit = styles.find((s) => s.id === slotRole)
    const disliked = (p.styleDisliked ?? []).includes(slotRole)
    let happiness = p.happiness ?? p.morale ?? 12
    let morale = p.morale
    let streak = p.styleMismatchStreak ?? 0

    if (hit) {
      if (hit.level >= 3) {
        happiness = clamp(happiness + 1, 1, 20)
        morale = clamp(morale + 1, 1, 20)
      }
      streak = 0
    } else if (disliked) {
      happiness = clamp(happiness - 2, 1, 20)
      morale = clamp(morale - 1, 1, 20)
      streak += 1
    } else {
      happiness = clamp(happiness - 1, 1, 20)
      streak += 1
    }

    let next: Player = {
      ...p,
      happiness,
      morale,
      styleMismatchStreak: streak,
    }

    if (streak >= 4 && p.clubId === humanId && !hit) {
      const dislikedNext = [...new Set([...(p.styleDisliked ?? []), slotRole])].slice(0, 4)
      next = bumpClubLoyalty({ ...next, styleDisliked: dislikedNext }, -1)
      if (streak >= 5 && Math.random() < 0.4) {
        next = activateWantAway(
          next,
          save.matchday,
          `ไม่ชอบถูกบังคับเล่นแบบ「${tacticalRoleLabel(slotRole)}」`,
          3,
        )
      }
    }

    return next
  })

  return { ...save, players }
}

export function setPlayerStyleTrainOrder(
  player: Player,
  order: StyleTrainOrder,
): Player {
  const p = ensurePlayerTacticalRoles(player)
  if (order === 'ai' || order === 'lock') {
    return { ...p, styleTrainOrder: order }
  }
  if (!TACTICAL_ROLE_BY_ID[order]) return p
  return {
    ...p,
    styleTrainOrder: order,
    styleTrainTarget: order,
    styleTrainProgress: (p.preferredTacticalRoles ?? []).some((s) => s.id === order)
      ? p.styleTrainProgress ?? 0
      : 0,
  }
}

/** ตกลงคำขอฝึกสไตล์จาก talks */
export function applyStyleTrainRequestAgree(
  player: Player,
  styleId: TacticalRoleId,
): Player {
  if (!TACTICAL_ROLE_BY_ID[styleId]) return player
  return setPlayerStyleTrainOrder(ensurePlayerTacticalRoles(player), styleId)
}

/** ตกลงเลิกสไตล์ — ใส่ disliked + เปลี่ยนเป้า */
export function applyStyleDropRequestAgree(
  player: Player,
  styleId: TacticalRoleId,
  coach?: WorldCoach | null,
): Player {
  let p = ensurePlayerTacticalRoles(player)
  const disliked = [...new Set([...(p.styleDisliked ?? []), styleId])].slice(0, 5)
  let styles = ((p.preferredTacticalRoles ?? []) as PlayerTacticalStyle[]).filter(
    (s) => s.id !== styleId,
  )
  // ถ้าเหลือไม่ครบ — ไม่บังคับเติมทันที
  p = {
    ...p,
    styleDisliked: disliked,
    preferredTacticalRoles: styles.length > 0 ? styles : p.preferredTacticalRoles,
    styleTrainTarget:
      p.styleTrainTarget === styleId ? pickAiStyleTarget({ ...p, styleDisliked: disliked }, coach, 0) : p.styleTrainTarget,
    styleTrainOrder: p.styleTrainOrder === styleId ? 'ai' : p.styleTrainOrder,
  }
  return ensurePlayerTacticalRoles(p)
}
