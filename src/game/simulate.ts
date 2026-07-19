import type { Club, Fixture, GameSave, InboxMessage, MatchResult, Player, TableRow, Tactics } from './types'
import { applyMatchFatigue, simulateFixture } from './matchEngine'
import { autoPickTactics } from './seed'
import { applyMatchToFans, ensureFans, processFanPolitics } from './fans'
import { applyMatchToBoard, processBoardPolitics } from './board'
import { applyMatchToOwner, ensureOwner } from './owner'
import { processStadiumPresence } from './clubAtmosphere'
import { scanTakeoverMarket } from './takeover'
import { enterUnemployment, refreshJobMarket } from './jobs'
import { processFacilities, commercialGateBonus, trainingFacilityBonus } from './facilities'
import { tickSocialAfterMatchday } from './social'
import { transferWindowKind } from './transferWindow'
import { tickWorldPulse } from './worldPulse'
import { applyTrainingWeek, updatePlayingTimeMorale } from './training'
import { tickPlayerInjury } from './medical'
import {
  tickIllness,
  rollSquadIllnesses,
  ILLNESS_RISK_ACTIVITIES,
} from './illness'
import { applyDevelopmentForSave } from './development'
import { recomputeDynamics, dynamicsMatchBonus } from './dynamics'
import { talkBonusFromSave } from './preMatch'
import {
  newsAfterMatch,
  newsAfterInjury,
  newsAfterIllness,
  newsAfterTitle,
  newsRivalResult,
  detectNewInjuries,
  advanceMediaWeek,
  ensureMediaFeed,
  pushNews,
} from './media'
import { createPressConference } from './pressConference'
import { maybeAiRomanoPlants } from './romanoPlant'
import { resolveFormWatches, weeklyScoutPassive } from './scouting'
import { generateStadiumVisits } from './stadiumVisits'
import { generatePlayerTalkRequests, processAiPlayerTalks, resolveTalkPromises } from './playerTalks'
import { processLoansMatchday } from './loans'
import { applyMatchdayIncome, awardCompetitionPrize } from './clubIncome'
import { processTransferDeskMatchday } from './transferDesk'
import { tickEndOfSeasonClauses } from './transferClauses'
import type { MediaItem } from './types'
import { maybePromoteYouth } from './youth'
import { advanceCupAfterMatchday } from './cup'
import {
  advanceLeagueCupAfterMatchday,
  advanceTrophyAfterMatchday,
} from './extraCups'
import { advanceUclAfterMatchday, advanceUelAfterMatchday, advanceUeclAfterMatchday } from './ucl'
import { snapshotEuroRanks } from './europeAccess'
import { assignRefereesToFixtures, getReferee } from './referees'
import { fixtureWeatherSeed, pickWeather, weatherMatchModifiers } from './weather'
import {
  applyDisciplineFromEvents,
  stripBannedFromTactics,
} from './discipline'
import { applyMatchCardFines } from './disciplineFines'
import {
  staffLevel,
  refreshStaffMarket,
  maybePlayersBecomeStaff,
} from './staff'
import { simulateDailyLife } from './dailyLife'
import {
  applyGateReceiptToClub,
  calcGateReceipt,
  ensureClubFinance,
  payWeeklyWagesWithCash,
  recordHumanGate,
  simulatePlayerSpending,
} from './playerEconomy'

function applyResultToTable(table: TableRow[], fixture: Fixture, homeGoals: number, awayGoals: number): TableRow[] {
  if (fixture.competition !== 'league') return table
  return table.map((row) => {
    if (row.clubId === fixture.homeClubId) {
      const won = homeGoals > awayGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + homeGoals,
        ga: row.ga + awayGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    if (row.clubId === fixture.awayClubId) {
      const won = awayGoals > homeGoals
      const drawn = homeGoals === awayGoals
      return {
        ...row,
        played: row.played + 1,
        won: row.won + (won ? 1 : 0),
        drawn: row.drawn + (drawn ? 1 : 0),
        lost: row.lost + (!won && !drawn ? 1 : 0),
        gf: row.gf + awayGoals,
        ga: row.ga + homeGoals,
        points: row.points + (won ? 3 : drawn ? 1 : 0),
      }
    }
    return row
  })
}

function bumpFamiliarity(tactics: Tactics, played: boolean): Tactics {
  if (!played) return tactics
  return {
    ...tactics,
    familiarity: Math.min(100, tactics.familiarity + 2),
  }
}

export interface PreparedMatchday {
  matchday: number
  date: string
  tacticsByClub: Record<string, Tactics>
  results: Array<{ fixture: Fixture; result: MatchResult }>
  humanResult: MatchResult | null
  humanFixture: Fixture | null
}

export function prepareMatchday(save: GameSave, matchday: number): PreparedMatchday | null {
  let fixtures = assignRefereesToFixtures(save.fixtures)
  fixtures = fixtures.map((f) => {
    if (f.matchday !== matchday || f.played || f.weather) return f
    return {
      ...f,
      weather: pickWeather(fixtureWeatherSeed(f.id, matchday)),
    }
  })
  const dayFixtures = fixtures.filter((f) => f.matchday === matchday && !f.played)
  if (dayFixtures.length === 0) return null

  const players = save.players
  let tacticsByClub = { ...save.tacticsByClub }
  for (const club of save.clubs) {
    if (club.controlledBy === 'ai') {
      const current = tacticsByClub[club.id]
      const picked = autoPickTactics(club.id, players, current.formation, current.formationOop)
      tacticsByClub[club.id] = {
        ...picked,
        instructions: current.instructions,
        familiarity: current.familiarity,
        setPieces: current.setPieces,
      }
    }
  }

  const dynBonus =
    (save.humanClubId && save.dynamics ? dynamicsMatchBonus(save.dynamics) : 1) *
    talkBonusFromSave(save)

  const results: PreparedMatchday['results'] = []
  let humanResult: MatchResult | null = null
  let humanFixture: Fixture | null = null

  for (const fixture of dayFixtures) {
    const result = simulateFixture(
      fixture,
      save.clubs,
      players,
      tacticsByClub,
      matchday * 17,
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
        ? dynBonus
        : 1,
      getReferee(fixture.refereeId),
    )
    results.push({ fixture, result })
    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    if (involvesHuman) {
      humanResult = result
      humanFixture = fixture
    }
  }

  return {
    matchday,
    date: dayFixtures[0]?.date ?? save.currentDate,
    tacticsByClub,
    results,
    humanResult,
    humanFixture,
  }
}

export function applyPreparedMatchday(save: GameSave, prepared: PreparedMatchday): GameSave {
  save = ensureFans(save)
  let fixtures = assignRefereesToFixtures(save.fixtures.slice())
  let table = save.table.slice()
  let tableDiv2 = (save.tableDiv2 ?? []).slice()
  let players = save.players.slice()
  let clubs = save.clubs.map((c) => ({ ...c }))
  let fans = save.fans
  let board = save.board
  let ownerState = ensureOwner(save)
  let cup = save.cup
  let leagueCup = save.leagueCup ?? { name: 'League Cup', championClubId: null, eliminated: [] }
  let trophy = save.trophy ?? { name: 'Trophy', championClubId: null, eliminated: [] }
  let ucl = save.ucl
  let uel = save.uel ?? { name: 'UEFA Europa League', championClubId: null, eliminated: [] }
  let uecl = save.uecl ?? { name: 'UEFA Conference League', championClubId: null, eliminated: [] }
  let pressConference = save.pressConference ?? null
  let managerReputation = save.managerReputation ?? 50
  let clubFinance = ensureClubFinance(save)
  const inbox: InboxMessage[] = [...save.inbox]
  let tacticsByClub = { ...prepared.tacticsByClub }
  let humanResult: MatchResult | null = null
  const banAtStart = new Map(players.map((p) => [p.id, p.banMatches ?? 0]))
  const playedClubs = new Set<string>()
  let discRngSeed = prepared.matchday * 7919
  const newsBatch: MediaItem[] = []
  const injuryBefore = players.map((p) => ({ id: p.id, injuryDays: p.injuryDays }))
  const cardFineTriggers: Array<{ playerId: string; kind: 'red_card' | 'yellow_ban' }> = []

  const sorted = table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return b.gf - b.ga - (a.gf - a.ga)
  })
  const humanRank = sorted.findIndex((r) => r.clubId === save.humanClubId)
  const rivalIds = new Set(
    sorted
      .filter((_, i) => humanRank >= 0 && Math.abs(i - humanRank) <= 2 && i !== humanRank)
      .map((r) => r.clubId),
  )

  for (const { fixture, result } of prepared.results) {
    playedClubs.add(fixture.homeClubId)
    playedClubs.add(fixture.awayClubId)
    fixtures = fixtures.map((f) =>
      f.id === fixture.id
        ? {
            ...f,
            played: true,
            homeGoals: result.homeGoals,
            awayGoals: result.awayGoals,
            refereeId: fixture.refereeId ?? f.refereeId,
            weather: fixture.weather ?? f.weather,
          }
        : f,
    )
    if (fixture.competition === 'league' && (fixture.division === 2 || String(fixture.id).startsWith('fx2'))) {
      tableDiv2 = applyResultToTable(tableDiv2, fixture, result.homeGoals, result.awayGoals)
    } else {
      table = applyResultToTable(table, fixture, result.homeGoals, result.awayGoals)
    }

    const home = clubs.find((c) => c.id === fixture.homeClubId)!
    const away = clubs.find((c) => c.id === fixture.awayClubId)!
    const isHumanHome = home.id === save.humanClubId
    const receipt = calcGateReceipt(
      home,
      result.homeGoals,
      result.awayGoals,
      isHumanHome ? fans : undefined,
      prepared.matchday,
      isHumanHome ? commercialGateBonus(save) : 1,
    )
    clubs = clubs.map((c) =>
      c.id === home.id ? applyGateReceiptToClub(c, receipt) : c,
    )
    if (isHumanHome) {
      clubFinance = recordHumanGate(clubFinance, fixture.date, receipt, home.shortName)
    }
    const homeIncome = receipt.total

    const injuryMult = weatherMatchModifiers(fixture.weather ?? 'clear').injury
    players = applyMatchFatigue(players, tacticsByClub[fixture.homeClubId], true, injuryMult)
    players = applyMatchFatigue(players, tacticsByClub[fixture.awayClubId], true, injuryMult)
    tacticsByClub[fixture.homeClubId] = bumpFamiliarity(tacticsByClub[fixture.homeClubId], true)
    tacticsByClub[fixture.awayClubId] = bumpFamiliarity(tacticsByClub[fixture.awayClubId], true)

    discRngSeed += 17
    const disc = applyDisciplineFromEvents(players, result.events, () => {
      discRngSeed = (discRngSeed * 16807) % 2147483647
      return discRngSeed / 2147483647
    })
    players = disc.players
    for (const t of disc.fineTriggers) cardFineTriggers.push(t)
    for (const note of disc.notes) {
      if (
        fixture.homeClubId === save.humanClubId ||
        fixture.awayClubId === save.humanClubId
      ) {
        inbox.unshift({
          id: `msg-ban-${Date.now()}-${note.slice(0, 12)}`,
          date: fixture.date,
          title: 'วินัย',
          body: note,
          read: false,
        })
      }
    }

    const involvesHuman =
      fixture.homeClubId === save.humanClubId || fixture.awayClubId === save.humanClubId
    if (involvesHuman) {
      humanResult = result
      const opp = fixture.homeClubId === save.humanClubId ? away : home
      const usHome = fixture.homeClubId === save.humanClubId
      const usGoals = usHome ? result.homeGoals : result.awayGoals
      const themGoals = usHome ? result.awayGoals : result.homeGoals
      const outcome = usGoals > themGoals ? 'ชนะ' : usGoals === themGoals ? 'เสมอ' : 'แพ้'
      fans = applyMatchToFans(fans, usGoals, themGoals, usHome)

      const midSave: GameSave = {
        ...save,
        table,
        fans,
        board,
        players,
        clubs,
        tacticsByClub,
        fixtures,
        managerReputation,
      }
      board = applyMatchToBoard(midSave, usGoals, themGoals)
      ownerState = applyMatchToOwner({ ...midSave, board, fans }, usGoals, themGoals)
      {
        const atm = processStadiumPresence(
          {
            ...midSave,
            board,
            fans,
            owner: ownerState,
            clubs,
            inbox,
            currentDate: fixture.date,
            matchday: prepared.matchday,
          },
          usGoals,
          themGoals,
          usHome,
        )
        ownerState = atm.owner
        board = atm.board
        fans = atm.fans
        clubs = atm.clubs
        inbox.length = 0
        inbox.push(...atm.inbox)
      }
      newsBatch.push(newsAfterMatch({ ...midSave, board }, usGoals, themGoals, opp.name))
      pressConference = createPressConference(
        { ...midSave, board, currentDate: fixture.date },
        usGoals,
        themGoals,
        opp.name,
      )
      managerReputation = Math.max(
        0,
        Math.min(100, managerReputation + (usGoals > themGoals ? 2 : usGoals === themGoals ? 0 : -2)),
      )

      const st = usHome ? result.stats.home : result.stats.away
      const comp =
        fixture.competition === 'cup'
          ? `ถ้วย (${fixture.cupRound})`
          : fixture.competition === 'ucl'
            ? `UCL (${fixture.cupRound})`
            : fixture.competition === 'uel'
              ? `Europa (${fixture.cupRound})`
              : fixture.competition === 'uecl'
                ? `Conference (${fixture.cupRound})`
                : 'ลีก'
      const gateNote = usHome
        ? ` · ตั๋ว ${receipt.tickets.toLocaleString('th-TH')} + เสื้อ ${receipt.shirts.toLocaleString('th-TH')} ฿ (ผู้ชม ~${receipt.crowd.toLocaleString('th-TH')})`
        : ` · รายได้เจ้าบ้าน ${homeIncome.toLocaleString('th-TH')} ฿`
      inbox.unshift({
        id: `msg-${Date.now()}-${fixture.id}`,
        date: fixture.date,
        title: `${outcome} พบ ${opp.name} · ${comp}`,
        body: `สกอร์ ${result.homeGoals}–${result.awayGoals} · ยิง ${st.shots} (เข้ากรอบ ${st.shotsOnTarget}) · ใบ ${st.yellows}Y/${st.reds}R${gateNote}`,
        read: false,
      })
    } else if (
      fixture.competition === 'league' &&
      (rivalIds.has(fixture.homeClubId) || rivalIds.has(fixture.awayClubId)) &&
      Math.random() < 0.38
    ) {
      const rivalIsHome = rivalIds.has(fixture.homeClubId)
      const rival = rivalIsHome ? home : away
      const opp = rivalIsHome ? away : home
      const rg = rivalIsHome ? result.homeGoals : result.awayGoals
      const og = rivalIsHome ? result.awayGoals : result.homeGoals
      newsBatch.push(
        newsRivalResult(
          { ...save, currentDate: fixture.date, managerReputation },
          rival.shortName,
          opp.shortName,
          rg,
          og,
        ),
      )
    }
  }

  // Serve bans for players who already sat out this matchday
  players = players.map((p) => {
    const prior = banAtStart.get(p.id) ?? 0
    if (prior <= 0 || !playedClubs.has(p.clubId)) return p
    return { ...p, banMatches: Math.max(0, (p.banMatches ?? 0) - 1) }
  })
  tacticsByClub = stripBannedFromTactics(tacticsByClub, players)
  // Refill XIs missing banned/injured slots
  for (const club of clubs) {
    const t = tacticsByClub[club.id]
    if (!t || t.startingXi.length >= 11) continue
    tacticsByClub[club.id] = {
      ...autoPickTactics(club.id, players, t.formation, t.formationOop),
      instructions: t.instructions,
      familiarity: t.familiarity,
      setPieces: t.setPieces,
    }
  }

  const cupAdv = advanceCupAfterMatchday(fixtures, cup, prepared.matchday)
  fixtures = cupAdv.fixtures
  cup = cupAdv.cup
  const lcAdv = advanceLeagueCupAfterMatchday(fixtures, leagueCup, prepared.matchday)
  fixtures = lcAdv.fixtures
  leagueCup = lcAdv.cup
  const trAdv = advanceTrophyAfterMatchday(fixtures, trophy, prepared.matchday)
  fixtures = trAdv.fixtures
  trophy = trAdv.cup
  if (cup.championClubId && !save.cup.championClubId) {
    const champ = clubs.find((c) => c.id === cup.championClubId)
    inbox.unshift({
      id: `msg-cup-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of the Cup',
      body: `${champ?.name ?? cup.championClubId} คว้าแชมป์ ${cup.name}`,
      read: false,
    })
    newsBatch.push(
      newsAfterTitle(
        { ...save, currentDate: prepared.date, managerReputation },
        cup.name,
        champ?.name ?? cup.championClubId,
        cup.championClubId === save.humanClubId,
      ),
    )
    if (cup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 5)
    }
  }

  // apply prize money after cup crowned
  if (cup.championClubId && !save.cup.championClubId) {
    const cupPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'cup',
      cup.championClubId,
    )
    clubs = cupPrize.clubs
    clubFinance = cupPrize.clubFinance
  }

  if (leagueCup.championClubId && !save.leagueCup?.championClubId) {
    const champ = clubs.find((c) => c.id === leagueCup.championClubId)
    inbox.unshift({
      id: `msg-lc-${Date.now()}`,
      date: prepared.date,
      title: 'League Cup Champions',
      body: `${champ?.name ?? leagueCup.championClubId} คว้าแชมป์ ${leagueCup.name}`,
      read: false,
    })
    if (leagueCup.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 3)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'league_cup',
      leagueCup.championClubId,
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  if (trophy.championClubId && !save.trophy?.championClubId) {
    const champ = clubs.find((c) => c.id === trophy.championClubId)
    inbox.unshift({
      id: `msg-tr-${Date.now()}`,
      date: prepared.date,
      title: 'Trophy Champions',
      body: `${champ?.name ?? trophy.championClubId} คว้าแชมป์ ${trophy.name}`,
      read: false,
    })
    if (trophy.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 2)
    }
    const prize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'trophy',
      trophy.championClubId,
    )
    clubs = prize.clubs
    clubFinance = prize.clubFinance
  }

  const uclAdv = advanceUclAfterMatchday(fixtures, ucl, prepared.matchday)
  fixtures = uclAdv.fixtures
  ucl = uclAdv.ucl
  if (ucl.championClubId && !save.ucl?.championClubId) {
    const champ = clubs.find((c) => c.id === ucl.championClubId)
    inbox.unshift({
      id: `msg-ucl-${Date.now()}`,
      date: prepared.date,
      title: 'Champions of Europe',
      body: `${champ?.name ?? ucl.championClubId} คว้าแชมป์ ${ucl.name}`,
      read: false,
    })
    newsBatch.push(
      newsAfterTitle(
        { ...save, currentDate: prepared.date, managerReputation },
        ucl.name,
        champ?.name ?? ucl.championClubId,
        ucl.championClubId === save.humanClubId,
      ),
    )
    if (ucl.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 8)
    }
    const uclPrize = awardCompetitionPrize(
      { ...save, clubs, currentDate: prepared.date, clubFinance },
      'ucl',
      ucl.championClubId,
    )
    clubs = uclPrize.clubs
    clubFinance = uclPrize.clubFinance
  }

  const uelAdv = advanceUelAfterMatchday(fixtures, uel, prepared.matchday)
  fixtures = uelAdv.fixtures
  uel = uelAdv.uel
  if (uel.championClubId && !save.uel?.championClubId) {
    const champ = clubs.find((c) => c.id === uel.championClubId)
    inbox.unshift({
      id: `msg-uel-${Date.now()}`,
      date: prepared.date,
      title: 'Europa League champions',
      body: `${champ?.name ?? uel.championClubId} คว้าแชมป์ ${uel.name}`,
      read: false,
    })
    if (uel.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 5)
    }
  }

  const ueclAdv = advanceUeclAfterMatchday(fixtures, uecl, prepared.matchday)
  fixtures = ueclAdv.fixtures
  uecl = ueclAdv.uecl
  if (uecl.championClubId && !save.uecl?.championClubId) {
    const champ = clubs.find((c) => c.id === uecl.championClubId)
    inbox.unshift({
      id: `msg-uecl-${Date.now()}`,
      date: prepared.date,
      title: 'Conference League champions',
      body: `${champ?.name ?? uecl.championClubId} คว้าแชมป์ ${uecl.name}`,
      read: false,
    })
    if (uecl.championClubId === save.humanClubId) {
      managerReputation = Math.min(100, managerReputation + 4)
    }
  }

  let next: GameSave = {
    ...save,
    fixtures,
    table,
    tableDiv2,
    players,
    clubs,
    tacticsByClub,
    fans,
    board,
    owner: ownerState,
    cup,
    leagueCup,
    trophy,
    ucl,
    uel,
    uecl,
    managerReputation,
    pressConference,
    clubFinance,
    inbox: inbox.slice(0, 40),
    lastHumanResult: humanResult ?? save.lastHumanResult,
    matchday: prepared.matchday,
    seasonComplete: fixtures
      .filter((f) => f.competition === 'league')
      .every((f) => f.played),
    currentDate: prepared.date,
    preMatch: null,
  }

  if (cardFineTriggers.length > 0) {
    let fineRng = prepared.matchday * 4243
    next = applyMatchCardFines(next, cardFineTriggers, prepared.date, () => {
      fineRng = (fineRng * 16807) % 2147483647
      return fineRng / 2147483647
    })
    players = next.players
    clubFinance = next.clubFinance
  }

  const trained = applyTrainingWeek(
    next.players,
    next.humanClubId,
    next.training,
    trainingFacilityBonus(next),
  )
  const coachBoost = staffLevel(next.staff, 'coach') / 40
  const trainingInjuries = detectNewInjuries(injuryBefore, trained.players, next.humanClubId)
  // Also catch match injuries (compare mid-state before training)
  const matchInjuries = detectNewInjuries(injuryBefore, players, next.humanClubId)
  const seenInj = new Set<string>()
  for (const inj of [...matchInjuries, ...trainingInjuries]) {
    if (seenInj.has(inj.name)) continue
    seenInj.add(inj.name)
    newsBatch.push(newsAfterInjury(next, inj.name, inj.injuryType, inj.days))
  }

  next = {
    ...next,
    players: trained.players.map((p) =>
      p.clubId === next.humanClubId
        ? { ...p, sharpness: Math.min(100, p.sharpness + coachBoost) }
        : p,
    ),
    inbox: [
      {
        id: `msg-train-${Date.now()}`,
        date: prepared.date,
        title: 'สรุปการซ้อม',
        body: trained.note,
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }
  next = { ...next, players: updatePlayingTimeMorale(next) }
  next = { ...next, dynamics: recomputeDynamics(next) }
  next = applyDevelopmentForSave(next)
  next = maybePromoteYouth(next)
  next = resolveFormWatches(
    next,
    prepared.results.map((r) => ({
      fixtureId: r.fixture.id,
      homeGoals: r.result.homeGoals,
      awayGoals: r.result.awayGoals,
    })),
  )
  next = { ...next, scouting: weeklyScoutPassive(next, next.staff) }

  // แขกเข้าสนามบ้าน (คนที่มีแข่งวันนั้นมาไม่ได้)
  const humanHome = prepared.results.find(
    (r) => r.fixture.homeClubId === save.humanClubId,
  )
  if (humanHome) {
    next = generateStadiumVisits(next, humanHome.fixture.id)
  }

  next = refreshStaffMarket(next)
  next = maybePlayersBecomeStaff(next)
  next = simulateDailyLife(next, 7)
  next = simulatePlayerSpending(next, 7)

  // Illness rolls for ALL clubs (human + AI) — lifestyle + contagion + winter
  const riskyByPlayer: Record<string, number> = {}
  for (const log of next.dailyLogs ?? []) {
    if (log.date !== next.currentDate) continue
    const risk = ILLNESS_RISK_ACTIVITIES[log.activityId]
    if (risk) riskyByPlayer[log.playerId] = (riskyByPlayer[log.playerId] ?? 0) + risk
  }
  const illRoll = rollSquadIllnesses(next.players, {
    matchday: next.matchday,
    season: next.season,
    riskyByPlayer,
  })
  next = { ...next, players: illRoll.players }
  const humanIll = illRoll.newlyIll.filter((x) => x.clubId === next.humanClubId)
  if (humanIll.length > 0) {
    next = {
      ...next,
      inbox: [
        {
          id: `msg-ill-${Date.now()}`,
          date: next.currentDate,
          title: 'รายงานป่วย',
          body: humanIll.map((x) => `${x.name} · ${x.type} ${x.days} วัน`).join(' · '),
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    }
    for (const x of humanIll.slice(0, 2)) {
      next = pushNews(next, newsAfterIllness(next, x.name, x.type, x.days))
    }
  }

  next = resolveTalkPromises(next)
  next = generatePlayerTalkRequests(next)
  next = processAiPlayerTalks(next)
  next = applyMatchdayIncome(next)
  next = processLoansMatchday(next)
  next = processTransferDeskMatchday(
    next,
    prepared.results.map((r) => r.result),
  )
  if (next.seasonComplete && !save.seasonComplete) {
    next = tickEndOfSeasonClauses(next)
    next = { ...next, euroAccess: snapshotEuroRanks(next) }
  }
  next = processFanPolitics(next)
  next = processBoardPolitics(next)
  if (next.board?.sacked) {
    next = enterUnemployment(next)
  }
  next = scanTakeoverMarket(next)
  if (next.career?.unemployed || next.board?.sacked) {
    next = refreshJobMarket(next)
  }
  next = processFacilities(next)
  next = tickSocialAfterMatchday(next)
  next = tickWorldPulse(next)
  if (next.matchday === 19 && transferWindowKind(next) === 'winter') {
    next = {
      ...next,
      inbox: [
        {
          id: `msg-winter-${Date.now()}`,
          date: next.currentDate,
          title: 'ตลาดวินเทอร์เปิด',
          body: 'หน้าต่างตลาดฤดูหนาว MD19–23 — ซื้อ/ขาย/ยืมได้ในช่วงนี้',
          read: false,
        },
        ...next.inbox,
      ].slice(0, 40),
    }
  }
  next = { ...next, media: ensureMediaFeed(next) }
  for (const n of newsBatch) next = pushNews(next, n)
  next = advanceMediaWeek(next)
  next = maybeAiRomanoPlants(next)

  return next
}

export function simulateMatchday(save: GameSave, matchday: number) {
  const prepared = prepareMatchday(save, matchday)
  if (!prepared) {
    return { save, humanResult: null, resultsCount: 0 }
  }
  return {
    save: applyPreparedMatchday(save, prepared),
    humanResult: prepared.humanResult,
    resultsCount: prepared.results.length,
  }
}

/** @deprecated use payWeeklyWagesWithCash — หักคลับอย่างเดียว (ไม่มี cash) */
export function payWeeklyWages(clubs: Club[], players: Player[]): Club[] {
  return payWeeklyWagesWithCash(clubs, players).clubs
}

export function applyWeeklyWages(save: GameSave): GameSave {
  const paid = payWeeklyWagesWithCash(save.clubs, save.players)
  const humanWage = paid.wageTotalByClub[save.humanClubId] ?? 0
  const finance = ensureClubFinance(save)
  return {
    ...save,
    clubs: paid.clubs,
    players: paid.players,
    clubFinance: {
      ...finance,
      wageSeason: finance.wageSeason + humanWage,
      ledger: [
        {
          id: `fin-wage-${Date.now()}`,
          date: save.currentDate,
          kind: 'wages' as const,
          amount: -humanWage,
          note: `ค่าเหนื่อยสควอดรายสัปดาห์`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    },
  }
}

export function recoverSquad(players: Player[], physioLevel = 8): Player[] {
  return players.map((p) => {
    let healed = tickPlayerInjury(p, physioLevel)
    healed = tickIllness(healed, physioLevel)
    const leave = healed.leaveDays ?? 0
    if (leave <= 0) return healed
    return { ...healed, leaveDays: Math.max(0, leave - 1) }
  })
}

export function sortedTable(table: TableRow[]) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

export function nextUnplayedMatchday(save: GameSave): number | null {
  const upcoming = save.fixtures.filter((f) => !f.played)
  if (upcoming.length === 0) return null
  return Math.min(...upcoming.map((f) => f.matchday))
}
