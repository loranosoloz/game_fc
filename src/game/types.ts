export type ControlType = 'human' | 'ai'

export type Position = 'GK' | 'DF' | 'MF' | 'FW'

export type FormationId = '4-4-2' | '4-3-3' | '4-2-3-1'

export interface PlayerAttributes {
  finishing: number
  passing: number
  tackling: number
  pace: number
  stamina: number
  decision: number
  handling: number
}

export interface Player {
  id: string
  clubId: string
  name: string
  age: number
  position: Position
  overall: number
  attrs: PlayerAttributes
  condition: number
  form: number
  morale: number
  wage: number
}

export interface Club {
  id: string
  name: string
  shortName: string
  color: string
  controlledBy: ControlType
  reputation: number
  stadiumCapacity: number
  balance: number
  wageBudgetWeekly: number
}

export interface Tactics {
  formation: FormationId
  startingXi: string[]
  bench: string[]
}

export interface Fixture {
  id: string
  matchday: number
  date: string
  homeClubId: string
  awayClubId: string
  played: boolean
  homeGoals?: number
  awayGoals?: number
}

export interface TableRow {
  clubId: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
}

export interface MatchEvent {
  minute: number
  kind: 'goal' | 'card'
  clubId: string
  playerName: string
}

export interface MatchResult {
  fixtureId: string
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  homeRating: number
  awayRating: number
}

export interface InboxMessage {
  id: string
  date: string
  title: string
  body: string
  read: boolean
}

export interface GameSave {
  version: 1
  createdAt: string
  managerName: string
  humanClubId: string
  currentDate: string
  season: number
  matchday: number
  clubs: Club[]
  players: Player[]
  tacticsByClub: Record<string, Tactics>
  fixtures: Fixture[]
  table: TableRow[]
  inbox: InboxMessage[]
  lastHumanResult: MatchResult | null
  seasonComplete: boolean
}

export const FORMATION_SLOTS: Record<FormationId, Position[]> = {
  '4-4-2': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'FW', 'FW'],
  '4-3-3': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'FW', 'FW', 'FW'],
  '4-2-3-1': ['GK', 'DF', 'DF', 'DF', 'DF', 'MF', 'MF', 'MF', 'MF', 'MF', 'FW'],
}

export const SAVE_KEY = 'fc-manager-save-v1'
