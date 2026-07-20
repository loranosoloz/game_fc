/**
 * ลงทะเบียนนักเตะลีก / UCL — กำหนดเบอร์เสื้อ · หมุดปฏิทิน · บล็อกเดินหน้าถ้าไม่ส่งตามกำหนด
 * ไม่มีโควตาสัญชาติ / home-grown
 */
import type { CompetitionKind, GameSave, InboxMessage, Player } from './types'
import { addDays } from './calendarDates'
import { roleGroup } from './positions'

export type SquadRegListKind = 'league' | 'ucl'

export interface SquadRegList {
  kind: SquadRegListKind
  season: number
  /** playerId → เบอร์เสื้อ 1–99 */
  numbers: Record<string, number>
  submitted: boolean
  submittedDate?: string
  deadlineDate: string
  deadlineMatchday: number
  maxPlayers: number
}

export interface ClubSquadRegistration {
  league: SquadRegList
  /** null = ทีมนี้ไม่ได้เล่น UCL ฤดูกาลนี้ */
  ucl: SquadRegList | null
}

export interface CalendarRegPin {
  id: string
  date: string
  matchday: number
  kind: 'squad_reg_league' | 'squad_reg_ucl'
  labelTh: string
}

export interface SquadRegistrationState {
  season: number
  byClub: Record<string, ClubSquadRegistration>
  pins: CalendarRegPin[]
  /** เตือน inbox ล่าสุด (กันซ้ำ) */
  lastRemindKey?: string
}

export const REG_MAX_PLAYERS = 25

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

export function clubInCompetition(
  save: GameSave,
  clubId: string,
  competition: CompetitionKind,
): boolean {
  return save.fixtures.some(
    (f) =>
      f.competition === competition &&
      (f.homeClubId === clubId || f.awayClubId === clubId),
  )
}

function firstFixtureFor(
  save: GameSave,
  clubId: string,
  competition: CompetitionKind,
): { date: string; matchday: number } | null {
  const list = save.fixtures
    .filter(
      (f) =>
        f.competition === competition &&
        (f.homeClubId === clubId || f.awayClubId === clubId),
    )
    .sort((a, b) => a.date.localeCompare(b.date) || a.matchday - b.matchday)
  const f = list[0]
  if (!f) return null
  return { date: f.date, matchday: f.matchday }
}

/** เดดไลน์ = 1 วันก่อนนัดแรก (ไม่ให้เลยวันนัด) */
function deadlineFromFirst(first: { date: string; matchday: number }, fallbackDate: string) {
  const deadlineDate = addDays(first.date, -1)
  return {
    deadlineDate: deadlineDate < fallbackDate ? fallbackDate : deadlineDate,
    deadlineMatchday: Math.max(0, first.matchday),
  }
}

function clubSquadPool(save: GameSave, clubId: string): Player[] {
  return save.players.filter((p) => p.clubId === clubId && !p.isYouth)
}

function preferredShirt(p: Player): number {
  const g = roleGroup(p.role)
  if (g === 'GK') return 1
  if (p.role === 'RB') return 2
  if (p.role === 'CB') return 4
  if (p.role === 'LB') return 3
  if (p.role === 'CDM') return 6
  if (p.role === 'CM') return 8
  if (p.role === 'CAM') return 10
  if (p.role === 'RM' || p.role === 'RW') return 7
  if (p.role === 'LM' || p.role === 'LW') return 11
  if (p.role === 'ST' || p.role === 'SS') return 9
  return 14
}

/** จัดเบอร์ไม่ซ้ำให้รายชื่อ */
export function assignShirtNumbers(
  players: Player[],
  existing?: Record<string, number>,
): Record<string, number> {
  const used = new Set<number>()
  const out: Record<string, number> = {}
  const sorted = [...players].sort((a, b) => b.overall - a.overall)

  for (const p of sorted) {
    const keep = existing?.[p.id]
    if (keep != null && keep >= 1 && keep <= 99 && !used.has(keep)) {
      out[p.id] = keep
      used.add(keep)
    }
  }

  for (const p of sorted) {
    if (out[p.id] != null) continue
    let n = preferredShirt(p)
    if (used.has(n)) {
      n = p.shirtNumber && !used.has(p.shirtNumber) ? p.shirtNumber : n
    }
    let guard = 0
    while (used.has(n) && guard < 100) {
      n = n >= 99 ? 1 : n + 1
      guard++
    }
    if (!used.has(n)) {
      out[p.id] = n
      used.add(n)
    }
  }
  return out
}

export function pickDefaultRegSquad(save: GameSave, clubId: string): Player[] {
  const pool = clubSquadPool(save, clubId).sort((a, b) => b.overall - a.overall)
  const gks = pool.filter((p) => roleGroup(p.role) === 'GK')
  const out: Player[] = []
  const seen = new Set<string>()
  for (const gk of gks.slice(0, 3)) {
    out.push(gk)
    seen.add(gk.id)
  }
  for (const p of pool) {
    if (out.length >= REG_MAX_PLAYERS) break
    if (seen.has(p.id)) continue
    out.push(p)
    seen.add(p.id)
  }
  return out
}

function emptyList(
  kind: SquadRegListKind,
  season: number,
  deadlineDate: string,
  deadlineMatchday: number,
): SquadRegList {
  return {
    kind,
    season,
    numbers: {},
    submitted: false,
    deadlineDate,
    deadlineMatchday,
    maxPlayers: REG_MAX_PLAYERS,
  }
}

function buildClubReg(save: GameSave, clubId: string): ClubSquadRegistration {
  const leagueFirst = firstFixtureFor(save, clubId, 'league')
  const leagueDl = leagueFirst
    ? deadlineFromFirst(leagueFirst, save.currentDate)
    : { deadlineDate: save.currentDate, deadlineMatchday: 1 }

  const league = emptyList('league', save.season, leagueDl.deadlineDate, leagueDl.deadlineMatchday)
  const draft = pickDefaultRegSquad(save, clubId)
  league.numbers = assignShirtNumbers(draft)

  let ucl: SquadRegList | null = null
  if (clubInCompetition(save, clubId, 'ucl')) {
    const uclFirst = firstFixtureFor(save, clubId, 'ucl')
    const uclDl = uclFirst
      ? deadlineFromFirst(uclFirst, save.currentDate)
      : { deadlineDate: save.currentDate, deadlineMatchday: leagueDl.deadlineMatchday }
    ucl = emptyList('ucl', save.season, uclDl.deadlineDate, uclDl.deadlineMatchday)
    ucl.numbers = assignShirtNumbers(draft, league.numbers)
  }

  return { league, ucl }
}

function buildPins(save: GameSave, human: ClubSquadRegistration): CalendarRegPin[] {
  const pins: CalendarRegPin[] = [
    {
      id: `pin-reg-league-${save.season}`,
      date: human.league.deadlineDate,
      matchday: human.league.deadlineMatchday,
      kind: 'squad_reg_league',
      labelTh: 'กำหนดส่งทะเบียนลีก',
    },
  ]
  if (human.ucl) {
    pins.push({
      id: `pin-reg-ucl-${save.season}`,
      date: human.ucl.deadlineDate,
      matchday: human.ucl.deadlineMatchday,
      kind: 'squad_reg_ucl',
      labelTh: 'กำหนดส่งทะเบียน UCL',
    })
  }
  return pins
}

function autoSubmitClub(
  save: GameSave,
  clubId: string,
  reg: ClubSquadRegistration,
): ClubSquadRegistration {
  const draft = pickDefaultRegSquad(save, clubId)
  const leagueNums = assignShirtNumbers(draft, reg.league.numbers)
  const league: SquadRegList = {
    ...reg.league,
    numbers: leagueNums,
    submitted: true,
    submittedDate: save.currentDate,
  }
  let ucl = reg.ucl
  if (ucl) {
    ucl = {
      ...ucl,
      numbers: assignShirtNumbers(draft, { ...leagueNums, ...ucl.numbers }),
      submitted: true,
      submittedDate: save.currentDate,
    }
  }
  return { league, ucl }
}

function syncShirtNumbersToPlayers(save: GameSave, clubId: string, numbers: Record<string, number>): Player[] {
  return save.players.map((p) => {
    if (p.clubId !== clubId) return p
    const n = numbers[p.id]
    if (n == null) return p
    return { ...p, shirtNumber: n }
  })
}

function syncAllAiShirts(
  save: GameSave,
  byClub: Record<string, ClubSquadRegistration>,
): Player[] {
  let players = save.players
  for (const club of save.clubs) {
    if (club.id === save.humanClubId) continue
    const reg = byClub[club.id]
    if (!reg?.league.submitted) continue
    players = syncShirtNumbersToPlayers({ ...save, players }, club.id, reg.league.numbers)
  }
  return players
}

function isAiClub(save: GameSave, clubId: string): boolean {
  if (clubId === save.humanClubId) return false
  const club = save.clubs.find((c) => c.id === clubId)
  return club?.controlledBy !== 'human'
}

/** ฝังหมุดลงปฏิทินฤดูกาล — ทุกฤดูกาลต้องมี */
function withCalendarRegPins(save: GameSave, pins: CalendarRegPin[]): GameSave {
  const cal = save.seasonCalendar
  if (!cal) return save
  const same =
    cal.registrationPins?.length === pins.length &&
    pins.every((p, i) => {
      const q = cal.registrationPins![i]
      return q && q.id === p.id && q.date === p.date && q.kind === p.kind
    })
  if (same) return save
  return {
    ...save,
    seasonCalendar: {
      ...cal,
      registrationPins: pins.map((p) => ({ ...p })),
    },
  }
}

/** AI ที่ยังไม่ส่ง — จัดโผ+เบอร์แล้วส่งทันที */
function ensureAiClubsSubmitted(
  save: GameSave,
  byClub: Record<string, ClubSquadRegistration>,
): { byClub: Record<string, ClubSquadRegistration>; changed: boolean } {
  let changed = false
  let next = byClub
  for (const club of save.clubs) {
    if (!isAiClub(save, club.id)) continue
    let reg = next[club.id]
    if (!reg) {
      reg = buildClubReg(save, club.id)
      next = { ...next, [club.id]: reg }
      changed = true
    }
    const needsUcl = clubInCompetition(save, club.id, 'ucl')
    if (needsUcl && !reg.ucl) {
      const built = buildClubReg(save, club.id)
      reg = { ...reg, ucl: built.ucl }
      next = { ...next, [club.id]: reg }
      changed = true
    }
    const leaguePending = !reg.league.submitted
    const uclPending = Boolean(reg.ucl && !reg.ucl.submitted)
    if (leaguePending || uclPending) {
      next = { ...next, [club.id]: autoSubmitClub(save, club.id, reg) }
      changed = true
    }
  }
  return { byClub: next, changed }
}

/** สร้าง/รีเฟรชทะเบียนเมื่อเปลี่ยนฤดูกาล หรือยังไม่มี — AI ส่งครบทุกทีม */
export function ensureSquadRegistration(save: GameSave): GameSave {
  const existing = save.squadRegistration
  if (existing && existing.season === save.season && Object.keys(existing.byClub).length > 0) {
    let byClub = { ...existing.byClub }
    let changed = false

    for (const club of save.clubs) {
      const cur = byClub[club.id]
      if (!cur) {
        let built = buildClubReg(save, club.id)
        if (isAiClub(save, club.id)) built = autoSubmitClub(save, club.id, built)
        byClub[club.id] = built
        changed = true
        continue
      }
      const needsUcl = clubInCompetition(save, club.id, 'ucl')
      if (needsUcl && !cur.ucl) {
        const built = buildClubReg(save, club.id)
        let nextReg: ClubSquadRegistration = { ...cur, ucl: built.ucl }
        if (isAiClub(save, club.id)) nextReg = autoSubmitClub(save, club.id, nextReg)
        byClub[club.id] = nextReg
        changed = true
      }
    }

    const ai = ensureAiClubsSubmitted(save, byClub)
    byClub = ai.byClub
    if (ai.changed) changed = true

    const human = byClub[save.humanClubId] ?? buildClubReg(save, save.humanClubId)
    const pins = buildPins(save, human)
    const pinsChanged =
      !existing.pins ||
      existing.pins.length !== pins.length ||
      pins.some((p, i) => existing.pins[i]?.date !== p.date || existing.pins[i]?.id !== p.id)

    if (!changed && !pinsChanged && (save.seasonCalendar?.registrationPins?.length ?? 0) > 0) {
      return save
    }

    let next: GameSave = {
      ...save,
      players: ai.changed ? syncAllAiShirts(save, byClub) : save.players,
      squadRegistration: {
        ...existing,
        byClub,
        pins,
      },
    }
    return withCalendarRegPins(next, pins)
  }

  const byClub: Record<string, ClubSquadRegistration> = {}
  for (const club of save.clubs) {
    byClub[club.id] = buildClubReg(save, club.id)
  }
  // AI ทุกทีมส่งอัตโนมัติทันที (มนุษย์ต้องกดเอง)
  for (const club of save.clubs) {
    if (!isAiClub(save, club.id)) continue
    byClub[club.id] = autoSubmitClub(save, club.id, byClub[club.id]!)
  }

  const human =
    byClub[save.humanClubId] ?? buildClubReg(save, save.humanClubId)
  byClub[save.humanClubId] = human
  const pins = buildPins(save, human)

  let inbox = save.inbox
  const bodyParts = [
    `ลีก: ส่งทะเบียนพร้อมเบอร์เสื้อภายใน ${human.league.deadlineDate}`,
  ]
  if (human.ucl) {
    bodyParts.push(`UCL: ส่งภายใน ${human.ucl.deadlineDate}`)
  }
  bodyParts.push('ไม่ส่งตามกำหนด — เดินวัน / เล่นนัดต่อไม่ได้')
  bodyParts.push('ทีม AI ในลีกส่งโผอัตโนมัติแล้ว')
  inbox = [
    {
      id: uid('msg-reg'),
      date: save.currentDate,
      title: `ลงทะเบียนนักเตะฤดูกาล ${save.season}`,
      body: bodyParts.join(' · '),
      read: false,
    } satisfies InboxMessage,
    ...inbox,
  ].slice(0, 45)

  let next: GameSave = {
    ...save,
    players: syncAllAiShirts(save, byClub),
    squadRegistration: {
      season: save.season,
      byClub,
      pins,
    },
    inbox,
  }
  return withCalendarRegPins(next, pins)
}

export function getClubRegistration(
  save: GameSave,
  clubId?: string,
): ClubSquadRegistration | null {
  const id = clubId ?? save.humanClubId
  return save.squadRegistration?.byClub[id] ?? null
}

export function getRegList(
  save: GameSave,
  kind: SquadRegListKind,
  clubId?: string,
): SquadRegList | null {
  const club = getClubRegistration(save, clubId)
  if (!club) return null
  return kind === 'league' ? club.league : club.ucl
}

export function listIsLocked(list: SquadRegList, currentDate: string): boolean {
  return list.submitted && currentDate >= list.deadlineDate
}

export function listPastDeadlineUnsubmitted(list: SquadRegList, currentDate: string): boolean {
  return !list.submitted && currentDate >= list.deadlineDate
}

export function isPlayerOnList(list: SquadRegList | null | undefined, playerId: string): boolean {
  if (!list) return true
  return list.numbers[playerId] != null
}

/** นัดลีก/UCL ต้องอยู่ในลิสต์ที่ยื่นแล้ว — ถ้วยอื่นไม่บังคับ */
export function competitionNeedsRegistration(
  competition: CompetitionKind,
): SquadRegListKind | null {
  if (competition === 'league') return 'league'
  if (competition === 'ucl') return 'ucl'
  return null
}

export function isPlayerRegisteredForMatch(
  save: GameSave,
  clubId: string,
  playerId: string,
  competition: CompetitionKind,
): boolean {
  const kind = competitionNeedsRegistration(competition)
  if (!kind) return true
  const list = getRegList(save, kind, clubId)
  if (!list) return true
  if (!list.submitted) return false
  return isPlayerOnList(list, playerId)
}

export type RegBlocker = {
  id: string
  message: string
  href: string
  kind: SquadRegListKind
}

export function getRegistrationBlockers(save: GameSave): RegBlocker[] {
  const reg = save.squadRegistration
  if (!reg) return []
  const club = reg.byClub[save.humanClubId]
  if (!club) return []
  const blockers: RegBlocker[] = []
  const d = save.currentDate

  if (listPastDeadlineUnsubmitted(club.league, d)) {
    blockers.push({
      id: 'reg_league',
      message: `เลยกำหนดส่งทะเบียนลีก (${club.league.deadlineDate}) — ไปหน้าลงทะเบียนส่งโผพร้อมเบอร์เสื้อก่อน`,
      href: '/registration',
      kind: 'league',
    })
  }

  if (club.ucl && listPastDeadlineUnsubmitted(club.ucl, d)) {
    blockers.push({
      id: 'reg_ucl',
      message: `เลยกำหนดส่งทะเบียน UCL (${club.ucl.deadlineDate}) — ไปหน้าลงทะเบียนส่งโผก่อน`,
      href: '/registration',
      kind: 'ucl',
    })
  }

  // นัดถัดไปเป็นลีก/UCL แต่ยังไม่ส่ง (แม้ยังไม่เลยเดดไลน์ — บังคับก่อนเตะ)
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  if (nextFx) {
    const need = competitionNeedsRegistration(nextFx.competition)
    if (need === 'league' && !club.league.submitted) {
      if (!blockers.some((b) => b.kind === 'league')) {
        blockers.push({
          id: 'reg_league_match',
          message: 'นัดลีกถัดไป — ต้องส่งทะเบียนลีกพร้อมเบอร์เสื้อก่อน',
          href: '/registration',
          kind: 'league',
        })
      }
    }
    if (need === 'ucl' && club.ucl && !club.ucl.submitted) {
      if (!blockers.some((b) => b.kind === 'ucl')) {
        blockers.push({
          id: 'reg_ucl_match',
          message: 'นัด UCL ถัดไป — ต้องส่งทะเบียน UCL พร้อมเบอร์เสื้อก่อน',
          href: '/registration',
          kind: 'ucl',
        })
      }
    }
  }

  return blockers
}

export function validateRegList(list: SquadRegList): { ok: boolean; reason: string } {
  const ids = Object.keys(list.numbers)
  if (ids.length < 11) {
    return { ok: false, reason: `ต้องมีอย่างน้อย 11 คน (มี ${ids.length})` }
  }
  if (ids.length > list.maxPlayers) {
    return { ok: false, reason: `เกินโควตา ${ids.length}/${list.maxPlayers}` }
  }
  const nums = Object.values(list.numbers)
  const set = new Set(nums)
  if (set.size !== nums.length) {
    return { ok: false, reason: 'เบอร์เสื้อซ้ำกัน' }
  }
  for (const n of nums) {
    if (!Number.isInteger(n) || n < 1 || n > 99) {
      return { ok: false, reason: 'เบอร์เสื้อต้องอยู่ระหว่าง 1–99' }
    }
  }
  return { ok: true, reason: `พร้อมส่ง ${ids.length}/${list.maxPlayers} คน` }
}

export function setPlayerOnRegList(
  save: GameSave,
  kind: SquadRegListKind,
  playerId: string,
  on: boolean,
  shirtNumber?: number,
): { ok: boolean; save: GameSave; message: string } {
  const ensured = ensureSquadRegistration(save)
  const club = ensured.squadRegistration!.byClub[ensured.humanClubId]
  if (!club) return { ok: false, save: ensured, message: 'ไม่พบทะเบียน' }
  const list = kind === 'league' ? club.league : club.ucl
  if (!list) return { ok: false, save: ensured, message: 'ทีมนี้ไม่มี UCL' }
  if (listIsLocked(list, ensured.currentDate)) {
    return { ok: false, save: ensured, message: 'เลยกำหนดแล้ว — แก้โผไม่ได้' }
  }

  const numbers = { ...list.numbers }
  if (!on) {
    delete numbers[playerId]
  } else {
    if (Object.keys(numbers).length >= list.maxPlayers && numbers[playerId] == null) {
      return { ok: false, save: ensured, message: `ลิสต์เต็ม ${list.maxPlayers} คน` }
    }
    const used = new Set(Object.entries(numbers).filter(([id]) => id !== playerId).map(([, n]) => n))
    let n = shirtNumber ?? numbers[playerId]
    if (n == null || used.has(n)) {
      const p = ensured.players.find((x) => x.id === playerId)
      n = p ? preferredShirt(p) : 1
      let g = 0
      while (used.has(n) && g < 100) {
        n = n >= 99 ? 1 : n + 1
        g++
      }
    }
    if (used.has(n)) return { ok: false, save: ensured, message: 'หาเบอร์ว่างไม่ได้' }
    numbers[playerId] = n
  }

  const nextList: SquadRegList = {
    ...list,
    numbers,
    submitted: false,
    submittedDate: undefined,
  }
  const nextClub: ClubSquadRegistration = {
    ...club,
    [kind]: nextList,
  }
  return {
    ok: true,
    message: on ? 'เพิ่มในลิสต์แล้ว' : 'ถอดออกจากลิสต์แล้ว',
    save: {
      ...ensured,
      squadRegistration: {
        ...ensured.squadRegistration!,
        byClub: {
          ...ensured.squadRegistration!.byClub,
          [ensured.humanClubId]: nextClub,
        },
      },
    },
  }
}

export function setRegShirtNumber(
  save: GameSave,
  kind: SquadRegListKind,
  playerId: string,
  shirtNumber: number,
): { ok: boolean; save: GameSave; message: string } {
  const ensured = ensureSquadRegistration(save)
  const club = ensured.squadRegistration!.byClub[ensured.humanClubId]
  if (!club) return { ok: false, save: ensured, message: 'ไม่พบทะเบียน' }
  const list = kind === 'league' ? club.league : club.ucl
  if (!list) return { ok: false, save: ensured, message: 'ทีมนี้ไม่มี UCL' }
  if (listIsLocked(list, ensured.currentDate)) {
    return { ok: false, save: ensured, message: 'เลยกำหนดแล้ว — แก้เบอร์ไม่ได้' }
  }
  if (list.numbers[playerId] == null) {
    return { ok: false, save: ensured, message: 'นักเตะไม่อยู่ในลิสต์' }
  }
  if (!Number.isInteger(shirtNumber) || shirtNumber < 1 || shirtNumber > 99) {
    return { ok: false, save: ensured, message: 'เบอร์ต้อง 1–99' }
  }
  for (const [id, n] of Object.entries(list.numbers)) {
    if (id !== playerId && n === shirtNumber) {
      return { ok: false, save: ensured, message: `เบอร์ ${shirtNumber} ถูกใช้แล้ว` }
    }
  }
  const nextList: SquadRegList = {
    ...list,
    numbers: { ...list.numbers, [playerId]: shirtNumber },
    submitted: false,
    submittedDate: undefined,
  }
  const nextClub: ClubSquadRegistration = {
    ...club,
    [kind]: nextList,
  }
  return {
    ok: true,
    message: `ตั้งเบอร์ ${shirtNumber} แล้ว`,
    save: {
      ...ensured,
      players: syncShirtNumbersToPlayers(ensured, ensured.humanClubId, {
        [playerId]: shirtNumber,
      }),
      squadRegistration: {
        ...ensured.squadRegistration!,
        byClub: {
          ...ensured.squadRegistration!.byClub,
          [ensured.humanClubId]: nextClub,
        },
      },
    },
  }
}

export function submitSquadRegistration(
  save: GameSave,
  kind: SquadRegListKind,
): { ok: boolean; save: GameSave; message: string } {
  const ensured = ensureSquadRegistration(save)
  const club = ensured.squadRegistration!.byClub[ensured.humanClubId]
  if (!club) return { ok: false, save: ensured, message: 'ไม่พบทะเบียน' }
  const list = kind === 'league' ? club.league : club.ucl
  if (!list) return { ok: false, save: ensured, message: 'ทีมนี้ไม่มี UCL' }
  if (listIsLocked(list, ensured.currentDate) && list.submitted) {
    return { ok: false, save: ensured, message: 'ส่งไปแล้วและล็อกแล้ว' }
  }
  const v = validateRegList(list)
  if (!v.ok) return { ok: false, save: ensured, message: v.reason }

  const nextList: SquadRegList = {
    ...list,
    submitted: true,
    submittedDate: ensured.currentDate,
  }
  const nextClub: ClubSquadRegistration = {
    ...club,
    [kind]: nextList,
  }
  const label = kind === 'league' ? 'ลีก' : 'UCL'
  return {
    ok: true,
    message: `ส่งทะเบียน${label} ${Object.keys(list.numbers).length} คนแล้ว`,
    save: {
      ...ensured,
      players: syncShirtNumbersToPlayers(ensured, ensured.humanClubId, list.numbers),
      squadRegistration: {
        ...ensured.squadRegistration!,
        byClub: {
          ...ensured.squadRegistration!.byClub,
          [ensured.humanClubId]: nextClub,
        },
      },
      inbox: [
        {
          id: uid('msg-reg-ok'),
          date: ensured.currentDate,
          title: `ส่งทะเบียน${label}แล้ว`,
          body: `ยื่นโผ ${Object.keys(list.numbers).length} คน พร้อมเบอร์เสื้อ · กำหนด ${list.deadlineDate}`,
          read: false,
        } satisfies InboxMessage,
        ...ensured.inbox,
      ].slice(0, 45),
    },
  }
}

/** เติมโผเริ่มต้น / คัดท็อปอัตโนมัติ (ยังไม่ submit) */
export function autoFillHumanRegList(
  save: GameSave,
  kind: SquadRegListKind,
): { ok: boolean; save: GameSave; message: string } {
  const ensured = ensureSquadRegistration(save)
  const club = ensured.squadRegistration!.byClub[ensured.humanClubId]
  if (!club) return { ok: false, save: ensured, message: 'ไม่พบทะเบียน' }
  const list = kind === 'league' ? club.league : club.ucl
  if (!list) return { ok: false, save: ensured, message: 'ทีมนี้ไม่มี UCL' }
  if (listIsLocked(list, ensured.currentDate)) {
    return { ok: false, save: ensured, message: 'เลยกำหนดแล้ว — แก้โผไม่ได้' }
  }
  const draft = pickDefaultRegSquad(ensured, ensured.humanClubId)
  const numbers = assignShirtNumbers(draft, list.numbers)
  const nextList: SquadRegList = {
    ...list,
    numbers,
    submitted: false,
    submittedDate: undefined,
  }
  const nextClub: ClubSquadRegistration = {
    ...club,
    [kind]: nextList,
  }
  return {
    ok: true,
    message: `จัดโผอัตโนมัติ ${Object.keys(numbers).length} คน`,
    save: {
      ...ensured,
      squadRegistration: {
        ...ensured.squadRegistration!,
        byClub: {
          ...ensured.squadRegistration!.byClub,
          [ensured.humanClubId]: nextClub,
        },
      },
    },
  }
}

/** เตือนใกล้เดดไลน์ + AI ที่ยังไม่ส่งให้ส่งทันที + ซิงก์หมุดปฏิทิน */
export function tickSquadRegistration(save: GameSave): GameSave {
  let next = ensureSquadRegistration(save)
  const state = next.squadRegistration!
  let byClub = { ...state.byClub }

  const ai = ensureAiClubsSubmitted(next, byClub)
  byClub = ai.byClub
  if (ai.changed) {
    next = {
      ...next,
      players: syncAllAiShirts(next, byClub),
    }
  }

  const human = byClub[next.humanClubId]
  let lastRemindKey = state.lastRemindKey
  let inbox = next.inbox
  if (human) {
    const checks: Array<{ key: string; list: SquadRegList; label: string }> = [
      { key: 'league', list: human.league, label: 'ลีก' },
    ]
    if (human.ucl) checks.push({ key: 'ucl', list: human.ucl, label: 'UCL' })

    for (const c of checks) {
      if (c.list.submitted) continue
      const daysLeft =
        (new Date(`${c.list.deadlineDate}T12:00:00`).getTime() -
          new Date(`${next.currentDate}T12:00:00`).getTime()) /
        86400000
      if (daysLeft > 7 || daysLeft < 0) continue
      const remindAt = daysLeft <= 1 ? 1 : daysLeft <= 3 ? 3 : 7
      const key = `${next.season}-${c.key}-${remindAt}`
      if (lastRemindKey === key) continue
      lastRemindKey = key
      inbox = [
        {
          id: uid('msg-reg-due'),
          date: next.currentDate,
          title: `เตือนทะเบียน${c.label}`,
          body: `เหลือประมาณ ${Math.max(0, Math.ceil(daysLeft))} วัน (กำหนด ${c.list.deadlineDate}) — ส่งโผพร้อมเบอร์เสื้อที่หน้าลงทะเบียน`,
          read: false,
        } satisfies InboxMessage,
        ...inbox,
      ].slice(0, 45)
    }
  }

  const pins = human ? buildPins(next, human) : state.pins
  next = {
    ...next,
    inbox,
    squadRegistration: {
      ...state,
      byClub,
      pins,
      lastRemindKey,
    },
  }
  return withCalendarRegPins(next, pins)
}

export function registrationStatusSummary(save: GameSave): string {
  const club = getClubRegistration(save)
  if (!club) return 'ยังไม่เริ่มระบบทะเบียน'
  const parts: string[] = []
  const lg = club.league
  parts.push(
    lg.submitted
      ? `ลีก ✓ ${Object.keys(lg.numbers).length} คน`
      : `ลีก ยังไม่ส่ง (ถึง ${lg.deadlineDate})`,
  )
  if (club.ucl) {
    const u = club.ucl
    parts.push(
      u.submitted
        ? `UCL ✓ ${Object.keys(u.numbers).length} คน`
        : `UCL ยังไม่ส่ง (ถึง ${u.deadlineDate})`,
    )
  }
  return parts.join(' · ')
}
