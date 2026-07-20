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

/** หน้าที่บทบาทในแผน (รับ / ซัพพอร์ต / บุก) */
export type RoleDuty = 'defend' | 'support' | 'attack'

/** เวกเตอร์พฤติกรรม off-ball ตามบทบาท */
export interface BehavioralVectors {
  forwardRunTendency: number
  lateralHoldTendency: number
  centralCutInAttractor: number
  passingRiskTolerance: number
  defensiveTrackingDrop: number
  overlapTendency: number
}

export type FormationId =
  | '4-4-2'
  | '4-4-2-diamond'
  | '4-3-3'
  | '4-3-3-false9'
  | '4-2-3-1'
  | '4-1-4-1'
  | '4-3-2-1'
  | '3-5-2'
  | '3-4-3'
  | '3-4-2-1'
  | '3-1-4-2'
  | '5-3-2'
  | '5-4-1'
  | '3-4-3-diamond'
  | '4-2-4'
  | '4-2-2-2'
  | '4-5-1'
  | '3-3-3-1'
  | '3-6-1'
  | '4-2-1-3'
export type SquadRole = 'key' | 'regular' | 'squad' | 'prospect'
/** การันตีสถานะในสัญญาเจรจา */
export type SquadStatusGuarantee = 'star' | 'regular' | 'squad' | 'impact' | 'prospect'
export type Mentality = 'defensive' | 'balanced' | 'attacking'
export type Pressing = 'low' | 'medium' | 'high'
export type Tempo = 'slow' | 'normal' | 'fast'
export type Width = 'narrow' | 'normal' | 'wide'
export type PlayStyle = 'possession' | 'balanced' | 'counter'
export type CompetitionKind =
  | 'league'
  | 'cup'
  | 'ucl'
  | 'uel'
  | 'uecl'
  | 'acl'
  | 'acl_two'
  | 'asean_cup'
  | 'cwc'
  | 'super_cup'
  | 'league_cup'
  | 'trophy'
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
  source: 'match' | 'training' | 'history'
  bodyPart?: BodyPartId
  /** วันที่เกิด (ย้อนหลัง / บันทึก) */
  date?: string
  /** ปีจบฤดูกาล เช่น 2024 = ฤดูกาล 2023/24 */
  season?: number
  /** เรื้อรัง / เจ็บซ้ำบริเวณเดิม */
  chronic?: boolean
  noteTh?: string
}

/** สถิติฤดูกาลย้อนหลัง (ก่อนเปิดอาชีพ / ฤดูกาลที่แล้ว) */
export interface PlayerCareerSeason {
  /** ปีจบฤดูกาล เช่น 2025 = 2024/25 */
  season: number
  label: string
  clubName: string
  leagueId?: string
  apps: number
  goals: number
  assists: number
  minutes?: number
  yellows?: number
  reds?: number
}

export interface PlayerCareerClubStint {
  clubName: string
  clubKey?: string
  leagueId?: string
  fromYear: number
  toYear: number
}

export interface PlayerCareerTransfer {
  year: number
  fromClub: string
  toClub: string
  feeEur: number | null
  kind: 'youth' | 'transfer' | 'loan' | 'loan_end' | 'free'
  noteTh?: string
}

export interface PlayerCareerTitle {
  year: number
  label: string
  labelTh: string
  competition:
    | 'league'
    | 'cup'
    | 'ucl'
    | 'uel'
    | 'super_cup'
    | 'world_cup'
    | 'euro'
    | 'asian_cup'
    | 'other'
  clubName?: string
  nation?: string
}

export interface PlayerWorldCupEntry {
  year: number
  apps: number
  goals: number
  assists: number
  bestStage: string
  bestStageTh: string
  champion?: boolean
}

export interface PlayerCareerIntl {
  nation: string
  nationTh: string
  caps: number
  goals: number
  worldCups: PlayerWorldCupEntry[]
  majorTournaments: Array<{
    year: number
    name: string
    nameTh: string
    apps: number
    goals: number
    bestStageTh: string
  }>
}

/** ประวัติอาชีพครบชุด — สโมสร · ย้าย · แชมป์ · ทีมชาติ */
export interface PlayerCareerProfile {
  version: 2 | 3 | 4
  /** ที่มาของสถิติอาชีพ — ใช้เฉพาะของจริง */
  source?: 'transfermarkt'
  debutYear: number
  clubs: PlayerCareerClubStint[]
  transfers: PlayerCareerTransfer[]
  titles: PlayerCareerTitle[]
  intl: PlayerCareerIntl
  summaryTh: string
}

export interface PlayerAttributes {
  /** All values use FMInside-style 1–99 scale */
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
  /** ความสุขจากเวลาเล่น / บทบาท (1–20) */
  happiness: number
  /**
   * ความภักดีต่อสโมสรปัจจุบัน (1–20)
   * สูง = ยากอยากย้าย · ต่อสัญญาง่าย · เอเยนต์ยื่นขายน้อย
   */
  clubLoyalty?: number
  /** สโมสรที่ค่า clubLoyalty อ้างถึง — เปลี่ยนแล้วรีเซ็ต */
  loyaltyClubId?: string | null
  wage: number
  /** เงินส่วนตัวในกระเป๋า (€) — ได้จากค่าเหนื่อย ใช้จ่ายตามไลฟ์สไตล์ */
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
  /** สถิติฤดูกาลย้อนหลัง (ยิง / แอสซิสต์ / นัด) */
  careerSeasons?: PlayerCareerSeason[]
  /** ประวัติอาชีพครบ: ย้ายทีม · แชมป์ · ทีมชาติ · ฟุตบอลโลก */
  careerProfile?: PlayerCareerProfile
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
  /** เบอร์เสื้อในสโมสร (จากทะเบียนลีก/UCL) */
  shirtNumber?: number | null
  /** Youth academy product */
  isYouth: boolean
  /** Assigned mentor player id (same club) */
  mentorId: string | null
  /** How well the player handles media (1–20) */
  mediaHandling: number
  /** Special position skills (max 10) — unique pools per GK/DF/MF/FW */
  skills: string[]
  /**
   * สไตล์เล่นถนัด (สูงสุด 3) — level 3=เก่งมาก · 2=ใช้ได้ · 1=เล่นได้ · มี xp ฝึก
   */
  preferredTacticalRoles?: import('./playerTacticalRoles').PlayerTacticalStyle[]
  /**
   * ความคุ้นเคยบทบาทแท็กติก (0–100) — เล่นบทเดิมบ่อยขึ้นหลังแมตช์
   * ถ้าไม่มีค่า จะ seed จาก preferredTacticalRoles
   */
  tacticalRoleFamiliarity?: Partial<Record<import('./tacticalRoles').TacticalRoleId, number>>
  /** กำลังฝึกสไตล์นี้ (อาจอยู่นอกชุด 3 อัน) */
  styleTrainTarget?: import('./tacticalRoles').TacticalRoleId | null
  /** ความคืบหน้าปลดล็อกสไตล์ใหม่เข้าชุด (0–100) */
  styleTrainProgress?: number
  /** ai=ปล่อยนักเตะเลือก · lock=ห้ามเปลี่ยนเป้า · หรือบังคับ TacticalRoleId */
  styleTrainOrder?: import('./playerTacticalRoles').StyleTrainOrder
  /** สไตล์ที่ไม่อยากเล่น — AI หลีก / ขอแทนที่ */
  styleDisliked?: import('./tacticalRoles').TacticalRoleId[]
  /** นับแมตช์เดย์ที่ถูกบังคับเล่นสไตล์ไม่ชอบติดต่อกัน */
  styleMismatchStreak?: number
  /** Last lifestyle activity id */
  lastActivityId?: string | null
  /** คำสั่งไลฟ์สไตล์จากผู้จัดการ */
  lifestyleOrder?: LifestyleOrder | null
  /** บุคลิกเอเยนต์ (seed ถ้าไม่มี) */
  agentStyle?: AgentStyle
  /** ชื่อเอเยนต์จริง หรือ พ่อ/แม่ */
  agentName?: string | null
  /** บริษัทเอเยนต์ หรือ「ครอบครัว …」 */
  agentAgency?: string | null
  /** โปรอาชีพ vs พ่อแม่ในครอบครัว */
  agentKind?: AgentKind | null
  /** บัญชีโซเชียลส่วนตัว */
  social: PlayerSocial
  /** ความดัง 0–100 — ดังแล้วเล่นเฟลโดนด่าหนัก */
  fame?: number
  /** ขนาดแฟนคลับ (คน) */
  fanClubSize?: number
  /** ขนาดแอนตี้ / เฮตเตอร์ */
  antiFanSize?: number
  /** ดีลพรีเซ็นเตอร์แบรนด์ */
  brandDeals?: import('./playerFame').BrandDeal[]
  /** ประวัติ FM26 / SortItOutSI (ถ้ามีใน data pack) */
  bio?: PlayerBio | null
  /** Status / attrs จาก FMInside (0–99) */
  fmInside?: FmInsideProfile | null
  /** แคปทีมชาติในเซฟนี้ (seed จาก FMInside.caps ถ้ายังไม่เคยตั้ง) */
  ntCaps?: number
  /** ภาษาที่พูดได้ (รหัสสั้น en/es/th …) — ผลต่อการคุยกับโค้ช */
  languages?: string[]
  /** ธงอยากย้ายทีม (ไม่ลิสต์ขายอัตโนมัติ) */
  wantAway?: PlayerTransferDesire | null
  /** ไม่ยอมต่อสัญญา — เสี่ยงย้ายฟรี + แฟนเกลียด */
  refuseContractRenewal?: boolean
  /** สโมสรขึ้นบัญชีย้ายทีม */
  transferListed?: boolean
  transferListMinFee?: number | null
  /**
   * ความสนใจตลาดจากคู่แข่ง/ข่าว (0–20)
   * ดันค่าตัวขึ้นชั่วคราว แล้วค่อยคลายหลังแมตช์เดย์
   */
  marketHeat?: number
  /**
   * ประวัติฟอร์มรายแมตช์เดย์ (ล่าสุดท้ายสุด · สูงสุด ~16)
   * ใช้คำนวณค่าตัวแบบสัปดาห์/เดือน
   */
  formHistory?: number[]
  /** % ขึ้นค่าเหนื่อยอัตโนมัติทุกฤดูกาล */
  annualWageRisePercent?: number | null
  /** % ขึ้นค่าเหนื่อยเมื่อติดโซนยุโรป */
  europeWageBumpPercent?: number | null
  /** ฉีกสัญญาเมื่อตกชั้น (0 = ฟรี) */
  relegationReleaseClause?: number | null
  /** สิทธิ์ซื้อคืนของสโมสรเก่า */
  buyBack?: { clubId: string; fee: number; untilSeason: number } | null
  /** สิทธิ์ปฏิเสธครั้งแรก */
  firstRefusalClubId?: string | null
  /** เอเยนต์ล็อกไม่ให้เจรจาถึง MD นี้ */
  agentLockUntilMatchday?: number | null
  /** สถานะทีมที่การันตีในสัญญา */
  contractedSquadStatus?: SquadStatusGuarantee | null
  /** พรี-คอนแทรกต์บอสแมน */
  preContract?: {
    clubId: string
    wage: number
    years: number
    startSeason: number
    squadStatus?: SquadStatusGuarantee
  } | null
  /** รางวัลติดตัวถาวรในเซฟ (Ballon / ดาวซัลโว / TOTW …) */
  careerHonours?: import('./awards').PlayerCareerHonour[]
  /** ทีมในฝัน / สนใจ / ไม่ยอมไป — กระทบต่อสัญญาและรับข้อเสนอ */
  clubAffinity?: PlayerClubAffinity | null
  /** สัญญาใจลับ (tapping up) — รอหมดสัญญาเซ็นฟรี */
  secretHandshake?: PlayerSecretHandshake | null
}

/** ความสนใจสโมสรของนักเตะ */
export interface PlayerClubAffinity {
  dreamClubIds: string[]
  likedClubIds?: string[]
  avoidClubIds?: string[]
}

/** สัญญาใจลับกับสโมสรอื่น */
export interface PlayerSecretHandshake {
  fromClubId: string
  promisedAtMatchday: number
  promise: 'wait_free'
  exposed?: boolean
}

/** สถานะอยากย้าย — ข่าวสาธารณะถึงจะให้ AI แห่ยื่น */
export interface PlayerTransferDesire {
  active: boolean
  /** แรงกดดัน 1–20 */
  intensity: number
  /** ข่าวออกสื่อแล้ว — AI รู้ */
  publicNews: boolean
  /** ครั้งที่ปฏิเสธคำขออยากย้าย */
  refuseCount: number
  sinceMatchday: number
  reasonTh?: string
  /** บอร์ดสั่งให้รับข้อเสนอ / บังคับขาย */
  boardForced?: boolean
  /** ทีมที่อยากไป (จาก dream list) */
  preferredClubIds?: string[]
}

export type LifestyleOrder = 'none' | 'curfew' | 'extra_gym' | 'rest' | 'media_quiet'

export type AgentStyle = 'greedy' | 'loyal' | 'aggressive' | 'balanced'
export type AgentKind = 'pro' | 'family'

export type PlayerSocialMood =
  | 'buzzing'
  | 'chill'
  | 'salty'
  | 'tilted'
  | 'radio_silent'

export type PlayerSocialPostKind =
  | 'fan_roast'
  | 'fan_praise'
  | 'player_sulk'
  | 'player_flex'
  | 'player_clapback'
  | 'teammate_defend'
  | 'meme'
  | 'agent_pr'

export interface PlayerSocialPost {
  id: string
  date: string
  matchday: number
  kind: PlayerSocialPostKind
  text: string
  fromHandle: string
  likes: number
}

export interface PlayerSocial {
  handle: string
  followers: number
  /** ความร้อนแรงช่วงสั้น 0–100 */
  heat: number
  postsWeek: number
  verified: boolean
  /** อารมณ์โซเชียลล่าสุด */
  mood?: PlayerSocialMood
  /** ไทม์ไลน์สั้นๆ ล่าสุด */
  recentPosts?: PlayerSocialPost[]
  lastDramaMatchday?: number
}

/** ประวัติจาก SortItOutSI FM26 (เงินเป็น GBP) */
export interface PlayerBio {
  fmId?: string | null
  dob?: string | null
  gender?: string | null
  nationality?: string | null
  contractType?: string | null
  wageWeeklyGbp?: number | null
  contractExpires?: string | null
  contractSigned?: string | null
  valueGbp?: number | null
  estimatedCostGbp?: number | null
  fmPos?: string | null
  starRating?: number | null
  caRemaining?: number | null
  peaked?: boolean
  fixedPotential?: boolean | null
  injuryProne?: boolean | null
  releaseClauseGbp?: number | null
  developNote?: string | null
  sourceUrl?: string | null
}

/** FMInside normalized attributes (0–99) */
export interface FmInsideAttrs {
  goalkeeping: Record<string, number>
  technical: Record<string, number>
  mental: Record<string, number>
  physical: Record<string, number>
  setPieces: Record<string, number>
}

/** Status pack จาก fminside.net */
export interface FmInsideProfile {
  fmId: string
  name: string
  age?: number
  heightCm?: number | null
  leftFoot?: number | null
  rightFoot?: number | null
  positions?: string | null
  caps?: number | null
  goalsIntl?: number | null
  club?: string | null
  sellValueEur?: number | null
  wageEurPw?: number | null
  contractEnd?: string | null
  rating?: number | null
  potential?: number | null
  attrs: FmInsideAttrs
  bestRolesIn?: { name: string; score: number }[]
  bestRolesOut?: { name: string; score: number }[]
  sourceUrl?: string
}

/** เหตุที่แฟนเกลียดนักเตะ */
export type FanHateReason =
  | 'to_rival'
  | 'want_away'
  | 'free_exit'
  | 'refuse_contract'
  | 'sell_star'
  | 'betrayal'

export interface FanHatred {
  playerId: string
  playerName: string
  reason: FanHateReason
  reasonTh: string
  /** 1–20 */
  intensity: number
  sinceMatchday: number
  /** ทีมที่ไป หรือทีมที่อยากไป */
  otherClubId?: string | null
  /** ยังอยู่ในทีม — โดนโห่ในบ้าน */
  stillAtClub?: boolean
}

/** ระดับความเกลียดทีม (เบา → แรง) */
export type FanTeamHateStyle = 'boo' | 'banners' | 'hostile'

export interface FanTeamHatred {
  clubId: string
  /** % ของแฟนที่เกลียด (ประมาณ 20–95) */
  pct: number
  /** โห่ < ติดป้ายด่า < บรรยากาศเป็นศัตรู */
  style: FanTeamHateStyle
  reasonTh: string
}

/** แฟนระดับสโมสร — ใช้ได้ทั้ง AI และทีมผู้เล่น */
export interface ClubFansState {
  mood: number
  hatedPlayers: FanHatred[]
  /** ทีมที่แฟนเกลียด (คู่อริ / ดาร์บี้) */
  hatedTeams: FanTeamHatred[]
  lastEvent: string
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
  /** key สำหรับโลโก้ใน /public/crests (เช่น mci) */
  crestKey?: string | null
  /** บัญชีโซเชียลทางการของสโมสร */
  social: ClubSocial
  /** หัวหน้าโค้ช AI จากพูลโลก · คลับที่ผู้เล่นคุม = ที่ปรึกษาแผน (ว่างเมื่อผู้เล่นเพิ่งรับงาน) */
  coachId?: string | null
  /** แฟนของสโมสรนี้ (ทุกทีม) */
  clubFans?: ClubFansState | null
  /** ห้ามขายให้นักซื้อถึง MD นี้ (หลังจับสัญญาใจ) buyerClubId → untilMatchday */
  refuseBuyersUntil?: Record<string, number>
}

/** คู่อริระหว่างสโมสร — seed หรือเกิดเองระหว่างเซฟ */
export type RivalryOrigin =
  | 'seed'
  | 'table'
  | 'thrashing'
  | 'incident'
  | 'transfer'
  | 'derby_run'

export interface ClubRivalry {
  id: string
  clubAId: string
  clubBId: string
  /** ความร้อน 0–100 */
  heat: number
  origin: RivalryOrigin
  labelTh: string
  sinceSeason: number
  /** นัดล่าสุดที่ปะทะ */
  lastFixtureId?: string
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

/** คำสั่งตามเฟส (lite แนว FM) */
export interface PhaseInstructions {
  buildup: 'play_out' | 'mixed' | 'long_ball'
  progression: 'patient' | 'direct' | 'wing_play'
  finalThird: 'work_ball' | 'shoot' | 'cross'
  defensiveBlock: 'high' | 'mid' | 'low'
  counterPress: boolean
}

export const DEFAULT_PHASE_INSTRUCTIONS: PhaseInstructions = {
  buildup: 'mixed',
  progression: 'patient',
  finalThird: 'work_ball',
  defensiveBlock: 'mid',
  counterPress: true,
}

export interface SetPieceTakers {
  corners: string | null
  freeKicks: string | null
  penalties: string | null
  throwIns: string | null
}

export interface Tactics {
  formation: FormationId
  formationOop: FormationId
  instructions: TeamInstructions
  /** คำสั่งตามเฟส IP/OOP */
  phaseInstructions?: PhaseInstructions
  familiarity: number
  startingXi: string[]
  bench: string[]
  /**
   * บทบาทต่อช่อง (index ตรง startingXi / FORMATION_SLOTS)
   * เช่น ST → poacher | target_man | false_nine
   */
  slotRoles?: import('./tacticalRoles').TacticalRoleId[]
  /** กัปตัน (ต้องอยู่ใน startingXi) */
  captainId?: string | null
  /** รองกัปตัน */
  viceCaptainId?: string | null
  setPieces: {
    corners: SetPiecePlan
    freeKicks: SetPiecePlan
  }
  /** ผู้รับผิดชอบเซ็ตพีซ */
  setPieceTakers?: SetPieceTakers
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
  /** ผู้ชมที่ประมาณ/ล็อกไว้ก่อนเตะ (ปิดลูปกับตั๋ว) */
  attendance?: number
  /** สองนัด: 1 = ขาแรก, 2 = ขากลับ */
  leg?: 1 | 2
  /** ผูกคู่สองนัด */
  tieId?: string
  /** weekend = ลีกเสาร์ · midweek = ถ้วย/ยุโรปพุธ */
  slot?: 'weekend' | 'midweek'
  /** ผลยิงจุดโทษ (ถ้วย) */
  penaltiesHome?: number
  penaltiesAway?: number
  /** สถิติแมตช์หลังเตะ (ครองบอล · ยิง · มุม ฯลฯ) */
  matchStats?: { home: TeamMatchStats; away: TeamMatchStats }
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
  /** เอียงเข้าข้างเจ้าบ้าน 1–20 (10 = กลาง) */
  homeBias: number
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
  | 'var'
  | 'offside'
  | 'penalty'
  | 'stoppage'
  | 'substitution'
  | 'tactical_window'
  | 'extratime'
  | 'shootout'
  | 'halftime'
  | 'secondhalf'
  | 'fulltime'

export interface PitchSpot {
  x: number
  y: number
}

/** ตำแหน่งบนสนามจากซิม (ระบบเดียวกับ Agent.x/y ใน simulateMatch) */
export interface MatchSpatialPlayer {
  id: string
  side: 'home' | 'away'
  x: number
  y: number
  /** สภาพร่างกายสดในแมตช์ 0–100 */
  condition?: number
  /** พลังงานแมตช์ (stamina bar) 0–100 */
  matchStamina?: number
  /** ชีพจร/ burst zone 0–100 */
  heartRate?: number
  /** ความหนักจังหวะนี้ 0–100 (วิ่ง/เพรส) */
  activityLoad?: number
}

/** เฟรมเชิงพื้นที่ต่อไฮไลต์ — ใช้ animate LiveMatch */
export interface MatchSpatialFrame {
  ball: PitchSpot
  possessing: 'home' | 'away'
  carrierId?: string
  players: MatchSpatialPlayer[]
}

export interface MatchEvent {
  id: string
  minute: number
  kind: MatchEventKind
  clubId?: string
  playerName?: string
  playerId?: string
  /** เมื่อ kind === 'goal' */
  assistPlayerId?: string
  assistPlayerName?: string
  /** เมื่อ kind === 'goal' — มาจากจุดโทษในเกม */
  fromPenalty?: boolean
  text: string
  spot: PitchSpot
  homeGoals: number
  awayGoals: number
  /** yellow | red when kind === 'card' */
  cardColor?: 'yellow' | 'red'
  /** snapshot ตำแหน่งนักเตะ+ลูกจากซิม */
  spatial?: MatchSpatialFrame
  /** หยุดเกม — บาดเจ็บ / ใบแดง (รอเปลี่ยนตัวหรือแก้เกม) */
  stoppageKind?: 'injury' | 'red_card'
  stoppageSide?: 'home' | 'away'
  /** ส่วนร่างกายที่บาดเจ็บกลางแมตช์ (เมื่อ stoppageKind === injury) */
  injuryBodyPart?: BodyPartId
}

export interface TeamMatchStats {
  shots: number
  shotsOnTarget: number
  corners: number
  fouls: number
  yellows: number
  reds: number
  possession: number
  /** Expected goals */
  xg: number
}

export interface MatchPlayerRating {
  playerId: string
  name: string
  team: 'home' | 'away'
  rating: number
  goals: number
  shots: number
  xg: number
  minutes: number
  /** บทบาทแท็กติกที่ลงแข่ง */
  tacticalRoleId?: import('./tacticalRoles').TacticalRoleId
  /** โน้ตหน้าที่ตามบทบาท */
  dutyNote?: string
  /** คะแนนหน้าที่ (ใช้คำนวณเรตติ้ง) */
  dutyScore?: number
  /** ความคุ้นเคยบทบาทตอนจบนัด */
  roleFamiliarity?: number
}

/** สรุปทำไมแพ้/ชนะจาก Match Engine ชั้นพื้นที่ */
export interface MatchBreakdown {
  homeFormation: FormationId
  awayFormation: FormationId
  lines: string[]
  freePlayerNotes: string[]
  overloadNotes: string[]
  shoutNotes: string[]
}

export interface MatchResult {
  fixtureId: string
  homeGoals: number
  awayGoals: number
  events: MatchEvent[]
  homeRating: number
  awayRating: number
  stats: { home: TeamMatchStats; away: TeamMatchStats }
  breakdown?: MatchBreakdown
  /** เรตติ้งรายคน */
  playerRatings?: MatchPlayerRating[]
  /** Man of the Match */
  manOfTheMatchId?: string | null
  manOfTheMatchName?: string | null
  /** ผู้ชมที่ใช้นัดนี้ (ปิดลูปตั๋ว) */
  attendance?: number
  /** ไปต่อเวลา */
  wentToExtraTime?: boolean
  /** ยิงจุดโทษตัดสิน */
  wentToPens?: boolean
  penalties?: { home: number; away: number }
  /** บาดเจ็บระหว่างแมตช์ (Burst Zone / soft-tissue) */
  inMatchInjuries?: Array<{ playerId: string; type: InjuryType; days: number }>
  /** สภาพจบแมตช์ (stamina bar ในเกม) — ใช้เขียนกลับหลังนัด */
  finalConditions?: Record<string, number>
  /** นาทีลงจริงรายคน */
  minutesOnPitch?: Record<string, number>
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
  /** นักเตะที่แฟนเกลียด (ย้ายฟรี / คู่อริ / ไม่ต่อสัญญา ฯลฯ) */
  hatedPlayers: FanHatred[]
  /** ทีมที่แฟนเกลียด */
  hatedTeams?: FanTeamHatred[]
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
  /**
   * ตารางซ้อมรายสัปดาห์ (จ–อา) — ถ้าว่างใช้ focus หลักทั้งสัปดาห์
   * index 0 = จันทร์ … 6 = อาทิตย์
   */
  weekPlan?: TrainingFocus[]
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

export type TeamTalkKind = 'calm' | 'inspire' | 'focus_weakness' | 'trust_xi'

/** พิธีกรรมก่อนเตะ — เคลียร์หลังจบนัด */
export interface PreMatchState {
  fixtureId: string
  lineupConfirmed: boolean
  talkKind: TeamTalkKind | null
  /** คูณโบนัสแมตช์มนุษย์ (เช่น 1.05) */
  talkMatchBonus: number
  /** ตะโกนสั่งข้างสนาม (รอใช้ตอนจำลอง) */
  touchlineShouts?: import('./match/touchlineShouts').TouchlineShout[]
}

export type HierarchyTier = 'leader' | 'influential' | 'squad' | 'peripheral'

export interface DynamicsHierarchyEntry {
  playerId: string
  tier: HierarchyTier
  /** 0–100 */
  influence: number
}

export interface DynamicsSocialGroup {
  id: string
  labelTh: string
  memberIds: string[]
  /** 0–100 */
  mood: number
}

export interface DynamicsRivalry {
  aId: string
  bId: string
  /** 0–100 */
  intensity: number
  reasonTh: string
}

export interface DynamicsState {
  cohesion: number
  hierarchyStability: number
  dressingRoomMood: number
  lastNote: string
  /** ความเชื่อมั่นต่อผู้จัดการ 0–100 */
  managerTrust?: number
  hierarchy?: DynamicsHierarchyEntry[]
  groups?: DynamicsSocialGroup[]
  rivalries?: DynamicsRivalry[]
}

export type StaffRole =
  | 'coach'
  | 'attacking'
  | 'defending'
  | 'fitness'
  | 'scout'
  | 'physio'

export interface StaffMember {
  role: StaffRole
  name: string
  level: number
  staffId?: string | null
}

export interface StaffPerson {
  id: string
  name: string
  /** Current job — mutable (ย้ายตำแหน่งในคลับได้) */
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
  /** ทักษะแต่ละสาย 1–20 */
  coachSkill: number
  attackSkill: number
  defendSkill: number
  fitnessSkill: number
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
  /** มอบหมายงานอัตโนมัติ */
  responsibilities?: StaffResponsibilities
}

export type StaffResponsibilityTask =
  | 'training'
  | 'opposition_report'
  | 'contract_reminders'
  | 'form_watches'
  | 'set_piece_advice'
  | 'press_prep'

export interface StaffResponsibilities {
  /** task → 'manager' | 'assistant' | 'scout' | 'coach' | 'none' | staffPersonId */
  byTask: Partial<Record<StaffResponsibilityTask, string>>
  lastAutoNote?: string
  lastRunMatchday?: number
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
  /** ค่าตัวจ่ายซื้อสะสมฤดูกาล (FFP) */
  transferOutSeason: number
  /** ค่าตัวรับจากการขายสะสมฤดูกาล (FFP) */
  transferInSeason: number
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
  /** รู้ค่าฉีกสัญญาแล้ว (ความลับ — เปิดเมื่อสนิทเอเยนต์/นักเตะ) */
  knownReleaseClauseIds?: string[]
  /** ความสนิทกับเอเยนต์ของนักเตะ 0–100 */
  agentRapport?: Record<string, number>
  /** ความสนิทกับตัวนักเตะ 0–100 (คุย/เจรจา) */
  playerRapport?: Record<string, number>
  /** โฟกัสสรรหา */
  assignments?: ScoutAssignment[]
  /** รายงานสรุปซื้อ/เฝ้า/เลี่ยง */
  reports?: ScoutReportCard[]
}

export type ScoutFocusRegion =
  | 'domestic'
  | 'europe'
  | 'south_america'
  | 'africa'
  | 'asia'
  | 'any'

export type ScoutFocusRole = 'GK' | 'DF' | 'MF' | 'FW' | 'any'

export interface ScoutAssignment {
  id: string
  region: ScoutFocusRegion
  role: ScoutFocusRole
  maxAge: number
  active: boolean
  labelTh?: string
}

export interface ScoutReportCard {
  id: string
  playerId: string
  date: string
  matchday: number
  verdict: 'sign' | 'monitor' | 'avoid'
  summaryTh: string
  knowledgeGain: number
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
  /** ชื่อสำนักข่าว / ช่อง (เช่น Sky Sports, Marca) */
  outlet?: string
  /** ตำนานเลิกเล่นที่ร่วมวิเคราะห์/บรรยาย (ไม่ใช่นักเตะในสกวด) */
  punditName?: string
  punditRole?: string
  punditBio?: string
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

/** ช่วงพักเบรกทีมชาติ (FIFA window) */
export interface InternationalBreakState {
  weeksLeft: number
  /** รวมสัปดาห์ของหน้าต่างนี้ */
  totalWeeks: number
  label: string
  afterMatchday: number
  calledUpIds: string[]
  /** รายละเอียดเรียกตัวโดยโค้ชทีมชาติ (AI เลือกตามสไตล์) */
  callUps: {
    playerId: string
    playerName: string
    nation: string
    nationTh: string
    coachName: string
    clubId: string
    clubName: string
    score: number
    reasons: string[]
    firstCap: boolean
    styleFit: number
  }[]
  /** ใกล้ติดแต่หลุดโผ (โฟกัสทีมผู้เล่น) */
  snubs?: {
    playerId: string
    playerName: string
    nation: string
    nationTh: string
    coachName: string
    clubId: string
    clubName: string
    score: number
    cutoffScore: number
    reasons: string[]
    rivalName: string | null
  }[]
}

/** สัมภาษณ์นักเตะแยกจากแถลงผู้จัดการ */
export interface PlayerInterviewState {
  pending: boolean
  date: string
  playerId: string
  playerName: string
  kind: 'hero' | 'scorer' | 'young' | 'flop' | 'carded' | 'keeper'
  blurb: string
  questions: PressQuestion[]
  chosen: string[]
}

export interface CupState {
  name: string
  championClubId: string | null
  eliminated: string[]
  /** seeds 1–6 ที่ได้บายเข้า QF หลัง play-in (UEL/UECL) */
  playinByes?: string[]
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
  /**
   * buy_loan_back = ซื้อขาดแล้วให้ต้นสังกัดเดิมยืมใช้จนจบฤดูกาล
   * fromClubId = เจ้าของใหม่ · toClubId = ทีมที่ยืมใช้ · ฤดูกาลหน้าค่อยเข้าทีมเจ้าของ
   */
  kind?: 'standard' | 'buy_loan_back'
  /** ค่าตัวที่จ่ายตอนซื้อ (เฉพาะ buy_loan_back) */
  purchaseFee?: number | null
  /** ห้ามลงแข่งเจอทีมแม่ (ค่าเริ่มต้น true) */
  blockVsParent?: boolean
  /** ราคาบังคับซื้อขาด */
  obligationToBuy?: number | null
  /** โหมดบังคับซื้อ */
  obligationMode?: 'always' | 'avoid_relegation' | 'appearances' | null
  obligationAppearances?: number
  /** นัดที่ลงระหว่างยืม */
  appearancesOnLoan?: number
  /** เรียกกลับได้เฉพาะหน้าต่างวินเทอร์ */
  recallWinterOnly?: boolean
}

export interface ShortlistEntry {
  playerId: string
  addedMatchday: number
  note: string
}

export interface ShortlistState {
  entries: ShortlistEntry[]
}

export interface TransferDeadlineLog {
  id: string
  hour: number
  title: string
  body: string
}

/** โหมดปิดตลาด — 3 วันสุดท้ายนับชั่วโมง (72 ชม.) */
export interface TransferDeadlineState {
  active: boolean
  window: 'summer' | 'winter'
  hoursRemaining: number
  hoursElapsed: number
  clockHour: number
  startedMatchday: number
  windowEndMatchday: number
  completedForWindow?: 'summer' | 'winter' | null
  log: TransferDeadlineLog[]
}

export type TransferOfferKind = 'buy' | 'sell' | 'exchange' | 'auction'

/** แพทเทิร์นผ่อนค่าตัวแบบสโมสรจริง */
export type FeePaymentPreset =
  | 'full'
  | 'half_2y'
  | 'split_3y'
  | 'equal_3y'
  | 'front_heavy_3y'
  | 'back_heavy_3y'

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
  /** @deprecated ใช้ addons.appearanceFee */
  appearanceAddon: number
  /** @deprecated ใช้ addons.sellOnPercent */
  sellOnPercent: number
  /** แพ็กเงื่อนไขพิเศษเต็มชุด */
  addons?: TransferAddonPackage
  status: 'pending' | 'accepted' | 'rejected' | 'countered'
  counterFee?: number
  expiresMatchday: number
  note: string
  /** ซื้อแล้วให้ต้นสังกัดยืมใช้จนจบฤดูกาล */
  loanBackUntilNextSeason?: boolean
  /** แพทเทิร์นผ่อนค่าตัว */
  paymentPreset?: FeePaymentPreset
  /** ข้อเสนอ ROFR แมตช์ราคา */
  isRofrMatch?: boolean
  /** แลกตัว: รอทั้งสองฝ่ายยอมรับ */
  exchangeOurAccepted?: boolean
  exchangeTheirAccepted?: boolean
  exchangeOurWage?: number
  exchangeTheirWage?: number
  /** เอเยนต์มายื่นขายลูกค้าให้เรา */
  source?: 'agent_approach' | 'human' | 'ai'
  agentName?: string
  agentAgency?: string
  agentClientCount?: number
  approachReasonTh?: string
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
  /** เงื่อนไขพิเศษที่ยังค้าง (add-on / sell-on / โบนัสนัด) */
  clauses?: TransferClause[]
  /** งวดค่าตัวที่ยังค้างจ่าย */
  feeInstallments?: FeeInstallment[]
}

export interface FeePaymentSchedule {
  preset: FeePaymentPreset
  totalFee: number
  dueNow: number
  installments: Array<{
    amount: number
    dueSeason: number
    installmentIndex: number
    totalInstallments: number
  }>
}

export interface FeeInstallment {
  id: string
  playerId: string
  playerName: string
  fromClubId: string
  toClubId: string
  amount: number
  dueSeason: number
  installmentIndex: number
  totalInstallments: number
  status: 'pending' | 'paid' | 'overdue'
  note: string
}

/** ชนิดเงื่อนไขสัญญาจริงที่ใช้ในตลาด */
export type TransferClauseKind =
  | 'appearance'
  | 'goals'
  | 'assists'
  | 'clean_sheets'
  | 'sell_on'
  | 'sell_on_profit'
  | 'promotion'
  | 'league_title'
  | 'europe_qualify'
  | 'signing_on'
  | 'per_appearance'
  | 'per_goal'
  | 'per_assist'
  | 'per_clean_sheet'
  | 'intl_caps'

/** แพ็ก add-on ตอนเจรจาซื้อ */
export interface TransferAddonPackage {
  /** โบนัสลงครบ N นัด → จ่ายคลับขาย */
  appearanceFee: number
  appearanceNeeded: number
  /** โบนัสยิงครบ N ประตู → คลับขาย */
  goalsFee: number
  goalsNeeded: number
  /** โบนัสแอสซิสต์ครบ N → คลับขาย */
  assistsFee: number
  assistsNeeded: number
  /** โบนัสคลีนชีตครบ N → คลับขาย */
  cleanSheetsFee: number
  cleanSheetsNeeded: number
  /** % ขายต่อ */
  sellOnPercent: number
  /** โบนัสเลื่อนชั้น */
  promotionFee: number
  /** โบนัสแชมป์ลีก */
  leagueTitleFee: number
  /** โบนัสติดโซนยุโรป (ท็อป 4 ดิวิชัน 1) */
  europeFee: number
  /** เงินเซ็นสัญญาให้นักเตะ (ครั้งเดียว) */
  signingOnFee: number
  /** โบนัสนักเตะต่อนัดที่ลง */
  perAppearance: number
  /** โบนัสนักเตะต่อประตู */
  perGoal: number
  /** โบนัสนักเตะต่อแอสซิสต์ */
  perAssist: number
  /** โบนัสนักเตะต่อคลีนชีต */
  perCleanSheet: number
  /** sell-on: fee = % ของค่าตัวถัดไป · profit = % ของกำไร */
  sellOnMode?: 'fee' | 'profit'
  /** โบนัสแคปทีมชาติ → จ่ายคลับขาย */
  intlCapsFee?: number
  intlCapsNeeded?: number
  /** สิทธิ์ซื้อคืน (ราคาตายตัว) — ติดกับนักเตะหลังขาย */
  buyBackFee?: number
  buyBackYears?: number
  /** สิทธิ์ปฏิเสธครั้งแรกให้ผู้ขาย */
  firstRefusal?: boolean
  /** % ขึ้นค่าเหนื่อยรายปี */
  annualWageRisePercent?: number
  /** % ขึ้นค่าเหนื่อยเมื่อติดยุโรป */
  europeWageBumpPercent?: number
  /** ฉีกสัญญาเมื่อตกชั้น (null = ไม่ใส่, 0 = ฟรี) */
  relegationReleaseFee?: number | null
  /** การันตีสถานะในทีม */
  contractedSquadStatus?: SquadStatusGuarantee
}

export interface TransferClause {
  id: string
  kind: TransferClauseKind
  playerId: string
  playerName: string
  /** คลับที่ต้องจ่าย (ผู้ซื้อ / สโมสรปัจจุบัน) */
  fromClubId: string
  /** คลับที่รับเงิน (ผู้ขายเดิม) — ว่างถ้าจ่ายให้นักเตะ */
  toClubId: string
  /** ผู้รับเงิน */
  payee: 'seller' | 'player'
  amount: number
  /** เป้า milestone หรือเพดานโบนัสรายนัด (0 = ไม่จำกัด) */
  appearancesNeeded: number
  appearancesSoFar: number
  sellOnPercent: number
  status: 'active' | 'paid' | 'void'
  note: string
  /** ค่าตัวตอนซื้อ (สำหรับ sell_on_profit) */
  originalFee?: number
  sellOnMode?: 'fee' | 'profit'
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
  /** หน่วยเงินในเซฟ — EUR (หลัง ก.ค. 2026) */
  currency?: 'EUR' | 'THB'
  managerName: string
  /** Manager public reputation 0–100 (jobs / pull / media) */
  managerReputation: number
  /** สร้างตัว: สไตล์ / จุดแข็ง (มีผลแมตช์ + แผนเริ่มต้น) */
  managerProfile?: import('./managerProfile').ManagerProfile
  /** XP / เลเวลโค้ช — เก่งขึ้นเมื่อคุมดี · ลดแอตฯเมื่อแพ้บ่อย */
  managerProgress?: import('./managerProgress').ManagerProgress
  /** เควสตามความหวังสโมสร (ทีมเล็กก็เลเวลได้ถ้าทำเป้า) */
  clubQuests?: import('./managerProgress').ClubQuest[]
  /** ปฏิทินฤดูกาล — ช่องพัก/FIFA + ทัวร์นาเมนต์ฤดูร้อน */
  seasonCalendar?: import('./seasonCalendar').SeasonCalendarState
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
  /**
   * สำรองคลังสถิติบางส่วนในเซฟ (~48 นัด) — คลังเต็มอยู่ใน IndexedDB (`matchStatsDb`)
   * + MySQL `game_fc` สำหรับ sync/export (`db/schema.sql`)
   */
  matchArchive?: import('./matchArchive').MatchArchiveEntry[]
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
  /** สัมภาษณ์นักเตะหลังเกม (แยกจากแถลงผู้จัดการ) */
  playerInterview: PlayerInterviewState | null
  /** พักเบรกทีมชาติค้าง (FIFA window) */
  internationalBreak: InternationalBreakState | null
  /**
   * สมาคมฟุตบอลแต่ละชาติ — งบ + FIFA rank + โค้ชทีมชาติที่จ้าง
   * key = ชื่อชาติอังกฤษ (England, Thailand, …)
   */
  associations: Record<
    string,
    {
      nation: string
      code: string
      name: string
      nameTh: string
      fifaRank: number
      budget: number
      coachId: string | null
      wageWeekly: number
      hiredMatchday: number
      /** ฟอร์มผลงานโค้ชชาติ 1–20 */
      form: number
      /** จำนวน FIFA window ที่โค้ชคนนี้คุม */
      windowsInCharge: number
      vacantWindows: number
    }
  >
  cup: CupState
  /** ลีกคัพ — ดิวิชัน 1+2 */
  leagueCup: CupState
  /** ถ้วยลีกล่าง */
  trophy: CupState
  /** UEFA Champions League — อันดับ 1–4 ทุกลีกยุโรป */
  ucl: CupState
  /** UEFA Europa League — อันดับ 5–6 */
  uel: CupState
  /** UEFA Conference League — อันดับ 7–8 */
  uecl: CupState
  /** AFC Champions League Elite */
  acl: CupState
  /** AFC Champions League Two */
  aclTwo: CupState
  /** ASEAN Club Championship */
  aseanCup: CupState
  /** FIFA Club World Cup (สโมสรโลก) */
  cwc: CupState
  /** เมล็ดพันธุ์สโมสรโลกจากแชมป์ฤดูกาลก่อน */
  cwcAccess?: import('./clubWorldCup').CwcAccessState
  /** แมตช์เปิดฤดูกาล (Community Shield / ซูเปอร์คัพ) */
  superCup: CupState
  /** แชมป์ลีก/ถ้วยฤดูกาลก่อน — ใช้จับคู่ซูเปอร์คัพ */
  domesticTitles?: import('./superCup').DomesticTitles
  /** ปรีซีซั่น / ทัวร์อุ่นเครื่องก่อนเปิดศึก */
  preSeason?: import('./preSeason').PreSeasonState | null
  /** อันดับจบลีกยุโรปฤดูกาลก่อน (โควตาถ้วย) */
  euroAccess: EuroAccessState
  /** อันดับจบลีกเอเชียฤดูกาลก่อน (โควตา ACL / ASEAN) */
  asiaAccess: import('./asiaAccess').AsiaAccessState
  development: DevelopmentState
  /** นัดคุยผู้จัดการ ↔ นักเตะ / คำขอเรียกคุย */
  talks: TalksState
  loans: LoanDeal[]
  shortlist: ShortlistState
  transferDesk: TransferDeskState
  /** โหมดปิดตลาดนับชั่วโมง (3 วันสุดท้าย) */
  transferDeadline?: TransferDeadlineState | null
  /** คู่อริสโมสร (seed + เกิดเอง) */
  rivalries: ClubRivalry[]
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
  /**
   * ผู้ช่วยเตือนสัญญาใกล้หมด + บันทึกทวงต่อสัญญา
   * เตือนครั้งแรกเมื่อเหลือ ≤1 ปี แล้วทุก ~1 เดือน
   */
  assistantContractWatch?: {
    lastRemindByPlayer: Record<string, { matchday: number; season: number }>
    lastDemandByPlayer?: Record<string, number>
  }
  /**
   * คูลดาวน์เอเยนต์มายื่นขาย
   * เอเยนต์คนเดียวดูได้หลายลูกค้า — จำกัดความถี่ต่อเอเยนต์/ต่อนักเตะ
   */
  agentApproachWatch?: {
    lastByAgentKey: Record<string, number>
    lastByPlayerId: Record<string, number>
  }
  /** สรุปลีกอื่นในโลก (เบา) */
  worldPulse: WorldPulseState
  /** พิธีกรรมก่อนเตะ (null เมื่อไม่มีนัด/หลังแข่งแล้ว) */
  preMatch: PreMatchState | null
  /** สรุปหลังแมตช์เดย์ล่าสุด (แบนเนอร์พอร์ทัล) */
  lastMatchdayReport?: import('./matchdayReport').MatchdayReport | null
  /** สมุดเหตุการณ์สะสมทุกแมตช์เดย์ (ย้าย·แฟน·เทคโอเวอร์·งบ…) */
  matchdayChronicle?: import('./matchdayReport').MatchdayReport[]
  /** สรุปทัวร์นาเมนต์ชาติฤดูร้อน */
  lastIntlTournamentReports?: import('./intlTournaments').IntlTournamentReport[]
  /** ฟุตบอลโลก — คัดเลือกกลุ่มเก็บแต้ม + รอบ 32 ทีม */
  worldCup?: import('./worldCup').WorldCupState | null
  /** แคมป์ทีมชาติเมื่อคุณเป็นโค้ชชาติ (ช่วง FIFA window) */
  ntCamp?: import('./ntCamp').NtCampState | null
  /** ทีมยอดเยี่ยมสัปดาห์/เดือน · ผู้จัดการยอดเยี่ยม */
  awards?: import('./awards').AwardsState
  /** วิกฤตสภาพคล่อง / Administration */
  insolvency?: import('./insolvency').ClubInsolvencyState
  /** ประวัติย้ายสโมสรในอาชีพนี้ (world live DB) */
  playerMoveLog?: import('./playerWorldDb').PlayerMoveEvent[]
  /** ลงทะเบียนนักเตะลีก / UCL + หมุดปฏิทิน */
  squadRegistration?: import('./squadRegistration').SquadRegistrationState
  /** ติดตามคลับอื่น · ฟีดโลก · ความสนใจทีมชาติ */
  worldWatch?: WorldWatchState
}

export type WorldActivityKind =
  | 'transfer'
  | 'match'
  | 'training'
  | 'board'
  | 'injury'
  | 'contract'
  | 'scout'
  | 'media'
  | 'youth'
  | 'nt_watch'
  | 'rivalry'

export interface WorldActivityEvent {
  id: string
  date: string
  matchday: number
  season: number
  kind: WorldActivityKind
  clubId: string
  otherClubId?: string
  playerId?: string
  headlineTh: string
  bodyTh: string
  /** 1–3 */
  importance: number
}

export interface WorldNtInterest {
  playerId: string
  nation: string
  /** 0–100 */
  level: number
  noteTh: string
  lastUpdateMatchday: number
}

export interface WorldWatchState {
  watchedClubIds: string[]
  primaryRivalId: string | null
  feed: WorldActivityEvent[]
  ntInterest: WorldNtInterest[]
  lastTickMatchday: number
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
  /** เงินเซ็นที่ขอ (0 = ไม่ยึดติด) */
  askSigningOn?: number
  /** โบนัสลงแข่งที่ขอ / นัด */
  askPerAppearance?: number
  /** โบนัสประตูที่ขอ */
  askPerGoal?: number
  lastOfferSigningOn?: number
  lastOfferPerAppearance?: number
  lastOfferPerGoal?: number
  /** จุดติดปัจจุบันของรอบนี้ */
  focus?: ContractFocus
  /** ค่าเอเยนต์ถ้าเซ็นสำเร็จ */
  agentFee: number
  status: 'open' | 'signed' | 'walked' | 'cancelled'
  note: string
}

export type ContractFocus = 'wage' | 'years' | 'signing' | 'appearance' | 'package'

export interface ContractTalkState {
  talks: ContractNegotiation[]
}

export interface WorldPulseClubRow {
  key: string
  name: string
  shortName: string
  played: number
  won: number
  drawn: number
  lost: number
  gf: number
  ga: number
  points: number
  rep: number
}

export interface WorldLeaguePulse {
  leagueId: string
  name: string
  nameTh: string
  matchday: number
  leader: string
  second: string
  note: string
  /** อันดับคลับ (def.key) จำลองสะสม — ใช้ตัดโควตายุโรป */
  orderedKeys?: string[]
  /** ตารางเต็มของลีกนี้ */
  table?: WorldPulseClubRow[]
  /** ผลนัดล่าสุดในรอบนี้ */
  recentResults?: string[]
  /** ข้อความโควตายุโรปถ้าเป็นลีกยุโรป */
  euroNote?: string
}

export interface WorldPulseState {
  leagues: WorldLeaguePulse[]
  lastUpdateMatchday: number
}

/** อันดับจบลีกยุโรปสำหรับตัดโควตาถ้วย */
export interface EuroAccessState {
  /** club def.key เรียงอันดับ 1→n ต่อลีก */
  ranksByLeague: Partial<Record<string, string[]>>
}

export interface JobOffer {
  id: string
  /** club = สโมสร · national = ทีมชาติ (สมาคมจ้าง) */
  kind?: 'club' | 'national'
  clubId: string
  clubName: string
  /** เมื่อ kind=national */
  nation?: string
  nationTh?: string
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
  /** กำลังคุมทีมชาติอยู่ (ว่าง = ไม่ได้เป็นโค้ชชาติ) */
  nationalNation?: string | null
  /** ลาออกเองจากคลับล่าสุด */
  resignedVoluntarily?: boolean
}

export const FORMATION_SLOTS: Record<FormationId, RoleCode[]> = {
  // 4-back
  '4-4-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '4-4-2-diamond': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'ST', 'ST'],
  '4-3-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'ST', 'RW'],
  '4-3-3-false9': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'LW', 'SS', 'RW'],
  '4-2-3-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LM', 'CAM', 'RM', 'ST'],
  '4-1-4-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST'],
  '4-3-2-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'CAM', 'CAM', 'ST'],
  // 3/5-back
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '3-4-3': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'LW', 'ST', 'RW'],
  '3-4-2-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CM', 'CM', 'RM', 'CAM', 'CAM', 'ST'],
  '3-1-4-2': ['GK', 'CB', 'CB', 'CB', 'CDM', 'LM', 'CM', 'CM', 'RM', 'ST', 'ST'],
  '5-3-2': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'CDM', 'CM', 'CM', 'ST', 'ST'],
  '5-4-1': ['GK', 'LB', 'CB', 'CB', 'CB', 'RB', 'LM', 'CM', 'CM', 'RM', 'ST'],
  // attacking / specialty
  '3-4-3-diamond': ['GK', 'CB', 'CB', 'CB', 'CDM', 'LM', 'RM', 'CAM', 'LW', 'ST', 'RW'],
  '4-2-4': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'LW', 'ST', 'ST', 'RW'],
  '4-2-2-2': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'CAM', 'ST', 'ST'],
  '4-5-1': ['GK', 'LB', 'CB', 'CB', 'RB', 'LM', 'CDM', 'CM', 'CM', 'RM', 'ST'],
  '3-3-3-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'RM', 'CAM', 'LW', 'RW', 'ST'],
  '3-6-1': ['GK', 'CB', 'CB', 'CB', 'LM', 'CDM', 'CDM', 'CM', 'CM', 'RM', 'ST'],
  '4-2-1-3': ['GK', 'LB', 'CB', 'CB', 'RB', 'CDM', 'CDM', 'CAM', 'LW', 'ST', 'RW'],
}

/**
 * ชื่อแสดงผลครบทุกฟอเมชั่น (รหัสแผน + ชื่อไทย)
 */
export const FORMATION_LABEL_TH: Record<FormationId, string> = {
  '4-4-2': '4-4-2 Flat · คลาสสิกแนวราบ',
  '4-4-2-diamond': '4-4-2 Diamond · เพชรแคบกลาง',
  '4-3-3': '4-3-3 DM · พิมพ์เขียวโมเดิร์น',
  '4-3-3-false9': '4-3-3 False 9 · หน้าเป้าดึงลง',
  '4-2-3-1': '4-2-3-1 Double Pivot · สองตัวค้ำกลาง',
  '4-1-4-1': '4-1-4-1 Low Block · บล็อกต่ำสวนกลับ',
  '4-3-2-1': '4-3-2-1 Christmas Tree · ทรงต้นคริสต์มาส',
  '3-5-2': '3-5-2 · คลาสสิกอิตาลี',
  '3-4-3': '3-4-3 Flat · กดแดนบนแนวราบ',
  '3-4-2-1': '3-4-2-1 · โมเดิร์นสามแผงหลัง',
  '3-1-4-2': '3-1-4-2 · บิลด์ผ่านตัวค้ำ',
  '5-3-2': '5-3-2 Bus · รถบัสเน้นผล',
  '5-4-1': '5-4-1 Ultra Defensive · ตั้งรับแน่นสุด',
  '3-4-3-diamond': '3-4-3 Diamond · ครองบอลเต็มรูปแบบ',
  '4-2-4': '4-2-4 · คลาสสิกบราซิล',
  '4-2-2-2': '4-2-2-2 Magic Rectangle · สี่เหลี่ยมวิเศษ',
  '4-5-1': '4-5-1 · กองกลางหนาแน่น',
  '3-3-3-1': '3-3-3-1 Bielsa · กดสูงตลอด',
  '3-6-1': '3-6-1 Overload · ถมกลางครองบอล',
  '4-2-1-3': '4-2-1-3 Attacking · 4-3-3 โจมตี',
}

/** ชื่อสั้นบนปุ่ม (รหัส + ฉายา) */
export const FORMATION_LABEL_SHORT: Record<FormationId, string> = {
  '4-4-2': '4-4-2 Flat',
  '4-4-2-diamond': '4-4-2 Diamond',
  '4-3-3': '4-3-3 DM',
  '4-3-3-false9': '4-3-3 False 9',
  '4-2-3-1': '4-2-3-1 Pivot',
  '4-1-4-1': '4-1-4-1 Low Block',
  '4-3-2-1': '4-3-2-1 Tree',
  '3-5-2': '3-5-2 Italia',
  '3-4-3': '3-4-3 Flat',
  '3-4-2-1': '3-4-2-1 Modern',
  '3-1-4-2': '3-1-4-2 DM',
  '5-3-2': '5-3-2 Bus',
  '5-4-1': '5-4-1 Ultra',
  '3-4-3-diamond': '3-4-3 Diamond',
  '4-2-4': '4-2-4 Brasil',
  '4-2-2-2': '4-2-2-2 Magic',
  '4-5-1': '4-5-1 Dense',
  '3-3-3-1': '3-3-3-1 Bielsa',
  '3-6-1': '3-6-1 Overload',
  '4-2-1-3': '4-2-1-3 Attack',
}

/** รายการฟอเมชั่นทั้งหมด 20 แบบ */
export const ALL_FORMATIONS: FormationId[] = [
  '4-4-2',
  '4-4-2-diamond',
  '4-3-3',
  '4-3-3-false9',
  '4-2-3-1',
  '4-1-4-1',
  '4-3-2-1',
  '3-5-2',
  '3-4-3',
  '3-4-2-1',
  '3-1-4-2',
  '5-3-2',
  '5-4-1',
  '3-4-3-diamond',
  '4-2-4',
  '4-2-2-2',
  '4-5-1',
  '3-3-3-1',
  '3-6-1',
  '4-2-1-3',
]

export function isFormationId(v: string): v is FormationId {
  return (ALL_FORMATIONS as string[]).includes(v)
}

export function normalizeFormationId(v: string | undefined | null): FormationId {
  if (v && isFormationId(v)) return v
  return '4-3-3'
}

export function formationLabel(id: string | null | undefined, short = false): string {
  const f = normalizeFormationId(id ?? undefined)
  return short ? FORMATION_LABEL_SHORT[f] : FORMATION_LABEL_TH[f]
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