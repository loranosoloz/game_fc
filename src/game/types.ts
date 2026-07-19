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
  /** เงินส่วนตัวในกระเป๋า (฿) — ได้จากค่าเหนื่อย ใช้จ่ายตามไลฟ์สไตล์ */
  cash: number
  squadRole: SquadRole
  injuryDays: number
  injuryType: InjuryType | null
  treatment: InjuryTreatment | null
  injuryHistory: InjuryRecord[]
  /** Season yellow card tally (reset on accumulation ban) */
  seasonYellows: number
  /** Matches remaining suspended */
  banMatches: number
  /** Years left on contract */
  contractYears: number
  /** Season when contract expires */
  contractEndSeason: number
  /** Optional release clause fee */
  releaseClause: number | null
  minutesPlayed: number
  /** Youth academy product */
  isYouth: boolean
  /** Assigned mentor player id (same club) */
  mentorId: string | null
  /** How well the player handles media (1–20) */
  mediaHandling: number
  /** Last lifestyle activity id */
  lastActivityId?: string | null
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
  /** รายได้ตั๋วสะสมฤดูกาล */
  ticketRevenueSeason?: number
  /** รายได้ขายเสื้อสะสมฤดูกาล */
  shirtRevenueSeason?: number
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
  /** Assigned match official */
  refereeId?: string
}

export interface Referee {
  id: string
  name: string
  nation: string
  /** สถานะ/ชื่อเสียง 1–20 (Elite สูง) */
  reputation: number
  /** ความเข้มงวดในการเป่าใบ 1–20 */
  strictness: number
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
  playerId?: string
  text: string
  spot: PitchSpot
  homeGoals: number
  awayGoals: number
  /** yellow | red when kind === 'card' */
  cardColor?: 'yellow' | 'red'
}

export interface TeamMatchStats {
  shots: number
  shotsOnTarget: number
  corners: number
  fouls: number
  yellows: number
  reds: number
  possession: number
}

export interface MatchResult {
  fixtureId: string
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  homeRating: number
  awayRating: number
  stats: { home: TeamMatchStats; away: TeamMatchStats }
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

export type StaffRole = 'coach' | 'scout' | 'physio'

export interface StaffMember {
  role: StaffRole
  name: string
  level: number
  staffId?: string | null
}

export interface StaffPerson {
  id: string
  name: string
  /** Current job — mutable (scout/physio สามารถเป็นโค้ชได้) */
  role: StaffRole
  clubId: string | null
  origin: 'career' | 'ex_player'
  formerPlayerName: string | null
  age: number
  /** Living status — ไม่ได้มาจาก JSON */
  energy: number
  morale: number
  professionalism: number
  ambition: number
  determination: number
  personalityId: string
  /** ทักษะแต่ละสาย 1–20 (กำหนดว่าจะเก่งเป็นโค้ชแค่ไหน) */
  coachSkill: number
  scoutSkill: number
  physioSkill: number
  reputation: number
  wageWeekly: number
  hireFee: number
  lastActivityId: string | null
  yearsInRole: number
}

export interface StaffState {
  /** Human club active slots (derived from pool) */
  members: StaffMember[]
  /** World pool ~200 */
  pool: StaffPerson[]
  marketRefreshMatchday: number
}

export interface DailyActivityDef {
  id: string
  labelTh: string
  category: string
  weightBase: number
  wPro: number
  wAmb: number
  wDet: number
  wTemp: number
  effects: { sharpness: number; condition: number; morale: number }
  missTraining: boolean
}

export interface DailyActivityLog {
  id: string
  date: string
  playerId: string
  playerName: string
  activityId: string
  labelTh: string
  category: string
  missTraining: boolean
  effects: { sharpness: number; condition: number; morale: number }
  subject?: 'player' | 'staff'
}

export interface PlayerSpendDef {
  id: string
  labelTh: string
  category: string
  costMin: number
  costMax: number
  weightBase: number
  wPro: number
  wAmb: number
  wTemp: number
  effects: {
    sharpness?: number
    condition?: number
    morale?: number
    happiness?: number
  }
  note: string
}

export interface PlayerSpendLog {
  id: string
  date: string
  playerId: string
  playerName: string
  spendId: string
  labelTh: string
  category: string
  amount: number
  note: string
}

export interface FinanceLedgerEntry {
  id: string
  date: string
  kind: 'tickets' | 'shirts' | 'wages' | 'other'
  amount: number
  note: string
}

/** สรุปรายได้สนาม + สมุดบัญชีสั้นๆ (โฟกัสทีมคุณ) */
export interface ClubFinanceState {
  ticketSeason: number
  shirtSeason: number
  wageSeason: number
  lastMatchTickets: number
  lastMatchShirts: number
  lastMatchCrowd: number
  ledger: FinanceLedgerEntry[]
  spendLogs: PlayerSpendLog[]
}

export interface YouthState {
  academyLevel: number
  nextIntakeMatchday: number
  lastIntakeNote: string
}

export interface ScoutFormSighting {
  id: string
  playerId: string
  fixtureId: string
  date: string
  matchday: number
  /** ฟอร์มนัดนี้เท่านั้น 1–10 */
  form: number
  note: string
  source: 'staff_watch' | 'guest_tip'
}

export type StadiumVisitorKind = 'player' | 'coach' | 'celebrity'
export type StadiumVisitPurpose = 'watch_team' | 'check_form' | 'scout_player'

export interface StadiumVisit {
  id: string
  date: string
  matchday: number
  fixtureId: string
  kind: StadiumVisitorKind
  name: string
  visitorPlayerId?: string
  visitorStaffId?: string
  fromClubId?: string | null
  purpose: StadiumVisitPurpose
  targetPlayerId?: string
  report: string
}

export interface FormWatchAssignment {
  id: string
  fixtureId: string
  /** นักเตะที่ให้สตาฟโฟกัส — ว่าง = ดูดาวของทั้งสองทีม */
  targetPlayerIds: string[]
  cost: number
  status: 'pending' | 'done'
}

export interface ScoutKnowledge {
  /** playerId → 0–100 · คนแปลกหน้าเริ่ม 0 · อดีตลูกทีมพื้น 50 */
  byPlayer: Record<string, number>
  /** อดีตนักเตะที่เคยอยู่ทีมคุณ */
  alumniIds: string[]
  /** ฟอร์มที่เห็นทีละนัด */
  formSightings: ScoutFormSighting[]
  /** แขกเข้าสนามบ้าน (หลังแมตช์) */
  visits: StadiumVisit[]
  /** สั่งสเกาต์ไปดูนัด */
  pendingWatches: FormWatchAssignment[]
}

export interface PressStory {
  id: string
  date: string
  headline: string
  body: string
}

export type MediaChannel = 'news' | 'social' | 'romano'
export type MediaTone = 'positive' | 'neutral' | 'negative' | 'rumor'

export interface MediaItem {
  id: string
  date: string
  channel: MediaChannel
  headline: string
  body: string
  tone: MediaTone
  tags?: string[]
  /** Romano reliability 0–100 (“Here we go” เมื่อสูง) */
  reliability?: number
  subjectName?: string
}

export interface MediaFeed {
  news: MediaItem[]
  social: MediaItem[]
  romano: MediaItem[]
  /** วันล่าสุดที่แต่ละสโมสรจ้าง Romano ปล่อยข่าว (YYYY-MM-DD) — คูลดาวน์ 90 วัน */
  lastPlantByClub: Record<string, string>
}

export interface PressAnswerOption {
  id: string
  label: string
  /** Applied when chosen */
  moraleDelta?: number
  happinessDelta?: number
  boardDelta?: number
  fansDelta?: number
  reputationDelta?: number
  socialHeadline?: string
  socialTone?: MediaTone
}

export interface PressQuestion {
  id: string
  prompt: string
  answers: PressAnswerOption[]
}

export interface PressConferenceState {
  pending: boolean
  date: string
  matchSummary: string
  questions: PressQuestion[]
  /** Answer ids chosen in order; empty while pending */
  chosen: string[]
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
  /** Manager public reputation 0–100 (jobs / pull / media) */
  managerReputation: number
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
  /** Lifestyle diary (human squad focus) */
  dailyLogs: DailyActivityLog[]
  /** รายได้สนาม + การใช้เงินนักเตะ */
  clubFinance: ClubFinanceState
  youth: YouthState
  scouting: ScoutKnowledge
  /** @deprecated mirrored from media.news — use media */
  press: PressStory[]
  /** ข่าว · โซเชียล · Romano หลังบ้าน */
  media: MediaFeed
  /** Post-match press conference (null when none pending) */
  pressConference: PressConferenceState | null
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