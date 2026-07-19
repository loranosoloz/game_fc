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
  recoverSquad,
  simulateMatchday,
  type PreparedMatchday,
} from '@/game/simulate'
import { autoPickTactics } from '@/game/seed'
import { FORMATION_SLOTS } from '@/game/types'
import { buyPlayerFromAi, sellPlayerToAi, renewContract } from '@/game/transfer'
import {
  submitNegotiatedBuy,
  acceptCounterOffer,
  proposePlayerExchange,
  startAuction,
} from '@/game/transferDesk'
import { arrangeLoan, recallLoan, exerciseLoanOption } from '@/game/loans'
import { toggleShortlist } from '@/game/shortlist'
import type { OppositionInstructions } from '@/game/types'
import { applyTrainingWeek, recoverInjuriesOneDay } from '@/game/training'
import { setPlayerTreatment } from '@/game/medical'
import { upgradeStaff, staffUpgradeCost, staffLevel, hireStaff, convertPlayerToStaff, promoteStaffToCoach } from '@/game/staff'
import { boostAffiliateRelations as boostAffiliateRelationsFn } from '@/game/affiliates'
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
import { startNextSeason } from '@/game/season'
import { acceptJobOffer, rejectJobOffer } from '@/game/jobs'
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

interface GameStore {
  save: GameSave | null
  status: string | null
  liveMatch: PreparedMatchday | null
  newGame: (managerName: string, humanClubId: string, leagueId?: LeagueId) => void
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
  playNextMatchday: () => void
  startLiveMatch: () => boolean
  finishLiveMatch: () => void
  abortLiveMatch: () => void
  advanceDay: () => void
  markInboxRead: (id: string) => void
  clearStatus: () => void
  offerBuyPlayer: (playerId: string, fee: number, wage: number, contractYears?: number) => boolean
  offerBuyNegotiated: (
    playerId: string,
    fee: number,
    wage: number,
    years?: number,
    appearanceAddon?: number,
    sellOnPercent?: number,
  ) => boolean
  acceptTransferCounter: (offerId: string) => boolean
  offerExchange: (theirId: string, ourId: string, cash: number) => boolean
  startPlayerAuction: (playerId: string, minBid?: number) => boolean
  offerSellPlayer: (playerId: string, fee: number) => boolean
  renewPlayerContract: (playerId: string, wage: number, years: number) => boolean
  loanInPlayer: (playerId: string) => boolean
  loanOutPlayer: (playerId: string, toClubId: string) => boolean
  recallLoanDeal: (dealId: string) => boolean
  buyLoanOption: (dealId: string) => boolean
  togglePlayerShortlist: (playerId: string) => void
  upgradeStaffRole: (role: 'coach' | 'scout' | 'physio') => void
  hireStaffMember: (staffId: string, asRole?: 'coach' | 'scout' | 'physio') => boolean
  promoteToCoach: (staffId: string) => boolean
  retirePlayerToStaff: (playerId: string, role?: 'coach' | 'scout' | 'physio') => boolean
  upgradeYouthAcademy: () => void
  boostAffiliateRelations: () => boolean
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
  startNewSeason: () => boolean
  acceptJob: (offerId: string) => boolean
  rejectJob: (offerId: string) => boolean
  proposeFacilityUpgrade: (kind: FacilityKind) => boolean
  resolveFacilityProposal: (approve: boolean) => boolean
  /** @deprecated ใช้ proposeFacilityUpgrade */
  upgradeFacility: (kind: FacilityKind) => boolean
  takeManagerHoliday: (matchdays: number) => boolean
  answerPressConference: (answerIds: string[]) => void
  dismissPressConference: () => void
}

function finalizeApplied(save: GameSave, matchday: number, resultsCount: number) {
  const physio = staffLevel(save.staff, 'physio') + medicalFacilityBonus(save)
  let withRecovery: GameSave = {
    ...save,
    players: recoverSquad(save.players, physio),
  }
  withRecovery = applyWeeklyWages(withRecovery)
  withRecovery = { ...withRecovery, dynamics: recomputeDynamics(withRecovery) }
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

  newGame: (managerName, humanClubId, leagueId = 'eng') => {
    const save = createNewGame(managerName, humanClubId, leagueId)
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
      .slice(0, 7)
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
    const { players, note } = applyTrainingWeek(save.players, save.humanClubId, save.training)
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

  playNextMatchday: () => {
    const { save } = get()
    if (!save || save.seasonComplete) return
    if (save.board?.sacked) {
      set({ status: 'คุณถูกปลดแล้ว — เริ่มเกมใหม่ที่หน้าแรก' })
      return
    }
    const md = nextUnplayedMatchday(save)
    if (md == null) {
      set({ status: 'จบฤดูกาลแล้ว' })
      return
    }
    const { save: next, resultsCount } = simulateMatchday(save, md)
    set(finalizeApplied(next, md, resultsCount))
  },

  startLiveMatch: () => {
    const { save } = get()
    if (!save || save.seasonComplete) return false
    if (save.board?.sacked) {
      set({ status: 'คุณถูกปลดแล้ว — เริ่มเกมใหม่ที่หน้าแรก' })
      return false
    }
    const md = nextUnplayedMatchday(save)
    if (md == null) {
      set({ status: 'จบฤดูกาลแล้ว' })
      return false
    }
    const prepared = prepareMatchday(save, md)
    if (!prepared) return false

    if (!prepared.humanFixture || !prepared.humanResult) {
      const applied = applyPreparedMatchday(save, prepared)
      set(finalizeApplied(applied, md, prepared.results.length))
      set({ status: `แมตช์เดย์ ${md}: ทีมคุณไม่มีนัด — จำลองนัด AI ให้แล้ว` })
      return false
    }

    set({ liveMatch: prepared, status: null })
    return true
  },

  finishLiveMatch: () => {
    const { save, liveMatch } = get()
    if (!save || !liveMatch) return
    const applied = applyPreparedMatchday(save, liveMatch)
    set(finalizeApplied(applied, liveMatch.matchday, liveMatch.results.length))
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
    get().playNextMatchday()
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

  offerBuyPlayer: (playerId, fee, wage, contractYears = 3) => {
    const { save } = get()
    if (!save) return false
    const result = buyPlayerFromAi(save, playerId, fee, wage, contractYears)
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
  },

  offerBuyNegotiated: (playerId, fee, wage, years = 3, appearanceAddon = 0, sellOnPercent = 0) => {
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
    )
    set({ status: result.message })
    if (!result.ok) return false
    saveToStorage(result.save)
    set({ save: result.save })
    return true
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

  offerExchange: (theirId, ourId, cash) => {
    const { save } = get()
    if (!save) return false
    const result = proposePlayerExchange(save, theirId, ourId, cash)
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

  offerSellPlayer: (playerId, fee) => {
    const { save } = get()
    if (!save) return false
    const result = sellPlayerToAi(save, playerId, fee)
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

  loanOutPlayer: (playerId, toClubId) => {
    const { save } = get()
    if (!save) return false
    const result = arrangeLoan(save, playerId, toClubId, {
      durationMatchdays: 12,
      recallable: true,
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
}))
