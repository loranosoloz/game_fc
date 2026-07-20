import investorsData from '@/data/investorGroups.json'
import type {
  GameSave,
  InvestorGroup,
  InvestorStyle,
  OwnerPersonality,
  TakeoverOffer,
  TakeoverState,
  TakeoverVerdict,
} from './types'
import { ensureBoard } from './board'
import { ensureFanState } from './fans'
import { ensureOwner, OWNER_PERSONALITY_LABEL, createOwnerState } from './owner'
import { clearInsolvencyAfterTakeover } from './insolvency'

const INVESTORS = investorsData as InvestorGroup[]

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

export function createTakeoverState(season = 2026): TakeoverState {
  return {
    offers: [],
    lastDealNote: null,
    coolDownUntilMatchday: -1,
    marketInterest: 12,
    history: [],
    lastApproachSeason: -1,
    /** ปีแรกมีสิทธิ์เข้า — แต่ยังสุ่มจังหวะหน้าต่างกลางฤดูกาล */
    nextEligibleSeason: season,
    strugglingSeasons: 0,
    lastSeasonReviewed: -1,
    approachedThisSeason: false,
    cadenceSeason: season,
  }
}

export function ensureTakeover(save: GameSave): TakeoverState {
  const t = save.takeover
  const fresh = createTakeoverState(save.season)
  if (!t) return fresh
  let next: TakeoverState = {
    ...fresh,
    ...t,
    offers: t.offers ?? [],
    history: t.history ?? [],
    coolDownUntilMatchday: t.coolDownUntilMatchday ?? -1,
    marketInterest: t.marketInterest ?? 12,
    lastApproachSeason: t.lastApproachSeason ?? -1,
    nextEligibleSeason: t.nextEligibleSeason ?? save.season,
    strugglingSeasons: t.strugglingSeasons ?? 0,
    lastSeasonReviewed: t.lastSeasonReviewed ?? -1,
    approachedThisSeason: t.approachedThisSeason ?? false,
    cadenceSeason: t.cadenceSeason ?? save.season,
  }
  // ปีใหม่ → รีเซ็ตรอบเข้าปีนี้
  if (next.cadenceSeason !== save.season) {
    next = {
      ...next,
      cadenceSeason: save.season,
      approachedThisSeason: false,
    }
  }
  return next
}

export function getInvestor(id: string): InvestorGroup | undefined {
  return INVESTORS.find((g) => g.id === id)
}

export function listInvestors(): InvestorGroup[] {
  return INVESTORS
}

export const INVESTOR_STYLE_FAN_BIAS: Record<
  InvestorStyle,
  { ultras: number; soft: number; casual: number; corporate: number; international: number }
> = {
  private_equity: { ultras: -18, soft: -8, casual: -6, corporate: 12, international: -4 },
  billionaire_toy: { ultras: -4, soft: 2, casual: 4, corporate: 6, international: 10 },
  consortium: { ultras: -2, soft: 2, casual: 3, corporate: 8, international: 2 },
  fan_ownership: { ultras: 14, soft: 12, casual: 10, corporate: -6, international: -2 },
  oil_state: { ultras: -12, soft: -4, casual: 0, corporate: 10, international: 8 },
  tech_mogul: { ultras: -2, soft: 4, casual: 6, corporate: 8, international: 12 },
  heritage: { ultras: 8, soft: 10, casual: 6, corporate: 0, international: -4 },
  sportswashing: { ultras: -22, soft: -10, casual: -8, corporate: 6, international: 4 },
  local_pride: { ultras: 10, soft: 14, casual: 8, corporate: -2, international: -6 },
  sovereign_fund: { ultras: -8, soft: -2, casual: 2, corporate: 10, international: 6 },
}

function clubValuation(save: GameSave): number {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const squad = save.players.filter((p) => p.clubId === club.id)
  const squadValue = squad.reduce((s, p) => s + p.overall ** 2 * 800, 0)
  const stadium = club.stadiumCapacity * 4500
  const rep = club.reputation * 180_000
  const cash = Math.max(0, club.balance) * 0.4
  return Math.round(squadValue * 0.35 + stadium + rep + cash)
}

function personalitySellerBias(personality: OwnerPersonality, style: InvestorStyle): number {
  const map: Partial<Record<OwnerPersonality, Partial<Record<InvestorStyle, number>>>> = {
    frugal: { private_equity: 12, consortium: 8, fan_ownership: -4, oil_state: 6 },
    local_hero: {
      local_pride: 18,
      heritage: 14,
      fan_ownership: 16,
      oil_state: -20,
      sportswashing: -22,
      private_equity: -14,
    },
    glory_hunter: {
      oil_state: 14,
      billionaire_toy: 12,
      sovereign_fund: 10,
      fan_ownership: -10,
      local_pride: -6,
    },
    ambitious: {
      oil_state: 10,
      tech_mogul: 8,
      billionaire_toy: 8,
      private_equity: -4,
    },
    patient: { consortium: 8, heritage: 6, sovereign_fund: 6, private_equity: -6 },
    meddling: { billionaire_toy: 6, tech_mogul: 4, fan_ownership: -8 },
  }
  return map[personality]?.[style] ?? 0
}

export function evaluateTakeoverOffer(
  save: GameSave,
  investor: InvestorGroup,
  opts?: { bid?: number; investment?: number; keepManager?: boolean },
): Omit<TakeoverOffer, 'id' | 'issuedMatchday' | 'expiresMatchday' | 'status' | 'managerAdvice'> {
  const owner = ensureOwner(save)
  const board = ensureBoard(save)
  const fans = ensureFanState(save.fans)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const value = clubValuation(save)
  const bid = opts?.bid ?? Math.round(value * (0.85 + investor.ambition / 400 + Math.random() * 0.2))
  const promisedInvestment = opts?.investment ?? Math.round(investor.capital * (0.18 + investor.ambition / 500))
  const keepManager = opts?.keepManager ?? Math.random() > 0.35

  const sellerReasons: string[] = []
  const buyerReasons: string[] = []
  const fanReasons: string[] = []
  const boardReasons: string[] = []

  // ——— Seller (เจ้าของปัจจุบัน) ———
  let seller = 40
  if (owner.takeoverHeat >= 70) {
    seller += 18
    sellerReasons.push(`เทคโอเวอร์ฮีทสูง (${owner.takeoverHeat}) — เจ้าของเริ่มเปิดทางขาย`)
  } else if (owner.takeoverHeat >= 45) {
    seller += 8
    sellerReasons.push('มีข่าวลือตลาด — เจ้าของรับฟังข้อเสนอ')
  } else {
    seller -= 12
    sellerReasons.push('ฮีทยังต่ำ — เจ้าของไม่รีบขาย')
  }

  if (owner.warChest < 3_000_000) {
    seller += 14
    sellerReasons.push('War chest ใกล้หมด — ขายอาจเป็นทางออก')
  }

  const inv = save.insolvency
  if (inv?.stage === 'administration') {
    seller += 22
    sellerReasons.push('สโมสรอยู่ใน Administration — เจ้าของเปิดทางขายแรง')
  } else if (inv?.stage === 'liquidity_crisis') {
    seller += 12
    sellerReasons.push('วิกฤตสภาพคล่อง — เจ้าของรับฟังดีลกู้คลับ')
  } else if (owner.warChest > 20_000_000) {
    seller -= 8
    sellerReasons.push('ยังมีเงินสำรอง — ไม่จำเป็นต้องขาย')
  }

  if (club.balance < 0) {
    seller += 16
    sellerReasons.push(`คลับติดลบ €${Math.abs(club.balance).toLocaleString('th-TH')}`)
  } else if (club.balance > 15_000_000) {
    seller -= 6
    sellerReasons.push('สภาพคล่องดี — ไม่ใช่แรงกดดันให้ขาย')
  }

  if (owner.patience < 35) {
    seller += 10
    sellerReasons.push('เจ้าของเหนื่อย/หมดอดทน')
  }
  if (owner.relationship < 30) {
    seller += 6
    sellerReasons.push('สัมพันธ์กับผู้จัดการแตก — อยากรีเซ็ตโครงสร้าง')
  }

  const struggleYears = ensureTakeover(save).strugglingSeasons
  if (struggleYears >= 3) {
    seller += 22
    sellerReasons.push(`ทีมย่ำแย่ติดต่อกัน ${struggleYears} ปี — เจ้าของอยากขายออก`)
  } else if (struggleYears >= 2) {
    seller += 14
    sellerReasons.push(`ผลงานแย่ติด ${struggleYears} ปี — เริ่มเปิดทางขาย`)
  } else if (struggleYears >= 1) {
    seller += 5
    sellerReasons.push('ปีที่แล้วไม่สวย — รับฟังตลาดบ้าง')
  }

  const bidRatio = bid / Math.max(1, value)
  if (bidRatio >= 1.15) {
    seller += 16
    sellerReasons.push(`ราคาดี (${Math.round(bidRatio * 100)}% ของมูลค่าประเมิน)`)
  } else if (bidRatio >= 0.95) {
    seller += 6
    sellerReasons.push('ราคาใกล้เคียงมูลค่าประเมิน')
  } else if (bidRatio < 0.8) {
    seller -= 18
    sellerReasons.push(`ราคาต่ำเกินไป (${Math.round(bidRatio * 100)}% ของมูลค่า)`)
  }

  const persBias = personalitySellerBias(owner.personality, investor.style)
  seller += persBias
  if (persBias >= 10) {
    sellerReasons.push(
      `${OWNER_PERSONALITY_LABEL[owner.personality]} เข้ากับสไตล์ ${investor.styleLabel}`,
    )
  } else if (persBias <= -10) {
    sellerReasons.push(
      `${OWNER_PERSONALITY_LABEL[owner.personality]} ไม่ชอบสไตล์ ${investor.styleLabel}`,
    )
  }

  // ——— Buyer (กลุ่มทุน) ———
  let buyer = 38
  if (club.reputation >= investor.prefersRepMin && club.reputation <= investor.prefersRepMax) {
    buyer += 16
    buyerReasons.push(
      `ชื่อเสียงคลับ ${club.reputation} อยู่ในช่วงที่กลุ่มสนใจ (${investor.prefersRepMin}–${investor.prefersRepMax})`,
    )
  } else if (club.reputation < investor.prefersRepMin) {
    buyer -= 14
    buyerReasons.push(`คลับเล็กเกินไปสำหรับ ${investor.name} (ต้องการชื่อเสียง ≥ ${investor.prefersRepMin})`)
  } else {
    buyer -= 8
    buyerReasons.push('คลับใหญ่/แพงเกินโปรไฟล์กลุ่มทุนนี้ — เสี่ยงจ่ายเกิน')
  }

  if (promisedInvestment <= investor.capital * 0.45) {
    buyer += 6
    buyerReasons.push('เงินฉีดที่สัญญาอยู่ในวิสัยทุน')
  } else {
    buyer -= 10
    buyerReasons.push('สัญญาฉีดเงินหนัก — กลุ่มทุนลังเล')
  }

  if (club.balance < -2_000_000) {
    buyer -= 8
    buyerReasons.push('หนี้คลับทำให้ต้นทุนเทคโอเวอร์สูง')
  } else if (owner.takeoverHeat >= 60) {
    buyer += 10
    buyerReasons.push('เจ้าของดูพร้อมขาย — โอกาสปิดดีล')
  }

  if (investor.ambition >= 70 && club.reputation >= 60) {
    buyer += 8
    buyerReasons.push('กลุ่มทะเยอทะยานมองคลับนี้เป็นฐานล่าถ้วย')
  }
  if (bidRatio > 1.25) {
    buyer -= 12
    buyerReasons.push('ต้องจ่ายพรีเมียมสูง — ROI ไม่สวย')
  } else if (bidRatio < 0.9 && club.reputation >= investor.prefersRepMin) {
    buyer += 10
    buyerReasons.push('ได้ของถูกกว่ามูลค่า — น่าสนใจ')
  }

  buyerReasons.push(`${investor.origin} · ${investor.note}`)

  // ——— Fans ———
  let fan = 50
  const bias = INVESTOR_STYLE_FAN_BIAS[investor.style]
  const fac = fans.factions
  const weighted =
    (bias.ultras * fac.ultras +
      bias.soft * fac.soft +
      bias.casual * fac.casual +
      bias.corporate * fac.corporate +
      bias.international * fac.international) /
    500
  fan += weighted

  if (bias.ultras <= -15 && fac.ultras >= 60) {
    fanReasons.push('Ultras ต่อต้านสไตล์ทุนนี้แรง — ความเสี่ยงประท้วง')
  }
  if (bias.soft >= 10 && fac.soft >= 55) {
    fanReasons.push('แฟนซอฟต์/ครอบครัวเปิดรับกลุ่มนี้')
  }
  if (bias.international >= 8 && fac.international >= 55) {
    fanReasons.push('แฟนต่างชาติชอบภาพลักษณ์ทุนข้ามชาติ')
  }
  if (bias.corporate >= 8 && fac.corporate >= 55) {
    fanReasons.push('คอร์ปมองว่าเป็นดีลธุรกิจสมเหตุสมผล')
  }
  if (investor.reputation >= 70) {
    fan += 8
    fanReasons.push(`ภาพลักษณ์กลุ่มทุนดี (${investor.reputation}/100)`)
  } else if (investor.reputation <= 35) {
    fan -= 12
    fanReasons.push(`ภาพลักษณ์กลุ่มทุนแย่ (${investor.reputation}/100)`)
  }
  if (promisedInvestment >= 8_000_000) {
    fan += 6
    fanReasons.push('สัญญาฉีดเงินชัด — แฟนทั่วไปอาจยอมแลก')
  }
  if (fans.protestActive) {
    fan -= 6
    fanReasons.push('ตอนนี้แฟนประท้วงอยู่แล้ว — ดีลผิดฝั่งจะระเบิด')
  }
  if (fanReasons.length === 0) fanReasons.push('แฟนยังไม่มีจุดยืนชัด — รอรายละเอียดดีล')

  // ——— Board ———
  let boardScore = 45
  if (promisedInvestment >= 5_000_000) {
    boardScore += 12
    boardReasons.push('บอร์ดชอบเงินฉีดเข้าโครงสร้าง')
  }
  if (keepManager) {
    boardScore += 8
    boardReasons.push('สัญญารักษาผู้จัดการ — เสถียรภาพ')
  } else {
    boardScore -= 10
    boardReasons.push('กลุ่มทุนไม่การันตีเก้าอี้ผู้จัดการ')
  }
  if (club.balance < 0) {
    boardScore += 10
    boardReasons.push('บอร์ดต้องการเจ้าของใหม่ช่วยพยุงงบ')
  }
  if (investor.style === 'private_equity') {
    boardScore -= 6
    boardReasons.push('กังวล PE จะตัดงบระยะยาว')
  }
  if (investor.style === 'fan_ownership' || investor.style === 'heritage') {
    boardScore += 4
    boardReasons.push('ภาพลักษณ์เสถียรกับชุมชน')
  }
  if (board.confidence < 35) {
    boardScore += 6
    boardReasons.push('บอร์ดวิกฤต — เปิดรับการเปลี่ยนโครงสร้าง')
  }

  seller = clamp(seller)
  buyer = clamp(buyer)
  fan = clamp(fan)
  boardScore = clamp(boardScore)

  // ต้องผ่านทั้งคู่ — ไม่ใช่แค่คะแนนรวม
  const bothWilling = seller >= 52 && buyer >= 52
  const fanOk = fan >= 40
  const overall = clamp(
    seller * 0.32 + buyer * 0.32 + fan * 0.22 + boardScore * 0.14 + (bothWilling ? 6 : -10) + (fanOk ? 0 : -8),
  )

  let verdict: TakeoverVerdict = 'fair'
  if (!bothWilling || overall < 38 || fan < 28) verdict = 'toxic'
  else if (overall >= 68 && fan >= 55 && bothWilling) verdict = 'attractive'
  else if (overall < 48 || fan < 42) verdict = 'risky'
  else verdict = 'fair'

  const conditions = [
    keepManager ? 'รักษากรอบผู้จัดการปัจจุบัน' : 'ไม่การันตีเก้าอี้ผู้จัดการ',
    `ฉีดเงินเข้าคลับ ~€${promisedInvestment.toLocaleString('th-TH')}`,
    investor.style === 'private_equity' ? 'อาจทบทวนค่าจ้าง/ขายส่วนเกิน' : null,
    investor.style === 'fan_ownership' ? 'จำกัดหนี้ใหม่ · เน้นชุมชน' : null,
  ]
    .filter(Boolean)
    .join(' · ')

  return {
    investorId: investor.id,
    investorName: investor.name,
    investorStyle: investor.style,
    investorOrigin: investor.origin,
    bid,
    promisedInvestment,
    keepManager,
    conditions,
    sellerScore: seller,
    buyerScore: buyer,
    fanScore: fan,
    boardScore,
    overallScore: overall,
    verdict,
    reasons: {
      seller: sellerReasons.slice(0, 5),
      buyer: buyerReasons.slice(0, 5),
      fans: fanReasons.slice(0, 5),
      board: boardReasons.slice(0, 5),
    },
  }
}

function styleToPersonality(style: InvestorStyle): OwnerPersonality {
  switch (style) {
    case 'oil_state':
    case 'sovereign_fund':
    case 'billionaire_toy':
      return 'glory_hunter'
    case 'private_equity':
      return 'frugal'
    case 'fan_ownership':
    case 'local_pride':
    case 'heritage':
      return 'local_hero'
    case 'tech_mogul':
      return 'ambitious'
    case 'consortium':
      return 'patient'
    case 'sportswashing':
      return 'meddling'
    default:
      return 'ambitious'
  }
}

/** สุ่มระยะห่างรอบถัดไป: ส่วนใหญ่ปีละครั้ง · บางที 2–3 ปี */
function rollNextInterval(strugglingSeasons: number): number {
  if (strugglingSeasons >= 3) return 1
  if (strugglingSeasons >= 2) {
    const r = Math.random()
    return r < 0.7 ? 1 : 2
  }
  const r = Math.random()
  if (r < 0.55) return 1
  if (r < 0.85) return 2
  return 3
}

function humanLeagueRank(save: GameSave): number {
  const table = save.table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
  const idx = table.findIndex((r) => r.clubId === save.humanClubId)
  return idx >= 0 ? idx + 1 : 20
}

function isStrugglingSeason(save: GameSave): boolean {
  const board = ensureBoard(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const rank = humanLeagueRank(save)
  const missedTarget = rank > board.targetMaxRank + 3
  const bottomHalf = rank >= Math.ceil(save.table.length * 0.65)
  const broke = club.balance < -1_500_000
  const fansAngry = save.fans.mood < 35
  return missedTarget || (bottomHalf && (broke || fansAngry || board.confidence < 40))
}

function generateInvestorOffer(save: GameSave, preferStrong = false): TakeoverOffer | null {
  const candidates = INVESTORS.map((inv) => ({
    inv,
    ev: evaluateTakeoverOffer(save, inv),
  }))
    .filter((c) => c.ev.buyerScore >= 45 && c.ev.sellerScore >= 32)
    .sort((a, b) => b.ev.overallScore - a.ev.overallScore)

  if (!candidates.length) return null

  const pick =
    candidates[Math.floor(Math.random() * Math.min(preferStrong ? 5 : 8, candidates.length))] ??
    candidates[0]
  const useToxic = !preferStrong && Math.random() < 0.18 && candidates.length > 3
  const chosen = useToxic
    ? candidates[candidates.length - 1 - Math.floor(Math.random() * 3)] ?? pick
    : pick

  return {
    id: uid('to'),
    ...chosen.ev,
    issuedMatchday: save.matchday,
    expiresMatchday: save.matchday + 5,
    status: 'open',
    managerAdvice: null,
  }
}

/**
 * จังหวะกลุ่มทุน:
 * - ปีละไม่เกิน 1 รอบ (หน้าต่างกลางฤดูกาล หรือปลายฤดูกาล)
 * - หลังเข้ามาแล้ว รอรอบถัดไป 1 / 2 / 3 ปี (สุ่ม)
 * - ถ้าทีมย่ำแย่ 2–3 ปีติด → โอกาสขาย/เข้ามาสูงขึ้น แม้ยังไม่ครบรอบปกติ
 */
export function scanTakeoverMarket(save: GameSave): GameSave {
  let takeover = ensureTakeover(save)
  const owner = ensureOwner(save)
  let inbox = save.inbox
  let ownerNext = owner

  let offers = takeover.offers.map((o) => {
    if (o.status === 'open' && save.matchday > o.expiresMatchday) {
      return { ...o, status: 'expired' as const }
    }
    return o
  })

  // —— ปลายฤดูกาล: นับปีที่ย่ำแย่ ——
  if (save.seasonComplete && takeover.lastSeasonReviewed !== save.season) {
    const bad = isStrugglingSeason(save)
    const strugglingSeasons = bad ? takeover.strugglingSeasons + 1 : 0
    takeover = {
      ...takeover,
      lastSeasonReviewed: save.season,
      strugglingSeasons,
      marketInterest: clamp(
        takeover.marketInterest + (bad ? 8 + strugglingSeasons * 4 : -6),
      ),
    }
    if (bad) {
      ownerNext = {
        ...ownerNext,
        takeoverHeat: clamp(ownerNext.takeoverHeat + 6 + strugglingSeasons * 4),
        lastNote:
          strugglingSeasons >= 2
            ? `ผลงานย่ำแย่ปีที่ ${strugglingSeasons} — ตลาดทุนเริ่มจับตา`
            : `${ownerNext.name} กังวลผลปลายฤดูกาล`,
      }
      inbox = [
        {
          id: uid('msg-struggle'),
          date: save.currentDate,
          title: 'ปลายฤดูกาล · สัญญาณตลาด',
          body:
            strugglingSeasons >= 2
              ? `ทีมย่ำแย่/ติดหล่มมา ${strugglingSeasons} ปี — โอกาสมีกลุ่มทุนเข้ามาสูงขึ้น`
              : 'ฤดูกาลนี้ไม่ถึงเป้า — ถ้าแย่ต่อเนื่องอีก 1–2 ปี ตลาดอาจสนใจเทคโอเวอร์',
          read: false,
        },
        ...inbox,
      ].slice(0, 40)
    } else if (takeover.strugglingSeasons > 0) {
      inbox = [
        {
          id: uid('msg-ok-season'),
          date: save.currentDate,
          title: 'ปลายฤดูกาล',
          body: 'ผลงานพอยอมรับได้ — ความกดดันขายทีมผ่อนลง',
          read: false,
        },
        ...inbox,
      ].slice(0, 40)
    }
  }

  const openCount = offers.filter((o) => o.status === 'open').length
  const onCooldown = save.matchday < takeover.coolDownUntilMatchday
  const eligibleYear = save.season >= takeover.nextEligibleSeason
  const strugglePush = takeover.strugglingSeasons >= 2
  const struggleForce = takeover.strugglingSeasons >= 3

  // หน้าต่างปีละครั้ง: กลางฤดูกาล MD 12–16 หรือปลายฤดูกาลถ้ายังไม่เคยมา
  const midWindow = save.matchday >= 12 && save.matchday <= 16
  const endWindow = save.seasonComplete && !takeover.approachedThisSeason
  const inWindow = midWindow || endWindow || (strugglePush && save.matchday >= 10 && save.matchday <= 20)

  const canApproach =
    !onCooldown &&
    !takeover.approachedThisSeason &&
    openCount === 0 &&
    inWindow &&
    (eligibleYear || strugglePush)

  if (canApproach) {
    let chance = eligibleYear ? 0.62 : 0.2
    if (strugglePush) chance = Math.max(chance, 0.78)
    if (struggleForce) chance = Math.max(chance, 0.92)
    if (owner.takeoverHeat >= 70) chance += 0.08
    // ถ้ายังไม่ครบรอบแต่ถูกดันจากย่ำแย่ — ยังสุ่มได้
    if (!eligibleYear && strugglePush) chance = 0.55 + takeover.strugglingSeasons * 0.12

    if (Math.random() < Math.min(0.95, chance)) {
      const saveForEval: GameSave = { ...save, takeover, owner: ownerNext }
      const offer = generateInvestorOffer(saveForEval, strugglePush)
      if (offer) {
        offers = [offer, ...offers]
        // ย่ำแย่หนักอาจได้ข้อเสนอที่ 2
        if (struggleForce && Math.random() < 0.45) {
          const second = generateInvestorOffer(saveForEval, true)
          if (second && second.investorId !== offer.investorId) {
            offers = [offer, second, ...offers.filter((o) => o.id !== offer.id)]
          }
        }

        const interval = rollNextInterval(takeover.strugglingSeasons)
        takeover = {
          ...takeover,
          approachedThisSeason: true,
          lastApproachSeason: save.season,
          nextEligibleSeason: save.season + interval,
          marketInterest: clamp(takeover.marketInterest + 6),
        }
        ownerNext = {
          ...ownerNext,
          lastNote: `มีกลุ่มทุนสนใจรอบปีนี้ · รอบถัดไปประมาณอีก ${interval} ปี`,
        }
        const gapNote =
          interval === 1
            ? 'รอบถัดไปอาจมาปีหน้า'
            : `รอบถัดไปตามจังหวะตลาด อีกประมาณ ${interval} ปี (ถ้าทีมไม่ย่ำแย่ต่อเนื่อง)`
        inbox = [
          {
            id: uid('msg-to'),
            date: save.currentDate,
            title: strugglePush ? 'เทคโอเวอร์ · ทีมย่ำแย่ดึงดูดทุน' : 'ข้อเสนอเทคโอเวอร์ประจำปี',
            body: `${offer.investorName} (${offer.investorOrigin}) สนใจซื้อคลับ · รวม ${offer.overallScore} · ${verdictLabel(offer.verdict)} · ${gapNote}`,
            read: false,
          },
          ...inbox,
        ].slice(0, 40)
      } else {
        // ไม่มีผู้ซื้อที่สมเหตุสมผล — นับว่าผ่านรอบปีนี้แล้วกันสแปม
        takeover = {
          ...takeover,
          approachedThisSeason: true,
          nextEligibleSeason: save.season + rollNextInterval(takeover.strugglingSeasons),
        }
      }
    } else if (midWindow || endWindow) {
      // สุ่มแล้วไม่มาปีนี้ → เลื่อนรอบ
      takeover = {
        ...takeover,
        approachedThisSeason: true,
        nextEligibleSeason: save.season + rollNextInterval(takeover.strugglingSeasons),
        lastDealNote: 'ปีนี้ยังไม่มีกลุ่มทุนเข้าอย่างเป็นทางการ',
      }
    }
  }

  return {
    ...save,
    owner: ownerNext,
    takeover: {
      ...takeover,
      offers: offers.slice(0, 12),
    },
    inbox,
  }
}

export function verdictLabel(v: TakeoverVerdict): string {
  switch (v) {
    case 'attractive':
      return 'น่าสนใจ'
    case 'fair':
      return 'พอรับได้'
    case 'risky':
      return 'เสี่ยง'
    case 'toxic':
      return 'ไม่สมเหตุสมผล'
  }
}

/** ผู้จัดการให้คำแนะนำ — ไม่ปิดดีลเอง */
export function setTakeoverAdvice(
  save: GameSave,
  offerId: string,
  advice: 'recommend' | 'caution' | 'reject',
): { ok: boolean; save: GameSave; message: string } {
  const takeover = ensureTakeover(save)
  const offers = takeover.offers.map((o) =>
    o.id === offerId && o.status === 'open' ? { ...o, managerAdvice: advice } : o,
  )
  const offer = offers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'open') return { ok: false, save, message: 'ไม่พบข้อเสนอเปิดอยู่' }

  const note =
    advice === 'recommend'
      ? `ผู้จัดการแนะนำรับดีล ${offer.investorName}`
      : advice === 'caution'
        ? `ผู้จัดการขอให้ชั่งน้ำหนักดีล ${offer.investorName}`
        : `ผู้จัดการคัดค้านดีล ${offer.investorName}`

  return {
    ok: true,
    save: {
      ...save,
      takeover: { ...takeover, offers },
      owner: {
        ...ensureOwner(save),
        lastNote: note,
      },
    },
    message: note,
  }
}

/**
 * พยายามปิดดีล — เจ้าของตัดสินจากคะแนน ไม่ใช่ปุ่มขายเลย
 * ต้อง seller+buyer พอมีเหตุผล และแฟนไม่พังยับ
 */
export function attemptTakeoverDeal(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const takeover = ensureTakeover(save)
  const offer = takeover.offers.find((o) => o.id === offerId && o.status === 'open')
  if (!offer) return { ok: false, save, message: 'ไม่พบข้อเสนอ' }
  if (save.matchday > offer.expiresMatchday) {
    return { ok: false, save, message: 'ข้อเสนอหมดอายุแล้ว' }
  }

  const owner = ensureOwner(save)
  const investor = getInvestor(offer.investorId)
  if (!investor) return { ok: false, save, message: 'ไม่พบกลุ่มทุน' }

  // เกณฑ์ขั้นต่ำ — ทั้งคู่ต้องมีเหตุผล
  if (offer.sellerScore < 50) {
    return {
      ok: false,
      save: {
        ...save,
        owner: {
          ...owner,
          lastNote: `${owner.name} ยังไม่พร้อมขาย — คะแนนฝั่งเจ้าของ ${offer.sellerScore}/100`,
        },
        takeover: {
          ...takeover,
          offers: takeover.offers.map((o) =>
            o.id === offerId ? { ...o, status: 'withdrawn' as const } : o,
          ),
        },
      },
      message: `เจ้าของปฏิเสธ — ยังไม่มีเหตุผลพอจะขาย (${offer.sellerScore})`,
    }
  }
  if (offer.buyerScore < 50) {
    return {
      ok: false,
      save: {
        ...save,
        takeover: {
          ...takeover,
          offers: takeover.offers.map((o) =>
            o.id === offerId ? { ...o, status: 'withdrawn' as const } : o,
          ),
          lastDealNote: `${offer.investorName} ถอนข้อเสนอ — ไม่คุ้มลงทุน`,
        },
        inbox: [
          {
            id: uid('msg-to-out'),
            date: save.currentDate,
            title: 'กลุ่มทุนถอนข้อเสนอ',
            body: `${offer.investorName} มองว่าดีลไม่คุ้ม (คะแนนผู้ซื้อ ${offer.buyerScore})`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
      message: `กลุ่มทุนถอนตัว — ยังไม่มีเหตุผลพอจะซื้อ (${offer.buyerScore})`,
    }
  }
  if (offer.verdict === 'toxic' || offer.fanScore < 30) {
    return {
      ok: false,
      save: {
        ...save,
        board: {
          ...ensureBoard(save),
          confidence: clamp(ensureBoard(save).confidence - 4),
          lastNote: 'บอร์ดบล็อกดีลtoxic — กลัวแฟนลุกฮือ',
        },
        fans: {
          ...ensureFanState(save.fans),
          protestActive: true,
          lastEvent: `ข่าวลือขายให้ ${offer.investorName} ทำให้แฟนเดือด`,
        },
        takeover: {
          ...takeover,
          offers: takeover.offers.map((o) =>
            o.id === offerId ? { ...o, status: 'rejected' as const } : o,
          ),
        },
      },
      message: 'ดีลไม่ผ่าน — แฟน/บอร์ดมองว่าไม่สมเหตุสมผล',
    }
  }

  // โอกาสปิดสำเร็จ จากคะแนน + คำแนะนำผู้จัดการ
  let chance = 0.2 + offer.overallScore / 200 + offer.sellerScore / 400 + offer.buyerScore / 400
  if (offer.managerAdvice === 'recommend') chance += 0.12
  if (offer.managerAdvice === 'caution') chance -= 0.05
  if (offer.managerAdvice === 'reject') chance -= 0.2
  if (offer.verdict === 'attractive') chance += 0.1
  if (offer.verdict === 'risky') chance -= 0.08
  chance = Math.min(0.88, Math.max(0.08, chance))

  if (Math.random() > chance) {
    return {
      ok: false,
      save: {
        ...save,
        owner: {
          ...owner,
          takeoverHeat: clamp(owner.takeoverHeat + 3),
          lastNote: `${owner.name} ยังไม่เซ็น — ขอเวลาคิดดีล ${offer.investorName}`,
        },
        takeover: {
          ...takeover,
          lastDealNote: 'เจรจายังไม่จบ — เจ้าของยังไม่เซ็น',
        },
      },
      message: 'เจรจายังไม่ปิด — เจ้าของยังลังเล (ไม่ได้ขายเลย)',
    }
  }

  // —— ปิดดีล ——
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const newOwner = {
    ...createOwnerState(club.reputation, save.season * 1000 + save.matchday + investor.id.length),
    name: investor.name.split(' ').slice(0, 2).join(' ') + ' (ประธาน)',
    personality: styleToPersonality(investor.style),
    warChest: Math.round(investor.capital * 0.55),
    relationship: offer.keepManager ? clamp(55 + offer.boardScore / 5) : 42,
    patience: investor.patience,
    takeoverHeat: 5,
    lastNote: `เทคโอเวอร์สำเร็จโดย ${investor.name} · ฉีด €${offer.promisedInvestment.toLocaleString('th-TH')}`,
    lastStadiumVisitMatchday: -99,
    stadiumLogs: [],
    pendingDemand: null,
  }

  const fans = ensureFanState(save.fans)
  const bias = INVESTOR_STYLE_FAN_BIAS[investor.style]
  const moodDelta = Math.round((offer.fanScore - 50) / 4)
  const nextFans = {
    ...fans,
    mood: clamp(fans.mood + moodDelta),
    loyalty: clamp(fans.loyalty + (investor.style === 'fan_ownership' ? 4 : -2)),
    protestActive: offer.fanScore < 42,
    lastEvent: offer.fanScore >= 55
      ? `แฟนส่วนใหญ่ยอมรับเจ้าของใหม่ ${investor.name}`
      : `แฟนแตกเป็นเสี่ยงๆ หลังขายให้ ${investor.name}`,
    lastVerdict: nextFansVerdict(offer),
    factions: {
      ultras: clamp(fans.factions.ultras + Math.round(bias.ultras / 4)),
      soft: clamp(fans.factions.soft + Math.round(bias.soft / 4)),
      casual: clamp(fans.factions.casual + Math.round(bias.casual / 4)),
      corporate: clamp(fans.factions.corporate + Math.round(bias.corporate / 4)),
      international: clamp(fans.factions.international + Math.round(bias.international / 4)),
    },
  }

  const board = ensureBoard(save)
  const clubs = save.clubs.map((c) =>
    c.id === club.id
      ? {
          ...c,
          balance: c.balance + offer.promisedInvestment,
          reputation: Math.min(99, c.reputation + (investor.ambition >= 70 ? 2 : 1)),
        }
      : c,
  )

  const note = `ขายคลับให้ ${investor.name} (${investor.styleLabel}) · บิด €${offer.bid.toLocaleString('th-TH')} · ฉีด €${offer.promisedInvestment.toLocaleString('th-TH')}`

  const closedSave = clearInsolvencyAfterTakeover(
    {
      ...save,
      clubs,
      owner: newOwner,
      fans: nextFans,
      board: {
        ...board,
        confidence: clamp(50 + offer.boardScore / 5),
        publicSupport: offer.keepManager,
        transferFreezeUntil: -1,
        ultimatum: null,
        lowConfidenceStreak: 0,
        lastNote: offer.keepManager
          ? 'บอร์ดชุดใหม่ยืนยันหนุนผู้จัดการต่อ'
          : 'บอร์ดชุดใหม่กำลังประเมินผู้จัดการ',
        sacked: false,
        sackedNote: null,
      },
      takeover: {
        offers: takeover.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'accepted' as const } : o.status === 'open' ? { ...o, status: 'withdrawn' as const } : o,
        ),
        lastDealNote: note,
        coolDownUntilMatchday: save.matchday + 12,
        marketInterest: 8,
        approachedThisSeason: true,
        lastApproachSeason: save.season,
        nextEligibleSeason: save.season + Math.max(2, rollNextInterval(0)),
        strugglingSeasons: 0,
        lastSeasonReviewed: takeover.lastSeasonReviewed ?? save.season,
        cadenceSeason: takeover.cadenceSeason ?? save.season,
        history: [{ matchday: save.matchday, note }, ...takeover.history].slice(0, 10),
      },
      inbox: [
        {
          id: uid('msg-to-ok'),
          date: save.currentDate,
          title: 'เทคโอเวอร์สำเร็จ',
          body: note + (offer.keepManager ? ' · คุณยังคุมทีมต่อ' : ' · เก้าอี้คุณไม่การันตี'),
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
      managerReputation: Math.max(
        0,
        Math.min(100, (save.managerReputation ?? 50) + (offer.keepManager ? 2 : -4)),
      ),
    },
    offer.promisedInvestment,
  )

  return {
    ok: true,
    save: closedSave,
    message: note,
  }
}

function nextFansVerdict(offer: TakeoverOffer): string {
  if (offer.fanScore >= 60) return `ฐานแฟนส่วนใหญ่เปิดรับ ${offer.investorName}`
  if (offer.fanScore >= 45) return `แฟนแบ่งสองฝ่ายเรื่อง ${offer.investorName}`
  return `กระแสต้าน ${offer.investorName} ในอัฒจันทร์`
}

/** ปฏิเสธข้อเสนอชัดเจน */
export function rejectTakeoverOffer(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const takeover = ensureTakeover(save)
  const offer = takeover.offers.find((o) => o.id === offerId && o.status === 'open')
  if (!offer) return { ok: false, save, message: 'ไม่พบข้อเสนอ' }
  const owner = ensureOwner(save)
  return {
    ok: true,
    save: {
      ...save,
      owner: {
        ...owner,
        takeoverHeat: clamp(owner.takeoverHeat - 4),
        relationship: clamp(owner.relationship + (offer.managerAdvice === 'reject' ? 2 : 0)),
        lastNote: `${owner.name} ปฏิเสธข้อเสนอ ${offer.investorName}`,
      },
      takeover: {
        ...takeover,
        offers: takeover.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
        lastDealNote: `ปฏิเสธ ${offer.investorName}`,
      },
    },
    message: `ปฏิเสธดีล ${offer.investorName}`,
  }
}
