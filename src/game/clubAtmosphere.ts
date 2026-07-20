import type {
  AtmosphereLog,
  FanState,
  GameSave,
  OwnerDemand,
  OwnerDemandKind,
  OwnerStadiumLog,
} from './types'
import { ensureBoard } from './board'
import { ensureFanState, fanInbox } from './fans'
import { ensureOwner } from './owner'

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

export const FAN_FACTION_LABEL = {
  ultras: 'หัวรุนแรง / Ultras',
  soft: 'ซอฟต์ / ครอบครัว',
  casual: 'แฟนทั่วไป',
  corporate: 'คอร์ปอเรต',
  international: 'แฟนต่างชาติ',
} as const

export type FanFactionKey = keyof typeof FAN_FACTION_LABEL

function pushLog(
  fans: FanState,
  log: Omit<AtmosphereLog, 'id'>,
): FanState {
  const entry: AtmosphereLog = { ...log, id: uid('atm') }
  return {
    ...fans,
    atmosphereLogs: [entry, ...(fans.atmosphereLogs ?? [])].slice(0, 24),
  }
}

function ownerLog(
  save: GameSave,
  attended: boolean,
  action: string,
  note: string,
): OwnerStadiumLog {
  return {
    id: uid('own-stad'),
    date: save.currentDate,
    matchday: save.matchday,
    attended,
    action,
    note,
  }
}

/** โอกาสเจ้าของมาดูนัดเหย้า */
function ownerAttendChance(save: GameSave, wasHome: boolean): number {
  if (!wasHome) return 0
  const owner = ensureOwner(save)
  let p = 0.28
  if (owner.personality === 'local_hero') p += 0.22
  if (owner.personality === 'meddling') p += 0.18
  if (owner.personality === 'glory_hunter') p += 0.1
  if (owner.personality === 'frugal') p -= 0.08
  if (owner.relationship < 40) p += 0.12
  if (owner.relationship > 75) p += 0.08
  if (save.matchday - (owner.lastStadiumVisitMatchday ?? -99) < 2) p *= 0.35
  return Math.min(0.82, Math.max(0.08, p))
}

function boardAttendChance(save: GameSave, wasHome: boolean): number {
  if (!wasHome) return 0
  const board = ensureBoard(save)
  let p = 0.22
  if (board.confidence < 40) p += 0.2
  if (board.ultimatum) p += 0.25
  if (board.publicSupport) p += 0.1
  if (save.matchday - (board.lastStadiumVisitMatchday ?? -99) < 3) p *= 0.4
  return Math.min(0.75, Math.max(0.06, p))
}

const OWNER_DEMAND_NOTES: Record<OwnerDemandKind, string> = {
  sign_star: 'เจ้าของสั่ง: ต้องเสริมดาวในตลาดถัดไป',
  play_youth: 'เจ้าของสั่ง: ให้เยาวชนลงสนามมากขึ้น',
  win_next: 'เจ้าของสั่ง: นัดหน้าต้องชนะ',
  cut_wages: 'เจ้าของสั่ง: คุมงบค่าจ้าง — อย่าเซ็นแพงเกิน',
  attacking_style: 'เจ้าของสั่ง: เล่นเกมรุกชัดกว่านี้',
  meet_fans: 'เจ้าของสั่ง: ออกไปคุยกับแฟนหลังเกม',
}

function rollOwnerDemand(save: GameSave): OwnerDemand | null {
  const owner = ensureOwner(save)
  if (owner.pendingDemand?.status === 'pending') return owner.pendingDemand
  if (owner.personality !== 'meddling' && Math.random() > 0.35) return null
  const kinds: OwnerDemandKind[] =
    owner.personality === 'frugal'
      ? ['cut_wages', 'win_next', 'meet_fans']
      : owner.personality === 'local_hero'
        ? ['meet_fans', 'play_youth', 'win_next']
        : owner.personality === 'glory_hunter'
          ? ['sign_star', 'win_next', 'attacking_style']
          : ['sign_star', 'play_youth', 'win_next', 'attacking_style', 'meet_fans']
  const kind = kinds[Math.floor(Math.random() * kinds.length)]
  return {
    id: uid('od'),
    kind,
    issuedMatchday: save.matchday,
    dueMatchday: save.matchday + 3,
    note: OWNER_DEMAND_NOTES[kind],
    status: 'pending',
  }
}

/**
 * หลังแมตช์ของมนุษย์ — เจ้าของ/บอร์ด/กลุ่มแฟนในสนาม
 */
export function processStadiumPresence(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  wasHome: boolean,
): GameSave {
  let owner = ensureOwner(save)
  let board = ensureBoard(save)
  let fans = ensureFanState(save.fans)
  let inbox = save.inbox
  let clubs = save.clubs
  const won = usGoals > themGoals
  const lost = usGoals < themGoals
  const human = clubs.find((c) => c.id === save.humanClubId)!

  // —— กลุ่มแฟนในสนาม (เหย้าแรงกว่า) ——
  if (wasHome) {
    const f = fans.factions
    // Ultras: tifo / ระเบิดพลุ / ปะทะ
    if (f.ultras >= 62 && Math.random() < 0.28) {
      if (won) {
        fans = {
          ...fans,
          mood: clamp(fans.mood + 3),
          factions: { ...f, ultras: clamp(f.ultras + 4) },
          lastEvent: 'Ultras จัด tifo ยักษ์ — อัฒจันทร์ระเบิด',
        }
        fans = pushLog(fans, {
          date: save.currentDate,
          matchday: save.matchday,
          kind: 'fans',
          title: 'Tifo Ultras',
          body: fans.lastEvent,
        })
      } else if (lost && f.ultras >= 70) {
        const fine = 80_000 + Math.round(Math.random() * 120_000)
        clubs = clubs.map((c) =>
          c.id === human.id ? { ...c, balance: c.balance - fine } : c,
        )
        fans = {
          ...fans,
          mood: clamp(fans.mood - 2),
          factions: { ...f, ultras: clamp(f.ultras + 2), soft: clamp(f.soft - 4) },
          protestActive: fans.mood < 40 || fans.protestActive,
          lastEvent: `กลุ่มหัวรุนแรงจุดพลุ/ปาระเบิดควัน — สโมสรโดนปรับ €${fine.toLocaleString('th-TH')}`,
        }
        fans = pushLog(fans, {
          date: save.currentDate,
          matchday: save.matchday,
          kind: 'fans',
          title: 'อุลตร้าส์เดือด',
          body: fans.lastEvent,
        })
        inbox = [fanInbox(save, 'วินัยแฟน', fans.lastEvent), ...inbox].slice(0, 40)
        board = {
          ...board,
          confidence: clamp(board.confidence - 2),
          lastNote: 'บอร์ดไม่พอใจภาพลักษณ์จากกลุ่มหัวรุนแรง',
        }
      }
    }

    // Soft / ครอบครัว
    if (f.soft >= 55 && Math.random() < 0.22) {
      fans = {
        ...fans,
        mood: clamp(fans.mood + (won ? 2 : 1)),
        loyalty: clamp(fans.loyalty + 1),
        factions: { ...f, soft: clamp(f.soft + 2) },
        lastEvent: won
          ? 'โซนครอบครัวเต็ม — เด็กๆ ร้องเพลงหลังชนะ'
          : 'แฟนซอฟต์ยังเชียร์เงียบๆ แม้ผลไม่ดี',
      }
      fans = pushLog(fans, {
        date: save.currentDate,
        matchday: save.matchday,
        kind: 'fans',
        title: 'โซนครอบครัว',
        body: fans.lastEvent,
      })
    }

    // International tourists
    if (f.international >= 48 && Math.random() < 0.25) {
      const shirtBoost = 40_000 + Math.round(f.international * 900)
      clubs = clubs.map((c) =>
        c.id === human.id
          ? {
              ...c,
              balance: c.balance + shirtBoost,
            }
          : c,
      )
      fans = {
        ...fans,
        factions: {
          ...fans.factions,
          international: clamp(fans.factions.international + (won ? 3 : 1)),
          corporate: clamp(fans.factions.corporate + 1),
        },
        lastEvent: `แฟนต่างชาติเต็มทัวร์ — ขายเสื้อเพิ่ม €${shirtBoost.toLocaleString('th-TH')}`,
      }
      fans = pushLog(fans, {
        date: save.currentDate,
        matchday: save.matchday,
        kind: 'fans',
        title: 'ทัวร์ต่างชาติ',
        body: fans.lastEvent,
      })
    }

    // Corporate hospitality
    if (f.corporate >= 60 && board.kpis.some((k) => k.id === 'finance' && k.met) && Math.random() < 0.18) {
      fans = {
        ...fans,
        factions: { ...fans.factions, corporate: clamp(fans.factions.corporate + 2) },
        lastEvent: 'ห้อง VIP คอร์ปเต็ม — สปอนเซอร์พอใจภาพลักษณ์',
      }
    }
  }

  // —— เจ้าของมาดู ——
  if (Math.random() < ownerAttendChance(save, wasHome)) {
    const actions = pickOwnerStadiumAction(owner.personality, won, lost)
    let rel = actions.rel
    let note = `${owner.name} มาดูที่สนาม: ${actions.label}`
    if (owner.personality === 'meddling' && Math.random() < 0.45) {
      const demand = rollOwnerDemand(save)
      if (demand) {
        owner = { ...owner, pendingDemand: demand }
        note += ` · ${demand.note}`
        inbox = [
          {
            id: uid('msg-od'),
            date: save.currentDate,
            title: 'คำสั่งจากเจ้าของในสนาม',
            body: demand.note,
            read: false,
          },
          ...inbox,
        ].slice(0, 40)
      }
    }
    if (actions.dressingRoomPraise) {
      // soft morale via dynamics if present — bump fan/board instead
      fans = { ...fans, mood: clamp(fans.mood + 2) }
      board = { ...board, confidence: clamp(board.confidence + 1) }
    }
    if (actions.publicCritic) {
      fans = {
        ...fans,
        mood: clamp(fans.mood - 3),
        factions: {
          ...fans.factions,
          ultras: clamp(fans.factions.ultras + 3),
          soft: clamp(fans.factions.soft - 2),
        },
      }
      board = { ...board, confidence: clamp(board.confidence - 3) }
      rel -= 2
    }
    if (actions.photoFans) {
      fans = {
        ...fans,
        mood: clamp(fans.mood + 4),
        loyalty: clamp(fans.loyalty + 2),
        factions: {
          ...fans.factions,
          soft: clamp(fans.factions.soft + 3),
          casual: clamp(fans.factions.casual + 2),
        },
      }
      rel += 2
    }

    const log = ownerLog(save, true, actions.id, note)
    owner = {
      ...owner,
      relationship: clamp(owner.relationship + rel),
      lastStadiumVisitMatchday: save.matchday,
      stadiumLogs: [log, ...(owner.stadiumLogs ?? [])].slice(0, 16),
      lastNote: note,
    }
    fans = pushLog(fans, {
      date: save.currentDate,
      matchday: save.matchday,
      kind: 'owner',
      title: 'เจ้าของมาสนาม',
      body: note,
    })
    inbox = [
      {
        id: uid('msg-own-stad'),
        date: save.currentDate,
        title: 'เจ้าของมาดูเกม',
        body: note,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  // —— บอร์ดมาดู ——
  if (Math.random() < boardAttendChance(save, wasHome)) {
    let note = 'กรรมการบอร์ดนั่ง VIP ดูเกมเอง'
    let conf = 0
    if (won) {
      conf = 3
      note = 'บอร์ดปรบมือใน VIP หลังชนะ — สัญญาณดี'
      if (board.publicSupport) conf += 1
    } else if (lost) {
      conf = -4
      note = 'บอร์ดหน้าบึ้งใน VIP — นัดหลังเกมถามแผน'
      if (board.confidence < 45 && Math.random() < 0.35) {
        board = {
          ...board,
          transferFreezeUntil: Math.max(board.transferFreezeUntil ?? -1, save.matchday + 2),
          lastNote: 'บอร์ดแช่แข็งตลาดชั่วคราวหลังมาดูแล้วไม่พอใจ',
        }
        note += ' · สั่งแช่แข็งตลาด 2 MD'
        inbox = [
          {
            id: uid('msg-freeze'),
            date: save.currentDate,
            title: 'บอร์ดแช่แข็งตลาด',
            body: board.lastNote,
            read: false,
          },
          ...inbox,
        ].slice(0, 40)
      }
    } else {
      conf = -1
      note = 'บอร์ดจดโน้ตใน VIP — ขอเห็นความคืบหน้าชัดกว่านี้'
    }
    board = {
      ...board,
      confidence: clamp(board.confidence + conf),
      lastStadiumVisitMatchday: save.matchday,
      lastNote: note,
    }
    fans = pushLog(fans, {
      date: save.currentDate,
      matchday: save.matchday,
      kind: 'board',
      title: 'บอร์ดมาสนาม',
      body: note,
    })
  }

  // หมดอายุคำสั่งเจ้าของ
  if (owner.pendingDemand?.status === 'pending' && save.matchday > owner.pendingDemand.dueMatchday) {
    owner = {
      ...owner,
      pendingDemand: { ...owner.pendingDemand, status: 'failed' },
      relationship: clamp(owner.relationship - 6),
      patience: clamp(owner.patience - 4),
      lastNote: `พ้นกำหนดคำสั่ง: ${owner.pendingDemand.note}`,
    }
    board = { ...board, confidence: clamp(board.confidence - 2) }
  }

  // หมดแช่แข็งตลาด
  if ((board.transferFreezeUntil ?? -1) >= 0 && save.matchday > board.transferFreezeUntil) {
    board = {
      ...board,
      transferFreezeUntil: -1,
      lastNote: 'บอร์ดปลดล็อกตลาดแล้ว',
    }
  }

  return { ...save, owner, board, fans, inbox, clubs }
}

function pickOwnerStadiumAction(
  personality: string,
  won: boolean,
  lost: boolean,
): {
  id: string
  label: string
  rel: number
  dressingRoomPraise: boolean
  publicCritic: boolean
  photoFans: boolean
} {
  const pool: ReturnType<typeof pickOwnerStadiumAction>[] = []
  if (won) {
    pool.push({
      id: 'praise_room',
      label: 'ลงห้องแต่งตัวชมทีม',
      rel: 3,
      dressingRoomPraise: true,
      publicCritic: false,
      photoFans: false,
    })
    pool.push({
      id: 'photo_fans',
      label: 'ถ่ายรูปกับแฟนหลังเกม',
      rel: 2,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: true,
    })
    pool.push({
      id: 'vip_quiet',
      label: 'นั่งเงียบใน VIP ทั้งเกม',
      rel: 1,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: false,
    })
  } else if (lost) {
    pool.push({
      id: 'leave_early',
      label: 'เดินออกจากสนามก่อนจบเกม',
      rel: -4,
      dressingRoomPraise: false,
      publicCritic: true,
      photoFans: false,
    })
    pool.push({
      id: 'public_critic',
      label: 'พูดกับสื่อหน้าสนามว่าไม่พอใจ',
      rel: -5,
      dressingRoomPraise: false,
      publicCritic: true,
      photoFans: false,
    })
    pool.push({
      id: 'demand_meeting',
      label: 'เรียกประชุมด่วนหลังเกม',
      rel: -2,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: false,
    })
    if (personality === 'local_hero' || personality === 'patient') {
      pool.push({
        id: 'calm_fans',
        label: 'ออกไปขอให้แฟนใจเย็น',
        rel: 1,
        dressingRoomPraise: false,
        publicCritic: false,
        photoFans: true,
      })
    }
  } else {
    pool.push({
      id: 'vip_quiet',
      label: 'จดโน้ตใน VIP ตลอดเกม',
      rel: 0,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: false,
    })
    pool.push({
      id: 'photo_fans',
      label: 'ทักทายโซนครอบครัว',
      rel: 1,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: true,
    })
  }
  if (personality === 'meddling') {
    pool.push({
      id: 'pitchside',
      label: 'ยืนข้างสนามส่งสัญญาณให้โค้ช',
      rel: -1,
      dressingRoomPraise: false,
      publicCritic: false,
      photoFans: false,
    })
  }
  return pool[Math.floor(Math.random() * pool.length)]
}

/** ผู้จัดการเชิญเจ้าของมาดูนัดเหย้าถัดไป */
export function inviteOwnerToStadium(save: GameSave): { ok: boolean; save: GameSave; message: string } {
  const owner = ensureOwner(save)
  if (save.matchday - (owner.lastStadiumVisitMatchday ?? -99) < 1) {
    return { ok: false, save, message: 'เพิ่งมาดูไป — รอสักนัด' }
  }
  const log = ownerLog(save, false, 'invited', `เชิญ ${owner.name} มาดูนัดเหย้าถัดไป`)
  const nextOwner = {
    ...owner,
    relationship: clamp(owner.relationship + 2),
    lastNote: `${owner.name} รับคำเชิญ — มีโอกาสมาสนามสูงขึ้น`,
    stadiumLogs: [log, ...(owner.stadiumLogs ?? [])].slice(0, 16),
    // บังคับโอกาสสูงโดยตั้ง lastVisit ไกล
    lastStadiumVisitMatchday: save.matchday - 10,
  }
  // stash invite flag via patience bump + note; attend chance already uses relationship
  const fans = pushLog(ensureFanState(save.fans), {
    date: save.currentDate,
    matchday: save.matchday,
    kind: 'owner',
    title: 'เชิญเจ้าของ',
    body: nextOwner.lastNote,
  })
  return {
    ok: true,
    save: {
      ...save,
      owner: { ...nextOwner, relationship: clamp(nextOwner.relationship + 1) },
      fans: { ...fans, lastEvent: nextOwner.lastNote },
      inbox: [
        {
          id: uid('msg-invite'),
          date: save.currentDate,
          title: 'เชิญเจ้าของมาสนาม',
          body: nextOwner.lastNote,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
    message: nextOwner.lastNote,
  }
}

/** ขอให้บอร์ดออกแถลงสนับสนุนสาธารณะ */
export function requestBoardPublicSupport(
  save: GameSave,
): { ok: boolean; save: GameSave; message: string } {
  const board = ensureBoard(save)
  const owner = ensureOwner(save)
  if (board.publicSupport) {
    return { ok: false, save, message: 'บอร์ดสนับสนุนอยู่แล้ว' }
  }
  const chance = 0.25 + board.confidence / 200 + owner.relationship / 250
  if (Math.random() > chance) {
    return {
      ok: false,
      save: {
        ...save,
        board: {
          ...board,
          confidence: clamp(board.confidence - 2),
          lastNote: 'บอร์ดปฏิเสธแถลงสนับสนุน — ยังไม่มั่นใจพอ',
        },
      },
      message: 'บอร์ดยังไม่พร้อมออกแถลง',
    }
  }
  const fans = ensureFanState(save.fans)
  return {
    ok: true,
    save: {
      ...save,
      board: {
        ...board,
        publicSupport: true,
        confidence: clamp(board.confidence + 4),
        lastNote: 'บอร์ดออกแถลงสนับสนุนผู้จัดการต่อสาธารณะ',
      },
      fans: {
        ...fans,
        mood: clamp(fans.mood + 3),
        lastEvent: 'บอร์ดยืนยันหนุนโค้ช — แฟนทั่วไปโล่งใจ',
        factions: {
          ...fans.factions,
          casual: clamp(fans.factions.casual + 3),
          soft: clamp(fans.factions.soft + 2),
        },
      },
      inbox: [
        {
          id: uid('msg-support'),
          date: save.currentDate,
          title: 'บอร์ดสนับสนุนสาธารณะ',
          body: 'บอร์ดยืนยันยังเชื่อมั่นในผู้จัดการ',
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
    message: 'ได้แถลงสนับสนุนจากบอร์ด',
  }
}

/** ประชุมฉุกเฉินกับบอร์ด */
export function callBoardEmergencyMeeting(
  save: GameSave,
): { ok: boolean; save: GameSave; message: string } {
  const board = ensureBoard(save)
  const owner = ensureOwner(save)
  if (board.confidence >= 70) {
    return {
      ok: true,
      save: {
        ...save,
        board: {
          ...board,
          confidence: clamp(board.confidence + 2),
          lastNote: 'ประชุมฉุกเฉิน — บอร์ดพอใจแผนที่เสนอ',
        },
        owner: {
          ...owner,
          relationship: clamp(owner.relationship + 1),
          lastNote: `${owner.name} ร่วมประชุมและเห็นด้วย`,
        },
      },
      message: 'ประชุมผ่าน — บอร์ดพอใจ',
    }
  }
  if (board.confidence < 35 && Math.random() < 0.4) {
    return {
      ok: false,
      save: {
        ...save,
        board: {
          ...board,
          confidence: clamp(board.confidence - 3),
          transferFreezeUntil: Math.max(board.transferFreezeUntil ?? -1, save.matchday + 1),
          lastNote: 'ประชุมฉุกเฉินแตก — บอร์ดแช่แข็งตลาด 1 MD',
        },
      },
      message: 'ประชุมล้มเหลว — ตลาดถูกแช่แข็ง',
    }
  }
  return {
    ok: true,
    save: {
      ...save,
      board: {
        ...board,
        confidence: clamp(board.confidence + 3),
        lowConfidenceStreak: Math.max(0, board.lowConfidenceStreak - 1),
        lastNote: 'ประชุมฉุกเฉิน — ได้เวลาพิสูจน์อีกนิด',
      },
    },
    message: 'บอร์ดให้โอกาสต่อ',
  }
}

/** เข้าหา / ไกล่เกลี่ยกลุ่มแฟน */
export function outreachFanFaction(
  save: GameSave,
  faction: FanFactionKey,
): { ok: boolean; save: GameSave; message: string } {
  let fans = ensureFanState(save.fans)
  let board = ensureBoard(save)
  let clubs = save.clubs
  const label = FAN_FACTION_LABEL[faction]
  const cost = faction === 'international' ? 120_000 : faction === 'ultras' ? 40_000 : 60_000
  const human = clubs.find((c) => c.id === save.humanClubId)!
  if (human.balance < cost) {
    return { ok: false, save, message: `งบไม่พอ (ต้องการ €${cost.toLocaleString('th-TH')})` }
  }
  clubs = clubs.map((c) =>
    c.id === human.id ? { ...c, balance: c.balance - cost } : c,
  )

  let message = ''
  const f = { ...fans.factions }
  switch (faction) {
    case 'ultras':
      f.ultras = clamp(f.ultras + 5)
      fans = {
        ...fans,
        mood: clamp(fans.mood + (fans.protestActive ? 5 : 2)),
        protestActive: fans.mood + 5 >= 45 ? false : fans.protestActive,
        lastEvent: 'คุยกับหัวหน้า Ultras — ลดความตึงเครียดชั่วคราว',
      }
      message = fans.lastEvent
      break
    case 'soft':
      f.soft = clamp(f.soft + 6)
      fans = {
        ...fans,
        loyalty: clamp(fans.loyalty + 3),
        mood: clamp(fans.mood + 3),
        lastEvent: 'จัด Family Day — โซนครอบครัวอบอุ่นขึ้น',
      }
      message = fans.lastEvent
      break
    case 'casual':
      f.casual = clamp(f.casual + 4)
      fans = {
        ...fans,
        mood: clamp(fans.mood + 2),
        lastEvent: 'เปิดทาวน์ฮอลล์คุยแฟนทั่วไป',
      }
      message = fans.lastEvent
      break
    case 'corporate':
      f.corporate = clamp(f.corporate + 5)
      board = { ...board, confidence: clamp(board.confidence + 2) }
      fans = {
        ...fans,
        lastEvent: 'ดินเนอร์สปอนเซอร์ — คอร์ปพอใจ',
      }
      message = fans.lastEvent
      break
    case 'international':
      f.international = clamp(f.international + 8)
      clubs = clubs.map((c) =>
        c.id === human.id
          ? { ...c, balance: c.balance + 80_000, reputation: Math.min(99, c.reputation + 1) }
          : c,
      )
      fans = {
        ...fans,
        lastEvent: 'ทัวร์ต่างชาติ + แพ็กเกจท่องเที่ยวฟุตบอล — ชื่อเสียงคลับดีขึ้น',
      }
      message = fans.lastEvent
      break
  }
  fans = {
    ...pushLog(
      { ...fans, factions: f },
      {
        date: save.currentDate,
        matchday: save.matchday,
        kind: 'fans',
        title: `เข้าหา: ${label}`,
        body: message,
      },
    ),
    factions: f,
    lastVerdict: message,
  }

  return {
    ok: true,
    save: { ...save, fans, board, clubs },
    message,
  }
}

/** ตอบคำสั่งเจ้าของ */
export function resolveOwnerDemand(
  save: GameSave,
  accept: boolean,
): { ok: boolean; save: GameSave; message: string } {
  const owner = ensureOwner(save)
  const demand = owner.pendingDemand
  if (!demand || demand.status !== 'pending') {
    return { ok: false, save, message: 'ไม่มีคำสั่งค้าง' }
  }
  if (!accept) {
    return {
      ok: true,
      save: {
        ...save,
        owner: {
          ...owner,
          pendingDemand: { ...demand, status: 'failed' },
          relationship: clamp(owner.relationship - 8),
          patience: clamp(owner.patience - 5),
          lastNote: `ปฏิเสธคำสั่ง: ${demand.note}`,
        },
        board: {
          ...ensureBoard(save),
          confidence: clamp(ensureBoard(save).confidence - 3),
        },
      },
      message: 'ปฏิเสธคำสั่งเจ้าของ — ความสัมพันธ์ตก',
    }
  }
  // accept = สัญญาจะทำ — ให้บัฟเล็กน้อย ต้องพิสูจน์ด้วยผลงาน
  return {
    ok: true,
    save: {
      ...save,
      owner: {
        ...owner,
        pendingDemand: { ...demand, status: 'done' },
        relationship: clamp(owner.relationship + 4),
        lastNote: `รับคำสั่ง: ${demand.note}`,
      },
      fans:
        demand.kind === 'meet_fans'
          ? {
              ...ensureFanState(save.fans),
              mood: clamp(ensureFanState(save.fans).mood + 4),
              lastEvent: 'ผู้จัดการออกไปคุยแฟนตามคำสั่งเจ้าของ',
            }
          : save.fans,
      tacticsByClub:
        demand.kind === 'attacking_style'
          ? {
              ...save.tacticsByClub,
              [save.humanClubId]: {
                ...save.tacticsByClub[save.humanClubId],
                instructions: {
                  ...save.tacticsByClub[save.humanClubId].instructions,
                  mentality: 'attacking' as const,
                  style: 'possession' as const,
                },
              },
            }
          : save.tacticsByClub,
    },
    message: `รับคำสั่งแล้ว: ${demand.note}`,
  }
}

export function isTransferFrozen(save: GameSave): boolean {
  const board = ensureBoard(save)
  return (board.transferFreezeUntil ?? -1) >= save.matchday
}
