import type {
  FacilitiesState,
  FacilityKind,
  FacilityProposal,
  GameSave,
} from './types'
import { ensureFans } from './fans'
import { ensureOwner } from './owner'

const GLOBAL_MAX_TIER = 10
/** Lv.10 = 100,000 ที่นั่ง · Lv.n ≈ n × 10,000 */
export const SEATS_PER_STADIUM_TIER = 10_000

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** เพดานขั้นสิ่งอำนวยตามขนาดคลับ — ทีมใหญ่ขยายได้สูงกว่า */
export function clubFacilityCeilings(
  reputation: number,
  division: 1 | 2 = 1,
): Pick<
  FacilitiesState,
  'maxStadiumTier' | 'maxTrainingTier' | 'maxMedicalTier' | 'maxCommercialTier'
> {
  const rep = reputation
  if (division === 2) {
    return {
      maxStadiumTier: clamp(3 + Math.floor(rep / 22), 3, 7),
      maxTrainingTier: clamp(3 + Math.floor(rep / 28), 3, 7),
      maxMedicalTier: clamp(3 + Math.floor(rep / 28), 3, 7),
      maxCommercialTier: clamp(2 + Math.floor(rep / 30), 2, 6),
    }
  }
  return {
    maxStadiumTier: rep >= 88 ? 10 : rep >= 75 ? 9 : rep >= 62 ? 8 : rep >= 48 ? 7 : 6,
    maxTrainingTier: rep >= 80 ? 10 : rep >= 60 ? 9 : rep >= 45 ? 8 : 7,
    maxMedicalTier: rep >= 80 ? 10 : rep >= 60 ? 9 : rep >= 45 ? 8 : 7,
    maxCommercialTier: rep >= 85 ? 10 : rep >= 65 ? 9 : rep >= 50 ? 8 : 6,
  }
}

export function stadiumCapacityForTier(tier: number): number {
  return clamp(tier, 1, GLOBAL_MAX_TIER) * SEATS_PER_STADIUM_TIER
}

export function stadiumTierFromCapacity(capacity: number): number {
  return clamp(Math.round(capacity / SEATS_PER_STADIUM_TIER), 1, GLOBAL_MAX_TIER)
}

export function createFacilitiesState(
  stadiumCapacity: number,
  clubRep = 50,
  division: 1 | 2 = 1,
): FacilitiesState {
  const ceilings = clubFacilityCeilings(clubRep, division)
  const stadiumTier = Math.min(
    ceilings.maxStadiumTier,
    stadiumTierFromCapacity(stadiumCapacity),
  )
  return {
    ...ceilings,
    stadiumTier,
    trainingTier: Math.min(ceilings.maxTrainingTier, clamp(2 + Math.floor(clubRep / 30), 2, 5)),
    medicalTier: Math.min(ceilings.maxMedicalTier, clamp(2 + Math.floor(clubRep / 32), 2, 5)),
    commercialTier: Math.min(ceilings.maxCommercialTier, clamp(1 + Math.floor(clubRep / 35), 1, 4)),
    project: null,
    pendingProposal: null,
    lastProposalMatchday: -99,
    lastNote: 'โครงสร้างพื้นฐานพร้อมฤดูกาล — อัปเกรดต้องเสนอเจ้าของ',
  }
}

export function ensureFacilities(save: GameSave): FacilitiesState {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const fresh = createFacilitiesState(
    club?.stadiumCapacity ?? 25_000,
    club?.reputation ?? 50,
    club?.division ?? 1,
  )
  if (!save.facilities) return fresh
  const ceilings = clubFacilityCeilings(club?.reputation ?? 50, club?.division ?? 1)
  const stadiumTier = Math.min(
    ceilings.maxStadiumTier,
    save.facilities.stadiumTier ?? stadiumTierFromCapacity(club?.stadiumCapacity ?? 25_000),
  )
  return {
    ...fresh,
    ...save.facilities,
    ...ceilings,
    stadiumTier,
    trainingTier: Math.min(
      ceilings.maxTrainingTier,
      save.facilities.trainingTier ?? fresh.trainingTier,
    ),
    medicalTier: Math.min(
      ceilings.maxMedicalTier,
      save.facilities.medicalTier ?? fresh.medicalTier,
    ),
    commercialTier: Math.min(
      ceilings.maxCommercialTier,
      save.facilities.commercialTier ?? fresh.commercialTier,
    ),
    project: save.facilities.project ?? null,
    pendingProposal: save.facilities.pendingProposal ?? null,
    lastProposalMatchday: save.facilities.lastProposalMatchday ?? -99,
  }
}

export const FACILITY_LABEL: Record<FacilityKind, string> = {
  stadium: 'สนาม / ความจุ',
  training: 'ศูนย์ฝึก',
  medical: 'ศูนย์การแพทย์',
  commercial: 'โซนพาณิชย์ / พิพิธภัณฑ์',
}

function tierKey(kind: FacilityKind): keyof Pick<
  FacilitiesState,
  'stadiumTier' | 'trainingTier' | 'medicalTier' | 'commercialTier'
> {
  return kind === 'stadium'
    ? 'stadiumTier'
    : kind === 'training'
      ? 'trainingTier'
      : kind === 'medical'
        ? 'medicalTier'
        : 'commercialTier'
}

function maxKey(kind: FacilityKind): keyof Pick<
  FacilitiesState,
  'maxStadiumTier' | 'maxTrainingTier' | 'maxMedicalTier' | 'maxCommercialTier'
> {
  return kind === 'stadium'
    ? 'maxStadiumTier'
    : kind === 'training'
      ? 'maxTrainingTier'
      : kind === 'medical'
        ? 'maxMedicalTier'
        : 'maxCommercialTier'
}

export function facilityCurrentTier(fac: FacilitiesState, kind: FacilityKind): number {
  return fac[tierKey(kind)]
}

export function facilityMaxTier(fac: FacilitiesState, kind: FacilityKind): number {
  return fac[maxKey(kind)]
}

/** ต้นทุนขยายจากระดับปัจจุบัน → ระดับถัดไป (สนามแพงขึ้นตามขนาด) */
export function facilityUpgradeCost(kind: FacilityKind, tier: number): number {
  if (kind === 'stadium') {
    return Math.round(2_800_000 + tier * 2_400_000 + tier * tier * 220_000)
  }
  const base =
    kind === 'training' ? 1_800_000 : kind === 'medical' ? 1_500_000 : 1_200_000
  return Math.round(base + tier * base * 0.55)
}

export function facilityBuildDays(kind: FacilityKind): number {
  return kind === 'stadium' ? 6 : kind === 'training' ? 4 : 3
}

export function facilityProgressLabel(fac: FacilitiesState, kind: FacilityKind): string {
  const cur = facilityCurrentTier(fac, kind)
  const max = facilityMaxTier(fac, kind)
  if (kind === 'stadium') {
    return `${cur}/${max} · ${stadiumCapacityForTier(cur).toLocaleString('th-TH')}/${stadiumCapacityForTier(max).toLocaleString('th-TH')} ที่นั่ง`
  }
  return `Lv.${cur}/${max}`
}

/** ผู้จัดการเสนอโครงการ — ยังไม่หักเงิน จนกว่าเจ้าของอนุมัติ */
export function proposeFacilityUpgrade(
  save: GameSave,
  kind: FacilityKind,
): { ok: boolean; save: GameSave; message: string } {
  const fac = ensureFacilities(save)
  if (fac.project) {
    return {
      ok: false,
      save,
      message: `กำลังก่อสร้างอยู่: ${fac.project.note} (เสร็จ MD${fac.project.doneMatchday})`,
    }
  }
  if (fac.pendingProposal) {
    return {
      ok: false,
      save,
      message: `มีข้อเสนอค้าง: ${fac.pendingProposal.note} — รอเจ้าของตัดสิน`,
    }
  }
  if (save.matchday - (fac.lastProposalMatchday ?? -99) < 2) {
    return { ok: false, save, message: 'เพิ่งเสนอไป — รออย่างน้อย 2 แมตช์เดย์' }
  }

  const tier = facilityCurrentTier(fac, kind)
  const max = facilityMaxTier(fac, kind)
  if (tier >= max) {
    return {
      ok: false,
      save,
      message:
        kind === 'stadium'
          ? `เพดานสนามคลับนี้คือ Lv.${max} (${stadiumCapacityForTier(max).toLocaleString('th-TH')} ที่นั่ง) — ทีมต้องใหญ่ขึ้นถึงจะขยายต่อ`
          : `${FACILITY_LABEL[kind]} สูงสุดของคลับนี้แล้ว (Lv.${max})`,
    }
  }

  const cost = facilityUpgradeCost(kind, tier)
  const toTier = tier + 1
  const targetCapacity = kind === 'stadium' ? stadiumCapacityForTier(toTier) : undefined
  const note =
    kind === 'stadium'
      ? `ขยายสนาม Lv.${tier}→${toTier} (~${targetCapacity!.toLocaleString('th-TH')} ที่นั่ง)`
      : `อัปเกรด${FACILITY_LABEL[kind]} Lv.${tier}→${toTier}`

  const proposal: FacilityProposal = {
    kind,
    fromTier: tier,
    toTier,
    cost,
    targetCapacity,
    proposedMatchday: save.matchday,
    note,
  }

  return {
    ok: true,
    message: `ส่งข้อเสนอถึงเจ้าของแล้ว · ฿${cost.toLocaleString('th-TH')} จากบัญชีสโมสร`,
    save: {
      ...save,
      facilities: {
        ...fac,
        pendingProposal: proposal,
        lastProposalMatchday: save.matchday,
        lastNote: `รออนุมัติ: ${note}`,
      },
      inbox: [
        {
          id: uid('msg-fac-prop'),
          date: save.currentDate,
          title: 'เสนออัปเกรดสิ่งอำนวย',
          body: `${note} · งบ ฿${cost.toLocaleString('th-TH')} (หักจากบัญชีสโมสรเมื่อเจ้าของอนุมัติ)`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

function ownerApproveChance(save: GameSave, proposal: FacilityProposal): number {
  const owner = ensureOwner(save)
  const board = save.board
  let chance = 0.4 + owner.relationship / 180 + board.confidence / 280
  if (owner.personality === 'frugal') chance -= proposal.kind === 'stadium' ? 0.28 : 0.18
  if (owner.personality === 'ambitious' || owner.personality === 'glory_hunter') {
    chance += proposal.kind === 'stadium' ? 0.14 : 0.08
  }
  if (owner.personality === 'local_hero' && proposal.kind === 'stadium') chance += 0.1
  if (owner.personality === 'patient') chance += 0.05
  if (board.confidence < 40) chance -= 0.12
  if (proposal.cost > 8_000_000) chance -= 0.08
  return Math.min(0.9, Math.max(0.06, chance))
}

/** เจ้าของอนุมัติ/ปฏิเสธ — อนุมัติแล้วหักเงินคลับแล้วเริ่มก่อสร้าง */
export function resolveFacilityProposal(
  save: GameSave,
  approve: boolean,
): { ok: boolean; save: GameSave; message: string } {
  const fac = ensureFacilities(save)
  const proposal = fac.pendingProposal
  if (!proposal) return { ok: false, save, message: 'ไม่มีข้อเสนอค้าง' }
  if (fac.project) {
    return { ok: false, save, message: 'กำลังมีโครงการก่อสร้างอยู่แล้ว' }
  }

  const owner = ensureOwner(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!

  if (!approve) {
    return {
      ok: true,
      message: `${owner.name} ปฏิเสธโครงการ`,
      save: {
        ...save,
        owner: {
          ...owner,
          relationship: clamp(owner.relationship - 3, 0, 100),
          lastNote: `${owner.name} ปฏิเสธ ${proposal.note}`,
        },
        facilities: {
          ...fac,
          pendingProposal: null,
          lastNote: `เจ้าของปฏิเสธ: ${proposal.note}`,
        },
        inbox: [
          {
            id: uid('msg-fac-rej'),
            date: save.currentDate,
            title: 'เจ้าของปฏิเสธอัปเกรด',
            body: `${owner.name} ไม่ผ่านโครงการ ${proposal.note}`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
    }
  }

  if (club.balance < proposal.cost) {
    return {
      ok: false,
      save: {
        ...save,
        facilities: fac,
        owner: {
          ...owner,
          lastNote: `${owner.name} พร้อมพิจารณา แต่บัญชีสโมสรไม่พอ ฿${proposal.cost.toLocaleString('th-TH')}`,
        },
      },
      message: `บัญชีสโมสรไม่พอ (มี ฿${club.balance.toLocaleString('th-TH')} ต้องการ ฿${proposal.cost.toLocaleString('th-TH')}) — ของบ war chest หรือหาเงินก่อน`,
    }
  }

  const chance = ownerApproveChance(save, proposal)
  const passed = Math.random() <= chance
  if (!passed) {
    return {
      ok: true,
      message: `${owner.name} ยังไม่เห็นด้วยกับงบนี้`,
      save: {
        ...save,
        owner: {
          ...owner,
          relationship: clamp(owner.relationship - 2, 0, 100),
          lastNote: `${owner.name} ยังไม่ผ่าน ${proposal.note} (โอกาส ~${Math.round(chance * 100)}%)`,
        },
        facilities: {
          ...fac,
          pendingProposal: null,
          lastNote: `เจ้าของยังไม่ผ่าน: ${proposal.note}`,
        },
        inbox: [
          {
            id: uid('msg-fac-no'),
            date: save.currentDate,
            title: 'เจ้าของยังไม่ผ่านโครงการ',
            body: `${proposal.note} · ${owner.name} อยากรอดูผลงาน/งบก่อน`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
    }
  }

  const days = facilityBuildDays(proposal.kind)
  const note = proposal.note
  return {
    ok: true,
    message: `${owner.name} อนุมัติ · เริ่มก่อสร้าง ${days} MD`,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - proposal.cost } : c,
      ),
      owner: {
        ...owner,
        relationship: clamp(owner.relationship + 2, 0, 100),
        lastNote: `${owner.name} อนุมัติทุนก่อสร้าง ${note}`,
      },
      facilities: {
        ...fac,
        pendingProposal: null,
        project: {
          kind: proposal.kind,
          startedMatchday: save.matchday,
          doneMatchday: save.matchday + days,
          note,
          targetCapacity: proposal.targetCapacity,
          costPaid: proposal.cost,
        },
        lastNote: `เริ่ม${note}`,
      },
      inbox: [
        {
          id: uid('msg-fac-ok'),
          date: save.currentDate,
          title: 'เจ้าของอนุมัติ — เริ่มก่อสร้าง',
          body: `${note} · หัก ฿${proposal.cost.toLocaleString('th-TH')} · เสร็จประมาณ MD${save.matchday + days}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** @deprecated ใช้ propose + resolve แทน — คงไว้ให้โค้ดเก่าไม่พัง */
export function startFacilityUpgrade(
  save: GameSave,
  kind: FacilityKind,
): { ok: boolean; save: GameSave; message: string } {
  return proposeFacilityUpgrade(save, kind)
}

/** จบโครงการก่อสร้างหลังแมตช์เดย์ */
export function processFacilities(save: GameSave): GameSave {
  const fac = ensureFacilities(save)
  if (!fac.project || save.matchday < fac.project.doneMatchday) {
    return { ...save, facilities: fac }
  }

  const kind = fac.project.kind
  let next = { ...fac, project: null as FacilitiesState['project'] }
  let clubs = save.clubs
  let fans = save.fans
  let inbox = save.inbox
  let note = ''

  if (kind === 'stadium') {
    const newTier = Math.min(fac.maxStadiumTier, fac.stadiumTier + 1)
    next = { ...next, stadiumTier: newTier }
    const target =
      fac.project.targetCapacity ?? stadiumCapacityForTier(newTier)
    clubs = clubs.map((c) =>
      c.id === save.humanClubId
        ? {
            ...c,
            stadiumCapacity: target,
            reputation: Math.min(99, c.reputation + (newTier % 3 === 0 ? 1 : 0)),
          }
        : c,
    )
    note = `เปิดอัฒจันทร์ใหม่ · ความจุ ${target.toLocaleString('th-TH')} ที่นั่ง (Lv.${newTier}/${fac.maxStadiumTier})`
    fans = {
      ...ensureFans({ ...save, fans }).fans,
      mood: Math.min(100, fans.mood + 3),
      factions: {
        ...fans.factions,
        soft: Math.min(100, fans.factions.soft + 2),
        international: Math.min(100, fans.factions.international + 2),
      },
      lastEvent: note,
    }
  } else if (kind === 'training') {
    next = { ...next, trainingTier: Math.min(fac.maxTrainingTier, fac.trainingTier + 1) }
    note = `ศูนย์ฝึกระดับ ${next.trainingTier}/${fac.maxTrainingTier} พร้อมใช้`
  } else if (kind === 'medical') {
    next = { ...next, medicalTier: Math.min(fac.maxMedicalTier, fac.medicalTier + 1) }
    note = `ศูนย์การแพทย์ระดับ ${next.medicalTier}/${fac.maxMedicalTier} · ฟื้นตัวเร็วขึ้น`
  } else {
    next = { ...next, commercialTier: Math.min(fac.maxCommercialTier, fac.commercialTier + 1) }
    const boost = 200_000 + next.commercialTier * 80_000
    clubs = clubs.map((c) =>
      c.id === save.humanClubId ? { ...c, balance: c.balance + boost } : c,
    )
    note = `โซนพาณิชย์เปิด · รายได้เปิดตัว ฿${boost.toLocaleString('th-TH')}`
    fans = {
      ...fans,
      factions: {
        ...fans.factions,
        corporate: Math.min(100, fans.factions.corporate + 3),
        international: Math.min(100, fans.factions.international + 2),
      },
      lastEvent: note,
    }
  }

  next = { ...next, lastNote: note }
  inbox = [
    {
      id: uid('msg-fac-done'),
      date: save.currentDate,
      title: 'ก่อสร้างเสร็จ',
      body: note,
      read: false,
    },
    ...inbox,
  ].slice(0, 40)

  return { ...save, facilities: next, clubs, fans, inbox }
}

export function trainingFacilityBonus(save: GameSave): number {
  return ensureFacilities(save).trainingTier * 0.015
}

export function medicalFacilityBonus(save: GameSave): number {
  return ensureFacilities(save).medicalTier * 0.4
}

export function commercialGateBonus(save: GameSave): number {
  return 1 + ensureFacilities(save).commercialTier * 0.02
}
