import { create } from 'zustand'
import type {
  FormationId,
  GameSave,
  IndividualFocus,
  InjuryTreatment,
  SetPiecePlan,
  SquadRole,
  Tactics,
  TeamInstructions,
  TrainingState,
} from '@/game/types'
import { createNewGame, loadFromStorage, saveToStorage, clearStorage, ensurePhase5 } from '@/game/save'
import type { LeagueId } from '@/data/world'
import {
  applyPreparedMatchday,
  nextUnplayedMatchday,
  applyWeeklyWages,
  prepareMatchday,
  continueAfterHalfTime,
  queueHumanSubLive,
  removeHumanSubLive,
  applyLiveMatchAdjustments,
  recoverSquad,
  simulateMatchday,
  type PreparedMatchday,
} from '@/game/simulate'
import type { HalfTimeAdjustments } from '@/game/match/halfTime'
import { MATCH_BENCH_SIZE } from '@/game/match/matchdaySquad'
import { autoPickTactics } from '@/game/seed'
import { FORMATION_SLOTS } from '@/game/types'
import { buyPlayerFromAi, sellPlayerToAi, renewContract, triggerReleaseClause as triggerReleaseClauseFn } from '@/game/transfer'
import {
  beginTransferDeadline,
  advanceTransferDeadlineHour,
  isTransferDeadlineActive,
  shouldEnterTransferDeadline,
} from '@/game/transferDeadline'
import {
  submitNegotiatedBuy,
  acceptCounterOffer,
  proposePlayerExchange,
  startAuction,
} from '@/game/transferDesk'
import { acceptWantAwayBid, rejectWantAwayBid } from '@/game/wantAway'
import { arrangeLoan, recallLoan, exerciseLoanOption } from '@/game/loans'
import {
  setTransferListed,
  mutualTerminateContract,
  signPreContract,
  triggerBuyBack,
  canApproachBosman,
} from '@/game/transferAdvanced'
import {
  acceptRofrMatchOffer,
  declineRofrMatchOffer,
} from '@/game/transferExtras'
import { toggleShortlist } from '@/game/shortlist'
import type { OppositionInstructions, TeamTalkKind } from '@/game/types'
import { applyTrainingWeek, recoverInjuriesOneDay } from '@/game/training'
import { trainingFacilityBonus } from '@/game/facilities'
import { setPlayerTreatment } from '@/game/medical'
import { upgradeStaff, staffUpgradeCost, staffLevel, hireStaff, convertPlayerToStaff, promoteStaffToCoach } from '@/game/staff'
import { hireWorldCoach as hireWorldCoachFn } from '@/game/worldCoaches'
import { boostAffiliateRelations as boostAffiliateRelationsFn } from '@/game/affiliates'
import { graduateYouthPlayer as graduateYouthPlayerFn } from '@/game/youth'
import {
  confirmLineup as confirmLineupFn,
  chooseTeamTalk as chooseTeamTalkFn,
  preMatchChecklist,
  queueTouchlineShout as queueTouchlineShoutFn,
} from '@/game/preMatch'
import type { TouchlineShout } from '@/game/match/touchlineShouts'
import { scoutPlayer, assignFormWatch } from '@/game/scouting'
import { recomputeDynamics } from '@/game/dynamics'
import { assignMentor } from '@/game/development'
import { plantRomanoStory } from '@/game/romanoPlant'
import type { PlantOpts, RomanoPlantKind } from '@/game/romanoPlant'
import { requestClubBudget } from '@/game/owner'
import {
  inviteOwnerToStadium,
  requestBoardPublicSupport,
  callBoardEmergencyMeeting,
  outreachFanFaction,
  resolveOwnerDemand,
  type FanFactionKey,
} from '@/game/clubAtmosphere'
import {
  setTakeoverAdvice,
  attemptTakeoverDeal,
  rejectTakeoverOffer,
} from '@/game/takeover'
import { requestOwnerBailout as requestOwnerBailoutFn } from '@/game/insolvency'
import { startNextSeason } from '@/game/season'
import { acceptJobOffer, rejectJobOffer, resignFromClub } from '@/game/jobs'
import {
  proposeFacilityUpgrade as proposeFacilityUpgradeFn,
  resolveFacilityProposal as resolveFacilityProposalFn,
  medicalFacilityBonus,
} from '@/game/facilities'
import type { FacilityKind } from '@/game/types'
import { takeHoliday } from '@/game/holiday'
import { managerTalk, respondToPlayerRequest } from '@/game/playerTalks'
import type { ManagerTalkTopic, TalkResponse } from '@/game/types'
import {
  answerPressConference as resolvePressConference,
  dismissPressConference as skipPressConference,
} from '@/game/pressConference'
import {
  answerPlayerInterview as resolvePlayerInterview,
  dismissPlayerInterview as skipPlayerInterview,
} from '@/game/playerInterview'
import {
  advanceInternationalBreak,
  hasPendingInternationalBreak,
} from '@/game/internationalBreaks'
import { applyMatchdayChronicle } from '@/game/matchdayReport'
import { advanceCalendarDay } from '@/game/calendarDay'
import {
  confirmNtCamp as confirmNtCampFn,
  ensureNtCamp,
  setNtCampFocus as setNtCampFocusFn,
  toggleNtCampPlayer as toggleNtCampPlayerFn,
  type NtCampFocus,
} from '@/game/ntCamp'
import {
  acceptPreSeasonOffer as acceptPreSeasonOfferFn,
  skipPreSeason as skipPreSeasonFn,
  playNextPreSeasonMatch as playNextPreSeasonMatchFn,
  isPreSeasonBlocking,
  ensurePreSeason,
} from '@/game/preSeason'

interface GameStore {
  save: GameSave | null
  status: string | null
  liveMatch: PreparedMatchday | null
  newGame: (managerName: string, humanClubId: string, leagueId?: LeagueId, build?: import('@/game/managerProfile').ManagerBuildInput) => void
  continueGame: () => boolean
  persist: () => void
  resetSave: () => void
  setFormation: (formation: FormationId, which?: 'ip' | 'oop') => void
  setInstructions: (patch: Partial<TeamInstructions>) => void
  setSetPieces: (corners?: SetPiecePlan, freeKicks?: SetPiecePlan) => void
  setOpposition: (patch: Partial<OppositionInstructions>) => void
  setStartingXi: (playerIds: string[]) => void
  setSquadRole: (playerId: string, role: SquadRole) => void
  setTraining: (patch: Partial<TrainingState>) => void
  runTrainingNow: () => void
  setInjuryTreatment: (playerId: string, treatment: InjuryTreatment) => void
  autoPickHumanXi: () => void
  playNextMatchday: (opts?: { force?: boolean }) => void
  startLiveMatch: (opts?: { force?: boolean }) => boolean
  continueHalfTime: (adj?: HalfTimeAdjustments) => boolean
  /** ขอเปลี่ยนตัวระหว่างแมตช์ — ลงสนามเมื่อบอลออก */
  queueLiveSub: (outId: string, inId: string, atMinute: number) => boolean
  removeLiveSub: (outId: string) => void
  /** แก้แผน / ตะโกนกลางเกม — ไม่หยุดเกม */
  applyLiveAdjustments: (adj: HalfTimeAdjustments, atMinute: number) => boolean
  confirmPreMatchLineup: () => boolean
  choosePreMatchTalk: (kind: TeamTalkKind) => boolean
  queueTouchlineShout: (shout: TouchlineShout) => boolean
  finishLiveMatch: () => void
  abortLiveMatch: () => void
  advanceDay: () => void
  markInboxRead: (id: string) => void
  clearStatus: () => void
  offerBuyPlayer: (
    playerId: string,
    fee: number,
    wage: number,
    contractYears?: number,
    opts?: {
      loanBackUntilNextSeason?: boolean
      paymentPreset?: import('@/game/types').FeePaymentPreset
      acceptCautionMedical?: boolean
    },
  ) => boolean
  offerBuyNegotiated: (
    playerId: string,
    fee: number,
    wage: number,
    years?: number,
    appearanceAddon?: number,
    sellOnPercent?: number,
    addons?: import('@/game/types').TransferAddonPackage,
    opts?: {
      loanBackUntilNextSeason?: boolean
      paymentPreset?: import('@/game/types').FeePaymentPreset
      acceptCautionMedical?: boolean
    },
  ) => boolean
  acceptTransferCounter: (offerId: string) => boolean
  acceptWantAwayOffer: (offerId: string) => boolean
  rejectWantAwayOffer: (offerId: string) => boolean
  offerExchange: (
    theirId: string,
    ourId: string,
    cash: number,
    opts?: {
      loanBackUntilNextSeason?: boolean
      paymentPreset?: import('@/game/types').FeePaymentPreset
    },
  ) => boolean
  startPlayerAuction: (playerId: string, minBid?: number) => boolean
  offerSellPlayer: (playerId: string, fee: number, opts?: { allowToRival?: boolean }) => boolean
  acceptRofrOffer: (offerId: string) => boolean
  declineRofrOffer: (offerId: string) => boolean
  renewPlayerContract: (playerId: string, wage: number, years: number) => boolean
  triggerReleaseClause: (playerId: string, wage?: number, years?: number) => boolean
  setLifestyleOrder: (playerId: string, order: import('@/game/types').LifestyleOrder) => void
  loanInPlayer: (playerId: string) => boolean
  loanOutPlayer: (
    playerId: string,
    toClubId: string,
    opts?: {
      wageShareParent?: number
      obligationMode?: 'always' | 'avoid_relegation' | 'appearances' | null
      obligationToBuy?: number | null
      obligationAppearances?: number
      recallWinterOnly?: boolean
    },
  ) => boolean
  recallLoanDeal: (dealId: string) => boolean
  buyLoanOption: (dealId: string) => boolean
  setPlayerTransferListed: (playerId: string, listed: boolean, minFee?: number) => boolean
  mutualTerminatePlayer: (playerId: string) => boolean
  signBosmanPreContract: (playerId: string, wage: number, years?: number) => boolean
  triggerPlayerBuyBack: (playerId: string) => boolean
  togglePlayerShortlist: (playerId: string) => void
  upgradeStaffRole: (role: 'coach' | 'scout' | 'physio') => void
  hireStaffMember: (staffId: string, asRole?: 'coach' | 'scout' | 'physio') => boolean
  promoteToCoach: (staffId: string) => boolean
  hireWorldCoach: (coachId: string) => boolean
  retirePlayerToStaff: (playerId: string, role?: 'coach' | 'scout' | 'physio') => boolean
  upgradeYouthAcademy: () => void
  boostAffiliateRelations: () => boolean
  graduateYouthPlayer: (playerId: string) => boolean
  runScout: (playerId: string) => void
  assignScoutWatch: (fixtureId: string, targetPlayerIds?: string[]) => boolean
  setIndividualFocus: (playerId: string, focus: IndividualFocus) => void
  setMentor: (menteeId: string, mentorId: string | null) => void
  plantRomano: (kind: RomanoPlantKind, opts?: PlantOpts) => boolean
  startManagerTalk: (topic: ManagerTalkTopic, playerId?: string) => boolean
  answerPlayerRequest: (requestId: string, response: TalkResponse) => boolean
  requestBoardBudget: (amount: number) => boolean
  inviteOwnerStadium: () => boolean
  requestPublicSupport: () => boolean
  callBoardMeeting: () => boolean
  outreachFans: (faction: 'ultras' | 'soft' | 'casual' | 'corporate' | 'international') => boolean
  answerOwnerDemand: (accept: boolean) => boolean
  adviseTakeover: (offerId: string, advice: 'recommend' | 'caution' | 'reject') => boolean
  attemptTakeover: (offerId: string) => boolean
  rejectTakeover: (offerId: string) => boolean
  requestOwnerBailout: () => boolean
  startNewSeason: () => boolean
  acceptJob: (offerId: string) => boolean
  rejectJob: (offerId: string) => boolean
  resignClub: () => boolean
  proposeFacilityUpgrade: (kind: FacilityKind) => boolean
  resolveFacilityProposal: (approve: boolean) => boolean
  /** @deprecated ใช้ proposeFacilityUpgrade */
  upgradeFacility: (kind: FacilityKind) => boolean
  takeManagerHoliday: (matchdays: number) => boolean
  answerPressConference: (answerIds: string[]) => void
  dismissPressConference: () => void
  answerPlayerInterview: (answerIds: string[]) => void
  dismissPlayerInterview: () => void
  dismissMatchdayReport: () => void
  setNtCampFocus: (focus: NtCampFocus) => void
  toggleNtCampPlayer: (playerId: string) => void
  confirmNtCamp: () => void
  acceptPreSeasonOffer: (offerId: string) => boolean
  skipPreSeason: () => boolean
  playNextPreSeasonMatch: () => boolean
}

function finalizeApplied(
  save: GameSave,
  prev: GameSave,
  matchday: number,
  resultsCount: number,
) {
  const physio = staffLevel(save.staff, 'physio') + medicalFacilityBonus(save)
  let withRecovery: GameSave = {
    ...save,
    players: recoverSquad(save.players, physio),
  }
  withRecovery = applyWeeklyWages(withRecovery)
  withRecovery = { ...withRecovery, dynamics: recomputeDynamics(withRecovery) }
  withRecovery = applyMatchdayChronicle(withRecovery, prev, resultsCount)
  saveToStorage(withRecovery)
  return {
    save: withRecovery,
    status: `แมตช์เดย์ ${matchday}: จบนัดครบ ${resultsCount} นัด (คุณ + AI)`,
    liveMatch: null as PreparedMatchday | null,
  }
}

function patchHumanTactics(save: GameSave, patch: Partial<Tactics>): GameSave {
  const humanId = save.humanClubId
  const current = save.tacticsByClub[humanId]
  return {
    ...save,
    tacticsByClub: {
      ...save.tacticsByClub,
      [humanId]: { ...current, ...patch },
    },
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  save: null,
  status: null,
  liveMatch: null,

  newGame: (managerName, humanClubId, leagueId = 'eng', build) => {
    const save = createNewGame(managerName, humanClubId, leagueId, build)
    saveToStorage(save)
    set({
      save,
      status: `เริ่มอาชีพใน ${save.leagueName} — ${save.clubs.find((c) => c.id === humanClubId)?.name}`,
      liveMatch: null,
    })
  },

  continueGame: () => {
    const save = loadFromStorage()
    if (!save) return false
    set({ save: ensurePhase5(save), status: null, liveMatch: null })
    return true
  },

  persist: () => {
    const { save } = get()
    if (save) saveToStorage(save)
  },

  resetSave: () => {
    clearStorage()
    set({ save: null, status: 'ลบเซฟแล้ว', liveMatch: null })
  },

  setFormation: (formation, which = 'ip') => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const current = save.tacticsByClub[humanId]
    if (which === 'oop') {
      const next = patchHumanTactics(save, {
        formationOop: formation,
        familiarity: Math.max(35, current.familiarity - 8),
      })
      saveToStorage(next)
      set({ save: next })
      return
    }
    const picked = autoPickTactics(humanId, save.players, formation, current.formationOop)
    const next = {
      ...save,
      tacticsByClub: {
        ...save.tacticsByClub,
        [humanId]: {
          ...picked,
          instructions: current.instructions,
          setPieces: current.setPieces,
          familiarity: Math.max(35, current.familiarity - 12),
          formationOop: current.formationOop,
        },
      },
    }
    saveToStorage(next)
    set({ save: next })
  },

  setInstructions: (patch) => {
    const { save } = get()
    if (!save) return
    const current = save.tacticsByClub[save.humanClubId]
    const next = patchHumanTactics(save, {
      instructions: { ...current.instructions, ...patch },
      familiarity: Math.max(30, current.familiarity - 4),
    })
    saveToStorage(next)
    set({ save: next })
  },

  setSetPieces: (corners, freeKicks) => {
    const { save } = get()
    if (!save) return
    const current = save.tacticsByClub[save.humanClubId]
    const next = patchHumanTactics(save, {
      setPieces: {
        corners: corners ?? current.setPieces.corners,
        freeKicks: freeKicks ?? current.setPieces.freeKicks,
      },
    })
    saveToStorage(next)
    set({ save: next })
  },

  setOpposition: (patch) => {
    const { save } = get()
    if (!save) return
    const current = save.tacticsByClub[save.humanClubId]
    const next = patchHumanTactics(save, {
      opposition: {
        pressPlayerId: null,
        markPlayerId: null,
        showOnto: 'none',
        ...current.opposition,
        ...patch,
      },
    })
    saveToStorage(next)
    set({ save: next })
  },

  setStartingXi: (playerIds) => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const current = save.tacticsByClub[humanId]
    const slots = FORMATION_SLOTS[current.formation].length
    const startingXi = playerIds.slice(0, slots)
    const rest = save.players
      .filter((p) => p.clubId === humanId && !startingXi.includes(p.id) && p.injuryDays <= 0)
      .sort((a, b) => b.overall - a.overall)
      .map((p) => p.id)
      .slice(0, MATCH_BENCH_SIZE)
    const tactics: Tactics = {
      ...current,
      startingXi,
      bench: rest,
      familiarity: Math.max(30, current.familiarity - 2),
    }
    const next = {
      ...save,
      tacticsByClub: { ...save.tacticsByClub, [humanId]: tactics },
      dynamics: recomputeDynamics({
        ...save,
        tacticsByClub: { ...save.tacticsByClub, [humanId]: tactics },
      }),
    }
    saveToStorage(next)
    set({ save: next })
  },

  setSquadRole: (playerId, role) => {
    const { save } = get()
    if (!save) return
    const nextPlayers = save.players.map((p) => (p.id === playerId ? { ...p, squadRole: role } : p))
    const next = {
      ...save,
      players: nextPlayers,
      dynamics: recomputeDynamics({ ...save, players: nextPlayers }),
    }
    saveToStorage(next)
    set({ save: next })
  },

  setTraining: (patch) => {
    const { save } = get()
    if (!save) return
    const next = {
      ...save,
      training: { ...save.training, individual: save.training.individual ?? {}, ...patch },
    }
    saveToStorage(next)
    set({ save: next })
  },

  setIndividualFocus: (playerId, focus) => {
    const { save } = get()
    if (!save) return
    const next = {
      ...save,
      training: {
        ...save.training,
        individual: { ...(save.training.individual ?? {}), [playerId]: focus },
      },
    }
    saveToStorage(next)
    set({ save: next })
  },

  setMentor: (menteeId, mentorId) => {
    const { save } = get()
    if (!save) return
    const result = assignMentor(save, menteeId, mentorId)
    set({ status: result.message })
    saveToStorage(result.save)
    set({ save: result.save })
  },

  runTrainingNow: () => {
    const { save } = get()
    if (!save) return
    const previouslyInjured = new Set(
      save.players
        .filter((p) => p.clubId === save.humanClubId && p.injuryDays > 0)
        .map((p) => p.id),
    )
    const { players, note } = applyTrainingWeek(
      save.players,
      save.humanClubId,
      save.training,
      trainingFacilityBonus(save),
      save.matchday,
    )
    const physio = staffLevel(save.staff, 'physio')
    const nextPlayers = players.map((p) => {
      if (!previouslyInjured.has(p.id)) return p
      return recoverInjuriesOneDay([p], physio)[0]
    })
    const next = {
      ...save,
      players: nextPlayers,
      inbox: [
        {
          id: `msg-train-${Date.now()}`,
          date: save.currentDate,
          title: 'ซ้อมพิเศษ',
          body: note,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    }
    saveToStorage(next)
    set({ save: next, status: note })
  },

  setInjuryTreatment: (playerId, treatment) => {
    const { save } = get()
    if (!save) return
    const nextPlayers = save.players.map((p) =>
      p.id === playerId ? setPlayerTreatment(p, treatment) : p,
    )
    const next = { ...save, players: nextPlayers }
    saveToStorage(next)
    set({ save: next })
  },

  autoPickHumanXi: () => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const current = save.tacticsByClub[humanId]
    const picked = autoPickTactics(humanId, save.players, current.formation, current.formationOop)
    const next = {
      ...save,
      tacticsByClub: {
        ...save.tacticsByClub,
        [humanId]: {
          ...picked,
          instructions: current.instructions,
          setPieces: current.setPieces,
          familiarity: current.familiarity,
        },
      },
    }
    saveToStorage(next)
    set({ save: next, status: 'เลือก XI ที่ดีที่สุดให้อัตโนมัติแล้ว' })
  },

  playNextMatchday: (opts) => {
    const { save } = get()
    if (!save || save.seasonComplete) return
    if (save.board?.sacked) {
      set({ status: 'คุณถูกปลดแล้ว — เริ่มเกมใหม่ที่หน้าแรก' })
      return
    }

    // โหมดปิดตลาด — กดถัดไป = +1 ชั่วโมง
    if (isTransferDeadlineActive(save)) {
      const tick = advanceTransferDeadlineHour(save)
      if (!tick.ok) {
        set({ status: tick.message })
        return
      }
      saveToStorage(tick.save)
      set({ save: tick.save, status: tick.message, liveMatch: null })
      return
    }

    // เข้า 3 วันสุดท้าย → เริ่มนับ 72 ชม.
    if (shouldEnterTransferDeadline(save)) {
      const started = beginTransferDeadline(save)
      saveToStorage(started)
      set({
        save: started,
        status: 'เข้าโหมดปิดตลาด 72 ชั่วโมง — กดถัดไปเพื่อเดินหน้าทีละชั่วโมง',
        liveMatch: null,
      })
      return
    }

    if (hasPendingInternationalBreak(save)) {
      let s = ensureNtCamp(save)
      if (s.career?.nationalNation && s.ntCamp && !s.ntCamp.confirmed) {
        saveToStorage(s)
        set({
          save: s,
          status: 'ยืนยันโผแคมป์ทีมชาติที่พอร์ทัลก่อนเดินหน้าพัก',
        })
        return
      }
      const result = advanceInternationalBreak(s)
      if (!result.ok) {
        set({ status: result.message })
        return
      }
      saveToStorage(result.save)
      set({ save: result.save, status: result.message, liveMatch: null })
      return
    }

    {
      const withPs = ensurePreSeason(save)
      if (isPreSeasonBlocking(withPs)) {
        if (withPs !== save) saveToStorage(withPs)
        set({
          save: withPs,
          status: 'ช่วงปรีซีซั่น — ไปหน้าปรีซีซั่นเลือกทัวร์หรือเล่นนัดอุ่นก่อนเปิดศึก',
          liveMatch: null,
        })
        return
      }
    }

    const check = preMatchChecklist(save)
    if (check.prep && !check.ready && !opts?.force) {
      set({
        status: 'เตรียมนัดยังไม่ครบ — ไปหน้าแมตช์ยืนยัน XI + ทีมทอล์ค หรือกดเตะแบบรีบ',
      })
      return
    }
    const md = nextUnplayedMatchday(save)
    if (md == null) {
      set({ status: 'จบฤดูกาลแล้ว' })
      return
    }
    const { save: next, resultsCount } = simulateMatchday(save, md)
    set(finalizeApplied(next, save, md, resultsCount))
  },

  confirmPreMatchLineup: () => {
    const { save } = get()
    if (!save) return false
    const result = confirmLineupFn(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  choosePreMatchTalk: (kind) => {
    const { save } = get()
    if (!save) return false
    const result = chooseTeamTalkFn(save, kind)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  queueTouchlineShout: (shout) => {
    const { save } = get()
    if (!save) return false
    const result = queueTouchlineShoutFn(save, shout)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  startLiveMatch: (opts) => {
    const { save } = get()
    if (!save || save.seasonComplete) return false
    if (isTransferDeadlineActive(save)) {
      set({ status: 'ช่วงปิดตลาดนับชั่วโมง — กดถัดไปทีละชม. ที่หน้าแมตช์ / ตลาด ก่อนเตะนัดใหม่' })
      return false
    }
    if (save.board?.sacked) {
      set({ status: 'คุณถูกปลดแล้ว — เริ่มเกมใหม่ที่หน้าแรก' })
      return false
    }
    if (hasPendingInternationalBreak(save)) {
      let s = ensureNtCamp(save)
      if (s.career?.nationalNation && s.ntCamp && !s.ntCamp.confirmed) {
        saveToStorage(s)
        set({
          save: s,
          status: 'ยืนยันโผแคมป์ทีมชาติที่พอร์ทัลก่อนเดินหน้าพัก',
        })
        return false
      }
      const result = advanceInternationalBreak(s)
      if (result.ok) {
        saveToStorage(result.save)
        set({ save: result.save, status: result.message, liveMatch: null })
      }
      return false
    }
    {
      const withPs = ensurePreSeason(save)
      if (isPreSeasonBlocking(withPs)) {
        if (withPs !== save) saveToStorage(withPs)
        set({
          save: withPs,
          status: 'ช่วงปรีซีซั่น — ไปหน้าปรีซีซั่นก่อนเปิดศึก',
          liveMatch: null,
        })
        return false
      }
    }
    const check = preMatchChecklist(save)
    if (check.prep && !check.ready && !opts?.force) {
      set({
        status: 'ยังเตรียมนัดไม่ครบ — ยืนยัน XI + เลือกทีมทอล์ค หรือเตะแบบรีบ',
      })
      return false
    }
    const md = nextUnplayedMatchday(save)
    if (md == null) {
      set({ status: 'จบฤดูกาลแล้ว' })
      return false
    }
    const prepared = prepareMatchday(save, md, { pauseAtHalfTime: true })
    if (!prepared) return false

    if (!prepared.humanFixture || !prepared.humanResult) {
      const applied = applyPreparedMatchday(save, prepared)
      set(finalizeApplied(applied, save, md, prepared.results.length))
      set({ status: `แมตช์เดย์ ${md}: ทีมคุณไม่มีนัด — จำลองนัด AI ให้แล้ว` })
      return false
    }

    set({ liveMatch: prepared, status: null })
    return true
  },

  continueHalfTime: (adj = {}) => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch?.halfTime || liveMatch.halfTime.resolved) return false
    const next = continueAfterHalfTime(save, liveMatch, adj)
    set({ liveMatch: next, status: 'ครึ่งหลังเริ่มแล้ว — แก้เกมได้ตลอดโดยเกมไม่หยุด' })
    return true
  },

  queueLiveSub: (outId, inId, atMinute) => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch) return false
    const next = queueHumanSubLive(save, liveMatch, { outId, inId }, atMinute)
    if (next === liveMatch) return false
    set({
      liveMatch: next,
      status: 'ขอเปลี่ยนตัวแล้ว — รอจนบอลออกนอกสนาม',
    })
    return true
  },

  removeLiveSub: (outId) => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch) return
    set({ liveMatch: removeHumanSubLive(save, liveMatch, outId) })
  },

  applyLiveAdjustments: (adj, atMinute) => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch) return false
    const next = applyLiveMatchAdjustments(save, liveMatch, adj, atMinute)
    if (next === liveMatch) return false
    const parts: string[] = []
    if (adj.formation || adj.mentality || adj.pressing || adj.formationOop) parts.push('เปลี่ยนแผน')
    if (adj.shouts?.length) parts.push('ตะโกนริมเส้น')
    if (adj.opposition) parts.push('มาร์กคู่แข่ง')
    set({
      liveMatch: next,
      status: parts.length
        ? `${parts.join(' · ')} — มีผลทันที${liveMatch.halfTime?.resolved ? ' (ซิมครึ่งหลังใหม่)' : ' (ใช้ตอนพักครึ่ง)'}`
        : 'อัปเดตคำสั่งกลางเกมแล้ว',
    })
    return true
  },

  finishLiveMatch: () => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch) return
    const applied = applyPreparedMatchday(save, liveMatch)
    set(finalizeApplied(applied, save, liveMatch.matchday, liveMatch.results.length))
  },

  abortLiveMatch: () => {
    set({ liveMatch: null, status: 'ยกเลิกแมตช์ — ยังไม่บันทึกแมตช์เดย์' })
  },

  advanceDay: () => {
    const { save } = get()
    if (!save) return
    if (save.seasonComplete) {
      set({ status: 'จบฤดูกาลแล้ว — กด「เริ่มฤดูกาลใหม่」ที่แถบบนหรือหน้าแมตช์' })
      return
    }
    if (save.transferDeadline?.active) {
      // โหมดปิดตลาดยังใช้ชั่วโมงผ่าน playNextMatchday
      get().playNextMatchday()
      return
    }
    const result = advanceCalendarDay(save)
    saveToStorage(result.save)
    set({ save: result.save, status: result.message })
  },

  markInboxRead: (id) => {
    const { save } = get()
    if (!save) return
    const next = {
      ...save,
      inbox: save.inbox.map((m) => (m.id === id ? { ...m, read: true } : m)),
    }
    saveToStorage(next)
    set({ save: next })
  },

  clearStatus: () => set({ status: null }),

  offerBuyPlayer: (playerId, fee, wage, contractYears = 3, opts) => {
    const { save } = get()
    if (!save) return false
    const result = buyPlayerFromAi(save, playerId, fee, wage, contractYears, opts)
    set({ status: result.message })
    if (result.save) {
      saveToStorage(result.save)
      set({ save: result.save })
    }
    return result.ok
  },

  offerBuyNegotiated: (
    playerId,
    fee,
    wage,
    years = 3,
    appearanceAddon = 0,
    sellOnPercent = 0,
    addons,
    opts,
  ) => {
    const { save } = get()
    if (!save) return false
    const result = submitNegotiatedBuy(
      save,
      playerId,
      fee,
      wage,
      years,
      appearanceAddon,
      sellOnPercent,
      addons,
      opts,
    )
    set({ status: result.message })
    if (result.save) {
      saveToStorage(result.save)
      set({ save: result.save })
    }
    return result.ok
  },

  acceptTransferCounter: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = acceptCounterOffer(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  acceptWantAwayOffer: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = acceptWantAwayBid(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  rejectWantAwayOffer: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = rejectWantAwayBid(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  offerExchange: (theirId, ourId, cash, opts) => {
    const { save } = get()
    if (!save) return false
    const result = proposePlayerExchange(save, theirId, ourId, cash, opts)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  startPlayerAuction: (playerId, minBid) => {
    const { save } = get()
    if (!save) return false
    const result = startAuction(save, playerId, minBid)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  offerSellPlayer: (playerId, fee, opts) => {
    const { save } = get()
    if (!save) return false
    const result = sellPlayerToAi(save, playerId, fee, undefined, opts)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  acceptRofrOffer: (offerId) => {
    const { save } = get()
    if (!save) return false
    const desk = save.transferDesk
    const offer = desk?.offers.find((o) => o.id === offerId && o.isRofrMatch)
    if (!offer) {
      set({ status: 'ไม่พบข้อเสนอ ROFR' })
      return false
    }
    const cleared = acceptRofrMatchOffer(save, offerId)
    if (!cleared.ok) {
      set({ status: cleared.message })
      return false
    }
    const bought = buyPlayerFromAi(
      cleared.save,
      offer.playerId,
      offer.fee,
      offer.wage,
      offer.contractYears,
      { acceptCautionMedical: true },
    )
    set({ status: bought.ok ? `ROFR สำเร็จ · ${bought.message}` : bought.message })
    if (bought.save) {
      saveToStorage(bought.save)
      set({ save: bought.save })
    } else if (cleared.save) {
      saveToStorage(cleared.save)
      set({ save: cleared.save })
    }
    return bought.ok
  },

  declineRofrOffer: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = declineRofrMatchOffer(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  renewPlayerContract: (playerId, wage, years) => {
    const { save } = get()
    if (!save) return false
    const result = renewContract(save, playerId, wage, years)
    set({ status: result.message })
    if (result.save) {
      saveToStorage(result.save)
      set({ save: result.save })
    }
    return result.ok
  },

  triggerReleaseClause: (playerId, wage, years = 3) => {
    const { save } = get()
    if (!save) return false
    const result = triggerReleaseClauseFn(save, playerId, wage, years)
    set({ status: result.message })
    if (result.save) {
      saveToStorage(result.save)
      set({ save: result.save })
    }
    return result.ok
  },

  setLifestyleOrder: (playerId, order) => {
    const { save } = get()
    if (!save) return
    const next = {
      ...save,
      players: save.players.map((p) =>
        p.id === playerId ? { ...p, lifestyleOrder: order === 'none' ? null : order } : p,
      ),
    }
    saveToStorage(next)
    set({ save: next, status: `ตั้งคำสั่งไลฟ์สไตล์: ${order}` })
  },

  loanInPlayer: (playerId) => {
    const { save } = get()
    if (!save) return false
    const result = arrangeLoan(save, playerId, save.humanClubId, {
      durationMatchdays: 12,
      recallable: true,
    })
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  loanOutPlayer: (playerId, toClubId, opts) => {
    const { save } = get()
    if (!save) return false
    const result = arrangeLoan(save, playerId, toClubId, {
      durationMatchdays: 12,
      recallable: true,
      recallWinterOnly: opts?.recallWinterOnly ?? true,
      wageShareParent: opts?.wageShareParent ?? 0.5,
      blockVsParent: true,
      obligationMode: opts?.obligationMode ?? null,
      obligationToBuy: opts?.obligationToBuy ?? null,
      obligationAppearances: opts?.obligationAppearances ?? 15,
    })
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  recallLoanDeal: (dealId) => {
    const { save } = get()
    if (!save) return false
    const result = recallLoan(save, dealId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  buyLoanOption: (dealId) => {
    const { save } = get()
    if (!save) return false
    const result = exerciseLoanOption(save, dealId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  setPlayerTransferListed: (playerId, listed, minFee) => {
    const { save } = get()
    if (!save) return false
    const result = setTransferListed(save, playerId, listed, minFee)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  mutualTerminatePlayer: (playerId) => {
    const { save } = get()
    if (!save) return false
    const result = mutualTerminateContract(save, playerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  signBosmanPreContract: (playerId, wage, years = 3) => {
    const { save } = get()
    if (!save) return false
    const gate = canApproachBosman(save, playerId)
    if (!gate.ok) {
      set({ status: gate.reason })
      return false
    }
    const result = signPreContract(save, playerId, wage, years)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  triggerPlayerBuyBack: (playerId) => {
    const { save } = get()
    if (!save) return false
    const result = triggerBuyBack(save, playerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  togglePlayerShortlist: (playerId) => {
    const { save } = get()
    if (!save) return
    const next = toggleShortlist(save, playerId)
    saveToStorage(next)
    set({ save: next, status: 'อัปเดต shortlist แล้ว' })
  },

  upgradeStaffRole: (role) => {
    const { save } = get()
    if (!save) return
    const member = save.staff.members.find((m) => m.role === role)!
    const cost = staffUpgradeCost(member.level)
    const club = save.clubs.find((c) => c.id === save.humanClubId)!
    const result = upgradeStaff(save.staff, role, save.humanClubId, club.balance >= cost)
    if (!result.ok) {
      set({ status: result.message })
      return
    }
    const next = {
      ...save,
      staff: result.staff,
      clubs: save.clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - cost } : c,
      ),
    }
    saveToStorage(next)
    set({ save: next, status: result.message })
  },

  hireStaffMember: (staffId, asRole = 'coach') => {
    const { save } = get()
    if (!save) return false
    const result = hireStaff(save, staffId, asRole)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  promoteToCoach: (staffId) => {
    const { save } = get()
    if (!save) return false
    const result = promoteStaffToCoach(save, staffId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  hireWorldCoach: (coachId) => {
    const { save } = get()
    if (!save) return false
    const result = hireWorldCoachFn(save, coachId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  retirePlayerToStaff: (playerId, role = 'coach') => {
    const { save } = get()
    if (!save) return false
    const result = convertPlayerToStaff(save, playerId, role)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  upgradeYouthAcademy: () => {
    const { save } = get()
    if (!save) return
    const result = proposeFacilityUpgradeFn(save, 'youth')
    set({ status: result.message })
    if (!result.ok) return
    saveToStorage(result.save)
    set({ save: result.save })
  },

  boostAffiliateRelations: () => {
    const { save } = get()
    if (!save) return false
    const result = boostAffiliateRelationsFn(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  graduateYouthPlayer: (playerId) => {
    const { save } = get()
    if (!save) return false
    const result = graduateYouthPlayerFn(save, playerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  runScout: (playerId) => {
    const { save } = get()
    if (!save) return
    const { save: next, message } = scoutPlayer(save, playerId)
    saveToStorage(next)
    set({ save: next, status: message })
  },

  assignScoutWatch: (fixtureId, targetPlayerIds = []) => {
    const { save } = get()
    if (!save) return false
    const result = assignFormWatch(save, fixtureId, targetPlayerIds)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  plantRomano: (kind, opts = {}) => {
    const { save } = get()
    if (!save) return false
    const result = plantRomanoStory(save, save.humanClubId, kind, opts)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  startManagerTalk: (topic, playerId) => {
    const { save } = get()
    if (!save) return false
    const result = managerTalk(save, topic, playerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  answerPlayerRequest: (requestId, response) => {
    const { save } = get()
    if (!save) return false
    const result = respondToPlayerRequest(save, requestId, response)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  requestBoardBudget: (amount) => {
    const { save } = get()
    if (!save) return false
    const result = requestClubBudget(save, amount)
    set({ status: result.message })
    saveToStorage(result.save)
    set({ save: result.save })
    return result.ok
  },

  inviteOwnerStadium: () => {
    const { save } = get()
    if (!save) return false
    const result = inviteOwnerToStadium(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  requestPublicSupport: () => {
    const { save } = get()
    if (!save) return false
    const result = requestBoardPublicSupport(save)
    set({ status: result.message })
    saveToStorage(result.save)
    set({ save: result.save })
    return result.ok
  },

  callBoardMeeting: () => {
    const { save } = get()
    if (!save) return false
    const result = callBoardEmergencyMeeting(save)
    set({ status: result.message })
    saveToStorage(result.save)
    set({ save: result.save })
    return result.ok
  },

  outreachFans: (faction) => {
    const { save } = get()
    if (!save) return false
    const result = outreachFanFaction(save, faction as FanFactionKey)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  answerOwnerDemand: (accept) => {
    const { save } = get()
    if (!save) return false
    const result = resolveOwnerDemand(save, accept)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  adviseTakeover: (offerId, advice) => {
    const { save } = get()
    if (!save) return false
    const result = setTakeoverAdvice(save, offerId, advice)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  attemptTakeover: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = attemptTakeoverDeal(save, offerId)
    set({ status: result.message })
    saveToStorage(result.save)
    set({ save: result.save })
    return result.ok
  },

  rejectTakeover: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = rejectTakeoverOffer(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  requestOwnerBailout: () => {
    const { save } = get()
    if (!save) return false
    const result = requestOwnerBailoutFn(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  startNewSeason: () => {
    const { save } = get()
    if (!save) return false
    const result = startNextSeason(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save, liveMatch: null })
    return true
  },

  acceptJob: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = acceptJobOffer(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save, liveMatch: null })
    return true
  },

  rejectJob: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = rejectJobOffer(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  resignClub: () => {
    const { save } = get()
    if (!save) return false
    const result = resignFromClub(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save, liveMatch: null })
    return true
  },

  proposeFacilityUpgrade: (kind) => {
    const { save } = get()
    if (!save) return false
    const result = proposeFacilityUpgradeFn(save, kind)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  resolveFacilityProposal: (approve) => {
    const { save } = get()
    if (!save) return false
    const result = resolveFacilityProposalFn(save, approve)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  upgradeFacility: (kind) => {
    const { save } = get()
    if (!save) return false
    const result = proposeFacilityUpgradeFn(save, kind)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  takeManagerHoliday: (matchdays) => {
    const { save } = get()
    if (!save) return false
    const result = takeHoliday(save, matchdays)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save, liveMatch: null })
    return true
  },

  answerPressConference: (answerIds) => {
    const { save } = get()
    if (!save) return
    const result = resolvePressConference(save, answerIds)
    saveToStorage(result.save)
    set({ save: result.save, status: result.note })
  },

  dismissPressConference: () => {
    const { save } = get()
    if (!save) return
    const next = skipPressConference(save)
    saveToStorage(next)
    set({ save: next, status: 'ข้ามแถลงข่าว (−1 reputation)' })
  },

  answerPlayerInterview: (answerIds) => {
    const { save } = get()
    if (!save) return
    const result = resolvePlayerInterview(save, answerIds)
    saveToStorage(result.save)
    set({ save: result.save, status: result.note })
  },

  dismissPlayerInterview: () => {
    const { save } = get()
    if (!save) return
    const next = skipPlayerInterview(save)
    saveToStorage(next)
    set({ save: next, status: 'ข้ามสัมภาษณ์นักเตะ' })
  },

  dismissMatchdayReport: () => {
    const { save } = get()
    if (!save) return
    const next = { ...save, lastMatchdayReport: null }
    saveToStorage(next)
    set({ save: next })
  },

  setNtCampFocus: (focus) => {
    const { save } = get()
    if (!save) return
    const next = setNtCampFocusFn(save, focus)
    saveToStorage(next)
    set({ save: next, status: `โฟกัสแคมป์: ${focus}` })
  },

  toggleNtCampPlayer: (playerId) => {
    const { save } = get()
    if (!save) return
    const next = toggleNtCampPlayerFn(save, playerId)
    saveToStorage(next)
    set({ save: next })
  },

  confirmNtCamp: () => {
    const { save } = get()
    if (!save) return
    const next = confirmNtCampFn(ensureNtCamp(save))
    saveToStorage(next)
    set({ save: next, status: next.ntCamp?.note ?? 'ยืนยันแคมป์แล้ว' })
  },

  acceptPreSeasonOffer: (offerId) => {
    const { save } = get()
    if (!save) return false
    const result = acceptPreSeasonOfferFn(save, offerId)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  skipPreSeason: () => {
    const { save } = get()
    if (!save) return false
    const result = skipPreSeasonFn(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  playNextPreSeasonMatch: () => {
    const { save } = get()
    if (!save) return false
    const result = playNextPreSeasonMatchFn(save)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },
}))
