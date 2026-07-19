import type { GameSave, InboxMessage, Player } from './types'
import { blankTable, generateSeasonFixtures } from './fixtures'
import {
  createUclState,
  createUclInviteClubs,
  generateUclFixtures,
} from './ucl'
import { assignRefereesToFixtures } from './referees'
import { getLeague, type LeagueId, EXTRA_CUP_NAMES, DIV2_LEAGUE_NAME } from '@/data/world'
import { ensureBoard } from './board'
import { ensureOwner } from './owner'
import { ensureTakeover } from './takeover'
import { createClubFinance } from './playerEconomy'
import { createYouthState } from './youth'
import { ensureFans } from './fans'
import { autoPickTactics } from './seed'
import { createTransferDesk } from './transferDesk'
import { createWorldPulse } from './worldPulse'
import {
  generateLeagueCupFixtures,
  generateTrophyFixtures,
} from './extraCups'
import { createCupState, generateCupFixtures } from './cup'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function seasonStartDate(season: number): string {
  return `${season}-08-15`
}

function sortedRows(table: GameSave['table']) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

function sortedTable(save: GameSave) {
  return sortedRows(save.table)
}

/** ตกชั้น 3 ทีมท้ายดิวิชัน 1 ↔ เลื่อนชั้น 3 ทีมนำดิวิชัน 2 */
function applyPromotionRelegation(
  clubs: GameSave['clubs'],
  tableDiv1: GameSave['table'],
  tableDiv2: GameSave['table'],
): { clubs: GameSave['clubs']; notes: string[] } {
  const d1 = sortedRows(tableDiv1)
  const d2 = sortedRows(tableDiv2 ?? [])
  if (d1.length < 3 || d2.length < 3) {
    return {
      clubs: clubs.map((c) => ({
        ...c,
        division: (c.division ?? (c.id.startsWith('d2-') ? 2 : 1)) as 1 | 2,
      })),
      notes: [],
    }
  }
  const relegated = new Set(d1.slice(-3).map((r) => r.clubId))
  const promoted = new Set(d2.slice(0, 3).map((r) => r.clubId))
  const notes: string[] = []
  const next = clubs.map((c) => {
    if (c.id.startsWith('ucl-')) return { ...c, division: 1 as const }
    if (relegated.has(c.id)) {
      notes.push(`${c.name} ตกชั้น`)
      return {
        ...c,
        division: 2 as const,
        reputation: Math.max(40, c.reputation - 3),
      }
    }
    if (promoted.has(c.id)) {
      notes.push(`${c.name} เลื่อนชั้น`)
      return {
        ...c,
        division: 1 as const,
        reputation: Math.min(92, c.reputation + 4),
      }
    }
    return {
      ...c,
      division: (c.division ?? (c.id.startsWith('d2-') ? 2 : 1)) as 1 | 2,
    }
  })
  return { clubs: next, notes }
}

/** อายุ +1 · รีเซ็ตสถิติฤดูกาล · สัญญาหมดต่ออัตโนมัติ 1 ปี (หรือปลดวัยเก๋าคุณภาพต่ำ) */
function rollPlayersForNewSeason(players: Player[], newSeason: number): {
  players: Player[]
  notes: string[]
} {
  const notes: string[] = []
  const next = players.map((p) => {
    let aged: Player = {
      ...p,
      age: p.age + 1,
      seasonYellows: 0,
      minutesPlayed: 0,
      banMatches: 0,
      form: Math.max(1, Math.min(10, Math.round((p.form + 6) / 2))),
      fatigue: Math.max(0, Math.round(p.fatigue * 0.35)),
      injuryDays: 0,
      illnessDays: p.illnessDays ? Math.min(p.illnessDays, 3) : 0,
    }

    const expired = aged.contractEndSeason > 0 && aged.contractEndSeason < newSeason
    if (!expired) return aged

    // ปลดนักเตะแก่คุณภาพไม่ถึง — ไม่มีคลับ (ว่างงานในตลาด)
    if (aged.age >= 34 && aged.overall < 72) {
      notes.push(`${aged.name} หมดสัญญาและเลิกเล่นอาชีพ`)
      return null
    }

    aged = {
      ...aged,
      contractYears: 1,
      contractEndSeason: newSeason + 1,
      wageWeekly: Math.round(aged.wageWeekly * (aged.age >= 32 ? 0.92 : 1.02)),
    }
    notes.push(`${aged.name} ต่อสัญญาอัตโนมัติ 1 ปี`)
    return aged
  })

  return {
    players: next.filter((p): p is Player => p != null),
    notes,
  }
}

/**
 * เริ่มฤดูกาลใหม่หลังจบลีก — ออฟซีซันสั้น + ตารางใหม่
 */
export function startNextSeason(save: GameSave): { ok: boolean; save: GameSave; message: string } {
  if (!save.seasonComplete) {
    return { ok: false, save, message: 'ฤดูกาลยังไม่จบ — เล่นให้ครบทุกรอบลีกก่อน' }
  }
  if (save.board?.sacked) {
    return { ok: false, save, message: 'คุณถูกปลดแล้ว — ยังเริ่มฤดูกาลใหม่กับคลับนี้ไม่ได้' }
  }

  const oldSeason = save.season
  const newSeason = oldSeason + 1
  const startDate = seasonStartDate(newSeason)
  const leagueId = (save.leagueId || 'eng') as LeagueId
  let domesticClubs = save.clubs
    .filter((c) => !c.id.startsWith('ucl-'))
    .map((c) => ({
      ...c,
      division: (c.division ?? (c.id.startsWith('d2-') ? 2 : 1)) as 1 | 2,
    }))
  const tableSorted = sortedTable(save)
  const championId = tableSorted[0]?.clubId
  const champion = domesticClubs.find((c) => c.id === championId)
  const humanClub = domesticClubs.find((c) => c.id === save.humanClubId)
  const humanTable =
    humanClub?.division === 2 ? sortedRows(save.tableDiv2 ?? []) : tableSorted
  const humanRank = humanTable.findIndex((r) => r.clubId === save.humanClubId) + 1

  const promo = applyPromotionRelegation(domesticClubs, save.table, save.tableDiv2 ?? [])
  domesticClubs = promo.clubs.filter((c) => !c.id.startsWith('ucl-')) as typeof domesticClubs

  // คืนนักเตะจากการยืมก่อนขึ้นปีใหม่
  let players = save.players
    .filter((p) => !p.id.startsWith('ucl-') && !p.id.startsWith('ucl-p'))
    .map((p) => {
      if (String(p.clubId).startsWith('ucl-')) return null
      return p
    })
    .filter((p): p is Player => p != null)

  // คืนยืม: ย้ายกลับ fromClub
  for (const loan of save.loans ?? []) {
    if (loan.status !== 'active') continue
    players = players.map((p) =>
      p.id === loan.playerId ? { ...p, clubId: loan.fromClubId } : p,
    )
  }

  const rolled = rollPlayersForNewSeason(players, newSeason)
  players = rolled.players

  const invite = createUclInviteClubs(leagueId)
  players = [...players, ...invite.players]

  let clubs = [
    ...domesticClubs.map((c) => ({
      ...c,
      seasonStartBalance: c.balance,
      ticketRevenueSeason: 0,
      shirtRevenueSeason: 0,
    })),
    ...invite.clubs,
  ]

  if (championId === save.humanClubId) {
    clubs = clubs.map((c) =>
      c.id === save.humanClubId
        ? {
            ...c,
            balance: c.balance + 5_000_000,
            reputation: Math.min(99, c.reputation + 2),
          }
        : c,
    )
  }

  const tacticsByClub = { ...save.tacticsByClub }
  for (const id of Object.keys(tacticsByClub)) {
    if (id.startsWith('ucl-')) delete tacticsByClub[id]
  }
  Object.assign(tacticsByClub, invite.tactics)

  for (const club of domesticClubs) {
    const t = tacticsByClub[club.id]
    if (!t) {
      tacticsByClub[club.id] = autoPickTactics(club.id, players)
      continue
    }
    const valid = new Set(players.filter((p) => p.clubId === club.id).map((p) => p.id))
    const xi = t.startingXi.filter((id) => valid.has(id))
    const bench = t.bench.filter((id) => valid.has(id))
    if (xi.length < 11) {
      tacticsByClub[club.id] = {
        ...autoPickTactics(club.id, players, t.formation, t.formationOop),
        instructions: t.instructions,
        familiarity: Math.max(40, Math.round(t.familiarity * 0.85)),
        setPieces: t.setPieces,
        opposition: t.opposition,
      }
    } else {
      tacticsByClub[club.id] = {
        ...t,
        startingXi: xi,
        bench,
        familiarity: Math.max(40, Math.round(t.familiarity * 0.85)),
      }
    }
  }

  const d1Ids = domesticClubs.filter((c) => c.division === 1).map((c) => c.id)
  const d2Ids = domesticClubs.filter((c) => c.division === 2).map((c) => c.id)
  const leagueFx = generateSeasonFixtures(d1Ids, startDate, 1)
  const leagueFx2 =
    d2Ids.length === 20 ? generateSeasonFixtures(d2Ids, startDate, 2) : []
  const cupFx = generateCupFixtures(domesticClubs, startDate)
  const lc = generateLeagueCupFixtures(
    domesticClubs,
    startDate,
    EXTRA_CUP_NAMES[leagueId].leagueCup,
  )
  const tr = generateTrophyFixtures(
    domesticClubs,
    startDate,
    EXTRA_CUP_NAMES[leagueId].trophy,
  )
  const uclFx = generateUclFixtures(
    domesticClubs.filter((c) => c.division === 1),
    invite.clubs,
    save.humanClubId,
    startDate,
  )
  const fixtures = assignRefereesToFixtures([
    ...leagueFx,
    ...leagueFx2,
    ...cupFx,
    ...lc.fixtures,
    ...tr.fixtures,
    ...uclFx,
  ])

  const board = ensureBoard(save)
  const owner = ensureOwner(save)
  const takeover = {
    ...ensureTakeover({ ...save, season: newSeason }),
    cadenceSeason: newSeason,
    approachedThisSeason: false,
  }

  const youthBase = save.youth ?? createYouthState()
  const fans = ensureFans(save).fans
  const humanAfter = clubs.find((c) => c.id === save.humanClubId)
  const inbox: InboxMessage[] = [
    {
      id: uid('msg-season'),
      date: startDate,
      title: `เปิดฤดูกาล ${newSeason}`,
      body: [
        champion ? `แชมป์ดิวิชัน 1 ปี ${oldSeason}: ${champion.name}` : `จบฤดูกาล ${oldSeason}`,
        `คุณจบอันดับ #${humanRank || '—'}`,
        humanAfter?.division === 2
          ? `แข่งใน${DIV2_LEAGUE_NAME[leagueId].nameTh}`
          : 'แข่งดิวิชันบน',
        promo.notes.length ? promo.notes.join(' · ') : 'ไม่มีสลับชั้น',
        'ออฟซีซัน: อายุ +1 · ตารางใหม่ · ถ้วยครบ',
      ].join(' · '),
      read: false,
    },
    ...save.inbox,
  ].slice(0, 40)

  const next: GameSave = {
    ...save,
    season: newSeason,
    matchday: 0,
    currentDate: startDate,
    seasonComplete: false,
    clubs,
    players,
    tacticsByClub,
    fixtures,
    table: blankTable(d1Ids),
    tableDiv2: blankTable(d2Ids),
    cup: createCupState(getLeague(leagueId).cupName),
    leagueCup: lc.state,
    trophy: tr.state,
    ucl: createUclState(),
    lastHumanResult: null,
    pressConference: null,
    clubFinance: {
      ...createClubFinance(),
      ledger: (save.clubFinance?.ledger ?? []).slice(0, 15),
    },
    youth: {
      ...youthBase,
      nextIntakeMatchday: 8,
      lastIntakeNote: `อะคาเดมีพร้อมฤดูกาล ${newSeason}`,
    },
    board: {
      ...board,
      targetMaxRank: humanAfter?.division === 2 ? 6 : board.targetMaxRank,
      lowConfidenceStreak: Math.max(0, board.lowConfidenceStreak - 1),
      ultimatum: null,
      transferFreezeUntil: -1,
      lastBudgetRequestMatchday: -99,
      lastNote:
        humanAfter?.division === 2
          ? `บอร์ดเป้าเลื่อนชั้น · ท็อป 6 ใน${DIV2_LEAGUE_NAME[leagueId].nameTh}`
          : `บอร์ดตั้งเป้าฤดูกาล ${newSeason} · ท็อป ${board.targetMaxRank}`,
      kpis: board.kpis.map((k) => {
        if (k.id === 'youth') return { ...k, current: 0, met: false }
        if (k.id === 'league_rank') {
          const target = humanAfter?.division === 2 ? 6 : board.targetMaxRank
          return {
            ...k,
            label: humanAfter?.division === 2 ? `ติดท็อป ${target} (เลื่อนชั้น)` : k.label,
            target,
            current: 20,
            met: false,
          }
        }
        return k
      }),
    },
    owner: {
      ...owner,
      lastNote: `${owner.name} พร้อมฤดูกาล ${newSeason}`,
      pendingDemand: null,
    },
    takeover,
    fans: {
      ...fans,
      expectation: Math.min(
        90,
        Math.max(35, fans.expectation + (humanRank <= 6 ? 2 : humanRank >= 15 ? -2 : 0)),
      ),
      lastEvent: `เปิดฤดูกาล ${newSeason}`,
      lastVerdict: `แฟนรอฤดูกาล ${newSeason}`,
      protestActive: false,
      boycottUntilMatchday: -1,
    },
    inbox,
    loans: [],
    transferDesk: createTransferDesk(),
    worldPulse: createWorldPulse(leagueId),
  }

  return {
    ok: true,
    save: next,
    message: `เริ่มฤดูกาล ${newSeason} · ปีที่แล้วอันดับ #${humanRank}${
      promo.notes.length ? ` · ${promo.notes.join(', ')}` : ''
    }`,
  }
}

export function seasonSummaryLine(save: GameSave): string {
  if (!save.seasonComplete) return `ฤดูกาล ${save.season} กำลังแข่ง`
  const rank = sortedTable(save).findIndex((r) => r.clubId === save.humanClubId) + 1
  return `จบฤดูกาล ${save.season} · อันดับ #${rank || '—'} · กดเริ่มฤดูกาลใหม่ได้`
}
