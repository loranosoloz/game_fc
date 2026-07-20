/**
 * ความดัง · แฟนคลับ / แอนตี้ · ดีลพรีเซ็นเตอร์แบรนด์
 */
import type { GameSave, Player } from './types'
import { ensurePlayerSocial, formatFollowers } from './social'

export type BrandCategory = 'sportswear' | 'watch' | 'auto' | 'beverage' | 'tech' | 'local'

export interface BrandDef {
  id: string
  name: string
  category: BrandCategory
  /** ค่าเหนื่อยรายสัปดาห์ฐาน (€) */
  weeklyPayBase: number
  /** ดัน fame ต่อแมตช์เดย์ */
  famePerWeek: number
  /** OVR ขั้นต่ำโดยประมาณ */
  minOvr: number
  /** followers ขั้นต่ำ */
  minFollowers: number
}

export interface BrandDeal {
  brandId: string
  brandName: string
  category: BrandCategory
  weeklyPay: number
  fameBoost: number
  /** หมดอายุแมตช์เดย์ (ฤดูกาลสะสมประมาณ) */
  untilMatchday: number
  signedMatchday: number
}

export const BRAND_CATALOG: BrandDef[] = [
  { id: 'nike', name: 'Nike', category: 'sportswear', weeklyPayBase: 12_000, famePerWeek: 1.2, minOvr: 78, minFollowers: 200_000 },
  { id: 'adidas', name: 'adidas', category: 'sportswear', weeklyPayBase: 11_000, famePerWeek: 1.1, minOvr: 76, minFollowers: 180_000 },
  { id: 'puma', name: 'PUMA', category: 'sportswear', weeklyPayBase: 6_000, famePerWeek: 0.7, minOvr: 72, minFollowers: 80_000 },
  { id: 'newbalance', name: 'New Balance', category: 'sportswear', weeklyPayBase: 5_500, famePerWeek: 0.65, minOvr: 70, minFollowers: 60_000 },
  { id: 'rolex', name: 'Rolex', category: 'watch', weeklyPayBase: 18_000, famePerWeek: 1.4, minOvr: 84, minFollowers: 500_000 },
  { id: 'tagheuer', name: 'TAG Heuer', category: 'watch', weeklyPayBase: 9_000, famePerWeek: 0.9, minOvr: 78, minFollowers: 250_000 },
  { id: 'mercedes', name: 'Mercedes-Benz', category: 'auto', weeklyPayBase: 14_000, famePerWeek: 1.1, minOvr: 80, minFollowers: 350_000 },
  { id: 'bmw', name: 'BMW', category: 'auto', weeklyPayBase: 12_000, famePerWeek: 1.0, minOvr: 79, minFollowers: 300_000 },
  { id: 'redbull', name: 'Red Bull', category: 'beverage', weeklyPayBase: 8_000, famePerWeek: 1.0, minOvr: 74, minFollowers: 120_000 },
  { id: 'pepsi', name: 'Pepsi', category: 'beverage', weeklyPayBase: 7_000, famePerWeek: 0.8, minOvr: 73, minFollowers: 100_000 },
  { id: 'samsung', name: 'Samsung', category: 'tech', weeklyPayBase: 10_000, famePerWeek: 0.95, minOvr: 77, minFollowers: 200_000 },
  { id: 'ea_sports', name: 'EA Sports', category: 'tech', weeklyPayBase: 9_500, famePerWeek: 1.15, minOvr: 80, minFollowers: 280_000 },
  { id: 'chang', name: 'Chang', category: 'local', weeklyPayBase: 3_500, famePerWeek: 0.5, minOvr: 65, minFollowers: 25_000 },
  { id: 'true', name: 'True', category: 'local', weeklyPayBase: 4_000, famePerWeek: 0.55, minOvr: 66, minFollowers: 30_000 },
  { id: 'gulf', name: 'Gulf', category: 'local', weeklyPayBase: 3_200, famePerWeek: 0.45, minOvr: 64, minFollowers: 20_000 },
]

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function brandById(id: string): BrandDef | undefined {
  return BRAND_CATALOG.find((b) => b.id === id)
}

/** คำนวณ fame เริ่มจาก OVR + followers */
export function seedFame(player: Pick<Player, 'overall' | 'social' | 'age' | 'isYouth'>): number {
  const followers = player.social?.followers ?? 5_000
  const folScore = Math.min(40, Math.log10(Math.max(1_000, followers)) * 8)
  const ovrScore = Math.max(0, (player.overall - 60) * 1.1)
  const ageCut = player.age >= 33 ? -4 : player.isYouth ? -6 : 0
  return clamp(folScore + ovrScore + ageCut, 1, 95)
}

export function ensurePlayerFame(player: Player): Player {
  const social = ensurePlayerSocial(player).social
  const fame =
    typeof player.fame === 'number' ? clamp(player.fame, 0, 100) : seedFame({ ...player, social })
  const fanClub =
    typeof player.fanClubSize === 'number'
      ? Math.max(0, player.fanClubSize)
      : Math.round(social.followers * (0.04 + fame / 800))
  const anti =
    typeof player.antiFanSize === 'number'
      ? Math.max(0, player.antiFanSize)
      : Math.round(social.followers * (0.008 + (100 - (player.mediaHandling ?? 10)) / 900))
  const deals = Array.isArray(player.brandDeals) ? player.brandDeals : []
  return {
    ...player,
    social,
    fame,
    fanClubSize: fanClub,
    antiFanSize: anti,
    brandDeals: deals,
  }
}

export function fameLabelTh(fame: number): string {
  if (fame >= 85) return 'ซูเปอร์สตาร์โลก'
  if (fame >= 70) return 'ดังมาก'
  if (fame >= 55) return 'มีชื่อ'
  if (fame >= 40) return 'เริ่มดัง'
  if (fame >= 25) return 'คนในวงการรู้จัก'
  return 'ยังไม่ค่อยมีคนรู้จัก'
}

export function brandDealsLabelTh(deals: BrandDeal[] | undefined): string {
  if (!deals?.length) return 'ไม่มีดีลแบรนด์'
  return deals.map((d) => d.brandName).join(' · ')
}

/** จำนวนโพสต์ด่าพิ่มเมื่อดังแล้วเล่นห่วย */
export function fameRoastExtra(player: Player, rating: number): number {
  const fame = player.fame ?? seedFame(player)
  if (fame < 45) return 0
  if (rating > 6.2) return 0
  let n = 0
  if (fame >= 55 && rating <= 6) n++
  if (fame >= 70 && rating <= 5.8) n++
  if (fame >= 85 && rating <= 5.5) n++
  // แอนตี้เยอะ = ด่าหนัก
  const anti = player.antiFanSize ?? 0
  const fans = Math.max(1, player.social?.followers ?? 1)
  if (anti / fans > 0.04 && rating <= 6) n++
  return n
}

/** จำนวนชมจากแฟนคลับเมื่อเล่นดี */
export function famePraiseExtra(player: Player, rating: number): number {
  const fame = player.fame ?? seedFame(player)
  if (rating < 7.5) return 0
  let n = 0
  if (fame >= 50 && rating >= 7.8) n++
  if ((player.fanClubSize ?? 0) > 50_000 && rating >= 8) n++
  if (fame >= 75 && rating >= 8.2) n++
  return n
}

function eligibleBrands(player: Player): BrandDef[] {
  const p = ensurePlayerFame(player)
  const followers = p.social.followers
  const owned = new Set((p.brandDeals ?? []).map((d) => d.brandId))
  return BRAND_CATALOG.filter(
    (b) =>
      !owned.has(b.id) &&
      p.overall >= b.minOvr - 2 &&
      followers >= b.minFollowers * 0.7 &&
      (p.fame ?? 0) >= Math.max(20, b.minOvr - 40),
  )
}

function makeDeal(brand: BrandDef, player: Player, matchday: number): BrandDeal {
  const fame = player.fame ?? seedFame(player)
  const payMul = 0.7 + fame / 120 + (player.overall - 70) / 80
  return {
    brandId: brand.id,
    brandName: brand.name,
    category: brand.category,
    weeklyPay: Math.round(brand.weeklyPayBase * Math.max(0.45, payMul)),
    fameBoost: brand.famePerWeek,
    untilMatchday: matchday + 18 + Math.floor(Math.random() * 20),
    signedMatchday: matchday,
  }
}

/**
 * หลังแมตช์เดย์: จ่ายค่าแบรนด์ · หมดอายุ · เสนอดีลใหม่ · ปรับ fame/แฟนคลับ/แอนตี้
 */
export function tickPlayerFameAndBrands(save: GameSave): {
  save: GameSave
  notes: string[]
} {
  const notes: string[] = []
  const humanId = save.humanClubId
  const md = save.matchday

  const players = save.players.map((raw) => {
    let p = ensurePlayerFame(raw)
    let fame = p.fame ?? seedFame(p)
    let fanClub = p.fanClubSize ?? 0
    let anti = p.antiFanSize ?? 0
    let cash = p.cash ?? 0
    let deals = [...(p.brandDeals ?? [])]

    // หมดอายุ
    const expired = deals.filter((d) => d.untilMatchday <= md)
    deals = deals.filter((d) => d.untilMatchday > md)
    if (expired.length && p.clubId === humanId) {
      notes.push(`${p.name} หมดสัญญาพรีเซ็นเตอร์ ${expired.map((d) => d.brandName).join(', ')}`)
    }

    // จ่ายรายสัปดาห์ + fame จากดีล
    let pay = 0
    for (const d of deals) {
      pay += d.weeklyPay
      fame = Math.min(100, fame + d.fameBoost * 0.35)
    }
    cash += pay

    // โตตาม followers / ฟอร์ม
    const fol = p.social.followers
    fame = clamp(
      fame +
        (p.form >= 14 ? 0.4 : p.form <= 7 ? -0.35 : 0.05) +
        (fol > 1_000_000 ? 0.2 : 0),
      0,
      100,
    )

    // แฟนคลับ / แอนตี้ ตาม fame + heat
    const heat = p.social.heat ?? 20
    fanClub = Math.max(
      0,
      Math.round(fanClub * 0.992 + fol * (0.002 + fame / 12_000) + (heat > 60 ? fol * 0.0004 : 0)),
    )
    anti = Math.max(
      0,
      Math.round(
        anti * 0.994 +
          fol * (0.0004 + (100 - (p.mediaHandling ?? 10)) / 25_000) +
          (heat > 70 ? fol * 0.0003 : 0),
      ),
    )

    // เสนอดีลใหม่ (ดาว / ดัง)
    if (deals.length < 3 && (p.overall >= 70 || fame >= 45) && Math.random() < (p.clubId === humanId ? 0.12 : 0.04)) {
      const pool = eligibleBrands({ ...p, fame, brandDeals: deals })
      if (pool.length) {
        const brand = pool[Math.floor(Math.random() * pool.length)]!
        const deal = makeDeal(brand, { ...p, fame }, md)
        deals.push(deal)
        fame = Math.min(100, fame + 2)
        if (p.clubId === humanId) {
          notes.push(
            `${p.name} เป็นพรีเซ็นเตอร์ ${brand.name} (+${formatMoneyShort(deal.weeklyPay)}/สัปดาห์)`,
          )
        }
      }
    }

    // sync followers เล็กน้อยจากแฟนคลับ
    const social = {
      ...p.social,
      followers: Math.max(p.social.followers, Math.round(fanClub * 4 + anti * 2)),
      verified: p.social.verified || fame >= 62 || deals.length >= 2,
    }

    return {
      ...p,
      fame,
      fanClubSize: fanClub,
      antiFanSize: anti,
      brandDeals: deals,
      cash,
      social,
    }
  })

  return { save: { ...save, players }, notes }
}

function formatMoneyShort(n: number): string {
  if (n >= 1_000_000) return `€${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `€${Math.round(n / 1_000)}K`
  return `€${n}`
}

/** หลังเรตติ้งแมตช์ — ปรับ fame / แฟนคลับ / แอนตี้ */
export function applyFameAfterRating(player: Player, rating: number, minutes: number): Player {
  if (minutes < 30) return player
  let p = ensurePlayerFame(player)
  let fame = p.fame ?? 50
  let fanClub = p.fanClubSize ?? 0
  let anti = p.antiFanSize ?? 0
  const fol = p.social.followers

  if (rating >= 8) {
    fame = Math.min(100, fame + 0.6 + (fame >= 70 ? 0.3 : 0))
    fanClub = Math.round(fanClub + fol * 0.0015)
    anti = Math.max(0, Math.round(anti * 0.99))
  } else if (rating <= 5.5) {
    fame = Math.max(0, fame - (fame >= 60 ? 1.1 : 0.4))
    anti = Math.round(anti + fol * (0.001 + fame / 20_000))
    fanClub = Math.max(0, Math.round(fanClub * 0.995))
  } else if (rating <= 6.2 && fame >= 65) {
    // ดังแล้วเล่นกลางๆ ก็โดนแอนตี้จิก
    anti = Math.round(anti + fol * 0.0004)
    fame = Math.max(0, fame - 0.25)
  }

  return { ...p, fame, fanClubSize: fanClub, antiFanSize: anti }
}

export function fanClubHandle(player: Player): string {
  const base = (player.name.split(' ').pop() ?? 'Star').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10)
  return `@${base}FC`
}

export function antiFanHandle(player: Player): string {
  const base = (player.name.split(' ').pop() ?? 'Star').replace(/[^a-zA-Z0-9]/g, '').slice(0, 8)
  return `@Anti${base}`
}
