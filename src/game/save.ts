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
    managerName: managerName.trim() || 'ผู้จัดการ',
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
        title: `ยินดีต้อนรับสู่ ${human.name}`,
        body: `คุณคุม 1 ใน 20 สโมสร ที่เหลืออีก 19 เป็น AI ทุกแมตช์เดย์จะจำลองนัดทั้งหมดของคุณและของ AI แล้วอัปเดตตารางเดียวกัน`,
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
