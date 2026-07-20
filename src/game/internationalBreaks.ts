import type { GameSave, InternationalBreakState } from './types'
import { leagueMatchdays } from '@/data/world/leagueSize'
import { tickPlayerInjury } from './medical'
import { tickIllness } from './illness'
import { payWeeklyWagesWithCash, ensureClubFinance } from './playerEconomy'
import { staffLevel } from './staff'
import { medicalFacilityBonus } from './facilities'
import {
  applyNtCaps,
  formatCallUpLines,
  formatSnubLines,
  nationalTeamCallUps,
} from './nationalTeams'
import { pushNationalTeamNews } from './nationalTeamNews'
import { tickAssociationHiring, ensureAssociations } from './associations'
import { applyIntlBreakMatchWear } from './intlTournaments'
import {
  applyIntlReturnStamina,
  applyIntlWeekStamina,
} from './playerStamina'
import { staminaHitOnLeaveEvent } from './medicalStamina'
import {
  applyNtCampFocusWear,
  clearNtCamp,
  ensureNtCamp,
  simulateNtFriendlyWeek,
} from './ntCamp'
import { advanceWorldCupQualifiers } from './worldCup'
import { applyIntlBreakRecognition } from './reputation'

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function addDays(iso: string, days: number) {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

/**
 * FIFA windows โดยประมาณ — หลัง MD เหล่านี้มีพัก 1–2 สัปดาห์
 */
export function breakSchedule(leagueId: string): { afterMd: number; weeks: number; label: string }[] {
  const total = leagueMatchdays(leagueId)
  if (total <= 34) {
    return [
      { afterMd: 5, weeks: 1, label: 'FIFA window · กันยายน' },
      { afterMd: 10, weeks: 1, label: 'FIFA window · ตุลาคม' },
      { afterMd: 15, weeks: 2, label: 'FIFA window · พฤศจิกายน' },
      { afterMd: 23, weeks: 1, label: 'FIFA window · มีนาคม' },
    ]
  }
  return [
    { afterMd: 6, weeks: 1, label: 'FIFA window · กันยายน' },
    { afterMd: 11, weeks: 1, label: 'FIFA window · ตุลาคม' },
    { afterMd: 16, weeks: 2, label: 'FIFA window · พฤศจิกายน' },
    { afterMd: 27, weeks: 1, label: 'FIFA window · มีนาคม' },
  ]
}

export function hasPendingInternationalBreak(save: GameSave): boolean {
  return (save.internationalBreak?.weeksLeft ?? 0) > 0
}

/** หลังจบ MD — โค้ชทีมชาติเรียกตัวตามสไตล์ แล้วคิวพักลีก */
export function maybeQueueInternationalBreak(save: GameSave): GameSave {
  if ((save.internationalBreak?.weeksLeft ?? 0) > 0) return save
  const slot = breakSchedule(save.leagueId || 'eng').find((b) => b.afterMd === save.matchday)
  if (!slot) return save

  // สมาคมอาจจ้างโค้ชทีมชาติใหม่ก่อนเปิดแคมป์ (ตาม FIFA rank + งบ)
  const withAssoc = tickAssociationHiring(save)

  const { callUps, snubs } = nationalTeamCallUps(withAssoc, slot.weeks)
  const callIds = callUps.map((c) => c.playerId)
  let players = withAssoc.players.map((p) => {
    if (!callIds.includes(p.id)) return p
    const hit = staminaHitOnLeaveEvent(p)
    return {
      ...p,
      leaveDays: Math.max(p.leaveDays ?? 0, slot.weeks),
      condition: Math.max(28, p.condition - hit),
      morale: clamp(p.morale + (callUps.find((c) => c.playerId === p.id)?.firstCap ? 2 : 1), 1, 20),
    }
  })
  // หลุดโผ — โมราเลลดเล็กน้อยถ้าเป็นทีมผู้เล่น
  const snubIds = new Set(snubs.map((s) => s.playerId))
  players = players.map((p) =>
    snubIds.has(p.id) && p.clubId === withAssoc.humanClubId
      ? { ...p, morale: clamp(p.morale - 1, 1, 20) }
      : p,
  )
  players = applyNtCaps(players, callUps)

  const humanLines = formatCallUpLines(callUps, withAssoc.humanClubId)
  const snubLines = formatSnubLines(snubs)
  const nationsActive = [...new Set(callUps.map((c) => c.nationTh))]
  const state: InternationalBreakState = {
    weeksLeft: slot.weeks,
    totalWeeks: slot.weeks,
    label: slot.label,
    afterMatchday: slot.afterMd,
    calledUpIds: callIds,
    callUps,
    snubs,
  }

  let next: GameSave = {
    ...withAssoc,
    players,
    internationalBreak: state,
    inbox: [
      {
        id: `msg-intl-${Date.now()}`,
        date: withAssoc.currentDate,
        title: `พักเบรกทีมชาติ · ${slot.label}`,
        body: [
          `ลีกหยุด ${slot.weeks} สัปดาห์ · โค้ชชาติเลือกตัวตามสไตล์ (${nationsActive.slice(0, 8).join(' · ')}${nationsActive.length > 8 ? '…' : ''})`,
          ...humanLines,
          ...(snubLines.length ? ['— หลุดโผ —', ...snubLines] : []),
        ].join('\n'),
        read: false,
      },
      ...withAssoc.inbox,
    ].slice(0, 45),
  }

  next = pushNationalTeamNews(next, callUps, snubs, slot.label)
  next = ensureNtCamp(next)
  // คัดเลือกบอลโลก: เก็บแต้มกลุ่มทุกครั้งที่เปิด FIFA window
  next = advanceWorldCupQualifiers(next)
  return next
}

/** เดินหน้า 1 สัปดาห์พักทีมชาติ (ไม่มีนัดลีก) */
export function advanceInternationalBreak(save: GameSave): {
  ok: boolean
  save: GameSave
  message: string
} {
  const br = save.internationalBreak
  if (!br || br.weeksLeft <= 0) {
    return { ok: false, save, message: 'ไม่มีพักทีมชาติค้าง' }
  }

  const physio = staffLevel(save.staff, 'physio') + medicalFacilityBonus(save)
  const weekIndex = br.totalWeeks - br.weeksLeft + 1
  const called = new Set(br.calledUpIds)

  let players = save.players.map((p) => {
    const away = called.has(p.id)
    let nextP = applyIntlWeekStamina(p, away)
    nextP = {
      ...nextP,
      sharpness: clamp(nextP.sharpness + (away ? 1 : -2), 1, 100),
      leaveDays: Math.max(0, (nextP.leaveDays ?? 0) - 1),
    }
    nextP = tickPlayerInjury(nextP, physio)
    nextP = tickIllness(nextP, physio)
    return nextP
  })

  let next: GameSave = {
    ...save,
    players,
    currentDate: addDays(save.currentDate, 7),
  }

  // ล้าจากการแข่งอุ่นเครื่องช่วงพัก + โฟกัสแคมป์ถ้าคุณเป็นโค้ชชาติ
  next = applyIntlBreakMatchWear(next)
  next = { ...next, players: applyNtCampFocusWear(next, next.players) }
  // นัดอุ่นโค้ชชาติ (สัปดาห์ถัดไปหลังยืนยันแล้ว — สัปดาห์แรกซิมตอน confirm)
  if (next.ntCamp?.confirmed && weekIndex > 1) {
    next = simulateNtFriendlyWeek(next, weekIndex)
  }

  const paid = payWeeklyWagesWithCash(next.clubs, next.players, next.loans)
  const humanWage = paid.wageTotalByClub[next.humanClubId] ?? 0
  const finance = ensureClubFinance(next)
  next = {
    ...next,
    clubs: paid.clubs,
    players: paid.players,
    clubFinance: {
      ...finance,
      wageSeason: finance.wageSeason + humanWage,
      ledger: [
        {
          id: `fin-wage-intl-${Date.now()}`,
          date: next.currentDate,
          kind: 'wages' as const,
          amount: -humanWage,
          note: 'ค่าเหนื่อยช่วงทีมชาติ',
        },
        ...finance.ledger,
      ].slice(0, 50),
    },
  }

  const weeksLeft = br.weeksLeft - 1
  if (weeksLeft <= 0) {
    const beforeInj = new Map(next.players.map((p) => [p.id, p.injuryDays]))
    players = next.players.map((p) => {
      if (!called.has(p.id)) return p
      const roll = (p.id.length * 17 + next.matchday * 3 + weekIndex * 9) % 100
      let injuryDays = p.injuryDays
      let injuryType = p.injuryType
      if (roll < 8 && injuryDays <= 0) {
        injuryDays = 3 + (roll % 5)
        injuryType = 'muscle'
      }
      const worn = applyIntlReturnStamina(p)
      return {
        ...worn,
        leaveDays: 0,
        injuryDays,
        injuryType,
      }
    })
    const hurt = players.filter(
      (p) => called.has(p.id) && p.injuryDays > 0 && (beforeInj.get(p.id) ?? 0) <= 0,
    )
    const campSummary =
      next.ntCamp?.friendlies?.length && next.career?.nationalNation
        ? ` · ผลอุ่นโค้ชชาติ: ${next.ntCamp.friendlies.map((f) => `${f.opponentTh} ${f.gf}-${f.ga}`).join(' · ')}`
        : ''
    // ปิดหน้าต่าง: นับ windowsInCharge ถ้าคุณเป็นโค้ชชาติ
    next = ensureAssociations(next)
    if (next.ntCamp?.confirmed && next.career?.nationalNation) {
      const n =
        next.ntCamp.nation
      const a = next.associations?.[n]
      if (a) {
        next = {
          ...next,
          associations: {
            ...next.associations,
            [n]: {
              ...a,
              windowsInCharge: a.windowsInCharge + 1,
            },
          },
        }
      }
    }
    next = {
      ...next,
      players,
      internationalBreak: null,
      ntCamp: null,
      inbox: [
        {
          id: `msg-intl-back-${Date.now()}`,
          date: next.currentDate,
          title: 'จบช่วงทีมชาติ — พร้อมลีกต่อ',
          body:
            (hurt.length > 0
              ? `นักเตะกลับจากแคมป์ชาติ · เจ็บจากการไปทีมชาติ: ${hurt.map((p) => p.name).join(' · ')}`
              : 'นักเตะกลับจากทีมชาติครบ · สภาพพร้อมลุยต่อ') + campSummary,
          read: false,
        },
        ...next.inbox,
      ].slice(0, 45),
    }
    next = clearNtCamp(next)
    next = applyIntlBreakRecognition({
      ...next,
      // ยังมี call list จาก br ก่อนเคลียร์
      internationalBreak: br,
    })
    next = { ...next, internationalBreak: null }
    return {
      ok: true,
      save: next,
      message: `จบพักทีมชาติ · ${br.label}`,
    }
  }

  next = {
    ...next,
    internationalBreak: { ...br, weeksLeft },
    inbox: [
      {
        id: `msg-intl-week-${Date.now()}`,
        date: next.currentDate,
        title: `พักทีมชาติ · เหลือ ${weeksLeft} สัปดาห์`,
        body: `${br.label} — ไม่มีนัดลีก · โค้ชชาติยังคุมแคมป์`,
        read: false,
      },
      ...next.inbox,
    ].slice(0, 45),
  }

  return {
    ok: true,
    save: next,
    message: `พักทีมชาติสัปดาห์ที่ ${weekIndex}/${br.totalWeeks} · ${br.label}`,
  }
}
