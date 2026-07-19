import type { CareerState, GameSave, JobOffer } from './types'
import { createBoardState } from './board'
import { createOwnerState } from './owner'
import { createFanState } from './fans'
import { createDynamics } from './dynamics'
import { createTalksState } from './playerTalks'
import { createTakeoverState } from './takeover'
import { createClubIncome } from './clubIncome'
import { createFacilitiesState } from './facilities'
import { autoPickTactics } from './seed'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function createCareerState(humanClubId: string): CareerState {
  return {
    unemployed: false,
    sackedFromClubId: null,
    sackedSeason: null,
    jobOffers: [],
    clubsManaged: [humanClubId],
    lastJobNote: null,
  }
}

export function ensureCareer(save: GameSave): CareerState {
  const c = save.career
  if (!c) return createCareerState(save.humanClubId)
  return {
    ...createCareerState(save.humanClubId),
    ...c,
    jobOffers: c.jobOffers ?? [],
    clubsManaged: c.clubsManaged?.length ? c.clubsManaged : [save.humanClubId],
  }
}

function clubStrength(save: GameSave, clubId: string): number {
  const club = save.clubs.find((c) => c.id === clubId)
  if (!club) return 50
  const squad = save.players.filter((p) => p.clubId === clubId)
  const avg =
    squad.reduce((s, p) => s + p.overall, 0) / Math.max(1, squad.length)
  return Math.round(club.reputation * 0.55 + avg * 0.45)
}

/** หลังถูกปลด — เปิดตลาดงาน + สุ่มข้อเสนอ */
export function enterUnemployment(save: GameSave): GameSave {
  const career = ensureCareer(save)
  if (career.unemployed && career.jobOffers.some((o) => o.status === 'open')) {
    return { ...save, career }
  }
  const rep = save.managerReputation ?? 50
  const offers = generateJobOffers(save, rep, 4)
  return {
    ...save,
    career: {
      ...career,
      unemployed: true,
      sackedFromClubId: save.humanClubId,
      sackedSeason: save.season,
      jobOffers: [...offers, ...career.jobOffers].slice(0, 12),
      lastJobNote: `ถูกปลดจากตำแหน่ง — มีข้อเสนองาน ${offers.length} แห่ง`,
    },
    managerReputation: clamp(rep - 6),
    inbox: [
      {
        id: uid('msg-job'),
        date: save.currentDate,
        title: 'ตลาดงานผู้จัดการ',
        body: `คุณว่างงานแล้ว · มีคลับสนใจ ${offers.length} แห่ง — ไปหน้าบอร์ด/แฟนหรือพอร์ทัลเพื่อสมัคร`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

export function generateJobOffers(
  save: GameSave,
  managerRep: number,
  count = 4,
): JobOffer[] {
  const domestic = save.clubs.filter(
    (c) =>
      c.controlledBy === 'ai' &&
      !c.id.startsWith('ucl-') &&
      c.id !== save.humanClubId &&
      c.id !== save.career?.sackedFromClubId,
  )
  const scored = domestic
    .map((c) => {
      const strength = clubStrength(save, c.id)
      // คลับอ่อนกว่ารีพผู้จัดการ หรือกลางๆ เปิดรับ
      const fit = 100 - Math.abs(strength - managerRep)
      const openChance = fit + (c.reputation < 55 ? 15 : 0) + (managerRep < 40 ? 10 : 0)
      return { c, strength, openChance }
    })
    .filter((x) => x.openChance >= 35)
    .sort((a, b) => b.openChance - a.openChance)

  const picked = scored.slice(0, Math.min(count + 2, scored.length))
  const offers: JobOffer[] = []
  for (const row of picked) {
    if (offers.length >= count) break
    if (Math.random() > 0.85 && offers.length >= 2) continue
    const req = Math.max(25, Math.round(row.strength - 12 - Math.random() * 8))
    if (managerRep + 5 < req && Math.random() < 0.5) continue
    offers.push({
      id: uid('job'),
      clubId: row.c.id,
      clubName: row.c.name,
      issuedMatchday: save.matchday,
      issuedSeason: save.season,
      expiresMatchday: save.matchday + 8,
      reputationRequired: req,
      wageWeekly: Math.round(40_000 + row.c.reputation * 1_200 + managerRep * 400),
      note:
        row.c.reputation >= 70
          ? 'โปรเจกต์ใหญ่ — บอร์ดคาดหวังสูง'
          : row.c.reputation <= 48
            ? 'คลับเล็กสร้างทีม — โอกาสพิสูจน์ตัว'
            : 'งานกลางตาราง — สมดุลความกดดัน',
      status: 'open',
    })
  }
  return offers
}

/** สแกนงานใหม่เป็นระยะเมื่อว่างงาน */
export function refreshJobMarket(save: GameSave): GameSave {
  let career = ensureCareer(save)
  if (!career.unemployed && !save.board?.sacked) return { ...save, career }

  const offers = career.jobOffers.map((o) => {
    if (o.status === 'open' && save.matchday > o.expiresMatchday) {
      return { ...o, status: 'expired' as const }
    }
    return o
  })

  career = { ...career, unemployed: true, jobOffers: offers }
  const open = offers.filter((o) => o.status === 'open').length
  if (open < 2 && Math.random() < 0.35) {
    const extra = generateJobOffers(save, save.managerReputation ?? 50, 2)
    career = {
      ...career,
      jobOffers: [...extra, ...offers].slice(0, 12),
      lastJobNote: `มีคลับใหม่เปิดรับ ${extra.length} แห่ง`,
    }
  }
  return { ...save, career }
}

export function acceptJobOffer(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const career = ensureCareer(save)
  const offer = career.jobOffers.find((o) => o.id === offerId && o.status === 'open')
  if (!offer) return { ok: false, save, message: 'ไม่พบข้อเสนองาน' }
  if (save.matchday > offer.expiresMatchday) {
    return { ok: false, save, message: 'ข้อเสนองานหมดอายุ' }
  }
  const rep = save.managerReputation ?? 50
  if (rep < offer.reputationRequired) {
    return {
      ok: false,
      save,
      message: `ชื่อเสียงไม่พอ (มี ${rep} ต้องการ ≥ ${offer.reputationRequired})`,
    }
  }

  const club = save.clubs.find((c) => c.id === offer.clubId)
  if (!club || club.id.startsWith('ucl-')) {
    return { ok: false, save, message: 'คลับไม่พร้อมรับงาน' }
  }

  const oldId = save.humanClubId
  const clubs = save.clubs.map((c) => {
    if (c.id === oldId) return { ...c, controlledBy: 'ai' as const }
    if (c.id === offer.clubId) return { ...c, controlledBy: 'human' as const }
    return c
  })

  let tacticsByClub = { ...save.tacticsByClub }
  const t = tacticsByClub[offer.clubId]
  if (t) {
    tacticsByClub[offer.clubId] = {
      ...autoPickTactics(
        offer.clubId,
        save.players,
        t.formation,
        t.formationOop,
      ),
      instructions: t.instructions,
      familiarity: t.familiarity,
      setPieces: t.setPieces,
      opposition: t.opposition,
    }
  }

  const next: GameSave = {
    ...save,
    humanClubId: offer.clubId,
    clubs,
    tacticsByClub,
    board: createBoardState(club.reputation),
    owner: createOwnerState(club.reputation, save.season * 99 + offer.clubId.length),
    fans: createFanState(club.reputation),
    dynamics: createDynamics(),
    talks: createTalksState(),
    takeover: createTakeoverState(save.season),
    clubIncome: createClubIncome(club.reputation),
    facilities: createFacilitiesState(club.stadiumCapacity),
    pressConference: null,
    managerReputation: clamp(rep + 4),
    career: {
      ...career,
      unemployed: false,
      sackedFromClubId: null,
      lastJobNote: `รับงาน ${offer.clubName}`,
      clubsManaged: [...new Set([...career.clubsManaged, offer.clubId])],
      jobOffers: career.jobOffers.map((o) =>
        o.id === offerId
          ? { ...o, status: 'accepted' as const }
          : o.status === 'open'
            ? { ...o, status: 'rejected' as const }
            : o,
      ),
    },
    inbox: [
      {
        id: uid('msg-hired'),
        date: save.currentDate,
        title: `ยินดีต้อนรับสู่ ${offer.clubName}`,
        body: `คุณรับงานผู้จัดการ · ค่าเหนื่อยโดยประมาณ ฿${offer.wageWeekly.toLocaleString('th-TH')}/สัปดาห์ · ${offer.note}`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }

  return { ok: true, save: next, message: `รับงานที่ ${offer.clubName} แล้ว` }
}

export function rejectJobOffer(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const career = ensureCareer(save)
  const offer = career.jobOffers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'open') return { ok: false, save, message: 'ไม่พบงาน' }
  return {
    ok: true,
    save: {
      ...save,
      career: {
        ...career,
        jobOffers: career.jobOffers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
        lastJobNote: `ปฏิเสธงาน ${offer.clubName}`,
      },
    },
    message: `ปฏิเสธ ${offer.clubName}`,
  }
}
