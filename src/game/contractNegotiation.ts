/**
 * ขอบเขตเจรจาต่อสัญญา: รอบที่ 1–N · จุดติด (ค่าเหนื่อย/ปี/โบนัส)
 * ขึ้นกับนิสัยเอเยนต์ + personality นักเตะ
 */
import type { AgentStyle, ContractFocus, ContractNegotiation, Player } from './types'
import { formatMoney } from '@/lib/format'
import {
  AGENT_STYLE_LABEL,
  agentAskMul,
  agentStyleFor,
  agentWalkHarder,
} from './agents'

export type { ContractFocus } from './types'

export interface ContractBonusOffer {
  signingOnFee?: number
  perAppearance?: number
  perGoal?: number
}

export interface NegotiationProfile {
  maxRounds: number
  /** รับค่าเหนื่อยได้ถ้า ≥ ask × wageFlex */
  wageFlex: number
  yearsStrict: boolean
  wantSigning: boolean
  wantAppearance: boolean
  wantGoalBonus: boolean
  counterWageMul: number
  counterBonusMul: number
  labelTh: string
}

export function negotiationProfile(
  player: Player,
  style: AgentStyle = agentStyleFor(player),
): NegotiationProfile {
  const amb = player.growth?.ambition ?? 10
  const pid = player.personalityId ?? 'balanced'
  const star = player.squadRole === 'key' || player.overall >= 78

  let maxRounds = 3
  if (agentWalkHarder(style)) maxRounds = 2
  if (style === 'loyal') maxRounds = 4
  if (pid === 'temperamental') maxRounds = Math.min(maxRounds, 2)
  if (pid === 'model_pro' || pid === 'unambitious') maxRounds = Math.max(maxRounds, 4)
  if (pid === 'driven') maxRounds = Math.min(maxRounds, 3)

  let wageFlex = 0.97
  if (style === 'loyal') wageFlex = 0.94
  if (style === 'greedy') wageFlex = 0.99
  if (style === 'aggressive') wageFlex = 0.98
  if (pid === 'temperamental') wageFlex = Math.max(wageFlex, 0.985)
  if (pid === 'model_pro') wageFlex = Math.min(wageFlex, 0.95)
  if (pid === 'unambitious') wageFlex = Math.min(wageFlex, 0.92)
  if (pid === 'driven' || pid === 'wonderkid') wageFlex = Math.max(wageFlex, 0.97)

  const wantSigning =
    style === 'greedy' ||
    amb >= 14 ||
    pid === 'driven' ||
    pid === 'wonderkid' ||
    (star && style !== 'loyal')
  const wantAppearance =
    style === 'aggressive' ||
    pid === 'temperamental' ||
    player.squadRole === 'key' ||
    (pid === 'driven' && player.position !== 'GK')
  const wantGoalBonus =
    (pid === 'driven' || pid === 'wonderkid' || style === 'greedy') &&
    player.position !== 'GK' &&
    player.overall >= 74

  const yearsStrict =
    style === 'aggressive' || pid === 'driven' || (amb >= 16 && style !== 'loyal')

  let counterWageMul = 1.04
  if (style === 'greedy') counterWageMul = 1.06
  if (style === 'aggressive') counterWageMul = 1.05
  if (style === 'loyal') counterWageMul = 1.02
  if (pid === 'temperamental') counterWageMul += 0.02

  let counterBonusMul = 1.08
  if (style === 'greedy') counterBonusMul = 1.12
  if (style === 'loyal') counterBonusMul = 1.04

  const personaLabel: Record<string, string> = {
    model_pro: 'มืออาชีพ',
    driven: 'ทะเยอทะยาน',
    balanced: 'สมดุล',
    unambitious: 'ไม่ทะเยอทะยาน',
    temperamental: 'อารมณ์ร้อน',
    wonderkid: 'วันเดอร์คิด',
  }

  return {
    maxRounds: Math.max(1, Math.min(5, maxRounds)),
    wageFlex,
    yearsStrict,
    wantSigning,
    wantAppearance,
    wantGoalBonus,
    counterWageMul,
    counterBonusMul,
    labelTh: `${AGENT_STYLE_LABEL[style]} / ${personaLabel[pid] ?? pid}`,
  }
}

export function seedContractBonusAsks(
  player: Player,
  askWage: number,
  style: AgentStyle = agentStyleFor(player),
): { askSigningOn: number; askPerAppearance: number; askPerGoal: number } {
  const prof = negotiationProfile(player, style)
  const base = Math.max(askWage, player.wage)
  let askSigningOn = 0
  let askPerAppearance = 0
  let askPerGoal = 0

  if (prof.wantSigning) {
    const weeks = style === 'greedy' ? 16 : style === 'loyal' ? 6 : 10
    askSigningOn = Math.round(base * weeks * (player.overall >= 80 ? 1.2 : 1))
  }
  if (prof.wantAppearance) {
    askPerAppearance = Math.round(base * (style === 'aggressive' ? 0.35 : 0.22))
  }
  if (prof.wantGoalBonus) {
    askPerGoal = Math.round(base * (style === 'greedy' ? 0.55 : 0.4))
  }
  return { askSigningOn, askPerAppearance, askPerGoal }
}

export function focusLabelTh(focus: ContractFocus): string {
  switch (focus) {
    case 'wage':
      return 'ค่าเหนื่อย'
    case 'years':
      return 'ระยะสัญญา'
    case 'signing':
      return 'เงินเซ็นสัญญา'
    case 'appearance':
      return 'โบนัสลงแข่ง'
    case 'package':
      return 'แพ็กเกจโบนัส'
  }
}

/** จุดที่ยังไม่ลงตัว ตามลำดับความสำคัญ */
export function findStickingPoints(
  talk: Pick<
    ContractNegotiation,
    'askWage' | 'askYears' | 'askSigningOn' | 'askPerAppearance' | 'askPerGoal'
  >,
  offer: {
    wage: number
    years: number
    signingOnFee: number
    perAppearance: number
    perGoal: number
  },
  prof: NegotiationProfile,
): ContractFocus[] {
  const stuck: ContractFocus[] = []
  if (offer.wage < talk.askWage * prof.wageFlex) stuck.push('wage')
  if (
    prof.yearsStrict &&
    offer.years < talk.askYears &&
    offer.wage < talk.askWage * 1.1
  ) {
    stuck.push('years')
  } else if (offer.years < talk.askYears && offer.wage < talk.askWage * 0.97) {
    stuck.push('years')
  }
  const askSign = talk.askSigningOn ?? 0
  if (askSign > 0 && offer.signingOnFee < askSign * 0.9) stuck.push('signing')
  const askApp = talk.askPerAppearance ?? 0
  if (askApp > 0 && offer.perAppearance < askApp * 0.85) stuck.push('appearance')
  const askGoal = talk.askPerGoal ?? 0
  if (askGoal > 0 && offer.perGoal < askGoal * 0.85) {
    if (!stuck.includes('appearance')) stuck.push('package')
  }
  return stuck
}

export function roundNoteTh(
  round: number,
  maxRounds: number,
  focus: ContractFocus,
  profileLabel: string,
  detail: string,
): string {
  return `รอบ ${round}/${maxRounds} [${profileLabel}] · จุดติด: ${focusLabelTh(focus)} — ${detail}`
}

export function counterAsks(
  talk: ContractNegotiation,
  stuck: ContractFocus[],
  prof: NegotiationProfile,
  round: number,
): Pick<
  ContractNegotiation,
  'askWage' | 'askYears' | 'askSigningOn' | 'askPerAppearance' | 'askPerGoal' | 'focus'
> {
  let askWage = talk.askWage
  let askYears = talk.askYears
  let askSigningOn = talk.askSigningOn ?? 0
  let askPerAppearance = talk.askPerAppearance ?? 0
  let askPerGoal = talk.askPerGoal ?? 0
  const focus = stuck[0] ?? 'wage'

  if (stuck.includes('wage')) {
    askWage = Math.round(askWage * (prof.counterWageMul + round * 0.005))
  }
  if (stuck.includes('years')) {
    askYears = Math.min(5, Math.max(askYears, talk.askYears))
  }
  if (stuck.includes('signing')) {
    askSigningOn = Math.round(askSigningOn * prof.counterBonusMul)
  }
  if (stuck.includes('appearance') || stuck.includes('package')) {
    askPerAppearance = Math.round(askPerAppearance * prof.counterBonusMul)
    if (askPerGoal > 0) askPerGoal = Math.round(askPerGoal * prof.counterBonusMul)
  }

  return { askWage, askYears, askSigningOn, askPerAppearance, askPerGoal, focus }
}

export function stickingDetailTh(
  focus: ContractFocus,
  talk: ContractNegotiation,
): string {
  switch (focus) {
    case 'wage':
      return `ขออย่างน้อย ~${formatMoney(talk.askWage)}/สัปดาห์`
    case 'years':
      return `ขอสัญญาอย่างน้อย ${talk.askYears} ปี`
    case 'signing':
      return `ขอเงินเซ็น ~${formatMoney(talk.askSigningOn ?? 0)}`
    case 'appearance':
      return `ขอโบนัสลงแข่ง ~${formatMoney(talk.askPerAppearance ?? 0)}/นัด`
    case 'package':
      return `ขอโบนัสประตู ~${formatMoney(talk.askPerGoal ?? 0)}/ลูก`
  }
}

export function agentAskWageSeed(player: Player, mulExtra = 1): number {
  const style = agentStyleFor(player)
  const ambitionBump = player.overall >= 78 ? 1.12 : player.overall >= 72 ? 1.06 : 1.02
  return Math.round(player.wage * ambitionBump * agentAskMul(style) * mulExtra)
}
