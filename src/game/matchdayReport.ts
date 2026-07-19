/**
 * สรุปเหตุการณ์หลังเดินเวลา 1 แมตช์เดย์
 * + chronicle สะสมในเซฟ (IndexedDB)
 */
import type { GameSave } from './types'
import { formatMoney } from '@/lib/format'
import { ensurePlayerMoveLog, MOVE_KIND_LABEL, clubLabel } from './playerWorldDb'
import { ensureInsolvency, insolvencyLabelTh } from './insolvency'

export type MatchdayReportKind =
  | 'match'
  | 'finance'
  | 'board'
  | 'quest'
  | 'career'
  | 'media'
  | 'medical'
  | 'calendar'
  | 'transfer'
  | 'fans'
  | 'takeover'
  | 'insolency'
  | 'other'

export interface MatchdayReportLine {
  kind: MatchdayReportKind
  text: string
}

export interface MatchdayReport {
  matchday: number
  season: number
  date: string
  resultsCount: number
  lines: MatchdayReportLine[]
  createdAt: string
}

const CHRONICLE_MAX = 60
const LINES_MAX = 40

export function emptyMatchdayReport(matchday: number, date: string, season = 0): MatchdayReport {
  return {
    matchday,
    season,
    date,
    resultsCount: 0,
    lines: [],
    createdAt: new Date().toISOString(),
  }
}

export function ensureMatchdayChronicle(save: GameSave): MatchdayReport[] {
  return save.matchdayChronicle ?? []
}

/** เทียบ prev→next แล้วรวบเหตุการณ์ทั้งรอบ */
export function buildMatchdayReport(save: GameSave, prev: GameSave, resultsCount: number): MatchdayReport {
  const lines: MatchdayReportLine[] = []
  const md = save.matchday
  const date = save.currentDate
  const season = save.season

  lines.push({
    kind: 'match',
    text: `จำลองครบ ${resultsCount} นัด (คุณ + AI) · S${season} MD${md}`,
  })

  if (save.lastHumanResult) {
    const r = save.lastHumanResult
    lines.push({
      kind: 'match',
      text: `ผลคุณ: ${r.homeGoals}–${r.awayGoals}`,
    })
  }

  // —— ย้าย / ยืม (จาก move log ใหม่) ——
  const prevMoveIds = new Set(ensurePlayerMoveLog(prev).map((m) => m.id))
  const newMoves = ensurePlayerMoveLog(save).filter((m) => !prevMoveIds.has(m.id))
  for (const m of newMoves.slice(0, 8)) {
    const from = clubLabel(save.clubs, m.fromClubId).short
    const to = clubLabel(save.clubs, m.toClubId).short
    lines.push({
      kind: 'transfer',
      text: `${m.playerName}: ${MOVE_KIND_LABEL[m.kind]} ${from}→${to}${
        m.fee ? ` · ${formatMoney(m.fee)}` : ''
      }${m.note ? ` · ${m.note}` : ''}`,
    })
  }

  // —— clubId เปลี่ยนนอก log (สำรอง) ——
  const prevById = new Map(prev.players.map((p) => [p.id, p]))
  let clubChangers = 0
  for (const p of save.players) {
    const old = prevById.get(p.id)
    if (old && old.clubId !== p.clubId) {
      if (!newMoves.some((m) => m.playerId === p.id)) clubChangers++
    }
  }
  if (clubChangers > 0) {
    lines.push({
      kind: 'transfer',
      text: `คลับเปลี่ยนนอก log อีก ~${clubChangers} คน (AI/ฤดูกาล)`,
    })
  }

  // —— เกลียดแฟน ——
  const prevHate = new Map((prev.fans?.hatedTeams ?? []).map((h) => [h.clubId, h.pct ?? 0]))
  for (const h of save.fans?.hatedTeams ?? []) {
    const before = prevHate.get(h.clubId) ?? 0
    const now = h.pct ?? 0
    if (now > before + 5) {
      const name = save.clubs.find((c) => c.id === h.clubId)?.shortName ?? h.clubId
      lines.push({
        kind: 'fans',
        text: `แฟนเกลียด ${name} แรงขึ้น ${before}%→${now}%${h.reasonTh ? ` · ${h.reasonTh}` : ''}`,
      })
    }
  }
  if (save.fans?.mood != null && prev.fans?.mood != null) {
    const d = save.fans.mood - prev.fans.mood
    if (Math.abs(d) >= 4) {
      lines.push({
        kind: 'fans',
        text: `มู้ดแฟน ${d > 0 ? '+' : ''}${d} → ${save.fans.mood}`,
      })
    }
  }
  if (save.fans?.lastEvent && save.fans.lastEvent !== prev.fans?.lastEvent) {
    lines.push({ kind: 'fans', text: save.fans.lastEvent })
  }

  // —— เทคโอเวอร์ ——
  const prevOffers = new Map((prev.takeover?.offers ?? []).map((o) => [o.id, o.status]))
  for (const o of save.takeover?.offers ?? []) {
    const was = prevOffers.get(o.id)
    if (!was && o.status === 'open') {
      lines.push({
        kind: 'takeover',
        text: `ข้อเสนอเทคโอเวอร์: ${o.investorName}`,
      })
    } else if (was && was !== o.status && (o.status === 'accepted' || o.status === 'rejected' || o.status === 'withdrawn')) {
      lines.push({
        kind: 'takeover',
        text: `เทคโอเวอร์ ${o.investorName}: ${o.status}`,
      })
    }
  }
  if (save.takeover?.lastDealNote && save.takeover.lastDealNote !== prev.takeover?.lastDealNote) {
    lines.push({ kind: 'takeover', text: save.takeover.lastDealNote })
  }
  if (save.owner?.name && prev.owner?.name && save.owner.name !== prev.owner.name) {
    lines.push({
      kind: 'takeover',
      text: `เจ้าของใหม่: ${save.owner.name}`,
    })
  }

  // —— วิกฤตการเงิน ——
  const inv = ensureInsolvency(save)
  const prevInv = ensureInsolvency(prev)
  if (inv.stage !== prevInv.stage) {
    lines.push({
      kind: 'insolency',
      text: `สถานะการเงิน: ${insolvencyLabelTh(prevInv.stage)} → ${insolvencyLabelTh(inv.stage)}`,
    })
  } else if (inv.lastNote && inv.lastEventMatchday === md && inv.lastNote !== prevInv.lastNote) {
    lines.push({ kind: 'insolency', text: inv.lastNote })
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)
  const prevHuman = prev.clubs.find((c) => c.id === save.humanClubId)
  if (human && prevHuman) {
    const dBal = human.balance - prevHuman.balance
    if (Math.abs(dBal) >= 500_000) {
      lines.push({
        kind: 'finance',
        text: `งบคลับ ${dBal > 0 ? '+' : ''}${formatMoney(dBal)} → ${formatMoney(human.balance)}`,
      })
    }
  }

  const prog = save.managerProgress
  if (prog?.lastNote && prog.lastNote !== prev.managerProgress?.lastNote) {
    lines.push({ kind: 'career', text: `อาชีพโค้ช: ${prog.lastNote}` })
  }

  const questsDone = (save.clubQuests ?? []).filter(
    (q) =>
      q.status === 'completed' &&
      (prev.clubQuests ?? []).some((p) => p.id === q.id && p.status === 'active'),
  )
  for (const q of questsDone) {
    lines.push({ kind: 'quest', text: `เควสสำเร็จ: ${q.title} (+${q.rewardXp} XP)` })
  }

  if (save.board && prev.board) {
    const d = save.board.confidence - prev.board.confidence
    if (d !== 0) {
      lines.push({
        kind: 'board',
        text: `ความมั่นใจบอร์ด ${d > 0 ? '+' : ''}${d} → ${save.board.confidence}`,
      })
    }
    if (save.board.sacked && !prev.board.sacked) {
      lines.push({ kind: 'board', text: `ถูกปลด: ${save.board.sackedNote ?? ''}` })
    }
    if (
      save.board.transferFreezeUntil !== prev.board.transferFreezeUntil &&
      save.board.transferFreezeUntil >= save.matchday
    ) {
      lines.push({
        kind: 'board',
        text: `แช่ตลาดถึง MD${save.board.transferFreezeUntil}`,
      })
    }
  }

  if (save.internationalBreak && !prev.internationalBreak) {
    lines.push({
      kind: 'calendar',
      text: `เข้าพัก: ${save.internationalBreak.label} (${save.internationalBreak.weeksLeft} สัปดาห์)`,
    })
  }

  const newInbox = save.inbox.filter((m) => !prev.inbox.some((p) => p.id === m.id)).slice(0, 8)
  for (const m of newInbox) {
    lines.push({ kind: 'media', text: m.title })
  }

  const injured = save.players.filter(
    (p) =>
      p.clubId === save.humanClubId &&
      p.injuryDays > 0 &&
      (prev.players.find((x) => x.id === p.id)?.injuryDays ?? 0) === 0,
  )
  if (injured.length) {
    lines.push({
      kind: 'medical',
      text: `เจ็บใหม่: ${injured.map((p) => p.name).slice(0, 4).join(', ')}`,
    })
  }

  const banned = save.players.filter(
    (p) =>
      p.clubId === save.humanClubId &&
      (p.banMatches ?? 0) > 0 &&
      (prev.players.find((x) => x.id === p.id)?.banMatches ?? 0) === 0,
  )
  if (banned.length) {
    lines.push({
      kind: 'medical',
      text: `แบนใหม่: ${banned.map((p) => p.name).slice(0, 4).join(', ')}`,
    })
  }

  return {
    matchday: md,
    season,
    date,
    resultsCount,
    lines: lines.slice(0, LINES_MAX),
    createdAt: new Date().toISOString(),
  }
}

/** ใส่รายงานล่าสุด + สะสม chronicle */
export function applyMatchdayChronicle(
  save: GameSave,
  prev: GameSave,
  resultsCount: number,
): GameSave {
  const report = buildMatchdayReport(save, prev, resultsCount)
  const chronicle = [report, ...ensureMatchdayChronicle(save)].slice(0, CHRONICLE_MAX)
  return {
    ...save,
    lastMatchdayReport: report,
    matchdayChronicle: chronicle,
  }
}

export function reportKindLabelTh(kind: MatchdayReportKind): string {
  const map: Record<MatchdayReportKind, string> = {
    match: 'แมตช์',
    finance: 'การเงิน',
    board: 'บอร์ด',
    quest: 'เควส',
    career: 'อาชีพ',
    media: 'สื่อ',
    medical: 'แพทย์',
    calendar: 'ปฏิทิน',
    transfer: 'ย้าย',
    fans: 'แฟน',
    takeover: 'เทคโอเวอร์',
    insolency: 'วิกฤต',
    other: 'อื่น',
  }
  return map[kind]
}
