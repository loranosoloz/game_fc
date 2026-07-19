import type { GameSave, InboxMessage, Player } from './types'
import { blankTable, generateSeasonFixtures } from './fixtures'
import { createCupState, generateCupFixtures } from './cup'
import {
  createUclState,
  createUclInviteClubs,
  generateUclFixtures,
} from './ucl'
import { assignRefereesToFixtures } from './referees'
import { getLeague, type LeagueId } from '@/data/world'
import { ensureBoard } from './board'
import { ensureOwner } from './owner'
import { ensureTakeover } from './takeover'
import { createClubFinance } from './playerEconomy'
import { createYouthState } from './youth'
import { ensureFans } from './fans'
import { autoPickTactics } from './seed'
import { createTransferDesk } from './transferDesk'
import { createWorldPulse } from './worldPulse'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`
}

function seasonStartDate(season: number): string {
  return `${season}-08-15`
}

function sortedTable(save: GameSave) {
  return save.table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
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
  const domesticClubs = save.clubs.filter((c) => !c.id.startsWith('ucl-'))
  const domesticIds = domesticClubs.map((c) => c.id)
  const tableSorted = sortedTable(save)
  const championId = tableSorted[0]?.clubId
  const champion = domesticClubs.find((c) => c.id === championId)
  const humanRank = tableSorted.findIndex((r) => r.clubId === save.humanClubId) + 1

  // คืนนักเตะจากการยืมก่อนขึ้นปีใหม่
  let players = save.players
    .filter((p) => !p.id.startsWith('ucl-'))
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

  // เติม XI หลังปลด/หมดสัญญา
  for (const club of domesticClubs) {
    const t = tacticsByClub[club.id]
    if (!t) continue
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

  const leagueFx = generateSeasonFixtures(domesticIds, startDate)
  const cupFx = generateCupFixtures(domesticClubs, startDate)
  const uclFx = generateUclFixtures(domesticClubs, invite.clubs, save.humanClubId, startDate)
  const fixtures = assignRefereesToFixtures([...leagueFx, ...cupFx, ...uclFx])

  const board = ensureBoard(save)
  const owner = ensureOwner(save)
  const takeover = {
    ...ensureTakeover({ ...save, season: newSeason }),
    cadenceSeason: newSeason,
    approachedThisSeason: false,
  }

  const youthBase = save.youth ?? createYouthState()
  const fans = ensureFans(save).fans
  const inbox: InboxMessage[] = [
    {
      id: uid('msg-season'),
      date: startDate,
      title: `เปิดฤดูกาล ${newSeason}`,
      body: [
        champion ? `แชมป์ลีก ${oldSeason}: ${champion.name}` : `จบฤดูกาล ${oldSeason}`,
        `คุณจบอันดับ #${humanRank || '—'}`,
        'ออฟซีซัน: อายุ +1 · ตารางใหม่ · ยืมตัวคืน · สัญญาหมดต่ออัตโนมัติ 1 ปี',
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
    table: blankTable(domesticIds),
    cup: createCupState(getLeague(leagueId).cupName),
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
      lowConfidenceStreak: Math.max(0, board.lowConfidenceStreak - 1),
      ultimatum: null,
      transferFreezeUntil: -1,
      lastBudgetRequestMatchday: -99,
      lastNote: `บอร์ดตั้งเป้าฤดูกาล ${newSeason} · ท็อป ${board.targetMaxRank}`,
      kpis: board.kpis.map((k) => {
        if (k.id === 'youth') return { ...k, current: 0, met: false }
        if (k.id === 'league_rank') return { ...k, current: 20, met: false }
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
    message: `เริ่มฤดูกาล ${newSeason} · ปีที่แล้วอันดับ #${humanRank}`,
  }
}

export function seasonSummaryLine(save: GameSave): string {
  if (!save.seasonComplete) return `ฤดูกาล ${save.season} กำลังแข่ง`
  const rank = sortedTable(save).findIndex((r) => r.clubId === save.humanClubId) + 1
  return `จบฤดูกาล ${save.season} · อันดับ #${rank || '—'} · กดเริ่มฤดูกาลใหม่ได้`
}
