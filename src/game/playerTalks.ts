import talkDb from '@/data/talkDialogs.json'
import type {
  Club,
  GameSave,
  ManagerTalkTopic,
  Player,
  PlayerRequestKind,
  PlayerTalkRequest,
  TalkDialogDef,
  TalkEffectBundle,
  TalkKindMeta,
  TalkLog,
  TalkPromise,
  TalkResponse,
  TalksState,
} from './types'
import { recomputeDynamics } from './dynamics'
import { ensureClubFinance } from './playerEconomy'
import { applyTransferDesireResponse, isTransferDesireKind } from './wantAway'
import { openContractNegotiation } from './contractLifecycle'
import {
  communicationTier,
  commTierLabelTh,
  managerLanguages,
  playerLanguages,
  talkCommMultiplier,
} from './languages'
import { bumpPlayerRapport, markReleaseClauseKnown, bumpAgentRapport } from './releaseClauseIntel'
import {
  applyStyleDropRequestAgree,
  applyStyleTrainRequestAgree,
  pickAiStyleTarget,
} from './styleTraining'
import { tacticalRoleLabel, TACTICAL_ROLE_BY_ID, type TacticalRoleId } from './tacticalRoles'
import { getWorldCoach } from './worldCoaches'
import { ensurePlayerTacticalRoles } from './playerTacticalRoles'

export const TALK_KINDS: TalkKindMeta[] = (talkDb.kinds ?? []) as TalkKindMeta[]

/** บทสนทนาฝึกสไตล์ (นอก JSON หลัก) */
const STYLE_TALK_DIALOGS: TalkDialogDef[] = [
  {
    id: 'style_train_generic',
    kind: 'style_train_request',
    labelTh: 'ขอฝึกสไตล์เล่นใหม่',
    when: ['style_ambitious'],
    urgencyBase: 5,
    weight: 10,
    playerLine: 'อยากฝึกสไตล์เล่นใหม่ให้เข้ากับทีม/ตัวเองมากขึ้น',
    responses: {
      agree: {
        effects: { morale: 2, happiness: 2 },
        outcomeTh: 'โค้ชตกลงเปิดคิวฝึกสไตล์ตามที่ขอ',
      },
      promise: {
        effects: { morale: 1, happiness: 1, promise: { kind: 'minutes', dueDays: 5 } },
        outcomeTh: 'สัญญาว่าจะจัดคิวฝึกให้เร็วๆ นี้',
      },
      refuse: {
        effects: { morale: -1, happiness: -2 },
        outcomeTh: 'ปฏิเสธคำขอฝึกสไตล์ — เขายังไม่พอใจ',
      },
      listen_only: {
        effects: { happiness: 1 },
        outcomeTh: 'รับฟังไว้ก่อน — ยังไม่สัญญา',
      },
    },
  },
  {
    id: 'style_drop_generic',
    kind: 'style_drop_request',
    labelTh: 'ขอเลิกเล่นสไตล์เดิม',
    when: ['style_mismatch'],
    urgencyBase: 6,
    weight: 10,
    playerLine: 'ไม่อยากถูกบังคับเล่นสไตล์นี้อีก — ขอเปลี่ยนโฟกัสฝึก',
    responses: {
      agree: {
        effects: { morale: 2, happiness: 2 },
        outcomeTh: 'ตกลงเลิกบังคับสไตล์นั้น และปรับเป้าฝึก',
      },
      promise: {
        effects: { morale: 1, happiness: 1 },
        outcomeTh: 'สัญญาว่าจะลดการใช้สไตล์นั้น',
      },
      refuse: {
        effects: { morale: -2, happiness: -2 },
        outcomeTh: 'ยังบังคับแผนเดิม — เขารู้สึกไม่ได้รับการฟัง',
      },
      listen_only: {
        effects: { happiness: 1 },
        outcomeTh: 'รับฟังความไม่พอใจเรื่องสไตล์',
      },
    },
  },
]
export const TALK_DIALOGS: TalkDialogDef[] = talkDb.dialogs as TalkDialogDef[]

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createTalksState(): TalksState {
  return {
    requests: [],
    logs: [],
    promises: [],
    lastTeamMeetingMatchday: -99,
  }
}

export function ensureTalks(save: GameSave): TalksState {
  return save.talks ?? createTalksState()
}

export const MANAGER_TOPICS: {
  id: ManagerTalkTopic
  title: string
  desc: string
}[] = [
  { id: 'praise', title: 'ชมผลงาน', desc: 'ย้ำความสำคัญ — โมราเลขึ้น' },
  { id: 'criticism', title: 'ติงตรงๆ', desc: 'กดดันให้โฟกัส — เสี่ยงโมราเลตกถ้า temperamental' },
  { id: 'promise_minutes', title: 'สัญญาเวลาลงเล่น', desc: 'สัญญาว่าจะได้โอกาสในอีกไม่กี่นัด' },
  { id: 'role_clarity', title: 'คุยบทบาทในทีม', desc: 'อธิบายทำไมถึงเป็น key/bench' },
  { id: 'discipline_warn', title: 'เตือนวินัย', desc: 'เรื่องไลฟ์สไตล์/มาสาย — มืออาชีพชอบ' },
  { id: 'encourage', title: 'ให้กำลังใจ', desc: 'ช่วงฟอร์มตกหรือเจ็บ' },
  { id: 'listen', title: 'รับฟังอย่างเดียว', desc: 'เปิดโอกาสให้เขาพูด — ความสุขขึ้นเล็กน้อย' },
  { id: 'team_meeting', title: 'ประชุมทีม', desc: 'ทั้งสควอด — คูลดาวน์หลายแมตช์เดย์' },
]

const REQUEST_LABEL: Record<string, string> = Object.fromEntries(
  TALK_KINDS.map((k) => [k.id, k.labelTh]),
)

const DIALOGS_BY_KIND = new Map<string, TalkDialogDef[]>()
for (const d of TALK_DIALOGS) {
  const list = DIALOGS_BY_KIND.get(d.kind) ?? []
  list.push(d)
  DIALOGS_BY_KIND.set(d.kind, list)
}

const MUST_AGREE = new Set([
  'family_emergency',
  'funeral_leave',
  'child_birth',
  'security_detail',
])

function patchPlayer(
  players: Player[],
  id: string,
  fn: (p: Player) => Player,
): Player[] {
  return players.map((p) => (p.id === id ? fn(p) : p))
}

function avgMinutesHint(p: Player, save: GameSave): number {
  const md = Math.max(1, save.matchday)
  return (p.minutesPlayed ?? 0) / md
}

function playerTags(p: Player, save: GameSave, inXi: boolean): Set<string> {
  const tags = new Set<string>(['always'])
  const happy = p.happiness ?? p.morale
  const mins = avgMinutesHint(p, save)
  const amb = p.growth?.ambition ?? 10
  if ((p.squadRole === 'key' || p.squadRole === 'regular') && !inXi && p.injuryDays <= 0) {
    tags.add('bench_role')
  }
  if (p.squadRole === 'key' && !inXi && p.injuryDays <= 0) tags.add('bench_key')
  if (mins < 28 && p.age >= 22) tags.add('low_minutes')
  if (happy <= 8) tags.add('unhappy')
  if (happy <= 10) tags.add('low_happy')
  if (amb >= 14 && p.wage < p.overall * 110) tags.add('underpaid')
  if ((p.contractYears ?? 2) <= 1) tags.add('contract_short')
  if (p.injuryDays >= 5) tags.add('injured')
  if (p.condition < 60 || p.sharpness < 55) tags.add('fatigued')
  if (p.form >= 7 && p.overall >= 72) tags.add('form_good')
  if (p.age >= 28 || p.squadRole === 'key') tags.add('senior')
  if ((p.styleMismatchStreak ?? 0) >= 2 || (p.styleDisliked?.length ?? 0) > 0) {
    tags.add('style_mismatch')
  }
  if (amb >= 13 || (p.growth?.ambition ?? 10) >= 12) tags.add('style_ambitious')
  return tags
}

function dialogMatchesWhen(dialog: TalkDialogDef, tags: Set<string>): boolean {
  return dialog.when.some((w) => tags.has(w))
}

function pickWeighted<T extends { weight: number }>(
  items: T[],
  rng: () => number,
): T | null {
  if (items.length === 0) return null
  const total = items.reduce((s, x) => s + Math.max(1, x.weight), 0)
  let roll = rng() * total
  for (const item of items) {
    roll -= Math.max(1, item.weight)
    if (roll <= 0) return item
  }
  return items[items.length - 1]
}

function applyEffectsToPlayer(p: Player, e: TalkEffectBundle): Player {
  let next: Player = {
    ...p,
    morale: clamp(p.morale + (e.morale ?? 0), 1, 20),
    happiness: clamp((p.happiness ?? p.morale) + (e.happiness ?? 0), 1, 20),
    condition: clamp(p.condition + (e.condition ?? 0), 25, 100),
    sharpness: clamp(p.sharpness + (e.sharpness ?? 0), 25, 100),
    form: clamp(p.form + (e.form ?? 0), 1, 10),
    cash: Math.max(0, (p.cash ?? 0) + (e.cash ?? 0)),
    injuryDays: Math.max(0, p.injuryDays + (e.injuryDays ?? 0)),
    leaveDays: Math.max(0, (p.leaveDays ?? 0) + (e.leaveDays ?? 0)),
    mediaHandling: clamp((p.mediaHandling ?? 10) + (e.mediaHandling ?? 0), 1, 20),
  }
  if (e.missTraining) {
    next = { ...next, lastActivityId: 'talk_skip_training' }
  }
  return next
}

function scaleTalkDelta(n: number | undefined, mult: number): number | undefined {
  if (n == null || n === 0) return n
  const scaled = Math.round(n * mult)
  if (scaled === 0) return n < 0 ? -1 : 1
  return scaled
}

function applyTalkEffects(
  save: GameSave,
  playerId: string,
  clubId: string,
  effects: TalkEffectBundle,
  note: string,
): { save: GameSave; players: Player[]; promises: TalkPromise[] } {
  const talks = ensureTalks(save)
  const player = save.players.find((p) => p.id === playerId)
  const mult = player ? talkCommMultiplier(save, player) : 1
  const scaled: TalkEffectBundle = {
    ...effects,
    morale: scaleTalkDelta(effects.morale, mult),
    happiness: scaleTalkDelta(effects.happiness, mult),
  }
  let players = patchPlayer(save.players, playerId, (p) => applyEffectsToPlayer(p, scaled))
  let promises = [...talks.promises]
  let clubs = save.clubs
  let finance = ensureClubFinance(save)
  let managerReputation = save.managerReputation ?? 50
  let dynamics = save.dynamics

  if (effects.promise) {
    promises = promises.filter(
      (x) => !(x.playerId === playerId && x.kind === effects.promise!.kind),
    )
    promises.push({
      playerId,
      clubId,
      kind: effects.promise.kind,
      createdMatchday: save.matchday,
      dueMatchday: save.matchday + Math.max(1, effects.promise.dueDays),
      note,
    })
  }

  if ((effects.clubCost ?? 0) > 0) {
    const cost = Math.round(effects.clubCost!)
    clubs = clubs.map((c) => (c.id === clubId ? { ...c, balance: c.balance - cost } : c))
    if (clubId === save.humanClubId) {
      finance = {
        ...finance,
        ledger: [
          {
            id: uid('led'),
            date: save.currentDate,
            kind: 'other' as const,
            amount: -cost,
            note: `คุยกับนักเตะ · ${note}`,
          },
          ...finance.ledger,
        ].slice(0, 50),
      }
    }
  }

  if (effects.cohesion && clubId === save.humanClubId) {
    dynamics = {
      ...dynamics,
      cohesion: clamp(dynamics.cohesion + effects.cohesion, 1, 20),
      dressingRoomMood: clamp(
        dynamics.dressingRoomMood + Math.sign(effects.cohesion),
        1,
        20,
      ),
    }
  }

  if (effects.managerRep && clubId === save.humanClubId) {
    managerReputation = clamp(managerReputation + effects.managerRep, 0, 100)
  }

  return {
    players,
    promises,
    save: {
      ...save,
      players,
      clubs,
      clubFinance: finance,
      managerReputation,
      dynamics,
    },
  }
}

function buildRequestForPlayer(
  save: GameSave,
  p: Player,
  rng: () => number,
  pendingIds: Set<string>,
  forceKinds?: string[],
): PlayerTalkRequest | null {
  if ((p.leaveDays ?? 0) > 0) return null
  const xi = new Set(save.tacticsByClub[p.clubId]?.startingXi ?? [])
  const inXi = xi.has(p.id)
  const tags = playerTags(p, save, inXi)
  const happy = p.happiness ?? p.morale

  let candidates: TalkDialogDef[] = []
  if (forceKinds?.length) {
    for (const k of forceKinds) {
      candidates.push(...(DIALOGS_BY_KIND.get(k) ?? []))
    }
  } else {
    for (const dialog of TALK_DIALOGS) {
      if (!dialogMatchesWhen(dialog, tags)) continue
      if (dialog.when.length === 1 && dialog.when[0] === 'always') {
        if (rng() > 0.06) continue
      }
      candidates.push(dialog)
    }
  }
  if (candidates.length === 0) return null

  const byKind = new Map<string, TalkDialogDef[]>()
  for (const c of candidates) {
    const list = byKind.get(c.kind) ?? []
    list.push(c)
    byKind.set(c.kind, list)
  }
  const kindScores = [...byKind.entries()].map(([kind, list]) => ({
    kind,
    urgency: Math.max(...list.map((d) => d.urgencyBase)),
    list,
  }))
  kindScores.sort((a, b) => b.urgency - a.urgency)
  const top = kindScores[0]
  const key = `${p.id}:${top.kind}`
  if (pendingIds.has(key)) return null

  const chance =
    0.1 + top.urgency * 0.03 + (happy < 8 ? 0.1 : 0) + (p.clubId === save.humanClubId ? 0.06 : 0)
  if (!forceKinds && rng() > Math.min(0.72, chance)) return null

  const picked = pickWeighted(top.list, rng)
  if (!picked) return null

  return {
    id: uid('req'),
    playerId: p.id,
    clubId: p.clubId,
    kind: picked.kind,
    dialogId: picked.id,
    labelTh: picked.labelTh,
    date: save.currentDate,
    matchday: save.matchday,
    urgency: clamp(picked.urgencyBase + (happy < 8 ? 1 : 0), 1, 10),
    message: `${p.name}: "${picked.playerLine}"`,
    status: 'pending',
  }
}

function generateStyleTalkRequests(
  save: GameSave,
  pendingIds: Set<string>,
  rng: () => number,
): PlayerTalkRequest[] {
  const out: PlayerTalkRequest[] = []
  for (const club of save.clubs) {
    const isHuman = club.id === save.humanClubId
    const squad = save.players.filter((p) => p.clubId === club.id && p.injuryDays <= 0)
    const coach = getWorldCoach(club.coachId)
    let made = 0
    const max = isHuman ? 2 : 1
    for (const raw of squad) {
      if (made >= max) break
      const p = ensurePlayerTacticalRoles(raw)
      const chanceMul = isHuman ? 1 : 0.45

      if (
        (p.styleMismatchStreak ?? 0) >= 2 &&
        rng() < 0.28 * chanceMul &&
        !pendingIds.has(`${p.id}:style_drop_request`)
      ) {
        const tac = save.tacticsByClub[p.clubId]
        const idx = tac?.startingXi.indexOf(p.id) ?? -1
        const slotStyle =
          idx >= 0
            ? tac?.slotRoles?.[idx]
            : (p.styleDisliked?.[0] ?? p.preferredTacticalRoles?.[2]?.id)
        if (slotStyle && TACTICAL_ROLE_BY_ID[slotStyle]) {
          out.push({
            id: uid('req'),
            playerId: p.id,
            clubId: p.clubId,
            kind: 'style_drop_request',
            dialogId: `style_drop_generic:${slotStyle}`,
            labelTh: `ขอเลิก「${tacticalRoleLabel(slotStyle)}」`,
            date: save.currentDate,
            matchday: save.matchday,
            urgency: 6,
            message: `${p.name}: "ไม่อยากเล่นแบบ${tacticalRoleLabel(slotStyle)}อีก — ขอเปลี่ยนโฟกัสฝึก"`,
            status: 'pending',
          })
          made++
          continue
        }
      }

      if (
        ((p.growth?.ambition ?? 10) >= 12 || rng() < 0.08) &&
        rng() < 0.18 * chanceMul &&
        !pendingIds.has(`${p.id}:style_train_request`)
      ) {
        const target = pickAiStyleTarget(p, coach, save.matchday)
        const owned = (p.preferredTacticalRoles ?? []).find((s) => s.id === target)
        if (owned && owned.level >= 3) continue
        out.push({
          id: uid('req'),
          playerId: p.id,
          clubId: p.clubId,
          kind: 'style_train_request',
          dialogId: `style_train_generic:${target}`,
          labelTh: `ขอฝึก「${tacticalRoleLabel(target)}」`,
          date: save.currentDate,
          matchday: save.matchday,
          urgency: 5,
          message: `${p.name}: "อยากฝึกเป็น${tacticalRoleLabel(target)} ให้เก่งขึ้น"`,
          status: 'pending',
        })
        made++
      }
    }
  }
  return out
}

/** สร้างคำขอเรียกคุย — ทุกสโมสร (มนุษย์ + AI) */
export function generatePlayerTalkRequests(save: GameSave): GameSave {
  const talks = ensureTalks(save)
  const pendingIds = new Set(
    talks.requests.filter((r) => r.status === 'pending').map((r) => r.playerId + ':' + r.kind),
  )
  const rng = mulberry32(save.season * 333 + save.matchday * 19 + 7)
  const newReqs: PlayerTalkRequest[] = []

  for (const club of save.clubs) {
    const isHuman = club.id === save.humanClubId
    const squad = save.players.filter((p) => p.clubId === club.id)
    if (squad.length === 0) continue

    // AI: น้อยกว่ามนุษย์ — สูงสุด 2 คำขอ/คลับ
    const maxNew = isHuman ? 8 : 2
    let made = 0
    const order = [...squad].sort(() => rng() - 0.5)

    for (const p of order) {
      if (made >= maxNew) break
      const req = buildRequestForPlayer(save, p, rng, pendingIds)
      if (!req) continue
      newReqs.push(req)
      pendingIds.add(`${p.id}:${req.kind}`)
      made++
    }

    // สุ่มลา/ฉุกเฉินเล็กน้อย
    if (made < maxNew && rng() < (isHuman ? 0.22 : 0.08)) {
      const p = squad[Math.floor(rng() * squad.length)]
      const force = rng() < 0.35 ? ['family_emergency'] : ['personal_leave', 'funeral_leave', 'child_birth']
      const req = buildRequestForPlayer(save, p, rng, pendingIds, force)
      if (req) {
        newReqs.push(req)
        pendingIds.add(`${p.id}:${req.kind}`)
      }
    }
  }

  const styleReqs = generateStyleTalkRequests(save, pendingIds, rng)
  for (const req of styleReqs) {
    newReqs.push(req)
    pendingIds.add(`${req.playerId}:${req.kind}`)
  }

  if (newReqs.length === 0) return { ...save, talks }

  const requests = [
    ...newReqs,
    ...talks.requests.map((r) =>
      r.status === 'pending' && save.matchday - r.matchday > 6
        ? { ...r, status: 'expired' as const }
        : r,
    ),
  ].slice(0, 120)

  const humanNew = newReqs.filter((r) => r.clubId === save.humanClubId)
  const inbox =
    humanNew.length > 0
      ? [
          {
            id: `msg-talk-req-${Date.now()}`,
            date: save.currentDate,
            title: `นักเตะขอคุย · ${humanNew.length} คน`,
            body: humanNew.map((r) => `${r.labelTh}: ${r.message}`).join(' · '),
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40)
      : save.inbox

  return {
    ...save,
    talks: { ...talks, requests },
    inbox,
  }
}

/** AI โค้ชตอบคำขอของนักเตะในทีมตัวเอง */
export function processAiPlayerTalks(save: GameSave): GameSave {
  const talks = ensureTalks(save)
  const pending = talks.requests.filter((r) => {
    if (r.status !== 'pending') return false
    const clubId = r.clubId ?? save.players.find((p) => p.id === r.playerId)?.clubId
    return clubId != null && clubId !== save.humanClubId
  })
  if (pending.length === 0) return { ...save, talks }

  const rng = mulberry32(save.season * 911 + save.matchday * 41 + 3)
  let next = save
  const aiNotes: string[] = []

  for (const req of pending) {
    const player = next.players.find((p) => p.id === req.playerId)
    if (!player) continue
    const club = next.clubs.find((c) => c.id === player.clubId)
    if (!club || club.id === next.humanClubId) continue

    const response = aiChooseResponse(req, player, club, rng)
    const result = respondToPlayerRequest(next, req.id, response)
    if (!result.ok) continue
    next = result.save
    if (rng() < 0.12 && aiNotes.length < 3) {
      aiNotes.push(
        `${club.shortName}: ${player.name} ขอ「${req.labelTh ?? req.kind}」→ โค้ช${responseLabel(response)}`,
      )
    }
  }

  if (aiNotes.length === 0) return next

  return {
    ...next,
    inbox: [
      {
        id: `msg-ai-talk-${Date.now()}`,
        date: next.currentDate,
        title: 'ข่าวลือห้องแต่งตัว (ทีมอื่น)',
        body: aiNotes.join(' · '),
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }
}

function responseLabel(r: TalkResponse): string {
  switch (r) {
    case 'agree':
      return 'รับปาก'
    case 'promise':
      return 'สัญญา'
    case 'listen_only':
      return 'รับฟัง'
    case 'refuse':
      return 'ปฏิเสธ'
  }
}

function aiChooseResponse(
  req: PlayerTalkRequest,
  player: Player,
  club: Club,
  rng: () => number,
): TalkResponse {
  if (MUST_AGREE.has(req.kind)) return rng() < 0.92 ? 'agree' : 'promise'

  const rich = club.balance > 80_000_000
  const poor = club.balance < 15_000_000
  const star = player.squadRole === 'key' || player.overall >= 80
  const unhappy = (player.happiness ?? player.morale) <= 8

  if (req.kind === 'transfer_request' || req.kind === 'list_for_sale') {
    if (unhappy && !star) return rng() < 0.55 ? 'agree' : 'promise'
    if (star) return rng() < 0.65 ? 'refuse' : 'listen_only'
    return rng() < 0.4 ? 'promise' : 'refuse'
  }

  if (
    ['bonus_request', 'wage_rise', 'housing_help', 'gym_private', 'flight_upgrade'].includes(
      req.kind,
    )
  ) {
    if (poor) return rng() < 0.55 ? 'refuse' : 'listen_only'
    if (rich && star) return rng() < 0.6 ? 'agree' : 'promise'
    return rng() < 0.35 ? 'promise' : rng() < 0.5 ? 'listen_only' : 'refuse'
  }

  if (req.urgency >= 8) {
    if (star) return rng() < 0.7 ? 'agree' : 'promise'
    return rng() < 0.45 ? 'agree' : 'promise'
  }
  if (req.urgency >= 6) {
    if (star) return rng() < 0.55 ? 'agree' : rng() < 0.5 ? 'promise' : 'listen_only'
    return rng() < 0.35 ? 'promise' : rng() < 0.45 ? 'listen_only' : 'refuse'
  }
  if (req.urgency <= 2) {
    return rng() < 0.4 ? 'agree' : rng() < 0.5 ? 'listen_only' : 'refuse'
  }
  return rng() < 0.3 ? 'agree' : rng() < 0.4 ? 'promise' : rng() < 0.5 ? 'listen_only' : 'refuse'
}

function addLog(talks: TalksState, log: TalkLog): TalksState {
  return { ...talks, logs: [log, ...talks.logs].slice(0, 100) }
}

function findDialog(id: string | undefined, kind: PlayerRequestKind): TalkDialogDef | null {
  if (id) {
    const styleHit = STYLE_TALK_DIALOGS.find((d) => d.id === id || id.startsWith(d.id))
    if (styleHit) return styleHit
    const found = TALK_DIALOGS.find((d) => d.id === id)
    if (found) return found
  }
  const styleKind = STYLE_TALK_DIALOGS.find((d) => d.kind === kind)
  if (styleKind) return styleKind
  const pool = DIALOGS_BY_KIND.get(kind)
  return pool?.[0] ?? null
}

function parseStyleIdFromDialog(dialogId: string | undefined): TacticalRoleId | null {
  if (!dialogId) return null
  const m = dialogId.match(/:(.+)$/)
  const id = m?.[1] as TacticalRoleId | undefined
  if (id && TACTICAL_ROLE_BY_ID[id]) return id
  return null
}

/** ผู้จัดการเริ่มคุย / ประชุมทีม (ทีมคุณเท่านั้น) */
export function managerTalk(
  save: GameSave,
  topic: ManagerTalkTopic,
  playerId?: string,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const talks = ensureTalks(save)
  const humanId = save.humanClubId

  if (topic === 'team_meeting') {
    if (save.matchday - talks.lastTeamMeetingMatchday < 3) {
      return { ok: false, message: 'เพิ่งประชุมทีมไป — รออย่างน้อย 3 แมตช์เดย์' }
    }
    const players = save.players.map((p) => {
      if (p.clubId !== humanId) return p
      return {
        ...p,
        morale: clamp(p.morale + 1, 1, 20),
        happiness: clamp((p.happiness ?? p.morale) + 1, 1, 20),
      }
    })
    const nextTalks = addLog(
      { ...talks, lastTeamMeetingMatchday: save.matchday },
      {
        id: uid('talk'),
        date: save.currentDate,
        matchday: save.matchday,
        source: 'manager',
        playerId: null,
        playerName: 'ทั้งสควอด',
        topic: 'team_meeting',
        outcome: 'ประชุมทีม — ย้ำเป้าหมายร่วม · โมราเลห้องแต่งตัวดีขึ้นเล็กน้อย',
      },
    )
    let next: GameSave = { ...save, players, talks: nextTalks }
    next = { ...next, dynamics: recomputeDynamics(next) }
    return { ok: true, save: next, message: 'ประชุมทีมเสร็จ — บรรยากาศดีขึ้นเล็กน้อย' }
  }

  if (!playerId) return { ok: false, message: 'เลือกนักเตะก่อนคุยส่วนตัว' }
  const player = save.players.find((p) => p.id === playerId && p.clubId === humanId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะในทีมคุณ' }

  const temp =
    player.personalityId === 'temperamental'
      ? 14
      : player.personalityId === 'model_pro'
        ? 4
        : 10
  let morale = 0
  let happiness = 0
  let outcome = ''
  let promises = [...talks.promises]

  switch (topic) {
    case 'praise':
      morale = 2
      happiness = 1
      outcome = `ชม ${player.name} — เขาดูมีไฟขึ้น`
      break
    case 'criticism':
      morale = temp >= 12 ? -2 : -1
      happiness = temp >= 12 ? -2 : 0
      outcome =
        temp >= 12
          ? `ติง ${player.name} แรง — เขารับไม่ได้ดีนัก`
          : `ติง ${player.name} — เขารับไปคิด`
      break
    case 'promise_minutes':
      morale = 2
      happiness = 2
      promises = promises.filter((x) => !(x.playerId === playerId && x.kind === 'minutes'))
      promises.push({
        playerId,
        clubId: humanId,
        kind: 'minutes',
        createdMatchday: save.matchday,
        dueMatchday: save.matchday + 4,
        note: 'สัญญาว่าจะได้โอกาสลงเล่นมากขึ้น',
      })
      outcome = `สัญญาเวลาลงเล่นกับ ${player.name} (ตรวจภายใน 4 แมตช์เดย์)`
      break
    case 'role_clarity':
      happiness = 2
      morale = 1
      outcome = `อธิบายบทบาท ${player.squadRole} ให้ ${player.name} เข้าใจขึ้น`
      break
    case 'discipline_warn':
      morale = (player.growth?.professionalism ?? 10) >= 12 ? 1 : -1
      happiness = -1
      outcome = `เตือนวินัย ${player.name}`
      break
    case 'encourage':
      morale = 2
      happiness = 2
      outcome = `ให้กำลังใจ ${player.name}`
      break
    case 'listen':
    default:
      happiness = 2
      morale = 1
      outcome = `รับฟัง ${player.name} — เขารู้สึกว่ามีคนสนใจ`
      break
  }

  const mult = talkCommMultiplier(save, player)
  const { tier } = communicationTier(managerLanguages(save.managerProfile), playerLanguages(player, save))
  morale = scaleTalkDelta(morale, mult) ?? 0
  happiness = scaleTalkDelta(happiness, mult) ?? 0
  if (tier === 'poor') outcome += ` · (${commTierLabelTh(tier)})`
  else if (tier === 'native' && Math.abs(morale) + Math.abs(happiness) > 0) {
    outcome += ' · สื่อสารคล่อง'
  }

  const players = patchPlayer(save.players, playerId, (p) => ({
    ...p,
    morale: clamp(p.morale + morale, 1, 20),
    happiness: clamp((p.happiness ?? p.morale) + happiness, 1, 20),
  }))

  const nextTalks = addLog(
    { ...talks, promises },
    {
      id: uid('talk'),
      date: save.currentDate,
      matchday: save.matchday,
      source: 'manager',
      playerId,
      playerName: player.name,
      topic,
      outcome,
    },
  )

  let next: GameSave = { ...save, players, talks: nextTalks }
  next = { ...next, dynamics: recomputeDynamics(next) }
  next = bumpPlayerRapport(next, playerId, 7)
  return { ok: true, save: next, message: outcome }
}

/** ตอบคำขอที่นักเตะเรียกคุย — ใช้ effects จาก dialog DB */
export function respondToPlayerRequest(
  save: GameSave,
  requestId: string,
  response: TalkResponse,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const talks = ensureTalks(save)
  const req = talks.requests.find((r) => r.id === requestId)
  if (!req || req.status !== 'pending') return { ok: false, message: 'ไม่พบคำขอที่ค้างอยู่' }
  const player = save.players.find((p) => p.id === req.playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }

  const dialog = findDialog(req.dialogId, req.kind)
  if (!dialog) return { ok: false, message: 'ไม่พบบทสนทนา' }

  const pack = dialog.responses[response]
  const effects = pack.effects
  const outcome = `${player.name}: ${pack.outcomeTh}`
  const clubId = req.clubId || player.clubId

  const applied = applyTalkEffects(
    save,
    req.playerId,
    clubId,
    effects,
    req.labelTh || dialog.labelTh,
  )
  const requests = talks.requests.map((r) =>
    r.id === requestId ? { ...r, status: 'resolved' as const } : r,
  )
  const nextTalks = addLog(
    { ...ensureTalks(applied.save), requests, promises: applied.promises },
    {
      id: uid('talk'),
      date: save.currentDate,
      matchday: save.matchday,
      source: 'player',
      playerId: req.playerId,
      playerName: player.name,
      topic: req.kind,
      response,
      outcome,
    },
  )

  let next: GameSave = {
    ...applied.save,
    talks: nextTalks,
    players: applied.players,
  }
  if (isTransferDesireKind(req.kind)) {
    next = applyTransferDesireResponse(
      next,
      req.playerId,
      req.kind,
      response,
      req.labelTh || dialog.labelTh,
    )
  }
  // ฝึก / เลิกสไตล์เล่น
  if (
    (req.kind === 'style_train_request' || req.kind === 'style_drop_request') &&
    (response === 'agree' || response === 'promise')
  ) {
    const styleId = parseStyleIdFromDialog(req.dialogId)
    const coach = getWorldCoach(
      next.clubs.find((c) => c.id === clubId)?.coachId,
    )
    next = {
      ...next,
      players: next.players.map((pl) => {
        if (pl.id !== req.playerId) return pl
        if (req.kind === 'style_train_request' && styleId) {
          return applyStyleTrainRequestAgree(pl, styleId)
        }
        if (req.kind === 'style_drop_request' && styleId) {
          return applyStyleDropRequestAgree(pl, styleId, coach)
        }
        return pl
      }),
    }
  }
  // ทวงค่าเหนื่อย/สัญญาใหม่ → เปิดโต๊ะต่อสัญญาจริง (ทีมคุณ)
  if (
    clubId === save.humanClubId &&
    (req.kind === 'new_contract' || req.kind === 'wage_rise') &&
    (response === 'agree' || response === 'promise')
  ) {
    next = openContractNegotiation(
      next,
      req.playerId,
      req.kind === 'new_contract'
        ? 'จากคำขอดูสัญญาใหม่ของนักเตะ'
        : 'จากคำขอทบทวนค่าเหนื่อย — เอเยนต์เปิดโต๊ะแล้ว',
    )
  }
  if (clubId === save.humanClubId) {
    next = { ...next, dynamics: recomputeDynamics(next) }
  }
  // สนิทนักเตะขึ้น · คุยเรื่องค่าฉีกแล้วเปิดเผยได้
  const kind = String(req.kind)
  const rapportGain =
    response === 'agree' || response === 'promise' ? 10 : response === 'listen_only' ? 5 : 2
  next = bumpPlayerRapport(next, req.playerId, rapportGain)
  if (
    kind.includes('release_clause') ||
    kind.includes('contract') ||
    kind.includes('wage')
  ) {
    if (response === 'agree' || response === 'promise') {
      next = markReleaseClauseKnown(next, req.playerId)
      next = bumpAgentRapport(next, req.playerId, 8)
    } else {
      next = bumpAgentRapport(next, req.playerId, 3)
    }
  }
  return { ok: true, save: next, message: outcome }
}

function promiseKept(
  pr: TalkPromise,
  p: Player,
  save: GameSave,
  xi: Set<string>,
): boolean {
  switch (pr.kind) {
    case 'minutes':
      return avgMinutesHint(p, save) >= 35 || xi.has(p.id)
    case 'start':
      return xi.has(p.id)
    case 'rest':
      return p.condition >= 62 || !xi.has(p.id)
    case 'leave':
    case 'national':
    case 'event':
      return true
    case 'wage_review':
    case 'bonus':
    case 'housing':
    case 'gym':
    case 'shirt_number': {
      if (pr.kind === 'wage_review') {
        const open = (save.contractTalks?.talks ?? []).some(
          (t) => t.playerId === p.id && (t.status === 'open' || t.status === 'signed'),
        )
        if (open) return true
        // ต่อสัญญาไปแล้วในช่วง promise
        if ((p.contractYears ?? 0) > 1 && (p.contractEndSeason ?? 0) > save.season + 1) {
          return true
        }
      }
      return (p.happiness ?? 10) >= 11
    }
    case 'transfer_list':
    case 'loan':
      return Boolean(p.wantAway?.active) || (p.happiness ?? 10) >= 9
    default:
      return (p.happiness ?? 10) >= 10
  }
}

/** ตรวจสัญญาที่ให้ไว้ — ทุกสโมสร */
export function resolveTalkPromises(save: GameSave): GameSave {
  const talks = ensureTalks(save)
  if (talks.promises.length === 0) return { ...save, talks }

  let players = save.players
  const kept: TalkPromise[] = []
  const logs: TalkLog[] = []
  const inboxBits: string[] = []

  for (const pr of talks.promises) {
    if (save.matchday < pr.dueMatchday) {
      kept.push(pr)
      continue
    }
    const p = players.find((x) => x.id === pr.playerId)
    if (!p) continue
    const clubId = pr.clubId || p.clubId
    const xi = new Set(save.tacticsByClub[clubId]?.startingXi ?? [])

    const ok = promiseKept(pr, p, save, xi)
    if (ok) {
      players = patchPlayer(players, p.id, (pl) => ({
        ...pl,
        happiness: clamp((pl.happiness ?? pl.morale) + 1, 1, 20),
        morale: clamp(pl.morale + 1, 1, 20),
      }))
      logs.push({
        id: uid('talk'),
        date: save.currentDate,
        matchday: save.matchday,
        source: 'manager',
        playerId: p.id,
        playerName: p.name,
        topic: 'promise_kept',
        outcome: `รักษาสัญญา: ${pr.note}`,
      })
    } else {
      players = patchPlayer(players, p.id, (pl) => ({
        ...pl,
        happiness: clamp((pl.happiness ?? pl.morale) - 3, 1, 20),
        morale: clamp(pl.morale - 2, 1, 20),
      }))
      logs.push({
        id: uid('talk'),
        date: save.currentDate,
        matchday: save.matchday,
        source: 'manager',
        playerId: p.id,
        playerName: p.name,
        topic: 'promise_broken',
        outcome: `ผิดสัญญา: ${pr.note} — ${p.name} ไม่เชื่อถือ`,
      })
      if (clubId === save.humanClubId) {
        inboxBits.push(`${p.name} รู้สึกว่าถูกหลอกเรื่อง「${pr.note}」`)
      }
    }
  }

  const nextTalks: TalksState = {
    ...talks,
    promises: kept,
    logs: [...logs, ...talks.logs].slice(0, 100),
  }

  let next: GameSave = {
    ...save,
    players,
    talks: nextTalks,
    inbox:
      inboxBits.length > 0
        ? [
            {
              id: `msg-promise-${Date.now()}`,
              date: save.currentDate,
              title: 'สัญญาที่ให้ไว้',
              body: inboxBits.join(' · '),
              read: false,
            },
            ...save.inbox,
          ].slice(0, 40)
        : save.inbox,
  }
  next = { ...next, dynamics: recomputeDynamics(next) }
  return next
}

/** คำขอรอตอบของทีมคุณเท่านั้น */
export function pendingTalkRequests(save: GameSave): PlayerTalkRequest[] {
  return ensureTalks(save).requests.filter(
    (r) =>
      r.status === 'pending' &&
      (r.clubId ?? save.players.find((p) => p.id === r.playerId)?.clubId) === save.humanClubId,
  )
}

export function requestKindLabel(kind: PlayerRequestKind, labelTh?: string): string {
  return labelTh || REQUEST_LABEL[kind] || kind
}

export function talkDialogCount(): number {
  return TALK_DIALOGS.length
}

export function talkKindCount(): number {
  return TALK_KINDS.length || new Set(TALK_DIALOGS.map((d) => d.kind)).size
}
