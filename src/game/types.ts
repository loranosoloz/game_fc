export type ControlType = 'human' | 'ai'

export type PositionGroup = 'GK' | 'DF' | 'MF' | 'FW'

export type RoleCode =
  | 'GK'
  | 'CB'
  | 'LB'
  | 'RB'
  | 'CDM'
  | 'CM'
  | 'CAM'
  | 'LM'
  | 'RM'
  | 'LW'
  | 'RW'
  | 'ST'
  | 'SS'

export type FormationId = '4-4-2' | '4-3-3' | '4-2-3-1'
export type SquadRole = 'key' | 'regular' | 'squad' | 'prospect'
export type Mentality = 'defensive' | 'balanced' | 'attacking'
export type Pressing = 'low' | 'medium' | 'high'
export type Tempo = 'slow' | 'normal' | 'fast'
export type Width = 'narrow' | 'normal' | 'wide'
export type PlayStyle = 'possession' | 'balanced' | 'counter'
export type CompetitionKind = 'league' | 'cup' | 'ucl'
export type SetPiecePlan = 'mixed' | 'near_post' | 'far_post' | 'short' | 'direct'
export type InjuryType = 'muscle' | 'ligament' | 'bone'
export type InjuryTreatment = 'rest' | 'physio' | 'injection'

export interface InjuryRecord {
  type: InjuryType
  days: number
  source: 'match' | 'training'
}

export interface PlayerAttributes {
  finishing: number
  passing: number
  tackling: number
  dribbling: number
  crossing: number
  heading: number
  technique: number
  decision: number
  vision: number
  composure: number
  positioning: number
  workRate: number
  pace: number
  stamina: number
  strength: number
  agility: number
  jumping: number
  handling: number
  reflexes: number
  aerialReach: number
}

export interface PlayerHidden {
  consistency: number
  importantMatches: number
  dirtiness: number
  injuryProneness: number
  versatility: number
}

export interface PlayerGrowth {
  determination: number
  ambition: number
  professionalism: number
  adaptability: number
  learningRate: number
}

export interface Player {
  id: string
  clubId: string
  name: string
  age: number
  role: RoleCode
  position: PositionGroup
  /** Display OVR derived from CA */
  overall: number
  /** Current Ability ~45–200 */
  ca: number
  /** Potential Ability (hidden until scouted) */
  pa: number
  attrs: PlayerAttributes
  hidden: PlayerHidden
  growth: PlayerGrowth
  personalityId: string
  condition: number
  sharpness: number
  form: number
  morale: number
  /** Playing-time / role satisfaction (1–20) */
  happiness: number
  wage: number
  squadRole: SquadRole
  injuryDays: number
  injuryType: InjuryType | null
  treatment: InjuryTreatment | null
  injuryHistory: InjuryRecord[]
  minutesPlayed: number
  /** Youth academy product */
  isYouth: boolean
  /** Assigned mentor player id (same club) */
  mentorId: string | null
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
  /** Season start balance for FFP */
  seasonStartBalance: number
}

export interface TeamInstructions {
  mentality: Mentality
  pressing: Pressing
  tempo: Tempo
  width: Width
  style: PlayStyle
}

export interface Tactics {
  formation: FormationId
  formationOop: FormationId
  instructions: TeamInstructions
  familiarity: number
  startingXi: string[]
  bench: string[]
  setPieces: {
    corners: SetPiecePlan
    freeKicks: SetPiecePlan
  }
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
  competition: CompetitionKind
  cupRound?: string
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

export type MatchEventKind =
  | 'kickoff'
  | 'commentary'
  | 'chance'
  | 'shot'
  | 'save'
  | 'goal'
  | 'corner'
  | 'foul'
  | 'card'
  | 'halftime'
  | 'secondhalf'
  | 'fulltime'

export interface PitchSpot {
  x: number
  y: number
}

export interface MatchEvent {
  id: string
  minute: number
  kind: MatchEventKind
  clubId?: string
  playerName?: string
  text: string
  spot: PitchSpot
  homeGoals: number
  awayGoals: number
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

export interface FanState {
  mood: number
  expectation: number
  loyalty: number
  factions: {
    ultras: number
    casual: number
    corporate: number
  }
  lastVerdict: string
}

export type TrainingFocus = 'tactics' | 'fitness' | 'attacking' | 'defending' | 'setpieces' | 'rest'

/** Individual attribute training focus */
export type IndividualFocus =
  | 'finishing'
  | 'passing'
  | 'defending'
  | 'athleticism'
  | 'goalkeeping'
  | 'none'

export interface TrainingState {
  focus: TrainingFocus
  intensity: 'low' | 'medium' | 'high'
  /** playerId → individual focus */
  individual: Record<string, IndividualFocus>
}

export interface VisionKpi {
  id: string
  label: string
  target: number
  current: number
  met: boolean
}

export interface BoardState {
  confidence: number
  targetMaxRank: number
  lastNote: string
  preferredStyle: PlayStyle
  youthMinutesTarget: number
  kpis: VisionKpi[]
}

export interface OppositionReport {
  opponentId: string
  formation: FormationId
  strength: number
  weakness: string
  threatPlayers: string[]
  advice: string
}

export interface DynamicsState {
  cohesion: number
  hierarchyStability: number
  dressingRoomMood: number
  lastNote: string
}

export interface StaffMember {
  role: 'coach' | 'scout' | 'physio'
  name: string
  level: number
}

export interface StaffState {
  members: StaffMember[]
}

export interface YouthState {
  academyLevel: number
  nextIntakeMatchday: number
  lastIntakeNote: string
}

export interface ScoutKnowledge {
  /** playerId → 0–100 */
  byPlayer: Record<string, number>
}

export interface PressStory {
  id: string
  date: string
  headline: string
  body: string
}

export interface CupState {
  name: string
  championClubId: string | null
  eliminated: string[]
}

export interface PersonalityEventLog {
  id: string
  date: string
  playerId: string
  title: string
  body: string
}

export interface DevelopmentState {
  /** Last mentoring summary */
  lastMentorNote: string
  personalityLog: PersonalityEventLog[]
}

export interface GameSave {
  version: 6
  createdAt: string
  managerName: string
  humanClubId: string
  /** eng | esp | ger | fra | ita | tha */
  leagueId: string
  leagueName: string
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
  fans: FanState
  training: TrainingState
  board: BoardState
  dynamics: DynamicsState
  staff: StaffState
  youth: YouthState
  scouting: ScoutKnowledge
  press: PressStory[]
  cup: CupState
  /** UEFA Champions League knockout (domestic top 4 + invite clubs). */
  ucl: CupState
  development: DevelopmentState
}

export const FORMATION_SLOTS: Record<FormationId, RoleCode[]> = {
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LM', 'CAM', 'RM', 'ST'],
}

export const DEFAULT_INSTRUCTIONS: TeamInstructions = {
  mentality: 'balanced',
  pressing: 'medium',
  tempo: 'normal',
  width: 'normal',
  style: 'balanced',
}

export const DEFAULT_SET_PIECES = {
  corners: 'mixed' as SetPiecePlan,
  freeKicks: 'direct' as SetPiecePlan,
}

export const SAVE_KEY = 'fc-manager-save-v6'