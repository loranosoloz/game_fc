import type {
  Club,
  FanState,
  GameSave,
  InboxMessage,
  MediaItem,
  Player,
} from './types'
import { ensureMediaFeed } from './media'
import { recomputeDynamics } from './dynamics'

/** 3 เดือน ≈ 90 วัน */
export const ROMANO_PLANT_COOLDOWN_DAYS = 90

export type RomanoPlantKind = 'hype_club' | 'hype_star' | 'smear_rival' | 'poach_bait'

export const ROMANO_PLANT_KINDS: {
  id: RomanoPlantKind
  title: string
  desc: string
}[] = [
  {
    id: 'hype_club',
    title: 'โปรโมทสโมสร',
    desc: 'ข่าววงในว่าทีมกำลังฮอต — ดันแฟน / ห้องแต่งตัว / บอร์ด',
  },
  {
    id: 'hype_star',
    title: 'โปรโมทนักเตะ',
    desc: 'ยกดาวคนหนึ่งขึ้นพาดหัว — โมราเลขึ้น แต่เพื่อนร่วมทีมอาจอิจฉา',
  },
  {
    id: 'smear_rival',
    title: 'ใส่ร้ายคู่แข่ง',
    desc: 'ซุบซิบลบต่อสโมสรคู่แข่ง — ชื่อเสียงเขาตก แฟนเราฮึกเหิม',
  },
  {
    id: 'poach_bait',
    title: 'เหยื่อดีล / Here we go',
    desc: 'ปล่อยข่าวสนใจดาวคู่แข่ง — แฟนตื่นเต้น ฝั่งเขาอาจไม่พอใจ',
  },
]

export type PlantOpts = {
  playerId?: string
  rivalClubId?: string
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(fromIso)
  const b = Date.parse(toIso)
  if (Number.isNaN(a) || Number.isNaN(b)) return 999
  return Math.floor((b - a) / 86_400_000)
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** ค่าจ้าง Romano แพงมาก — สเกลตามชื่อเสียงสโมสร */
export function romanoPlantCost(club: Club): number {
  return Math.round(12_000_000 * (1 + club.reputation / 180))
}

export function romanoPlantCooldownRemaining(save: GameSave, clubId: string): number {
  const media = ensureMediaFeed(save)
  const last = media.lastPlantByClub[clubId]
  if (!last) return 0
  const elapsed = daysBetween(last, save.currentDate)
  return Math.max(0, ROMANO_PLANT_COOLDOWN_DAYS - elapsed)
}

export function canPlantRomano(
  save: GameSave,
  clubId: string,
): { ok: true; cost: number } | { ok: false; reason: string } {
  const club = save.clubs.find((c) => c.id === clubId)
  if (!club) return { ok: false, reason: 'ไม่พบสโมสร' }
  const remain = romanoPlantCooldownRemaining(save, clubId)
  if (remain > 0) {
    return {
      ok: false,
      reason: `Romano ยังไม่รับงาน — เหลืออีก ~${remain} วัน (คูลดาวน์ ${ROMANO_PLANT_COOLDOWN_DAYS} วัน / ~3 เดือน)`,
    }
  }
  const cost = romanoPlantCost(club)
  if (club.balance < cost) {
    return {
      ok: false,
      reason: `งบไม่พอ — Romano เก็บ ${cost.toLocaleString('th-TH')} €`,
    }
  }
  return { ok: true, cost }
}

function pushMedia(save: GameSave, romano: MediaItem[], social: MediaItem[] = []): GameSave {
  const media = ensureMediaFeed(save)
  return {
    ...save,
    media: {
      ...media,
      romano: [...romano, ...media.romano].slice(0, 40),
      social: [...social, ...media.social].slice(0, 40),
    },
  }
}

function patchFans(fans: FanState, delta: number, note: string): FanState {
  return {
    ...fans,
    mood: clamp(fans.mood + delta, 0, 100),
    lastVerdict: note,
  }
}

function patchPlayer(
  players: Player[],
  id: string,
  fn: (p: Player) => Player,
): Player[] {
  return players.map((p) => (p.id === id ? fn(p) : p))
}

type ReactionBundle = {
  players: Player[]
  clubs: Club[]
  fans: FanState
  board: GameSave['board']
  romano: MediaItem[]
  social: MediaItem[]
  summary: string
  exposed: boolean
}

function buildPlantStory(
  save: GameSave,
  payer: Club,
  kind: RomanoPlantKind,
  opts: PlantOpts,
  reliability: number,
  exposed: boolean,
): { romano: MediaItem; social: MediaItem[]; summary: string } {
  const social: MediaItem[] = []
  const date = save.currentDate
  const conf = `ความเชื่อมั่น ${reliability}%`

  if (kind === 'hype_club') {
    const romano: MediaItem = {
      id: uid('romano'),
      date,
      channel: 'romano',
      headline: exposed
        ? `เปิดโปง: ${payer.shortName} จ้างปล่อยข่าวโปรโมทตัวเอง`
        : `วงใน: ${payer.name} กำลังเข้าสู่จังหวะทอง`,
      body: exposed
        ? `แหล่งข่าวอิสระชี้ว่ามีเงินไหลเข้าระบบสื่อหลังบ้าน — ความน่าเชื่อถือ Romano ถูกตั้งคำถาม`
        : `แหล่งใกล้สตาฟบอกว่าห้องแต่งตัวมั่นใจสูง · ${conf} · “Here we go” สำหรับโปรเจกต์ฤดูกาล`,
      tone: exposed ? 'negative' : 'rumor',
      reliability: exposed ? Math.min(reliability, 40) : reliability,
      tags: ['planted', kind, exposed ? 'exposed' : 'live'],
      subjectName: payer.name,
    }
    social.push({
      id: uid('social'),
      date,
      channel: 'social',
      headline: `@Ultras${payer.shortName}`,
      body: exposed
        ? `จ่ายเงินซื้อข่าว? แฟนบางส่วนโมโห`
        : `ฟีลดีมาก 🔥 สื่อก็ยังพูดถึงเรา`,
      tone: exposed ? 'negative' : 'positive',
      tags: ['fans', 'planted'],
    })
    return {
      romano,
      social,
      summary: exposed
        ? 'ข่าวถูกเปิดโปง — แฟนและบอร์ดไม่พอใจ'
        : 'โปรโมทสโมสรสำเร็จ — แฟน/ห้องแต่งตัวฮึกเหิม',
    }
  }

  if (kind === 'hype_star') {
    const p = save.players.find((x) => x.id === opts.playerId)
    const name = p?.name ?? 'นักเตะ'
    const romano: MediaItem = {
      id: uid('romano'),
      date,
      channel: 'romano',
      headline: exposed
        ? `เปิดโปงแคมเปญ: ยก ${name} ด้วยข่าวปลอม`
        : `Romano: ${name} คือหัวใจของ ${payer.shortName}`,
      body: exposed
        ? `มีหลักฐานว่าสโมสรจ่ายเพื่อดันภาพลักษณ์นักเตะ · ${conf}`
        : `คลับใหญ่ในยุโรป “จับตา” แต่เขายังโฟกัสที่นี่ · ${conf}`,
      tone: exposed ? 'negative' : 'rumor',
      reliability: exposed ? 35 : reliability,
      tags: ['planted', kind, p?.id ?? ''],
      subjectName: name,
    }
    social.push({
      id: uid('social'),
      date,
      channel: 'social',
      headline: `${name.split(' ').slice(-1)[0]} ✨`,
      body: exposed ? `ดราม่าสื่อ… ไม่ขอคอมเมนต์` : `ขอบคุณทุกกำลังใจ 💪`,
      tone: exposed ? 'negative' : 'positive',
      tags: ['player', 'planted'],
    })
    return {
      romano,
      social,
      summary: exposed
        ? `แคมเปญ ${name} แตก — โมราเลสะดุด`
        : `โปรโมท ${name} สำเร็จ — ดาวฮึกเหิม`,
    }
  }

  if (kind === 'smear_rival') {
    const rival = save.clubs.find((c) => c.id === opts.rivalClubId)
    const rName = rival?.name ?? 'คู่แข่ง'
    const romano: MediaItem = {
      id: uid('romano'),
      date,
      channel: 'romano',
      headline: exposed
        ? `เปิดโปง: ${payer.shortName} ใส่ร้าย ${rival?.shortName ?? rName}`
        : `วงใน: วิกฤตเงียบที่ ${rName}`,
      body: exposed
        ? `เงินจาก ${payer.name} ถูกโยงกับข่าวลบ · ความน่าเชื่อถือตก`
        : `แหล่งข่าวพูดถึงความไม่ลงรอยในห้องแต่งตัวและบอร์ด · ${conf}`,
      tone: exposed ? 'negative' : 'rumor',
      reliability: exposed ? 30 : reliability,
      tags: ['planted', kind, opts.rivalClubId ?? ''],
      subjectName: rName,
    }
    social.push({
      id: uid('social'),
      date,
      channel: 'social',
      headline: `TalkSport Chat`,
      body: exposed
        ? `${payer.shortName} โดนแฉซื้อข่าวใส่ร้าย — ดราม่าใหญ่`
        : `${rival?.shortName ?? 'คู่แข่ง'} กำลังพังจากข้างใน? โหวตเลย`,
      tone: exposed ? 'negative' : 'neutral',
      tags: ['talk', 'planted'],
    })
    return {
      romano,
      social,
      summary: exposed
        ? 'การใส่ร้ายถูกเปิดโปง — ชื่อเสียงเราเสีย'
        : `ข่าวลบต่อ ${rName} ออกไปแล้ว — แฟนเราพอใจ`,
    }
  }

  // poach_bait
  const target = save.players.find((x) => x.id === opts.playerId)
  const tName = target?.name ?? 'เป้าหมาย'
  const seller = target ? save.clubs.find((c) => c.id === target.clubId) : null
  const hereWeGo = reliability >= 85
  const romano: MediaItem = {
    id: uid('romano'),
    date,
    channel: 'romano',
    headline: exposed
      ? `เปิดโปงดีลปลอม: ${tName} ↔ ${payer.shortName}`
      : hereWeGo
        ? `Here we go: ${tName} → ${payer.shortName}?`
        : `วงใน: ${payer.shortName} ลุยดีล ${tName}`,
    body: exposed
      ? `ไม่มีข้อเสนอจริง — เป็นแคมเปญสื่อที่จ่ายเงิน · ต้นสังกัด ${seller?.name ?? '—'} ไม่พอใจ`
      : `เอเยนต์เปิดรับฟัง · ${conf} · ยังไม่ใช่ข้อตกลงสุดท้าย`,
    tone: exposed ? 'negative' : 'rumor',
    reliability: exposed ? 25 : reliability,
    tags: ['planted', kind, target?.id ?? ''],
    subjectName: tName,
  }
  social.push({
    id: uid('social'),
    date,
    channel: 'social',
    headline: `@Ultras${payer.shortName}`,
    body: exposed
      ? `หลอกแฟนเรื่องดีล? ขอคำชี้แจง`
      : `ถ้าได้ ${tName.split(' ').slice(-1)[0]} ซีซั่นนี้จบ 🔥`,
    tone: exposed ? 'negative' : 'positive',
    tags: ['fans', 'planted'],
  })
  return {
    romano,
    social,
    summary: exposed
      ? `ดีลปลอม ${tName} แตก — แฟนผิดหวัง`
      : `ข่าวเหยื่อดีล ${tName} ออกแล้ว — ตลาดสั่น`,
  }
}

function applyReactions(
  save: GameSave,
  payer: Club,
  kind: RomanoPlantKind,
  opts: PlantOpts,
  exposed: boolean,
  isHumanPayer: boolean,
): ReactionBundle {
  let players = [...save.players]
  let clubs = [...save.clubs]
  let fans = { ...save.fans }
  let board = { ...save.board }
  const rng = mulberry32(save.season * 911 + save.matchday * 17 + payer.name.length)

  const reliability = Math.round(68 + rng() * 27)
  const story = buildPlantStory(save, payer, kind, opts, reliability, exposed)

  if (kind === 'hype_club') {
    if (exposed) {
      if (isHumanPayer) {
        fans = patchFans(fans, -12, 'แฟนรู้สึกถูกหลอกด้วยข่าวปลอม')
        board = {
          ...board,
          confidence: clamp(board.confidence - 8, 0, 100),
          lastNote: 'บอร์ดไม่พอใจแคมเปญสื่อที่แตก',
        }
        players = players.map((p) =>
          p.clubId === payer.id
            ? {
                ...p,
                morale: clamp(p.morale - 1, 1, 20),
                happiness: clamp((p.happiness ?? p.morale) - 1, 1, 20),
              }
            : p,
        )
      }
      clubs = clubs.map((c) =>
        c.id === payer.id ? { ...c, reputation: clamp(c.reputation - 3, 1, 100) } : c,
      )
    } else {
      if (isHumanPayer) {
        fans = patchFans(fans, 8, 'สื่อยกสโมสร — แฟนฮึกเหิม')
        board = {
          ...board,
          confidence: clamp(board.confidence + 4, 0, 100),
          lastNote: 'บอร์ดพอใจภาพลักษณ์ในสื่อ',
        }
        players = players.map((p) =>
          p.clubId === payer.id
            ? {
                ...p,
                morale: clamp(p.morale + 1, 1, 20),
                happiness: clamp((p.happiness ?? p.morale) + 1, 1, 20),
              }
            : p,
        )
      }
      clubs = clubs.map((c) =>
        c.id === payer.id ? { ...c, reputation: clamp(c.reputation + 2, 1, 100) } : c,
      )
    }
  }

  if (kind === 'hype_star' && opts.playerId) {
    const pid = opts.playerId
    if (exposed) {
      players = patchPlayer(players, pid, (p) => ({
        ...p,
        morale: clamp(p.morale - 2, 1, 20),
        happiness: clamp((p.happiness ?? p.morale) - 2, 1, 20),
      }))
      if (isHumanPayer) {
        fans = patchFans(fans, -8, 'แคมเปญดาวแตก — แฟนไม่เชื่อสื่อ')
        board = {
          ...board,
          confidence: clamp(board.confidence - 5, 0, 100),
          lastNote: 'บอร์ดติงเรื่องจัดการสื่อ',
        }
      }
    } else {
      players = patchPlayer(players, pid, (p) => ({
        ...p,
        morale: clamp(p.morale + 3, 1, 20),
        happiness: clamp((p.happiness ?? p.morale) + 3, 1, 20),
      }))
      // jealousy
      if (rng() < 0.45) {
        const jealous = players.filter(
          (p) => p.clubId === payer.id && p.id !== pid && (p.squadRole === 'key' || p.overall >= 78),
        )
        for (const j of jealous.slice(0, 2)) {
          players = patchPlayer(players, j.id, (p) => ({
            ...p,
            morale: clamp(p.morale - 1, 1, 20),
            happiness: clamp((p.happiness ?? p.morale) - 1, 1, 20),
          }))
        }
      }
      if (isHumanPayer) {
        fans = patchFans(fans, 5, 'แฟนชอบที่สื่อยกดาวสโมสร')
      }
    }
  }

  if (kind === 'smear_rival' && opts.rivalClubId) {
    const rivalId = opts.rivalClubId
    if (exposed) {
      clubs = clubs.map((c) => {
        if (c.id === payer.id) return { ...c, reputation: clamp(c.reputation - 4, 1, 100) }
        return c
      })
      if (isHumanPayer) {
        fans = patchFans(fans, -10, 'แฟนอายที่สโมสรซื้อข่าวใส่ร้าย')
        board = {
          ...board,
          confidence: clamp(board.confidence - 7, 0, 100),
          lastNote: 'บอร์ดไม่ต้องการดราม่าซื้อสื่อ',
        }
      } else if (rivalId === save.humanClubId) {
        // AI smear exposed → human fans slightly relieved / amused
        fans = patchFans(fans, 3, 'คู่แข่งโดนแฉซื้อข่าวใส่เรา — แฟนขำ')
      }
    } else {
      clubs = clubs.map((c) => {
        if (c.id === rivalId) return { ...c, reputation: clamp(c.reputation - 3, 1, 100) }
        if (c.id === payer.id) return { ...c, reputation: clamp(c.reputation + 1, 1, 100) }
        return c
      })
      if (isHumanPayer) {
        fans = patchFans(fans, 6, 'คู่แข่งโดนข่าวลบ — แฟนสะใจ')
        board = {
          ...board,
          confidence: clamp(board.confidence + 2, 0, 100),
          lastNote: 'บอร์ดพอใจที่คู่แข่งถูกกดดัน',
        }
      } else if (rivalId === save.humanClubId) {
        fans = patchFans(fans, -7, 'สื่อโจมตีสโมสร — แฟนโมโห')
        board = {
          ...board,
          confidence: clamp(board.confidence - 4, 0, 100),
          lastNote: 'บอร์ดกังวลภาพลักษณ์จากข่าวลบ',
        }
        players = players.map((p) =>
          p.clubId === save.humanClubId
            ? { ...p, morale: clamp(p.morale - 1, 1, 20) }
            : p,
        )
      }
    }
  }

  if (kind === 'poach_bait' && opts.playerId) {
    const target = players.find((p) => p.id === opts.playerId)
    if (target) {
      if (exposed) {
        if (isHumanPayer) {
          fans = patchFans(fans, -11, 'ดีลปลอมทำให้แฟนผิดหวัง')
          board = {
            ...board,
            confidence: clamp(board.confidence - 6, 0, 100),
            lastNote: 'บอร์ดไม่ชอบกลยุทธ์สื่อหลอกตลาด',
          }
        }
        clubs = clubs.map((c) =>
          c.id === payer.id ? { ...c, reputation: clamp(c.reputation - 2, 1, 100) } : c,
        )
        // target club angry
        if (target.clubId !== payer.id) {
          clubs = clubs.map((c) =>
            c.id === target.clubId ? { ...c, reputation: clamp(c.reputation + 1, 1, 100) } : c,
          )
        }
      } else {
        // unsettle target
        players = patchPlayer(players, target.id, (p) => ({
          ...p,
          happiness: clamp((p.happiness ?? p.morale) - 2, 1, 20),
          morale: clamp(p.morale + (p.clubId === payer.id ? 1 : -1), 1, 20),
        }))
        if (isHumanPayer) {
          fans = patchFans(fans, 7, 'แฟนตื่นเต้นกับข่าวดีลใหญ่')
          board = {
            ...board,
            confidence: clamp(board.confidence + 3, 0, 100),
            lastNote: 'บอร์ดจับตาปฏิกิริยาตลาดหลังข่าว Romano',
          }
        }
        if (target.clubId === save.humanClubId && !isHumanPayer) {
          fans = patchFans(fans, -6, `ข่าว ${target.name} อาจย้าย — แฟนกังวล`)
          board = {
            ...board,
            confidence: clamp(board.confidence - 3, 0, 100),
            lastNote: `บอร์ดจับตาข่าว ${target.name}`,
          }
        }
        if (target.clubId !== payer.id) {
          clubs = clubs.map((c) =>
            c.id === target.clubId ? { ...c, reputation: clamp(c.reputation - 1, 1, 100) } : c,
          )
        }
      }
    }
  }

  return {
    players,
    clubs,
    fans,
    board,
    romano: [story.romano],
    social: story.social,
    summary: story.summary,
    exposed,
  }
}

export type PlantResult =
  | { ok: true; save: GameSave; message: string }
  | { ok: false; message: string }

/** ผู้เล่นหรือ AI จ้าง Romano ปล่อยข่าว */
export function plantRomanoStory(
  save: GameSave,
  payerClubId: string,
  kind: RomanoPlantKind,
  opts: PlantOpts = {},
): PlantResult {
  const gate = canPlantRomano(save, payerClubId)
  if (!gate.ok) return { ok: false, message: gate.reason }

  const payer = save.clubs.find((c) => c.id === payerClubId)!
  const isHumanPayer = payerClubId === save.humanClubId

  if (kind === 'hype_star') {
    const p = save.players.find((x) => x.id === opts.playerId)
    if (!p || p.clubId !== payerClubId) {
      return { ok: false, message: 'เลือกนักเตะในทีมสโมสรที่จ่ายเงิน' }
    }
  }
  if (kind === 'smear_rival') {
    const rival = save.clubs.find((c) => c.id === opts.rivalClubId)
    if (!rival || rival.id === payerClubId) {
      return { ok: false, message: 'เลือกสโมสรคู่แข่งที่ถูกต้อง' }
    }
  }
  if (kind === 'poach_bait') {
    const p = save.players.find((x) => x.id === opts.playerId)
    if (!p || p.clubId === payerClubId) {
      return { ok: false, message: 'เลือกนักเตะจากสโมสรอื่นเป็นเป้าหมายข่าว' }
    }
  }

  const rng = mulberry32(save.season * 401 + save.matchday * 13 + kind.length * 7 + payer.balance)
  /** จ่ายแพงแล้วยังมีโอกาสแตก ~18% */
  const exposed = rng() < 0.18

  const reaction = applyReactions(save, payer, kind, opts, exposed, isHumanPayer)

  let clubs = reaction.clubs.map((c) =>
    c.id === payerClubId ? { ...c, balance: c.balance - gate.cost } : c,
  )

  const media = ensureMediaFeed(save)
  let next: GameSave = {
    ...save,
    players: reaction.players,
    clubs,
    fans: reaction.fans,
    board: reaction.board,
    media: {
      ...media,
      lastPlantByClub: {
        ...media.lastPlantByClub,
        [payerClubId]: save.currentDate,
      },
    },
  }

  next = pushMedia(next, reaction.romano, reaction.social)
  next = { ...next, dynamics: recomputeDynamics(next) }

  const inbox: InboxMessage = {
    id: `msg-romano-plant-${Date.now()}`,
    date: save.currentDate,
    title: isHumanPayer
      ? exposed
        ? 'Romano: แคมเปญแตก'
        : 'Romano: ปล่อยข่าวแล้ว'
      : exposed
        ? `สื่อ: ${payer.shortName} โดนแฉซื้อข่าว`
        : `Romano: ข่าวจาก ${payer.shortName}`,
    body: `${reaction.summary} · จ่าย ${gate.cost.toLocaleString('th-TH')} € · คูลดาวน์ ${ROMANO_PLANT_COOLDOWN_DAYS} วัน`,
    read: false,
  }

  next = {
    ...next,
    inbox: [inbox, ...next.inbox].slice(0, 40),
  }

  return {
    ok: true,
    save: next,
    message: `${reaction.summary} (จ่าย ${gate.cost.toLocaleString('th-TH')} €)`,
  }
}

/** AI สโมสรที่มีงบ — สุ่มจ้าง Romano หลังแมตช์เดย์ */
export function maybeAiRomanoPlants(save: GameSave): GameSave {
  const rng = mulberry32(save.season * 1301 + save.matchday * 59 + 42)
  let next = save

  const aiClubs = next.clubs
    .filter((c) => c.controlledBy === 'ai')
    .filter((c) => {
      const gate = canPlantRomano(next, c.id)
      return gate.ok && c.balance > gate.cost * 1.35
    })
    .sort((a, b) => b.balance - a.balance)

  // at most 1 AI plant per week
  if (aiClubs.length === 0 || rng() > 0.22) return next

  const payer = aiClubs[Math.floor(rng() * Math.min(5, aiClubs.length))]
  const roll = rng()

  let kind: RomanoPlantKind
  let opts: PlantOpts = {}

  if (roll < 0.28) {
    kind = 'hype_club'
  } else if (roll < 0.5) {
    const stars = next.players
      .filter((p) => p.clubId === payer.id)
      .sort((a, b) => b.overall - a.overall)
    if (!stars[0]) return next
    kind = 'hype_star'
    opts = { playerId: stars[0].id }
  } else if (roll < 0.75) {
    kind = 'smear_rival'
    // often target human if strong, else random rival
    const human = next.clubs.find((c) => c.id === next.humanClubId)!
    const rivals = next.clubs.filter((c) => c.id !== payer.id && c.controlledBy === 'ai')
    opts = {
      rivalClubId:
        rng() < 0.55 ? human.id : rivals[Math.floor(rng() * rivals.length)]?.id ?? human.id,
    }
  } else {
    kind = 'poach_bait'
    const targets = next.players
      .filter((p) => p.clubId !== payer.id && p.overall >= 76)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 10)
    // prefer human stars
    const humanStars = targets.filter((p) => p.clubId === next.humanClubId)
    const pool = humanStars.length && rng() < 0.5 ? humanStars : targets
    if (!pool[0]) return next
    opts = { playerId: pool[Math.floor(rng() * pool.length)].id }
  }

  const result = plantRomanoStory(next, payer.id, kind, opts)
  if (result.ok) next = result.save
  return next
}
