import { create } from 'zustand'
import type { FormationId, GameSave, Tactics } from '@/game/types'
import { createNewGame, loadFromStorage, saveToStorage, clearStorage } from '@/game/save'
import {
  applyPreparedMatchday,
  nextUnplayedMatchday,
  payWeeklyWages,
  prepareMatchday,
  recoverSquad,
  simulateMatchday,
  type PreparedMatchday,
} from '@/game/simulate'
import { autoPickTactics } from '@/game/seed'
import { FORMATION_SLOTS } from '@/game/types'
import { buyPlayerFromAi, sellPlayerToAi } from '@/game/transfer'

interface GameStore {
  save: GameSave | null
  status: string | null
  liveMatch: PreparedMatchday | null
  newGame: (managerName: string, humanClubId: string) => void
  continueGame: () => boolean
  persist: () => void
  resetSave: () => void
  setFormation: (formation: FormationId) => void
  setStartingXi: (playerIds: string[]) => void
  autoPickHumanXi: () => void
  playNextMatchday: () => void
  startLiveMatch: () => boolean
  finishLiveMatch: () => void
  abortLiveMatch: () => void
  advanceDay: () => void
  markInboxRead: (id: string) => void
  clearStatus: () => void
  offerBuyPlayer: (playerId: string, fee: number, wage: number) => boolean
  offerSellPlayer: (playerId: string, fee: number) => boolean
}

function finalizeApplied(save: GameSave, matchday: number, resultsCount: number) {
  const withRecovery = {
    ...save,
    players: recoverSquad(save.players),
    clubs: payWeeklyWages(save.clubs, save.players),
  }
  saveToStorage(withRecovery)
  return {
    save: withRecovery,
    status: `แมตช์เดย์ ${matchday}: จบนัดครบ ${resultsCount} นัด (คุณ + AI)`,
    liveMatch: null as PreparedMatchday | null,
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  save: null,
  status: null,
  liveMatch: null,

  newGame: (managerName, humanClubId) => {
    const save = createNewGame(managerName, humanClubId)
    saveToStorage(save)
    set({ save, status: 'เริ่มอาชีพใหม่แล้ว — มี AI คุมอีก 19 ทีม', liveMatch: null })
  },

  continueGame: () => {
    const save = loadFromStorage()
    if (!save) return false
    set({ save, status: null, liveMatch: null })
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

  setFormation: (formation) => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const picked = autoPickTactics(humanId, save.players, formation)
    const next = { ...save, tacticsByClub: { ...save.tacticsByClub, [humanId]: picked } }
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
      .filter((p) => p.clubId === humanId && !startingXi.includes(p.id))
      .sort((a, b) => b.overall - a.overall)
      .map((p) => p.id)
      .slice(0, 7)
    const tactics: Tactics = { ...current, startingXi, bench: rest }
    const next = {
      ...save,
      tacticsByClub: { ...save.tacticsByClub, [humanId]: tactics },
    }
    saveToStorage(next)
    set({ save: next })
  },

  autoPickHumanXi: () => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const current = save.tacticsByClub[humanId]
    const picked = autoPickTactics(humanId, save.players, current.formation)
    const next = {
      ...save,
      tacticsByClub: { ...save.tacticsByClub, [humanId]: picked },
    }
    saveToStorage(next)
    set({ save: next, status: 'เลือก XI ที่ดีที่สุดให้อัตโนมัติแล้ว' })
  },

  playNextMatchday: () => {
    const { save } = get()
    if (!save || save.seasonComplete) return
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
      set({ status: 'จบฤดูกาลแล้ว — เริ่มเกมใหม่ได้เมื่อพร้อม' })
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

  offerBuyPlayer: (playerId, fee, wage) => {
    const { save } = get()
    if (!save) return false
    const result = buyPlayerFromAi(save, playerId, fee, wage)
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
}))
