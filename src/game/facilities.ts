import type { FacilitiesState, FacilityKind, GameSave } from './types'
import { ensureFans } from './fans'

const MAX_TIER = 10

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

export function createFacilitiesState(stadiumCapacity: number): FacilitiesState {
  const stadiumTier = Math.max(1, Math.min(6, Math.round((stadiumCapacity - 15_000) / 8_000)))
  return {
    stadiumTier,
    trainingTier: 3,
    medicalTier: 3,
    commercialTier: 2,
    project: null,
    lastNote: 'โครงสร้างพื้นฐานพร้อมฤดูกาล',
  }
}

export function ensureFacilities(save: GameSave): FacilitiesState {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const fresh = createFacilitiesState(club?.stadiumCapacity ?? 25_000)
  if (!save.facilities) return fresh
  return {
    ...fresh,
    ...save.facilities,
    project: save.facilities.project ?? null,
  }
}

export const FACILITY_LABEL: Record<FacilityKind, string> = {
  stadium: 'สนาม / ความจุ',
  training: 'ศูนย์ฝึก',
  medical: 'ศูนย์การแพทย์',
  commercial: 'โซนพาณิชย์ / พิพิธภัณฑ์',
}

export function facilityUpgradeCost(kind: FacilityKind, tier: number): number {
  const base =
    kind === 'stadium' ? 4_500_000 : kind === 'training' ? 1_800_000 : kind === 'medical' ? 1_500_000 : 1_200_000
  return Math.round(base + tier * base * 0.55)
}

export function facilityBuildDays(kind: FacilityKind): number {
  return kind === 'stadium' ? 6 : kind === 'training' ? 4 : 3
}

export function startFacilityUpgrade(
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
  const tierKey =
    kind === 'stadium'
      ? 'stadiumTier'
      : kind === 'training'
        ? 'trainingTier'
        : kind === 'medical'
          ? 'medicalTier'
          : 'commercialTier'
  const tier = fac[tierKey]
  if (tier >= MAX_TIER) return { ok: false, save, message: 'ระดับสูงสุดแล้ว' }

  const cost = facilityUpgradeCost(kind, tier)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  if (club.balance < cost) {
    return { ok: false, save, message: `งบไม่พอ (ต้องการ ฿${cost.toLocaleString('th-TH')})` }
  }

  const days = facilityBuildDays(kind)
  const note = `อัปเกรด${FACILITY_LABEL[kind]} → ระดับ ${tier + 1}`
  return {
    ok: true,
    message: `${note} · ก่อสร้าง ${days} MD · ฿${cost.toLocaleString('th-TH')}`,
    save: {
      ...save,
      clubs: save.clubs.map((c) =>
        c.id === club.id ? { ...c, balance: c.balance - cost } : c,
      ),
      facilities: {
        ...fac,
        project: {
          kind,
          startedMatchday: save.matchday,
          doneMatchday: save.matchday + days,
          note,
        },
        lastNote: `เริ่ม${note}`,
      },
      inbox: [
        {
          id: uid('msg-fac'),
          date: save.currentDate,
          title: 'เริ่มก่อสร้าง',
          body: `${note} · เสร็จประมาณ MD${save.matchday + days}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
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
    next = { ...next, stadiumTier: fac.stadiumTier + 1 }
    const add = 2_500 + next.stadiumTier * 800
    clubs = clubs.map((c) =>
      c.id === save.humanClubId
        ? {
            ...c,
            stadiumCapacity: c.stadiumCapacity + add,
            reputation: Math.min(99, c.reputation + (next.stadiumTier % 3 === 0 ? 1 : 0)),
          }
        : c,
    )
    note = `เปิดอัฒจันทร์ใหม่ · ความจุ +${add.toLocaleString('th-TH')}`
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
    next = { ...next, trainingTier: fac.trainingTier + 1 }
    note = `ศูนย์ฝึกระดับ ${next.trainingTier} พร้อมใช้`
  } else if (kind === 'medical') {
    next = { ...next, medicalTier: fac.medicalTier + 1 }
    note = `ศูนย์การแพทย์ระดับ ${next.medicalTier} · ฟื้นตัวเร็วขึ้น`
  } else {
    next = { ...next, commercialTier: fac.commercialTier + 1 }
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
