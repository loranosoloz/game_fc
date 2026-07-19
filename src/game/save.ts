import type { GameSave } from './types'
import { SAVE_KEY } from './types'
import { createClubs, createPlayersForClubs, createTacticsForAll } from './seed'
import { blankTable, generateSeasonFixtures } from './fixtures'

export function createNewGame(managerName: string, humanClubId: string): GameSave {
  const clubs = createClubs(humanClubId)
  const players = createPlayersForClubs(clubs)
  const tacticsByClub = createTacticsForAll(clubs, players)
  const clubIds = clubs.map((c) => c.id)
  const fixtures = generateSeasonFixtures(clubIds)
  const human = clubs.find((c) => c.id === humanClubId)!

  return {
    version: 1,
    createdAt: new Date().toISOString(),
    managerName: managerName.trim() || 'Manager',
    humanClubId,
    currentDate: fixtures[0]?.date ?? '2026-08-15',
    season: 2026,
    matchday: 0,
    clubs,
    players,
    tacticsByClub,
    fixtures,
    table: blankTable(clubIds),
    inbox: [
      {
        id: 'welcome',
        date: fixtures[0]?.date ?? '2026-08-15',
        title: `Welcome to ${human.name}`,
        body: `You manage 1 of 20 clubs. The other 19 are AI. Each matchday simulates every fixture — yours and all AI matches — then updates the league table.`,
        read: false,
      },
    ],
    lastHumanResult: null,
    seasonComplete: false,
  }
}

export function saveToStorage(save: GameSave) {
  localStorage.setItem(SAVE_KEY, JSON.stringify(save))
}

export function loadFromStorage(): GameSave | null {
  const raw = localStorage.getItem(SAVE_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw) as GameSave
    if (parsed.version !== 1) return null
    return parsed
  } catch {
    return null
  }
}

export function clearStorage() {
  localStorage.removeItem(SAVE_KEY)
}
