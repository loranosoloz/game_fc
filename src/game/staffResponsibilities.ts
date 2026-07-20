/**
 * มอบหมายงานสตาฟ (Responsibilities) — สตาฟทำแทนผู้จัดการบางงานอัตโนมัติ
 */
import type { GameSave, StaffResponsibilities, StaffResponsibilityTask } from './types'
import { staffLevel } from './staff'
import { renewContract } from './transfer'
import { assignFormWatch, formWatchCost, ensureScouting } from './scouting'
import { buildOppositionReport } from './opposition'
import { nextHumanFixture } from './preMatch'

export const RESPONSIBILITY_TASKS: StaffResponsibilityTask[] = [
  'training',
  'opposition_report',
  'contract_reminders',
  'form_watches',
  'set_piece_advice',
  'press_prep',
]

export const RESPONSIBILITY_LABEL: Record<StaffResponsibilityTask, string> = {
  training: 'ดูแลแผนซ้อมรายสัปดาห์',
  opposition_report: 'รายงานคู่แข่งก่อนนัด',
  contract_reminders: 'เตือน/ต่อสัญญาใกล้หมด',
  form_watches: 'สั่งสเกาต์ดูฟอร์มอัตโนมัติ',
  set_piece_advice: 'แนะนำผู้ยิงเซ็ตพีซ',
  press_prep: 'เตรียมประเด็นแถลงข่าว',
}

export function defaultResponsibilities(): StaffResponsibilities {
  return {
    byTask: {
      training: 'assistant',
      opposition_report: 'assistant',
      contract_reminders: 'manager',
      form_watches: 'scout',
      set_piece_advice: 'assistant',
      press_prep: 'manager',
    },
    lastAutoNote: 'ยังไม่รันมอบหมายอัตโนมัติ',
    lastRunMatchday: -1,
  }
}

export function ensureResponsibilities(save: GameSave): StaffResponsibilities {
  const r = save.staff.responsibilities
  if (!r?.byTask) return defaultResponsibilities()
  return {
    ...defaultResponsibilities(),
    ...r,
    byTask: { ...defaultResponsibilities().byTask, ...r.byTask },
  }
}

export function setResponsibility(
  save: GameSave,
  task: StaffResponsibilityTask,
  assignee: string,
): GameSave {
  const resp = ensureResponsibilities(save)
  return {
    ...save,
    staff: {
      ...save.staff,
      responsibilities: {
        ...resp,
        byTask: { ...resp.byTask, [task]: assignee },
      },
    },
  }
}

function isDelegated(resp: StaffResponsibilities, task: StaffResponsibilityTask): boolean {
  const v = resp.byTask[task]
  return Boolean(v && v !== 'manager' && v !== 'none')
}

/** รันงานที่มอบหมายหลังแมตช์เดย์ / เดินวัน */
export function tickStaffResponsibilities(save: GameSave): GameSave {
  let next = save
  const resp = ensureResponsibilities(next)
  if (resp.lastRunMatchday === next.matchday && next.matchday > 0) {
    return { ...next, staff: { ...next.staff, responsibilities: resp } }
  }

  const notes: string[] = []

  // เตือนสัญญา — ผู้ช่วย/โค้ช
  if (isDelegated(resp, 'contract_reminders') || resp.byTask.contract_reminders === 'assistant') {
    const expiring = next.players.filter(
      (p) =>
        p.clubId === next.humanClubId &&
        p.contractEndSeason > 0 &&
        p.contractEndSeason <= next.season + 1 &&
        p.age <= 34,
    )
    if (expiring.length > 0 && staffLevel(next.staff, 'coach') >= 8) {
      const target = expiring.sort((a, b) => b.overall - a.overall)[0]!
      // ต่ออัตโนมัติเฉพาะคนสำคัญถ้าระดับสตาฟสูง
      if (
        (target.squadRole === 'key' || target.squadRole === 'regular') &&
        staffLevel(next.staff, 'coach') >= 12 &&
        resp.byTask.contract_reminders !== 'manager'
      ) {
        const result = renewContract(next, target.id, target.wage, Math.max(2, target.contractYears || 2))
        if (result.ok && result.save) {
          next = result.save
          notes.push(`ผู้ช่วยต่อสัญญา ${target.name} อัตโนมัติ`)
        } else {
          notes.push(`ผู้ช่วยเตือน: ${expiring.length} คนใกล้หมดสัญญา`)
        }
      } else {
        notes.push(`ผู้ช่วยเตือน: ${expiring.length} คนใกล้หมดสัญญา`)
      }
    }
  }

  // สั่งดูฟอร์มอัตโนมัติ
  if (isDelegated(resp, 'form_watches') || resp.byTask.form_watches === 'scout') {
    if (staffLevel(next.staff, 'scout') >= 6) {
      const scouting = ensureScouting(next)
      const pending = scouting.pendingWatches.filter((w) => w.status === 'pending').length
      if (pending < 2) {
        const fx = next.fixtures.find(
          (f) =>
            !f.played &&
            f.competition === 'league' &&
            f.homeClubId !== next.humanClubId &&
            f.awayClubId !== next.humanClubId,
        )
        if (fx && next.clubs.find((c) => c.id === next.humanClubId)!.balance >= formWatchCost(next)) {
          const target = next.players
            .filter(
              (p) =>
                (p.clubId === fx.homeClubId || p.clubId === fx.awayClubId) &&
                p.overall >= 72,
            )
            .sort((a, b) => b.overall - a.overall)[0]
          if (target) {
            const r = assignFormWatch(next, fx.id, [target.id])
            if (r.ok && r.save) {
              next = r.save
              notes.push(`สเกาต์สั่งดูฟอร์ม ${target.name}`)
            }
          }
        }
      }
    }
  }

  // รายงานคู่แข่ง
  if (isDelegated(resp, 'opposition_report') || resp.byTask.opposition_report === 'assistant') {
    const fx = nextHumanFixture(next)
    if (fx) {
      const oppId = fx.homeClubId === next.humanClubId ? fx.awayClubId : fx.homeClubId
      const report = buildOppositionReport(next, oppId)
      notes.push(`ผู้ช่วย: คู่แข่งใช้ ${report.formation} · ${report.advice}`)
    }
  }

  // แนะนำเซ็ตพีซ
  if (isDelegated(resp, 'set_piece_advice') || resp.byTask.set_piece_advice === 'assistant') {
    const tactics = next.tacticsByClub[next.humanClubId]
    if (tactics && !tactics.setPieceTakers?.penalties) {
      const squad = next.players
        .filter((p) => p.clubId === next.humanClubId && (tactics.startingXi ?? []).includes(p.id))
        .sort((a, b) => (b.attrs?.finishing ?? 0) - (a.attrs?.finishing ?? 0))
      const pen = squad[0]
      const fk = [...squad].sort((a, b) => (b.attrs?.technique ?? 0) - (a.attrs?.technique ?? 0))[0]
      const corner = [...squad].sort((a, b) => (b.attrs?.crossing ?? 0) - (a.attrs?.crossing ?? 0))[0]
      if (pen) {
        next = {
          ...next,
          tacticsByClub: {
            ...next.tacticsByClub,
            [next.humanClubId]: {
              ...tactics,
              setPieceTakers: {
                penalties: pen.id,
                freeKicks: fk?.id ?? pen.id,
                corners: corner?.id ?? pen.id,
                throwIns: tactics.startingXi?.[2] ?? pen.id,
              },
            },
          },
        }
        notes.push(`ผู้ช่วยตั้งผู้ยิงจุดโทษ: ${pen.name}`)
      }
    }
  }

  if (resp.byTask.training === 'assistant' || resp.byTask.training === 'coach') {
    notes.push('ผู้ช่วยดูแลแผนซ้อมสัปดาห์นี้')
  }

  if (resp.byTask.press_prep === 'assistant') {
    notes.push('ผู้ช่วยเตรียมประเด็นแถลงข่าวไว้แล้ว')
  }

  const lastAutoNote =
    notes.length > 0 ? notes.slice(0, 3).join(' · ') : 'มอบหมายงาน — ไม่มีแอคชันรอบนี้'

  return {
    ...next,
    staff: {
      ...next.staff,
      responsibilities: {
        ...ensureResponsibilities(next),
        ...resp,
        byTask: resp.byTask,
        lastAutoNote,
        lastRunMatchday: next.matchday,
      },
    },
    inbox:
      notes.length > 0
        ? [
            {
              id: `msg-resp-${next.matchday}-${Date.now().toString(36)}`,
              date: next.currentDate,
              title: 'สตาฟทำงานตามมอบหมาย',
              body: lastAutoNote,
              read: false,
            },
            ...next.inbox,
          ].slice(0, 45)
        : next.inbox,
  }
}
