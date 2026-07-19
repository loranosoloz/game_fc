import type {
  GameSave,
  InboxMessage,
  PendingTransferOffer,
  Player,
  PlayerTransferDesire,
} from './types'
import { estimatedValue, marketSellPremium, sellPlayerToAi } from './transfer'
import { formatMoney } from '@/lib/format'
import { isTransferWindowOpen } from './transferWindow'
import { pushNews } from './media'
import { areRivals, heatRivalry } from './rivalries'
import { recordHatredWhileAtClub } from './fans'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function deskOf(save: GameSave) {
  return save.transferDesk ?? { offers: [], auctions: [], clauses: [] }
}

export function emptyWantAway(): PlayerTransferDesire {
  return {
    active: false,
    intensity: 0,
    publicNews: false,
    refuseCount: 0,
    sinceMatchday: 0,
  }
}

export function getWantAway(p: Player): PlayerTransferDesire {
  return p.wantAway ?? emptyWantAway()
}

export function isWantAway(p: Player): boolean {
  return Boolean(p.wantAway?.active)
}

export function patchWantAway(p: Player, patch: Partial<PlayerTransferDesire>): Player {
  const cur = getWantAway(p)
  const next: PlayerTransferDesire = {
    ...cur,
    ...patch,
    intensity: clamp(patch.intensity ?? cur.intensity, 0, 20),
    refuseCount: Math.max(0, patch.refuseCount ?? cur.refuseCount),
  }
  if (!next.active) {
    return { ...p, wantAway: null }
  }
  return { ...p, wantAway: next }
}

export function clearWantAway(p: Player): Player {
  return { ...p, wantAway: null }
}

const TRANSFER_KINDS = new Set([
  'transfer_request',
  'list_for_sale',
  'europe_move',
  'home_return',
])

export function isTransferDesireKind(kind: string): boolean {
  return TRANSFER_KINDS.has(kind)
}

export function activateWantAway(
  p: Player,
  matchday: number,
  reasonTh: string,
  intensityBump = 4,
): Player {
  const cur = getWantAway(p)
  return patchWantAway(p, {
    active: true,
    intensity: Math.max(cur.intensity, 6) + intensityBump,
    sinceMatchday: cur.active ? cur.sinceMatchday : matchday,
    reasonTh,
    publicNews: cur.publicNews,
    refuseCount: cur.refuseCount,
    boardForced: cur.boardForced,
  })
}

export function makeWantAwayPublic(
  save: GameSave,
  playerId: string,
  headline?: string,
): GameSave {
  const p = save.players.find((x) => x.id === playerId)
  if (!p?.wantAway?.active || p.wantAway.publicNews) return save

  const club = save.clubs.find((c) => c.id === p.clubId)
  const players = save.players.map((x) =>
    x.id === playerId
      ? patchWantAway(x, {
          publicNews: true,
          intensity: (x.wantAway?.intensity ?? 8) + 2,
        })
      : x,
  )
  let next: GameSave = {
    ...save,
    players,
    inbox: [
      {
        id: uid('msg-wa'),
        date: save.currentDate,
        title: `ข่าวอยากย้าย: ${p.name}`,
        body:
          headline ??
          `${p.name} ถูกสื่อตีข่าวอยากออกจาก ${club?.shortName ?? 'สโมสร'} — ตลาดรู้แล้ว ทีมอื่นจะเริ่มยื่น (ยังไม่ลิสต์ขายอัตโนมัติ)`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
  next = pushNews(next, {
    id: uid('news-wa'),
    channel: 'news',
    date: save.currentDate,
    headline: `ดราม่า: ${p.name} อยากย้าย`,
    body: `${p.name} (${club?.name ?? ''}) — ${p.wantAway.reasonTh ?? 'ไม่แฮปปี้'} · สื่อตีแรง`,
    tone: 'negative',
    tags: ['transfer', 'want_away', p.id],
    reliability: 78,
    subjectName: p.name,
  })
  if (p.clubId) {
    next = recordHatredWhileAtClub(
      next,
      p.clubId,
      next.players.find((x) => x.id === playerId) ?? p,
      'want_away',
      'อยากย้ายจนสั่น — ข่าวออกสื่อ',
    )
  }
  return next
}

export function applyTransferDesireResponse(
  save: GameSave,
  playerId: string,
  kind: string,
  response: 'agree' | 'promise' | 'refuse' | 'listen_only',
  labelTh?: string,
): GameSave {
  if (!isTransferDesireKind(kind)) return save
  const p = save.players.find((x) => x.id === playerId)
  if (!p) return save

  const reason = labelTh ?? 'อยากย้ายทีม'
  const inbox: InboxMessage[] = []

  if (response === 'agree' || response === 'promise') {
    const players = save.players.map((x) =>
      x.id === playerId
        ? activateWantAway(x, save.matchday, reason, response === 'agree' ? 5 : 3)
        : x,
    )
    inbox.push({
      id: uid('msg-wa-ok'),
      date: save.currentDate,
      title: response === 'agree' ? `รับปากจะช่วย ${p.name}` : `สัญญากับ ${p.name}`,
      body: `ตั้งธงอยากย้ายแล้ว — ยังไม่ลิสต์ขายอัตโนมัติ · ถ้ารั่วสู่สื่อ AI จะแห่ยื่นซื้อ`,
      read: false,
    })
    return { ...save, players, inbox: [...inbox, ...save.inbox].slice(0, 40) }
  }

  if (response === 'refuse') {
    const cur = getWantAway(p)
    const refuseCount = cur.refuseCount + 1
    const intensity = Math.min(20, Math.max(cur.intensity, 8) + 5 + refuseCount)
    const players = save.players.map((x) =>
      x.id === playerId
        ? patchWantAway(
            {
              ...x,
              morale: clamp(x.morale - 3 - refuseCount, 1, 20),
              happiness: clamp((x.happiness ?? x.morale) - 4 - refuseCount, 1, 20),
              form: clamp(x.form - 1, 1, 20),
              sharpness: clamp(x.sharpness - 4, 25, 100),
            },
            {
              active: true,
              intensity,
              refuseCount,
              sinceMatchday: cur.active ? cur.sinceMatchday : save.matchday,
              reasonTh: reason,
              publicNews: cur.publicNews,
              boardForced: intensity >= 16 || cur.boardForced,
            },
          )
        : x,
    )
    inbox.push({
      id: uid('msg-wa-no'),
      date: save.currentDate,
      title: `ดราม่า: ปฏิเสธ ${p.name}`,
      body: `ปฏิเสธคำขออยากย้าย (ครั้งที่ ${refuseCount}) — ห้องแต่งตัวแตก${
        intensity >= 16 ? ' · บอร์ดเริ่มกดดันให้รับข้อเสนอ' : ''
      }`,
      read: false,
    })
    let next: GameSave = {
      ...save,
      players,
      inbox: [...inbox, ...save.inbox].slice(0, 40),
      managerReputation: clamp((save.managerReputation ?? 50) - (refuseCount >= 2 ? 2 : 1), 0, 100),
    }
    next = recordHatredWhileAtClub(
      next,
      p.clubId,
      next.players.find((x) => x.id === playerId) ?? p,
      'want_away',
      'ปฏิเสธคำขออยากย้าย — แฟนเริ่มไม่ไว้ใจ',
    )
    const leakChance = 0.35 + refuseCount * 0.2 + ((p.mediaHandling ?? 10) < 8 ? 0.15 : 0)
    if (!cur.publicNews && Math.random() < leakChance) {
      next = makeWantAwayPublic(next, playerId, `หลุดหลังปฏิเสธ: ${p.name} อยากออก`)
    } else if (intensity >= 14 && Math.random() < 0.5) {
      next = makeWantAwayPublic(next, playerId)
    }
    return next
  }

  // listen_only
  const players = save.players.map((x) =>
    x.id === playerId ? activateWantAway(x, save.matchday, reason, 2) : x,
  )
  inbox.push({
    id: uid('msg-wa-listen'),
    date: save.currentDate,
    title: `รับฟัง ${p.name}`,
    body: `ยังไม่ตัดสินใจ — แต่ธงอยากย้ายเริ่มก่อตัว`,
    read: false,
  })
  return { ...save, players, inbox: [...inbox, ...save.inbox].slice(0, 40) }
}

export function tickWantAwayDrama(save: GameSave): GameSave {
  let next = save
  const inbox: InboxMessage[] = []
  const newlyPublic: string[] = []

  const players = next.players.map((p) => {
    if (p.clubId !== save.humanClubId) return p
    const wa = p.wantAway
    if (!wa?.active) return p

    let intensity = wa.intensity
    let publicNews = wa.publicNews
    let boardForced = wa.boardForced ?? false
    const xi = save.tacticsByClub[save.humanClubId]?.startingXi ?? []
    if (!xi.includes(p.id) && p.injuryDays <= 0) intensity = Math.min(20, intensity + 1)
    if (publicNews) intensity = Math.min(20, intensity + 1)

    if (!publicNews && intensity >= 12 && Math.random() < 0.22) {
      publicNews = true
      newlyPublic.push(p.id)
      inbox.push({
        id: uid('msg-leak'),
        date: save.currentDate,
        title: `หลุดสื่อ: ${p.name}`,
        body: `เอเยนต์/โซเชียลตีข่าวอยากย้าย — ทีมอื่นรู้แล้ว`,
        read: false,
      })
    }

    if (intensity >= 16 && !boardForced) {
      boardForced = true
      inbox.push({
        id: uid('msg-board-force'),
        date: save.currentDate,
        title: `บอร์ดกดดัน: ${p.name}`,
        body: `บอร์ดสั่งให้เปิดรับข้อเสนอและจบดราม่า — ถ้าเพิกเฉยอาจโดนบังคับขาย`,
        read: false,
      })
    }

    let morale = p.morale
    let happiness = p.happiness ?? p.morale
    let condition = p.condition
    if (intensity >= 14) {
      morale = clamp(morale - 1, 1, 20)
      happiness = clamp(happiness - 1, 1, 20)
      condition = clamp(condition - 2, 25, 100)
    }

    return patchWantAway(
      { ...p, morale, happiness, condition },
      { intensity, publicNews, boardForced },
    )
  })

  next = {
    ...next,
    players,
    managerReputation: inbox.some((m) => m.title.startsWith('บอร์ด'))
      ? clamp((next.managerReputation ?? 50) - 1, 0, 100)
      : next.managerReputation,
  }
  if (inbox.length) next = { ...next, inbox: [...inbox, ...next.inbox].slice(0, 40) }
  for (const id of newlyPublic) next = makeWantAwayPublic(next, id)
  return maybeBoardForceSell(next)
}

function maybeBoardForceSell(save: GameSave): GameSave {
  const desk = deskOf(save)
  const forced = save.players.filter(
    (p) =>
      p.clubId === save.humanClubId &&
      p.wantAway?.active &&
      p.wantAway.boardForced &&
      (p.wantAway.intensity ?? 0) >= 17,
  )
  if (!forced.length || Math.random() > 0.28) return save

  const p = forced.sort((a, b) => (b.wantAway?.intensity ?? 0) - (a.wantAway?.intensity ?? 0))[0]!
  const offer = desk.offers.find(
    (o) =>
      o.kind === 'sell' &&
      o.playerId === p.id &&
      o.status === 'pending' &&
      o.fromClubId === save.humanClubId,
  )
  if (!offer) return save

  const sold = sellPlayerToAi(save, p.id, offer.fee, offer.toClubId)
  if (!sold.ok) return save
  return {
    ...sold.save,
    players: sold.save.players.map((x) => (x.id === p.id ? clearWantAway(x) : x)),
    transferDesk: {
      ...deskOf(sold.save),
      offers: deskOf(sold.save).offers.map((o) =>
        o.id === offer.id ? { ...o, status: 'accepted' as const } : o,
      ),
    },
    inbox: [
      {
        id: uid('msg-force-sell'),
        date: save.currentDate,
        title: `บอร์ดบังคับขาย ${p.name}`,
        body: `บอร์ดรับข้อเสนอ ${formatMoney(offer.fee)} เองเพราะดราม่ายืดเยื้อ — ${sold.message}`,
        read: false,
      },
      ...sold.save.inbox,
    ].slice(0, 40),
    managerReputation: clamp((sold.save.managerReputation ?? 50) - 3, 0, 100),
  }
}

export function processWantAwayAiBids(save: GameSave): GameSave {
  if (!isTransferWindowOpen(save)) return save
  let desk = deskOf(save)
  let next = save
  const targets = next.players.filter(
    (p) => p.clubId === save.humanClubId && p.wantAway?.active && p.wantAway.publicNews,
  )
  if (!targets.length) return save

  const inbox: InboxMessage[] = []
  const newOffers: PendingTransferOffer[] = []

  for (const p of targets) {
    const existing = desk.offers.filter(
      (o) =>
        o.kind === 'sell' &&
        o.playerId === p.id &&
        o.status === 'pending' &&
        o.expiresMatchday >= save.matchday,
    ).length
    const intensity = p.wantAway?.intensity ?? 8
    const maxOffers = p.wantAway?.boardForced ? 4 : intensity >= 14 ? 3 : 2
    if (existing >= maxOffers) continue
    if (Math.random() > 0.45 + intensity * 0.02) continue

    const value = estimatedValue(p)
    const winterPrem = marketSellPremium(next, p)
    const pool = next.clubs
      .filter((c) => c.controlledBy === 'ai' && c.balance > value * winterPrem * 0.65)
      .sort((a, b) => {
        const ra = areRivals(next, a.id, save.humanClubId) ? 1 : 0
        const rb = areRivals(next, b.id, save.humanClubId) ? 1 : 0
        if (rb !== ra) return rb - ra
        return b.reputation - a.reputation
      })

    const buyer = pool[Math.floor(Math.random() * Math.min(6, pool.length))]
    if (!buyer) continue
    if (desk.offers.some((o) => o.playerId === p.id && o.toClubId === buyer.id && o.status === 'pending')) {
      continue
    }

    const rival = areRivals(next, buyer.id, save.humanClubId)
    const feeMul = rival ? 1.08 + Math.random() * 0.12 : 0.92 + Math.random() * 0.18
    // วินเทอร์: AI ยื่นสูงขึ้นถ้าจะดึงจากคุณกลางทาง
    const fee = Math.round(
      value * feeMul * winterPrem * (p.wantAway?.boardForced ? 1.05 : 1) * (winterPrem > 1 ? 0.92 : 1),
    )
    if (buyer.balance < fee * 0.85) continue

    const offer: PendingTransferOffer = {
      id: uid('offer-wa'),
      kind: 'sell',
      playerId: p.id,
      fromClubId: save.humanClubId,
      toClubId: buyer.id,
      fee,
      wage: Math.round(p.wage * (1.05 + Math.random() * 0.15)),
      contractYears: 3,
      appearanceAddon: 0,
      sellOnPercent: 0,
      status: 'pending',
      expiresMatchday: save.matchday + 3,
      note: rival
        ? `คู่อริ ${buyer.shortName} ยื่นซื้อหลังข่าวอยากย้าย`
        : `${buyer.shortName} ยื่นซื้อจากข่าวอยากย้าย`,
    }
    newOffers.push(offer)
    inbox.push({
      id: uid('msg-bid'),
      date: save.currentDate,
      title: rival ? `คู่อริยื่นซื้อ ${p.name}` : `ข้อเสนอซื้อ ${p.name}`,
      body: `${buyer.name} เสนอ ${formatMoney(fee)} · ${offer.note} · หมดอายุ MD${offer.expiresMatchday}`,
      read: false,
    })
    if (rival) {
      next = heatRivalry(next, save.humanClubId, buyer.id, 6, 'transfer', 'สงครามค่าตัว')
    }
  }

  if (!newOffers.length) return next
  desk = { ...deskOf(next), offers: [...newOffers, ...deskOf(next).offers].slice(0, 60) }
  return {
    ...next,
    transferDesk: desk,
    inbox: [...inbox, ...next.inbox].slice(0, 40),
  }
}

export function acceptWantAwayBid(
  save: GameSave,
  offerId: string,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const desk = deskOf(save)
  const offer = desk.offers.find((o) => o.id === offerId)
  if (!offer || offer.kind !== 'sell' || offer.status !== 'pending') {
    return { ok: false, message: 'ไม่พบข้อเสนอ' }
  }
  if (offer.fromClubId !== save.humanClubId) {
    return { ok: false, message: 'ไม่ใช่ข้อเสนอขายของคุณ' }
  }
  const sold = sellPlayerToAi(save, offer.playerId, offer.fee, offer.toClubId)
  if (!sold.ok) return sold
  let next = {
    ...sold.save,
    players: sold.save.players.map((p) => (p.id === offer.playerId ? clearWantAway(p) : p)),
    transferDesk: {
      ...deskOf(sold.save),
      offers: deskOf(sold.save).offers.map((o) =>
        o.id === offerId ? { ...o, status: 'accepted' as const } : o,
      ),
    },
  }
  if (areRivals(next, save.humanClubId, offer.toClubId)) {
    next = heatRivalry(next, save.humanClubId, offer.toClubId, 10, 'transfer', 'ขายดาวให้คู่อริ')
  }
  return { ok: true, save: next, message: sold.message }
}

export function rejectWantAwayBid(
  save: GameSave,
  offerId: string,
): { ok: true; save: GameSave; message: string } | { ok: false; message: string } {
  const desk = deskOf(save)
  const offer = desk.offers.find((o) => o.id === offerId)
  if (!offer || offer.kind !== 'sell' || offer.status !== 'pending') {
    return { ok: false, message: 'ไม่พบข้อเสนอ' }
  }
  const p = save.players.find((x) => x.id === offer.playerId)
  let players = save.players
  if (p?.wantAway?.active) {
    players = players.map((x) =>
      x.id === p.id
        ? patchWantAway(x, {
            intensity: (x.wantAway?.intensity ?? 10) + 2,
            boardForced: (x.wantAway?.intensity ?? 0) >= 14 ? true : x.wantAway?.boardForced,
          })
        : x,
    )
  }
  return {
    ok: true,
    message: 'ปฏิเสธข้อเสนอแล้ว',
    save: {
      ...save,
      players,
      transferDesk: {
        ...desk,
        offers: desk.offers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
      },
      inbox: [
        {
          id: uid('msg-rej-bid'),
          date: save.currentDate,
          title: `ปฏิเสธข้อเสนอ ${p?.name ?? ''}`,
          body: `ปฏิเสธ ${formatMoney(offer.fee)} — ดราม่าอาจหนักขึ้น`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

export function wantAwayLabel(p: Player): string | null {
  const wa = p.wantAway
  if (!wa?.active) return null
  if (wa.boardForced) return 'บอร์ดบังคับขาย'
  if (wa.publicNews) return 'ข่าวอยากย้าย'
  return 'อยากย้าย'
}
