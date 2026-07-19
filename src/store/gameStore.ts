import { create } from 'zustand'
import type { FormationId, GameSave, Tactics } from '@/game/types'
import { createNewGame, loadFromStorage, saveToStorage, clearStorage } from '@/game/save'
import { payWeeklyWages, recoverSquad, simulateMatchday } from '@/game/simulate'
import { autoPickTactics } from '@/game/seed'
import { FORMATION_SLOTS } from '@/game/types'

interface GameStore {
  save: GameSave | null
  status: string | null
  newGame: (managerName: string, humanClubId: string) => void
  continueGame: () => boolean
  persist: () => void
  resetSave: () => void
  setFormation: (formation: FormationId) => void
  setStartingXi: (playerIds: string[]) => void
  autoPickHumanXi: () => void
  playNextMatchday: () => void
  advanceDay: () => void
  markInboxRead: (id: string) => void
  clearStatus: () => void
}

function nextUnplayedMatchday(save: GameSave): number | null {
  const upcoming = save.fixtures.filter((f) => !f.played)
  if (upcoming.length === 0) return null
  return Math.min(...upcoming.map((f) => f.matchday))
}

export const useGameStore = create<GameStore>((set, get) => ({
  save: null,
  status: null,

  newGame: (managerName, humanClubId) => {
    const save = createNewGame(managerName, humanClubId)
    saveToStorage(save)
    set({ save, status: 'New career started — 19 AI clubs ready.' })
  },

  continueGame: () => {
    const save = loadFromStorage()
    if (!save) return false
    set({ save, status: null })
    return true
  },

  persist: () => {
    const { save } = get()
    if (save) saveToStorage(save)
  },

  resetSave: () => {
    clearStorage()
    set({ save: null, status: 'Save cleared.' })
  },

  setFormation: (formation) => {
    const { save } = get()
    if (!save) return
    const humanId = save.humanClubId
    const picked = autoPickTactics(humanId, save.players, formation)
    const tacticsByClub = { ...save.tacticsByClub, [humanId]: picked }
    const next = { ...save, tacticsByClub }
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
    set({ save: next, status: 'Best available XI selected.' })
  },

  playNextMatchday: () => {
    const { save } = get()
    if (!save || save.seasonComplete) return
    const md = nextUnplayedMatchday(save)
    if (md == null) {
      set({ status: 'Season complete.' })
      return
    }
    const { save: next, resultsCount } = simulateMatchday(save, md)
    const withRecovery = {
      ...next,
      players: recoverSquad(next.players),
      clubs: payWeeklyWages(next.clubs, next.players),
    }
    saveToStorage(withRecovery)
    set({
      save: withRecovery,
      status: `Matchday ${md}: simulated ${resultsCount} fixtures (your match + AI matches).`,
    })
  },

  advanceDay: () => {
    // MVP: advancing day without a match just recovers fitness a bit
    const { save } = get()
    if (!save) return
    if (save.seasonComplete) {
      set({ status: 'Season finished — start a new game when ready.' })
      return
    }
    const md = nextUnplayedMatchday(save)
    if (md != null) {
      // Jump to next matchday simulation for pace
      get().playNextMatchday()
      return
    }
    set({ status: 'No fixtures left.' })
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
}))
