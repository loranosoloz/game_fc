import type {
  Club,
  Fixture,
  MatchEvent,
  MatchEventKind,
  MatchResult,
  PitchSpot,
  Player,
  Referee,
  Tactics,
} from './types'
import { applyInjury } from './medical'
import { applyMatchWear, bodyWearInjuryBonus } from './bodyMap'
import { getReferee, refereeKickoffNote } from './referees'
import { xiSkillBonuses } from './playerSkills'
import { weatherMatchModifiers } from './weather'

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function instructionAttackBonus(t: Tactics): number {
  const i = t.instructions
  let atk = 1
  if (i.mentality === 'attacking') atk += 0.06
  if (i.mentality === 'defensive') atk -= 0.05
  if (i.style === 'counter') atk += 0.03
  if (i.style === 'possession') atk += 0.02
  if (i.tempo === 'fast') atk += 0.02
  if (i.pressing === 'high') atk += 0.02
  return atk
}

function instructionDefenseBonus(t: Tactics): number {
  const i = t.instructions
  let def = 1
  if (i.mentality === 'defensive') def += 0.06
  if (i.mentality === 'attacking') def -= 0.04
  if (i.pressing === 'high') def += 0.03
  if (i.pressing === 'low') def -= 0.02
  if (i.width === 'narrow') def += 0.02
  return def
}

function xiStrength(players: Player[], tactics: Tactics, phase: 'attack' | 'defend'): number {
  const xi = tactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter(Boolean) as Player[]
  if (xi.length === 0) return 50
  const sum = xi.reduce((acc, p) => {
    if (p.injuryDays > 0 || (p.banMatches ?? 0) > 0 || (p.leaveDays ?? 0) > 0 || (p.illnessDays ?? 0) > 0) return acc
    const fitness =
      (p.condition / 100) *
      (0.7 + p.form / 40) *
      (0.85 + p.morale / 50) *
      (0.85 + p.sharpness / 200) *
      (0.9 + (p.happiness ?? 12) / 100)
    return acc + p.overall * fitness
  }, 0)
  const base = sum / xi.length
  const fam = 0.88 + (tactics.familiarity / 100) * 0.2
  // OOP formation: แนวรับแน่นขึ้นเล็กน้อยเมื่อใช้รูปต่างจาก IP
  let oop = 1
  if (phase === 'defend' && tactics.formationOop && tactics.formationOop !== tactics.formation) {
    oop = 1.035
  }
  if (phase === 'attack' && tactics.formationOop === tactics.formation) {
    oop = 1.01
  }
  const instr = phase === 'attack' ? instructionAttackBonus(tactics) : instructionDefenseBonus(tactics)
  return base * fam * instr * oop
}

function oppositionBias(
  attackTactics: Tactics,
  defendPlayers: Player[],
  attackPlayers: Player[],
): number {
  const opp = attackTactics.opposition
  if (!opp) return 1
  let m = 1
  if (opp.pressPlayerId) {
    const target = defendPlayers.find((p) => p.id === opp.pressPlayerId)
    if (target && target.overall >= 78) m += 0.025
  }
  if (opp.markPlayerId) {
    const target = attackPlayers.find((p) => p.id === opp.markPlayerId)
    if (target) m -= 0.02
  }
  if (opp.showOnto === 'tight') m += 0.015
  if (opp.showOnto === 'weaker_foot') m += 0.01
  return m
}

function sampleGoals(attack: number, defense: number, homeBoost: number, rng: () => number) {
  const expected = Math.max(0.2, (attack / defense) * 1.15 * homeBoost + (rng() - 0.5) * 0.6)
  let goals = 0
  const trials = 8
  const p = Math.min(0.55, expected / trials)
  for (let i = 0; i < trials; i++) {
    if (rng() < p) goals += 1
  }
  return goals
}

function pick<T>(rng: () => number, list: T[]): T {
  return list[Math.floor(rng() * list.length)] ?? list[0]
}

function spot(rng: () => number, zone: 'home' | 'mid' | 'away' | 'homeBox' | 'awayBox'): PitchSpot {
  const y = 18 + rng() * 64
  switch (zone) {
    case 'home':
      return { x: 8 + rng() * 22, y }
    case 'homeBox':
      return { x: 6 + rng() * 14, y: 28 + rng() * 44 }
    case 'mid':
      return { x: 35 + rng() * 30, y }
    case 'away':
      return { x: 70 + rng() * 22, y }
    case 'awayBox':
      return { x: 80 + rng() * 14, y: 28 + rng() * 44 }
  }
}

function attackingZone(isHome: boolean): 'homeBox' | 'awayBox' {
  return isHome ? 'awayBox' : 'homeBox'
}

function buildSidePlayers(tactics: Tactics, players: Player[]) {
  return tactics.startingXi
    .map((id) => players.find((p) => p.id === id))
    .filter((p): p is Player => p != null)
}

function outfield(pool: Player[]) {
  return pool.filter((p) => p.position !== 'GK')
}

function gk(pool: Player[]) {
  return pool.find((p) => p.position === 'GK') ?? pool[0]
}

/**
 * FM-style match script: final score is decided first, then a commentary timeline
 * is built so the UI can play it back on a pitch with text.
 */
export function simulateFixture(
  fixture: Fixture,
  clubs: Club[],
  players: Player[],
  tacticsByClub: Record<string, Tactics>,
  seedExtra = 0,
  humanDynamicsBonus = 1,
  referee?: Referee,
): MatchResult {
  const seed =
    fixture.matchday * 10_000 +
    fixture.homeClubId.charCodeAt(fixture.homeClubId.length - 1) * 97 +
    fixture.awayClubId.charCodeAt(fixture.awayClubId.length - 1) * 13 +
    seedExtra
  const rng = mulberry32(seed)

  const ref = referee ?? getReferee(fixture.refereeId) ?? getReferee('ref-01')!
  // strictness 1–20 → foul/card bias
  const strict = Math.max(1, Math.min(20, ref.strictness)) / 20
  const foulChance = 0.08 + 0.1 * strict
  const yellowChance = 0.04 + 0.1 * strict
  const redChance = 0.004 + 0.028 * strict

  const homeClub = clubs.find((c) => c.id === fixture.homeClubId)!
  const awayClub = clubs.find((c) => c.id === fixture.awayClubId)!
  const homeTactics = tacticsByClub[fixture.homeClubId]
  const awayTactics = tacticsByClub[fixture.awayClubId]

  const setPieceBonus = (t: Tactics) => {
    let b = 1
    if (t.setPieces?.corners === 'near_post' || t.setPieces?.corners === 'far_post') b += 0.03
    if (t.setPieces?.freeKicks === 'direct') b += 0.02
    return b
  }

  let homeAttack = xiStrength(players, homeTactics, 'attack') * setPieceBonus(homeTactics)
  let homeDefend = xiStrength(players, homeTactics, 'defend')
  let awayAttack = xiStrength(players, awayTactics, 'attack') * setPieceBonus(awayTactics)
  let awayDefend = xiStrength(players, awayTactics, 'defend')

  const homeSkills = xiSkillBonuses(players, homeTactics.startingXi)
  const awaySkills = xiSkillBonuses(players, awayTactics.startingXi)
  homeAttack *= homeSkills.attack
  homeDefend *= homeSkills.defend
  awayAttack *= awaySkills.attack
  awayDefend *= awaySkills.defend

  const homePool = buildSidePlayers(homeTactics, players)
  const awayPool = buildSidePlayers(awayTactics, players)
  homeAttack *= oppositionBias(homeTactics, awayPool, homePool)
  awayAttack *= oppositionBias(awayTactics, homePool, awayPool)

  const wx = weatherMatchModifiers(fixture.weather ?? 'clear')
  homeAttack *= wx.attack
  awayAttack *= wx.attack
  homeDefend *= wx.defend
  awayDefend *= wx.defend

  let homeRating = (homeAttack + homeDefend) / 2
  let awayRating = (awayAttack + awayDefend) / 2
  if (humanDynamicsBonus !== 1) {
    homeRating *= humanDynamicsBonus
    awayRating *= Math.max(0.85, 2 - humanDynamicsBonus)
  }

  const homeDef = homeRating * instructionDefenseBonus(homeTactics)
  const awayDef = awayRating * instructionDefenseBonus(awayTactics)

  let homeGoals = sampleGoals(homeRating, awayDef, 1.12, rng)
  let awayGoals = sampleGoals(awayRating, homeDef, 0.95, rng)

  // Cup / UCL: no draws (ยกเว้นสองนัด — อนุญาตเสมอในนัดเดียว)
  if (
    (fixture.competition === 'cup' || fixture.competition === 'ucl') &&
    homeGoals === awayGoals &&
    !fixture.tieId
  ) {
    if (rng() < 0.5) homeGoals += 1
    else awayGoals += 1
  }

  const homeOut = outfield(homePool)
  const awayOut = outfield(awayPool)
  const homeGk = gk(homePool)
  const awayGk = gk(awayPool)

  const events: MatchEvent[] = []
  let hg = 0
  let ag = 0
  let eid = 0

  const push = (
    minute: number,
    kind: MatchEventKind,
    text: string,
    s: PitchSpot,
    extra?: Partial<MatchEvent>,
  ) => {
    events.push({
      id: `ev-${fixture.id}-${eid++}`,
      minute,
      kind,
      text,
      spot: s,
      homeGoals: hg,
      awayGoals: ag,
      ...extra,
    })
  }

  push(
    0,
    'kickoff',
    `เสียงนกหวีด! ${homeClub.name} เปิดบ้านรับ ${awayClub.name} — ${refereeKickoffNote(ref)}`,
    { x: 50, y: 50 },
  )

  const goalMinutesHome: number[] = []
  const goalMinutesAway: number[] = []
  for (let i = 0; i < homeGoals; i++) goalMinutesHome.push(4 + Math.floor(rng() * 86))
  for (let i = 0; i < awayGoals; i++) goalMinutesAway.push(4 + Math.floor(rng() * 86))
  goalMinutesHome.sort((a, b) => a - b)
  goalMinutesAway.sort((a, b) => a - b)

  const usedMinutes = new Set<number>([0, 45, 46, 90])
  const reserveMinute = (preferred: number) => {
    let m = preferred
    while (usedMinutes.has(m)) m = Math.min(89, m + 1)
    usedMinutes.add(m)
    return m
  }

  const scheduledGoals: Array<{ minute: number; home: boolean }> = [
    ...goalMinutesHome.map((minute) => ({ minute: reserveMinute(minute), home: true })),
    ...goalMinutesAway.map((minute) => ({ minute: reserveMinute(minute), home: false })),
  ].sort((a, b) => a.minute - b.minute)

  // Fill non-goal moments
  const fillerCount = 18 + Math.floor(rng() * 8)
  const fillerMinutes: number[] = []
  for (let i = 0; i < fillerCount; i++) {
    fillerMinutes.push(reserveMinute(3 + Math.floor(rng() * 86)))
  }
  fillerMinutes.sort((a, b) => a - b)

  type Beat =
    | { t: 'goal'; minute: number; home: boolean }
    | { t: 'fill'; minute: number }

  const beats: Beat[] = [
    ...scheduledGoals.map((g) => ({ t: 'goal' as const, ...g })),
    ...fillerMinutes.map((minute) => ({ t: 'fill' as const, minute })),
  ].sort((a, b) => a.minute - b.minute)

  let halfAnnounced = false
  let secondAnnounced = false

  for (const beat of beats) {
    if (!halfAnnounced && beat.minute >= 45) {
      push(
        45,
        'halftime',
        `หมดครึ่งแรก ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}`,
        { x: 50, y: 50 },
      )
      halfAnnounced = true
    }
    if (!secondAnnounced && beat.minute >= 46) {
      push(
        46,
        'secondhalf',
        'เริ่มครึ่งหลังแล้ว ทั้งสองทีมกลับมาพร้อมสู้',
        { x: 50, y: 50 },
      )
      secondAnnounced = true
    }

    if (beat.t === 'goal') {
      const isHome = beat.home
      const scorer = pick(rng, isHome ? homeOut : awayOut)
      const assistPool = (isHome ? homeOut : awayOut).filter((p) => p.id !== scorer.id)
      const assist = assistPool.length ? pick(rng, assistPool) : null
      const s = spot(rng, attackingZone(isHome))

      push(
        Math.max(1, beat.minute - 1),
        'chance',
        `${isHome ? homeClub.shortName : awayClub.shortName} บุกขึ้นหน้า — ${scorer.name} มีพื้นที่!`,
        spot(rng, isHome ? 'away' : 'home'),
        { clubId: isHome ? homeClub.id : awayClub.id, playerName: scorer.name, playerId: scorer.id },
      )
      push(
        beat.minute,
        'shot',
        `${scorer.name} ยิง...`,
        s,
        { clubId: isHome ? homeClub.id : awayClub.id, playerName: scorer.name, playerId: scorer.id },
      )
      if (isHome) hg += 1
      else ag += 1
      const assistTh = assist ? ` แอสซิสต์: ${assist.name}` : ''
      push(
        beat.minute,
        'goal',
        `ประตู! ${scorer.name} ยิงให้ ${isHome ? homeClub.name : awayClub.name}!${assistTh} ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}`,
        s,
        {
          clubId: isHome ? homeClub.id : awayClub.id,
          playerName: scorer.name,
          playerId: scorer.id,
        },
      )
      continue
    }

    const homeAttack = rng() < homeRating / (homeRating + awayRating)
    const team = homeAttack ? homeClub : awayClub
    const opp = homeAttack ? awayClub : homeClub
    const attackers = homeAttack ? homeOut : awayOut
    const defenders = homeAttack ? awayOut : homeOut
    const keeper = homeAttack ? awayGk : homeGk
    const actor = pick(rng, attackers)
    const defender = pick(rng, defenders)
    const roll = rng()

    if (roll < 0.18) {
      push(
        beat.minute,
        'commentary',
        `${team.shortName} ครองบอลผ่านกลางสนามอย่างใจเย็น`,
        spot(rng, 'mid'),
        { clubId: team.id },
      )
    } else if (roll < 0.34) {
      push(
        beat.minute,
        'chance',
        `${actor.name} ดริบเบิลใส่ ${defender.name} — แฟนบอลลุกยืน`,
        spot(rng, homeAttack ? 'away' : 'home'),
        { clubId: team.id, playerName: actor.name },
      )
    } else if (roll < 0.5) {
      const s = spot(rng, attackingZone(homeAttack))
      push(
        beat.minute,
        'shot',
        `${actor.name} ยิงจากขอบเขตโทษ!`,
        s,
        { clubId: team.id, playerName: actor.name },
      )
      push(
        beat.minute,
        'save',
        `เซฟ! ${keeper.name} ปัดลูกออก ช่วย ${opp.shortName} ไว้`,
        s,
        { clubId: opp.id, playerName: keeper.name },
      )
    } else if (roll < 0.62) {
      push(
        beat.minute,
        'corner',
        `เตะมุมของ ${team.shortName} — ${actor.name} จะเปิดลูก`,
        spot(rng, homeAttack ? 'awayBox' : 'homeBox'),
        { clubId: team.id, playerName: actor.name },
      )
    } else if (roll < 0.7) {
      push(
        beat.minute,
        'foul',
        `${defender.name} ฟาล์วใส่ ${actor.name} — ${ref.name} ให้ฟรีคิก ${team.shortName}`,
        spot(rng, 'mid'),
        { clubId: opp.id, playerName: defender.name, playerId: defender.id },
      )
    } else if (roll < 0.7 + foulChance * 0.35 + yellowChance + redChance) {
      // กรรมการเข้ม → ใบบ่อยขึ้น / โอกาสแดงสูงขึ้น
      const cardRoll = rng()
      const redCut = redChance / Math.max(0.01, yellowChance + redChance)
      if (cardRoll < redCut) {
        push(
          beat.minute,
          'card',
          `ใบแดง! ${ref.name} ไล่ ${defender.name} (${opp.shortName}) ออกจากสนาม`,
          spot(rng, 'mid'),
          {
            clubId: opp.id,
            playerName: defender.name,
            playerId: defender.id,
            cardColor: 'red',
          },
        )
      } else {
        push(
          beat.minute,
          'card',
          `ใบเหลือง! ${ref.name} จอง ${defender.name} (${opp.shortName})`,
          spot(rng, 'mid'),
          {
            clubId: opp.id,
            playerName: defender.name,
            playerId: defender.id,
            cardColor: 'yellow',
          },
        )
      }
    } else if (roll < 0.92) {
      push(
        beat.minute,
        'commentary',
        `${opp.shortName} แย่งบอลคืน พร้อมโต้กลับ`,
        spot(rng, homeAttack ? 'home' : 'away'),
        { clubId: opp.id },
      )
    } else {
      push(
        beat.minute,
        'commentary',
        `จังหวะชะลอลง ${team.name} จัดรูปทีมใหม่`,
        spot(rng, 'mid'),
        { clubId: team.id },
      )
    }
  }

  if (!halfAnnounced) {
    push(45, 'halftime', `หมดครึ่งแรก ${homeClub.shortName} ${hg}–${ag} ${awayClub.shortName}`, {
      x: 50,
      y: 50,
    })
  }

  push(
    90,
    'fulltime',
    `จบเกม! ${homeClub.name} ${hg}–${ag} ${awayClub.name}`,
    { x: 50, y: 50 },
  )

  events.sort((a, b) => a.minute - b.minute || a.id.localeCompare(b.id))

  const blank = () => ({
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    possession: 50,
  })
  const homeStats = blank()
  const awayStats = blank()
  for (const ev of events) {
    const side = ev.clubId === homeClub.id ? homeStats : ev.clubId === awayClub.id ? awayStats : null
    if (!side) continue
    if (ev.kind === 'shot' || ev.kind === 'goal') side.shots += 1
    if (ev.kind === 'goal') side.shotsOnTarget += 1
    if (ev.kind === 'corner') side.corners += 1
    if (ev.kind === 'foul') side.fouls += 1
    if (ev.kind === 'card' && ev.cardColor === 'yellow') side.yellows += 1
    if (ev.kind === 'card' && ev.cardColor === 'red') side.reds += 1
    if (ev.kind === 'save') {
      // save = shot on target by the other side
      if (ev.clubId === homeClub.id) awayStats.shotsOnTarget += 1
      else if (ev.clubId === awayClub.id) homeStats.shotsOnTarget += 1
    }
  }
  const totalAtk = homeRating + awayRating
  homeStats.possession = Math.round((homeRating / totalAtk) * 100)
  awayStats.possession = 100 - homeStats.possession

  return {
    fixtureId: fixture.id,
    homeGoals: hg,
    awayGoals: ag,
    events,
    homeRating: Math.round(homeRating * 10) / 10,
    awayRating: Math.round(awayRating * 10) / 10,
    stats: { home: homeStats, away: awayStats },
  }
}

export function applyMatchFatigue(
  players: Player[],
  tactics: Tactics,
  played: boolean,
  injuryMult = 1,
): Player[] {
  if (!played) return players
  const xi = new Set(tactics.startingXi)
  const used = new Set([...tactics.startingXi, ...tactics.bench.slice(0, 3)])
  return players.map((p) => {
    if (!used.has(p.id)) {
      let next = {
        ...p,
        condition: Math.min(100, p.condition + 4),
        sharpness: Math.max(30, p.sharpness - 1),
      }
      next = applyMatchWear(next, 'unused')
      return next
    }
    const drop = 6 + Math.floor(Math.random() * 6)
    let next = {
      ...p,
      condition: Math.max(45, p.condition - drop),
      sharpness: Math.min(100, p.sharpness + (xi.has(p.id) ? 3 : 1)),
      form: Math.min(20, Math.max(1, p.form + (Math.random() > 0.5 ? 1 : -1))),
      minutesPlayed: p.minutesPlayed + (xi.has(p.id) ? 90 : 20),
    }
    next = applyMatchWear(next, xi.has(p.id) ? 'starter' : 'sub')
    const wearBonus = bodyWearInjuryBonus(next)
    if (
      xi.has(p.id) &&
      p.injuryDays <= 0 &&
      (p.illnessDays ?? 0) <= 0 &&
      (p.banMatches ?? 0) <= 0 &&
      next.condition < 60 &&
      Math.random() < (0.02 + p.hidden.injuryProneness / 400 + wearBonus) * injuryMult
    ) {
      next = applyInjury(next, 'match')
    }
    return next
  })
}
