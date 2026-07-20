/**
 * สไตล์เล่นของนักเตะ (สูงสุด 3 บทบาท · ระดับ 3/2/1)
 * 3 = ถนัดมาก · 2 = ใช้ได้ · 1 = เล่นได้แต่ไม่เก่ง
 * สร้างจากแอต + ส่วนสูง + FM (ถ้ามี) — ให้โค้ช AI จัดทีมได้ถูกคน
 */
import type { Player, PlayerAttributes, RoleCode } from './types'
import {
  DEFAULT_ROLE_FOR_SLOT,
  TACTICAL_ROLE_BY_ID,
  rolesForSlot,
  type TacticalRoleId,
} from './tacticalRoles'
import type { CoachStyleId, WorldCoach } from './worldCoaches'

export const MAX_PLAYER_TACTICAL_ROLES = 3

/** 3 = เก่งมาก · 2 = ปานกลาง · 1 = เล่นได้ */
export type TacticalStyleLevel = 3 | 2 | 1

export interface PlayerTacticalStyle {
  id: TacticalRoleId
  level: TacticalStyleLevel
  /** XP ภายในระดับปัจจุบัน (0–100 ถึงเลื่อน) */
  xp?: number
}

/** คำสั่งฝึกสไตล์จากผู้จัดการ */
export type StyleTrainOrder = 'ai' | 'lock' | TacticalRoleId

/** ชื่อบทบาทจาก FMInside → id ในเกม */
const FM_ROLE_MAP: Array<{ match: RegExp; id: TacticalRoleId }> = [
  { match: /sweeper\s*keeper/i, id: 'sweeper_keeper' },
  { match: /ball[- ]?playing\s*goalkeeper/i, id: 'sweeper_keeper' },
  {
    match: /no[- ]?nonsense\s*goalkeeper|line[- ]?holding\s*goalkeeper|^goalkeeper$/i,
    id: 'shot_stopper',
  },
  {
    match: /ball[- ]?playing\s*(centre|center)[- ]?back|ball[- ]?playing\s*defender/i,
    id: 'ball_playing_cb',
  },
  {
    match: /no[- ]?nonsense\s*(centre|center)[- ]?back|central\s*defender/i,
    id: 'no_nonsense_cb',
  },
  { match: /cover|libero/i, id: 'cover_cb' },
  { match: /inverted\s*(wing|full)[- ]?back/i, id: 'inverted_fb' },
  { match: /wing[- ]?back/i, id: 'wing_back' },
  { match: /full[- ]?back/i, id: 'full_back' },
  { match: /anchor|holding\s*mid|defensive\s*midfielder|dropping\s*defensive/i, id: 'anchor' },
  { match: /ball[- ]?winning|destroyer|screening\s*central/i, id: 'destroyer' },
  { match: /deep[- ]?lying\s*playmaker/i, id: 'dlp' },
  { match: /box[- ]?to[- ]?box/i, id: 'box_to_box' },
  { match: /mezzala/i, id: 'mezzala' },
  { match: /advanced\s*playmaker|midfield\s*playmaker/i, id: 'advanced_playmaker' },
  { match: /shadow\s*striker/i, id: 'shadow_striker' },
  { match: /inside\s*(forward|winger)/i, id: 'inside_forward' },
  {
    match: /playmaking\s*winger|wide\s*forward|wide\s*outlet|tracking\s*winger|^winger$/i,
    id: 'winger',
  },
  { match: /false\s*nine|false\s*9/i, id: 'false_nine' },
  { match: /complete\s*forward/i, id: 'complete_forward' },
  { match: /pressing\s*forward/i, id: 'pressing_forward' },
  { match: /target\s*(forward|man)/i, id: 'target_man' },
  { match: /poacher/i, id: 'poacher' },
  {
    match: /channel\s*forward|advanced\s*forward|centre\s*forward|splitting\s*outlet/i,
    id: 'advanced_forward',
  },
]

/** บทบาทที่โค้ชสไตล์นี้ชอบใช้ */
export const COACH_STYLE_ROLES: Record<CoachStyleId, TacticalRoleId[]> = {
  possession: [
    'sweeper_keeper',
    'ball_playing_cb',
    'inverted_fb',
    'dlp',
    'advanced_playmaker',
    'false_nine',
    'inside_forward',
  ],
  press: [
    'pressing_forward',
    'destroyer',
    'wing_back',
    'box_to_box',
    'inside_forward',
    'advanced_forward',
  ],
  counter: ['poacher', 'winger', 'wing_back', 'advanced_forward', 'cover_cb', 'anchor'],
  direct: [
    'target_man',
    'no_nonsense_cb',
    'full_back',
    'anchor',
    'advanced_forward',
    'winger',
  ],
  low_block: [
    'shot_stopper',
    'no_nonsense_cb',
    'cover_cb',
    'anchor',
    'destroyer',
    'full_back',
  ],
  balanced: [
    'ball_playing_cb',
    'full_back',
    'box_to_box',
    'advanced_playmaker',
    'inside_forward',
    'advanced_forward',
  ],
}

/** fit ในแมตช์ / จัด XI ตามระดับสไตล์ */
export const STYLE_LEVEL_FIT: Record<TacticalStyleLevel, number> = {
  3: 1,
  2: 0.84,
  1: 0.7,
}

function avg(attrs: PlayerAttributes, keys: (keyof PlayerAttributes)[]): number {
  if (keys.length === 0) return 50
  let s = 0
  for (const k of keys) s += attrs[k] ?? 50
  return s / keys.length
}

function mapFmRoleName(name: string): TacticalRoleId | null {
  const n = name.trim()
  for (const row of FM_ROLE_MAP) {
    if (row.match.test(n)) return row.id
  }
  return null
}

function playerHeightCm(
  player: Pick<Player, 'fmInside' | 'attrs'>,
): number | null {
  const h = player.fmInside?.heightCm
  if (typeof h === 'number' && h > 0) return h
  // ไม่มีข้อมูลส่วนสูง — ประมาณจาก jumping+strength (ตัวสูงโหม่งมักกระโดด+แข็ง)
  const a = player.attrs
  if (!a) return null
  if (a.jumping >= 82 && a.strength >= 78) return 192
  if (a.jumping >= 76 && a.strength >= 74) return 187
  if (a.pace >= 80 && a.agility >= 78 && a.strength <= 62) return 174
  return null
}

/** โบนัสจากรูปร่าง / ส่วนสูง — ทำให้สูง 190+ เป็นเป้าหมายโหม่งชัดขึ้น */
function physiqueBonus(
  roleId: TacticalRoleId,
  attrs: PlayerAttributes,
  heightCm: number | null,
): number {
  const h = heightCm
  const tall = h != null && h >= 190
  const quiteTall = h != null && h >= 185
  const short = h != null && h > 0 && h <= 175
  let bonus = 0

  switch (roleId) {
    case 'target_man':
      if (tall) bonus += 22
      else if (quiteTall) bonus += 12
      if (attrs.strength >= 75) bonus += 8
      if (attrs.heading >= 72) bonus += 8
      if (attrs.jumping >= 72) bonus += 5
      if (attrs.pace <= 62) bonus += 3 // ช้าแต่ใหญ่
      break
    case 'no_nonsense_cb':
      if (tall) bonus += 14
      else if (quiteTall) bonus += 7
      if (attrs.strength >= 75 && attrs.heading >= 70) bonus += 6
      break
    case 'cover_cb':
      if (attrs.pace >= 72 && (h == null || h < 188)) bonus += 6
      break
    case 'ball_playing_cb':
      if (attrs.passing >= 72 && attrs.vision >= 65) bonus += 8
      if (tall && attrs.passing < 60) bonus -= 6
      break
    case 'poacher':
      if (attrs.finishing >= 78 && attrs.pace >= 70) bonus += 8
      if (short) bonus += 4
      if (tall && attrs.pace < 68) bonus -= 10 // สูงช้า → ไม่ใช่ล่ากรอบ
      break
    case 'advanced_forward':
      if (attrs.pace >= 75 && attrs.finishing >= 72) bonus += 7
      break
    case 'pressing_forward':
      if (attrs.workRate >= 78 && attrs.stamina >= 75) bonus += 10
      break
    case 'false_nine':
      if (attrs.passing >= 75 && attrs.vision >= 72 && attrs.technique >= 72) bonus += 10
      if (tall && attrs.strength >= 80) bonus -= 8
      break
    case 'complete_forward':
      if (attrs.finishing >= 70 && attrs.passing >= 65 && attrs.strength >= 65) bonus += 6
      break
    case 'inside_forward':
      if (attrs.dribbling >= 75 && attrs.finishing >= 68 && attrs.pace >= 72) bonus += 9
      if (attrs.crossing >= 75 && attrs.dribbling < 70) bonus -= 5
      if (short) bonus += 3
      break
    case 'winger':
      if (attrs.crossing >= 72 && attrs.pace >= 74 && attrs.dribbling >= 70) bonus += 9
      if (attrs.finishing >= 78 && attrs.crossing < 65) bonus -= 4
      break
    case 'wing_back':
      if (attrs.stamina >= 78 && attrs.pace >= 72) bonus += 8
      break
    case 'full_back':
      if (attrs.tackling >= 70 && attrs.stamina >= 70) bonus += 5
      break
    case 'inverted_fb':
      if (attrs.passing >= 72 && attrs.vision >= 68) bonus += 8
      break
    case 'anchor':
      if (attrs.positioning >= 74 && attrs.tackling >= 72 && attrs.pace <= 72) bonus += 7
      break
    case 'destroyer':
      if (attrs.tackling >= 78 && attrs.strength >= 72) bonus += 9
      break
    case 'dlp':
      if (attrs.passing >= 78 && attrs.vision >= 75) bonus += 10
      break
    case 'box_to_box':
      if (attrs.stamina >= 80 && attrs.workRate >= 75) bonus += 10
      break
    case 'mezzala':
      if (attrs.dribbling >= 72 && attrs.finishing >= 65) bonus += 7
      break
    case 'advanced_playmaker':
      if (attrs.vision >= 78 && attrs.passing >= 75) bonus += 10
      break
    case 'shadow_striker':
      if (attrs.finishing >= 74 && attrs.pace >= 72 && attrs.positioning >= 70) bonus += 8
      break
    case 'sweeper_keeper':
      if (attrs.passing >= 65 && attrs.pace >= 60) bonus += 8
      break
    case 'shot_stopper':
      if (attrs.reflexes >= 75 && attrs.handling >= 72) bonus += 8
      if (tall) bonus += 4
      break
    default:
      break
  }
  return bonus
}

function roleGroupOf(r: RoleCode): 'gk' | 'df' | 'mf' | 'fw' {
  if (r === 'GK') return 'gk'
  if (r === 'CB' || r === 'LB' || r === 'RB') return 'df'
  if (r === 'CDM' || r === 'CM' || r === 'CAM' || r === 'LM' || r === 'RM') return 'mf'
  return 'fw'
}

/** คะแนนความเหมาะของบทบาทจากแอต + ส่วนสูง (0–130+) */
export function scoreTacticalRoleFromAttrs(
  roleId: TacticalRoleId,
  attrs: PlayerAttributes,
  naturalRole: RoleCode,
  heightCm: number | null = null,
): number {
  const def = TACTICAL_ROLE_BY_ID[roleId]
  if (!def) return 0

  const slotOk =
    def.slots.includes(naturalRole) ||
    def.slots.some((s) => {
      if (naturalRole === 'ST' && (s === 'SS' || s === 'CAM')) return true
      if (naturalRole === 'CAM' && (s === 'CM' || s === 'SS')) return true
      if (naturalRole === 'CM' && (s === 'CDM' || s === 'CAM')) return true
      if (naturalRole === 'CDM' && s === 'CM') return true
      if ((naturalRole === 'LW' || naturalRole === 'RW') && (s === 'LM' || s === 'RM' || s === 'ST'))
        return true
      if ((naturalRole === 'LM' || naturalRole === 'RM') && (s === 'LW' || s === 'RW')) return true
      return false
    })

  if (!slotOk && !def.slots.includes(naturalRole)) {
    const anyGroup = def.slots.some((s) => roleGroupOf(s) === roleGroupOf(naturalRole))
    if (!anyGroup) return 0
  }

  const a = attrs
  let base = 40
  switch (roleId) {
    case 'shot_stopper':
      base = avg(a, ['reflexes', 'handling', 'aerialReach', 'positioning', 'decision'])
      break
    case 'sweeper_keeper':
      base =
        avg(a, ['reflexes', 'passing', 'pace', 'decision', 'aerialReach']) * 0.55 +
        avg(a, ['passing', 'pace']) * 0.45
      break
    case 'no_nonsense_cb':
      base = avg(a, ['tackling', 'strength', 'heading', 'positioning', 'jumping'])
      break
    case 'ball_playing_cb':
      base = avg(a, ['passing', 'vision', 'composure', 'technique', 'decision'])
      break
    case 'cover_cb':
      base = avg(a, ['positioning', 'pace', 'decision', 'composure'])
      break
    case 'full_back':
      base = avg(a, ['stamina', 'crossing', 'tackling', 'pace', 'workRate'])
      break
    case 'wing_back':
      base = avg(a, ['pace', 'stamina', 'crossing', 'dribbling', 'workRate'])
      break
    case 'inverted_fb':
      base = avg(a, ['passing', 'vision', 'technique', 'dribbling', 'decision'])
      break
    case 'anchor':
      base = avg(a, ['positioning', 'tackling', 'decision', 'strength', 'composure'])
      break
    case 'destroyer':
      base = avg(a, ['tackling', 'strength', 'workRate', 'stamina', 'positioning'])
      break
    case 'dlp':
      base = avg(a, ['passing', 'vision', 'technique', 'composure', 'decision'])
      break
    case 'box_to_box':
      base = avg(a, ['stamina', 'workRate', 'passing', 'tackling', 'pace'])
      break
    case 'mezzala':
      base = avg(a, ['dribbling', 'finishing', 'vision', 'technique', 'pace'])
      break
    case 'advanced_playmaker':
      base = avg(a, ['vision', 'passing', 'technique', 'dribbling', 'composure'])
      break
    case 'shadow_striker':
      base = avg(a, ['finishing', 'pace', 'positioning', 'composure', 'dribbling'])
      break
    case 'winger':
      base = avg(a, ['pace', 'dribbling', 'crossing', 'technique', 'stamina'])
      break
    case 'inside_forward':
      base = avg(a, ['dribbling', 'finishing', 'pace', 'technique', 'composure'])
      break
    case 'advanced_forward':
      base = avg(a, ['pace', 'finishing', 'workRate', 'composure', 'dribbling'])
      break
    case 'poacher':
      base = avg(a, ['finishing', 'composure', 'positioning', 'pace', 'decision'])
      break
    case 'target_man':
      base = avg(a, ['strength', 'heading', 'jumping', 'finishing', 'composure'])
      break
    case 'pressing_forward':
      base = avg(a, ['workRate', 'stamina', 'pace', 'tackling', 'strength'])
      break
    case 'false_nine':
      base = avg(a, ['passing', 'vision', 'technique', 'dribbling', 'composure'])
      break
    case 'complete_forward':
      base = avg(a, ['finishing', 'dribbling', 'passing', 'strength', 'pace', 'workRate'])
      break
    default:
      base = 40
  }

  // ตำแหน่งตรงช่องได้โบนัสเล็กน้อย
  if (def.slots.includes(naturalRole)) base += 4

  return base + physiqueBonus(roleId, attrs, heightCm)
}

function candidatesForNaturalRole(natural: RoleCode): TacticalRoleId[] {
  const direct = rolesForSlot(natural).map((r) => r.id)
  const extra: TacticalRoleId[] = []
  if (natural === 'ST') extra.push('shadow_striker', 'false_nine', 'pressing_forward')
  if (natural === 'CAM') extra.push('shadow_striker', 'mezzala')
  if (natural === 'CM') extra.push('dlp', 'destroyer', 'advanced_playmaker')
  if (natural === 'CDM') extra.push('dlp', 'box_to_box')
  if (natural === 'LW' || natural === 'RW') extra.push('winger', 'advanced_forward')
  if (natural === 'LM' || natural === 'RM') extra.push('inside_forward', 'wing_back')
  if (natural === 'CB') extra.push('no_nonsense_cb', 'ball_playing_cb', 'cover_cb')
  return [...new Set([...direct, ...extra])]
}

/**
 * แปลงคะแนนดิบ → ระดับ 3/2/1 ตามอันดับในท็อป 3
 * อันดับ 1 = 3 (เก่งมาก) · อันดับ 2 = 2 · อันดับ 3 = 1 (เล่นได้)
 */
function levelsForRanked(rankedIds: TacticalRoleId[]): PlayerTacticalStyle[] {
  const levels: TacticalStyleLevel[] = [3, 2, 1]
  return rankedIds.slice(0, MAX_PLAYER_TACTICAL_ROLES).map((id, i) => ({
    id,
    level: levels[i] ?? 1,
    xp: 0,
  }))
}

export function isPlayerTacticalStyle(x: unknown): x is PlayerTacticalStyle {
  if (!x || typeof x !== 'object') return false
  const o = x as { id?: string; level?: number; xp?: number }
  return (
    typeof o.id === 'string' &&
    Boolean(TACTICAL_ROLE_BY_ID[o.id as TacticalRoleId]) &&
    (o.level === 3 || o.level === 2 || o.level === 1)
  )
}

export function normalizePlayerTacticalStyle(x: unknown): PlayerTacticalStyle | null {
  if (typeof x === 'string' && TACTICAL_ROLE_BY_ID[x as TacticalRoleId]) {
    return { id: x as TacticalRoleId, level: 2, xp: 0 }
  }
  if (!isPlayerTacticalStyle(x)) return null
  return {
    id: x.id,
    level: x.level,
    xp: typeof x.xp === 'number' ? Math.max(0, Math.min(100, Math.round(x.xp))) : 0,
  }
}

export function preferredStyleIds(
  styles: PlayerTacticalStyle[] | TacticalRoleId[] | null | undefined,
): TacticalRoleId[] {
  if (!styles?.length) return []
  if (typeof styles[0] === 'string') return (styles as TacticalRoleId[]).slice(0, 3)
  return (styles as PlayerTacticalStyle[]).map((s) => s.id)
}

export function styleLevelForRole(
  player: Pick<Player, 'preferredTacticalRoles'>,
  roleId: TacticalRoleId,
): TacticalStyleLevel | 0 {
  const styles = player.preferredTacticalRoles
  if (!styles?.length) return 0
  if (typeof styles[0] === 'string') {
    const idx = (styles as unknown as TacticalRoleId[]).indexOf(roleId)
    if (idx === 0) return 3
    if (idx === 1) return 2
    if (idx === 2) return 1
    return 0
  }
  const hit = (styles as PlayerTacticalStyle[]).find((s) => s.id === roleId)
  return hit?.level ?? 0
}

/**
 * สร้างสไตล์ถนัดสูงสุด 3 อัน (ระดับ 3/2/1) จากแอต + ส่วนสูง + FM
 */
export function buildPlayerTacticalRoles(
  player: Pick<Player, 'role' | 'attrs' | 'fmInside'>,
): PlayerTacticalStyle[] {
  const scored = new Map<TacticalRoleId, number>()
  const height = playerHeightCm(player)

  const bump = (id: TacticalRoleId, score: number) => {
    scored.set(id, Math.max(scored.get(id) ?? 0, score))
  }

  const fmRoles = [
    ...(player.fmInside?.bestRolesIn ?? []),
    ...(player.fmInside?.bestRolesOut ?? []),
  ]
  for (const row of fmRoles) {
    const id = mapFmRoleName(row.name)
    if (!id) continue
    bump(id, 72 + Math.min(22, row.score / 4))
  }

  for (const id of candidatesForNaturalRole(player.role)) {
    bump(id, scoreTacticalRoleFromAttrs(id, player.attrs, player.role, height))
  }

  // กองหน้าสูงมาก — ดัน target_man ให้ติดท็อป (รอโหม่ง)
  if (
    (player.role === 'ST' || player.role === 'SS') &&
    height != null &&
    height >= 190
  ) {
    const tm = scoreTacticalRoleFromAttrs('target_man', player.attrs, player.role, height)
    bump('target_man', Math.max(tm, 95))
  }

  // เซ็นเตอร์สูง+แข็ง → no-nonsense
  if (player.role === 'CB' && height != null && height >= 190) {
    bump(
      'no_nonsense_cb',
      Math.max(
        scoreTacticalRoleFromAttrs('no_nonsense_cb', player.attrs, player.role, height),
        90,
      ),
    )
  }

  if (scored.size === 0) {
    bump(DEFAULT_ROLE_FOR_SLOT[player.role], 60)
  }

  const ranked = [...scored.entries()].sort((a, b) => b[1] - a[1])
  const picked: TacticalRoleId[] = []
  const duties = new Set<string>()

  for (const [id, score] of ranked) {
    if (picked.length >= MAX_PLAYER_TACTICAL_ROLES) break
    if (picked.includes(id)) continue
    const top = ranked[0]?.[1] ?? 0
    if (picked.length >= 1 && top - score > 35 && picked.length >= 2) continue
    const duty = TACTICAL_ROLE_BY_ID[id]?.duty ?? 'support'
    if (picked.length >= 2 && duties.has(duty) && top - score < 6) continue
    picked.push(id)
    duties.add(duty)
  }

  for (const [id] of ranked) {
    if (picked.length >= MAX_PLAYER_TACTICAL_ROLES) break
    if (!picked.includes(id)) picked.push(id)
  }

  return levelsForRanked(picked)
}

/** เติมสไตล์ถ้ายังไม่มี — รักษา XP / ระดับที่มีอยู่แล้ว */
export function ensurePlayerTacticalRoles(player: Player): Player {
  const normalized = (player.preferredTacticalRoles ?? [])
    .map(normalizePlayerTacticalStyle)
    .filter((x): x is PlayerTacticalStyle => Boolean(x))
    .slice(0, MAX_PLAYER_TACTICAL_ROLES)

  const base: Player = {
    ...player,
    preferredTacticalRoles:
      normalized.length > 0 ? normalized : buildPlayerTacticalRoles(player),
    styleTrainOrder: player.styleTrainOrder ?? 'ai',
    styleTrainTarget: player.styleTrainTarget ?? null,
    styleTrainProgress:
      typeof player.styleTrainProgress === 'number'
        ? Math.max(0, Math.min(100, Math.round(player.styleTrainProgress)))
        : 0,
    styleDisliked: Array.isArray(player.styleDisliked)
      ? player.styleDisliked.filter((id) => Boolean(TACTICAL_ROLE_BY_ID[id]))
      : [],
    styleMismatchStreak:
      typeof player.styleMismatchStreak === 'number'
        ? Math.max(0, Math.round(player.styleMismatchStreak))
        : 0,
  }
  return base
}

/** บังคับคำนวณสไตล์ใหม่จากแอต (ล้าง XP ของชุดเดิม) */
export function refreshPlayerTacticalRoles(player: Player): Player {
  return ensurePlayerTacticalRoles({
    ...player,
    preferredTacticalRoles: buildPlayerTacticalRoles(player),
  })
}

/** ความเข้ากันของสไตล์นักเตะกับบทบาทช่อง (0–1) — ระดับ 3 สูงสุด */
export function playerSlotRoleFit(
  player: Pick<Player, 'preferredTacticalRoles' | 'role'>,
  slotRoleId: TacticalRoleId | null | undefined,
): number {
  if (!slotRoleId) return 0.85
  const level = styleLevelForRole(player, slotRoleId)
  if (level === 3 || level === 2 || level === 1) return STYLE_LEVEL_FIT[level]

  const prefs = preferredStyleIds(player.preferredTacticalRoles)
  if (prefs.length === 0) return 0.85
  const slotDef = TACTICAL_ROLE_BY_ID[slotRoleId]
  if (!slotDef) return 0.62
  for (const pref of prefs) {
    const pDef = TACTICAL_ROLE_BY_ID[pref]
    if (!pDef) continue
    if (pDef.duty === slotDef.duty && pDef.slots.some((s) => slotDef.slots.includes(s))) {
      return 0.74
    }
  }
  return 0.62
}

/** ความเข้ากันกับสไตล์โค้ช (0–1) */
export function playerCoachStyleFit(
  player: Pick<Player, 'preferredTacticalRoles'>,
  coach: WorldCoach | null | undefined,
): number {
  if (!coach) return 0.85
  const liked = COACH_STYLE_ROLES[coach.style] ?? []
  if (liked.length === 0) return 0.85
  let best = 0.7
  for (const id of liked) {
    const level = styleLevelForRole(player, id)
    if (level === 3) best = Math.max(best, 1)
    else if (level === 2) best = Math.max(best, 0.92)
    else if (level === 1) best = Math.max(best, 0.84)
  }
  return best
}

/**
 * เลือกบทบาทช่องจากสไตล์ถนัด (ระดับสูงก่อน) · ถ้าโค้ชมีสไตล์ — ชอบที่โค้ชชอบด้วย
 */
export function pickSlotRoleForPlayer(
  player: Pick<Player, 'preferredTacticalRoles' | 'role' | 'attrs' | 'fmInside'>,
  slot: RoleCode,
  coach?: WorldCoach | null,
): TacticalRoleId {
  const allowed = new Set(rolesForSlot(slot).map((r) => r.id))
  const styles = (ensurePlayerTacticalRoles(player as Player).preferredTacticalRoles ??
    []) as PlayerTacticalStyle[]
  const prefs = styles.filter((s) => allowed.has(s.id)).sort((a, b) => b.level - a.level)
  const liked = coach ? new Set(COACH_STYLE_ROLES[coach.style] ?? []) : null

  if (prefs.length > 0) {
    if (liked) {
      const coachHit = prefs.find((s) => liked.has(s.id))
      if (coachHit) return coachHit.id
    }
    return prefs[0]!.id
  }

  const height = playerHeightCm(player)
  let best: TacticalRoleId = DEFAULT_ROLE_FOR_SLOT[slot]
  let bestScore = -1
  for (const def of rolesForSlot(slot)) {
    let s = scoreTacticalRoleFromAttrs(def.id, player.attrs, player.role, height)
    if (liked?.has(def.id)) s += 8
    if (s > bestScore) {
      bestScore = s
      best = def.id
    }
  }
  return best
}

/** คะแนนจัด XI: OVR × พร้อม × ตำแหน่ง × สไตล์ช่อง × สไตล์โค้ช */
export function xiPickScore(
  player: Player,
  slot: RoleCode,
  slotRoleId: TacticalRoleId | undefined,
  coach?: WorldCoach | null,
): number {
  const ready =
    (player.condition / 100) * (player.sharpness / 100) * ((player.form ?? 10) / 12)
  let posFit = 0.72
  if (player.role === slot) posFit = 1
  else if (roleGroupOf(player.role) === roleGroupOf(slot)) posFit = 0.88

  const roleId = slotRoleId ?? pickSlotRoleForPlayer(player, slot, coach)
  const styleFit = playerSlotRoleFit(player, roleId)
  const coachFit = playerCoachStyleFit(player, coach)

  return player.overall * ready * posFit * (0.68 + 0.32 * styleFit) * (0.8 + 0.2 * coachFit)
}

export function formatStyleLevelStars(level: TacticalStyleLevel): string {
  if (level === 3) return '★★★'
  if (level === 2) return '★★'
  return '★'
}
