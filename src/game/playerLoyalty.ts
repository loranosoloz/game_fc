/**
 * ความภักดีนักเตะต่อสโมสรปัจจุบัน (1–20)
 * กระทบต่อสัญญา · wantAway · เอเยนต์ยื่นขาย · ค่าเหนื่อยต่อสัญญา
 */
import type { GameSave, Player } from './types'
import { isDreamClub } from './playerAmbition'

function clamp(n: number, lo = 1, hi = 20) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function personalityLoyaltyBias(personalityId: string | undefined): number {
  switch (personalityId) {
    case 'model_pro':
      return 2
    case 'unambitious':
      return 3
    case 'balanced':
      return 1
    case 'driven':
      return -2
    case 'wonderkid':
      return -1
    case 'temperamental':
      return -2
    default:
      return 0
  }
}

/** สุ่ม/คำนวณค่าเริ่มต้นเมื่อเข้าสโมสร */
export function seedClubLoyalty(player: Player, clubId: string): number {
  let v = 10 + personalityLoyaltyBias(player.personalityId)
  if (player.isYouth) v += 3
  if (player.squadRole === 'key') v += 1
  if ((player.age ?? 24) >= 30) v += 1
  if ((player.age ?? 24) <= 21) v -= 1
  if ((player.growth?.ambition ?? 10) >= 16) v -= 2
  if ((player.growth?.ambition ?? 10) <= 6) v += 2
  if (isDreamClub(player, clubId)) v += 2
  if (player.wantAway?.active) v -= 4
  return clamp(v)
}

export function ensureClubLoyalty(player: Player): Player {
  const clubId = player.clubId
  if (clubId === '__free__') {
    return {
      ...player,
      clubLoyalty: player.clubLoyalty ?? 8,
      loyaltyClubId: clubId,
    }
  }
  if (
    player.loyaltyClubId === clubId &&
    typeof player.clubLoyalty === 'number' &&
    player.clubLoyalty >= 1
  ) {
    return player
  }
  // ย้ายสโมสร / ยังไม่เคยมี — เริ่มใหม่
  return {
    ...player,
    clubLoyalty: seedClubLoyalty(player, clubId),
    loyaltyClubId: clubId,
  }
}

export function loyaltyLabelTh(loyalty: number): string {
  if (loyalty >= 17) return 'ภักดีมาก'
  if (loyalty >= 14) return 'ภักดี'
  if (loyalty >= 11) return 'ปกติ'
  if (loyalty >= 8) return 'ลังเล'
  if (loyalty >= 5) return 'เริ่มห่าง'
  return 'ไม่ภักดี'
}

/** คูณ ask ตอนต่อสัญญา — ภักดีสูงขอลด */
export function loyaltyRenewWageMul(player: Player): number {
  const L = player.clubLoyalty ?? 10
  if (L >= 17) return 0.92
  if (L >= 14) return 0.96
  if (L <= 5) return 1.08
  if (L <= 7) return 1.04
  return 1
}

/** โอกาส/แรงกดดันอยากย้าย — ภักดีสูงลด */
export function loyaltyWantAwayMul(player: Player): number {
  const L = player.clubLoyalty ?? 10
  if (L >= 16) return 0.35
  if (L >= 13) return 0.55
  if (L <= 5) return 1.45
  if (L <= 8) return 1.2
  return 1
}

/** คะแนนเอเยนต์ยื่นขายออก — ภักดีสูงยื่นยาก */
export function loyaltyApproachPenalty(player: Player): number {
  const L = player.clubLoyalty ?? 10
  if (L >= 16) return -18
  if (L >= 13) return -10
  if (L <= 5) return 12
  if (L <= 8) return 6
  return 0
}

/** โอกาสปฏิเสธต่อสัญญาทันที — ภักดีสูงลด */
export function loyaltyRefuseRenewChanceMul(player: Player): number {
  const L = player.clubLoyalty ?? 10
  if (L >= 15) return 0.25
  if (L >= 12) return 0.55
  if (L <= 6) return 1.5
  return 1
}

export function bumpClubLoyalty(player: Player, delta: number): Player {
  const p = ensureClubLoyalty(player)
  return { ...p, clubLoyalty: clamp((p.clubLoyalty ?? 10) + delta) }
}

/**
 * หลังแมตช์เดย์ — อัปเดตภักดีทั้งลีก (โฟกัสผลต่อ human + เบาๆ ทุกคน)
 */
export function tickClubLoyalty(save: GameSave, humanMatchHint?: {
  won?: boolean
  drawn?: boolean
  playedIds?: Set<string>
  benchedKeyIds?: Set<string>
} | null): GameSave {
  const humanId = save.humanClubId
  const xi = new Set(save.tacticsByClub[humanId]?.startingXi ?? [])
  const played = humanMatchHint?.playedIds ?? xi
  const benchedKey = humanMatchHint?.benchedKeyIds ?? new Set<string>()

  const players = save.players.map((raw) => {
    let p = ensureClubLoyalty(raw)
    if (p.clubId === '__free__') return p

    let delta = 0
    const amb = p.growth?.ambition ?? 10
    const pid = p.personalityId

    // ฐาน: อยู่กับคลับไปเรื่อยๆ ค่อยๆ ขึ้นถ้าไม่ทุกข์
    const happy = p.happiness ?? p.morale ?? 10
    if (happy >= 14) delta += 0.35
    else if (happy <= 7) delta -= 0.6
    else if (happy <= 10) delta -= 0.15

    if (p.clubId === humanId) {
      if (played.has(p.id)) {
        delta += 0.25
        if (humanMatchHint?.won) delta += 0.45
        else if (humanMatchHint?.drawn) delta += 0.1
        else if (humanMatchHint && humanMatchHint.won === false) delta -= 0.15
      } else if (benchedKey.has(p.id) || (p.squadRole === 'key' && !played.has(p.id) && p.injuryDays <= 0)) {
        delta -= 0.7
      }
    } else {
      // AI สโมสร — tick เบา
      if (Math.random() < 0.2) {
        delta += happy >= 12 ? 0.2 : -0.2
      }
    }

    if (p.wantAway?.active) delta -= 0.5
    if (p.refuseContractRenewal) delta -= 0.4
    if (p.transferListed) delta -= 0.35

    // ทะเยอทะยาน + ไม่ใช่ทีมในฝัน → ค่อยๆ กัดภักดี
    if (amb >= 15 && !isDreamClub(p, p.clubId) && (p.overall ?? 70) >= 76) {
      delta -= 0.25
    }
    if (pid === 'model_pro' && happy >= 12) delta += 0.2
    if (pid === 'unambitious') delta += 0.15
    if (pid === 'temperamental' && happy <= 10) delta -= 0.3
    if (p.isYouth && p.clubId === humanId) delta += 0.15

    // สัญญาใจกับสโมสรอื่น
    if (p.secretHandshake && p.secretHandshake.fromClubId !== p.clubId) {
      delta -= 0.8
    }

    if (Math.abs(delta) < 0.05) return p
    // สะสมเศษ — ใช้ round ด้วยความน่าจะเป็นจากเศษ
    const whole = Math.trunc(delta)
    const frac = Math.abs(delta - whole)
    let bump = whole
    if (frac > 0 && Math.random() < frac) bump += delta > 0 ? 1 : -1
    if (bump === 0) return p
    return bumpClubLoyalty(p, bump)
  })

  return { ...save, players }
}

/** หลังย้ายเข้าคลับใหม่ */
export function resetLoyaltyOnTransfer(player: Player, toClubId: string): Player {
  return {
    ...player,
    loyaltyClubId: toClubId,
    clubLoyalty: seedClubLoyalty({ ...player, clubId: toClubId, wantAway: null }, toClubId),
  }
}

export function loyaltyHintsTh(player: Player): string[] {
  const p = ensureClubLoyalty(player)
  const L = p.clubLoyalty ?? 10
  const hints = [`ภักดีต่อสโมสร ${L}/20 (${loyaltyLabelTh(L)})`]
  if (L >= 16) hints.push('ยากจะอยากย้าย · ต่อสัญญาง่ายกว่า')
  else if (L <= 6) hints.push('เสี่ยงอยากย้าย · เอเยนต์อาจยื่นขาย')
  return hints
}
