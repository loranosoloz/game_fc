import type { Club, Fixture, GameSave, InboxMessage, MatchResult, Player, TableRow, Tactics } from './types'
import { applyMatchFatigue, simulateFixture } from './matchEngine'
import { applyPostMatchRoleProgress } from './matchRoleRating'
import { buildArchiveEntry } from './matchArchive'
import { persistMatchArchiveSideEffect } from './matchStatsDb'
import { applyHalfTimeTactics, type HalfTimeAdjustments, type HalfTimeSub } from './match/halfTime'
import { estimateAttendance } from './match/crowdPressure'
import type { TouchlineShout } from './match/touchlineShouts'
import { MAX_MATCH_SUBS } from './match/knockout'
import { aiSolveGame } from './match/aiSolveGame'
import { ensureClubMatchdaySquad, MATCH_BENCH_SIZE } from './match/matchdaySquad'
import { autoPickTactics } from './seed'
import { getWorldCoach, instructionsFromCoach } from './worldCoaches'
import { applyMatchToFans, applyFanHatredBothSides, ensureFans, processFanPolitics, seedClubHatedTeams, fanTicketMultiplier } from './fans'
import { applyMatchToBoard, processBoardPolitics } from './board'
import { applyMatchToOwner, ensureOwner } from './owner'
import { processStadiumPresence } from './clubAtmosphere'
import { scanTakeoverMarket } from './takeover'
import { enterUnemployment, refreshJobMarket } from './jobs'
import {
  applyManagerMatchProgress,
  tickClubQuests,
} from './managerProgress'
import { maybeQueueCalendarGap } from './seasonCalendar'
import { ensureSquadRegistration } from './squadRegistration'
import { processFacilities, commercialGateBonus, trainingFacilityBonus } from './facilities'
import { tickSocialAfterMatchday } from './social'
import { processMatchSocialDrama } from './socialDrama'
import { transferWindowKind } from './transferWindow'
import { winterWindowRange } from '@/data/world/leagueSize'
import { maybeQueueInternationalBreak } from './internationalBreaks'
import { tickWorldPulse } from './worldPulse'
import { tickWorldWatch } from './worldWatch'
import { applyTrainingWeek, updatePlayingTimeMorale } from './training'
import {
  tickStyleTrainingForSave,
  tickStyleSlotMood,
} from './styleTraining'
import { tickPlayerFameAndBrands } from './playerFame'
import { pushLifeDigestInbox } from './lifeDigest'
import { tickContractedPlayingTime } from './transferExtras'
import { applyInjury, tickPlayerInjury } from './medical'
import {
  tickIllness,
  rollSquadIllnesses,
  ILLNESS_RISK_ACTIVITIES,
} from './illness'
import { applyDevelopmentForSave } from './development'
import { recomputeDynamics, dynamicsMatchBonus } from './dynamics'
import { tickStaffResponsibilities } from './staffResponsibilities'
import { talkBonusFromSave } from './preMatch'
import {
  newsAfterMatch,
  newsAfterInjury,
  newsAfterIllness,
  newsAfterTitle,
  newsRivalResult,
  detectNewInjuries,
  advanceMediaWeek,
  ensureMediaFeed,
  pushNews,
} from './media'
import { createPressConference } from './pressConference'
import { maybeCreatePlayerInterview } from './playerInterview'
import { rollClubWorldEvents } from './clubEvents'
import { maybeAiRomanoPlants } from './romanoPlant'
import { processMatchdayAwards, finalizeSeasonAwards } from './awards'
import { resolveFormWatches, weeklyScoutPassive, runScoutFocusPass } from './scouting'
import { generateStadiumVisits, planMatchVisitors } from './stadiumVisits'
import { generatePlayerTalkRequests, processAiPlayerTalks, resolveTalkPromises } from './playerTalks'
import { processLoansMatchday, tickLoanAppearances } from './loans'
import {
  applyMatchdayIncome,
  awardCompetitionPrize,
  awardProgressPrize,
  finalRunnerUpClubId,
  newlyQualifiedClubIds,
} from './clubIncome'
import { applyFfpBreachSanction } from './financeFfp'
import {
  ensureInsolvency,
  tickInsolvency,
} from './insolvency'
import { estimatedValue, sellPlayerToAi } from './transfer'
import { formatMoney } from '@/lib/format'
import { processTransferDeskMatchday } from './transferDesk'
import { tickContractLifecycle } from './contractLifecycle'
import { tickAgentApproaches } from './agentApproach'
import { tickClubLoyalty } from './playerLoyalty'
import { tickWantAwayDrama } from './wantAway'
import { rivalIdsForClub, seedLeagueRivalries, tickEmergentRivalries } from './rivalries'
import { tickEndOfSeasonClauses } from './transferClauses'
import type { MediaItem } from './types'
import { maybePromoteYouth } from './youth'
import { advanceCupAfterMatchday } from './cup'
import {
  advanceLeagueCupAfterMatchday,
  advanceTrophyAfterMatchday,
} from './extraCups'
import { advanceUclAfterMatchday, advanceUelAfterMatchday, advanceUeclAfterMatchday } from './ucl'
import {
  advanceAclAfterMatchday,
  advanceAclTwoAfterMatchday,
  advanceAseanCupAfterMatchday,
  createAclState,
  createAclTwoState,
  createAseanCupState,
} from './asiaAccess'
import {
  advanceCwcAfterMatchday,
  createCwcState,
  ensureCwcAccess,
  recordCwcChampion,
} from './clubWorldCup'
import {
  createSuperCupState,
  crownSuperCupFromFixtures,
} from './superCup'
import { snapshotEuroRanks } from './europeAccess'
import { assignRefereesToFixtures, getReferee } from './referees'
import { fixtureWeatherSeed, pickWeather, weatherMatchModifiers } from './weather'
import {
  applyDisciplineFromEvents,
  stripBannedFromTactics,
} from './discipline'
import { applyMatchCardFines } from './disciplineFines'
import {
  staffLevel,
  refreshStaffMarket,
  maybePlayersBecomeStaff,
} from './staff'
import { simulateDailyLife } from './dailyLife'
import {
  applyGateReceiptToClub,
  calcGateReceipt,
  ensureClubFinance,
  payWeeklyWagesWithCash,
  recordHumanGate,
  simulatePlayerSpending,
} from './playerEconomy'

function applyResultToTable(table: TableRow[], fixture: Fixture, homeGoals: number, awayGoals: number): TableRow[] {
  if (fixture.competition !== 'league') return table
  return table.map((row) => {
    if (row.clubId === fixture.homeClubId) {
      const won = homeGoals > awayGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + homeGoals,
        ga: row.ga + awayGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    if (row.clubId === fixture.awayClubId) {
      const won = awayGoals > homeGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + awayGoals,
        ga: row.ga + homeGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    return row
  })
}

function bumpFamiliarity(tactics: Tactics, played: boolean): Tactics {
  if (!played) return tactics
  return {
    ...tactics,
    familiarity: Math.min(100, tactics.familiarity + 2),
  }
}

export interface PreparedMatchday {
  matchday: number
  date: string
  tacticsByClub: Record<string, Tactics>
  results: Array<{ fixture: Fixture; result: MatchResult }>
  humanResult: MatchResult | null
  humanFixture: Fixture | null
  /** ขอเปลี่ยนตัวล่วงหน้า (เลือกได้ตลอด) — ลงสนามเมื่อบอลออก */
  pendingHumanSubs?: HalfTimeSub[]
  /** คิวที่ขอไว้ในครึ่งปัจจุบัน (สะสมก่อนซิมใหม่ / แสดงใน UI) */
  phaseQueuedSubs?: HalfTimeSub[]
  /** นาทีที่เริ่มอนุญาตให้ลงตัวจากคิว (ขอกลางเกม) */
  pendingSubsEarliestMinute?: number
  /** ตะโกนกลางเกม — ใช้ตอนซิมครึ่งหลัง / พักครึ่ง */
  pendingLiveShouts?: TouchlineShout[]
  /** Live match: paused at HT until continueAfterHalfTime */
  halfTime?: {
    midState: import('./match/halfTime').MatchMidState
    resolved: boolean
  } | null
  /** Live: paused ~70' for mid-match subs */
  matchWindow?: {
    midState: import('./match/halfTime').MatchMidState
    resolved: boolean
  } | null
}

export function prepareMatchday(
  save: GameSave,
  matchday: number,
  opts?: { pauseAtHalfTime?: boolean },
): PreparedMatchday | null {
  save = ensureSquadRegistration(save)
  let fixtures = assignRefereesToFixtures(save.fixtures)
  fixtures = fixtures.map((f) => {
    if (f.matchday !== matchday || f.played || f.weather) return f
    return {
      ...f,
      weather: pickWeather(fixtureWeatherSeed(f.id, matchday)),
    }
  })
  const dayFixtures = fixtures.filter((f) => f.matchday === matchday && !f.played)
  if (dayFixtures.length === 0) return null

  const players = save.players
  let tacticsByClub = { ...save.tacticsByClub }
  for (const club of save.clubs) {
    const clubFx = dayFixtures.find(
      (f) => f.homeClubId === club.id || f.awayClubId === club.id,
    )
    const competition = clubFx?.competition
    if (club.controlledBy === 'ai') {
      const current = tacticsByClub[club.id]
      const coach = getWorldCoach(club.coachId)
      const formation = coach?.preferredFormation ?? current.formation
      const oop = coach?.formationOop ?? current.formationOop
      const picked = autoPickTactics(club.id, players, formation, oop, coach)
      tacticsByClub[club.id] = ensureClubMatchdaySquad(
        save,
        club.id,
        {
          ...picked,
          instructions: coach ? instructionsFromCoach(coach) : current.instructions,
          familiarity: current.familiarity,
          setPieces: current.setPieces,
        },
        competition,
      )
    } else {
      // มนุษย์: เติมม้านั่งสำรองให้ครบก่อนเตะ
      tacticsByClub[club.id] = ensureClubMatchdaySquad(
        save,
        club.id,
        tacticsByClub[club.id]!,
        competition,
      )
    }
  }
  // AI ม้านั่งก็ต้องครบ (autoPick มีแล้ว แต่กันเคสว่าง)
  for (const club of save.clubs) {
    const t = tacticsByClub[club.id]!
    if (t.bench.length < MATCH_BENCH_SIZE) {
      const clubFx = dayFixtures.find(
        (f) => f.homeClubId === club.id || f.awayClubId === club.id,
      )
      tacticsByClub[club.id] = ensureClubMatchdaySquad(
        save,
        club.id,
        t,
        clubFx?.competition,
      )
    }
  }

  const dynBonus =
    (save.humanClubId && save.dynamics ? dynamicsMatchBonus(save.dynamics) : 1) *
    talkBonusFromSave(save)

  const results: PreparedMatchday['results'] = []
  let humanResult: MatchResult | null = null
  let humanFixture: Fixture | null = null
  let halfTime: PreparedMatchday['halfTime'] = null

  for (const fixture of dayFixtures) {
    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    const pauseHt = !!(opts?.pauseAtHalfTime && involvesHuman)
    const homeClub = save.clubs.find((c) => c.id === fixture.homeClubId)!
    const isHumanHome = homeClub.id === save.humanClubId
    const fanMult =
      isHumanHome && save.fans ? fanTicketMultiplier(save.fans, matchday) : 1
    const attendance =
      fixture.attendance ??
      estimateAttendance(homeClub.stadiumCapacity, homeClub.reputation, fanMult)
    const fxWithCrowd: Fixture = { ...fixture, attendance }
    const stadiumVisitors =
      isHumanHome ? planMatchVisitors(save, fxWithCrowd) : undefined
    const result = simulateFixture(
      fxWithCrowd,
      save.clubs,
      players,
      tacticsByClub,
      matchday * 17,
      involvesHuman ? dynBonus : 1,
      getReferee(fixture.refereeId),
      save.managerProfile
        ? {
            humanClubId: save.humanClubId,
            managerName: save.managerName,
            manager: {
              style: save.managerProfile.style,
              power: save.managerProfile.power,
              attackingIQ: save.managerProfile.attackingIQ,
              defendingIQ: save.managerProfile.defendingIQ,
              manManagement: save.managerProfile.manManagement,
              adaptability: save.managerProfile.adaptability,
              strongVs: save.managerProfile.strongVs,
              weakVs: save.managerProfile.weakVs,
            },
          }
        : undefined,
      {
        teamTalk: involvesHuman ? (save.preMatch?.talkKind ?? null) : null,
        pendingShouts: involvesHuman ? save.preMatch?.touchlineShouts : undefined,
        fidelity: involvesHuman ? 'human' : 'ai',
        phase: pauseHt ? 'firstHalf' : 'full',
        crowd: {
          attendance,
          fans: isHumanHome ? save.fans : undefined,
        },
        stadiumVisitors,
      },
    )
    results.push({ fixture: fxWithCrowd, result })
    if (involvesHuman) {
      humanResult = result
      humanFixture = fxWithCrowd
      if (pauseHt && result.midState) {
        halfTime = { midState: result.midState, resolved: false }
      }
    }
  }

  return {
    matchday,
    date: dayFixtures[0]?.date ?? save.currentDate,
    tacticsByClub,
    results,
    humanResult,
    humanFixture,
    halfTime,
    matchWindow: null,
  }
}

/** After HT UI — apply adjustments and simulate to ~70' window (or full 2H if no live window). */
/** รวมคิวเปลี่ยนตัว — ไม่ซ้ำ out/in · จำกัดโควต้า */
function mergeSubs(
  a: HalfTimeSub[] | undefined,
  b: HalfTimeSub[] | undefined,
  max: number,
): HalfTimeSub[] {
  const out: HalfTimeSub[] = []
  const used = new Set<string>()
  for (const s of [...(a ?? []), ...(b ?? [])]) {
    if (out.length >= max) break
    if (used.has(s.outId) || used.has(s.inId)) continue
    used.add(s.outId)
    used.add(s.inId)
    out.push(s)
  }
  return out
}

function syncHumanTacticsFromMid(
  tacticsByClub: Record<string, Tactics>,
  mid: import('./match/halfTime').MatchMidState,
  fx: Fixture,
  humanClubId: string,
): Record<string, Tactics> {
  const humanIsHome = fx.homeClubId === humanClubId
  const newXi = humanIsHome ? mid.homeXi : mid.awayXi
  const tac = tacticsByClub[humanClubId]
  if (!tac || !newXi?.length) return tacticsByClub
  const pool = [...new Set([...tac.startingXi, ...tac.bench, ...newXi])]
  const on = new Set(newXi)
  return {
    ...tacticsByClub,
    [humanClubId]: {
      ...tac,
      startingXi: [...newXi],
      bench: pool.filter((id) => !on.has(id)),
    },
  }
}

export function continueAfterHalfTime(
  save: GameSave,
  prepared: PreparedMatchday,
  adj: HalfTimeAdjustments = {},
): PreparedMatchday {
  if (!prepared.halfTime || prepared.halfTime.resolved || !prepared.humanFixture || !prepared.humanResult) {
    return prepared
  }
  const fx = prepared.humanFixture
  const mid = prepared.halfTime.midState
  const sentOff = new Set(mid.sentOffIds)
  const humanIsHome = fx.homeClubId === save.humanClubId
  const humanClubId = save.humanClubId
  const remaining = Math.max(
    0,
    (mid.maxSubs ?? MAX_MATCH_SUBS) -
      (humanIsHome ? mid.homeSubsUsed ?? mid.subsUsed ?? 0 : mid.awaySubsUsed ?? mid.subsUsed ?? 0),
  )

  // รวมคิวที่เลือกล่วงหน้า + ที่พักครึ่ง — แผน/กดทันที · ตัวสำรองรอบอลออก
  const queuedSubs = mergeSubs(
    mergeSubs(prepared.pendingHumanSubs, prepared.phaseQueuedSubs, remaining),
    adj.subs,
    remaining,
  )
  let tacticsByClub = { ...prepared.tacticsByClub }
  const applied = applyHalfTimeTactics(
    tacticsByClub[humanClubId]!,
    { ...adj, subs: [] },
    sentOff,
    0,
  )
  tacticsByClub[humanClubId] = applied.tactics

  const humanIsHomeSide = humanIsHome
  let homeSubsUsed = mid.homeSubsUsed ?? (humanIsHomeSide ? mid.subsUsed ?? 0 : 0)
  let awaySubsUsed = mid.awaySubsUsed ?? (humanIsHomeSide ? 0 : mid.subsUsed ?? 0)

  // AI แก้เกมเต็มรูปแบบที่พักครึ่ง (แผน+ตัว — พักครึ่งบอลออกอยู่แล้ว)
  const aiClubId = humanIsHome ? fx.awayClubId : fx.homeClubId
  const aiSide: 'home' | 'away' = humanIsHome ? 'away' : 'home'
  const aiTac = tacticsByClub[aiClubId]!
  const aiGoals = humanIsHome ? mid.awayGoals : mid.homeGoals
  const humanGoals = humanIsHome ? mid.homeGoals : mid.awayGoals
  const aiUsed = aiSide === 'home' ? homeSubsUsed : awaySubsUsed
  const aiSolved = aiSolveGame({
    tactics: aiTac,
    players: save.players,
    conditions: mid.conditions,
    ourGoals: aiGoals,
    theirGoals: humanGoals,
    minute: 46,
    remainingSubs: MAX_MATCH_SUBS - aiUsed,
    coach: getWorldCoach(save.clubs.find((c) => c.id === aiClubId)?.coachId),
    rng: () => Math.random(),
  })
  tacticsByClub[aiClubId] = aiSolved.tactics
  if (aiSide === 'home') homeSubsUsed += aiSolved.subs.length
  else awaySubsUsed += aiSolved.subs.length

  for (const s of aiSolved.subs) {
    const outN = save.players.find((p) => p.id === s.outId)?.name ?? s.outId
    const inN = save.players.find((p) => p.id === s.inId)?.name ?? s.inId
    mid.events.push({
      id: `ev-${fx.id}-aisub-${s.inId}`,
      minute: 46,
      kind: 'substitution',
      text: `AI พักครึ่ง · ${outN} ↔ ${inN}`,
      spot: { x: 50, y: 50 },
      homeGoals: mid.homeGoals,
      awayGoals: mid.awayGoals,
      clubId: aiClubId,
      playerId: s.inId,
      playerName: inN,
    })
  }
  if (aiSolved.shout) {
    mid.events.push({
      id: `ev-${fx.id}-aisolve-ht`,
      minute: 46,
      kind: 'commentary',
      text: aiSolved.shout,
      spot: { x: 50, y: 50 },
      homeGoals: mid.homeGoals,
      awayGoals: mid.awayGoals,
      clubId: aiClubId,
    })
  }
  if (queuedSubs.length > 0) {
    mid.events.push({
      id: `ev-${fx.id}-ht-queue`,
      minute: 45,
      kind: 'commentary',
      text: `ขอเปลี่ยนตัว ${queuedSubs.length} คน — ลงสนามเมื่อบอลออก`,
      spot: { x: 50, y: 50 },
      homeGoals: mid.homeGoals,
      awayGoals: mid.awayGoals,
      clubId: humanClubId,
    })
  }

  const dynBonus =
    (save.humanClubId && save.dynamics ? dynamicsMatchBonus(save.dynamics) : 1) *
    (adj.teamTalk
      ? ({ calm: 1.02, inspire: 1.05, focus_weakness: 1.06, trust_xi: 1.03 }[adj.teamTalk] ?? 1)
      : 1)

  const resume: typeof mid = {
    ...mid,
    homeSubsUsed,
    awaySubsUsed,
    subsUsed: humanIsHomeSide ? homeSubsUsed : awaySubsUsed,
    maxSubs: mid.maxSubs ?? MAX_MATCH_SUBS,
    clockMinute: mid.clockMinute ?? 45,
  }

  const second = simulateFixture(
    fx,
    save.clubs,
    save.players,
    tacticsByClub,
    prepared.matchday * 17 + 91,
    dynBonus,
    getReferee(fx.refereeId),
    save.managerProfile
      ? {
          humanClubId: save.humanClubId,
          managerName: save.managerName,
          manager: {
            style: save.managerProfile.style,
            power: save.managerProfile.power,
            attackingIQ: save.managerProfile.attackingIQ,
            defendingIQ: save.managerProfile.defendingIQ,
            manManagement: save.managerProfile.manManagement,
            adaptability: save.managerProfile.adaptability,
            strongVs: save.managerProfile.strongVs,
            weakVs: save.managerProfile.weakVs,
          },
        }
      : undefined,
    {
      teamTalk: adj.teamTalk ?? null,
      pendingShouts: adj.shouts?.length
        ? adj.shouts
        : prepared.pendingLiveShouts,
      fidelity: 'human',
      phase: 'secondHalf',
      resume,
      pendingHumanSubs: queuedSubs,
      crowd: {
        attendance: fx.attendance,
        fans: fx.homeClubId === save.humanClubId ? save.fans : undefined,
      },
    },
  )

  const results = prepared.results.map((r) =>
    r.fixture.id === fx.id ? { fixture: fx, result: second } : r,
  )

  let tacticsOut = tacticsByClub
  if (second.midState) {
    tacticsOut = syncHumanTacticsFromMid(tacticsByClub, second.midState, fx, humanClubId)
  } else {
    // ครึ่งหลังจบแล้ว — sync จาก XI ใน events ล่าสุดผ่าน homeXi ใน breakdown ไม่มี mid
    // ใช้ phaseQueued ที่ลงไปแล้วผ่าน pending ในเอนจิน → อัปเดตจาก queuedSubs
    if (queuedSubs.length > 0) {
      const applied = applyHalfTimeTactics(
        tacticsByClub[humanClubId]!,
        { subs: queuedSubs },
        sentOff,
        queuedSubs.length,
      )
      tacticsOut = { ...tacticsByClub, [humanClubId]: applied.tactics }
    }
  }

  return {
    ...prepared,
    tacticsByClub: tacticsOut,
    results,
    humanResult: second,
    pendingHumanSubs: [],
    phaseQueuedSubs: [],
    pendingSubsEarliestMinute: undefined,
    pendingLiveShouts: undefined,
    halfTime: { midState: resume, resolved: true },
    matchWindow: null,
  }
}

/**
 * ขอเปลี่ยนตัวระหว่างแมตช์สด — เลือกได้ตลอด · เกมไม่หยุด · ลงสนามเมื่อบอลออก
 */
export function queueHumanSubLive(
  save: GameSave,
  prepared: PreparedMatchday,
  sub: HalfTimeSub,
  atMinute: number,
): PreparedMatchday {
  if (!prepared.humanFixture) return prepared
  const humanIsHome = prepared.humanFixture.homeClubId === save.humanClubId
  const mid = prepared.halfTime?.midState
  const used = mid
    ? humanIsHome
      ? mid.homeSubsUsed ?? mid.subsUsed ?? 0
      : mid.awaySubsUsed ?? mid.subsUsed ?? 0
    : 0
  const maxSubs = mid?.maxSubs ?? MAX_MATCH_SUBS
  const existing = prepared.phaseQueuedSubs ?? prepared.pendingHumanSubs ?? []
  const remaining = Math.max(0, maxSubs - used)
  if (existing.length >= remaining) return prepared

  const tac = prepared.tacticsByClub[save.humanClubId]
  if (!tac) return prepared
  if (!tac.startingXi.includes(sub.outId) || !tac.bench.includes(sub.inId)) return prepared
  if (mid?.sentOffIds.includes(sub.outId) || mid?.sentOffIds.includes(sub.inId)) return prepared

  const phaseQueued = mergeSubs(existing, [sub], remaining)
  const withQueue: PreparedMatchday = {
    ...prepared,
    pendingHumanSubs: phaseQueued,
    phaseQueuedSubs: phaseQueued,
    pendingSubsEarliestMinute: Math.max(prepared.pendingSubsEarliestMinute ?? 0, atMinute),
  }

  // ครึ่งแรก — เก็บคิว ใช้ตอนพักครึ่ง
  if (!prepared.halfTime?.resolved) return withQueue

  // ครึ่งหลังกำลังเล่น — ซิมใหม่จากพักครึ่ง (เกมใน UI ไม่หยุดแผง)
  return resimSecondHalfWithPending(save, withQueue)
}

export function removeHumanSubLive(
  save: GameSave,
  prepared: PreparedMatchday,
  outId: string,
): PreparedMatchday {
  const pending = (prepared.phaseQueuedSubs ?? prepared.pendingHumanSubs ?? []).filter(
    (s) => s.outId !== outId,
  )
  const next: PreparedMatchday = {
    ...prepared,
    pendingHumanSubs: pending,
    phaseQueuedSubs: pending,
    pendingSubsEarliestMinute: pending.length ? prepared.pendingSubsEarliestMinute : undefined,
  }
  if (!prepared.halfTime?.resolved) return next
  return resimSecondHalfWithPending(save, next)
}

function humanSimCtx(save: GameSave) {
  return save.managerProfile
    ? {
        humanClubId: save.humanClubId,
        managerName: save.managerName,
        manager: {
          style: save.managerProfile.style,
          power: save.managerProfile.power,
          attackingIQ: save.managerProfile.attackingIQ,
          defendingIQ: save.managerProfile.defendingIQ,
          manManagement: save.managerProfile.manManagement,
          adaptability: save.managerProfile.adaptability,
          strongVs: save.managerProfile.strongVs,
          weakVs: save.managerProfile.weakVs,
        },
      }
    : undefined
}

function resimSecondHalfWithPending(save: GameSave, prepared: PreparedMatchday): PreparedMatchday {
  if (!prepared.halfTime?.resolved || !prepared.humanFixture) return prepared
  const fx = prepared.humanFixture
  const mid = prepared.halfTime.midState
  const queued = prepared.phaseQueuedSubs ?? prepared.pendingHumanSubs ?? []
  const tacticsByClub = syncHumanTacticsFromMid(
    prepared.tacticsByClub,
    mid,
    fx,
    save.humanClubId,
  )
  const second = simulateFixture(
    fx,
    save.clubs,
    save.players,
    tacticsByClub,
    prepared.matchday * 17 + 91,
    save.humanClubId && save.dynamics ? dynamicsMatchBonus(save.dynamics) : 1,
    getReferee(fx.refereeId),
    humanSimCtx(save),
    {
      fidelity: 'human',
      phase: 'secondHalf',
      resume: mid,
      pendingHumanSubs: queued,
      pendingSubsEarliestMinute: prepared.pendingSubsEarliestMinute,
      pendingShouts: prepared.pendingLiveShouts,
      crowd: {
        attendance: fx.attendance,
        fans: fx.homeClubId === save.humanClubId ? save.fans : undefined,
      },
    },
  )
  const results = prepared.results.map((r) =>
    r.fixture.id === fx.id ? { fixture: fx, result: second } : r,
  )
  let tacticsOut = tacticsByClub
  if (queued.length > 0) {
    const applied = applyHalfTimeTactics(
      tacticsByClub[save.humanClubId]!,
      { subs: queued },
      new Set(mid.sentOffIds),
      queued.length,
    )
    tacticsOut = { ...tacticsByClub, [save.humanClubId]: applied.tactics }
  }
  return {
    ...prepared,
    tacticsByClub: tacticsOut,
    results,
    humanResult: second,
    pendingHumanSubs: queued,
    phaseQueuedSubs: queued,
    pendingLiveShouts: undefined,
    matchWindow: null,
  }
}

/**
 * แก้แผน / ตะโกนกลางเกม — ไม่หยุดเกม · ครึ่งหลังซิมใหม่จากพักครึ่ง
 */
export function applyLiveMatchAdjustments(
  save: GameSave,
  prepared: PreparedMatchday,
  adj: HalfTimeAdjustments,
  atMinute: number,
): PreparedMatchday {
  if (!prepared.humanFixture) return prepared
  const humanClubId = save.humanClubId
  const sentOff = new Set(prepared.halfTime?.midState?.sentOffIds ?? [])
  let tacticsByClub = { ...prepared.tacticsByClub }
  const applied = applyHalfTimeTactics(
    tacticsByClub[humanClubId]!,
    { ...adj, subs: [] },
    sentOff,
    0,
  )
  tacticsByClub[humanClubId] = applied.tactics

  let next: PreparedMatchday = {
    ...prepared,
    tacticsByClub,
    pendingLiveShouts: adj.shouts?.length
      ? adj.shouts.slice(-3)
      : prepared.pendingLiveShouts,
  }

  if (adj.subs?.length) {
    for (const s of adj.subs) {
      next = queueHumanSubLive(save, next, s, atMinute)
    }
  }

  // ครึ่งแรก — เก็บแผน/ตะโกน ใช้ตอนพักครึ่ง
  if (!prepared.halfTime?.resolved) return next

  return resimSecondHalfWithPending(save, next)
}

export function applyPreparedMatchday(save: GameSave, prepared: PreparedMatchday): GameSave {
  save = ensureFans(save)
  let fixtures = assignRefereesToFixtures(save.fixtures.slice())
  let table = save.table.slice()
  let tableDiv2 = (save.tableDiv2 ?? []).slice()
  let players = save.players.slice()
  let clubs = save.clubs.map((c) => ({ ...c }))
  let fans = save.fans
  let board = save.board
  let ownerState = ensureOwner(save)
  let cup = save.cup
  let leagueCup = save.leagueCup ?? { name: 'League Cup', championClubId: null, eliminated: [] }
  let trophy = save.trophy ?? { name: 'Trophy', championClubId: null, eliminated: [] }
  let ucl = save.ucl
  let uel = save.uel ?? { name: 'UEFA Europa League', championClubId: null, eliminated: [] }
  let uecl = save.uecl ?? { name: 'UEFA Conference League', championClubId: null, eliminated: [] }
  let acl = save.acl ?? createAclState()
  let aclTwo = save.aclTwo ?? createAclTwoState()
  let aseanCup = save.aseanCup ?? createAseanCupState()
  let cwc = save.cwc ?? createCwcState()
  let cwcAccess = ensureCwcAccess(save)
  let superCup = save.superCup ?? createSuperCupState(save.leagueId || 'eng')
  let pressConference = save.pressConference ?? null
  let playerInterview = save.playerInterview ?? null
  let managerReputation = save.managerReputation ?? 50
  let managerProgress = save.managerProgress
  let managerProfile = save.managerProfile
  let clubQuests = save.clubQuests
  let humanMatchHint: { won: boolean; competition: string } | undefined
  let clubFinance = ensureClubFinance(save)
  const inbox: InboxMessage[] = [...save.inbox]
  let tacticsByClub = { ...prepared.tacticsByClub }
  let humanResult: MatchResult | null = null
  const banAtStart = new Map(players.map((p) => [p.id, p.banMatches ?? 0]))
  const playedClubs = new Set<string>()
  let discRngSeed = prepared.matchday * 7919
  const newsBatch: MediaItem[] = []
  const injuryBefore = players.map((p) => ({ id: p.id, injuryDays: p.injuryDays }))
  const cardFineTriggers: Array<{ playerId: string; kind: 'red_card' | 'yellow_ban' }> = []

  const sorted = table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.gf - b.ga - (a.gf - a.ga)
  })
  const humanRank = sorted.findIndex((r) => r.clubId === save.humanClubId)
  let workingSave: GameSave = save.rivalries?.length
    ? save
    : seedLeagueRivalries(save)
  const rivalIds = rivalIdsForClub(workingSave, save.humanClubId, sorted)
  void humanRank

  const archiveBatch: ReturnType<typeof buildArchiveEntry>[] = []

  for (const { fixture, result } of prepared.results) {
    playedClubs.add(fixture.homeClubId)
    playedClubs.add(fixture.awayClubId)
    archiveBatch.push(
      buildArchiveEntry(fixture, result, {
        season: save.season,
        humanClubId: save.humanClubId,
      }),
    )
    fixtures = fixtures.map((f) =>
      f.id === fixture.id
        ? {
            ...f,
            played: true,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            refereeId: fixture.refereeId ?? f.refereeId,
            weather: fixture.weather ?? f.weather,
            attendance: result.attendance ?? fixture.attendance ?? f.attendance,
            penaltiesHome: result.penalties?.home,
            penaltiesAway: result.penalties?.away,
            matchStats: result.stats
              ? { home: { ...result.stats.home }, away: { ...result.stats.away } }
              : f.matchStats,
          }
        : f,
    )
    if (fixture.competition === 'league' && (fixture.division === 2 || String(fixture.id).startsWith('fx2'))) {
      tableDiv2 = applyResultToTable(tableDiv2, fixture, result.homeGoals, result.awayGoals)
    } else {
      table = applyResultToTable(table, fixture, result.homeGoals, result.awayGoals)
    }

    const home = clubs.find((c) => c.id === fixture.homeClubId)!
    const away = clubs.find((c) => c.id === fixture.awayClubId)!
    const isHumanHome = home.id === save.humanClubId
    const gateAttendance = result.attendance ?? fixture.attendance
    const receipt = calcGateReceipt(
      home,
      result.homeGoals,
      result.awayGoals,
      isHumanHome ? fans : undefined,
      prepared.matchday,
      isHumanHome ? commercialGateBonus(save) : 1,
      gateAttendance,
    )
    clubs = clubs.map((c) =>
      c.id === home.id ? applyGateReceiptToClub(c, receipt) : c,
    )
    if (isHumanHome) {
      clubFinance = recordHumanGate(clubFinance, fixture.date, receipt, home.shortName)
    }
    const homeIncome = receipt.total

    const injuryMult = weatherMatchModifiers(fixture.weather ?? 'clear').injury
    // บาดเจ็บ Burst Zone ระหว่างเกม — ลงทะเบียนก่อน fatigue ปกติ
    for (const inj of result.inMatchInjuries ?? []) {
      players = players.map((p) => {
        if (p.id !== inj.playerId || p.injuryDays > 0) return p
        const next = applyInjury(p, 'match')
        return {
          ...next,
          injuryDays: inj.days,
          injuryType: inj.type,
        }
      })
    }
    players = applyMatchFatigue(players, tacticsByClub[fixture.homeClubId], true, injuryMult, {
      minutesById: result.minutesOnPitch,
      finalConditions: result.finalConditions,
      ratings: result.playerRatings,
      clubId: fixture.homeClubId,
    })
    players = applyMatchFatigue(players, tacticsByClub[fixture.awayClubId], true, injuryMult, {
      minutesById: result.minutesOnPitch,
      finalConditions: result.finalConditions,
      ratings: result.playerRatings,
      clubId: fixture.awayClubId,
    })
    // ฟอร์ม + ความคุ้นเคยบทบาทจากเรตติ้งหน้าที่
    players = applyPostMatchRoleProgress(players, result, {
      [fixture.homeClubId]: tacticsByClub[fixture.homeClubId],
      [fixture.awayClubId]: tacticsByClub[fixture.awayClubId],
    })
    tacticsByClub[fixture.homeClubId] = bumpFamiliarity(tacticsByClub[fixture.homeClubId], true)
    tacticsByClub[fixture.awayClubId] = bumpFamiliarity(tacticsByClub[fixture.awayClubId], true)

    discRngSeed += 17
    const disc = applyDisciplineFromEvents(players, result.events, () => {
      discRngSeed = (discRngSeed * 16807) % 2147483647
      return discRngSeed / 2147483647
    })
    players = disc.players
    for (const t of disc.fineTriggers) cardFineTriggers.push(t)
    for (const note of disc.notes) {
      if (
        fixture.homeClubId === save.humanClubId ||
        fixture.awayClubId === save.humanClubId
      ) {
        inbox.unshift({
          id: `msg-ban-${Date.now()}-${note.slice(0, 12)}`,
          date: fixture.date,
          title: 'วินัย',
          body: note,
          read: false,
        })
      }
    }

    // แฟนเกลียดตอนเจอกัน — ทุกคู่ (ไม่ใช่แค่ทีมผู้เล่น)
    {
      const homeXi = tacticsByClub[fixture.homeClubId]?.startingXi ?? []
      const awayXi = tacticsByClub[fixture.awayClubId]?.startingXi ?? []
      const hate = applyFanHatredBothSides(
        {
          ...save,
          clubs,
          players,
          fans,
          inbox: [...inbox],
          currentDate: fixture.date,
          matchday: prepared.matchday,
          rivalries: workingSave.rivalries ?? save.rivalries,
        },
        fixture.homeClubId,
        fixture.awayClubId,
        homeXi,
        awayXi,
        result.homeGoals,
        result.awayGoals,
      )
      clubs = hate.save.clubs
      fans = hate.save.fans
      players = hate.save.players
      const seen = new Set(inbox.map((m) => m.id))
      for (const msg of hate.save.inbox) {
        if (!seen.has(msg.id)) {
          inbox.unshift(msg)
          seen.add(msg.id)
        }
      }
    }

    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    if (involvesHuman) {
      humanResult = result
      const opp = fixture.homeClubId === save.humanClubId ? away : home
      const usHome = fixture.homeClubId === save.humanClubId
      const usGoals = usHome ? result.homeGoals : result.awayGoals
      const themGoals = usHome ? result.awayGoals : result.homeGoals
      const outcome = usGoals > themGoals ? 'ชนะ' : usGoals === themGoals ? 'เสมอ' : 'แพ้'
      fans = applyMatchToFans(fans, usGoals, themGoals, usHome)
      clubs = clubs.map((c) =>
        c.id === save.humanClubId
          ? {
              ...c,
              clubFans: {
                mood: fans.mood,
                lastEvent: fans.lastEvent || c.clubFans?.lastEvent || '',
                hatedPlayers: fans.hatedPlayers ?? c.clubFans?.hatedPlayers ?? [],
                hatedTeams: fans.hatedTeams ?? c.clubFans?.hatedTeams ?? [],
              },
            }
          : c,
      )

      const midSave: GameSave = {
        ...save,
        table,
        fans,
        board,
        players,
        clubs,
        tacticsByClub,
        fixtures,
        managerReputation,
      }
      board = applyMatchToBoard(midSave, usGoals, themGoals)
      ownerState = applyMatchToOwner({ ...midSave, board, fans }, usGoals, themGoals)
      {
        const atm = processStadiumPresence(
          {
            ...midSave,
            board,
            fans,
            owner: ownerState,
            clubs,
            inbox,
            currentDate: fixture.date,
            matchday: prepared.matchday,
          },
          usGoals,
          themGoals,
          usHome,
        )
        ownerState = atm.owner
        board = atm.board
        fans = atm.fans
        clubs = atm.clubs
        inbox.length = 0
        inbox.push(...atm.inbox)
      }

      newsBatch.push(newsAfterMatch({ ...midSave, board }, usGoals, themGoals, opp.name))
      // second outlet angle ~50%
      if (Math.random() < 0.5) {
        const alt = newsAfterMatch(
          { ...midSave, board, matchday: prepared.matchday + 17 },
          usGoals,
          themGoals,
          opp.name,
        )
        newsBatch.push({
          ...alt,
          body: `มุมมองสำนักที่สอง: ${alt.body}`,
        })
      }
      pressConference = createPressConference(
        { ...midSave, board, currentDate: fixture.date },
        usGoals,
        themGoals,
        opp.name,
      )
      playerInterview = maybeCreatePlayerInterview(
        { ...midSave, currentDate: fixture.date },
        result,
      )
      managerReputation = Math.max(
        0,
        Math.min(100, managerReputation + (usGoals > themGoals ? 2 : usGoals === themGoals ? 0 : -2)),
      )

      // XP / เลเวล / แอตฯ ขึ้นลง ตามผลงาน
      {
        const humanClub =
          clubs.find((c) => c.id === save.humanClubId) ??
          save.clubs.find((c) => c.id === save.humanClubId)!
        const progressSave = applyManagerMatchProgress(
          {
            ...midSave,
            managerReputation,
            managerProgress,
            managerProfile,
            board,
            fans,
            owner: ownerState,
            inbox: [...inbox],
            lastHumanResult: result,
          },
          {
            won: usGoals > themGoals,
            drawn: usGoals === themGoals,
            lost: usGoals < themGoals,
            clubRep: humanClub.reputation,
            oppRep: opp.reputation,
            competition: fixture.competition,
          },
        )
        managerReputation = progressSave.managerReputation
        managerProgress = progressSave.managerProgress
        managerProfile = progressSave.managerProfile
        humanMatchHint = {
          won: usGoals > themGoals,
          competition: fixture.competition,
        }
        for (const m of progressSave.inbox) {
          if (!inbox.some((x) => x.id === m.id)) inbox.unshift(m)
        }
      }

      const st = usHome ? result.stats.home : result.stats.away
      const comp =
        fixture.competition === 'cup'
          ? `ถ้วย (${fixture.cupRound})`
          : fixture.competition === 'ucl'
            ? `UCL (${fixture.cupRound})`
            : fixture.competition === 'uel'
              ? `Europa (${fixture.cupRound})`
              : fixture.competition === 'uecl'
                ? `Conference (${fixture.cupRound})`
                : fixture.competition === 'acl'
                  ? `ACL Elite (${fixture.cupRound})`
                  : fixture.competition === 'acl_two'
                    ? `ACL Two (${fixture.cupRound})`
                    : fixture.competition === 'asean_cup'
                      ? `ASEAN (${fixture.cupRound})`
                      : fixture.competition === 'cwc'
                        ? `สโมสรโลก (${fixture.cupRound})`
                        : fixture.competition === 'super_cup'
                          ? `${save.superCup?.name ?? 'Super Cup'}`
                          : 'ลีก'
      const gateNote = usHome
        ? ` · ตั๋ว ${formatMoney(receipt.tickets)} + เสื้อ ${formatMoney(receipt.shirts)} (ผู้ชม ~${receipt.crowd.toLocaleString('th-TH')})`
        : ` · รายได้เจ้าบ้าน ${formatMoney(homeIncome)}`
      inbox.unshift({
        id: `msg-${Date.now()}-${fixture.id}`,
        date: fixture.date,
        title: `${outcome} พบ ${opp.name} · ${comp}`,
        body: `สกอร์ ${result.homeGoals}–${result.awayGoals} · ยิง ${st.shots} (เข้ากรอบ ${st.shotsOnTarget}) · ใบ ${st.yellows}Y/${st.reds}R${gateNote}`,
        read: false,
      })
    } else if (
      fixture.competition === 'league' &&
      (rivalIds.has(fixture.homeClubId) || rivalIds.has(fixture.awayClubId)) &&
      Math.random() < 0.38
    ) {
      const rivalIsHome = rivalIds.has(fixture.homeClubId)
      const rival = rivalIsHome ? home : away
      const opp = rivalIsHome ? away : home
      const rg = rivalIsHome ? result.homeGoals : result.awayGoals
      const og = rivalIsHome ? result.awayGoals : result.homeGoals
      newsBatch.push(
        newsRivalResult(
          { ...save, currentDate: fixture.date, managerReputation },
          rival.shortName,
          opp.shortName,
          rg,
          og,
        ),
      )
    }
  }

  // Serve bans for players who already sat out this matchday
  players = players.map((p) => {
    const prior = banAtStart.get(p.id) ?? 0
    if (prior <= 0 || !playedClubs.has(p.clubId)) return p
    return { ...p, banMatches: Math.max(0, (p.banMatches ?? 0) - 1) }
  })
  tacticsByClub = stripBannedFromTactics(tacticsByClub, players)
  // Refill XIs missing banned/injured slots
  for (const club of clubs) {
    const t = tacticsByClub[club.id]
    if (!t || t.startingXi.length >= 11) continue
    tacticsByClub[club.id] = {
      ...autoPickTactics(
        club.id,
        players,
        t.formation,
        t.formationOop,
        getWorldCoach(club.coachId),
      ),
      instructions: t.instructions,
      familiarity: t.familiarity,
      setPieces: t.setPieces,
    }
  }

  const cupAdv = advanceCupAfterMatchday(fixtures, cup, prepared.matchday)
  fixtures = cupAdv.fixtures
  cup = cupAdv.cup
  const lcAdv = advanceLeagueCupAfterMatchday(fixtures, leagueCup, prepared.matchday)
  fixtures = lcAdv.fixtures
  leagueCup = lcAdv.cup
  const trAdv = advanceTrophyAfterMatchday(fixtures, trophy, prepared.matchday)
  fixtures = trAdv.fixtures
  trophy = trAdv.cup
  if (cup.championClubId && !save.cup.championClubId) {
    const champ = clubs.find((c) => c.id === cup.championClubId)
    inbox.unshift({
      id: `msg-cup-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of the Cup',
      body: `${champ?.name ?? cup.championClubId} คว้าแชมป์ ${cup.name}`,
      read: false,
    })
    newsBatch.push(
      newsAfterTitle(
        { ...save, currentDate: prepared.date, managerReputation },
        cup.name,
        champ?.name ?? cup.championClubId,
        cup.championClubId === save.humanClubId,
      ),
    )
    if (cup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 5)
    }
  }

  // apply prize money after cup crowned
  if (cup.championClubId && !save.cup.championClubId) {
    const cupPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'cup',
      cup.championClubId,
      finalRunnerUpClubId(fixtures, 'cup', cup.championClubId),
    )
    clubs = cupPrize.clubs
    clubFinance = cupPrize.clubFinance
  }

  if (leagueCup.championClubId && !save.leagueCup?.championClubId) {
    const champ = clubs.find((c) => c.id === leagueCup.championClubId)
    inbox.unshift({
      id: `msg-lc-${Date.now()}`,
      date: prepared.date,
      title: 'League Cup Champions',
      body: `${champ?.name ?? leagueCup.championClubId} คว้าแชมป์ ${leagueCup.name}`,
      read: false,
    })
    if (leagueCup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 3)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'league_cup',
      leagueCup.championClubId,
      finalRunnerUpClubId(fixtures, 'league_cup', leagueCup.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  if (trophy.championClubId && !save.trophy?.championClubId) {
    const champ = clubs.find((c) => c.id === trophy.championClubId)
    inbox.unshift({
      id: `msg-tr-${Date.now()}`,
      date: prepared.date,
      title: 'Trophy Champions',
      body: `${champ?.name ?? trophy.championClubId} คว้าแชมป์ ${trophy.name}`,
      read: false,
    })
    if (trophy.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 2)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'trophy',
      trophy.championClubId,
      finalRunnerUpClubId(fixtures, 'trophy', trophy.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  const uclAdv = advanceUclAfterMatchday(fixtures, ucl, prepared.matchday)
  fixtures = uclAdv.fixtures
  ucl = uclAdv.ucl
  {
    let prizeSave = { ...save, clubs, fixtures, currentDate: prepared.date, clubFinance }
    for (const stage of ['qf', 'sf'] as const) {
      const ids = newlyQualifiedClubIds(save.fixtures, fixtures, 'ucl', stage)
      if (ids.length) prizeSave = awardProgressPrize(prizeSave, 'ucl', stage, ids)
    }
    clubs = prizeSave.clubs
    clubFinance = prizeSave.clubFinance
  }
  if (ucl.championClubId && !save.ucl?.championClubId) {
    const champ = clubs.find((c) => c.id === ucl.championClubId)
    inbox.unshift({
      id: `msg-ucl-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of Europe',
      body: `${champ?.name ?? ucl.championClubId} คว้าแชมป์ ${ucl.name}`,
      read: false,
    })
    newsBatch.push(
      newsAfterTitle(
        { ...save, currentDate: prepared.date, managerReputation },
        ucl.name,
        champ?.name ?? ucl.championClubId,
        ucl.championClubId === save.humanClubId,
      ),
    )
    if (ucl.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 8)
    }
    const uclPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'ucl',
      ucl.championClubId,
      finalRunnerUpClubId(fixtures, 'ucl', ucl.championClubId),
    )
    clubs = uclPrize.clubs
    clubFinance = uclPrize.clubFinance
  }

  const uelAdv = advanceUelAfterMatchday(fixtures, uel, prepared.matchday)
  fixtures = uelAdv.fixtures
  uel = uelAdv.uel
  {
    let prizeSave = { ...save, clubs, fixtures, currentDate: prepared.date, clubFinance }
    for (const stage of ['qf', 'sf'] as const) {
      const ids = newlyQualifiedClubIds(save.fixtures, fixtures, 'uel', stage)
      if (ids.length) prizeSave = awardProgressPrize(prizeSave, 'uel', stage, ids)
    }
    clubs = prizeSave.clubs
    clubFinance = prizeSave.clubFinance
  }
  if (uel.championClubId && !save.uel?.championClubId) {
    const champ = clubs.find((c) => c.id === uel.championClubId)
    inbox.unshift({
      id: `msg-uel-${Date.now()}`,
      date: prepared.date,
      title: 'Europa League champions',
      body: `${champ?.name ?? uel.championClubId} คว้าแชมป์ ${uel.name}`,
      read: false,
    })
    if (uel.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 5)
    }
    const uelPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'uel',
      uel.championClubId,
      finalRunnerUpClubId(fixtures, 'uel', uel.championClubId),
    )
    clubs = uelPrize.clubs
    clubFinance = uelPrize.clubFinance
  }

  const ueclAdv = advanceUeclAfterMatchday(fixtures, uecl, prepared.matchday)
  fixtures = ueclAdv.fixtures
  uecl = ueclAdv.uecl
  {
    let prizeSave = { ...save, clubs, fixtures, currentDate: prepared.date, clubFinance }
    for (const stage of ['qf', 'sf'] as const) {
      const ids = newlyQualifiedClubIds(save.fixtures, fixtures, 'uecl', stage)
      if (ids.length) prizeSave = awardProgressPrize(prizeSave, 'uecl', stage, ids)
    }
    clubs = prizeSave.clubs
    clubFinance = prizeSave.clubFinance
  }
  if (uecl.championClubId && !save.uecl?.championClubId) {
    const champ = clubs.find((c) => c.id === uecl.championClubId)
    inbox.unshift({
      id: `msg-uecl-${Date.now()}`,
      date: prepared.date,
      title: 'Conference League champions',
      body: `${champ?.name ?? uecl.championClubId} คว้าแชมป์ ${uecl.name}`,
      read: false,
    })
    if (uecl.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 4)
    }
    const ueclPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'uecl',
      uecl.championClubId,
      finalRunnerUpClubId(fixtures, 'uecl', uecl.championClubId),
    )
    clubs = ueclPrize.clubs
    clubFinance = ueclPrize.clubFinance
  }

  const aclAdv = advanceAclAfterMatchday(fixtures, acl, prepared.matchday)
  fixtures = aclAdv.fixtures
  acl = aclAdv.cup
  {
    let prizeSave = { ...save, clubs, fixtures, currentDate: prepared.date, clubFinance }
    for (const stage of ['qf', 'sf'] as const) {
      const ids = newlyQualifiedClubIds(save.fixtures, fixtures, 'acl', stage)
      if (ids.length) prizeSave = awardProgressPrize(prizeSave, 'acl', stage, ids)
    }
    clubs = prizeSave.clubs
    clubFinance = prizeSave.clubFinance
  }
  if (acl.championClubId && !save.acl?.championClubId) {
    const champ = clubs.find((c) => c.id === acl.championClubId)
    inbox.unshift({
      id: `msg-acl-${Date.now()}`,
      date: prepared.date,
      title: 'ACL Elite champions',
      body: `${champ?.name ?? acl.championClubId} คว้าแชมป์ ${acl.name}`,
      read: false,
    })
    if (acl.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 6)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'acl',
      acl.championClubId,
      finalRunnerUpClubId(fixtures, 'acl', acl.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  const aclTwoAdv = advanceAclTwoAfterMatchday(fixtures, aclTwo, prepared.matchday)
  fixtures = aclTwoAdv.fixtures
  aclTwo = aclTwoAdv.cup
  {
    let prizeSave = { ...save, clubs, fixtures, currentDate: prepared.date, clubFinance }
    for (const stage of ['qf', 'sf'] as const) {
      const ids = newlyQualifiedClubIds(save.fixtures, fixtures, 'acl_two', stage)
      if (ids.length) prizeSave = awardProgressPrize(prizeSave, 'acl_two', stage, ids)
    }
    clubs = prizeSave.clubs
    clubFinance = prizeSave.clubFinance
  }
  if (aclTwo.championClubId && !save.aclTwo?.championClubId) {
    const champ = clubs.find((c) => c.id === aclTwo.championClubId)
    inbox.unshift({
      id: `msg-acl2-${Date.now()}`,
      date: prepared.date,
      title: 'ACL Two champions',
      body: `${champ?.name ?? aclTwo.championClubId} คว้าแชมป์ ${aclTwo.name}`,
      read: false,
    })
    if (aclTwo.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 4)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'acl_two',
      aclTwo.championClubId,
      finalRunnerUpClubId(fixtures, 'acl_two', aclTwo.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  const aseanAdv = advanceAseanCupAfterMatchday(fixtures, aseanCup, prepared.matchday)
  fixtures = aseanAdv.fixtures
  aseanCup = aseanAdv.cup
  if (aseanCup.championClubId && !save.aseanCup?.championClubId) {
    const champ = clubs.find((c) => c.id === aseanCup.championClubId)
    inbox.unshift({
      id: `msg-asean-${Date.now()}`,
      date: prepared.date,
      title: 'ASEAN Club champions',
      body: `${champ?.name ?? aseanCup.championClubId} คว้าแชมป์ ${aseanCup.name}`,
      read: false,
    })
    if (aseanCup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 3)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'asean_cup',
      aseanCup.championClubId,
      finalRunnerUpClubId(fixtures, 'asean_cup', aseanCup.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  const cwcAdv = advanceCwcAfterMatchday(fixtures, cwc, prepared.matchday)
  fixtures = cwcAdv.fixtures
  cwc = cwcAdv.cup
  if (cwc.championClubId && !save.cwc?.championClubId) {
    const champ = clubs.find((c) => c.id === cwc.championClubId)
    inbox.unshift({
      id: `msg-cwc-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of the Club World',
      body: `${champ?.name ?? cwc.championClubId} คว้าแชมป์สโมสรโลก`,
      read: false,
    })
    if (cwc.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 8)
    }
    cwcAccess = recordCwcChampion(cwcAccess, champ?.name ?? cwc.championClubId)
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'cwc',
      cwc.championClubId,
      finalRunnerUpClubId(fixtures, 'cwc', cwc.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  superCup = crownSuperCupFromFixtures(fixtures, superCup, prepared.matchday)
  if (superCup.championClubId && !save.superCup?.championClubId) {
    const champ = clubs.find((c) => c.id === superCup.championClubId)
    inbox.unshift({
      id: `msg-sc-${Date.now()}`,
      date: prepared.date,
      title: `${superCup.name} champions`,
      body: `${champ?.name ?? superCup.championClubId} คว้าแชมป์${superCup.name} · นัดเปิดฤดูกาล`,
      read: false,
    })
    if (superCup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 2)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'super_cup',
      superCup.championClubId,
      finalRunnerUpClubId(fixtures, 'super_cup', superCup.championClubId),
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  let next: GameSave = {
    ...save,
    fixtures,
    table,
    tableDiv2,
    players,
    clubs,
    tacticsByClub,
    fans,
    board,
    owner: ownerState,
    cup,
    leagueCup,
    trophy,
    ucl,
    uel,
    uecl,
    acl,
    aclTwo,
    aseanCup,
    cwc,
    cwcAccess,
    superCup,
    managerReputation,
    managerProgress,
    managerProfile,
    clubQuests,
    pressConference,
    playerInterview,
    clubFinance,
    inbox: inbox.slice(0, 40),
    lastHumanResult: humanResult ?? save.lastHumanResult,
    matchArchive: persistMatchArchiveSideEffect(save, archiveBatch),
    matchday: prepared.matchday,
    seasonComplete: fixtures
      .filter((f) => f.competition === 'league')
      .every((f) => f.played),
    currentDate: prepared.date,
    preMatch: null,
    rivalries: workingSave.rivalries ?? save.rivalries ?? [],
  }

  next = tickEmergentRivalries(
    next,
    prepared.results.map(({ fixture, result }) => ({
      homeClubId: fixture.homeClubId,
      awayClubId: fixture.awayClubId,
      homeGoals: result.homeGoals,
      awayGoals: result.awayGoals,
      competition: fixture.competition,
      fixtureId: fixture.id,
    })),
    next.table,
  )
  next = seedClubHatedTeams(next)

  if (cardFineTriggers.length > 0) {
    let fineRng = prepared.matchday * 4243
    next = applyMatchCardFines(next, cardFineTriggers, prepared.date, () => {
      fineRng = (fineRng * 16807) % 2147483647
      return fineRng / 2147483647
    })
    players = next.players
    clubFinance = next.clubFinance
  }

  const trained = applyTrainingWeek(
    next.players,
    next.humanClubId,
    next.training,
    trainingFacilityBonus(next),
    next.matchday,
    {
      coach: staffLevel(next.staff, 'coach'),
      attacking: staffLevel(next.staff, 'attacking'),
      defending: staffLevel(next.staff, 'defending'),
      fitness: staffLevel(next.staff, 'fitness'),
    },
    {
      tactics: next.tacticsByClub[next.humanClubId],
      dynamics: next.dynamics,
      season: next.season,
    },
  )
  const coachBoost =
    staffLevel(next.staff, 'coach') / 40 + staffLevel(next.staff, 'fitness') / 55
  const trainingInjuries = detectNewInjuries(injuryBefore, trained.players, next.humanClubId)
  // Also catch match injuries (compare mid-state before training)
  const matchInjuries = detectNewInjuries(injuryBefore, players, next.humanClubId)
  const seenInj = new Set<string>()
  for (const inj of [...matchInjuries, ...trainingInjuries]) {
    if (seenInj.has(inj.name)) continue
    seenInj.add(inj.name)
    newsBatch.push(newsAfterInjury(next, inj.name, inj.injuryType, inj.days))
  }

  next = {
    ...next,
    players: trained.players.map((p) =>
      p.clubId === next.humanClubId
        ? { ...p, sharpness: Math.min(100, p.sharpness + coachBoost) }
        : p,
    ),
    dynamics: trained.dynamics ?? next.dynamics,
    inbox: [
      {
        id: `msg-train-${Date.now()}`,
        date: prepared.date,
        title: trained.incidents.some((i) => i.kind === 'fight' || i.kind === 'argument')
          ? 'สรุปการซ้อม · มีดราม่า'
          : 'สรุปการซ้อม',
        body: trained.note,
        read: false,
      },
      ...(((trained.styleEvents ?? []).filter(
        (e) => e.kind === 'level_up' || e.kind === 'unlocked' || e.kind === 'swapped',
      ).length
        ? [
            {
              id: `msg-style-${Date.now()}`,
              date: prepared.date,
              title: 'ฝึกสไตล์เล่น',
              body: (trained.styleEvents ?? [])
                .filter(
                  (e) =>
                    e.kind === 'level_up' || e.kind === 'unlocked' || e.kind === 'swapped',
                )
                .slice(0, 6)
                .map((e) => e.noteTh)
                .join(' · '),
              read: false,
            } as InboxMessage,
          ]
        : []) as InboxMessage[]),
      ...next.inbox,
    ].slice(0, 40),
  }
  // ทีม AI ฝึกสไตล์เบาๆ (human ซ้อมไปแล้วใน applyTrainingWeek)
  {
    const aiTick = tickStyleTrainingForSave(next, { humanAlreadyTrained: true })
    next = aiTick.save
  }
  next = tickStyleSlotMood(next)
  {
    const fameTick = tickPlayerFameAndBrands(next)
    next = fameTick.save
    if (fameTick.notes.length) {
      next = {
        ...next,
        inbox: [
          {
            id: `msg-brand-${Date.now()}`,
            date: prepared.date,
            title: 'แบรนด์ / ความดัง',
            body: fameTick.notes.slice(0, 5).join(' · '),
            read: false,
          },
          ...next.inbox,
        ].slice(0, 40),
      }
    }
  }
  next = { ...next, players: updatePlayingTimeMorale(next) }
  next = tickContractedPlayingTime(next)
  next = { ...next, dynamics: recomputeDynamics(next) }
  next = applyDevelopmentForSave(next)
  next = maybePromoteYouth(next)
  next = resolveFormWatches(
    next,
    prepared.results.map((r) => ({
      fixtureId: r.fixture.id,
      homeGoals: r.result.homeGoals,
      awayGoals: r.result.awayGoals,
    })),
  )
  next = { ...next, scouting: weeklyScoutPassive(next, next.staff) }
  next = runScoutFocusPass(next)

  // แขกเข้าสนามบ้าน (คนที่มีแข่งวันนั้นมาไม่ได้)
  const humanHome = prepared.results.find(
    (r) => r.fixture.homeClubId === save.humanClubId,
  )
  if (humanHome) {
    next = generateStadiumVisits(next, humanHome.fixture.id)
  }

  next = refreshStaffMarket(next)
  next = tickStaffResponsibilities(next)
  next = maybePlayersBecomeStaff(next)
  next = simulateDailyLife(next, 7)
  next = simulatePlayerSpending(next, 7)

  // Illness rolls for ALL clubs (human + AI) — lifestyle + contagion + winter
  const riskyByPlayer: Record<string, number> = {}
  for (const log of next.dailyLogs ?? []) {
    if (log.date !== next.currentDate) continue
    const risk = ILLNESS_RISK_ACTIVITIES[log.activityId]
    if (risk) riskyByPlayer[log.playerId] = (riskyByPlayer[log.playerId] ?? 0) + risk
  }
  const illRoll = rollSquadIllnesses(next.players, {
    matchday: next.matchday,
    season: next.season,
    riskyByPlayer,
  })
  next = { ...next, players: illRoll.players }
  const humanIll = illRoll.newlyIll.filter((x) => x.clubId === next.humanClubId)
  if (humanIll.length > 0) {
    next = {
      ...next,
      inbox: [
        {
          id: `msg-ill-${Date.now()}`,
          date: next.currentDate,
          title: 'รายงานป่วย',
          body: humanIll.map((x) => `${x.name} · ${x.type} ${x.days} วัน`).join(' · '),
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    }
    for (const x of humanIll.slice(0, 2)) {
      next = pushNews(next, newsAfterIllness(next, x.name, x.type, x.days))
    }
  }

  next = resolveTalkPromises(next)
  next = generatePlayerTalkRequests(next)
  next = processAiPlayerTalks(next)
  next = pushLifeDigestInbox(next)
  next = tickWantAwayDrama(next)
  {
    const humanId = next.humanClubId
    const humanFix = prepared.results.find(
      ({ fixture }) =>
        fixture.homeClubId === humanId || fixture.awayClubId === humanId,
    )
    if (humanFix) {
      const playedIds = new Set(next.tacticsByClub[humanId]?.startingXi ?? [])
      const won = humanMatchHint?.won === true
      const drawn = humanFix.result.homeGoals === humanFix.result.awayGoals
      const benchedKeyIds = new Set(
        next.players
          .filter(
            (p) =>
              p.clubId === humanId &&
              p.squadRole === 'key' &&
              !playedIds.has(p.id) &&
              p.injuryDays <= 0,
          )
          .map((p) => p.id),
      )
      next = tickClubLoyalty(next, {
        won,
        drawn: !won && drawn,
        playedIds,
        benchedKeyIds,
      })
    } else {
      next = tickClubLoyalty(next, null)
    }
  }
  next = tickContractLifecycle(next)
  next = tickAgentApproaches(next)
  next = applyMatchdayIncome(next)
  next = applyFfpBreachSanction(next)
  next = processLoansMatchday(next)
  {
    const xiPlayers = prepared.results.flatMap((r) => {
      const f = next.fixtures.find((x) => x.id === r.result.fixtureId)
      if (!f) return [] as string[]
      const homeXi = next.tacticsByClub[f.homeClubId]?.startingXi ?? []
      const awayXi = next.tacticsByClub[f.awayClubId]?.startingXi ?? []
      return [...homeXi, ...awayXi]
    })
    next = tickLoanAppearances(next, xiPlayers)
  }
  next = processTransferDeskMatchday(
    next,
    prepared.results.map((r) => r.result),
  )
  if (next.seasonComplete && !save.seasonComplete) {
    next = tickEndOfSeasonClauses(next)
    next = { ...next, euroAccess: snapshotEuroRanks(next) }
  }
  next = processFanPolitics(next)
  next = rollClubWorldEvents(next)
  next = processBoardPolitics(next)
  next = tickClubQuests(next, humanMatchHint)
  if (next.board?.sacked) {
    next = enterUnemployment(next)
  }
  next = scanTakeoverMarket(next)
  if (next.career?.unemployed || next.board?.sacked) {
    next = refreshJobMarket(next)
  }
  next = processFacilities(next)
  next = tickSocialAfterMatchday(next)
  next = processMatchSocialDrama(
    next,
    prepared.results.map((r) => r.result),
  )
  next = tickWorldPulse(next)
  next = tickWorldWatch(next)
  {
    const winter = winterWindowRange(next.leagueId || 'eng')
    if (next.matchday === winter.start && transferWindowKind(next) === 'winter') {
      next = {
        ...next,
        inbox: [
          {
            id: `msg-winter-${Date.now()}`,
            date: next.currentDate,
            title: 'ตลาดวินเทอร์เปิด',
            body: `หน้าต่างตลาดฤดูหนาว MD${winter.start}–${winter.end} — ซื้อ/ขาย/ยืมได้ในช่วงนี้`,
            read: false,
          },
          ...next.inbox,
        ].slice(0, 40),
      }
    }
  }
  next = { ...next, media: ensureMediaFeed(next) }
  for (const n of newsBatch) next = pushNews(next, n)
  next = processMatchdayAwards(next, {
    matchday: prepared.matchday,
    date: prepared.date,
    results: prepared.results,
    tacticsByClub: prepared.tacticsByClub,
  })
  if (next.seasonComplete) {
    next = finalizeSeasonAwards(next, prepared.date)
  }
  next = advanceMediaWeek(next)
  next = maybeAiRomanoPlants(next)
  next = maybeQueueInternationalBreak(next)
  next = maybeQueueCalendarGap(next)

  return next
}

export function simulateMatchday(save: GameSave, matchday: number) {
  save = ensureSquadRegistration(save)
  const prepared = prepareMatchday(save, matchday)
  if (!prepared) {
    return { save, humanResult: null, resultsCount: 0 }
  }
  return {
    save: applyPreparedMatchday(save, prepared),
    humanResult: prepared.humanResult,
    resultsCount: prepared.results.length,
  }
}

/** @deprecated use payWeeklyWagesWithCash — หักคลับอย่างเดียว (ไม่มี cash) */
export function payWeeklyWages(clubs: Club[], players: Player[]): Club[] {
  return payWeeklyWagesWithCash(clubs, players).clubs
}

export function applyWeeklyWages(save: GameSave): GameSave {
  const paid = payWeeklyWagesWithCash(save.clubs, save.players, save.loans)
  const humanWage = paid.wageTotalByClub[save.humanClubId] ?? 0
  const finance = ensureClubFinance(save)
  let next: GameSave = {
    ...save,
    clubs: paid.clubs,
    players: paid.players,
    clubFinance: {
      ...finance,
      wageSeason: finance.wageSeason + humanWage,
      ledger: [
        {
          id: `fin-wage-${Date.now()}`,
          date: save.currentDate,
          kind: 'wages' as const,
          amount: -humanWage,
          note: `ค่าเหนื่อยสควอดรายสัปดาห์`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    },
  }
  next = tickInsolvency(next)
  next = processFireSaleAiBids(next)
  return next
}

/** AI กดซื้อถูกตอน fire sale */
function processFireSaleAiBids(save: GameSave): GameSave {
  const inv = ensureInsolvency(save)
  if (inv.stage !== 'administration' || !inv.fireSalePlayerIds.length) return save
  if (transferWindowKind(save) === 'closed') return save

  let next = save
  for (const id of inv.fireSalePlayerIds.slice(0, 2)) {
    const p = next.players.find((x) => x.id === id && x.clubId === next.humanClubId)
    if (!p) continue
    if (Math.random() > 0.35) continue
    const ask = Math.round(estimatedValue(p, next) * 0.72)
    const sold = sellPlayerToAi(next, id, ask, undefined, { allowToRival: false, fireSale: true })
    if (sold.ok && sold.save) {
      next = sold.save
      const left = ensureInsolvency(next).fireSalePlayerIds.filter((x) => x !== id)
      next = {
        ...next,
        insolvency: {
          ...ensureInsolvency(next),
          fireSalePlayerIds: left,
          lastNote: `Fire sale: ขาย ${p.name} · ${formatMoney(ask)}`,
        },
      }
    }
  }
  return next
}

export function recoverSquad(players: Player[], physioLevel = 8): Player[] {
  return players.map((p) => {
    let healed = tickPlayerInjury(p, physioLevel)
    healed = tickIllness(healed, physioLevel)
    const leave = healed.leaveDays ?? 0
    if (leave <= 0) return healed
    return { ...healed, leaveDays: Math.max(0, leave - 1) }
  })
}

export function sortedTable(table: TableRow[]) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

export function nextUnplayedMatchday(save: GameSave): number | null {
  const upcoming = save.fixtures.filter((f) => !f.played)
  if (upcoming.length === 0) return null
  return Math.min(...upcoming.map((f) => f.matchday))
}
