import type { GameSave, TeamInstructions, TrainingState } from './types'
import { SAVE_KEY, DEFAULT_INSTRUCTIONS, DEFAULT_SET_PIECES } from './types'
import { autoPickTactics, createTacticsForAll } from './seed'
import { createClubsFromLeague, createPlayersFromLeague } from './worldSeed'
import { getLeague, type LeagueId, isValidLeagueSize } from '@/data/world'
import { crestKeyForShortName } from '@/lib/crests'
import { bioForPlayerName } from '@/data/world/playerBios'
import { fmInsideForPlayerName } from '@/data/world/fmInsidePlayers'
import { playerAttrsFromFmInside } from '@/game/fmInside'
import { blankTable, generateSeasonFixtures } from './fixtures'
import { normalizeFormationId } from './types'
import { createFanState, ensureFans } from './fans'
import { createBoardState, ensureBoard } from './board'
import { createOwnerState, ensureOwner } from './owner'
import { defaultTraining } from './training'
import { ensurePlayerV3Fields } from './attributes'
import { withAgentIdentity } from './agents'
import { seedClubAffinity } from './playerAmbition'
import { ensureClubLoyalty } from './playerLoyalty'
import { ensurePlayerSkills } from './playerSkills'
import { createDynamics } from './dynamics'
import { createStaff, ensureStaffState } from './staff'
import { createYouthState } from './youth'
import { createScouting, ensureScouting } from './scouting'
import { createPressFeed, createMediaFeed, ensureMediaFeed, seedOpeningNews } from './media'
import { emptyAwardsState, monthKeyFromDate } from './awards'
import { createCupState, generateCupFixtures } from './cup'
import {
  generateLeagueCupFixtures,
  generateTrophyFixtures,
} from './extraCups'
import {
  createUclState,
  createUelState,
  createUeclState,
  generateUclFixtures,
  generateUelFixtures,
  generateUeclFixtures,
  createEuropeCupsPack,
} from './ucl'
import { createEuroAccess } from './europeAccess'
import {
  createAclState,
  createAclTwoState,
  createAseanCupState,
  createAsiaAccess,
  createAsiaCupsPack,
  generateAsiaKnockoutFixtures,
} from './asiaAccess'
import {
  createCwcAccess,
  createCwcState,
  createCwcPack,
  generateCwcFixtures,
  snapshotCwcSeeds,
  ensureCwcAccess,
} from './clubWorldCup'
import {
  createSuperCupState,
  createDomesticTitles,
  generateSuperCupFixture,
  ensureDomesticTitles,
} from './superCup'
import { ensurePreSeason, openPreSeasonWindow } from './preSeason'
import { DIV2_LEAGUE_NAME, EXTRA_CUP_NAMES } from '@/data/world'
import { assignRefereesToFixtures } from './referees'
import { createDevelopmentState } from './development'
import { createClubFinance, ensureClubFinance } from './playerEconomy'
import { createTalksState, ensureTalks } from './playerTalks'
import {
  buildManagerProfile,
  defaultManagerBuild,
  ensureManagerProfile,
  instructionsFromManager,
  startingReputationFromProfile,
  type ManagerBuildInput,
} from './managerProfile'
import { runSummerIntlTournaments } from './intlTournaments'
import { ensureSquadLanguages } from './languages'
import { seedCareerHonoursFromHistory } from './worldHistory'
import { ensurePlayerCareerSeeds } from './playerCareerSeed'
import {
  createManagerProgress,
  ensureClubQuests,
  ensureManagerProgress,
} from './managerProgress'
import { recomputeDynamics, ensureDynamics } from './dynamics'
import {
  buildSeasonCalendar,
  ensureSeasonCalendar,
} from './seasonCalendar'
import {
  ensureSquadRegistration,
} from './squadRegistration'
import { assignWorldCoaches, displaceClubCoachOnTakeover, ensureClubCoaches } from './worldCoaches'
import { createAssociationsState, ensureAssociations } from './associations'
import { createLoansState, ensureLoans } from './loans'
import { createShortlist, ensureShortlist } from './shortlist'
import { createTransferDesk, ensureTransferDesk } from './transferDesk'
import { seedLeagueRivalries } from './rivalries'
import { createClubIncome, ensureClubIncome } from './clubIncome'
import { createTakeoverState, ensureTakeover } from './takeover'
import { createInsolvencyState, ensureInsolvency } from './insolvency'
import { createPlayerMoveLog } from './playerWorldDb'
import { createCareerState, ensureCareer } from './jobs'
import { createFacilitiesState, ensureFacilities } from './facilities'
import { createAffiliates, ensureAffiliates } from './affiliates'
import { createContractTalks, ensureContractTalks } from './transfer'
import { createWorldPulse, ensureWorldPulse } from './worldPulse'
import { ensureWorldCup } from './worldCup'
import { ensureAllSocial } from './social'
import { persistSaveSync, loadSaveRawAsync, clearAllSaves } from './idbSave'
import { roleGroup } from './positions'
import type { RoleCode, TableRow } from './types'

function applySyntheticLeagueResult(
  table: TableRow[],
  homeId: string,
  awayId: string,
  hg: number,
  ag: number,
): TableRow[] {
  return table.map((row) => {
    if (row.clubId !== homeId && row.clubId !== awayId) return row
    const home = row.clubId === homeId
    const gf = home ? hg : ag
    const ga = home ? ag : hg
    const won = gf > ga ? 1 : 0
    const drawn = gf === ga ? 1 : 0
    const lost = gf < ga ? 1 : 0
    return {
      ...row,
      played: row.played + 1,
      won: row.won + won,
      drawn: row.drawn + drawn,
      lost: row.lost + lost,
      gf: row.gf + gf,
      ga: row.ga + ga,
      points: row.points + won * 3 + drawn,
    }
  })
}

export function createNewGame(
  managerName: string,
  humanClubId: string,
  leagueId: LeagueId = 'eng',
  build?: ManagerBuildInput,
): GameSave {
  const league = getLeague(leagueId)
  const associations = createAssociationsState()
  const managerProfile = buildManagerProfile(build ?? defaultManagerBuild())
  let domesticClubs = createClubsFromLeague(leagueId, humanClubId)
  domesticClubs = assignWorldCoaches(domesticClubs, 2026, associations)
  const domesticPlayers = createPlayersFromLeague(leagueId, domesticClubs)
  const euroAccess = createEuroAccess()
  const pack = createEuropeCupsPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    euroAccess,
  )
  const asiaAccess = createAsiaAccess()
  const asiaPack = createAsiaCupsPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    asiaAccess,
  )
  let clubs = [...domesticClubs, ...pack.clubs, ...asiaPack.clubs]
  clubs = assignWorldCoaches(clubs, 2026, associations)

  // คุณรับงานผู้จัดการ → โค้ชเดิมของคลับว่าง แล้วคลับ AI อื่นจ้างต่อ
  const takeover = displaceClubCoachOnTakeover(clubs, humanClubId, associations)
  clubs = takeover.clubs

  const cwcAccess = createCwcAccess()
  const cwcPack = createCwcPack(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    cwcAccess,
    clubs,
  )
  clubs = [...clubs, ...cwcPack.clubs]

  const players = [...domesticPlayers, ...pack.players, ...asiaPack.players, ...cwcPack.players]
  const tacticsByClub = {
    ...createTacticsForAll(clubs, players),
    ...pack.tactics,
    ...asiaPack.tactics,
    ...cwcPack.tactics,
  }
  // แผนเริ่มต้นตามสไตล์ผู้จัดการ
  const humanTactics = tacticsByClub[humanClubId]
  if (humanTactics) {
    tacticsByClub[humanClubId] = {
      ...autoPickTactics(
        humanClubId,
        players,
        managerProfile.preferredFormation,
        managerProfile.formationOop,
      ),
      instructions: instructionsFromManager(managerProfile),
      familiarity: Math.min(72, 48 + Math.round(managerProfile.power / 5)),
      setPieces: humanTactics.setPieces,
      opposition: humanTactics.opposition,
      // มนุษย์ต้องเลือกกัปตันเองที่หน้าทีมก่อนเตะ
      captainId: null,
      viceCaptainId: null,
    }
  }
  const clubIds = domesticClubs.filter((c) => c.division === 1).map((c) => c.id)
  const d2Ids = domesticClubs.filter((c) => c.division === 2).map((c) => c.id)
  const startDate = '2026-08-15'
  const seasonCalendar = buildSeasonCalendar(2026, leagueId, startDate)
  const leagueFx = generateSeasonFixtures(
    clubIds,
    startDate,
    1,
    seasonCalendar.dateByLeagueMd,
  )
  const leagueFx2 = generateSeasonFixtures(
    d2Ids,
    startDate,
    2,
    seasonCalendar.dateByLeagueMd,
  )
  const seasonStart = leagueFx[0]?.date ?? startDate
  const cupFx = generateCupFixtures(domesticClubs, seasonStart)
  const lc = generateLeagueCupFixtures(
    domesticClubs,
    seasonStart,
    EXTRA_CUP_NAMES[leagueId].leagueCup,
  )
  const tr = generateTrophyFixtures(
    domesticClubs,
    seasonStart,
    EXTRA_CUP_NAMES[leagueId].trophy,
  )
  const uclFx = generateUclFixtures(pack.uclField, seasonStart, leagueId)
  const uelGen = generateUelFixtures(pack.uelField, seasonStart, leagueId)
  const ueclGen = generateUeclFixtures(pack.ueclField, seasonStart, leagueId)
  const aclFx = generateAsiaKnockoutFixtures('acl', asiaPack.aclField, 2026)
  const aclTwoFx = generateAsiaKnockoutFixtures('acl_two', asiaPack.aclTwoField, 2026)
  const aseanFx = generateAsiaKnockoutFixtures('asean_cup', asiaPack.aseanField, 2026)
  const cwcFx = generateCwcFixtures(cwcPack.field, 2026)
  const superCupFx = generateSuperCupFixture(
    leagueId,
    domesticClubs.filter((c) => c.division === 1),
    createDomesticTitles(),
    2026,
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
  const human = clubs.find((c) => c.id === humanClubId)!
  const coachMoveNote = takeover.displaced
    ? takeover.hiredAt
      ? `${takeover.displaced.name} ว่างจากเก้าอี้หลังคุณรับงาน · ${takeover.hiredAt.name} จ้างต่อทันที${
          takeover.bumped ? ` (แทน ${takeover.bumped.name} ที่ไปตลาดว่าง)` : ''
        }`
      : `${takeover.displaced.name} ว่างงานหลังคุณรับงาน — รอคลับอื่นจ้าง`
    : null

  const baseSave: GameSave = {
    version: 6,
    createdAt: new Date().toISOString(),
    currency: 'EUR',
    managerName: managerName.trim() || 'Manager',
    managerReputation: startingReputationFromProfile(human.reputation, managerProfile),
    managerProfile,
    managerProgress: createManagerProgress(managerProfile),
    clubQuests: [],
    seasonCalendar,
    humanClubId,
    leagueId,
    leagueName: league.name,
    currentDate: seasonStart,
    season: 2026,
    matchday: 0,
    clubs,
    players,
    tacticsByClub,
    fixtures,
    table: blankTable(clubIds),
    tableDiv2: blankTable(d2Ids),
    inbox: [
      {
        id: 'welcome',
        date: seasonStart,
        title: `Welcome to ${human.name}`,
        body: `คุณรับงานผู้จัดการที่ ${human.name} ใน ${league.name} · สไตล์「${managerProfile.styleLabelTh}」· แผน ${managerProfile.preferredFormation} · มี${DIV2_LEAGUE_NAME[leagueId].nameTh} · ถ้วยชาติ + ${EXTRA_CUP_NAMES[leagueId].leagueCup} + ${EXTRA_CUP_NAMES[leagueId].trophy} · ยุโรป: 1–4 UCL / 5–6 Europa / 7–8 Conference${coachMoveNote ? ` · ${coachMoveNote}` : ''}`,
        read: false,
      },
      {
        id: 'calendar-summer',
        date: seasonStart,
        title: 'ปฏิทินนานาชาติ · ฤดูร้อน',
        body: seasonCalendar.summerEvents.length
          ? `ก่อนเปิดฤดูกาล: ${seasonCalendar.summerEvents.map((e) => `${e.labelTh} (${e.weeks} สัปดาห์)`).join(' · ')} · ลีกมีช่องพัก FIFA/วินเทอร์ คั่น ไม่แข่งติดกันทุกอาทิตย์`
          : 'ฤดูร้อน: อุ่นเครื่องทีมชาติ · ลีกมีช่องพักตามปฏิทิน',
        read: false,
      },
      ...(coachMoveNote
        ? [
            {
              id: 'coach-displace',
              date: seasonStart,
              title: 'โค้ชเดิมย้ายงาน',
              body: coachMoveNote,
              read: false,
            },
          ]
        : []),
    ],
    lastHumanResult: null,
    seasonComplete: false,
    fans: createFanState(human.reputation),
    training: defaultTraining(),
    board: createBoardState(human.reputation),
    owner: createOwnerState(human.reputation, humanClubId.length * 97 + 2026),
    dynamics: createDynamics(),
    staff: createStaff(clubs, humanClubId),
    dailyLogs: [],
    clubFinance: createClubFinance(),
    youth: createYouthState(),
    scouting: createScouting(players, humanClubId),
    press: createPressFeed(),
    media: createMediaFeed(),
    pressConference: null,
    playerInterview: null,
    internationalBreak: null,
    associations,
    cup: createCupState(league.cupName),
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
    domesticTitles: createDomesticTitles(),
    preSeason: null, // เติมหลังสร้างเซฟครบ
    euroAccess,
    asiaAccess,
    development: createDevelopmentState(),
    talks: createTalksState(),
    loans: createLoansState(),
    shortlist: createShortlist(),
    transferDesk: createTransferDesk(),
    rivalries: [],
    clubIncome: createClubIncome(human.reputation),
    takeover: createTakeoverState(2026),
    insolvency: createInsolvencyState(),
    playerMoveLog: createPlayerMoveLog(),
    career: createCareerState(humanClubId),
    facilities: createFacilitiesState(
      human.stadiumCapacity,
      human.reputation,
      human.division ?? 1,
      8,
    ),
    affiliates: createAffiliates(human.reputation, 2026 + humanClubId.length),
    contractTalks: createContractTalks(),
    worldPulse: createWorldPulse(leagueId),
    preMatch: null,
    lastMatchdayReport: null,
    matchdayChronicle: [],
    lastIntlTournamentReports: [],
    ntCamp: null,
    worldCup: null,
  }

  // ทัวร์นาเมนต์ฤดูร้อน (รวมฟุตบอลโลกถ้าเป็นปีชิง) → แล้วเปิดปรีซีซั่นบังคับเลือก (เริ่ม 20 ก.ค.)
  const withWc = ensureWorldCup(baseSave)
  const summer = runSummerIntlTournaments(withWc)
  const withPs = openPreSeasonWindow(summer.save, seasonStart)
  const withOpenNews = seedOpeningNews(withPs)
  const summerNote = summer.reports.length
    ? `จบฤดูร้อนแล้ว: ${summer.reports.map((r) => `${r.labelTh} (แชมป์ ${r.championTh})`).join(' · ')} · เลือกปรีซีซั่นก่อนเดินวัน`
    : 'จบฤดูร้อนทีมชาติแล้ว · เลือกปรีซีซั่นก่อนเดินวัน'
  return ensureClubQuests(
    seedCareerHonoursFromHistory(
      seedLeagueRivalries(
        ensureSquadLanguages({
          ...withOpenNews,
          inbox: [
            {
              id: `msg-post-summer-${Date.now()}`,
              date: withOpenNews.currentDate,
              title: 'หลังฤดูร้อน · เข้าปรีซีซั่น',
              body: summerNote,
              read: false,
            },
            ...withOpenNews.inbox.map((m) => ({
              ...m,
              date: withOpenNews.currentDate,
            })),
          ].slice(0, 45),
          preSeason: withOpenNews.preSeason
            ? {
                ...withOpenNews.preSeason,
                note: `${summerNote} · ${withOpenNews.preSeason.note}`,
              }
            : withOpenNews.preSeason,
        }),
      ),
    ),
  )
}

/**
 * เซฟเก่าค่าเหนื่อยจาก BIO เป็นบาท (×45) — แปลงเฉพาะค่าที่ดูเป็น THB
 * งบคลับ/โค้ชโลกส่วนใหญ่เป็นสเกล € อยู่แล้ว ไม่หารทับ
 */
function migrateCurrencyToEur(save: GameSave): GameSave {
  if (save.currency === 'EUR') return save
  const thbWeekly = save.players.filter((p) => p.wage > 220_000).length
  const ratio = thbWeekly / Math.max(1, save.players.length)
  if (ratio < 0.08) {
    return { ...save, currency: 'EUR' }
  }
  const toEur = (n: number) => Math.round(n / 40)
  return {
    ...save,
    currency: 'EUR',
    players: save.players.map((p) => {
      if (p.wage <= 220_000) {
        return {
          ...p,
          cash: p.cash != null && p.cash > 2_000_000 ? toEur(p.cash) : p.cash,
        }
      }
      return {
        ...p,
        wage: toEur(p.wage),
        cash: toEur(p.cash ?? 0),
        releaseClause:
          p.releaseClause != null && p.releaseClause > 8_000_000
            ? toEur(p.releaseClause)
            : p.releaseClause,
      }
    }),
  }
}

export function ensurePhase5(save: GameSave): GameSave {
  let next = migrateCurrencyToEur(ensureFans(save))
  const human = next.clubs.find((c) => c.id === next.humanClubId)!
  if (!next.training) next = { ...next, training: defaultTraining() }
  else if (!next.training.individual) {
    next = { ...next, training: { ...next.training, individual: {} } }
  }
  if (!next.board || !next.board.kpis) next = { ...next, board: createBoardState(human.reputation) }
  else next = { ...next, board: ensureBoard(next) }
  if (!next.owner) next = { ...next, owner: ensureOwner(next) }
  if (!next.dynamics) next = { ...next, dynamics: createDynamics() }
  else next = { ...next, dynamics: ensureDynamics(next.dynamics) }
  if ((next.dynamics.hierarchy?.length ?? 0) === 0) {
    next = { ...next, dynamics: recomputeDynamics(next) }
  }
  if (!next.staff) next = { ...next, staff: createStaff(next.clubs, next.humanClubId) }
  else next = { ...next, staff: ensureStaffState(next.staff, next.clubs, next.humanClubId) }
  if (!next.dailyLogs) next = { ...next, dailyLogs: [] }
  if (!next.clubFinance) next = { ...next, clubFinance: ensureClubFinance(next) }
  if (!next.youth) next = { ...next, youth: createYouthState() }
  if (!next.press) next = { ...next, press: [] }
  if (!next.media) next = { ...next, media: ensureMediaFeed(next) }
  if (next.pressConference === undefined) next = { ...next, pressConference: null }
  if (next.playerInterview === undefined) next = { ...next, playerInterview: null }
  if (next.internationalBreak === undefined) next = { ...next, internationalBreak: null }
  next = ensureAssociations(next)
  if (typeof next.managerReputation !== 'number') {
    next = {
      ...next,
      managerReputation: Math.min(72, 48 + Math.round(human.reputation / 5)),
    }
  }
  if (!next.managerProfile) {
    next = { ...next, managerProfile: ensureManagerProfile(null) }
  } else {
    next = { ...next, managerProfile: ensureManagerProfile(next.managerProfile) }
  }
  if (!next.managerProgress) {
    next = { ...next, managerProgress: ensureManagerProgress(next) }
  } else {
    next = { ...next, managerProgress: ensureManagerProgress(next) }
  }
  next = ensureClubQuests(next)
  next = ensureSeasonCalendar(next)
  next = ensureSquadRegistration(next)
  next = ensureSquadLanguages(next)
  next = seedCareerHonoursFromHistory(next)
  next = ensurePlayerCareerSeeds(next)
  if (next.lastMatchdayReport === undefined) next = { ...next, lastMatchdayReport: null }
  if (!next.matchdayChronicle) next = { ...next, matchdayChronicle: [] }
  if (next.lastIntlTournamentReports === undefined) {
    next = { ...next, lastIntlTournamentReports: [] }
  }
  if (next.ntCamp === undefined) next = { ...next, ntCamp: null }
  next = ensureWorldCup(next)
  if (!next.cup) next = { ...next, cup: createCupState() }
  if (!next.ucl) next = { ...next, ucl: createUclState() }
  if (!next.uel) next = { ...next, uel: createUelState() }
  if (!next.uecl) next = { ...next, uecl: createUeclState() }
  if (!next.acl) next = { ...next, acl: createAclState() }
  if (!next.aclTwo) next = { ...next, aclTwo: createAclTwoState() }
  if (!next.aseanCup) next = { ...next, aseanCup: createAseanCupState() }
  if (!next.cwc) next = { ...next, cwc: createCwcState() }
  if (!next.cwcAccess) next = { ...next, cwcAccess: ensureCwcAccess(next) }
  if (!next.superCup) {
    next = { ...next, superCup: createSuperCupState(next.leagueId || 'eng') }
  }
  if (!next.domesticTitles) next = { ...next, domesticTitles: ensureDomesticTitles(next) }
  next = ensurePreSeason(next)
  if (!next.euroAccess) next = { ...next, euroAccess: createEuroAccess() }
  if (!next.asiaAccess) next = { ...next, asiaAccess: createAsiaAccess() }
  if (!next.development) next = { ...next, development: createDevelopmentState() }
  if (!next.talks) next = { ...next, talks: ensureTalks(next) }
  if (!next.loans) next = { ...next, loans: ensureLoans(next) }
  if (!next.shortlist) next = { ...next, shortlist: ensureShortlist(next) }
  if (!next.transferDesk) next = { ...next, transferDesk: ensureTransferDesk(next) }
  if (next.transferDeadline === undefined) next = { ...next, transferDeadline: null }
  if (!next.rivalries) next = seedLeagueRivalries({ ...next, rivalries: [] })
  else if (next.rivalries.length === 0) next = seedLeagueRivalries(next)
  if (!next.clubIncome) next = { ...next, clubIncome: ensureClubIncome(next) }
  if (!next.takeover) next = { ...next, takeover: ensureTakeover(next) }
  else next = { ...next, takeover: ensureTakeover(next) }
  if (!next.insolvency) next = { ...next, insolvency: createInsolvencyState() }
  else next = { ...next, insolvency: ensureInsolvency(next) }
  if (!next.playerMoveLog) next = { ...next, playerMoveLog: createPlayerMoveLog() }
  if (!next.career) next = { ...next, career: ensureCareer(next) }
  else next = { ...next, career: ensureCareer(next) }
  if (!next.facilities) {
    const h = next.clubs.find((c) => c.id === next.humanClubId)
    next = {
      ...next,
      facilities: createFacilitiesState(
        h?.stadiumCapacity ?? 25_000,
        h?.reputation ?? 50,
        h?.division ?? 1,
        next.youth?.academyLevel ?? 8,
      ),
    }
  } else next = { ...next, facilities: ensureFacilities(next) }
  if (!next.affiliates) {
    next = {
      ...next,
      affiliates: createAffiliates(human.reputation, next.season * 97 + human.id.length),
    }
  } else next = { ...next, affiliates: ensureAffiliates(next) }
  if (!next.contractTalks) next = { ...next, contractTalks: ensureContractTalks(next) }
  if (!next.worldPulse) next = { ...next, worldPulse: createWorldPulse(next.leagueId || 'eng') }
  else next = { ...next, worldPulse: ensureWorldPulse(next) }
  if (next.preMatch === undefined) next = { ...next, preMatch: null }
  if (!next.awards) {
    next = { ...next, awards: emptyAwardsState(monthKeyFromDate(next.currentDate)) }
  }

  next = {
    ...next,
    clubs: next.clubs.map((c) => {
      const division = (c.division ?? (c.id.startsWith('d2-') ? 2 : 1)) as 1 | 2
      const crestKey =
        c.crestKey !== undefined
          ? c.crestKey
          : crestKeyForShortName(c.shortName) ?? null
      return { ...c, division, crestKey }
    }),
  }
  if (!next.tableDiv2) next = { ...next, tableDiv2: [] }
  if (!next.leagueCup) {
    const lid = (next.leagueId || 'eng') as LeagueId
    next = {
      ...next,
      leagueCup: createCupState(EXTRA_CUP_NAMES[lid]?.leagueCup ?? 'League Cup'),
    }
  }
  if (!next.trophy) {
    const lid = (next.leagueId || 'eng') as LeagueId
    next = {
      ...next,
      trophy: createCupState(EXTRA_CUP_NAMES[lid]?.trophy ?? 'Trophy'),
    }
  }
  if (!next.clubs.some((c) => c.division === 2)) {
    const lid = (next.leagueId || 'eng') as LeagueId
    const seeded = createClubsFromLeague(lid, next.humanClubId)
    const d2 = seeded.filter((c) => c.division === 2)
    const d2Players = createPlayersFromLeague(lid, d2)
    const d2Tactics = createTacticsForAll(d2, d2Players)
    next = {
      ...next,
      clubs: [...next.clubs, ...d2],
      players: [...next.players, ...d2Players],
      tacticsByClub: { ...next.tacticsByClub, ...d2Tactics },
      tableDiv2: blankTable(d2.map((c) => c.id)),
    }
  }

  // เซฟเก่า: มีคลับลีกล่างแล้วแต่ยังไม่มีปฏิทิน / ถ้วยเพิ่ม
  {
    const lid = (next.leagueId || 'eng') as LeagueId
    const domestic = next.clubs.filter((c) => !c.id.startsWith('ucl-'))
    const d2Ids = domestic.filter((c) => c.division === 2).map((c) => c.id)
    const seasonStart =
      next.fixtures.find((f) => f.competition === 'league')?.date ??
      `${next.season ?? 2026}-08-15`
    let fixtures = next.fixtures.slice()
    let tableDiv2 = next.tableDiv2?.length
      ? next.tableDiv2.slice()
      : blankTable(d2Ids)
    let leagueCup = next.leagueCup
    let trophy = next.trophy
    let injected = false

    if (isValidLeagueSize(d2Ids.length) && !fixtures.some((f) => f.competition === 'league' && (f.division === 2 || String(f.id).startsWith('fx2')))) {
      const fx2 = generateSeasonFixtures(d2Ids, seasonStart, 2)
      const md = next.matchday ?? 0
      let seed = (next.season ?? 2026) * 97 + md * 13
      const rand = () => {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff
        return seed / 0x7fffffff
      }
      tableDiv2 = blankTable(d2Ids)
      const filled = fx2.map((f) => {
        if (f.matchday > md) return f
        const hg = Math.floor(rand() * 4)
        const ag = Math.floor(rand() * 4)
        tableDiv2 = applySyntheticLeagueResult(tableDiv2, f.homeClubId, f.awayClubId, hg, ag)
        return { ...f, played: true, homeGoals: hg, awayGoals: ag }
      })
      fixtures = [...fixtures, ...filled]
      injected = true
    }

    if (
      !fixtures.some((f) => f.competition === 'league_cup') &&
      (next.matchday ?? 0) < 3
    ) {
      const lc = generateLeagueCupFixtures(
        domestic,
        seasonStart,
        EXTRA_CUP_NAMES[lid]?.leagueCup ?? 'League Cup',
      )
      fixtures = [...fixtures, ...lc.fixtures]
      leagueCup = lc.state
      injected = true
    }
    if (
      !fixtures.some((f) => f.competition === 'trophy') &&
      (next.matchday ?? 0) < 5
    ) {
      const tr = generateTrophyFixtures(
        domestic,
        seasonStart,
        EXTRA_CUP_NAMES[lid]?.trophy ?? 'Trophy',
      )
      fixtures = [...fixtures, ...tr.fixtures]
      trophy = tr.state
      injected = true
    }

    if (injected) {
      next = {
        ...next,
        fixtures: assignRefereesToFixtures(fixtures),
        tableDiv2,
        leagueCup,
        trophy,
      }
    }
  }

  if (!next.leagueId) next = { ...next, leagueId: 'eng', leagueName: next.leagueName ?? 'Premier League' }
  if (!next.leagueName) next = { ...next, leagueName: 'World League' }

  const players = next.players.map((p) => {
    const base = ensurePlayerV3Fields(p)
    const bio = base.bio ?? bioForPlayerName(base.name)
    const fmInside = base.fmInside ?? fmInsideForPlayerName(base.name)
    let nextP = base
    if (!base.bio && bio) nextP = { ...nextP, bio }
    if (fmInside) {
      nextP = {
        ...nextP,
        fmInside,
        attrs: playerAttrsFromFmInside(fmInside),
      }
    }
    // เติม/ฝังพลังแฝงตามความสามารถ + แอตทริบิวต์ล่าสุด
    nextP = { ...nextP, skills: ensurePlayerSkills(nextP) }
    if (!nextP.clubAffinity?.dreamClubIds?.length) {
      nextP = { ...nextP, clubAffinity: seedClubAffinity(nextP, next.clubs) }
    }
    if (!nextP.agentName || !nextP.agentKind) {
      nextP = withAgentIdentity(nextP)
    }
    nextP = ensureClubLoyalty(nextP)
    return nextP
  })
  if (!next.scouting?.byPlayer) {
    next = { ...next, scouting: createScouting(players, next.humanClubId) }
  } else {
    next = { ...next, scouting: ensureScouting(next) }
  }

  next = ensureAssociations(next)
  const clubs = ensureClubCoaches(
    next.clubs.map((c) => ({
      ...c,
      seasonStartBalance: c.seasonStartBalance ?? c.balance,
    })),
    next.associations,
  )

  const tacticsByClub = { ...next.tacticsByClub }
  for (const club of clubs) {
    const t = tacticsByClub[club.id]
    if (!t) continue
    tacticsByClub[club.id] = {
      ...t,
      formation: normalizeFormationId(t.formation),
      formationOop: normalizeFormationId(t.formationOop ?? t.formation),
      instructions: t.instructions ?? { ...DEFAULT_INSTRUCTIONS },
      familiarity: typeof t.familiarity === 'number' ? t.familiarity : 55,
      setPieces: t.setPieces ?? { ...DEFAULT_SET_PIECES },
    }
  }

  const fixtures = assignRefereesToFixtures(
    next.fixtures.map((f) => ({
      ...f,
      competition: f.competition ?? ('league' as const),
    })),
  )

  return ensureAllSocial({
    ...next,
    version: 6,
    players,
    clubs,
    tacticsByClub,
    fixtures,
  })
}

/** @deprecated */
export const ensurePhase4 = ensurePhase5
export const ensurePhase3 = ensurePhase5

function migrateLegacy(raw: Record<string, unknown>): GameSave | null {
  const humanClubId = raw.humanClubId as string
  const clubsRaw = raw.clubs as GameSave['clubs']
  if (!humanClubId || !clubsRaw) return null
  const human = clubsRaw.find((c) => c.id === humanClubId)
  if (!human) return null

  const clubs = clubsRaw.map((c) => ({
    ...c,
    seasonStartBalance: (c as GameSave['clubs'][number]).seasonStartBalance ?? c.balance,
  }))

  const players = ((raw.players as GameSave['players']) ?? []).map((p) => {
    const anyP = p as GameSave['players'][number] & { role?: RoleCode }
    const role: RoleCode =
      anyP.role ??
      (anyP.position === 'GK'
        ? 'GK'
        : anyP.position === 'DF'
          ? 'CB'
          : anyP.position === 'FW'
            ? 'ST'
            : 'CM')
    return ensurePlayerV3Fields({
      ...anyP,
      role,
      position: roleGroup(role),
    })
  })

  const tacticsByClub: GameSave['tacticsByClub'] = {}
  const rawTactics =
    (raw.tacticsByClub as Record<string, Partial<GameSave['tacticsByClub'][string]>>) ?? {}
  for (const club of clubs) {
    const t = rawTactics[club.id]
    tacticsByClub[club.id] = {
      formation: normalizeFormationId(t?.formation as string),
      formationOop: normalizeFormationId((t?.formationOop ?? t?.formation) as string),
      instructions: {
        ...DEFAULT_INSTRUCTIONS,
        ...(t?.instructions as TeamInstructions | undefined),
      },
      familiarity: typeof t?.familiarity === 'number' ? t.familiarity : 55,
      startingXi: t?.startingXi ?? [],
      bench: t?.bench ?? [],
      captainId: (t?.captainId as string | null | undefined) ?? null,
      viceCaptainId: (t?.viceCaptainId as string | null | undefined) ?? null,
      setPieces: t?.setPieces ?? { ...DEFAULT_SET_PIECES },
    }
  }

  const fixtures = ((raw.fixtures as GameSave['fixtures']) ?? []).map((f) => ({
    ...f,
    competition: f.competition ?? ('league' as const),
  }))

  const trainingRaw = raw.training as TrainingState | undefined
  const base = {
    ...raw,
    version: 6 as const,
    leagueId: (raw.leagueId as string) ?? 'eng',
    leagueName: (raw.leagueName as string) ?? 'Premier League',
    clubs,
    players,
    tacticsByClub,
    fixtures,
    fans: (raw.fans as GameSave['fans']) ?? createFanState(human.reputation),
    training: trainingRaw
      ? { ...defaultTraining(), ...trainingRaw, individual: trainingRaw.individual ?? {} }
      : defaultTraining(),
    board: (raw.board as GameSave['board']) ?? createBoardState(human.reputation),
    owner:
      (raw.owner as GameSave['owner']) ??
      createOwnerState(human.reputation, humanClubId.length * 97),
    dynamics: (raw.dynamics as GameSave['dynamics']) ?? createDynamics(),
    staff: ensureStaffState(
      (raw.staff as GameSave['staff']) ?? createStaff(clubs, humanClubId),
      clubs,
      humanClubId,
    ),
    dailyLogs: (raw.dailyLogs as GameSave['dailyLogs']) ?? [],
    clubFinance: (raw.clubFinance as GameSave['clubFinance']) ?? createClubFinance(),
    youth: (raw.youth as GameSave['youth']) ?? createYouthState(),
    scouting: (raw.scouting as GameSave['scouting']) ?? createScouting(players, humanClubId),
    press: (raw.press as GameSave['press']) ?? [],
    media:
      (raw.media as GameSave['media']) ??
      ensureMediaFeed({
        press: (raw.press as GameSave['press']) ?? [],
      } as GameSave),
    pressConference: (raw.pressConference as GameSave['pressConference']) ?? null,
    playerInterview: (raw.playerInterview as GameSave['playerInterview']) ?? null,
    internationalBreak: (raw.internationalBreak as GameSave['internationalBreak']) ?? null,
    managerReputation:
      typeof raw.managerReputation === 'number'
        ? (raw.managerReputation as number)
        : Math.min(72, 48 + Math.round(human.reputation / 5)),
    cup: (raw.cup as GameSave['cup']) ?? createCupState(),
    tableDiv2: (raw.tableDiv2 as GameSave['tableDiv2']) ?? [],
    leagueCup: (raw.leagueCup as GameSave['leagueCup']) ?? createCupState('League Cup'),
    trophy: (raw.trophy as GameSave['trophy']) ?? createCupState('Trophy'),
    ucl: (raw.ucl as GameSave['ucl']) ?? createUclState(),
    uel: (raw.uel as GameSave['uel']) ?? createUelState(),
    uecl: (raw.uecl as GameSave['uecl']) ?? createUeclState(),
    acl: (raw.acl as GameSave['acl']) ?? createAclState(),
    aclTwo: (raw.aclTwo as GameSave['aclTwo']) ?? createAclTwoState(),
    aseanCup: (raw.aseanCup as GameSave['aseanCup']) ?? createAseanCupState(),
    cwc: (raw.cwc as GameSave['cwc']) ?? createCwcState(),
    cwcAccess: (raw.cwcAccess as GameSave['cwcAccess']) ?? createCwcAccess(),
    superCup:
      (raw.superCup as GameSave['superCup']) ??
      createSuperCupState((raw.leagueId as string) ?? 'eng'),
    domesticTitles:
      (raw.domesticTitles as GameSave['domesticTitles']) ?? createDomesticTitles(),
    preSeason: (raw.preSeason as GameSave['preSeason']) ?? null,
    euroAccess: (raw.euroAccess as GameSave['euroAccess']) ?? createEuroAccess(),
    asiaAccess: (raw.asiaAccess as GameSave['asiaAccess']) ?? createAsiaAccess(),
    development: (raw.development as GameSave['development']) ?? createDevelopmentState(),
    talks: (raw.talks as GameSave['talks']) ?? createTalksState(),
    loans: (raw.loans as GameSave['loans']) ?? createLoansState(),
    shortlist: (raw.shortlist as GameSave['shortlist']) ?? createShortlist(),
    transferDesk: (raw.transferDesk as GameSave['transferDesk']) ?? createTransferDesk(),
    rivalries: (raw.rivalries as GameSave['rivalries']) ?? [],
    clubIncome:
      (raw.clubIncome as GameSave['clubIncome']) ??
      createClubIncome(human.reputation),
    takeover: (raw.takeover as GameSave['takeover']) ?? createTakeoverState(
      typeof raw.season === 'number' ? (raw.season as number) : 2026,
    ),
    insolvency:
      (raw.insolvency as GameSave['insolvency']) ?? createInsolvencyState(),
    playerMoveLog:
      (raw.playerMoveLog as GameSave['playerMoveLog']) ?? createPlayerMoveLog(),
    career:
      (raw.career as GameSave['career']) ??
      createCareerState((raw.humanClubId as string) ?? humanClubId),
    facilities:
      (raw.facilities as GameSave['facilities']) ??
      createFacilitiesState(
        human.stadiumCapacity,
        human.reputation,
        (human as { division?: 1 | 2 }).division ?? 1,
        ((raw.youth as GameSave['youth'])?.academyLevel) ?? 8,
      ),
    affiliates:
      (raw.affiliates as GameSave['affiliates']) ??
      createAffiliates(human.reputation, ((raw.season as number) ?? 2026) * 97),
    contractTalks:
      (raw.contractTalks as GameSave['contractTalks']) ?? createContractTalks(),
    worldPulse:
      (raw.worldPulse as GameSave['worldPulse']) ??
      createWorldPulse((raw.leagueId as string) ?? 'eng'),
    preMatch: (raw.preMatch as GameSave['preMatch']) ?? null,
    lastMatchdayReport: (raw.lastMatchdayReport as GameSave['lastMatchdayReport']) ?? null,
    matchdayChronicle:
      (raw.matchdayChronicle as GameSave['matchdayChronicle']) ?? [],
    lastIntlTournamentReports:
      (raw.lastIntlTournamentReports as GameSave['lastIntlTournamentReports']) ?? [],
    ntCamp: (raw.ntCamp as GameSave['ntCamp']) ?? null,
    worldCup: (raw.worldCup as GameSave['worldCup']) ?? null,
  } as GameSave

  return ensurePhase5(ensureFans(base))
}

export function saveToStorage(save: GameSave) {
  persistSaveSync(save)
}

export function loadFromStorage(): GameSave | null {
  const tryParse = (raw: string) => {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    if (parsed.version === 6 || parsed.version === 5 || parsed.version === 4 || parsed.version === 3) {
      return ensurePhase5(parsed as unknown as GameSave)
    }
    if (parsed.version === 2 || parsed.version === 1) {
      const migrated = migrateLegacy(parsed)
      if (migrated) {
        saveToStorage(migrated)
        return migrated
      }
    }
    return null
  }

  try {
    const raw = localStorage.getItem(SAVE_KEY)
    if (raw) {
      const peek = JSON.parse(raw) as Record<string, unknown>
      if (peek.__idbOnly) return null
      return tryParse(raw)
    }
    for (const key of [
      'fc-manager-save-v5',
      'fc-manager-save-v4',
      'fc-manager-save-v3',
      'fc-manager-save-v2',
      'fc-manager-save-v1',
    ]) {
      const legacy = localStorage.getItem(key)
      if (!legacy) continue
      const migrated = tryParse(legacy)
      if (migrated) {
        saveToStorage(migrated)
        return migrated
      }
    }
    return null
  } catch {
    return null
  }
}

export async function loadFromStorageAsync(): Promise<GameSave | null> {
  try {
    const raw = await loadSaveRawAsync()
    if (raw) {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      if (
        parsed.version === 6 ||
        parsed.version === 5 ||
        parsed.version === 4 ||
        parsed.version === 3
      ) {
        return ensurePhase5(parsed as unknown as GameSave)
      }
    }
  } catch {
    /* */
  }
  return loadFromStorage()
}

export function clearStorage() {
  clearAllSaves()
}
