import agentDb from '@/data/famousAgents.json'
import type { AgentKind, AgentStyle, Player } from './types'

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

export const AGENT_KIND_LABEL: Record<AgentKind, string> = {
  pro: 'เอเยนต์อาชีพ',
  family: 'ครอบครัว / พ่อแม่',
}

type AgentDef = {
  id: string
  name: string
  agency: string
  style: AgentStyle
  note?: string
}

type FamilyOverride = {
  name: string
  agency: string
  style: AgentStyle
  kind: 'family'
}

const AGENTS = ((agentDb.agents ?? []) as AgentDef[]).filter(
  (a): a is AgentDef => !!a && typeof a.name === 'string' && a.name.length > 0,
)
const LINKS = (agentDb.playerLinks ?? {}) as Record<string, string>
const FAMILY_OVERRIDES = (agentDb.familyOverrides ?? {}) as Record<string, FamilyOverride>
const PRO_OVR = typeof agentDb.proOvrThreshold === 'number' ? agentDb.proOvrThreshold : 80

const AGENT_BY_ID = new Map(AGENTS.map((a) => [a.id, a]))

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\./g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

const LINK_BY_NORM = new Map<string, string>()
for (const [playerName, agentId] of Object.entries(LINKS)) {
  LINK_BY_NORM.set(normalizeName(playerName), agentId)
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function surnameOf(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean)
  if (parts.length <= 1) return parts[0] ?? 'Player'
  return parts[parts.length - 1]!
}

const FALLBACK_PRO: AgentDef = {
  id: 'fallback',
  name: 'Independent Agent',
  agency: 'Independent',
  style: 'balanced',
}

function pickProAgent(seed: number): AgentDef {
  if (!AGENTS.length) return FALLBACK_PRO
  return AGENTS[Math.abs(seed) % AGENTS.length] ?? FALLBACK_PRO
}

function familyAgentFor(playerName: string, seed: number): {
  agentName: string
  agentAgency: string
  agentKind: 'family'
  agentStyle: AgentStyle
} {
  const surname = surnameOf(playerName)
  const father = seed % 2 === 0
  return {
    agentKind: 'family',
    agentName: father ? `คุณพ่อ ${surname}` : `คุณแม่ ${surname}`,
    agentAgency: `ครอบครัว ${surname}`,
    agentStyle: seed % 5 === 0 ? 'balanced' : 'loyal',
  }
}

export type AgentIdentity = {
  agentName: string
  agentAgency: string
  agentKind: AgentKind
  agentStyle: AgentStyle
}

/** สร้างตัวตนเอเยนต์: ลิงก์ชื่อดัง / โปรตาม OVR / พ่อแม่ */
export function resolveAgentIdentity(
  player: Pick<Player, 'id' | 'name' | 'overall' | 'mediaHandling' | 'agentStyle' | 'agentName' | 'agentKind' | 'agentAgency'>,
): AgentIdentity {
  if (player.agentName && player.agentKind) {
    return {
      agentName: player.agentName,
      agentAgency: player.agentAgency ?? (player.agentKind === 'family' ? 'ครอบครัว' : 'Independent'),
      agentKind: player.agentKind,
      agentStyle: player.agentStyle ?? styleFromHash(player),
    }
  }

  const linkId = LINK_BY_NORM.get(normalizeName(player.name ?? ''))
  if (linkId) {
    const fam = FAMILY_OVERRIDES[linkId]
    if (fam?.name) {
      return {
        agentName: fam.name,
        agentAgency: fam.agency,
        agentKind: 'family',
        agentStyle: fam.style,
      }
    }
    const linked = AGENT_BY_ID.get(linkId)
    if (linked?.name) {
      return {
        agentName: linked.name,
        agentAgency: linked.agency,
        agentKind: 'pro',
        agentStyle: linked.style,
      }
    }
  }

  const seed = hashStr(player.id || player.name || 'player') ^ ((player.overall ?? 70) * 997)
  const ovr = player.overall ?? 70
  const media = player.mediaHandling ?? 10
  // ดาว / มีเดียสูง → เอเยนต์อาชีพจากพูลจริง
  if (ovr >= PRO_OVR || (ovr >= 76 && media >= 14)) {
    const pro = pickProAgent(seed)
    return {
      agentName: pro.name,
      agentAgency: pro.agency,
      agentKind: 'pro',
      agentStyle: player.agentStyle ?? pro.style,
    }
  }

  return familyAgentFor(player.name || 'Player', seed)
}

/** ใส่เอเยนต์บน Player ถ้ายังไม่มี */
export function withAgentIdentity<T extends Player>(player: T): T {
  if (player.agentName && player.agentKind) {
    return {
      ...player,
      agentStyle: player.agentStyle ?? resolveAgentIdentity(player).agentStyle,
      agentAgency: player.agentAgency ?? resolveAgentIdentity(player).agentAgency,
    }
  }
  const idn = resolveAgentIdentity(player)
  return {
    ...player,
    agentName: idn.agentName,
    agentAgency: idn.agentAgency,
    agentKind: idn.agentKind,
    agentStyle: idn.agentStyle,
  }
}

export function agentLabelTh(player: Pick<Player, 'agentName' | 'agentAgency' | 'agentKind' | 'agentStyle' | 'id' | 'name' | 'overall' | 'mediaHandling'>): string {
  const idn = resolveAgentIdentity(player as Player)
  const style = AGENT_STYLE_LABEL[idn.agentStyle]
  return `${idn.agentName} · ${idn.agentAgency} · ${style}`
}

function styleFromHash(
  player: Pick<Player, 'id' | 'overall' | 'mediaHandling'>,
): AgentStyle {
  const n = (player.id || 'x').split('').reduce((s, c) => s + c.charCodeAt(0), 0)
  const roll = (n + (player.overall ?? 70) * 3 + (player.mediaHandling ?? 10)) % 100
  if (roll < 22) return 'greedy'
  if (roll < 42) return 'loyal'
  if (roll < 62) return 'aggressive'
  return 'balanced'
}

/** สุ่มบุคลิกเอเยนต์จาก id นักเตะ (คงที่ต่อเซฟ) — ใช้เมื่อยังไม่ resolve identity */
export function agentStyleFor(
  player: Pick<Player, 'id' | 'overall' | 'mediaHandling' | 'agentStyle' | 'name' | 'agentName' | 'agentKind' | 'agentAgency'>,
): AgentStyle {
  if (player.agentStyle) return player.agentStyle
  if (player.agentName && player.agentKind) {
    return resolveAgentIdentity(player).agentStyle
  }
  return styleFromHash(player)
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

/** ครอบครัวคิดค่าเอเยนต์ต่ำกว่าโปร */
export function agentKindFeeMul(kind: AgentKind | undefined): number {
  if (kind === 'family') return 0.55
  return 1
}

export function agentWalkHarder(style: AgentStyle): boolean {
  return style === 'greedy' || style === 'aggressive'
}

/** คีย์รวมลูกค้าของเอเยนต์คนเดียวกัน (เอเยนต์หนึ่งคนดูได้หลายนักเตะ) */
export function agentClientKey(
  player: Pick<Player, 'id' | 'name' | 'overall' | 'mediaHandling' | 'agentStyle' | 'agentName' | 'agentKind' | 'agentAgency'>,
): string {
  const idn = resolveAgentIdentity(player as Player)
  return `${idn.agentKind}::${idn.agentAgency}::${idn.agentName}`.toLowerCase()
}

export function clientsOfAgent(
  players: Player[],
  keyOrPlayer: string | Player,
): Player[] {
  const key =
    typeof keyOrPlayer === 'string' ? keyOrPlayer : agentClientKey(keyOrPlayer)
  return players.filter((p) => agentClientKey(p) === key)
}

export function agentStableIdFromKey(key: string): string {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return `ag-${(h >>> 0).toString(36)}`
}
