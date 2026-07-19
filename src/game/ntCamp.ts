/**
 * แคมป์ทีมชาติ — เมื่อคุณเป็นโค้ชชาติในช่วง FIFA window
 * โผ + โฟกัส + นัดอุ่นเครื่องรายสัปดาห์ (ผลต่อฟอร์มสมาคม)
 */
import type { GameSave, Player } from './types'
import { normalizeNation, ntTeam, playerNationality } from './nationalTeams'
import { ensureAssociations } from './associations'

export type NtCampFocus = 'balanced' | 'rest' | 'intensity' | 'youth'

export interface NtFriendlyResult {
  opponent: string
  opponentTh: string
  gf: number
  ga: number
  weekIndex: number
  note: string
}

export interface NtCampState {
  nation: string
  nationTh: string
  focus: NtCampFocus
  confirmed: boolean
  selectedIds: string[]
  note: string
  /** นัดอุ่นในช่วงหน้าต่างนี้ */
  friendlies?: NtFriendlyResult[]
  /** ฟอร์มสมาคมหลังยืนยัน/แข่ง (สำเนาแสดงผล) */
  associationForm?: number
}

export const NT_CAMP_FOCUS_LABEL: Record<NtCampFocus, string> = {
  balanced: 'สมดุล — อุ่นเครื่องปกติ',
  rest: 'พักฟื้น — ลดความเข้ม',
  intensity: 'เข้ม — ซ้อมหนัก / นัดอุ่น',
  youth: 'ปูทางดาวรุ่ง — ให้โอกาสเด็ก',
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function createNtCampFromBreak(save: GameSave): NtCampState | null {
  const nation = save.career?.nationalNation
  if (!nation) return null
  const br = save.internationalBreak
  if (!br || br.weeksLeft <= 0) return null
  const n = normalizeNation(nation) ?? nation
  const team = ntTeam(n)
  const selectedIds = (br.callUps ?? [])
    .filter((c) => (normalizeNation(c.nation) ?? c.nation) === n)
    .map((c) => c.playerId)
  if (selectedIds.length === 0) {
    const pool = save.players
      .filter((p) => playerNationality(p, save) === n && p.overall >= 68)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, team?.maxCall ?? 23)
    return {
      nation: n,
      nationTh: team?.labelTh ?? n,
      focus: 'balanced',
      confirmed: false,
      selectedIds: pool.map((p) => p.id),
      note: 'โผเริ่มต้นจากอันดับ OVR — กดยืนยันก่อนเดินหน้าแคมป์',
    }
  }
  return {
    nation: n,
    nationTh: team?.labelTh ?? n,
    focus: 'balanced',
    confirmed: false,
    selectedIds,
    note: 'โผจากระบบเรียกตัว — ปรับโฟกัสแคมป์ได้ แล้วกดยืนยัน',
  }
}

export function ensureNtCamp(save: GameSave): GameSave {
  if (save.ntCamp) return save
  const camp = createNtCampFromBreak(save)
  if (!camp) return save
  return { ...save, ntCamp: camp }
}

export function setNtCampFocus(save: GameSave, focus: NtCampFocus): GameSave {
  const base = ensureNtCamp(save)
  if (!base.ntCamp) return save
  return {
    ...base,
    ntCamp: {
      ...base.ntCamp,
      focus,
      note: `โฟกัส: ${NT_CAMP_FOCUS_LABEL[focus]}`,
    },
  }
}

export function toggleNtCampPlayer(save: GameSave, playerId: string): GameSave {
  const base = ensureNtCamp(save)
  const camp = base.ntCamp
  if (!camp || camp.confirmed) return save
  const p = save.players.find((x) => x.id === playerId)
  if (!p) return save
  const nat = playerNationality(p, save)
  if (nat !== camp.nation) return save
  const has = camp.selectedIds.includes(playerId)
  const max = ntTeam(camp.nation)?.maxCall ?? 26
  let selectedIds = camp.selectedIds
  if (has) {
    if (selectedIds.length <= 11) return save
    selectedIds = selectedIds.filter((id) => id !== playerId)
  } else {
    if (selectedIds.length >= max) return save
    selectedIds = [...selectedIds, playerId]
  }
  return {
    ...base,
    ntCamp: { ...camp, selectedIds, note: `โผ ${selectedIds.length} คน` },
  }
}

function clampForm(n: number) {
  return Math.max(1, Math.min(20, Math.round(n)))
}

/** จับคู่คู่แข่งจากสมาคมใกล้ FIFA rank */
function pickFriendlyOpponent(
  save: GameSave,
  homeNation: string,
  weekIndex: number,
): { key: string; nameTh: string; rank: number } {
  const withA = ensureAssociations(save)
  const home = withA.associations?.[homeNation]
  const homeRank = home?.fifaRank ?? 50
  const others = Object.values(withA.associations ?? {})
    .filter((a) => a.nation !== homeNation)
    .map((a) => ({
      key: a.nation,
      nameTh: a.nameTh,
      rank: a.fifaRank,
      dist: Math.abs(a.fifaRank - homeRank),
    }))
    .sort((a, b) => a.dist - b.dist || a.rank - b.rank)
  const pool = others.slice(0, 12)
  if (pool.length === 0) {
    return { key: 'World XI', nameTh: 'World XI', rank: homeRank }
  }
  const idx = (weekIndex * 3 + homeNation.length * 5) % pool.length
  const pick = pool[idx]!
  return { key: pick.key, nameTh: pick.nameTh, rank: pick.rank }
}

/**
 * ซิมนัดอุ่น 1 นัดในช่วงพัก — อัปเดตฟอร์มสมาคม + บันทึกผลในแคมป์
 */
export function simulateNtFriendlyWeek(save: GameSave, weekIndex: number): GameSave {
  const camp = save.ntCamp
  if (!camp?.confirmed || !save.career?.nationalNation) return save
  if (camp.nation !== (normalizeNation(save.career.nationalNation) ?? save.career.nationalNation)) {
    return save
  }

  const withA = ensureAssociations(save)
  const assoc = withA.associations?.[camp.nation]
  if (!assoc) return save

  const selected = camp.selectedIds
    .map((id) => save.players.find((p) => p.id === id))
    .filter((p): p is Player => !!p)
  const avgOvr =
    selected.reduce((s, p) => s + p.overall, 0) / Math.max(1, selected.length)
  const opp = pickFriendlyOpponent(withA, camp.nation, weekIndex)
  const oppStrength = 78 - Math.min(40, opp.rank) * 0.35 + (weekIndex % 3)
  const focusBias =
    camp.focus === 'intensity' ? 0.35 : camp.focus === 'rest' ? -0.45 : camp.focus === 'youth' ? -0.15 : 0
  const edge = (avgOvr - oppStrength) / 12 + focusBias
  const seed = save.season * 91 + weekIndex * 17 + camp.selectedIds.length * 3
  const roll = ((seed * 1103515245 + 12345) >>> 0) / 4294967296
  let gf = Math.max(0, Math.min(5, Math.floor(1.1 + edge + roll * 2.2)))
  let ga = Math.max(0, Math.min(5, Math.floor(1.0 - edge + (1 - roll) * 2.0)))
  if (camp.focus === 'rest' && gf + ga > 3) {
    gf = Math.min(gf, 2)
    ga = Math.min(ga, 2)
  }

  const won = gf > ga
  const drawn = gf === ga
  const formDelta = won ? 1.4 : drawn ? 0.2 : -1.1
  const youthBonus =
    camp.focus === 'youth' && selected.some((p) => p.age <= 23) ? 0.3 : 0
  const nextForm = clampForm(assoc.form + formDelta + youthBonus)

  const friendly: NtFriendlyResult = {
    opponent: opp.key,
    opponentTh: opp.nameTh,
    gf,
    ga,
    weekIndex,
    note: won
      ? `ชนะ ${gf}-${ga}`
      : drawn
        ? `เสมอ ${gf}-${ga}`
        : `แพ้ ${gf}-${ga}`,
  }
  const friendlies = [...(camp.friendlies ?? []), friendly]

  return {
    ...withA,
    associations: {
      ...withA.associations,
      [camp.nation]: {
        ...assoc,
        form: nextForm,
        windowsInCharge: assoc.windowsInCharge,
      },
    },
    ntCamp: {
      ...camp,
      friendlies,
      associationForm: nextForm,
      note: `อุ่น vs ${opp.nameTh} ${gf}-${ga} · ฟอร์มสมาคม ${nextForm}/20`,
    },
    inbox: [
      {
        id: `msg-nt-friendly-${Date.now()}`,
        date: save.currentDate,
        title: `นัดอุ่น${camp.nationTh}`,
        body: `vs ${opp.nameTh} · ${friendly.note} · ฟอร์มสมาคม ${nextForm}/20 · ${NT_CAMP_FOCUS_LABEL[camp.focus]}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 45),
  }
}

export function confirmNtCamp(save: GameSave): GameSave {
  const base = ensureNtCamp(save)
  const camp = base.ntCamp
  if (!camp) return save
  const br = base.internationalBreak
  const selected = new Set(camp.selectedIds)
  const players = base.players.map((p) => {
    if (!selected.has(p.id)) {
      if (br?.calledUpIds.includes(p.id) && playerNationality(p, base) === camp.nation) {
        return { ...p, leaveDays: 0 }
      }
      return p
    }
    return {
      ...p,
      leaveDays: Math.max(p.leaveDays ?? 0, br?.weeksLeft ?? 1),
      morale: clamp(p.morale + 1, 1, 20),
    }
  })
  const calledUpIds = [
    ...(br?.calledUpIds ?? []).filter((id) => {
      const pl = players.find((p) => p.id === id)
      return pl && playerNationality(pl, base) !== camp.nation
    }),
    ...camp.selectedIds,
  ]
  const withA = ensureAssociations(base)
  const assocForm = withA.associations?.[camp.nation]?.form ?? 12
  let next: GameSave = {
    ...withA,
    players,
    internationalBreak: br
      ? { ...br, calledUpIds: [...new Set(calledUpIds)] }
      : br,
    ntCamp: {
      ...camp,
      confirmed: true,
      friendlies: camp.friendlies ?? [],
      associationForm: assocForm,
      note: `ยืนยันโผ ${camp.selectedIds.length} คน · ${NT_CAMP_FOCUS_LABEL[camp.focus]}`,
    },
    inbox: [
      {
        id: `msg-nt-camp-${Date.now()}`,
        date: base.currentDate,
        title: `ยืนยันแคมป์${camp.nationTh}`,
        body: `${NT_CAMP_FOCUS_LABEL[camp.focus]} · โผ ${camp.selectedIds.length} คน · พร้อมแข่งอุ่นรายสัปดาห์`,
        read: false,
      },
      ...base.inbox,
    ].slice(0, 45),
  }
  // นัดอุ่นทันทีหลังยืนยัน (สัปดาห์แรกของหน้าต่าง)
  const weekIndex = br ? br.totalWeeks - br.weeksLeft + 1 : 1
  next = simulateNtFriendlyWeek(next, weekIndex)
  return next
}

/** ผลโฟกัสแคมป์ต่อนักเตะที่ถูกเรียก (ชาติที่คุณคุม) */
export function applyNtCampFocusWear(save: GameSave, players: Player[]): Player[] {
  const camp = save.ntCamp
  if (!camp?.confirmed) return players
  const selected = new Set(camp.selectedIds)
  const focus = camp.focus
  return players.map((p) => {
    if (!selected.has(p.id)) return p
    if (focus === 'rest') {
      return {
        ...p,
        condition: clamp(p.condition + 6, 30, 100),
        sharpness: clamp(p.sharpness - 1, 1, 100),
      }
    }
    if (focus === 'intensity') {
      return {
        ...p,
        condition: clamp(p.condition - 5, 25, 100),
        sharpness: clamp(p.sharpness + 4, 1, 100),
        form: clamp(p.form + 1, 1, 10),
      }
    }
    if (focus === 'youth') {
      const boost = p.age <= 23 ? 3 : 0
      return {
        ...p,
        sharpness: clamp(p.sharpness + 1 + boost, 1, 100),
        morale: clamp(p.morale + (p.age <= 23 ? 1 : 0), 1, 20),
      }
    }
    return {
      ...p,
      condition: clamp(p.condition - 2, 30, 100),
      sharpness: clamp(p.sharpness + 2, 1, 100),
    }
  })
}

export function clearNtCamp(save: GameSave): GameSave {
  if (!save.ntCamp) return save
  return { ...save, ntCamp: null }
}
