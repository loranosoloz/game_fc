import type { GameSave, TeamInstructions, TrainingState } from './types'
import { SAVE_KEY, DEFAULT_INSTRUCTIONS, DEFAULT_SET_PIECES } from './types'
import { createTacticsForAll } from './seed'
import { createClubsFromLeague, createPlayersFromLeague } from './worldSeed'
import { getLeague, type LeagueId } from '@/data/world'
import { crestKeyForShortName } from '@/lib/crests'
import { blankTable, generateSeasonFixtures } from './fixtures'
import { createFanState, ensureFans } from './fans'
import { createBoardState, ensureBoard } from './board'
import { createOwnerState, ensureOwner } from './owner'
import { defaultTraining } from './training'
import { ensurePlayerV3Fields } from './attributes'
import { createDynamics } from './dynamics'
import { createStaff, ensureStaffState } from './staff'
import { createYouthState } from './youth'
import { createScouting, ensureScouting } from './scouting'
import { createPressFeed, createMediaFeed, ensureMediaFeed } from './media'
import { createCupState, generateCupFixtures } from './cup'
import {
  generateLeagueCupFixtures,
  generateTrophyFixtures,
} from './extraCups'
import {
  createUclState,
  createUclInviteClubs,
  generateUclFixtures,
} from './ucl'
import { DIV2_LEAGUE_NAME, EXTRA_CUP_NAMES } from '@/data/world'
import { assignRefereesToFixtures } from './referees'
import { createDevelopmentState } from './development'
import { createClubFinance, ensureClubFinance } from './playerEconomy'
import { createTalksState, ensureTalks } from './playerTalks'
import { createLoansState, ensureLoans } from './loans'
import { createShortlist, ensureShortlist } from './shortlist'
import { createTransferDesk, ensureTransferDesk } from './transferDesk'
import { createClubIncome, ensureClubIncome } from './clubIncome'
import { createTakeoverState, ensureTakeover } from './takeover'
import { createCareerState, ensureCareer } from './jobs'
import { createFacilitiesState, ensureFacilities } from './facilities'
import { createAffiliates, ensureAffiliates } from './affiliates'
import { createContractTalks, ensureContractTalks } from './transfer'
import { createWorldPulse, ensureWorldPulse } from './worldPulse'
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
): GameSave {
  const league = getLeague(leagueId)
  const domesticClubs = createClubsFromLeague(leagueId, humanClubId)
  const domesticPlayers = createPlayersFromLeague(leagueId, domesticClubs)
  const invite = createUclInviteClubs(leagueId)
  const clubs = [...domesticClubs, ...invite.clubs]
  const players = [...domesticPlayers, ...invite.players]
  const tacticsByClub = {
    ...createTacticsForAll(domesticClubs, domesticPlayers),
    ...invite.tactics,
  }
  const clubIds = domesticClubs.filter((c) => c.division === 1).map((c) => c.id)
  const d2Ids = domesticClubs.filter((c) => c.division === 2).map((c) => c.id)
  const startDate = '2026-08-15'
  const leagueFx = generateSeasonFixtures(clubIds, startDate, 1)
  const leagueFx2 = generateSeasonFixtures(d2Ids, startDate, 2)
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
  const uclFx = generateUclFixtures(
    domesticClubs.filter((c) => c.division === 1),
    invite.clubs,
    humanClubId,
    seasonStart,
  )
  const fixtures = assignRefereesToFixtures([
    ...leagueFx,
    ...leagueFx2,
    ...cupFx,
    ...lc.fixtures,
    ...tr.fixtures,
    ...uclFx,
  ])
  const human = domesticClubs.find((c) => c.id === humanClubId)!

  return {
    version: 6,
    createdAt: new Date().toISOString(),
    managerName: managerName.trim() || 'Manager',
    managerReputation: Math.min(72, 48 + Math.round(human.reputation / 5)),
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
        body: `คุณคุม ${human.name} ใน ${league.name} · มี${DIV2_LEAGUE_NAME[leagueId].nameTh} · ถ้วยชาติ + ${EXTRA_CUP_NAMES[leagueId].leagueCup} + ${EXTRA_CUP_NAMES[leagueId].trophy} · ตกชั้น/เลื่อนชั้นท้ายฤดูกาล`,
        read: false,
      },
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
    cup: createCupState(league.cupName),
    leagueCup: lc.state,
    trophy: tr.state,
    ucl: createUclState(),
    development: createDevelopmentState(),
    talks: createTalksState(),
    loans: createLoansState(),
    shortlist: createShortlist(),
    transferDesk: createTransferDesk(),
    clubIncome: createClubIncome(human.reputation),
    takeover: createTakeoverState(2026),
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
  }
}

export function ensurePhase5(save: GameSave): GameSave {
  let next = ensureFans(save)
  const human = next.clubs.find((c) => c.id === next.humanClubId)!
  if (!next.training) next = { ...next, training: defaultTraining() }
  else if (!next.training.individual) {
    next = { ...next, training: { ...next.training, individual: {} } }
  }
  if (!next.board || !next.board.kpis) next = { ...next, board: createBoardState(human.reputation) }
  else next = { ...next, board: ensureBoard(next) }
  if (!next.owner) next = { ...next, owner: ensureOwner(next) }
  if (!next.dynamics) next = { ...next, dynamics: createDynamics() }
  if (!next.staff) next = { ...next, staff: createStaff(next.clubs, next.humanClubId) }
  else next = { ...next, staff: ensureStaffState(next.staff, next.clubs, next.humanClubId) }
  if (!next.dailyLogs) next = { ...next, dailyLogs: [] }
  if (!next.clubFinance) next = { ...next, clubFinance: ensureClubFinance(next) }
  if (!next.youth) next = { ...next, youth: createYouthState() }
  if (!next.press) next = { ...next, press: [] }
  if (!next.media) next = { ...next, media: ensureMediaFeed(next) }
  if (next.pressConference === undefined) next = { ...next, pressConference: null }
  if (typeof next.managerReputation !== 'number') {
    next = {
      ...next,
      managerReputation: Math.min(72, 48 + Math.round(human.reputation / 5)),
    }
  }
  if (!next.cup) next = { ...next, cup: createCupState() }
  if (!next.ucl) next = { ...next, ucl: createUclState() }
  if (!next.development) next = { ...next, development: createDevelopmentState() }
  if (!next.talks) next = { ...next, talks: ensureTalks(next) }
  if (!next.loans) next = { ...next, loans: ensureLoans(next) }
  if (!next.shortlist) next = { ...next, shortlist: ensureShortlist(next) }
  if (!next.transferDesk) next = { ...next, transferDesk: ensureTransferDesk(next) }
  if (!next.clubIncome) next = { ...next, clubIncome: ensureClubIncome(next) }
  if (!next.takeover) next = { ...next, takeover: ensureTakeover(next) }
  else next = { ...next, takeover: ensureTakeover(next) }
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

    if (d2Ids.length === 20 && !fixtures.some((f) => f.competition === 'league' && (f.division === 2 || String(f.id).startsWith('fx2')))) {
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

  const players = next.players.map((p) => ensurePlayerV3Fields(p))
  if (!next.scouting?.byPlayer) {
    next = { ...next, scouting: createScouting(players, next.humanClubId) }
  } else {
    next = { ...next, scouting: ensureScouting(next) }
  }

  const clubs = next.clubs.map((c) => ({
    ...c,
    seasonStartBalance: c.seasonStartBalance ?? c.balance,
  }))

  const tacticsByClub = { ...next.tacticsByClub }
  for (const club of clubs) {
    const t = tacticsByClub[club.id]
    if (!t) continue
    tacticsByClub[club.id] = {
      ...t,
      formationOop: t.formationOop ?? t.formation,
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
      formation: t?.formation ?? '4-3-3',
      formationOop: t?.formationOop ?? t?.formation ?? '4-3-3',
      instructions: {
        ...DEFAULT_INSTRUCTIONS,
        ...(t?.instructions as TeamInstructions | undefined),
      },
      familiarity: typeof t?.familiarity === 'number' ? t.familiarity : 55,
      startingXi: t?.startingXi ?? [],
      bench: t?.bench ?? [],
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
    managerReputation:
      typeof raw.managerReputation === 'number'
        ? (raw.managerReputation as number)
        : Math.min(72, 48 + Math.round(human.reputation / 5)),
    cup: (raw.cup as GameSave['cup']) ?? createCupState(),
    tableDiv2: (raw.tableDiv2 as GameSave['tableDiv2']) ?? [],
    leagueCup: (raw.leagueCup as GameSave['leagueCup']) ?? createCupState('League Cup'),
    trophy: (raw.trophy as GameSave['trophy']) ?? createCupState('Trophy'),
    ucl: (raw.ucl as GameSave['ucl']) ?? createUclState(),
    development: (raw.development as GameSave['development']) ?? createDevelopmentState(),
    talks: (raw.talks as GameSave['talks']) ?? createTalksState(),
    loans: (raw.loans as GameSave['loans']) ?? createLoansState(),
    shortlist: (raw.shortlist as GameSave['shortlist']) ?? createShortlist(),
    transferDesk: (raw.transferDesk as GameSave['transferDesk']) ?? createTransferDesk(),
    clubIncome:
      (raw.clubIncome as GameSave['clubIncome']) ??
      createClubIncome(human.reputation),
    takeover: (raw.takeover as GameSave['takeover']) ?? createTakeoverState(
      typeof raw.season === 'number' ? (raw.season as number) : 2026,
    ),
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
    if (raw) return tryParse(raw)
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
