import type { AgentStyle, Player } from './types'

export const AGENT_STYLE_LABEL: Record<AgentStyle, string> = {
  greedy: 'โลภ',
  loyal: 'ซื่อสัตย์',
  aggressive: 'กดดัน',
  balanced: 'สมดุล',
}

export const AGENT_STYLE_DESC: Record<AgentStyle, string> = {
  greedy: 'ขอค่าเหนื่อย/ค่าเอเยนต์สูง · walk ง่าย',
  loyal: 'เจรจายืดหยุ่น · ค่าเอเยนต์ต่ำกว่า',
  aggressive: 'ขอปีสัญญายาว · ขึ้น ask เร็ว',
  balanced: 'มาตรฐานตลาด',
}

/** สุ่มบุคลิกเอเยนต์จาก id นักเตะ (คงที่ต่อเซฟ) */
export function agentStyleFor(player: Pick<Player, 'id' | 'overall' | 'mediaHandling' | 'agentStyle'>): AgentStyle {
  if (player.agentStyle) return player.agentStyle
  const n = player.id.split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const roll = (n + (player.overall ?? 70) * 3 + (player.mediaHandling ?? 10)) % 100
  if (roll < 22) return 'greedy'
  if (roll < 42) return 'loyal'
  if (roll < 62) return 'aggressive'
  return 'balanced'
}

export function agentAskMul(style: AgentStyle): number {
  if (style === 'greedy') return 1.08
  if (style === 'loyal') return 0.96
  if (style === 'aggressive') return 1.04
  return 1
}

export function agentFeeMul(style: AgentStyle): number {
  if (style === 'greedy') return 1.25
  if (style === 'loyal') return 0.85
  if (style === 'aggressive') return 1.1
  return 1
}

export function agentWalkHarder(style: AgentStyle): boolean {
  return style === 'greedy' || style === 'aggressive'
}
