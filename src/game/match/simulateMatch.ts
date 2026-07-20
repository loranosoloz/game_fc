/**
 * Layered Match Simulation — ประตูเกิดจาก Action ไม่ใช่ binomial ล่วงหน้า
 * Fidelity: human = มากกว่า sequences, AI = หยาบกว่า (สมการเดียวกัน)
 */
import type {
  Club,
  Fixture,
  FormationId,
  MatchBreakdown,
  MatchEvent,
  MatchResult,
  Player,
  Referee,
  Tactics,
  TeamMatchStats,
  TeamTalkKind,
} from '../types'
import { FORMATION_SLOTS, formationLabel } from '../types'
import { getReferee, refereeKickoffNote } from '../referees'
import { weatherMatchModifiers } from '../weather'
import { coachMatchModifiers, getWorldCoach } from '../worldCoaches'
import { FORMATION_ANCHORS, FORMATION_SPATIAL, widthLambda } from './formationAnchors'
import { attractorOffset, ROLE_VECTORS } from './attractors'
import { countInZone, overloadPressureFactor, primaryZone } from './zones'
import { findFreePlayers, passNetworkScore, roleFitPenalty } from './passNetwork'
import { minTti, pitchControlProb, reactionTime, vmax } from './spatial'
import {
  defaultPsych,
  psychFromTeamTalk,
  type AgentPsychMods,
  type TouchlineShout,
  processTouchlineShout,
} from './touchlineShouts'
import {
  decideCard,
  matchHasVar,
  varCheckGoal,
  varCheckRed,
  varEventText,
  type CardIssue,
} from './disciplineSim'
import { keyEventCount, springTicksPerKeyEvent, timingNoteTh } from './engineTiming'
import { resolveTackle } from './foulMatrix'
import { resolveShapeAnchor, shapeNoteTh } from './shapeDynamic'
import type { HalfTimeSub, MatchMidState } from './halfTime'
import { applyHalfTimeTactics, MAX_MATCH_SUBS } from './halfTime'
import { aiSolveGame } from './aiSolveGame'
import { STOPPAGE, ceilStoppageMinutes, stoppageAnnounceTh } from './stoppageTime'
import { resolveCorner, resolveFreeKick } from './setPieces'
import type { AgentLike } from './setPiecesTypes'
import { resolvePassBlock } from './passBlocking'
import {
  familiarityActionPenalty,
  familiarityBlunderChance,
  familiarityPositionNoise,
} from './tacticalFamiliarity'
import {
  createBurstState,
  effectiveCondition,
  rollBurstInjury,
  tickMatchFatigue,
  type BurstState,
} from './matchFatigue'
import {
  firstTouchFailChance,
  passTooLongForPitch,
  pitchPhysicsFromWeather,
} from './pitchPhysics'
import {
  computeCrowdPressure,
  estimateAttendance,
  isCrowdPressureSpot,
  type CrowdPressure,
} from './crowdPressure'
import {
  applyCounterToTactics,
  parseTacticalCounter,
} from './tacticalCounter'
import { ppmNote, ppmUtilityMult } from './playerTraits'
import {
  UnderloadTracker,
  crowdCommentary,
  lateHomeFightCommentary,
} from './adaptiveCommentary'
import {
  accumulateFromEvents,
  createPerf,
  finalizePlayerRatings,
  shotXg,
} from './playerPerformance'
import { applyInjury, rollInjury } from '../medical'
import { fanTicketMultiplier } from '../fans'
import type { FanState } from '../types'
import {
  buildPenOrder,
  needsDecisiveWinner,
  simulatePenaltyShootout,
} from './knockout'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function gaussian(rng: () => number): number {
  const u = Math.max(1e-9, rng())
  const v = Math.max(1e-9, rng())
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

interface Agent {
  id: string
  team: 'home' | 'away'
  player: Player
  role: import('../types').RoleCode
  slotIndex: number
  x: number
  y: number
  anchorX: number
  anchorY: number
  condition: number
  psych: AgentPsychMods
  fit: number
  burst: BurstState
}

export interface SimulateMatchOpts {
  seedExtra?: number
  humanDynamicsBonus?: number
  referee?: Referee
  fidelity?: 'human' | 'ai'
  teamTalk?: TeamTalkKind | null
  humanClubId?: string
  pendingShouts?: TouchlineShout[]
  /** ขอเปลี่ยนตัวล่วงหน้า — ลงสนามเมื่อบอลออกเท่านั้น */
  pendingHumanSubs?: HalfTimeSub[]
  /** ไม่ลงตัวคิวก่อนนาทีนี้ (เช่น ขอกลางเกมที่ 55') */
  pendingSubsEarliestMinute?: number
  /** full = ทั้งนัด · firstHalf · secondHalf · extraTime */
  phase?: 'full' | 'firstHalf' | 'secondHalf' | 'secondHalfClose' | 'extraTime'
  resume?: MatchMidState
  /** @deprecated ไม่ใช้แล้ว — ไม่มีหน้าต่างกลางเกม */
  pauseAtMinute?: number
  humanCtx?: {
    humanClubId: string
    managerName: string
    manager: {
      style: import('../worldCoaches').CoachStyleId
      power: number
      attackingIQ: number
      defendingIQ: number
      manManagement: number
      adaptability: number
      strongVs: string[]
      weakVs: string[]
    } | null
  }
  /** Crowd / fans สำหรับ Home Advantage */
  crowd?: {
    attendance?: number
    passion?: number
    fans?: FanState
  }
}

export type LayeredMatchOutput = MatchResult & { midState?: MatchMidState }

function buildSide(
  team: 'home' | 'away',
  tactics: Tactics,
  players: Player[],
  talk: TeamTalkKind | null | undefined,
  isHuman: boolean,
  opponentClubId?: string,
): Agent[] {
  const formation = tactics.formation
  const anchors = FORMATION_ANCHORS[formation]
  const slots = FORMATION_SLOTS[formation]
  const talkMods = isHuman ? psychFromTeamTalk(talk) : { moraleMod: 1, focusMod: 1 }
  const agents: Agent[] = []
  for (let i = 0; i < 11; i++) {
    const pid = tactics.startingXi[i]
    const p = players.find((x) => x.id === pid)
    if (!p) continue
    const unavailable =
      p.injuryDays > 0 || (p.banMatches ?? 0) > 0 || (p.leaveDays ?? 0) > 0 || (p.illnessDays ?? 0) > 0
    if (unavailable) continue
    // ห้ามลงแข่งเจอทีมแม่ (loan exclusivity)
    if (opponentClubId && p.loanParentClubId === opponentClubId) continue
    const slotRole = slots[i] ?? p.role
    const an = anchors[i] ?? { x: 50, y: 50, role: slotRole }
    const psych = defaultPsych()
    psych.moraleMod = talkMods.moraleMod
    psych.focusMod = talkMods.focusMod
    agents.push({
      id: p.id,
      team,
      player: p,
      role: slotRole,
      slotIndex: i,
      x: an.x,
      y: an.y,
      anchorX: an.x,
      anchorY: an.y,
      condition: p.condition,
      psych,
      fit: roleFitPenalty(p.role, slotRole),
      burst: createBurstState(p.condition),
    })
  }
  return agents
}

function updatePositions(
  agents: Agent[],
  ballX: number,
  ballY: number,
  tacticsByTeam: Record<'home' | 'away', Tactics>,
  possessing: 'home' | 'away',
  rng: () => number,
  /** Smaller = finer spring step between key events */
  springAlpha = 0.55,
) {
  for (const side of ['home', 'away'] as const) {
    const tac = tacticsByTeam[side]
    const famNoise = familiarityPositionNoise(tac.familiarity)
    const { lx, ly } = widthLambda(tac.instructions.width)
    const inPoss = possessing === side
    const attackingUp = side === 'home'
    const formIp = tac.formation as FormationId
    const formOop = (tac.formationOop ?? tac.formation) as FormationId
    for (const a of agents.filter((x) => x.team === side)) {
      // Dynamic IP / OOP anchor each tick
      const shape = resolveShapeAnchor(a.slotIndex, formIp, formOop, inPoss)
      a.anchorX = shape.x
      a.anchorY = shape.y
      const attr = a.player.attrs
      const errScale =
        (((1 - attr.positioning / 99) * 6 + (1 - attr.workRate / 99) * 3) / a.psych.focusMod) *
        famNoise
      let tx = a.anchorX + lx * (ballX - 50)
      let ty = a.anchorY + ly * ((attackingUp ? ballY : 100 - ballY) - 50) * 0.25
      const off = attractorOffset(a.role, tac.instructions.mentality, inPoss, attackingUp)
      tx += off.dx
      ty += off.dy
      const spatial = FORMATION_SPATIAL[formIp]
      if (inPoss && spatial.falseNineDrop && (a.role === 'SS' || a.role === 'ST')) {
        ty -= spatial.falseNineDrop * (attackingUp ? 1 : -1) * 0.15
        if (attackingUp) ty -= spatial.falseNineDrop * 0.35
        else ty += spatial.falseNineDrop * 0.35
      }
      tx += (rng() - 0.5) * errScale * 0.35
      ty += (rng() - 0.5) * errScale * 0.35
      a.x = clamp(a.x + (tx - a.x) * springAlpha, 2, 98)
      a.y = clamp(a.y + (ty - a.y) * springAlpha, 2, 98)
    }
  }
}

function blankStats(): TeamMatchStats {
  return {
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    possession: 50,
    xg: 0,
  }
}

export function simulateLayeredMatch(
  fixture: Fixture,
  clubs: Club[],
  players: Player[],
  tacticsByClub: Record<string, Tactics>,
  opts: SimulateMatchOpts = {},
): LayeredMatchOutput {
  // ทั้งนัด = ครึ่งแรก → ครึ่งหลังเต็ม → ต่อเวลา/จุดโทษถ้าถ้วยเสมอ
  if ((opts.phase ?? 'full') === 'full') {
    const first = simulateLayeredMatch(fixture, clubs, players, tacticsByClub, {
      ...opts,
      phase: 'firstHalf',
    })
    if (!first.midState) return first
    return simulateLayeredMatch(fixture, clubs, players, tacticsByClub, {
      ...opts,
      phase: 'secondHalf',
      resume: first.midState,
      pendingShouts: undefined,
      teamTalk: null,
      pauseAtMinute: undefined,
    })
  }

  const seed =
    fixture.matchday * 10_000 +
    fixture.homeClubId.charCodeAt(fixture.homeClubId.length - 1) * 97 +
    fixture.awayClubId.charCodeAt(fixture.awayClubId.length - 1) * 13 +
    (opts.seedExtra ?? 0) +
    (opts.phase === 'secondHalf' ? 3331 : 0)
  const rng = mulberry32(seed)

  const homeClub = clubs.find((c) => c.id === fixture.homeClubId)!
  const awayClub = clubs.find((c) => c.id === fixture.awayClubId)!
  let homeTactics = tacticsByClub[fixture.homeClubId]
  let awayTactics = tacticsByClub[fixture.awayClubId]
  const homeForm = homeTactics.formation as FormationId
  const awayForm = awayTactics.formation as FormationId

  const humanId = opts.humanClubId ?? opts.humanCtx?.humanClubId
  const homeIsHuman = humanId === fixture.homeClubId
  const awayIsHuman = humanId === fixture.awayClubId
  const phase = opts.phase ?? 'full'
  const resume = opts.resume

  const sentOff = new Set(resume?.sentOffIds ?? [])
  const matchYellows = new Map<string, number>(resume?.matchYellows ?? [])

  let homeAgents = buildSide(
    'home',
    homeTactics,
    players,
    phase === 'secondHalf' ? opts.teamTalk : opts.teamTalk,
    homeIsHuman,
    fixture.awayClubId,
  )
  let awayAgents = buildSide(
    'away',
    awayTactics,
    players,
    phase === 'secondHalf' && awayIsHuman ? opts.teamTalk : undefined,
    awayIsHuman,
    fixture.homeClubId,
  )

  // On 2H resume: rebuild from current tactics XI (หลัง HT subs), drop sent-off, restore fatigue
  if (phase === 'secondHalf' && resume) {
    const restoreSide = (
      team: 'home' | 'away',
      tactics: Tactics,
      isHuman: boolean,
    ): Agent[] => {
      const talk = isHuman ? opts.teamTalk : null
      const xi = tactics.startingXi.filter((id) => !sentOff.has(id))
      const rebuilt = buildSide(
        team,
        { ...tactics, startingXi: xi },
        players,
        talk,
        isHuman,
        team === 'home' ? fixture.awayClubId : fixture.homeClubId,
      )
      return rebuilt.map((a) => ({
        ...a,
        condition: resume.conditions[a.id] ?? a.condition,
        burst: createBurstState(resume.conditions[a.id] ?? a.condition),
      }))
    }
    homeAgents = restoreSide('home', homeTactics, homeIsHuman)
    awayAgents = restoreSide('away', awayTactics, awayIsHuman)
  }

  // fallback XI if empty
  if (homeAgents.length < 8) {
    homeAgents = players
      .filter((p) => p.clubId === fixture.homeClubId && !sentOff.has(p.id))
      .slice(0, 11)
      .map((p, i) => {
        const an = FORMATION_ANCHORS[homeForm][i]!
        return {
          id: p.id,
          team: 'home' as const,
          player: p,
          role: an.role,
          slotIndex: i,
          x: an.x,
          y: an.y,
          anchorX: an.x,
          anchorY: an.y,
          condition: resume?.conditions[p.id] ?? p.condition,
          psych: defaultPsych(),
          fit: 1,
          burst: createBurstState(resume?.conditions[p.id] ?? p.condition),
        }
      })
  }
  if (awayAgents.length < 8) {
    awayAgents = players
      .filter((p) => p.clubId === fixture.awayClubId && !sentOff.has(p.id))
      .slice(0, 11)
      .map((p, i) => {
        const an = FORMATION_ANCHORS[awayForm][i]!
        return {
          id: p.id,
          team: 'away' as const,
          player: p,
          role: an.role,
          slotIndex: i,
          x: an.x,
          y: an.y,
          anchorX: an.x,
          anchorY: an.y,
          condition: resume?.conditions[p.id] ?? p.condition,
          psych: defaultPsych(),
          fit: 1,
          burst: createBurstState(resume?.conditions[p.id] ?? p.condition),
        }
      })
  }

  const all = () => [...homeAgents, ...awayAgents]
  const fidelity = opts.fidelity ?? (homeIsHuman || awayIsHuman ? 'human' : 'ai')
  const keyEventsTotal = keyEventCount(fidelity)
  const keyEvents1H = Math.ceil(keyEventsTotal / 2)
  const keyEvents2H = keyEventsTotal - keyEvents1H
  const keyEventsClose = Math.max(6, Math.floor(keyEvents2H * 0.4))
  const keyEvents =
    phase === 'secondHalfClose'
      ? keyEventsClose
      : phase === 'extraTime'
        ? Math.max(8, Math.floor(keyEvents1H * 0.45))
        : phase === 'secondHalf'
          ? keyEvents2H
          : keyEvents1H
  const springPerEvent = springTicksPerKeyEvent(fidelity)
  const springAlpha = 0.22 + 0.08 * (8 / springPerEvent)
  const minuteBase =
    phase === 'secondHalfClose' ? 70 : phase === 'extraTime' ? 90 : phase === 'secondHalf' ? 45 : 0
  const minuteSpan =
    phase === 'secondHalfClose' ? 20 : phase === 'extraTime' ? 15 : 45
  let wentToExtraTime = resume && (resume.clockMinute ?? 0) >= 90 ? true : false
  let wentToPens = false
  let penalties: { home: number; away: number } | undefined
  let homeSubsUsed = resume?.homeSubsUsed ?? resume?.subsUsed ?? 0
  /** เปลี่ยนตัวที่ขอแล้ว แต่รอบอลออกนอกสนามก่อนลงสนาม */
  const pendingSubs: Array<{ side: 'home' | 'away'; outId: string; inId: string }> = []
  let awaySubsUsed = resume?.awaySubsUsed ?? 0
  const maxSubs = resume?.maxSubs ?? MAX_MATCH_SUBS
  let lastAiSolveMinute = -99

  const wx = weatherMatchModifiers(fixture.weather ?? 'clear')
  const pitch = pitchPhysicsFromWeather(fixture.weather ?? 'clear')
  const inMatchInjuries: NonNullable<import('../types').MatchResult['inMatchInjuries']> = []

  const fanMult = opts.crowd?.fans
    ? fanTicketMultiplier(opts.crowd.fans, fixture.matchday)
    : 1
  const attendance =
    opts.crowd?.attendance ??
    fixture.attendance ??
    estimateAttendance(homeClub.stadiumCapacity, homeClub.reputation, fanMult)
  const passion =
    opts.crowd?.passion ??
    Math.min(
      100,
      (opts.crowd?.fans?.factions?.ultras ?? 35) * 0.9 +
        (opts.crowd?.fans?.mood ?? 50) * 0.35 +
        homeClub.reputation * 0.15,
    )
  const crowd: CrowdPressure = computeCrowdPressure({
    attendance,
    stadiumCapacity: homeClub.stadiumCapacity,
    passion,
  })
  const underloadTracker = new UnderloadTracker()
  let lateFightAnnounced = false
  let possessionTicks = { home: 0, away: 0 }

  const perfMap = new Map<string, ReturnType<typeof createPerf>>()
  const touchPerf = (a: { id: string; player: { name: string; overall: number }; team: 'home' | 'away' }) => {
    let p = perfMap.get(a.id)
    if (!p) {
      p = createPerf(a.id, a.player.name, a.team, a.player.overall)
      perfMap.set(a.id, p)
    }
    return p
  }
  for (const a of [...homeAgents, ...awayAgents]) touchPerf(a)
  // ครึ่งหลัง — ดึงสกอร์/ยิงจาก events ครึ่งแรกเข้าสะสมเรตติ้ง
  if (resume?.events?.length) {
    for (const ev of resume.events) {
      if (!ev.playerId) continue
      let p = perfMap.get(ev.playerId)
      if (!p) {
        const ag = all().find((a) => a.id === ev.playerId)
        p = createPerf(
          ev.playerId,
          ev.playerName ?? ag?.player.name ?? ev.playerId,
          ag?.team ?? 'home',
          ag?.player.overall ?? 70,
        )
        perfMap.set(ev.playerId, p)
      }
      if (ev.kind === 'goal') {
        p.goals += 1
        p.shots += 1
        p.shotsOnTarget += 1
        p.xgContrib += 0.35
        p.minutes = Math.max(p.minutes, ev.minute)
      } else if (ev.kind === 'shot') {
        p.shots += 1
        p.keyActions += 1
        p.minutes = Math.max(p.minutes, ev.minute)
      } else if (ev.kind === 'save') {
        p.saves += 1
        p.keyActions += 1
      } else if (ev.kind === 'foul') {
        p.fouls += 1
      } else if (ev.kind === 'card') {
        if (ev.cardColor === 'red') p.reds += 1
        else p.yellows += 1
      }
    }
  }
  const coachMod = coachMatchModifiers(
    homeClub,
    awayClub,
    getWorldCoach(homeClub.coachId)?.style ?? homeTactics.instructions.style,
    getWorldCoach(awayClub.coachId)?.style ?? awayTactics.instructions.style,
    opts.humanCtx
      ? {
          humanClubId: opts.humanCtx.humanClubId,
          manager: opts.humanCtx.manager
            ? { name: opts.humanCtx.managerName, ...opts.humanCtx.manager }
            : null,
        }
      : undefined,
  )

  let homeGoals = resume?.homeGoals ?? 0
  let awayGoals = resume?.awayGoals ?? 0
  let prevHomeGoals = homeGoals
  let prevAwayGoals = awayGoals
  const homeStats = resume ? { ...resume.homeStats } : blankStats()
  const awayStats = resume ? { ...resume.awayStats } : blankStats()
  const events: MatchEvent[] = resume ? [...resume.events] : []
  let eid = resume?.nextEid ?? 0
  const push = (
    minute: number,
    kind: MatchEvent['kind'],
    text: string,
    spot: { x: number; y: number },
    extra?: Partial<MatchEvent>,
  ) => {
    events.push({
      id: `ev-${fixture.id}-${eid++}`,
      minute,
      kind,
      text,
      spot,
      homeGoals,
      awayGoals,
      ...extra,
    })
  }

  const ref = opts.referee ?? getReferee(fixture.refereeId) ?? getReferee('ref-01')!
  if (phase === 'firstHalf' || phase === undefined) {
    push(0, 'kickoff', refereeKickoffNote(ref), { x: 50, y: 50 })
    if (pitch.noteTh !== 'สนามปกติ') {
      push(0, 'commentary', pitch.noteTh, { x: 50, y: 50 })
    }
    push(
      0,
      'commentary',
      `${crowd.noteTh} · ผู้ชม ~${attendance.toLocaleString('th-TH')}`,
      { x: 50, y: 50 },
      { clubId: homeClub.id },
    )
  } else if (phase === 'secondHalf') {
    push(
      45,
      'secondhalf',
      `เริ่มครึ่งหลัง! ${homeClub.shortName} ${homeGoals}–${awayGoals} ${awayClub.shortName}`,
      { x: 50, y: 50 },
    )
  } else if (phase === 'secondHalfClose') {
    push(
      70,
      'tactical_window',
      `เล่นต่อหลังหน้าต่างเปลี่ยนตัว · ${homeClub.shortName} ${homeGoals}–${awayGoals} ${awayClub.shortName}`,
      { x: 50, y: 50 },
    )
  } else if (phase === 'extraTime') {
    push(
      90,
      'extratime',
      `ต่อเวลา! ${homeClub.shortName} ${homeGoals}–${awayGoals} ${awayClub.shortName}`,
      { x: 50, y: 50 },
    )
    wentToExtraTime = true
  }

  const freeNotes: string[] = []
  const overloadNotes: string[] = []
  const shoutNotes: string[] = []

  // apply pending shouts at start of phase to human XI
  if (opts.pendingShouts?.length && humanId) {
    const ctx = {
      homeGoals,
      awayGoals,
      minute: phase === 'secondHalf' ? 46 : 1,
      humanIsHome: homeIsHuman,
    }
    for (const shout of opts.pendingShouts) {
      const side = homeIsHuman ? homeAgents : awayAgents
      for (const a of side) {
        a.psych = processTouchlineShout(a.player, shout, ctx)
        if (a.psych.note) shoutNotes.push(a.psych.note)
      }
    }
  }

  // HT team talk psych (2H)
  if (phase === 'secondHalf' && opts.teamTalk && humanId) {
    const talkMods = psychFromTeamTalk(opts.teamTalk)
    const side = homeIsHuman ? homeAgents : awayAgents
    for (const a of side) {
      a.psych = {
        ...a.psych,
        moraleMod: a.psych.moraleMod * talkMods.moraleMod,
        focusMod: a.psych.focusMod * talkMods.focusMod,
      }
    }
  }

  let possessing: 'home' | 'away' =
    resume?.possessing ??
    (rng() < 0.5 + (opts.humanDynamicsBonus ?? 1) * 0.02 ? 'home' : 'away')
  let ballX = 50
  let ballY = 50
  const hasVar = matchHasVar(fixture.competition, ref)
  /** สะสมเศษนาทีทดเวลาในครึ่งนี้ */
  let stoppageAccum = 0
  const bumpStoppage = (mins: number) => {
    stoppageAccum += mins
  }

  const spatialHint = (form: FormationId) => FORMATION_SPATIAL[form]

  const dismissAgent = (agent: Agent) => {
    sentOff.add(agent.id)
    if (agent.team === 'home') homeAgents = homeAgents.filter((a) => a.id !== agent.id)
    else awayAgents = awayAgents.filter((a) => a.id !== agent.id)
  }

  const nearestDefender = (defs: Agent[], x: number, y: number): Agent | null => {
    if (defs.length === 0) return null
    return [...defs].sort(
      (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
    )[0]!
  }

  /** Issue yellow/red with VAR + send-off. Returns true if player left the pitch. */
  const issueBooking = (
    fouler: Agent,
    minute: number,
    spot: { x: number; y: number },
    nearOwnBox: boolean,
    precomputed?: CardIssue | null,
  ): boolean => {
    const defClubId = fouler.team === 'home' ? homeClub.id : awayClub.id
    const defStats = fouler.team === 'home' ? homeStats : awayStats
    const alreadyY = (matchYellows.get(fouler.id) ?? 0) >= 1
    const decision =
      precomputed ??
      decideCard(rng, ref, fouler.psych.aggressionMod, nearOwnBox, alreadyY, fouler.team === 'away')
    if (!decision) return false

    let color = decision.color
    let secondYellow = decision.secondYellow
    let label = decision.text

    // borderline yellow → possible VAR upgrade before we lock it in
    if (color === 'yellow') {
      const up = varCheckRed(rng, hasVar, false)
      if (up === 'upgrade') {
        bumpStoppage(STOPPAGE.varCheck)
        push(minute, 'var', `VAR ตรวจสอบการแทรกแซงของ ${fouler.player.name}...`, spot, {
          clubId: defClubId,
          playerId: fouler.id,
        })
        color = 'red'
        secondYellow = false
        label = varEventText('upgrade', fouler.player.name)
        push(minute, 'var', label, spot, { clubId: defClubId, playerId: fouler.id })
      }
    }

    if (color === 'yellow') {
      matchYellows.set(fouler.id, (matchYellows.get(fouler.id) ?? 0) + 1)
      defStats.yellows += 1
      push(minute, 'card', `${label} · ${fouler.player.name}`, spot, {
        clubId: defClubId,
        playerId: fouler.id,
        playerName: fouler.player.name,
        cardColor: 'yellow',
      })
      return false
    }

    // Red path (straight or second yellow)
    if (secondYellow) {
      matchYellows.set(fouler.id, (matchYellows.get(fouler.id) ?? 0) + 1)
      defStats.yellows += 1
      push(minute, 'card', `ใบเหลือง · ${fouler.player.name}`, spot, {
        clubId: defClubId,
        playerId: fouler.id,
        playerName: fouler.player.name,
        cardColor: 'yellow',
      })
    }

    // VAR may downgrade straight red (not 2Y — those stay)
    if (!secondYellow) {
      const review = varCheckRed(rng, hasVar, true)
      if (review !== 'none') {
        push(minute, 'var', `VAR ตรวจสอบใบแดงของ ${fouler.player.name}...`, spot, {
          clubId: defClubId,
          playerId: fouler.id,
        })
        if (review === 'downgrade') {
          matchYellows.set(fouler.id, (matchYellows.get(fouler.id) ?? 0) + 1)
          defStats.yellows += 1
          push(minute, 'var', varEventText('downgrade', fouler.player.name), spot, {
            clubId: defClubId,
            playerId: fouler.id,
          })
          push(minute, 'card', `ใบเหลือง · ${fouler.player.name}`, spot, {
            clubId: defClubId,
            playerId: fouler.id,
            playerName: fouler.player.name,
            cardColor: 'yellow',
          })
          return false
        }
        push(minute, 'var', varEventText('confirm', fouler.player.name), spot, {
          clubId: defClubId,
          playerId: fouler.id,
        })
      }
    }

    defStats.reds += 1
    push(minute, 'card', `${label} · ${fouler.player.name}`, spot, {
      clubId: defClubId,
      playerId: fouler.id,
      playerName: fouler.player.name,
      cardColor: 'red',
    })
    // Numerical disadvantage: remaining teammates lose a bit of composure
    const mates = (fouler.team === 'home' ? homeAgents : awayAgents).filter(
      (a) => a.id !== fouler.id,
    )
    for (const m of mates) {
      m.psych = {
        ...m.psych,
        moraleMod: m.psych.moraleMod * 0.97,
        focusMod: m.psych.focusMod * 0.98,
      }
    }
    dismissAgent(fouler)
    return true
  }

  /** Take a penalty kick for the attacking side (after foul in box). */
  const resolvePenaltyKick = (
    taker: Agent,
    minute: number,
    spot: { x: number; y: number },
  ) => {
    const atkClub = taker.team === 'home' ? homeClub : awayClub
    const atkStats = taker.team === 'home' ? homeStats : awayStats
    const defs = taker.team === 'home' ? awayAgents : homeAgents
    const gk = defs.find((d) => d.role === 'GK') ?? defs[0]
    push(minute, 'penalty', `จุดโทษ! ${taker.player.name} เตรียมยิง`, spot, {
      clubId: atkClub.id,
      playerId: taker.id,
      playerName: taker.player.name,
    })
    atkStats.shots += 1
    const finish = (taker.player.attrs.finishing + taker.player.attrs.composure) / 2 / 99
    const gkStr = gk
      ? (gk.player.attrs.handling + gk.player.attrs.reflexes) / 2 / 99
      : 0.5
    const scored = rng() < clamp(0.55 + finish * 0.35 - gkStr * 0.25, 0.35, 0.88)
    if (scored) {
      atkStats.shotsOnTarget += 1
      if (taker.team === 'home') homeGoals += 1
      else awayGoals += 1
      push(minute, 'goal', `จุดโทษเข้า! ${taker.player.name}`, { x: 50, y: taker.team === 'home' ? 92 : 8 }, {
        clubId: atkClub.id,
        playerId: taker.id,
        playerName: taker.player.name,
        fromPenalty: true,
      })
    } else {
      push(minute, 'save', `เซฟจุดโทษ!`, { x: 50, y: taker.team === 'home' ? 95 : 5 }, {
        clubId: taker.team === 'home' ? awayClub.id : homeClub.id,
        playerId: gk?.id,
      })
      atkStats.shotsOnTarget += 1
    }
    possessing = taker.team === 'home' ? 'away' : 'home'
    ballX = 50
    ballY = 50
    onDeadBall(minute)
  }

  const rebuildSide = (side: 'home' | 'away', tactics: Tactics) => {
    const conds: Record<string, number> = {}
    for (const a of side === 'home' ? homeAgents : awayAgents) conds[a.id] = a.condition
    const rebuilt = buildSide(
      side,
      tactics,
      players,
      null,
      false,
      side === 'home' ? fixture.awayClubId : fixture.homeClubId,
    )
      .filter((a) => !sentOff.has(a.id))
      .map((a) => {
        const prev = (side === 'home' ? homeAgents : awayAgents).find((x) => x.id === a.id)
        return {
          ...a,
          condition: conds[a.id] ?? a.condition,
          burst: prev?.burst ?? createBurstState(conds[a.id] ?? a.condition),
        }
      })
    if (side === 'home') {
      homeAgents = rebuilt
      homeTactics = tactics
    } else {
      awayAgents = rebuilt
      awayTactics = tactics
    }
  }

  const pendingCount = (side: 'home' | 'away') =>
    pendingSubs.filter((p) => p.side === side).length

  /** คิวเปลี่ยนตัว — ลงสนามเมื่อบอลออกเท่านั้น */
  const queueSubs = (side: 'home' | 'away', subs: HalfTimeSub[], minute: number) => {
    if (!subs.length) return
    const club = side === 'home' ? homeClub : awayClub
    let queued = 0
    for (const s of subs) {
      if (pendingSubs.some((p) => p.outId === s.outId || p.inId === s.inId)) continue
      pendingSubs.push({ side, outId: s.outId, inId: s.inId })
      queued += 1
    }
    if (queued > 0) {
      push(
        minute,
        'commentary',
        `ขอเปลี่ยนตัว ${queued} คน — รอจนบอลออกนอกสนาม`,
        { x: 50, y: 50 },
        { clubId: club.id },
      )
    }
  }

  /** บอลตาย / ออกนอกสนาม → ลงตัวสำรองที่คิวไว้ */
  const commitPendingSubs = (minute: number) => {
    if (pendingSubs.length === 0) return
    const earliest = opts.pendingSubsEarliestMinute ?? 0
    if (minute < earliest) return
    const batch = pendingSubs.splice(0, pendingSubs.length)
    let appliedTotal = 0
    for (const side of ['home', 'away'] as const) {
      const sideSubs = batch
        .filter((s) => s.side === side)
        .map(({ outId, inId }) => ({ outId, inId }))
      if (!sideSubs.length) continue
      const club = side === 'home' ? homeClub : awayClub
      const tac = side === 'home' ? homeTactics : awayTactics
      const used = side === 'home' ? homeSubsUsed : awaySubsUsed
      const remaining = Math.max(0, maxSubs - used)
      const { tactics, subsApplied } = applyHalfTimeTactics(
        tac,
        { subs: sideSubs },
        sentOff,
        remaining,
      )
      if (subsApplied <= 0) continue
      rebuildSide(side, tactics)
      if (side === 'home') homeSubsUsed += subsApplied
      else awaySubsUsed += subsApplied
      appliedTotal += subsApplied
      for (const s of sideSubs.slice(0, subsApplied)) {
        const outN = players.find((p) => p.id === s.outId)?.name ?? s.outId
        const inN = players.find((p) => p.id === s.inId)?.name ?? s.inId
        push(
          minute,
          'substitution',
          `เปลี่ยนตัว (บอลออก) · ${outN} ↔ ${inN}`,
          { x: 50, y: 50 },
          { clubId: club.id, playerId: s.inId, playerName: inN },
        )
      }
    }
    if (appliedTotal > 0) bumpStoppage(0.35 + appliedTotal * 0.15)
  }

  const onDeadBall = (minute: number) => {
    commitPendingSubs(minute)
  }

  /** AI แก้เกมได้ตลอด — แผน/กดทันที · เปลี่ยนตัวคิวรอบอลออก */
  const runAiSolve = (side: 'home' | 'away', minute: number, force = false) => {
    const isHumanSide =
      (side === 'home' && homeIsHuman) || (side === 'away' && awayIsHuman)
    if (isHumanSide) return

    const goalEvent =
      homeGoals !== prevHomeGoals || awayGoals !== prevAwayGoals
    const checkpoint =
      minute === 15 ||
      minute === 30 ||
      minute === 50 ||
      minute === 55 ||
      minute === 60 ||
      minute === 65 ||
      minute === 70 ||
      minute === 75 ||
      minute === 80 ||
      minute === 85 ||
      minute % 15 === 0
    if (!force && !goalEvent && !checkpoint) return
    if (!force && !goalEvent && minute - lastAiSolveMinute < 4) return

    const club = side === 'home' ? homeClub : awayClub
    const tac = side === 'home' ? homeTactics : awayTactics
    const used = side === 'home' ? homeSubsUsed : awaySubsUsed
    const ourG = side === 'home' ? homeGoals : awayGoals
    const theirG = side === 'home' ? awayGoals : homeGoals
    const oppTac = side === 'home' ? awayTactics : homeTactics
    const conds: Record<string, number> = {}
    for (const a of side === 'home' ? homeAgents : awayAgents) conds[a.id] = a.condition

    const tickTotal = Math.max(1, possessionTicks.home + possessionTicks.away)
    const oppPossShare =
      side === 'home'
        ? possessionTicks.away / tickTotal
        : possessionTicks.home / tickTotal

    let baseTac = tac
    const counter = parseTacticalCounter(
      {
        possessionShare: oppPossShare,
        formation: oppTac.formation,
        mentality: oppTac.instructions.mentality,
        pressing: oppTac.instructions.pressing,
        ourGoals: ourG,
        theirGoals: theirG,
        minute,
      },
      tac,
      rng,
    )
    if (counter && (force || goalEvent || minute % 15 === 0 || rng() < 0.55)) {
      baseTac = applyCounterToTactics(tac, counter)
      push(minute, 'commentary', `AI แก้เกม: ${counter.note}`, { x: 50, y: 50 }, {
        clubId: club.id,
      })
    }

    const solved = aiSolveGame({
      tactics: baseTac,
      players,
      conditions: conds,
      ourGoals: ourG,
      theirGoals: theirG,
      minute,
      remainingSubs: Math.max(0, maxSubs - used - pendingCount(side)),
      coach: getWorldCoach(club.coachId),
      rng,
      sentOffIds: sentOff,
    })

    const instrChanged =
      solved.tactics.formation !== tac.formation ||
      solved.tactics.formationOop !== tac.formationOop ||
      solved.tactics.instructions.mentality !== tac.instructions.mentality ||
      solved.tactics.instructions.pressing !== tac.instructions.pressing ||
      baseTac.formation !== tac.formation
    const changed = solved.subs.length > 0 || instrChanged

    if (!changed) {
      lastAiSolveMinute = minute
      return
    }

    // แผน/กดเปลี่ยนได้ทันที — รายชื่อ XI คงเดิมจนกว่าบอลออก
    if (instrChanged) {
      const tacKeepXi: Tactics = {
        ...solved.tactics,
        startingXi: [...tac.startingXi],
        bench: [...tac.bench],
      }
      rebuildSide(side, tacKeepXi)
      bumpStoppage(0.15)
    }
    lastAiSolveMinute = minute

    if (solved.shout) {
      push(minute, 'commentary', solved.shout, { x: 50, y: 50 }, { clubId: club.id })
    }
    if (solved.subs.length > 0) {
      queueSubs(side, solved.subs, minute)
    }
    if (solved.notes.length && rng() < 0.5) {
      push(minute, 'commentary', `AI ปรับแผน: ${solved.notes[0]}`, { x: 50, y: 50 }, {
        clubId: club.id,
      })
    }
  }

  // เริ่มครึ่งหลัง / ช่วงท้าย / ต่อเวลา — AI แก้เกมทันทีหนึ่งรอบ
  if (phase === 'secondHalf' || phase === 'secondHalfClose' || phase === 'extraTime') {
    runAiSolve('home', minuteBase + 1, true)
    runAiSolve('away', minuteBase + 1, true)
  }

  // มนุษย์ขอเปลี่ยนตัวไว้แล้ว — คิวไว้ ลงเมื่อบอลออก (ถ้าร้องตอนพัก/หน้าต่าง = บอลเคยออกแล้ว)
  if (opts.pendingHumanSubs?.length && humanId) {
    const side: 'home' | 'away' = homeIsHuman ? 'home' : 'away'
    const kickMin =
      phase === 'secondHalf' ? 45 : phase === 'secondHalfClose' ? 70 : phase === 'extraTime' ? 90 : 0
    queueSubs(side, opts.pendingHumanSubs, kickMin)
    const earliest = opts.pendingSubsEarliestMinute ?? 0
    if (
      earliest <= kickMin &&
      (phase === 'secondHalf' || phase === 'secondHalfClose' || phase === 'extraTime')
    ) {
      onDeadBall(kickMin)
    }
  }

  const toLike = (a: Agent): AgentLike => ({
    id: a.id,
    name: a.player.name,
    role: a.role,
    overall: a.player.overall,
    attrs: a.player.attrs,
  })

  const applySpOutcome = (
    outcome: import('./setPieces').SetPieceOutcome,
    minute: number,
    atkTeam: 'home' | 'away',
    atkStats: TeamMatchStats,
  ) => {
    const club = atkTeam === 'home' ? homeClub : awayClub
    const defClub = atkTeam === 'home' ? awayClub : homeClub
    if (outcome.kind === 'goal') {
      atkStats.shots += 1
      atkStats.shotsOnTarget += 1
      if (atkTeam === 'home') homeGoals += 1
      else awayGoals += 1
      bumpStoppage(STOPPAGE.goal)
      push(minute, 'goal', outcome.text, outcome.spot, {
        clubId: club.id,
        playerId: outcome.scorerId,
        playerName: outcome.scorerName,
      })
      possessing = atkTeam === 'home' ? 'away' : 'home'
      ballX = 50
      ballY = 50
      onDeadBall(minute)
    } else if (outcome.kind === 'save') {
      atkStats.shots += 1
      atkStats.shotsOnTarget += 1
      bumpStoppage(STOPPAGE.save)
      push(minute, 'save', outcome.text, outcome.spot, { clubId: defClub.id })
      possessing = atkTeam === 'home' ? 'away' : 'home'
      onDeadBall(minute)
    } else if (outcome.kind === 'short_keep') {
      push(minute, 'commentary', outcome.text, outcome.spot, {
        clubId: club.id,
        playerId: outcome.takerId,
        playerName: outcome.takerName,
      })
    } else {
      bumpStoppage(STOPPAGE.ballOut)
      push(minute, 'commentary', outcome.text, outcome.spot, {
        clubId: club.id,
        playerId: outcome.takerId,
      })
      possessing = atkTeam === 'home' ? 'away' : 'home'
      onDeadBall(minute)
    }
  }

  for (let seq = 0; seq < keyEvents; seq++) {
    const minute = Math.min(
      minuteBase + minuteSpan,
      minuteBase + Math.max(1, Math.ceil(((seq + 1) / keyEvents) * minuteSpan)),
    )

    // AI แก้เกมตลอด — หลังประตูจากจังหวะก่อน / จุดตรวจนาที
    runAiSolve('home', minute)
    runAiSolve('away', minute)

    // Engine spring ticks — continuous IP/OOP shape + ball-relative positioning
    for (let t = 0; t < springPerEvent; t++) {
      updatePositions(
        all(),
        ballX,
        ballY,
        { home: homeTactics, away: awayTactics },
        possessing,
        rng,
        springAlpha,
      )
    }

    const attackers = possessing === 'home' ? homeAgents : awayAgents
    const defenders = possessing === 'home' ? awayAgents : homeAgents
    const atkForm = possessing === 'home' ? homeForm : awayForm
    const defTac = possessing === 'home' ? awayTactics : homeTactics
    const coachAtk = possessing === 'home' ? coachMod.homeAtk : coachMod.awayAtk
    const coachDef = possessing === 'home' ? coachMod.awayDef : coachMod.homeDef
    // Numerical disadvantage after reds (10v11 etc.)
    const numAtk = attackers.length / 11
    const numDef = defenders.length / 11

    const frees = findFreePlayers(
      homeAgents.map((a) => ({ ...a, role: a.role })),
      awayAgents.map((a) => ({ ...a, role: a.role })),
      possessing,
    )
    if (frees.length && freeNotes.length < 6) {
      freeNotes.push(`${minute}' ${frees[0]!.note}`)
    }

    // pick carrier: free player preferred else highest overall near ball
    let carrier =
      attackers.find((a) => frees.some((f) => f.agentId === a.id)) ??
      [...attackers].sort((a, b) => {
        const da = Math.hypot(a.x - ballX, a.y - ballY)
        const db = Math.hypot(b.x - ballX, b.y - ballY)
        return da - db || b.player.overall - a.player.overall
      })[0]

    if (!carrier) {
      possessing = possessing === 'home' ? 'away' : 'home'
      continue
    }
    ballX = carrier.x
    ballY = carrier.y

    const zone = primaryZone(carrier.x, possessing === 'home' ? carrier.y : 100 - carrier.y)
    const ownZ = countInZone(
      all().map((a) => ({ x: a.x, y: a.y, team: a.team })),
      zone,
      possessing,
      false,
    )
    const oppZ = countInZone(
      all().map((a) => ({ x: a.x, y: a.y, team: a.team })),
      zone,
      possessing === 'home' ? 'away' : 'home',
      false,
    )
    const overloadF = overloadPressureFactor(ownZ, oppZ)
    if (ownZ > oppZ && overloadNotes.length < 5) {
      overloadNotes.push(`${minute}' Overload ${zone} (${ownZ}v${oppZ})`)
    }
    // Adaptive commentary — ฝั่งที่โดนรุม (underload) ติดต่อกัน 3 ticks
    const weakerSide: 'home' | 'away' =
      ownZ <= oppZ ? possessing : possessing === 'home' ? 'away' : 'home'
    const underHint = underloadTracker.observe(weakerSide, ownZ !== oppZ, 3)
    if (underHint) {
      push(minute, 'commentary', underHint.text, { x: carrier.x, y: carrier.y }, {
        clubId: underHint.side === 'home' ? homeClub.id : awayClub.id,
      })
    }

    possessionTicks[possessing] += 1

    // pressure from nearby defenders + opposition instructions (มาร์ก/กดดาว)
    let pressure = 0
    for (const d of defenders) {
      const dist = Math.hypot(d.x - carrier.x, d.y - carrier.y)
      if (dist < 12) pressure += (1 / Math.max(0.8, dist * dist)) * 8
    }
    const oi = defTac.opposition
    if (oi?.markPlayerId === carrier.id) {
      pressure *= oi.showOnto === 'tight' ? 1.45 : 1.28
      if (rng() < 0.08) {
        push(minute, 'commentary', `${carrier.player.name} โดนมาร์กแน่น!`, { x: carrier.x, y: carrier.y }, {
          clubId: defTac === homeTactics ? homeClub.id : awayClub.id,
          playerId: carrier.id,
        })
      }
    }
    if (oi?.pressPlayerId === carrier.id) {
      pressure *= 1.22
    }
    if (oi?.showOnto === 'weaker_foot' && oi.markPlayerId === carrier.id) {
      pressure *= 1.08
    }
    pressure *= overloadF
    pressure /= carrier.psych.perceptionMod
    // fewer defenders → less pressure; fewer attackers → harder to build
    pressure *= numDef / Math.max(0.55, numAtk)

    const net = passNetworkScore(
      attackers.map((a) => ({
        id: a.id,
        team: a.team,
        role: a.role,
        x: a.x,
        y: a.y,
        slotIndex: a.slotIndex,
      })),
      carrier.id,
    )

    const bias = spatialHint(atkForm).passBias
    let mates = attackers.filter((a) => a.id !== carrier.id && a.role !== 'GK')

    // Crowd pressure — Perception Radar หดสำหรับเยือนใจไม่นิ่ง
    const underCrowd =
      isCrowdPressureSpot(possessing, ballY) &&
      possessing === 'away' &&
      carrier.player.attrs.composure < 70
    if (underCrowd) {
      const keep = Math.max(2, Math.ceil(mates.length * crowd.awayPassRadar))
      mates = [...mates]
        .sort((a, b) => Math.hypot(a.x - carrier.x, a.y - carrier.y) - Math.hypot(b.x - carrier.x, b.y - carrier.y))
        .slice(0, keep)
      if (rng() < 0.12) {
        const cc = crowdCommentary(crowd.intensity, false)
        if (cc) push(minute, 'commentary', cc, { x: carrier.x, y: carrier.y }, { clubId: awayClub.id })
      }
    }

    type Action = { kind: 'pass' | 'dribble' | 'shoot'; target?: Agent; u: number; diff: number }
    const actions: Action[] = []

    for (const m of mates.slice(0, 6)) {
      const dist = Math.hypot(m.x - carrier.x, m.y - carrier.y)
      const tOwn = minTti(
        attackers.map((a) => ({
          x: a.x,
          y: a.y,
          treaction: reactionTime(
            a.player.attrs.decision,
            a.player.attrs.positioning,
            a.player.attrs.composure * (underCrowd ? crowd.awayNerve : 1),
            a.psych.focusMod,
          ),
          vmax: vmax(a.player.attrs.pace, a.condition, a.player.attrs.stamina, false),
        })),
        m.x,
        m.y,
      )
      const tOpp = minTti(
        defenders.map((a) => ({
          x: a.x,
          y: a.y,
          treaction: reactionTime(
            a.player.attrs.decision,
            a.player.attrs.positioning,
            a.player.attrs.composure,
            a.psych.focusMod,
          ),
          vmax: vmax(a.player.attrs.pace, a.condition, a.player.attrs.stamina, false),
        })),
        m.x,
        m.y,
      )
      const pc = pitchControlProb(tOwn, tOpp)
      const attrRaw =
        (carrier.player.attrs.passing + carrier.player.attrs.technique + carrier.player.attrs.vision) / 3
      let u =
        0.55 * (attrRaw / 99) +
        0.25 * pc +
        0.15 * net.triangleBonus -
        0.2 * pressure +
        (frees.some((f) => f.agentId === m.id) ? 0.18 : 0)
      if (bias === 'triangulation' && dist < 22) u += 0.08
      if (bias === 'direct' && dist > 28) u += 0.06
      if (bias === 'flank' && (m.role === 'LM' || m.role === 'RM' || m.role === 'LW' || m.role === 'RW'))
        u += 0.07
      if (bias === 'central_am' && (m.role === 'CAM' || m.role === 'ST')) u += 0.07
      if (bias === 'long_to_st' && m.role === 'ST') u += 0.09
      // PPM — บวก utility ตามนิสัย (ขัดแผนได้)
      const passKind = dist >= 26 ? 'pass_long' : 'pass_short'
      u *= ppmUtilityMult(carrier.player.skills, passKind)
      u *= carrier.fit * m.fit * numAtk
      if (underCrowd) u *= crowd.awayNerve
      // คู่แข่งมาร์ก/กดเป้าพาส
      if (defTac.opposition?.markPlayerId === m.id) u *= 0.72
      if (defTac.opposition?.pressPlayerId === m.id) u *= 0.85
      const risk = ROLE_VECTORS[carrier.role].vectors.passingRiskTolerance
      const diff = (dist / 35) * (1.1 - risk * 0.3) * (wx.attack < 1 ? 1.08 : 1)
      actions.push({ kind: 'pass', target: m, u, diff })
    }

    // dribble
    {
      const attrRaw = (carrier.player.attrs.dribbling + carrier.player.attrs.pace + carrier.player.attrs.agility) / 3
      let u = 0.4 * (attrRaw / 99) - 0.25 * pressure + 0.05
      u *= ppmUtilityMult(carrier.player.skills, 'dribble')
      actions.push({ kind: 'dribble', u, diff: 0.55 + pressure * 0.1 })
    }

    // shoot if advanced
    const prog = possessing === 'home' ? carrier.y : 100 - carrier.y
    if (prog > 62) {
      const attrRaw =
        (carrier.player.attrs.finishing +
          carrier.player.attrs.composure * (underCrowd ? crowd.awayNerve : 1) +
          carrier.player.attrs.technique) /
        3
      let u = 0.35 * (attrRaw / 99) + (prog - 62) / 80 - 0.15 * pressure
      if (zone === 'zone14' || zone === 'box_opp' || zone === 'am') u += 0.12
      u *= coachAtk * wx.attack * numAtk
      u *= ppmUtilityMult(carrier.player.skills, 'shoot')
      const gk = defenders.find((d) => d.role === 'GK') ?? defenders[0]
      const gkStr = gk
        ? (gk.player.attrs.handling + gk.player.attrs.reflexes) / 2 / 99
        : 0.5
      let diff = 0.45 + gkStr * 0.4 * coachDef + (100 - prog) / 120
      if (oi?.showOnto === 'weaker_foot' && oi.markPlayerId === carrier.id) {
        diff *= 1.18
        u *= 0.9
      }
      actions.push({ kind: 'shoot', u, diff })
    }

    if (actions.length === 0) {
      possessing = possessing === 'home' ? 'away' : 'home'
      continue
    }

    actions.sort((a, b) => b.u - a.u)
    // soft pick top
    const pick = actions[rng() < 0.7 ? 0 : Math.min(actions.length - 1, 1)]!
    if (pick?.kind === 'pass' && pick.target && rng() < 0.08) {
      const dist = Math.hypot(pick.target.x - carrier.x, pick.target.y - carrier.y)
      const note = ppmNote(carrier.player.skills, dist >= 26 ? 'pass_long' : 'pass_short')
      if (note) {
        const ppmClub = possessing === 'home' ? homeClub : awayClub
        push(minute, 'commentary', `${carrier.player.name} · ${note}`, { x: carrier.x, y: carrier.y }, {
          clubId: ppmClub.id,
          playerId: carrier.id,
        })
      }
    }

    const alpha = 0.12 * (1 - carrier.player.hidden.consistency / 99) + 0.04
    const atkTac = possessing === 'home' ? homeTactics : awayTactics
    const famPen = familiarityActionPenalty(atkTac.familiarity)
    const effCond = effectiveCondition(carrier.condition, carrier.burst)
    const moraleIndex =
      carrier.psych.moraleMod *
      (0.85 + (carrier.player.morale / 20) * 0.3) *
      (opts.humanDynamicsBonus && (homeIsHuman || awayIsHuman) && carrier.team === (homeIsHuman ? 'home' : 'away')
        ? 0.5 + (opts.humanDynamicsBonus ?? 1) * 0.5
        : 1)
    const aTarget =
      pick.kind === 'shoot'
        ? (carrier.player.attrs.finishing + carrier.player.attrs.composure) / 2
        : pick.kind === 'dribble'
          ? (carrier.player.attrs.dribbling + carrier.player.attrs.pace) / 2
          : (carrier.player.attrs.passing + carrier.player.attrs.technique) / 2
    const success =
      (aTarget / 99) * (effCond / 100) * moraleIndex + gaussian(rng) * alpha
    const ok = success > (pick.diff * famPen) / 2.2

    const spot = { x: carrier.x, y: carrier.y }
    const team = possessing === 'home' ? homeClub : awayClub
    const stats = possessing === 'home' ? homeStats : awayStats

    if (pick.kind === 'pass') {
      const target = pick.target
      if (ok && target) {
        const passDist = Math.hypot(target.x - carrier.x, target.y - carrier.y)
        const lowBlock =
          defTac.instructions.mentality === 'defensive' || defTac.instructions.pressing === 'low'
            ? 1
            : 0
        const block = resolvePassBlock(
          { x: carrier.x, y: carrier.y },
          { x: target.x, y: target.y },
          defenders.map((d) => ({
            id: d.id,
            name: d.player.name,
            x: d.x,
            y: d.y,
            positioning: d.player.attrs.positioning,
            tackling: d.player.attrs.tackling,
            decision: d.player.attrs.decision,
            lowBlockBonus:
              lowBlock +
              (oi?.markPlayerId === target.id ? 1.1 : 0) +
              (oi?.pressPlayerId === target.id ? 0.55 : 0) +
              (oi?.showOnto === 'tight' && oi.markPlayerId === target.id ? 0.35 : 0),
          })),
          rng,
        )

        // พื้นแฉะ + พาสยาว / familiarity blunder / shadow block
        const pitchKill =
          passTooLongForPitch(passDist, pitch) && rng() < 0.35 + (pitch.friction - 1) * 0.4
        const famBlunder = rng() < familiarityBlunderChance(atkTac.familiarity)

        if (block.blocked || pitchKill || famBlunder) {
          possessing = possessing === 'home' ? 'away' : 'home'
          bumpStoppage(STOPPAGE.ballOut)
          onDeadBall(minute)
          if (block.blocked && block.interceptorName) {
            ballX = defenders.find((d) => d.id === block.interceptorId)?.x ?? ballX
            ballY = defenders.find((d) => d.id === block.interceptorId)?.y ?? ballY
            push(minute, 'commentary', block.noteTh ?? `${block.interceptorName} ดักตัดไลน์ส่ง`, spot, {
              clubId: possessing === 'home' ? homeClub.id : awayClub.id,
              playerId: block.interceptorId,
              playerName: block.interceptorName,
            })
          } else if (pitchKill) {
            push(minute, 'commentary', `พาสไม่ถึง · ${pitch.noteTh}`, spot, { clubId: team.id })
          } else {
            push(
              minute,
              'commentary',
              `${carrier.player.name} จ่ายหลุด (คุ้นแผน ${(atkTac.familiarity ?? 55).toFixed(0)}%)`,
              spot,
              { clubId: team.id, playerId: carrier.id },
            )
          }
        } else if (rng() < firstTouchFailChance(pitch, target.player.attrs.technique)) {
          ballX = target.x
          ballY = target.y
          possessing = possessing === 'home' ? 'away' : 'home'
          bumpStoppage(STOPPAGE.ballOut)
          onDeadBall(minute)
          push(
            minute,
            'commentary',
            `${target.player.name} รับบอลแรกพลาด · พื้นไม่เป็นใจ`,
            { x: target.x, y: target.y },
            { clubId: team.id, playerId: target.id },
          )
        } else {
          ballX = target.x
          ballY = target.y
          if (rng() < 0.15) {
            push(minute, 'commentary', `${carrier.player.name} เปิดบอลหา ${target.player.name}`, spot, {
              clubId: team.id,
              playerId: carrier.id,
            })
          }
        }
      } else {
        possessing = possessing === 'home' ? 'away' : 'home'
        bumpStoppage(STOPPAGE.ballOut)
        onDeadBall(minute)
        if (rng() < 0.2) {
          push(minute, 'commentary', `ตัดพาสจาก ${carrier.player.name} · ลูกออกจากจังหวะ`, spot, {
            clubId: possessing === 'home' ? homeClub.id : awayClub.id,
          })
        }
      }
    } else if (pick.kind === 'dribble') {
      if (ok) {
        ballY = clamp(ballY + (possessing === 'home' ? 8 : -8), 5, 95)
        carrier.y = ballY
      } else {
        // Tackle matrix: clean win / mistackle / foul (+ pen / cards)
        const fouler = nearestDefender(defenders, carrier.x, carrier.y)
        if (!fouler) {
          possessing = possessing === 'home' ? 'away' : 'home'
          bumpStoppage(STOPPAGE.ballOut)
          onDeadBall(minute)
        } else {
          const attackProgress = possessing === 'home' ? carrier.y : 100 - carrier.y
          const tackle = resolveTackle(rng, {
            tackling: fouler.player.attrs.tackling,
            dirtiness: fouler.player.hidden.dirtiness,
            aggressionMod: fouler.psych.aggressionMod,
            pressing: defTac.instructions.pressing,
            attackProgress,
            lateralFromCentre: Math.abs(carrier.x - 50),
            ref,
            alreadyYellow: (matchYellows.get(fouler.id) ?? 0) >= 1,
            foulerIsAway: fouler.team === 'away',
          })
          if (tackle.kind === 'clean_win') {
            possessing = possessing === 'home' ? 'away' : 'home'
            bumpStoppage(STOPPAGE.tackleWin)
            if (rng() < 0.35) {
              push(minute, 'commentary', `${fouler.player.name} สกัดสะอาด`, spot, {
                clubId: fouler.team === 'home' ? homeClub.id : awayClub.id,
                playerId: fouler.id,
                playerName: fouler.player.name,
              })
            }
          } else if (tackle.kind === 'mistackle') {
            bumpStoppage(STOPPAGE.mistackle)
            ballY = clamp(ballY + (possessing === 'home' ? 4 : -4), 5, 95)
            carrier.y = ballY
            if (rng() < 0.2) {
              push(minute, 'commentary', `${fouler.player.name} แท็กเคิลพลาด`, spot, {
                clubId: fouler.team === 'home' ? homeClub.id : awayClub.id,
                playerId: fouler.id,
              })
            }
          } else {
            bumpStoppage(STOPPAGE.foul)
            const foulClubId = fouler.team === 'home' ? homeClub.id : awayClub.id
            const foulStats = fouler.team === 'home' ? homeStats : awayStats
            foulStats.fouls += 1
            push(minute, 'foul', `${fouler.player.name} ฟาวล์ใส่ ${carrier.player.name} · ${tackle.noteTh}`, spot, {
              clubId: foulClubId,
              playerId: fouler.id,
              playerName: fouler.player.name,
            })
            const nearOwnBox = attackProgress >= 78
            if (tackle.card) {
              bumpStoppage(tackle.card.color === 'red' ? STOPPAGE.red : STOPPAGE.yellow)
              issueBooking(fouler, minute, spot, nearOwnBox, tackle.card)
            }
            if (tackle.penalty) {
              bumpStoppage(STOPPAGE.penalty)
              const taker =
                attackers.find((a) => a.role === 'ST') ??
                attackers.find((a) => a.id === carrier.id) ??
                carrier
              resolvePenaltyKick(taker, minute, spot)
            } else if (attackProgress > 52 && rng() < 0.5) {
              // ฟรีคิกนอกกรอบ
              const atkTac = possessing === 'home' ? homeTactics : awayTactics
              const fk = resolveFreeKick(
                attackers.map(toLike),
                defenders.map(toLike),
                {
                  plan: atkTac.setPieces?.freeKicks ?? 'direct',
                  minute,
                  attackingUp: possessing === 'home',
                  rng,
                  spot,
                },
              )
              push(minute, 'commentary', `ฟรีคิก · แผน ${atkTac.setPieces?.freeKicks ?? 'direct'}`, spot, {
                clubId: team.id,
              })
              applySpOutcome(fk, minute, possessing, stats)
            } else {
              onDeadBall(minute)
            }
          }
        }
      }
    } else if (pick.kind === 'shoot') {
      bumpStoppage(STOPPAGE.shot)
      stats.shots += 1
      const xgAdd = shotXg(prog, ok)
      stats.xg = Math.round((stats.xg + xgAdd) * 100) / 100
      const perf = touchPerf(carrier)
      perf.shots += 1
      perf.xgContrib += xgAdd
      perf.minutes = Math.max(perf.minutes, minute)
      push(minute, 'shot', `${carrier.player.name} ยิง!`, spot, {
        clubId: team.id,
        playerId: carrier.id,
      })
      if (ok) {
        stats.shotsOnTarget += 1
        perf.shotsOnTarget += 1
        if (possessing === 'home') homeGoals += 1
        else awayGoals += 1
        perf.goals += 1
        bumpStoppage(STOPPAGE.goal)
        push(minute, 'goal', `เข้าแล้ว! ${carrier.player.name}`, spot, {
          clubId: team.id,
          playerId: carrier.id,
          playerName: carrier.player.name,
        })
        const goalVar = varCheckGoal(rng, hasVar)
        if (goalVar !== 'none') {
          bumpStoppage(STOPPAGE.varCheck)
          push(minute, 'var', `VAR ตรวจสอบประตูของ ${carrier.player.name}...`, spot, {
            clubId: team.id,
            playerId: carrier.id,
          })
          if (goalVar === 'overturn') {
            if (possessing === 'home') homeGoals = Math.max(0, homeGoals - 1)
            else awayGoals = Math.max(0, awayGoals - 1)
            push(minute, 'var', varEventText('overturn', carrier.player.name), spot, {
              clubId: team.id,
              playerId: carrier.id,
              playerName: carrier.player.name,
            })
          } else {
            push(minute, 'var', varEventText('check_ok', carrier.player.name), spot, {
              clubId: team.id,
              playerId: carrier.id,
            })
          }
        }
        possessing = possessing === 'home' ? 'away' : 'home'
        ballX = 50
        ballY = 50
        onDeadBall(minute)
      } else {
        if (rng() < 0.45) {
          bumpStoppage(STOPPAGE.save)
          push(minute, 'save', `เซฟ!`, { x: 50, y: possessing === 'home' ? 95 : 5 }, {
            clubId: possessing === 'home' ? awayClub.id : homeClub.id,
          })
          stats.shotsOnTarget += 1
          // เซฟออกข้าง → มุม
          if (rng() < 0.55) {
            push(minute, 'corner', `ลูกมุม!`, spot, { clubId: team.id })
            const corner = resolveCorner(
              attackers.map(toLike),
              defenders.map(toLike),
              stats,
              {
                plan: (possessing === 'home' ? homeTactics : awayTactics).setPieces?.corners ?? 'mixed',
                minute,
                attackingUp: possessing === 'home',
                rng,
              },
            )
            applySpOutcome(corner, minute, possessing, stats)
          } else {
            possessing = possessing === 'home' ? 'away' : 'home'
            onDeadBall(minute)
          }
        } else {
          bumpStoppage(STOPPAGE.ballOut)
          // ยิงหลุดใกล้เส้น → มุม
          if (prog > 70 && rng() < 0.4) {
            push(minute, 'corner', `ลูกมุมจากยิงหลุด`, spot, { clubId: team.id })
            const corner = resolveCorner(
              attackers.map(toLike),
              defenders.map(toLike),
              stats,
              {
                plan: (possessing === 'home' ? homeTactics : awayTactics).setPieces?.corners ?? 'mixed',
                minute,
                attackingUp: possessing === 'home',
                rng,
              },
            )
            applySpOutcome(corner, minute, possessing, stats)
          } else {
            possessing = possessing === 'home' ? 'away' : 'home'
            onDeadBall(minute)
          }
        }
      }
    }

    // expire psych + fatigue / burst zone
    for (const a of all()) {
      if (a.psych.expiresMinute && minute > a.psych.expiresMinute) {
        a.psych = defaultPsych()
      }
      const sideTac = a.team === 'home' ? homeTactics : awayTactics
      const sprinting =
        (pick.kind === 'dribble' && a.id === carrier.id) ||
        sideTac.instructions.pressing === 'high'
      a.burst = tickMatchFatigue(a.burst, {
        pressing: sideTac.instructions.pressing,
        tempo: sideTac.instructions.tempo,
        sprinting,
        weatherInjury: wx.fatigue,
      })
      a.condition = clamp(a.condition - 0.12 * (wx.fatigue ?? 1) * (sprinting ? 1.4 : 1), 40, 100)
      // เจ้าบ้านตามหลังช่วงท้าย — Stamina Regeneration Spike จากเสียงเชียร์
      if (
        a.team === 'home' &&
        homeGoals < awayGoals &&
        minute >= 85 &&
        minute <= 90
      ) {
        a.burst = {
          ...a.burst,
          matchStamina: Math.min(100, a.burst.matchStamina + crowd.homeLateRegen * 0.35),
          heartRate: Math.max(40, a.burst.heartRate - 3),
        }
        a.condition = clamp(a.condition + 0.35, 40, 100)
        if (!lateFightAnnounced) {
          lateFightAnnounced = true
          const msg = lateHomeFightCommentary(true, minute)
          if (msg) push(minute, 'commentary', msg, { x: 50, y: 50 }, { clubId: homeClub.id })
        }
      }
      if (
        !sentOff.has(a.id) &&
        rollBurstInjury(rng, a.burst, a.player.hidden.injuryProneness, wx.injury)
      ) {
        const rolled = rollInjury('match', rng, a.player.age)
        // Soft-tissue bias: force muscle when possible
        const type = rolled.type === 'bone' ? ('muscle' as const) : rolled.type
        const days = type === 'muscle' ? Math.max(3, Math.min(rolled.days, 14)) : rolled.days
        inMatchInjuries.push({ playerId: a.id, type, days })
        const clubId = a.team === 'home' ? homeClub.id : awayClub.id
        push(
          minute,
          'commentary',
          `${a.player.name} บาดเจ็บกล้ามเนื้อ! (Burst Zone) · พักประมาณ ${days} วัน`,
          { x: a.x, y: a.y },
          { clubId, playerId: a.id, playerName: a.player.name },
        )
        bumpStoppage(STOPPAGE.foul)
        onDeadBall(minute)
        dismissAgent(a)
      }
    }

    // หลังจังหวะนี้มีประตู → AI แก้เกมทันที
    if (homeGoals !== prevHomeGoals || awayGoals !== prevAwayGoals) {
      runAiSolve('home', minute, true)
      runAiSolve('away', minute, true)
    }
    prevHomeGoals = homeGoals
    prevAwayGoals = awayGoals
  }

  /** ทดเวลาหลังครึ่งปกติ 45' — สะสมแล้วปัดขึ้น · มีจังหวะเล่นต่อ */
  const playStoppagePeriod = (regEnd: number) => {
    const raw = stoppageAccum
    const added = ceilStoppageMinutes(raw)
    stoppageAccum = 0
    if (added <= 0) return 0
    push(regEnd, 'stoppage', stoppageAnnounceTh(added, raw), { x: 50, y: 50 })
    for (let m = 1; m <= added; m++) {
      const minute = regEnd + m
      updatePositions(
        all(),
        ballX,
        ballY,
        { home: homeTactics, away: awayTactics },
        possessing,
        rng,
        springAlpha,
      )
      const attackers = possessing === 'home' ? homeAgents : awayAgents
      const defenders = possessing === 'home' ? awayAgents : homeAgents
      if (attackers.length === 0) continue
      const carrier =
        [...attackers].sort((a, b) => b.player.overall - a.player.overall)[0]!
      const spot = { x: carrier.x, y: carrier.y }
      const team = possessing === 'home' ? homeClub : awayClub
      const stats = possessing === 'home' ? homeStats : awayStats
      const prog = possessing === 'home' ? carrier.y : 100 - carrier.y
      const roll = rng()
      if (roll < 0.22 && prog > 58) {
        bumpStoppage(0) // already in stoppage
        stats.shots += 1
        push(minute, 'shot', `ทดเวลา · ${carrier.player.name} ยิง!`, spot, {
          clubId: team.id,
          playerId: carrier.id,
        })
        const finish = (carrier.player.attrs.finishing + carrier.player.attrs.composure) / 2 / 99
        if (rng() < 0.22 + finish * 0.25) {
          stats.shotsOnTarget += 1
          if (possessing === 'home') homeGoals += 1
          else awayGoals += 1
          push(minute, 'goal', `เข้าแล้วในทดเวลา! ${carrier.player.name}`, spot, {
            clubId: team.id,
            playerId: carrier.id,
            playerName: carrier.player.name,
          })
          possessing = possessing === 'home' ? 'away' : 'home'
          ballX = 50
          ballY = 50
        } else if (rng() < 0.5) {
          push(minute, 'save', `เซฟในทดเวลา!`, { x: 50, y: possessing === 'home' ? 95 : 5 }, {
            clubId: possessing === 'home' ? awayClub.id : homeClub.id,
          })
          possessing = possessing === 'home' ? 'away' : 'home'
        } else {
          push(minute, 'commentary', `ลูกออกจากสนาม · ทดเวลา ${minute}'`, spot)
          possessing = possessing === 'home' ? 'away' : 'home'
        }
      } else if (roll < 0.45) {
        const fouler = nearestDefender(defenders, carrier.x, carrier.y)
        if (fouler && rng() < 0.4) {
          const foulStats = fouler.team === 'home' ? homeStats : awayStats
          foulStats.fouls += 1
          push(minute, 'foul', `ทดเวลา · ${fouler.player.name} ฟาวล์`, spot, {
            clubId: fouler.team === 'home' ? homeClub.id : awayClub.id,
            playerId: fouler.id,
          })
          if (rng() < 0.25) {
            issueBooking(fouler, minute, spot, false, null)
          }
        } else {
          push(minute, 'commentary', `ลูกออกข้าง · ทดเวลา ${minute}'`, spot)
          possessing = possessing === 'home' ? 'away' : 'home'
        }
      } else {
        push(minute, 'commentary', `เล่นต่อในทดเวลา ${minute}'`, spot)
        possessing = possessing === 'home' ? 'away' : 'home'
      }
      for (const a of all()) {
        a.condition = clamp(a.condition - 0.08, 40, 100)
      }
    }
    return added
  }

  const buildMid = (clock: number): MatchMidState => {
    const conditions: Record<string, number> = {}
    for (const a of all()) conditions[a.id] = a.condition
    return {
      homeGoals,
      awayGoals,
      homeStats: { ...homeStats },
      awayStats: { ...awayStats },
      events: [...events],
      matchYellows: [...matchYellows.entries()],
      sentOffIds: [...sentOff],
      conditions,
      homeXi: (homeTactics.startingXi.length ? homeTactics.startingXi : homeAgents.map((a) => a.id)).filter(
        (id) => !sentOff.has(id),
      ),
      awayXi: (awayTactics.startingXi.length ? awayTactics.startingXi : awayAgents.map((a) => a.id)).filter(
        (id) => !sentOff.has(id),
      ),
      possessing,
      nextEid: eid,
      fidelity,
      homeSubsUsed,
      awaySubsUsed,
      subsUsed: homeIsHuman ? homeSubsUsed : awaySubsUsed,
      maxSubs,
      clockMinute: clock,
    }
  }

  const regEnd = minuteBase + minuteSpan
  const addedThisHalf = phase === 'extraTime' ? playStoppagePeriod(regEnd) : playStoppagePeriod(regEnd)
  const halfEndMinute = regEnd + addedThisHalf

  // HT after 1H regulation + stoppage
  if (phase === 'firstHalf') {
    onDeadBall(halfEndMinute)
    push(
      halfEndMinute,
      'halftime',
      `หมดครึ่งแรก ${homeClub.shortName} ${homeGoals}–${awayGoals} ${awayClub.shortName}` +
        (addedThisHalf > 0 ? ` · รวมทดเวลา +${addedThisHalf}'` : ''),
      { x: 50, y: 50 },
    )
  }

  const finishKnockoutIfNeeded = (fromMinute: number) => {
    if (!needsDecisiveWinner(fixture)) return fromMinute
    if (homeGoals !== awayGoals) return fromMinute

    // Extra time 2×15
    wentToExtraTime = true
    push(Math.max(90, fromMinute), 'extratime', `เสมอ ${homeGoals}–${awayGoals} — ต่อเวลา 2×15 นาที`, {
      x: 50,
      y: 50,
    })
    let etMinute = 90
    for (let half = 0; half < 2; half++) {
      const base = 90 + half * 15
      for (let m = 1; m <= 15; m++) {
        etMinute = base + m
        updatePositions(all(), ballX, ballY, { home: homeTactics, away: awayTactics }, possessing, rng, springAlpha)
        if (rng() < 0.18) {
          const attackers = possessing === 'home' ? homeAgents : awayAgents
          const carrier = [...attackers].sort((a, b) => b.player.overall - a.player.overall)[0]
          if (!carrier) continue
          const stats = possessing === 'home' ? homeStats : awayStats
          stats.shots += 1
          if (rng() < 0.2) {
            stats.shotsOnTarget += 1
            if (possessing === 'home') homeGoals += 1
            else awayGoals += 1
            push(etMinute, 'goal', `ประตูต่อเวลา! ${carrier.player.name}`, { x: carrier.x, y: carrier.y }, {
              clubId: possessing === 'home' ? homeClub.id : awayClub.id,
              playerId: carrier.id,
              playerName: carrier.player.name,
            })
            possessing = possessing === 'home' ? 'away' : 'home'
          }
        } else if (rng() < 0.25) {
          possessing = possessing === 'home' ? 'away' : 'home'
        }
      }
      const etAdd = ceilStoppageMinutes(0.4 + rng() * 1.2)
      if (etAdd > 0) {
        push(base + 15, 'stoppage', stoppageAnnounceTh(etAdd, 0.4 + etAdd * 0.5), { x: 50, y: 50 })
        etMinute = base + 15 + etAdd
      }
      if (homeGoals !== awayGoals) break
    }

    if (homeGoals !== awayGoals) return etMinute

    // Penalty shootout
    wentToPens = true
    push(etMinute, 'shootout', `ยิงจุดโทษตัดสิน!`, { x: 50, y: 50 })
    const homeOrder = buildPenOrder(players, homeTactics.startingXi)
    const awayOrder = buildPenOrder(players, awayTactics.startingXi)
    const hGk = homeAgents.find((a) => a.role === 'GK')?.player.attrs ?? null
    const aGk = awayAgents.find((a) => a.role === 'GK')?.player.attrs ?? null
    const shoot = simulatePenaltyShootout(
      rng,
      homeOrder,
      awayOrder,
      hGk,
      aGk,
      homeClub.id,
      awayClub.id,
      etMinute + 1,
    )
    penalties = { home: shoot.home, away: shoot.away }
    for (const ev of shoot.events) {
      push(ev.minute, 'shootout', ev.text, { x: 50, y: 50 }, {
        clubId: ev.clubId,
        playerId: ev.playerId,
        playerName: ev.playerName,
      })
    }
    return etMinute + 1
  }

  // จบครึ่งหลัง / ปิดเกมหลังหน้าต่าง / ต่อเวลา
  if (phase === 'secondHalf' || phase === 'secondHalfClose') {
    let endMin = Math.max(phase === 'secondHalfClose' ? 90 : 90, halfEndMinute)
    onDeadBall(endMin)
    push(
      endMin,
      'fulltime',
      `หมด 90 นาที! ${homeClub.name} ${homeGoals}–${awayGoals} ${awayClub.name}` +
        (addedThisHalf > 0 ? ` · ทดเวลา +${addedThisHalf}'` : ''),
      { x: 50, y: 50 },
    )
    endMin = finishKnockoutIfNeeded(endMin)
    if (wentToExtraTime || wentToPens) {
      push(
        Math.max(endMin, wentToPens ? 121 : 105),
        'fulltime',
        wentToPens
          ? `จบเกมหลังจุดโทษ! ${homeClub.name} ${homeGoals}–${awayGoals} ${awayClub.name} (จุดโทษ ${penalties?.home}–${penalties?.away})`
          : `จบเกมหลังต่อเวลา! ${homeClub.name} ${homeGoals}–${awayGoals} ${awayClub.name}`,
        { x: 50, y: 50 },
      )
    }
  }

  if (phase === 'extraTime') {
    let endMin = halfEndMinute
    // second period of ET already in minuteSpan 30 if we set it — currently 15 only one period
    endMin = finishKnockoutIfNeeded(Math.max(105, endMin))
    push(
      Math.max(endMin, 120),
      'fulltime',
      wentToPens
        ? `จบหลังจุดโทษ ${penalties?.home}–${penalties?.away}`
        : `จบต่อเวลา ${homeGoals}–${awayGoals}`,
      { x: 50, y: 50 },
    )
  }

  events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))

  // อัปเดตนาทีเล่น + ผสาน event fallback
  for (const a of all()) {
    const p = touchPerf(a)
    p.minutes = Math.max(p.minutes, halfEndMinute > 0 ? Math.min(90, halfEndMinute) : 45)
  }
  accumulateFromEvents(
    resume?.events?.length ? events.slice(resume.events.length) : events,
    perfMap,
  )
  const { ratings: playerRatings, momPlayerId, momName } = finalizePlayerRatings(
    perfMap,
    phase === 'firstHalf' ? 45 : 90,
  )

  const homeRating =
    homeAgents.reduce((s, a) => s + a.player.overall * a.fit, 0) / Math.max(1, homeAgents.length)
  const awayRating =
    awayAgents.reduce((s, a) => s + a.player.overall * a.fit, 0) / Math.max(1, awayAgents.length)
  const total = homeRating + awayRating
  homeStats.possession = Math.round((homeRating / total) * 100)
  awayStats.possession = 100 - homeStats.possession
  homeStats.xg = Math.round(homeStats.xg * 100) / 100
  awayStats.xg = Math.round(awayStats.xg * 100) / 100

  const lines: string[] = [
    `${formationLabel(homeForm, true)} vs ${formationLabel(awayForm, true)} — ผลจากพื้นที่/แอ็กชัน ไม่ใช่เป่ายิ้งฉุบ`,
    timingNoteTh(fidelity),
    shapeNoteTh(homeForm, (homeTactics.formationOop ?? homeForm) as FormationId),
    shapeNoteTh(awayForm, (awayTactics.formationOop ?? awayForm) as FormationId),
    FORMATION_SPATIAL[homeForm].noteTh,
    FORMATION_SPATIAL[awayForm].noteTh,
  ]
  if (phase === 'firstHalf') lines.push('พักครึ่ง — รอแก้เกมก่อนเตะครึ่งหลัง')
  lines.push('ครึ่งละ 45 นาที + ทดเวลา (สะสมจากฟาวล์/ใบ/VAR/ลูกออก แล้วปัดขึ้น)')
  if (hasVar) lines.push('แมตช์นี้มี VAR (ตรวจประตู / ใบแดง)')
  if (homeStats.reds + awayStats.reds > 0) {
    lines.push(
      `ใบแดง ${homeStats.reds + awayStats.reds} · ผู้เล่นออกจากสนามกลางเกม · แบนนัดถัดไปหลังจบนัด`,
    )
  }
  if (wentToExtraTime) lines.push('ไปต่อเวลา 2×15')
  if (wentToPens && penalties) {
    lines.push(`ยิงจุดโทษตัดสิน ${penalties.home}–${penalties.away}`)
  }
  if (homeStats.corners + awayStats.corners > 0) {
    lines.push(`ลูกมุม ${homeStats.corners + awayStats.corners} · ใช้แผน set-piece จากแทคติก`)
  }
  if (pitch.noteTh !== 'สนามปกติ') lines.push(`พื้นสนาม: ${pitch.noteTh}`)
  lines.push(
    `คุ้นแผน ${homeClub.shortName} ${Math.round(homeTactics.familiarity ?? 55)}% · ${awayClub.shortName} ${Math.round(awayTactics.familiarity ?? 55)}%`,
  )
  lines.push(
    `Crowd Pressure ${(crowd.intensity * 100).toFixed(0)}% · ผู้ชม ~${attendance.toLocaleString('th-TH')}`,
  )
  if (inMatchInjuries.length > 0) {
    lines.push(`บาดเจ็บระหว่างเกม ${inMatchInjuries.length} ราย (Burst Zone / soft-tissue)`)
  }

  const breakdown: MatchBreakdown = {
    homeFormation: homeForm,
    awayFormation: awayForm,
    lines,
    freePlayerNotes: freeNotes,
    overloadNotes,
    shoutNotes: shoutNotes.slice(0, 8),
  }

  const result: LayeredMatchOutput = {
    fixtureId: fixture.id,
    homeGoals,
    awayGoals,
    events,
    homeRating: Math.round(homeRating * 10) / 10,
    awayRating: Math.round(awayRating * 10) / 10,
    stats: { home: homeStats, away: awayStats },
    breakdown,
    playerRatings: phase === 'firstHalf' ? undefined : playerRatings,
    manOfTheMatchId: phase === 'firstHalf' ? undefined : momPlayerId,
    manOfTheMatchName: phase === 'firstHalf' ? undefined : momName,
    attendance,
    wentToExtraTime: wentToExtraTime || undefined,
    wentToPens: wentToPens || undefined,
    penalties,
    inMatchInjuries: inMatchInjuries.length ? inMatchInjuries : undefined,
  }

  if (phase === 'firstHalf') {
    result.midState = buildMid(halfEndMinute)
  }

  return result
}

