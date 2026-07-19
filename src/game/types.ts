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
export type CompetitionKind = 'league' | 'cup' | 'ucl' | 'league_cup' | 'trophy'
export type SetPiecePlan = 'mixed' | 'near_post' | 'far_post' | 'short' | 'direct'
export type InjuryType = 'muscle' | 'ligament' | 'bone'
export type InjuryTreatment = 'rest' | 'physio' | 'injection'
/** Illness / sickness (separate from musculoskeletal injury) */
export type IllnessType = 'cold' | 'flu' | 'stomach' | 'virus' | 'fever'

/** Body regions for fitness / injury map (all players including AI) */
export type BodyPartId =
  | 'head'
  | 'neck'
  | 'shoulderL'
  | 'shoulderR'
  | 'chest'
  | 'back'
  | 'armL'
  | 'armR'
  | 'handL'
  | 'handR'
  | 'abdomen'
  | 'groin'
  | 'thighL'
  | 'thighR'
  | 'kneeL'
  | 'kneeR'
  | 'calfL'
  | 'calfR'
  | 'ankleL'
  | 'ankleR'
  | 'footL'
  | 'footR'

/** Per-part fitness 0–100 (green ≥70, yellow 40–69, red &lt;40) */
export type BodyMap = Record<BodyPartId, number>

export interface InjuryRecord {
  type: InjuryType
  days: number
  source: 'match' | 'training'
  bodyPart?: BodyPartId
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
  /** Active injured region when injuryDays > 0 */
  injuryBodyPart: BodyPartId | null
  /** Per-region fitness — all clubs (human + AI) */
  bodyMap: BodyMap
  injuryHistory: InjuryRecord[]
  /** Days remaining sick (0 = healthy) — all clubs including AI */
  illnessDays: number
  illnessType: IllnessType | null
  /** Season yellow card tally (reset on accumulation ban) */
  seasonYellows: number
  /** Matches remaining suspended */
  banMatches: number
  /** ลาส่วนตัว / คอลอัป ฯลฯ — นับถอยหลังต่อแมตช์เดย์ · ไม่พร้อมลงแข่ง */
  leaveDays: number
  /** ต้นสังกัดตอนถูกยืม (ว่าง = ไม่ได้ยืม) */
  loanParentClubId?: string | null
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
  /** Special position skills (max 10) — unique pools per GK/DF/MF/FW */
  skills: string[]
  /** Last lifestyle activity id */
  lastActivityId?: string | null
  /** บัญชีโซเชียลส่วนตัว */
  social: PlayerSocial
}

export interface PlayerSocial {
  handle: string
  followers: number
  /** ความร้อนแรงช่วงสั้น 0–100 */
  heat: number
  postsWeek: number
  verified: boolean
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
  /** ลีกต้นทาง (คลับข้ามลีก / UCL invite) */
  originLeagueId?: string
  /** 1 = ดิวิชันบน · 2 = ลีกล่าง */
  division: 1 | 2
  /** บัญชีโซเชียลทางการของสโมสร */
  social: ClubSocial
}

export interface ClubSocial {
  handle: string
  followers: number
  /** engagement 0–100 */
  engagement: number
  /** ความแข็งแกร่งแบรนด์ออนไลน์ 0–100 */
  brand: number
  lastPostNote: string
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
  /** คำสั่งเจาะจงคู่แข่ง (กด/มาร์กดาว) */
  opposition?: OppositionInstructions
}

export interface OppositionInstructions {
  /** กดสูงใส่ผู้เล่น id นี้ */
  pressPlayerId: string | null
  /** มาร์กตัวแน่น */
  markPlayerId: string | null
  /** never_show / show_onto_weak / tight */
  showOnto: 'none' | 'weaker_foot' | 'tight'
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
  /** สำหรับนัดลีก — ดิวิชัน 1 หรือ 2 */
  division?: 1 | 2
  cupRound?: string
  /** Assigned match official */
  refereeId?: string
  /** สภาพอากาศนัดนี้ */
  weather?: MatchWeather
  /** สองนัด: 1 = ขาแรก, 2 = ขากลับ */
  leg?: 1 | 2
  /** ผูกคู่สองนัด */
  tieId?: string
}

export type MatchWeather = 'clear' | 'rain' | 'wind' | 'cold' | 'hot'

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
    /** หัวรุนแรง / Ultras */
    ultras: number
    /** ซอฟต์ / ครอบครัว */
    soft: number
    /** แฟนทั่วไป */
    casual: number
    /** คอร์ปอเรต / สปอนเซอร์ */
    corporate: number
    /** แฟนต่างชาติ / ท่องเที่ยวฟุตบอล */
    international: number
  }
  lastVerdict: string
  /** ประท้วงกำลังเกิด */
  protestActive: boolean
  /** คว่ำบาตรตั๋วจนแมตช์เดย์นี้ */
  boycottUntilMatchday: number
  lastEvent: string
  /** บันทึกบรรยากาศสนาม */
  atmosphereLogs: AtmosphereLog[]
}

export interface AtmosphereLog {
  id: string
  date: string
  matchday: number
  kind: 'owner' | 'board' | 'fans' | 'mixed'
  title: string
  body: string
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

export interface BoardUltimatum {
  issuedMatchday: number
  deadlineMatchday: number
  kind: 'win_streak' | 'improve_rank' | 'meet_kpis'
  note: string
  winsNeeded: number
  winsSoFar: number
}

export interface BoardState {
  confidence: number
  targetMaxRank: number
  lastNote: string
  preferredStyle: PlayStyle
  youthMinutesTarget: number
  kpis: VisionKpi[]
  lowConfidenceStreak: number
  ultimatum: BoardUltimatum | null
  sacked: boolean
  sackedNote: string | null
  lastBudgetRequestMatchday: number
  /** แช่แข็งตลาดจนแมตช์เดย์ */
  transferFreezeUntil: number
  lastStadiumVisitMatchday: number
  publicSupport: boolean
}

export type OwnerPersonality =
  | 'ambitious'
  | 'patient'
  | 'frugal'
  | 'meddling'
  | 'glory_hunter'
  | 'local_hero'

export interface OwnerStadiumLog {
  id: string
  date: string
  matchday: number
  attended: boolean
  action: string
  note: string
}

export interface OwnerState {
  name: string
  personality: OwnerPersonality
  patience: number
  relationship: number
  warChest: number
  lastNote: string
  takeoverHeat: number
  lastStadiumVisitMatchday: number
  stadiumLogs: OwnerStadiumLog[]
  /** คำสั่งค้างจากเจ้าของที่ผู้จัดการต้องตอบ */
  pendingDemand: OwnerDemand | null
}

export type OwnerDemandKind =
  | 'sign_star'
  | 'play_youth'
  | 'win_next'
  | 'cut_wages'
  | 'attacking_style'
  | 'meet_fans'

export interface OwnerDemand {
  id: string
  kind: OwnerDemandKind
  issuedMatchday: number
  dueMatchday: number
  note: string
  status: 'pending' | 'done' | 'failed'
}

export type InvestorStyle =
  | 'private_equity'
  | 'billionaire_toy'
  | 'consortium'
  | 'fan_ownership'
  | 'oil_state'
  | 'tech_mogul'
  | 'heritage'
  | 'sportswashing'
  | 'local_pride'
  | 'sovereign_fund'

export interface InvestorGroup {
  id: string
  name: string
  origin: string
  countryCode: string
  style: InvestorStyle
  styleLabel: string
  capital: number
  ambition: number
  patience: number
  /** ภาพลักษณ์ในสายตาแฟน 0–100 */
  reputation: number
  prefersRepMin: number
  prefersRepMax: number
  note: string
}

export type TakeoverVerdict = 'attractive' | 'fair' | 'risky' | 'toxic'

export interface TakeoverOffer {
  id: string
  investorId: string
  investorName: string
  investorStyle: InvestorStyle
  investorOrigin: string
  issuedMatchday: number
  expiresMatchday: number
  /** มูลค่าที่เสนอซื้อคลับ */
  bid: number
  /** เงินฉีดเข้าคลับหลังดีล */
  promisedInvestment: number
  keepManager: boolean
  conditions: string
  sellerScore: number
  buyerScore: number
  fanScore: number
  boardScore: number
  /** คะแนนรวมถ่วงน้ำหนัก — ไม่ใช่แค่ขายเลย */
  overallScore: number
  verdict: TakeoverVerdict
  reasons: {
    seller: string[]
    buyer: string[]
    fans: string[]
    board: string[]
  }
  status: 'open' | 'accepted' | 'rejected' | 'expired' | 'withdrawn'
  managerAdvice: 'recommend' | 'caution' | 'reject' | null
}

export interface TakeoverState {
  offers: TakeoverOffer[]
  lastDealNote: string | null
  coolDownUntilMatchday: number
  /** ความสนใจตลาดซื้อขายคลับ 0–100 */
  marketInterest: number
  history: Array<{ matchday: number; note: string }>
  /** ฤดูกาลล่าสุดที่กลุ่มทุนเข้ามา */
  lastApproachSeason: number
  /** ฤดูกาลถัดไปที่อนุญาตให้เข้ามา (ห่าง 1–3 ปี) */
  nextEligibleSeason: number
  /** ปีที่ทีมย่ำแย่/ติดหล่มติดต่อกัน */
  strugglingSeasons: number
  /** ฤดูกาลที่รีวิวผลปลายปีล่าสุด */
  lastSeasonReviewed: number
  /** ปีนี้มีรอบเข้ามาแล้วหรือยัง (ปีละ ≤1 ครั้ง) */
  approachedThisSeason: boolean
  /** ธงฤดูกาลของ cadence — เปลี่ยนปีแล้วรีเซ็ต approachedThisSeason */
  cadenceSeason: number
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
  kind: 'tickets' | 'shirts' | 'wages' | 'fine' | 'other' | 'sponsor' | 'tv' | 'prize' | 'loan'
  amount: number
  note: string
}

export interface DisciplineFineDef {
  id: string
  labelTh: string
  triggers: string[]
  fineMin: number
  fineMax: number
  wageShareMin: number
  wageShareMax: number
  caughtBase: number
  effects?: { morale?: number; happiness?: number }
  note: string
}

export interface PlayerFineLog {
  id: string
  date: string
  playerId: string
  playerName: string
  fineId: string
  labelTh: string
  amount: number
  trigger: string
  note: string
}

/** สรุปรายได้สนาม + สมุดบัญชีสั้นๆ (โฟกัสทีมคุณ) */
export interface ClubFinanceState {
  ticketSeason: number
  shirtSeason: number
  wageSeason: number
  /** ค่าปรับวินัยที่หักจากนักเตะ (เข้าคลับ) สะสมฤดูกาล */
  fineSeason: number
  sponsorSeason: number
  tvSeason: number
  prizeSeason: number
  lastMatchTickets: number
  lastMatchShirts: number
  lastMatchCrowd: number
  ledger: FinanceLedgerEntry[]
  spendLogs: PlayerSpendLog[]
  fineLogs: PlayerFineLog[]
}

export interface YouthState {
  academyLevel: number
  nextIntakeMatchday: number
  lastIntakeNote: string
}

export interface FeederClub {
  id: string
  name: string
  nation: string
  /** ระดับความสัมพันธ์/คุณภาพ 1–5 */
  level: number
}

export interface AffiliatesState {
  feeders: FeederClub[]
  lastNote: string
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

/** ผู้จัดการเริ่มคุย */
export type ManagerTalkTopic =
  | 'praise'
  | 'criticism'
  | 'promise_minutes'
  | 'role_clarity'
  | 'discipline_warn'
  | 'encourage'
  | 'listen'
  | 'team_meeting'

/** นักเตะเรียกคุย — id จาก talkDialogs.json (100 ประเภท) */
export type PlayerRequestKind = string

export type TalkResponse = 'agree' | 'promise' | 'refuse' | 'listen_only'

/** ชนิดสัญญาจาก dialog effects */
export type TalkPromiseKind = string

/** ผลจากการตอบบทสนทนา */
export interface TalkEffectBundle {
  morale?: number
  happiness?: number
  condition?: number
  sharpness?: number
  form?: number
  cash?: number
  clubCost?: number
  injuryDays?: number
  leaveDays?: number
  cohesion?: number
  managerRep?: number
  mediaHandling?: number
  missTraining?: boolean
  promise?: { kind: TalkPromiseKind; dueDays: number }
}

export interface TalkKindMeta {
  id: PlayerRequestKind
  labelTh: string
  urgencyBase: number
  when: string[]
}

export interface TalkDialogDef {
  id: string
  kind: PlayerRequestKind
  labelTh: string
  when: string[]
  urgencyBase: number
  weight: number
  playerLine: string
  responses: Record<
    TalkResponse,
    { effects: TalkEffectBundle; outcomeTh: string }
  >
}

export interface PlayerTalkRequest {
  id: string
  playerId: string
  clubId: string
  kind: PlayerRequestKind
  /** อ้างอิง talkDialogs.json — ของเก่าอาจไม่มี */
  dialogId?: string
  labelTh?: string
  date: string
  matchday: number
  urgency: number
  message: string
  status: 'pending' | 'resolved' | 'ignored' | 'expired'
}

export interface TalkPromise {
  playerId: string
  clubId: string
  kind: TalkPromiseKind
  createdMatchday: number
  /** ตรวจภายในกี่แมตช์เดย์ */
  dueMatchday: number
  note: string
}

export interface TalkLog {
  id: string
  date: string
  matchday: number
  source: 'manager' | 'player'
  playerId: string | null
  playerName: string
  topic: string
  response?: TalkResponse
  outcome: string
}

export interface TalksState {
  requests: PlayerTalkRequest[]
  logs: TalkLog[]
  promises: TalkPromise[]
  lastTeamMeetingMatchday: number
}

export interface LoanDeal {
  id: string
  playerId: string
  fromClubId: string
  toClubId: string
  startMatchday: number
  endMatchday: number
  /** สัดส่วนค่าเหนื่อยที่ต้นสังกัดยังจ่าย 0–1 */
  wageShareParent: number
  fee: number
  optionToBuy: number | null
  recallable: boolean
  status: 'active' | 'ended' | 'recalled' | 'bought'
}

export interface ShortlistEntry {
  playerId: string
  addedMatchday: number
  note: string
}

export interface ShortlistState {
  entries: ShortlistEntry[]
}

export type TransferOfferKind = 'buy' | 'sell' | 'exchange' | 'auction'

export interface PendingTransferOffer {
  id: string
  kind: TransferOfferKind
  playerId: string
  /** สำหรับแลกตัว */
  exchangePlayerId?: string
  fromClubId: string
  toClubId: string
  fee: number
  wage: number
  contractYears: number
  /** add-on: โบนัสเมื่อลง N นัด */
  appearanceAddon: number
  /** % ขายต่อ */
  sellOnPercent: number
  status: 'pending' | 'accepted' | 'rejected' | 'countered'
  counterFee?: number
  expiresMatchday: number
  note: string
}

export interface TransferDeskState {
  offers: PendingTransferOffer[]
  auctions: Array<{
    id: string
    playerId: string
    sellerClubId: string
    minBid: number
    currentBid: number
    currentBidderId: string | null
    endsMatchday: number
  }>
}

export interface SponsorDeal {
  id: string
  name: string
  perMatchday: number
  seasonTotal: number
  paid: number
}

export interface ClubIncomeState {
  sponsors: SponsorDeal[]
  tvPerMatchday: number
  tvSeasonPaid: number
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
  /** ตารางลีกล่าง (ดิวิชัน 2) */
  tableDiv2: TableRow[]
  inbox: InboxMessage[]
  lastHumanResult: MatchResult | null
  seasonComplete: boolean
  fans: FanState
  training: TrainingState
  board: BoardState
  /** เจ้าของสโมสร / ประธาน */
  owner: OwnerState
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
  /** ลีกคัพ — ดิวิชัน 1+2 */
  leagueCup: CupState
  /** ถ้วยลีกล่าง */
  trophy: CupState
  /** UEFA Champions League knockout (domestic top 4 + invite clubs). */
  ucl: CupState
  development: DevelopmentState
  /** นัดคุยผู้จัดการ ↔ นักเตะ / คำขอเรียกคุย */
  talks: TalksState
  loans: LoanDeal[]
  shortlist: ShortlistState
  transferDesk: TransferDeskState
  clubIncome: ClubIncomeState
  /** ตลาดเทคโอเวอร์ / ข้อเสนอจากกลุ่มทุน */
  takeover: TakeoverState
  /** อาชีพผู้จัดการ · ว่างงาน · ข้อเสนองาน */
  career: CareerState
  /** สนาม + สิ่งอำนวยความสะดวก */
  facilities: FacilitiesState
  /** สโมสรพันธมิตร / feeder */
  affiliates: AffiliatesState
  /** เจรจาสัญญาหลายรอบ */
  contractTalks: ContractTalkState
  /** สรุปลีกอื่นในโลก (เบา) */
  worldPulse: WorldPulseState
}

export type FacilityKind = 'stadium' | 'training' | 'medical' | 'commercial' | 'youth'

export interface FacilityProject {
  kind: FacilityKind
  startedMatchday: number
  doneMatchday: number
  note: string
  /** ความจุเป้าหลังสร้างเสร็จ (เฉพาะสนาม) */
  targetCapacity?: number
  costPaid?: number
}

/** ข้อเสนออัปเกรดจากผู้จัดการ → รอเจ้าของอนุมัติ */
export interface FacilityProposal {
  kind: FacilityKind
  fromTier: number
  toTier: number
  cost: number
  /** ความจุเป้าถ้าเป็นสนาม (ขั้นละ ~10,000 · Lv10 = 100,000) */
  targetCapacity?: number
  proposedMatchday: number
  note: string
}

export interface FacilitiesState {
  stadiumTier: number
  /** เพดานขั้นสนามของคลับนี้ (ทีมใหญ่สูงสุด 10 = จุได้แสน) */
  maxStadiumTier: number
  trainingTier: number
  maxTrainingTier: number
  medicalTier: number
  maxMedicalTier: number
  commercialTier: number
  maxCommercialTier: number
  youthTier: number
  maxYouthTier: number
  project: FacilityProject | null
  pendingProposal: FacilityProposal | null
  lastProposalMatchday: number
  lastNote: string
}

export interface ContractNegotiation {
  id: string
  playerId: string
  playerName: string
  round: number
  maxRounds: number
  lastOfferWage: number
  lastOfferYears: number
  /** ค่าเหนื่อยขั้นต่ำที่ฝั่งนักเตะ/เอเยนต์รับได้ตอนนี้ */
  askWage: number
  askYears: number
  /** ค่าเอเยนต์ถ้าเซ็นสำเร็จ */
  agentFee: number
  status: 'open' | 'signed' | 'walked'
  note: string
}

export interface ContractTalkState {
  talks: ContractNegotiation[]
}

export interface WorldLeaguePulse {
  leagueId: string
  name: string
  nameTh: string
  matchday: number
  leader: string
  second: string
  note: string
}

export interface WorldPulseState {
  leagues: WorldLeaguePulse[]
  lastUpdateMatchday: number
}

export interface JobOffer {
  id: string
  clubId: string
  clubName: string
  issuedMatchday: number
  issuedSeason: number
  expiresMatchday: number
  /** ชื่อเสียงผู้จัดการขั้นต่ำ */
  reputationRequired: number
  wageWeekly: number
  note: string
  status: 'open' | 'accepted' | 'rejected' | 'expired'
}

export interface CareerState {
  unemployed: boolean
  sackedFromClubId: string | null
  sackedSeason: number | null
  jobOffers: JobOffer[]
  clubsManaged: string[]
  lastJobNote: string | null
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