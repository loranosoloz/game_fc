import type {
  Club,
  ClubFansState,
  FanHateReason,
  FanHatred,
  FanState,
  FanTeamHateStyle,
  FanTeamHatred,
  GameSave,
  InboxMessage,
  Player,
} from './types'
import { areRivals, ensureRivalries } from './rivalries'

export function createFanState(clubReputation: number): FanState {
  const base = Math.min(78, 52 + Math.round(clubReputation / 4))
  const intl = Math.min(70, 35 + Math.round(clubReputation / 5))
  return {
    mood: base,
    expectation: Math.min(85, 45 + Math.round(clubReputation / 3)),
    loyalty: Math.min(80, 40 + Math.round(clubReputation / 4)),
    factions: {
      ultras: 55 + Math.round(clubReputation / 10),
      soft: 58 + Math.round(clubReputation / 12),
      casual: 60,
      corporate: 50 + Math.round(clubReputation / 8),
      international: intl,
    },
    lastVerdict: 'แฟนบอลพร้อมสนับสนุนฤดูกาลใหม่',
    protestActive: false,
    boycottUntilMatchday: -1,
    lastEvent: 'เปิดฤดูกาล — อัฒจันทร์พร้อม',
    atmosphereLogs: [],
    hatedPlayers: [],
    hatedTeams: [],
  }
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function defaultFactions(clubRep: number, partial?: FanState['factions']) {
  const fresh = createFanState(clubRep).factions
  return {
    ultras: partial?.ultras ?? fresh.ultras,
    soft: partial?.soft ?? fresh.soft,
    casual: partial?.casual ?? fresh.casual,
    corporate: partial?.corporate ?? fresh.corporate,
    international: partial?.international ?? fresh.international,
  }
}

export function ensureFanState(fans: FanState | undefined, clubRep = 50): FanState {
  if (!fans) return createFanState(clubRep)
  const base = createFanState(clubRep)
  return {
    ...base,
    ...fans,
    factions: defaultFactions(clubRep, fans.factions),
    protestActive: fans.protestActive ?? false,
    boycottUntilMatchday: fans.boycottUntilMatchday ?? -1,
    lastEvent: fans.lastEvent ?? fans.lastVerdict,
    atmosphereLogs: fans.atmosphereLogs ?? [],
    hatedPlayers: fans.hatedPlayers ?? [],
    hatedTeams: fans.hatedTeams ?? [],
  }
}

export function fanMoodLabel(mood: number): string {
  if (mood >= 80) return 'คลั่งไคล้'
  if (mood >= 65) return 'พอใจ'
  if (mood >= 50) return 'เฉยๆ'
  if (mood >= 35) return 'ไม่พอใจ'
  return 'โกรธจัด'
}

export function fanTicketMultiplier(fans: FanState, matchday = 0): number {
  const f = ensureFanState(fans)
  let m = 0.62 + (f.mood / 100) * 0.66
  if (f.boycottUntilMatchday >= matchday) m *= 0.55
  if (f.protestActive) m *= 0.85
  m *= 0.92 + f.loyalty / 800
  // soft + international ดึงตั๋ว/ทัวร์
  m *= 1 + f.factions.soft / 900 + f.factions.international / 700
  // ultras สูงมากแต่ประท้วง → ตั๋วตก
  if (f.factions.ultras > 75 && f.mood < 40) m *= 0.92
  return m
}

export function applyMatchToFans(
  fans: FanState,
  usGoals: number,
  themGoals: number,
  wasHome: boolean,
): FanState {
  const base = ensureFanState(fans)
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  const gd = usGoals - themGoals
  let delta = 0
  if (won) delta = 4 + Math.min(4, gd) + (wasHome ? 1 : 2)
  else if (drawn) delta = wasHome ? -1 : 1
  else delta = -5 - Math.min(4, -gd) - (wasHome ? 2 : 0)

  const pressure = (base.expectation - 50) / 50
  if (won) delta -= pressure * 1.5
  if (!won && !drawn) delta -= pressure * 3

  const cushion = base.loyalty / 200
  if (delta < 0) delta *= 1 - cushion

  const mood = clamp(base.mood + delta)
  let loyalty = base.loyalty
  if (won) loyalty = clamp(loyalty + 0.4)
  if (!won && !drawn && wasHome) loyalty = clamp(loyalty - 0.6)

  let verdict = base.lastVerdict
  if (won) verdict = wasHome ? 'อัฒจันทร์ระเบิด! ชนะในบ้าน' : 'แฟนบอลชื่นชมชัยชนะเยือน'
  else if (drawn) verdict = 'ผลเสมอทำให้แฟนงงๆ — อยากเห็นเกมชัดกว่านี้'
  else verdict = wasHome ? 'แพ้ในบ้าน — เสียงโห่ดังก้อง' : 'แพ้เยือน — แฟนเริ่มกังวลฟอร์ม'

  let protestActive = base.protestActive
  let lastEvent = base.lastEvent
  if (mood < 32 && !won && wasHome) {
    protestActive = true
    lastEvent = 'แฟนเริ่มประท้วงหลังเกมบ้าน'
  }
  if (mood >= 55) protestActive = false

  const fac = base.factions
  return {
    ...base,
    mood,
    loyalty,
    expectation: clamp(base.expectation + (won ? 1 : drawn ? 0 : -1)),
    factions: {
      ultras: clamp(fac.ultras + (won ? 3 : -4)),
      soft: clamp(fac.soft + (won ? 2 : drawn ? 0 : -1)),
      casual: clamp(fac.casual + (won ? 2 : drawn ? 0 : -2)),
      corporate: clamp(fac.corporate + (won ? 1 : drawn ? 0 : -1)),
      international: clamp(fac.international + (won && wasHome ? 2 : lostAway(wasHome, won) ? -1 : 0)),
    },
    lastVerdict: verdict,
    protestActive,
    lastEvent,
  }
}

function lostAway(wasHome: boolean, won: boolean) {
  return !wasHome && !won
}

export type TransferFanKind =
  | 'buy_star'
  | 'buy_squad'
  | 'buy_flop_risk'
  | 'sell_star'
  | 'sell_surplus'
  | 'sell_veteran'

export function classifyTransferForFans(
  playerOverall: number,
  squadAvg: number,
  isBuy: boolean,
  wasKeyPlayer: boolean,
  age: number,
): TransferFanKind {
  if (isBuy) {
    if (playerOverall >= squadAvg + 4) return 'buy_star'
    if (playerOverall + 2 < squadAvg) return 'buy_flop_risk'
    return 'buy_squad'
  }
  if (wasKeyPlayer || playerOverall >= squadAvg + 2) return 'sell_star'
  if (age >= 32) return 'sell_veteran'
  return 'sell_surplus'
}

export function applyTransferToFans(
  fans: FanState,
  kind: TransferFanKind,
  playerName: string,
): { fans: FanState; message: string } {
  const base = ensureFanState(fans)
  let delta = 0
  let message = ''
  switch (kind) {
    case 'buy_star':
      delta = 6
      message = `แฟนคลั่ง! การซื้อ ${playerName} ถูกมองว่าเป็นสัญญาณความทะเยอทะยาน`
      break
    case 'buy_squad':
      delta = 2
      message = `แฟนพอใจการเสริม ${playerName} — ดูสมเหตุสมผล`
      break
    case 'buy_flop_risk':
      delta = -2
      message = `แฟนสงสัยคุณภาพของ ${playerName} — กลัวเสียเงินฟรี`
      break
    case 'sell_star':
      delta = -10
      message = `อัฒจันทร์เดือด! การขาย ${playerName} ถูกมองว่าขาดความทะเยอทะยาน`
      break
    case 'sell_veteran':
      delta = 1
      message = `แฟนเข้าใจการปล่อย ${playerName} ตามวัย — ขอให้ใช้เงินดีๆ`
      break
    case 'sell_surplus':
      delta = 2
      message = `แฟนโอเคกับการขาย ${playerName} ที่ความลึกตำแหน่งยังพอ`
      break
  }

  const mood = clamp(base.mood + delta)
  let protestActive = base.protestActive
  let boycottUntilMatchday = base.boycottUntilMatchday
  let lastEvent = base.lastEvent
  if (kind === 'sell_star' && mood < 40) {
    protestActive = true
    boycottUntilMatchday = Math.max(boycottUntilMatchday, 0)
    lastEvent = `ประท้วงขายดาว ${playerName}`
  }

  const fac = base.factions
  return {
    fans: {
      ...base,
      mood,
      protestActive,
      boycottUntilMatchday,
      lastEvent: lastEvent || message,
      factions: {
        ultras: clamp(fac.ultras + (kind === 'sell_star' ? -8 : kind === 'buy_star' ? 5 : 0)),
        soft: clamp(fac.soft + (kind === 'sell_star' ? -3 : kind === 'buy_star' ? 2 : delta * 0.3)),
        casual: clamp(fac.casual + delta * 0.6),
        corporate: clamp(
          fac.corporate +
            (kind === 'sell_star' || kind === 'sell_surplus' ? 3 : kind === 'buy_star' ? -1 : 0),
        ),
        international: clamp(
          fac.international + (kind === 'buy_star' ? 3 : kind === 'sell_star' ? -2 : 0),
        ),
      },
      lastVerdict: message,
    },
    message,
  }
}

/** สุ่มเหตุการณ์แฟนหลังแมตช์เดย์ */
export function processFanPolitics(save: GameSave): GameSave {
  let fans = ensureFanState(save.fans)
  let inbox = save.inbox
  let board = save.board

  if (fans.mood < 28 && !fans.protestActive && Math.random() < 0.4) {
    fans = {
      ...fans,
      protestActive: true,
      boycottUntilMatchday: save.matchday + 1,
      lastEvent: 'กลุ่มหัวรุนแรงนัดประท้วงหน้าสโมสร · คว่ำบาตรตั๋วนัดหน้า',
    }
    inbox = [
      {
        id: `msg-protest-${Date.now()}`,
        date: save.currentDate,
        title: 'แฟนประท้วง',
        body: fans.lastEvent,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
    board = {
      ...board,
      confidence: Math.max(0, board.confidence - 3),
      lastNote: 'บอร์ดกังวลภาพลักษณ์จากประท้วงแฟน',
    }
  }

  // soft fans ขอ Family Day เมื่อ mood กลางๆ
  if (
    !fans.protestActive &&
    fans.factions.soft >= 65 &&
    fans.mood >= 45 &&
    fans.mood < 70 &&
    Math.random() < 0.12
  ) {
    fans = {
      ...fans,
      lastEvent: 'กลุ่มซอฟต์ร้องขอ Family Day / โซนเด็กในสนาม',
    }
    inbox = [
      {
        id: `msg-soft-${Date.now()}`,
        date: save.currentDate,
        title: 'คำขอจากแฟนครอบครัว',
        body: fans.lastEvent + ' — ไปเข้าหาที่หน้า Club Vision',
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  // international tourism interest
  if (fans.factions.international >= 60 && Math.random() < 0.1) {
    fans = {
      ...fans,
      lastEvent: 'ทัวร์ต่างชาติสนใจแพ็กเกจดูบอลบ้าน — โอกาสรายได้เสื้อ',
      factions: {
        ...fans.factions,
        international: clamp(fans.factions.international + 1),
      },
    }
  }

  if (fans.protestActive && fans.mood >= 50) {
    fans = {
      ...fans,
      protestActive: false,
      lastEvent: 'บรรยากาศอัฒจันทร์สงบลง',
    }
  }

  if (fans.boycottUntilMatchday < save.matchday && fans.boycottUntilMatchday >= 0) {
    fans = { ...fans, boycottUntilMatchday: -1 }
  }

  // ความเกลียดค่อยๆ ลด — ทุกสโมสร
  fans = {
    ...fans,
    hatedPlayers: (fans.hatedPlayers ?? [])
      .map((h) => ({
        ...h,
        intensity: Math.max(0, h.intensity - (fans.factions.ultras >= 70 ? 0 : 1)),
      }))
      .filter((h) => h.intensity > 0)
      .slice(0, 24),
  }

  if (board.kpis?.some((k) => k.id === 'finance' && k.met) && Math.random() < 0.15) {
    fans = {
      ...fans,
      factions: {
        ...fans.factions,
        corporate: clamp(fans.factions.corporate + 2),
      },
      lastEvent: 'แฟนคอร์ปอเรตพอใจวินัยการเงิน',
    }
  }

  let next: GameSave = { ...save, fans, board, inbox }
  // decay ทุกคลับ
  next = {
    ...next,
    clubs: next.clubs.map((c) => {
      const cf = ensureClubFans(c)
      const ultrasish = c.reputation >= 75
      return {
        ...c,
        clubFans: {
          ...cf,
          hatedPlayers: cf.hatedPlayers
            .map((h) => ({
              ...h,
              intensity: Math.max(0, h.intensity - (ultrasish ? 0 : 1)),
            }))
            .filter((h) => h.intensity > 0)
            .slice(0, 24),
        },
      }
    }),
  }
  return syncHumanFansToClub({ ...next, fans })
}

const HATE_REASON_TH: Record<FanHateReason, string> = {
  to_rival: 'ย้ายไปคู่อริ',
  want_away: 'อยากย้ายจนสั่น',
  free_exit: 'ย้ายฟรี',
  refuse_contract: 'ไม่ยอมต่อสัญญา',
  sell_star: 'ขายดาวทิ้งคลับ',
  betrayal: 'ทรยศอัฒจันทร์',
}

export function hateReasonLabel(reason: FanHateReason): string {
  return HATE_REASON_TH[reason] ?? reason
}

export const FAN_TEAM_HATE_STYLE_TH: Record<FanTeamHateStyle, string> = {
  boo: 'โห่ใส่',
  banners: 'ติดป้ายด่า',
  hostile: 'บรรยากาศเป็นศัตรู',
}

const STYLE_RANK: Record<FanTeamHateStyle, number> = {
  boo: 1,
  banners: 2,
  hostile: 3,
}

export function fanTeamHateStyleFromHeat(heat: number): FanTeamHateStyle {
  if (heat >= 70) return 'hostile'
  if (heat >= 45) return 'banners'
  return 'boo'
}

export function fanTeamHatePctFromHeat(heat: number): number {
  return clamp(22 + Math.round(heat * 0.72), 20, 95)
}

export function strongerTeamHateStyle(a: FanTeamHateStyle, b: FanTeamHateStyle): FanTeamHateStyle {
  return STYLE_RANK[a] >= STYLE_RANK[b] ? a : b
}

function upsertHatedTeam(list: FanTeamHatred[], entry: FanTeamHatred): FanTeamHatred[] {
  const i = list.findIndex((x) => x.clubId === entry.clubId)
  if (i < 0) return [...list, entry].slice(0, 12)
  const cur = list[i]!
  const next = [...list]
  next[i] = {
    ...cur,
    pct: Math.max(cur.pct, entry.pct),
    style: strongerTeamHateStyle(cur.style, entry.style),
    reasonTh: entry.reasonTh || cur.reasonTh,
  }
  return next
}

/** sync รายชื่อทีมที่แฟนเกลียดจากคู่อริ */
export function seedClubHatedTeams(save: GameSave): GameSave {
  const rivs = ensureRivalries(save)
  if (!rivs.length) {
    return {
      ...save,
      clubs: save.clubs.map((c) => ({ ...c, clubFans: ensureClubFans(c) })),
    }
  }

  const pending = new Map<string, FanTeamHatred[]>()
  for (const r of rivs) {
    if (r.heat < 22) continue
    const a = save.clubs.find((c) => c.id === r.clubAId)
    const b = save.clubs.find((c) => c.id === r.clubBId)
    if (!a || !b) continue
    const style = fanTeamHateStyleFromHeat(r.heat)
    const pct = fanTeamHatePctFromHeat(r.heat)
    const add = (fromId: string, toId: string, toName: string) => {
      const list = pending.get(fromId) ?? []
      pending.set(
        fromId,
        upsertHatedTeam(list, {
          clubId: toId,
          pct,
          style,
          reasonTh: r.labelTh || `คู่อริกับ ${toName}`,
        }),
      )
    }
    add(a.id, b.id, b.shortName)
    add(b.id, a.id, a.shortName)
  }

  const clubs = save.clubs.map((c) => {
    const cf = ensureClubFans(c)
    const seeded = pending.get(c.id) ?? []
    let hatedTeams = cf.hatedTeams.slice()
    for (const s of seeded) hatedTeams = upsertHatedTeam(hatedTeams, s)
    return { ...c, clubFans: { ...cf, hatedTeams } }
  })

  const human = clubs.find((c) => c.id === save.humanClubId)
  const hf = ensureFanState(save.fans, human?.reputation ?? 50)
  return {
    ...save,
    clubs,
    fans: {
      ...hf,
      hatedTeams: human ? ensureClubFans(human).hatedTeams : hf.hatedTeams ?? [],
      hatedPlayers: human ? ensureClubFans(human).hatedPlayers : hf.hatedPlayers,
    },
  }
}

/** อัปเดตทีมที่เกลียดเมื่อคู่อริร้อนขึ้น */
export function syncHatedTeamsFromRivalry(
  save: GameSave,
  clubAId: string,
  clubBId: string,
  heat: number,
  labelTh: string,
): GameSave {
  if (heat < 22) return save
  const style = fanTeamHateStyleFromHeat(heat)
  const pct = fanTeamHatePctFromHeat(heat)
  const a = save.clubs.find((c) => c.id === clubAId)
  const b = save.clubs.find((c) => c.id === clubBId)
  if (!a || !b) return save
  let next = updateClubFans(save, clubAId, (cf) => ({
    ...cf,
    hatedTeams: upsertHatedTeam(cf.hatedTeams, {
      clubId: clubBId,
      pct,
      style,
      reasonTh: labelTh || `คู่อริกับ ${b.shortName}`,
    }),
  }))
  next = updateClubFans(next, clubBId, (cf) => ({
    ...cf,
    hatedTeams: upsertHatedTeam(cf.hatedTeams, {
      clubId: clubAId,
      pct,
      style,
      reasonTh: labelTh || `คู่อริกับ ${a.shortName}`,
    }),
  }))
  return next
}

export function createClubFans(clubRep: number): ClubFansState {
  return {
    mood: Math.min(78, 52 + Math.round(clubRep / 4)),
    hatedPlayers: [],
    hatedTeams: [],
    lastEvent: '',
  }
}

export function ensureClubFans(club: Club): ClubFansState {
  const base = club.clubFans ?? createClubFans(club.reputation)
  return {
    ...base,
    hatedPlayers: base.hatedPlayers ?? [],
    hatedTeams: base.hatedTeams ?? [],
    lastEvent: base.lastEvent ?? '',
  }
}

/** อัปเดตแฟนของคลับใดก็ได้ · sync ไป save.fans ถ้าเป็นทีมผู้เล่น */
export function updateClubFans(
  save: GameSave,
  clubId: string,
  updater: (fans: ClubFansState) => ClubFansState,
): GameSave {
  const clubs = save.clubs.map((c) => {
    if (c.id !== clubId) return c
    return { ...c, clubFans: updater(ensureClubFans(c)) }
  })
  let next: GameSave = { ...save, clubs }
  if (clubId === save.humanClubId) {
    const cf = ensureClubFans(clubs.find((c) => c.id === clubId)!)
    const hf = ensureFanState(next.fans, clubs.find((c) => c.id === clubId)?.reputation ?? 50)
    next = {
      ...next,
      fans: {
        ...hf,
        mood: cf.mood,
        hatedPlayers: cf.hatedPlayers,
        hatedTeams: cf.hatedTeams,
        lastEvent: cf.lastEvent || hf.lastEvent,
        lastVerdict: cf.lastEvent || hf.lastVerdict,
      },
    }
  }
  return next
}

/** sync save.fans → human club.clubFans (โหลดเซฟเก่า) */
export function syncHumanFansToClub(save: GameSave): GameSave {
  const human = save.clubs.find((c) => c.id === save.humanClubId)
  if (!human) return save
  const hf = ensureFanState(save.fans, human.reputation)
  const existing = ensureClubFans(human)
  const merged: ClubFansState = {
    mood: hf.mood,
    lastEvent: hf.lastEvent || existing.lastEvent,
    hatedPlayers: (hf.hatedPlayers?.length ? hf.hatedPlayers : existing.hatedPlayers).slice(0, 24),
    hatedTeams: (hf.hatedTeams?.length ? hf.hatedTeams : existing.hatedTeams).slice(0, 12),
  }
  return {
    ...save,
    clubs: save.clubs.map((c) =>
      c.id === save.humanClubId ? { ...c, clubFans: merged } : c,
    ),
    fans: { ...hf, hatedPlayers: merged.hatedPlayers, hatedTeams: merged.hatedTeams },
  }
}

function bumpHateList(
  list: FanHatred[],
  partial: {
    playerId: string
    playerName: string
    reason: FanHateReason
    intensity?: number
    matchday: number
    otherClubId?: string | null
    stillAtClub?: boolean
    reasonTh?: string
  },
): FanHatred[] {
  const out = [...list]
  const idx = out.findIndex((h) => h.playerId === partial.playerId)
  const bump = partial.intensity ?? 8
  const reasonTh = partial.reasonTh ?? HATE_REASON_TH[partial.reason]
  if (idx >= 0) {
    const cur = out[idx]!
    out[idx] = {
      ...cur,
      intensity: Math.min(20, cur.intensity + bump),
      reason: partial.reason,
      reasonTh,
      otherClubId: partial.otherClubId ?? cur.otherClubId,
      stillAtClub: partial.stillAtClub ?? cur.stillAtClub,
      playerName: partial.playerName,
    }
  } else {
    out.unshift({
      playerId: partial.playerId,
      playerName: partial.playerName,
      reason: partial.reason,
      reasonTh,
      intensity: Math.min(20, bump),
      sinceMatchday: partial.matchday,
      otherClubId: partial.otherClubId ?? null,
      stillAtClub: partial.stillAtClub ?? false,
    })
  }
  return out.slice(0, 24)
}

/** เพิ่ม/เร่งความเกลียดใน FanState (ทีมผู้เล่น UI) */
export function addFanHatred(
  fans: FanState,
  partial: {
    playerId: string
    playerName: string
    reason: FanHateReason
    intensity?: number
    matchday: number
    otherClubId?: string | null
    stillAtClub?: boolean
    reasonTh?: string
  },
): FanState {
  const base = ensureFanState(fans)
  const reasonTh = partial.reasonTh ?? HATE_REASON_TH[partial.reason]
  const fac = base.factions
  const moodHit = partial.stillAtClub ? -2 : -3
  return {
    ...base,
    hatedPlayers: bumpHateList(base.hatedPlayers ?? [], partial),
    mood: clamp(base.mood + moodHit),
    loyalty: clamp(
      base.loyalty - (partial.reason === 'to_rival' || partial.reason === 'free_exit' ? 2 : 1),
    ),
    factions: {
      ...fac,
      ultras: clamp(fac.ultras + (partial.reason === 'to_rival' ? 4 : 2)),
      soft: clamp(fac.soft - 1),
    },
    lastEvent: `แฟนเกลียด ${partial.playerName} — ${reasonTh}`,
    lastVerdict: `อัฒจันทร์ไม่ให้อภัย ${partial.playerName} (${reasonTh})`,
  }
}

export function markHatredLeftClub(fans: FanState, playerId: string, toClubId?: string): FanState {
  const base = ensureFanState(fans)
  return {
    ...base,
    hatedPlayers: (base.hatedPlayers ?? []).map((h) =>
      h.playerId === playerId
        ? { ...h, stillAtClub: false, otherClubId: toClubId ?? h.otherClubId }
        : h,
    ),
  }
}

/**
 * บันทึกความเกลียดของแฟนสโมสรต้นสังกัด (ทุกทีม)
 */
export function recordHatredAfterLeave(
  save: GameSave,
  fromClubId: string,
  player: Player,
  toClubId: string,
  opts?: { freeTransfer?: boolean; wasKey?: boolean },
): GameSave {
  const rival = areRivals(save, fromClubId, toClubId)
  const wa = player.wantAway?.active
  const refused = player.refuseContractRenewal
  const free = opts?.freeTransfer

  let reason: FanHateReason | null = null
  let intensity = 6
  let reasonTh: string | undefined

  if (rival) {
    reason = 'to_rival'
    intensity = 12 + (wa ? 3 : 0) + (free ? 2 : 0)
    reasonTh = free ? 'ย้ายฟรีไปคู่อริ' : 'ย้ายไปคู่อริ'
  } else if (free || refused) {
    reason = free ? 'free_exit' : 'refuse_contract'
    intensity = 10 + (wa ? 2 : 0)
  } else if (wa) {
    reason = 'want_away'
    intensity = 8 + (player.wantAway?.publicNews ? 3 : 0)
    reasonTh = 'อยากย้ายจนได้ย้าย'
  } else if (opts?.wasKey) {
    reason = 'sell_star'
    intensity = 6
  }

  if (!reason) {
    return updateClubFans(save, fromClubId, (cf) => ({
      ...cf,
      hatedPlayers: cf.hatedPlayers.map((h) =>
        h.playerId === player.id
          ? { ...h, stillAtClub: false, otherClubId: toClubId }
          : h,
      ),
    }))
  }

  return updateClubFans(save, fromClubId, (cf) => ({
    ...cf,
    mood: clamp(cf.mood - (rival ? 5 : 3)),
    lastEvent: `แฟนเกลียด ${player.name} — ${reasonTh ?? HATE_REASON_TH[reason!]}`,
    hatedPlayers: bumpHateList(cf.hatedPlayers, {
      playerId: player.id,
      playerName: player.name,
      reason: reason!,
      intensity,
      matchday: save.matchday,
      otherClubId: toClubId,
      stillAtClub: false,
      reasonTh,
    }).map((h) =>
      h.playerId === player.id ? { ...h, stillAtClub: false, otherClubId: toClubId } : h,
    ),
  }))
}

/** @deprecated ใช้ recordHatredAfterLeave — เหลือไว้ให้โค้ดเก่าที่คืน FanState */
export function hatredAfterPlayerLeaves(
  save: GameSave,
  player: Player,
  toClubId: string,
  opts?: { freeTransfer?: boolean; wasKey?: boolean },
): FanState {
  const next = recordHatredAfterLeave(save, save.humanClubId, player, toClubId, opts)
  return ensureFanState(next.fans)
}

export function recordHatredWhileAtClub(
  save: GameSave,
  clubId: string,
  player: Player,
  reason: FanHateReason,
  reasonTh?: string,
): GameSave {
  return updateClubFans(save, clubId, (cf) => ({
    ...cf,
    mood: clamp(cf.mood - 2),
    lastEvent: `แฟนเกลียด ${player.name} — ${reasonTh ?? HATE_REASON_TH[reason]}`,
    hatedPlayers: bumpHateList(cf.hatedPlayers, {
      playerId: player.id,
      playerName: player.name,
      reason,
      intensity: reason === 'want_away' ? 7 : 9,
      matchday: save.matchday,
      stillAtClub: true,
      otherClubId: null,
      reasonTh,
    }),
  }))
}

/** @deprecated ใช้ recordHatredWhileAtClub */
export function hatredWhileAtClub(
  fans: FanState,
  player: Player,
  matchday: number,
  reason: FanHateReason,
  reasonTh?: string,
): FanState {
  return addFanHatred(fans, {
    playerId: player.id,
    playerName: player.name,
    reason,
    intensity: reason === 'want_away' ? 7 : 9,
    matchday,
    stillAtClub: true,
    otherClubId: null,
    reasonTh,
  })
}

/**
 * ตอนเจอกัน — ใช้กับทุกสโมสรที่มีรายชื่อเกลียด (นักเตะ + ทีม)
 */
export function applyClubHatredMeeting(
  save: GameSave,
  fanClubId: string,
  opts: {
    isHome: boolean
    oppClubId: string
    oppXi: string[]
    ourXi: string[]
    usGoals: number
    themGoals: number
    notifyHuman?: boolean
  },
): { save: GameSave; playerPatches: Player[]; notes: string[] } {
  const club = save.clubs.find((c) => c.id === fanClubId)
  if (!club) return { save, playerPatches: [], notes: [] }
  const cf0 = ensureClubFans(club)
  const hated = cf0.hatedPlayers
  const teamHate = cf0.hatedTeams.find((t) => t.clubId === opts.oppClubId)
  if (!hated.length && !teamHate) return { save, playerPatches: [], notes: [] }

  let next = save
  const playerPatches: Player[] = []
  const notes: string[] = []

  if (teamHate && opts.isHome) {
    const opp = save.clubs.find((c) => c.id === opts.oppClubId)
    const styleTh = FAN_TEAM_HATE_STYLE_TH[teamHate.style]
    const moodHit =
      teamHate.style === 'hostile' ? 3 : teamHate.style === 'banners' ? 2 : 1
    next = updateClubFans(next, fanClubId, (cf) => ({
      ...cf,
      mood: clamp(cf.mood - moodHit),
      lastEvent:
        teamHate.style === 'banners'
          ? `ติดป้ายด่าใส่ ${opp?.shortName ?? 'คู่แข่ง'} · แฟน ~${teamHate.pct}%`
          : teamHate.style === 'hostile'
            ? `อัฒจันทร์เป็นศัตรูกับ ${opp?.shortName ?? 'คู่แข่ง'} · ~${teamHate.pct}%`
            : `โห่ใส่ ${opp?.shortName ?? 'คู่แข่ง'} ทั้งนัด · ~${teamHate.pct}%`,
    }))
    notes.push(
      `${club.shortName} ${styleTh} ${opp?.shortName ?? 'คู่แข่ง'} (~${teamHate.pct}% · ${teamHate.reasonTh})`,
    )
  }

  const returning = hated.filter(
    (h) => !h.stillAtClub && opts.oppXi.includes(h.playerId) && h.intensity >= 4,
  )
  for (const h of returning) {
    next = updateClubFans(next, fanClubId, (cf) => ({
      ...cf,
      mood: clamp(cf.mood - (opts.isHome ? 1 : 0) + (opts.usGoals > opts.themGoals ? 1 : -1)),
      lastEvent: opts.isHome
        ? `อัฒจันทร์โห่ใส่ ${h.playerName} — ${h.reasonTh}`
        : `แฟนเยือนตะโกนใส่ ${h.playerName} — ${h.reasonTh}`,
      hatedPlayers: cf.hatedPlayers.map((x) =>
        x.playerId === h.playerId
          ? { ...x, intensity: Math.min(20, x.intensity + (opts.isHome ? 1 : 0)) }
          : x,
      ),
    }))
    notes.push(`${club.shortName} เกลียด ${h.playerName} (${h.reasonTh})`)
    const p = next.players.find((x) => x.id === h.playerId)
    if (p) {
      playerPatches.push({
        ...p,
        morale: Math.max(1, p.morale - Math.min(3, Math.ceil(h.intensity / 7))),
        form: Math.max(1, p.form - (opts.isHome ? 1 : 0)),
      })
    }
  }

  if (opts.isHome) {
    const traitors = hated.filter(
      (h) => h.stillAtClub && opts.ourXi.includes(h.playerId) && h.intensity >= 5,
    )
    for (const h of traitors) {
      next = updateClubFans(next, fanClubId, (cf) => ({
        ...cf,
        mood: clamp(cf.mood - 2),
        lastEvent: `โห่ใส่ ${h.playerName} ในบ้าน — ${h.reasonTh}`,
      }))
      notes.push(`${club.shortName}: โห่ ${h.playerName} ในบ้าน`)
      const p = next.players.find((x) => x.id === h.playerId)
      if (p) {
        playerPatches.push({
          ...p,
          happiness: Math.max(1, (p.happiness ?? p.morale) - 2),
          morale: Math.max(1, p.morale - 1),
        })
      }
    }
  }

  if (opts.themGoals > 0 && returning.length && opts.themGoals >= opts.usGoals) {
    next = updateClubFans(next, fanClubId, (cf) => ({
      ...cf,
      mood: clamp(cf.mood - 2),
      lastEvent: `ฝันร้าย — ${returning[0]!.playerName} มีส่วนทำให้แพ้/เสมอ`,
    }))
  }

  if (opts.notifyHuman && notes.length && fanClubId === save.humanClubId) {
    next = {
      ...next,
      inbox: [
        {
          id: `msg-hate-${Date.now()}-${fanClubId}`,
          date: save.currentDate,
          title: 'แฟนเกลียดตอนเจอกัน',
          body: notes.join(' · '),
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    }
  } else if (opts.notifyHuman && notes.length && Math.random() < 0.25) {
    next = {
      ...next,
      inbox: [
        {
          id: `msg-hate-ai-${Date.now()}`,
          date: save.currentDate,
          title: `อัฒจันทร์ ${club.shortName}`,
          body: notes.slice(0, 2).join(' · '),
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    }
  }

  return { save: next, playerPatches, notes }
}

/** รันความเกลียดทั้งสองฝั่งในแมตช์ */
export function applyFanHatredBothSides(
  save: GameSave,
  homeClubId: string,
  awayClubId: string,
  homeXi: string[],
  awayXi: string[],
  homeGoals: number,
  awayGoals: number,
): { save: GameSave; playerPatches: Player[] } {
  let next = save
  const patches: Player[] = []

  const home = applyClubHatredMeeting(next, homeClubId, {
    isHome: true,
    oppClubId: awayClubId,
    oppXi: awayXi,
    ourXi: homeXi,
    usGoals: homeGoals,
    themGoals: awayGoals,
    notifyHuman: true,
  })
  next = home.save
  patches.push(...home.playerPatches)

  const away = applyClubHatredMeeting(next, awayClubId, {
    isHome: false,
    oppClubId: homeClubId,
    oppXi: homeXi,
    ourXi: awayXi,
    usGoals: awayGoals,
    themGoals: homeGoals,
    notifyHuman: true,
  })
  next = away.save
  patches.push(...away.playerPatches)

  // merge patches by id (last wins)
  const map = new Map(patches.map((p) => [p.id, p]))
  if (map.size) {
    next = {
      ...next,
      players: next.players.map((p) => map.get(p.id) ?? p),
    }
  }
  return { save: next, playerPatches: [...map.values()] }
}

/**
 * ตอนเจอกัน (ทีมผู้เล่น) — เหลือไว้ backward compat
 */
export function applyFanHatredMeeting(
  save: GameSave,
  opts: {
    oppClubId: string
    usHome: boolean
    oppXi: string[]
    ourXi: string[]
    usGoals: number
    themGoals: number
  },
): { fans: FanState; inbox: InboxMessage[]; playerPatches: Player[]; note: string | null } {
  const fanClubId = save.humanClubId
  const r = applyClubHatredMeeting(save, fanClubId, {
    isHome: opts.usHome,
    oppClubId: opts.oppClubId,
    oppXi: opts.oppXi,
    ourXi: opts.ourXi,
    usGoals: opts.usGoals,
    themGoals: opts.themGoals,
    notifyHuman: true,
  })
  return {
    fans: ensureFanState(r.save.fans),
    inbox: r.save.inbox,
    playerPatches: r.playerPatches,
    note: r.notes.length ? r.notes.join(' · ') : null,
  }
}

export function fanInbox(save: GameSave, title: string, body: string): InboxMessage {
  return {
    id: `msg-fan-${Date.now()}`,
    date: save.currentDate,
    title,
    body,
    read: false,
  }
}

export function ensureFans(save: GameSave): GameSave {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  let next = { ...save, fans: ensureFanState(save.fans, club?.reputation ?? 50) }
  next = syncHumanFansToClub(next)
  // seed clubFans ว่างสำหรับทุกคลับ
  next = {
    ...next,
    clubs: next.clubs.map((c) =>
      c.clubFans ? { ...c, clubFans: ensureClubFans(c) } : { ...c, clubFans: createClubFans(c.reputation) },
    ),
  }
  next = seedClubHatedTeams(next)
  return next
}
