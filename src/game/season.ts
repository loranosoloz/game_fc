import type { GameSave, InboxMessage, Player } from './types'
import { blankTable, generateSeasonFixtures } from './fixtures'
import {
  createUclState,
  createUelState,
  createUeclState,
  generateUclFixtures,
  generateUelFixtures,
  generateUeclFixtures,
  createEuropeCupsPack,
} from './ucl'
import { snapshotEuroRanks } from './europeAccess'
import {
  createAclState,
  createAclTwoState,
  createAseanCupState,
  createAsiaCupsPack,
  generateAsiaKnockoutFixtures,
  snapshotAsiaRanks,
} from './asiaAccess'
import {
  createCwcState,
  createCwcPack,
  generateCwcFixtures,
  snapshotCwcSeeds,
} from './clubWorldCup'
import {
  createSuperCupState,
  generateSuperCupFixture,
  snapshotDomesticTitles,
} from './superCup'
import { openPreSeasonWindow } from './preSeason'
import { assignRefereesToFixtures } from './referees'
import { getLeague, type LeagueId, EXTRA_CUP_NAMES, DIV2_LEAGUE_NAME, promoRelegCount, isValidLeagueSize } from '@/data/world'
import { ensureBoard } from './board'
import { ensureOwner } from './owner'
import { ensureTakeover } from './takeover'
import { rollInsolvencyForNewSeason } from './insolvency'
import { createClubQuests } from './managerProgress'
import { buildSeasonCalendar } from './seasonCalendar'
import { createClubFinance } from './playerEconomy'
import { createYouthState } from './youth'
import { ensureFans, recordHatredAfterLeave } from './fans'
import { areRivals } from './rivalries'
import { autoPickTactics } from './seed'
import { createTransferDesk } from './transferDesk'
import { domesticPrizeScale } from './clubIncome'
import { applyTitleClubReputation } from './reputation'
import { resetAwardsForNewSeason } from './awards'
import { tickPromotionClauses } from './transferClauses'
import { tickFeeInstallments } from './transferPayments'
import {
  applyAnnualWageRises,
  applyEuropeWageBumps,
  applyPreContractsOnSeasonStart,
  applyRelegationReleaseClauses,
} from './transferAdvanced'
import { processLoanObligationsOnSeasonEnd } from './loans'
import { createWorldPulse } from './worldPulse'
import {
  generateLeagueCupFixtures,
  generateTrophyFixtures,
} from './extraCups'
import { createCupState, generateCupFixtures } from './cup'
import { runSummerIntlTournaments } from './intlTournaments'
import { ensureSquadLanguages } from './languages'
import { formatMoney } from '@/lib/format'

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

/** ตกชั้น ↔ เลื่อนชั้น — อังกฤษฯ 3 ทีม · เยอรมัน/ฝรั่งเศส 2 ทีม */
function applyPromotionRelegation(
  clubs: GameSave['clubs'],
  tableDiv1: GameSave['table'],
  tableDiv2: GameSave['table'],
  leagueId: string,
): { clubs: GameSave['clubs']; notes: string[] } {
  const slots = promoRelegCount(leagueId)
  const d1 = sortedRows(tableDiv1)
  const d2 = sortedRows(tableDiv2 ?? [])
  if (d1.length < slots || d2.length < slots) {
    return {
      clubs: clubs.map((c) => ({
        ...c,
        division: (c.division ?? (c.id.startsWith('d2-') ? 2 : 1)) as 1 | 2,
      })),
      notes: [],
    }
  }
  const relegated = new Set(d1.slice(-slots).map((r) => r.clubId))
  const promoted = new Set(d2.slice(0, slots).map((r) => r.clubId))
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

/** อายุ +1 · รีเซ็ตสถิติฤดูกาล · สัญญาหมด: ย้ายฟรีถ้าไม่ยอมต่อ/อยากย้าย · หรือต่ออัตโนมัติ */
function rollPlayersForNewSeason(
  players: Player[],
  newSeason: number,
  clubs: GameSave['clubs'],
  save: GameSave,
): {
  players: Player[]
  notes: string[]
  fans: GameSave['fans']
  clubsWithFans: GameSave['clubs']
} {
  const notes: string[] = []
  let fansSave: GameSave = ensureFans(save)
  const aiClubs = clubs.filter((c) => c.controlledBy === 'ai' && !c.id.startsWith('ucl-'))

  const next = players.map((p) => {
    let aged: Player = {
      ...p,
      age: p.age + 1,
      seasonYellows: 0,
      minutesPlayed: 0,
      banMatches: 0,
      form: Math.max(1, Math.min(10, Math.round((p.form + 6) / 2))),
      condition: Math.min(100, Math.round((p.condition + 100) / 2)),
      injuryDays: 0,
      illnessDays: p.illnessDays ? Math.min(p.illnessDays, 3) : 0,
    }

    const expired = aged.contractEndSeason > 0 && aged.contractEndSeason < newSeason
    if (!expired) return aged

    if (aged.age >= 34 && aged.overall < 72) {
      notes.push(`${aged.name} หมดสัญญาและเลิกเล่นอาชีพ`)
      return null
    }

    const walkFree =
      aged.refuseContractRenewal ||
      (aged.wantAway?.active &&
        ((aged.wantAway.intensity ?? 0) >= 10 || aged.wantAway.publicNews))

    if (walkFree && aiClubs.length && aged.clubId) {
      const fromId = aged.clubId
      const rivals = aiClubs.filter(
        (c) => c.id !== fromId && areRivals(fansSave, fromId, c.id),
      )
      const poolBase = aiClubs.filter((c) => c.id !== fromId)
      const pool = rivals.length && Math.random() < 0.55 ? rivals : poolBase
      if (pool.length) {
        const dest = pool.sort((a, b) => b.reputation - a.reputation)[
          Math.floor(Math.random() * Math.min(5, pool.length))
        ]!
        fansSave = recordHatredAfterLeave(fansSave, fromId, aged, dest.id, {
          freeTransfer: true,
          wasKey: aged.squadRole === 'key' || aged.overall >= 78,
        })
        notes.push(
          `${aged.name} ย้ายฟรี ${fansSave.clubs.find((c) => c.id === fromId)?.shortName ?? ''}→${dest.shortName}${
            areRivals(fansSave, fromId, dest.id) ? ' (คู่อริ!)' : ''
          } — แฟนเกลียด`,
        )
        return {
          ...aged,
          clubId: dest.id,
          contractYears: 2,
          contractEndSeason: newSeason + 2,
          wage: Math.round(aged.wage * 1.05),
          refuseContractRenewal: false,
          wantAway: null,
          happiness: Math.min(20, (aged.happiness ?? 10) + 3),
          morale: Math.min(20, aged.morale + 2),
        }
      }
    }

    aged = {
      ...aged,
      contractYears: 1,
      contractEndSeason: newSeason + 1,
      wage: Math.round(aged.wage * (aged.age >= 32 ? 0.92 : 1.02)),
    }
    notes.push(`${aged.name} ต่อสัญญาอัตโนมัติ 1 ปี`)
    return aged
  })

  return {
    players: next.filter((p): p is Player => p != null),
    notes,
    fans: fansSave.fans,
    clubsWithFans: fansSave.clubs,
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

  const promo = applyPromotionRelegation(
    domesticClubs,
    save.table,
    save.tableDiv2 ?? [],
    leagueId,
  )
  domesticClubs = promo.clubs.filter((c) => !c.id.startsWith('ucl-')) as typeof domesticClubs
  const promotedIds = sortedRows(save.tableDiv2 ?? [])
    .slice(0, 3)
    .map((r) => r.clubId)

  // คืนนักเตะจากการยืมก่อนขึ้นปีใหม่
  let players = save.players
    .filter((p) => !p.id.startsWith('ucl-') && !p.id.startsWith('ucl-p'))
    .map((p) => {
      if (String(p.clubId).startsWith('ucl-')) return null
      return p
    })
    .filter((p): p is Player => p != null)

  // คืนยืม: ย้ายกลับ fromClub · ซื้อ+ยืมกลับ = เข้าทีมเจ้าของใหม่ถาวร
  const loanJoinNotes: string[] = []
  for (const loan of save.loans ?? []) {
    if (loan.status !== 'active') continue
    const p = players.find((x) => x.id === loan.playerId)
    players = players.map((pl) =>
      pl.id === loan.playerId
        ? { ...pl, clubId: loan.fromClubId, loanParentClubId: null }
        : pl,
    )
    if (loan.kind === 'buy_loan_back' && p) {
      loanJoinNotes.push(
        `${p.name} เข้าทีมถาวรหลังยืมกลับจนจบฤดูกาล (ซื้อไว้ ${loan.purchaseFee ? formatMoney(loan.purchaseFee) : 'ก่อนหน้า'})`,
      )
    }
  }

  const rolled = rollPlayersForNewSeason(players, newSeason, domesticClubs, save)
  players = rolled.players
  const rolledFans = rolled.fans
  const freeExitNotes = rolled.notes.filter((n) => n.includes('ย้ายฟรี'))
  // merge clubFans จาก free exits เข้า domesticClubs
  const fanById = new Map(rolled.clubsWithFans.map((c) => [c.id, c.clubFans]))
  domesticClubs = domesticClubs.map((c) => ({
    ...c,
    clubFans: fanById.get(c.id) ?? c.clubFans,
  }))

  const euroAccess = snapshotEuroRanks(save)
  const pack = createEuropeCupsPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    euroAccess,
  )
  const asiaAccess = snapshotAsiaRanks(save)
  const asiaPack = createAsiaCupsPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    asiaAccess,
  )
  const cwcAccess = snapshotCwcSeeds(save)
  const domesticTitles = snapshotDomesticTitles(save)
  players = [...players, ...pack.players, ...asiaPack.players]

  let clubs = [
    ...domesticClubs.map((c) => ({
      ...c,
      seasonStartBalance: c.balance,
      ticketRevenueSeason: 0,
      shirtRevenueSeason: 0,
    })),
    ...pack.clubs,
    ...asiaPack.clubs,
  ]

  const cwcPack = createCwcPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    cwcAccess,
    clubs,
  )
  clubs = [...clubs, ...cwcPack.clubs]
  players = [...players, ...cwcPack.players]

  if (championId) {
    clubs = applyTitleClubReputation(clubs, 'league', championId, null)
    if (championId === save.humanClubId) {
      const leagueBonus = Math.max(400_000, Math.round(5_000_000 * domesticPrizeScale(leagueId)))
      clubs = clubs.map((c) =>
        c.id === save.humanClubId ? { ...c, balance: c.balance + leagueBonus } : c,
      )
    }
  }

  const tacticsByClub = { ...save.tacticsByClub }
  for (const id of Object.keys(tacticsByClub)) {
    if (id.startsWith('ucl-') || id.startsWith('uel-') || id.startsWith('uecl-') || id.startsWith('acl-') || id.startsWith('acl_two-') || id.startsWith('asean_cup-') || id.startsWith('cwc-'))
      delete tacticsByClub[id]
  }
  Object.assign(tacticsByClub, pack.tactics, asiaPack.tactics, cwcPack.tactics)

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
  const seasonCalendar = buildSeasonCalendar(newSeason, leagueId, startDate)
  const leagueFx = generateSeasonFixtures(
    d1Ids,
    startDate,
    1,
    seasonCalendar.dateByLeagueMd,
  )
  const leagueFx2 = isValidLeagueSize(d2Ids.length)
    ? generateSeasonFixtures(d2Ids, startDate, 2, seasonCalendar.dateByLeagueMd)
    : []
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
  const uclFx = generateUclFixtures(pack.uclField, startDate, leagueId)
  const uelGen = generateUelFixtures(pack.uelField, startDate, leagueId)
  const ueclGen = generateUeclFixtures(pack.ueclField, startDate, leagueId)
  const aclFx = generateAsiaKnockoutFixtures('acl', asiaPack.aclField, newSeason, startDate)
  const aclTwoFx = generateAsiaKnockoutFixtures('acl_two', asiaPack.aclTwoField, newSeason, startDate)
  const aseanFx = generateAsiaKnockoutFixtures('asean_cup', asiaPack.aseanField, newSeason, startDate)
  const cwcFx = generateCwcFixtures(cwcPack.field, newSeason, startDate)
  const superCupFx = generateSuperCupFixture(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    domesticTitles,
    newSeason,
    startDate,
  )
  const fixtures = assignRefereesToFixtures([
    ...(superCupFx ? [superCupFx] : []),
    ...leagueFx,
    ...leagueFx2,
    ...cupFx,
    ...lc.fixtures,
    ...tr.fixtures,
    ...uclFx,
    ...uelGen.fixtures,
    ...ueclGen.fixtures,
    ...aclFx,
    ...aclTwoFx,
    ...aseanFx,
    ...cwcFx,
  ])

  const board = ensureBoard(save)
  const owner = ensureOwner(save)
  const takeover = {
    ...ensureTakeover({ ...save, season: newSeason }),
    cadenceSeason: newSeason,
    approachedThisSeason: false,
  }

  const youthBase = save.youth ?? createYouthState()
  const fans = {
    ...rolledFans,
    protestActive: false,
    boycottUntilMatchday: -1,
  }
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
        freeExitNotes.length ? freeExitNotes.join(' · ') : null,
        loanJoinNotes.length ? loanJoinNotes.join(' · ') : null,
        'ออฟซีซัน: อายุ +1 · ตารางใหม่ · ถ้วยครบ',
      ]
        .filter(Boolean)
        .join(' · '),
      read: false,
    },
    ...(freeExitNotes.length
      ? [
          {
            id: uid('msg-free'),
            date: startDate,
            title: 'ย้ายฟรี — แฟนเกลียด',
            body: freeExitNotes.join(' · '),
            read: false,
          } satisfies InboxMessage,
        ]
      : []),
    ...(loanJoinNotes.length
      ? [
          {
            id: uid('msg-loanback'),
            date: startDate,
            title: 'เข้าทีมถาวรหลังยืมกลับ',
            body: loanJoinNotes.join(' · '),
            read: false,
          } satisfies InboxMessage,
        ]
      : []),
    ...save.inbox,
  ].slice(0, 45)

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
    uel: { ...createUelState(), playinByes: uelGen.byes },
    uecl: { ...createUeclState(), playinByes: ueclGen.byes },
    acl: createAclState(),
    aclTwo: createAclTwoState(),
    aseanCup: createAseanCupState(),
    cwc: createCwcState(),
    cwcAccess,
    superCup: createSuperCupState(leagueId),
    domesticTitles,
    preSeason: null as GameSave['preSeason'],
    euroAccess,
    asiaAccess,
    lastHumanResult: null,
    pressConference: null,
    playerInterview: null,
    internationalBreak: null,
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
    inbox: [
      {
        id: uid('msg-cal'),
        date: startDate,
        title: `ปฏิทินฤดูกาล ${newSeason}`,
        body: seasonCalendar.summerEvents.length
          ? `ฤดูร้อน: ${seasonCalendar.summerEvents.map((e) => e.labelTh).join(' · ')} · ลีกมีช่องพัก FIFA/วินเทอร์คั่น · สุ่มตารางใหม่แล้ว`
          : `อุ่นเครื่องทีมชาติ · ลีกมีช่องพักตามปฏิทิน · สุ่มตารางใหม่แล้ว`,
        read: false,
      },
      ...inbox,
    ].slice(0, 45),
    loans: [],
    transferDesk: {
      ...createTransferDesk(),
      clauses: (save.transferDesk?.clauses ?? []).filter((c) => c.status === 'active'),
      feeInstallments: (save.transferDesk?.feeInstallments ?? []).filter(
        (i) => i.status === 'pending' || i.status === 'overdue',
      ),
    },
    worldPulse: createWorldPulse(leagueId),
    seasonCalendar,
    clubQuests: humanAfter
      ? createClubQuests(
          humanAfter,
          newSeason,
          (humanAfter.division === 2 ? 'balanced' : board.preferredStyle) as typeof board.preferredStyle,
        )
      : [],
    lastMatchdayReport: null,
    matchdayChronicle: [],
    lastIntlTournamentReports: [],
    ntCamp: null,
    // คัดเลือกบอลโลกข้ามฤดูกาล — ไม่รีเซ็ต
    worldCup: save.worldCup ?? null,
    awards: resetAwardsForNewSeason(save),
    insolvency: rollInsolvencyForNewSeason(save),
  }

  const summer = runSummerIntlTournaments(next)
  let advanced = applyPreContractsOnSeasonStart(summer.save, newSeason)
  advanced = applyAnnualWageRises(advanced)
  const europeIds = sortedRows(save.table)
    .slice(0, 4)
    .map((r) => r.clubId)
  advanced = applyEuropeWageBumps(advanced, europeIds)
  const relegatedIds = sortedRows(save.table).slice(-promoRelegCount(leagueId)).map((r) => r.clubId)
  advanced = applyRelegationReleaseClauses(advanced, relegatedIds)
  advanced = processLoanObligationsOnSeasonEnd(advanced, relegatedIds)
  const withFees = tickFeeInstallments(advanced)
  const withPromo = tickPromotionClauses(ensureSquadLanguages(withFees), promotedIds)
  // ท้ายสุดทุกปี — เปิดปรีซีซั่นใหม่ + เลื่อนวันที่ไปต้นหน้าต่างทัวร์ (ไม่ทับ Shield/ลีก)
  const ready = openPreSeasonWindow(ensureFans(withPromo), startDate)

  return {
    ok: true,
    save: ready,
    message: `เริ่มฤดูกาล ${newSeason} · ปรีซีซั่นเปิดแล้ว · ปีที่แล้วอันดับ #${humanRank}${
      promo.notes.length ? ` · ${promo.notes.join(', ')}` : ''
    }`,
  }
}

export function seasonSummaryLine(save: GameSave): string {
  if (!save.seasonComplete) return `ฤดูกาล ${save.season} กำลังแข่ง`
  const rank = sortedTable(save).findIndex((r) => r.clubId === save.humanClubId) + 1
  return `จบฤดูกาล ${save.season} · อันดับ #${rank || '—'} · กดเริ่มฤดูกาลใหม่ได้`
}
