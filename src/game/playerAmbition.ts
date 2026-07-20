/**
 * ทีมในฝัน / ความสนใจสโมสร + สัญญาใจลับ (tapping up)
 */
import type {
  Club,
  GameSave,
  Player,
  PlayerClubAffinity,
  PlayerSecretHandshake,
} from './types'
import { bumpMarketHeat } from './transfer'
import { ensureMediaFeed } from './media'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hashName(name: string): number {
  let h = 2166136261
  for (let i = 0; i < name.length; i++) {
    h ^= name.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export function ensureClubAffinity(
  player: Player,
  clubs: Club[],
): PlayerClubAffinity {
  if (
    player.clubAffinity?.dreamClubIds &&
    player.clubAffinity.dreamClubIds.length > 0
  ) {
    return {
      dreamClubIds: player.clubAffinity.dreamClubIds.slice(0, 3),
      likedClubIds: player.clubAffinity.likedClubIds?.slice(0, 4) ?? [],
      avoidClubIds: player.clubAffinity.avoidClubIds?.slice(0, 3) ?? [],
    }
  }
  return seedClubAffinity(player, clubs)
}

export function seedClubAffinity(player: Player, clubs: Club[]): PlayerClubAffinity {
  const rng = mulberry(hashName(player.name) ^ (player.overall * 997) ^ clubs.length)
  const pool = clubs
    .filter((c) => c.id !== player.clubId && c.id !== '__free__')
    .slice()
    .sort((a, b) => b.reputation - a.reputation)

  const elite = pool.filter((c) => c.reputation >= 72)
  const mid = pool.filter((c) => c.reputation >= 55 && c.reputation < 72)
  const pick = (list: Club[], n: number) => {
    const out: string[] = []
    const copy = list.slice()
    while (out.length < n && copy.length) {
      const i = Math.floor(rng() * copy.length)
      out.push(copy.splice(i, 1)[0]!.id)
    }
    return out
  }

  const dreamN = player.overall >= 80 ? 3 : player.overall >= 72 ? 2 : 1
  const dreamClubIds = pick(elite.length ? elite : pool.slice(0, 12), dreamN)
  const likedClubIds = pick(
    mid.length ? mid : pool.filter((c) => !dreamClubIds.includes(c.id)),
    2,
  )

  const avoidClubIds: string[] = []
  const bottom = pool.filter(
    (c) => !dreamClubIds.includes(c.id) && !likedClubIds.includes(c.id),
  )
  if (bottom.length && rng() < 0.55) {
    const low = bottom.slice().sort((a, b) => a.reputation - b.reputation)
    avoidClubIds.push(...pick(low.slice(0, 8), 1))
  }

  return { dreamClubIds, likedClubIds, avoidClubIds }
}

/** คะแนนความอยากไปคลับ (−1 ถึง 1) */
export function clubDesireScore(player: Player, clubId: string): number {
  const a = player.clubAffinity
  if (!a) return 0
  if (a.avoidClubIds?.includes(clubId)) return -1
  if (a.dreamClubIds.includes(clubId)) return 1
  if (a.likedClubIds?.includes(clubId)) return 0.45
  return 0
}

export function isDreamClub(player: Player, clubId: string): boolean {
  return Boolean(player.clubAffinity?.dreamClubIds.includes(clubId))
}

export function isAvoidClub(player: Player, clubId: string): boolean {
  return Boolean(player.clubAffinity?.avoidClubIds?.includes(clubId))
}

/** คูณค่าเหนื่อยที่ขอตอนย้ายเข้า — dream ลด */
export function affinityWageMul(player: Player, toClubId: string): number {
  const s = clubDesireScore(player, toClubId)
  if (s >= 1) return 0.94
  if (s >= 0.4) return 0.97
  if (s <= -1) return 1.12
  return 1
}

/** คูณ ask ตอนต่อสัญญากับคลับปัจจุบัน */
export function renewAffinityWageMul(player: Player, clubId: string): number {
  const s = clubDesireScore(player, clubId)
  if (s >= 1) return 0.96
  if (s <= -0.5) return 1.1
  if (s < 0.4 && player.overall >= 76) return 1.06
  if (s < 0.4 && player.overall >= 70) return 1.03
  return 1
}

export function withEnsuredAffinity(player: Player, clubs: Club[]): Player {
  if (player.clubAffinity?.dreamClubIds?.length) return player
  return { ...player, clubAffinity: seedClubAffinity(player, clubs) }
}

export function ensurePlayersAffinity(save: GameSave): GameSave {
  let changed = false
  const players = save.players.map((p) => {
    if (p.clubAffinity?.dreamClubIds?.length) return p
    changed = true
    return { ...p, clubAffinity: seedClubAffinity(p, save.clubs) }
  })
  return changed ? { ...save, players } : save
}

export function sellerBlocksBuyer(seller: Club, buyerId: string, matchday: number): boolean {
  const until = seller.refuseBuyersUntil?.[buyerId]
  return typeof until === 'number' && until >= matchday
}

export function banBuyerForClub(
  club: Club,
  buyerId: string,
  untilMatchday: number,
): Club {
  return {
    ...club,
    refuseBuyersUntil: {
      ...(club.refuseBuyersUntil ?? {}),
      [buyerId]: Math.max(club.refuseBuyersUntil?.[buyerId] ?? 0, untilMatchday),
    },
  }
}

export type HandshakeResult =
  | { ok: true; message: string; save: GameSave; exposed: boolean }
  | { ok: false; message: string; save?: GameSave }

/**
 * สัญญาใจลับ — อย่าต่อสัญญา รอหมดแล้วเซ็นฟรี
 */
export function trySecretHandshake(save: GameSave, playerId: string): HandshakeResult {
  const player = save.players.find((p) => p.id === playerId)
  if (!player) return { ok: false, message: 'ไม่พบนักเตะ' }
  if (player.clubId === save.humanClubId) {
    return { ok: false, message: 'อยู่ในทีมคุณแล้ว' }
  }
  if (player.loanParentClubId) return { ok: false, message: 'กำลังยืมอยู่' }
  if (player.secretHandshake?.fromClubId === save.humanClubId && !player.secretHandshake.exposed) {
    return { ok: false, message: 'มีสัญญาใจกับคุณอยู่แล้ว' }
  }
  if (player.preContract?.clubId) {
    return { ok: false, message: 'มีพรี-คอนแทรกต์แล้ว' }
  }

  const desire = clubDesireScore(
    { ...player, clubAffinity: ensureClubAffinity(player, save.clubs) },
    save.humanClubId,
  )
  if (desire <= -1) {
    return { ok: false, message: `${player.name} ไม่สนใจสโมสรคุณ (อยู่ในรายการเลี่ยง)` }
  }

  const happiness = player.happiness ?? player.morale ?? 10
  const ambition = player.growth?.ambition ?? 10
  let chance = 0.22 + desire * 0.28 + (20 - happiness) / 80 + ambition / 100
  if (player.overall >= 80) chance += 0.05
  if ((player.contractYears ?? 3) <= 2) chance += 0.08
  chance = Math.max(0.08, Math.min(0.82, chance))

  if (Math.random() > chance) {
    return {
      ok: false,
      message: `${player.name} / เอเยนต์ยังไม่ยอมสัญญาใจ — ลองรอให้ไม่แฮปปี้กว่านี้หรือเป็นทีมในฝันของเขา`,
    }
  }

  const handshake: PlayerSecretHandshake = {
    fromClubId: save.humanClubId,
    promisedAtMatchday: save.matchday,
    promise: 'wait_free',
    exposed: false,
  }

  let players = save.players.map((p) =>
    p.id === playerId
      ? {
          ...p,
          clubAffinity: ensureClubAffinity(p, save.clubs),
          secretHandshake: handshake,
          refuseContractRenewal: true,
          happiness: Math.min(20, (p.happiness ?? 10) + 1),
        }
      : p,
  )

  const exposed = Math.random() < 0.18 + (player.mediaHandling ?? 10) / 120
  let clubs = save.clubs
  let inbox = [...save.inbox]
  let next: GameSave = { ...save, players }

  if (exposed) {
    players = players.map((p) =>
      p.id === playerId
        ? {
            ...p,
            secretHandshake: { ...handshake, exposed: true },
            marketHeat: Math.min(20, (p.marketHeat ?? 0) + 5),
          }
        : p,
    )
    clubs = clubs.map((c) =>
      c.id === player.clubId ? banBuyerForClub(c, save.humanClubId, save.matchday + 8) : c,
    )
    const seller = save.clubs.find((c) => c.id === player.clubId)
    inbox = [
      {
        id: uid('msg-tap'),
        date: save.currentDate,
        title: `โดนจับสัญญาใจ: ${player.name}`,
        body: `${seller?.name ?? 'ต้นสังกัด'} จับได้ว่าคุณไปสัญญาใจกับ ${player.name} — ห้ามซื้อจากคลับนี้ ~8 แมตช์เดย์ · ตลาดเดือด`,
        read: false,
      },
      ...inbox,
    ]
    next = {
      ...next,
      players,
      clubs,
      inbox: inbox.slice(0, 40),
    }
    const media = ensureMediaFeed(next)
    next = {
      ...next,
      media: {
        ...media,
        romano: [
          {
            id: uid('rom-tap'),
            date: next.currentDate,
            channel: 'romano' as const,
            headline: `วงใน: แอบคุย ${player.name}?`,
            body: `มีข่าว tapping-up — ต้นสังกัดไม่พอใจ · ความเชื่อมั่นสูง`,
            tone: 'rumor' as const,
            reliability: Math.round(65 + Math.random() * 25),
            subjectName: player.name,
            tags: ['tapping_up', player.id],
          },
          ...media.romano,
        ].slice(0, 40),
      },
    }
    next = {
      ...next,
      players: next.players.map((p) => (p.id === playerId ? bumpMarketHeat(p, 2) : p)),
    }
    return {
      ok: true,
      exposed: true,
      message: `สัญญาใจสำเร็จ แต่โดนจับ! ${player.name} จะไม่ต่อสัญญา — คุณถูกแบนซื้อจากต้นสังกัดชั่วคราว`,
      save: next,
    }
  }

  inbox = [
    {
      id: uid('msg-hs'),
      date: save.currentDate,
      title: `สัญญาใจ (ลับ): ${player.name}`,
      body: `${player.name} รับปากจะไม่ต่อสัญญา — รอหน้าต่างบอสแมนแล้วเซ็นพรี-คอนแทรกต์ (เงียบไว้)`,
      read: false,
    },
    ...inbox,
  ]

  return {
    ok: true,
    exposed: false,
    message: `สัญญาใจสำเร็จ — ${player.name} จะไม่ต่อสัญญากับต้นสังกัด · รอหน้าต่างบอสแมน`,
    save: { ...next, players, inbox: inbox.slice(0, 40) },
  }
}

/** AI ไปสัญญาใจกับดาวในทีม human */
export function processAiSecretHandshakes(save: GameSave): GameSave {
  if (Math.random() > 0.22) return save
  const humanId = save.humanClubId
  const stars = save.players.filter(
    (p) =>
      p.clubId === humanId &&
      p.overall >= 74 &&
      !p.secretHandshake &&
      !p.preContract &&
      (p.contractYears ?? 3) <= 2,
  )
  if (!stars.length) return save
  const target = stars.sort((a, b) => b.overall - a.overall)[
    Math.floor(Math.random() * Math.min(3, stars.length))
  ]!
  const poachers = save.clubs
    .filter((c) => c.controlledBy === 'ai' && c.id !== humanId)
    .sort((a, b) => b.reputation - a.reputation)
  if (!poachers.length) return save
  const poacher = poachers[Math.floor(Math.random() * Math.min(5, poachers.length))]!
  const desire = clubDesireScore(
    { ...target, clubAffinity: ensureClubAffinity(target, save.clubs) },
    poacher.id,
  )
  if (desire < 0.3 && Math.random() > 0.35) return save

  const exposed = Math.random() < 0.25
  const players = save.players.map((p) =>
    p.id === target.id
      ? {
          ...p,
          clubAffinity: ensureClubAffinity(p, save.clubs),
          refuseContractRenewal: true,
          secretHandshake: {
            fromClubId: poacher.id,
            promisedAtMatchday: save.matchday,
            promise: 'wait_free' as const,
            exposed,
          },
          happiness: Math.max(1, (p.happiness ?? 12) - (exposed ? 1 : 0)),
        }
      : p,
  )

  const inbox = [
    {
      id: uid('msg-ai-tap'),
      date: save.currentDate,
      title: exposed
        ? `สื่อจับได้: ${poacher.shortName} คุยกับ ${target.name}`
        : `วงใน: ${target.name} อาจไม่ต่อสัญญา`,
      body: exposed
        ? `${poacher.name} ถูกกล่าวหาว่าไปสัญญาใจกับนักเตะคุณ — ${target.name} เริ่มแข็งข้อเรื่องสัญญา`
        : `เอเยนต์ของ ${target.name} เปิดรับฟังสโมสรใหญ่ · ระวังเสียฟรี`,
      read: false,
    },
    ...save.inbox,
  ].slice(0, 40)

  return { ...save, players, inbox }
}

/** ข้อความสั้นสำหรับ UI */
export function affinityHintsTh(
  player: Player,
  clubs: Club[],
  knowledgePercent: number,
): string[] {
  const a = player.clubAffinity
  if (!a || knowledgePercent < 35) return []
  const nameOf = (id: string) => clubs.find((c) => c.id === id)?.shortName ?? id
  const hints: string[] = []
  if (a.dreamClubIds[0]) {
    hints.push(
      knowledgePercent >= 60
        ? `ทีมในฝัน: ${a.dreamClubIds.map(nameOf).join(', ')}`
        : `สนใจสโมสรใหญ่ (ยังไม่ชัวร์ชื่อ)`,
    )
  }
  if (knowledgePercent >= 70 && a.avoidClubIds?.length) {
    hints.push(`ไม่อยากไป: ${a.avoidClubIds.map(nameOf).join(', ')}`)
  }
  return hints
}

export function hasHandshakeWith(player: Player, clubId: string): boolean {
  return player.secretHandshake?.fromClubId === clubId
}
