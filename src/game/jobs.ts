import type { CareerState, GameSave, JobOffer } from './types'
import { createBoardState } from './board'
import { createOwnerState } from './owner'
import { createFanState } from './fans'
import { createDynamics } from './dynamics'
import { createTalksState } from './playerTalks'
import { createTakeoverState } from './takeover'
import { createClubIncome } from './clubIncome'
import { createFacilitiesState } from './facilities'
import { createAffiliates } from './affiliates'
import { autoPickTactics } from './seed'
import {
  ensureAssociations,
  fifaTierForRank,
  HUMAN_NT_COACH_ID,
  removeAssociationCoach,
} from './associations'
import {
  displaceClubCoachOnTakeover,
  fillVacantAiClubCoach,
} from './worldCoaches'
import {
  ensureManagerProfile,
  instructionsFromManager,
} from './managerProfile'
import { createClubQuests } from './managerProgress'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

/** พลังโค้ชโดยประมาณจากชื่อเสียงผู้จัดการ (ใช้เทียบมาตรฐาน FIFA) */
export function managerPowerFromRep(rep: number): number {
  return clamp(Math.round(55 + rep * 0.42), 55, 96)
}

export function createCareerState(humanClubId: string): CareerState {
  return {
    unemployed: false,
    sackedFromClubId: null,
    sackedSeason: null,
    jobOffers: [],
    clubsManaged: [humanClubId],
    lastJobNote: null,
    nationalNation: null,
    resignedVoluntarily: false,
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
    nationalNation: c.nationalNation ?? null,
    resignedVoluntarily: c.resignedVoluntarily ?? false,
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

function mergeOffers(existing: JobOffer[], fresh: JobOffer[], cap = 12): JobOffer[] {
  const openClubIds = new Set(
    existing.filter((o) => o.status === 'open' && o.kind !== 'national').map((o) => o.clubId),
  )
  const openNations = new Set(
    existing
      .filter((o) => o.status === 'open' && o.kind === 'national' && o.nation)
      .map((o) => o.nation!),
  )
  const add = fresh.filter((o) => {
    if (o.kind === 'national') return o.nation && !openNations.has(o.nation)
    return !openClubIds.has(o.clubId)
  })
  return [...add, ...existing].slice(0, cap)
}

/** หลังถูกปลด — เปิดตลาดงาน + สุ่มข้อเสนอ (คลับ + ทีมชาติ) */
export function enterUnemployment(save: GameSave): GameSave {
  const career = ensureCareer(save)
  if (career.unemployed && career.jobOffers.some((o) => o.status === 'open')) {
    return { ...save, career }
  }
  const rep = save.managerReputation ?? 50
  const clubOffers = generateJobOffers(save, rep, 4)
  const ntOffers = generateNationalJobOffers(save, rep, 2)
  const offers = [...clubOffers, ...ntOffers]
  return {
    ...save,
    career: {
      ...career,
      unemployed: true,
      sackedFromClubId: save.humanClubId,
      sackedSeason: save.season,
      resignedVoluntarily: false,
      jobOffers: mergeOffers(career.jobOffers, offers),
      lastJobNote: `ถูกปลดจากตำแหน่ง — มีข้อเสนองาน ${offers.length} แห่ง`,
    },
    managerReputation: clamp(rep - 6),
    inbox: [
      {
        id: uid('msg-job'),
        date: save.currentDate,
        title: 'ตลาดงานผู้จัดการ',
        body: `คุณว่างงานแล้ว · มีข้อเสนอ ${offers.length} แห่ง (สโมสร/ทีมชาติ) — ไปหน้า Club Vision เพื่อสมัคร`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/**
 * ลาออกเองจากสโมสร — คุณเป็นโค้ชที่ถูกจ้าง ไม่ใช่เจ้าของ
 * คลับกลับเป็น AI · เปิดตลาดงาน
 */
export function resignFromClub(save: GameSave): { ok: boolean; save: GameSave; message: string } {
  const career = ensureCareer(save)
  if (career.unemployed && !hasHumanClubJob(save)) {
    return { ok: false, save, message: 'คุณไม่มีสัญญาคลับอยู่แล้ว' }
  }
  if (save.board?.sacked) {
    return { ok: false, save, message: 'คุณถูกปลดแล้ว — เลือกงานใหม่จากตลาด' }
  }

  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const clubName = club?.name ?? 'สโมสร'
  const rep = save.managerReputation ?? 50
  let clubs = save.clubs.map((c) =>
    c.id === save.humanClubId ? { ...c, controlledBy: 'ai' as const } : c,
  )
  const refill = fillVacantAiClubCoach(clubs, save.humanClubId, save.associations)
  clubs = refill.clubs

  let next: GameSave = {
    ...save,
    clubs,
    managerReputation: clamp(rep - 2),
    career: {
      ...career,
      unemployed: true,
      resignedVoluntarily: true,
      sackedFromClubId: save.humanClubId,
      sackedSeason: save.season,
      lastJobNote: `ลาออกจาก ${clubName}`,
    },
    inbox: [
      {
        id: uid('msg-resign'),
        date: save.currentDate,
        title: `ลาออกจาก ${clubName}`,
        body: `คุณลาออกจากตำแหน่งผู้จัดการ — เจ้าของและบอร์ดจะหา AI คุมต่อ${
          refill.hired ? ` · ${refill.hired.name} รับงานหัวหน้าโค้ช` : ' · เปิดตลาดโค้ช'
        } · ตลาดงานผู้จัดการเปิดแล้ว`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }

  const clubOffers = generateJobOffers(next, next.managerReputation ?? 50, 4)
  const ntOffers = generateNationalJobOffers(next, next.managerReputation ?? 50, 2)
  const offers = [...clubOffers, ...ntOffers]
  next = {
    ...next,
    career: {
      ...ensureCareer(next),
      unemployed: true,
      resignedVoluntarily: true,
      jobOffers: mergeOffers(ensureCareer(next).jobOffers, offers),
      lastJobNote: `ลาออกจาก ${clubName} — มีข้อเสนอ ${offers.length} แห่ง`,
    },
  }

  return { ok: true, save: next, message: `ลาออกจาก ${clubName} แล้ว` }
}

export function hasHumanClubJob(save: GameSave): boolean {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  return club?.controlledBy === 'human' && !save.career?.unemployed && !save.board?.sacked
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
      kind: 'club',
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

/** ข้อเสนอโค้ชทีมชาติจากสมาคมที่เก้าอี้ว่าง (หรือใกล้มาตรฐานคุณ) */
export function generateNationalJobOffers(
  save: GameSave,
  managerRep: number,
  count = 2,
): JobOffer[] {
  const withAssoc = ensureAssociations(save)
  const power = managerPowerFromRep(managerRep)
  const currentNt = save.career?.nationalNation ?? null
  const vacant = Object.values(withAssoc.associations ?? {})
    .filter((a) => {
      if (a.nation === currentNt) return false
      if (a.coachId && a.coachId !== HUMAN_NT_COACH_ID) return false
      if (a.coachId === HUMAN_NT_COACH_ID) return false
      const tier = fifaTierForRank(a.fifaRank)
      // สมาคมจ้างคนที่พลังใกล้มาตรฐาน (ยืดหยุ่น ±8)
      return power + 8 >= tier.minCoachPower - 5
    })
    .sort((a, b) => {
      // ชอบชาติที่ FIFA ใกล้ระดับคุณ
      const ta = Math.abs(fifaTierForRank(a.fifaRank).minCoachPower - power)
      const tb = Math.abs(fifaTierForRank(b.fifaRank).minCoachPower - power)
      return ta - tb || a.fifaRank - b.fifaRank
    })

  const offers: JobOffer[] = []
  for (const a of vacant) {
    if (offers.length >= count) break
    if (Math.random() > 0.7 && offers.length >= 1) continue
    const tier = fifaTierForRank(a.fifaRank)
    const req = Math.max(30, Math.round(tier.minCoachPower - 20 - Math.random() * 8))
    if (managerRep + 8 < req) continue
    offers.push({
      id: uid('job-nt'),
      kind: 'national',
      clubId: `nt:${a.nation}`,
      clubName: a.nameTh,
      nation: a.nation,
      nationTh: a.nameTh,
      issuedMatchday: save.matchday,
      issuedSeason: save.season,
      expiresMatchday: save.matchday + 10,
      reputationRequired: req,
      wageWeekly: Math.round(a.wageWeekly || 80_000 + (100 - a.fifaRank) * 2_500),
      note: `สมาคม${a.nameTh} · FIFA #${a.fifaRank} · ${tier.labelTh} — จ้างคุณเป็นโค้ชทีมชาติ`,
      status: 'open',
    })
  }
  return offers
}

/** สแกนงานใหม่เป็นระยะเมื่อไม่มีคลับ (รวมตอนคุมชาติอย่างเดียว) */
export function refreshJobMarket(save: GameSave): GameSave {
  let career = ensureCareer(save)
  const noClub = !hasHumanClubJob(save)
  if (!noClub && !career.unemployed && !save.board?.sacked) {
    return { ...save, career }
  }

  const offers = career.jobOffers.map((o) => {
    if (o.status === 'open' && save.matchday > o.expiresMatchday) {
      return { ...o, status: 'expired' as const }
    }
    return o
  })

  career = {
    ...career,
    unemployed: noClub && !career.nationalNation ? true : noClub || career.unemployed,
    jobOffers: offers,
  }

  if (noClub) {
    const open = offers.filter((o) => o.status === 'open').length
    if (open < 2 && Math.random() < 0.4) {
      const extraClub = generateJobOffers(save, save.managerReputation ?? 50, 2)
      const extraNt = career.nationalNation
        ? []
        : generateNationalJobOffers(save, save.managerReputation ?? 50, 1)
      const extra = [...extraClub, ...extraNt]
      career = {
        ...career,
        unemployed: !career.nationalNation,
        jobOffers: mergeOffers(offers, extra),
        lastJobNote: `มีงานใหม่เปิดรับ ${extra.length} แห่ง`,
      }
    }
  }
  return { ...save, career }
}

function leaveNationalJob(save: GameSave, reason: string): GameSave {
  const career = ensureCareer(save)
  const nation = career.nationalNation
  if (!nation) return save
  const removed = removeAssociationCoach(save, nation, 'resigned', reason)
  return {
    ...removed.save,
    career: {
      ...ensureCareer(removed.save),
      nationalNation: null,
      lastJobNote: reason,
    },
  }
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

  if (offer.kind === 'national' && offer.nation) {
    return acceptNationalJob(save, offer)
  }

  const club = save.clubs.find((c) => c.id === offer.clubId)
  if (!club || club.id.startsWith('ucl-')) {
    return { ok: false, save, message: 'คลับไม่พร้อมรับงาน' }
  }

  let base = save
  if (career.nationalNation) {
    base = leaveNationalJob(
      save,
      `ลาออกจากทีมชาติเพื่อรับงาน ${offer.clubName}`,
    )
  }

  const career2 = ensureCareer(base)
  const oldId = base.humanClubId

  // คลับเดิมที่คุณลาออก — AI จ้างโค้ชจากตลาดว่าง
  let clubs = base.clubs.map((c) => {
    if (c.id === oldId) return { ...c, controlledBy: 'ai' as const }
    if (c.id === offer.clubId) return { ...c, controlledBy: 'human' as const }
    return c
  })
  const refill = fillVacantAiClubCoach(clubs, oldId, base.associations)
  clubs = refill.clubs

  // โค้ชเดิมของคลับใหม่ว่าง → คลับอื่นจ้างต่อ
  const takeover = displaceClubCoachOnTakeover(clubs, offer.clubId, base.associations)
  clubs = takeover.clubs

  const profile = ensureManagerProfile(base.managerProfile)
  let tacticsByClub = { ...base.tacticsByClub }
  const t = tacticsByClub[offer.clubId]
  if (t) {
    tacticsByClub[offer.clubId] = {
      ...autoPickTactics(
        offer.clubId,
        base.players,
        profile.preferredFormation,
        profile.formationOop,
      ),
      instructions: instructionsFromManager(profile),
      familiarity: Math.min(72, 48 + Math.round(profile.power / 5)),
      setPieces: t.setPieces,
      opposition: t.opposition,
    }
  }

  const newBoard = createBoardState(club.reputation)

  const coachNote = takeover.displaced
    ? takeover.hiredAt
      ? `${takeover.displaced.name} ย้ายไป ${takeover.hiredAt.name}`
      : `${takeover.displaced.name} ว่างงาน`
    : null
  const refillNote = refill.hired
    ? `${refill.hired.name} รับงานคลับเดิมของคุณ`
    : null

  const next: GameSave = {
    ...base,
    humanClubId: offer.clubId,
    clubs,
    tacticsByClub,
    board: newBoard,
    owner: createOwnerState(club.reputation, base.season * 99 + offer.clubId.length),
    fans: createFanState(club.reputation),
    dynamics: createDynamics(),
    talks: createTalksState(),
    takeover: createTakeoverState(base.season),
    clubIncome: createClubIncome(club.reputation),
    facilities: createFacilitiesState(
      club.stadiumCapacity,
      club.reputation,
      club.division ?? 1,
      base.youth?.academyLevel ?? 8,
    ),
    affiliates: createAffiliates(club.reputation, base.season * 99 + offer.clubId.length),
    preMatch: null,
    pressConference: null,
    playerInterview: null,
    internationalBreak: null,
    managerReputation: clamp(rep + 4),
    clubQuests: createClubQuests(club, base.season, newBoard.preferredStyle),
    career: {
      ...career2,
      unemployed: false,
      sackedFromClubId: null,
      resignedVoluntarily: false,
      nationalNation: null,
      lastJobNote: `รับงานผู้จัดการที่ ${offer.clubName}`,
      clubsManaged: [...new Set([...career2.clubsManaged, offer.clubId])],
      jobOffers: career2.jobOffers.map((o) =>
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
        date: base.currentDate,
        title: `ยินดีต้อนรับสู่ ${offer.clubName}`,
        body: `คุณรับงานผู้จัดการ (ถูกจ้างโดยเจ้าของ/บอร์ด) · ค่าเหนื่อยโดยประมาณ €${offer.wageWeekly.toLocaleString('th-TH')}/สัปดาห์ · ${offer.note}${coachNote ? ` · ${coachNote}` : ''}${refillNote ? ` · ${refillNote}` : ''}`,
        read: false,
      },
      ...base.inbox,
    ].slice(0, 40),
  }

  return { ok: true, save: next, message: `รับงานที่ ${offer.clubName} แล้ว` }
}

function acceptNationalJob(
  save: GameSave,
  offer: JobOffer,
): { ok: boolean; save: GameSave; message: string } {
  const nation = offer.nation!
  let next = ensureAssociations(save)
  const assoc = next.associations?.[nation]
  if (!assoc) return { ok: false, save, message: 'ไม่พบสมาคม' }

  const power = managerPowerFromRep(save.managerReputation ?? 50)
  const tier = fifaTierForRank(assoc.fifaRank)
  if (power + 10 < tier.minCoachPower) {
    return {
      ok: false,
      save,
      message: `สมาคมต้องการโค้ชแข็งกว่า (พลังคุณ ~${power} · มาตรฐาน ≥ ${tier.minCoachPower})`,
    }
  }

  // ปลดโค้ชโลกเดิมถ้าว่างเก้าอี้ยังมีคน
  if (assoc.coachId && assoc.coachId !== HUMAN_NT_COACH_ID) {
    const rem = removeAssociationCoach(
      next,
      nation,
      'sacked',
      `สมาคมจ้าง ${save.managerName} แทน`,
    )
    next = rem.save
  }

  // ลาออกจากคลับถ้ายังคุมอยู่
  const career = ensureCareer(next)
  let clubs = next.clubs.map((c) =>
    c.id === next.humanClubId && c.controlledBy === 'human'
      ? { ...c, controlledBy: 'ai' as const }
      : c,
  )
  if (save.clubs.find((c) => c.id === save.humanClubId)?.controlledBy === 'human') {
    const refill = fillVacantAiClubCoach(clubs, next.humanClubId, next.associations)
    clubs = refill.clubs
  }

  const prevNt = career.nationalNation
  if (prevNt && prevNt !== nation) {
    next = leaveNationalJob(next, `ย้ายไปคุมทีมชาติ${offer.nationTh ?? nation}`)
  }

  const assocNow = next.associations?.[nation]
  if (!assocNow) return { ok: false, save, message: 'ไม่พบสมาคม' }

  next = {
    ...next,
    clubs,
    associations: {
      ...next.associations,
      [nation]: {
        ...assocNow,
        coachId: HUMAN_NT_COACH_ID,
        wageWeekly: offer.wageWeekly,
        form: 12,
        windowsInCharge: 0,
        vacantWindows: 0,
        hiredMatchday: next.matchday,
      },
    },
    managerReputation: clamp((next.managerReputation ?? 50) + 5),
    career: {
      ...ensureCareer(next),
      unemployed: true,
      nationalNation: nation,
      resignedVoluntarily: false,
      sackedFromClubId: null,
      lastJobNote: `รับงานโค้ชทีมชาติ${offer.nationTh ?? nation}`,
      jobOffers: ensureCareer(next).jobOffers.map((o) =>
        o.id === offer.id
          ? { ...o, status: 'accepted' as const }
          : o.status === 'open'
            ? { ...o, status: 'rejected' as const }
            : o,
      ),
    },
    inbox: [
      {
        id: uid('msg-nt-hired'),
        date: next.currentDate,
        title: `โค้ชทีมชาติ${offer.nationTh ?? nation}`,
        body: `${assocNow.nameTh} จ้างคุณเป็นหัวหน้าโค้ชทีมชาติ · FIFA #${assocNow.fifaRank} · ค่าเหนื่อย ~€${offer.wageWeekly.toLocaleString('th-TH')}/สัปดาห์ · คลับเดิมเป็น AI คุมต่อ — หางานสโมสรควบได้จากตลาด`,
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }

  return {
    ok: true,
    save: next,
    message: `รับงานโค้ชทีมชาติ${offer.nationTh ?? nation} แล้ว`,
  }
}

export function rejectJobOffer(
  save: GameSave,
  offerId: string,
): { ok: boolean; save: GameSave; message: string } {
  const career = ensureCareer(save)
  const offer = career.jobOffers.find((o) => o.id === offerId)
  if (!offer || offer.status !== 'open') return { ok: false, save, message: 'ไม่พบงาน' }
  const label = offer.kind === 'national' ? `ทีมชาติ${offer.nationTh ?? ''}` : offer.clubName
  return {
    ok: true,
    save: {
      ...save,
      career: {
        ...career,
        jobOffers: career.jobOffers.map((o) =>
          o.id === offerId ? { ...o, status: 'rejected' as const } : o,
        ),
        lastJobNote: `ปฏิเสธงาน ${label}`,
      },
    },
    message: `ปฏิเสธ ${label}`,
  }
}
