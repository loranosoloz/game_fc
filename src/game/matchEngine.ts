/**
 * Match Engine entry — layered simulation (spatial / formation / stochastic actions)
 * Legacy binomial scorer replaced; fatigue helpers remain here.
 */
import type {
  Club,
  Fixture,
  Player,
  Referee,
  Tactics,
  TeamTalkKind,
} from './types'
import { applyInjury } from './medical'
import { applyMatchWear, bodyWearInjuryBonus } from './bodyMap'
import { simulateLayeredMatch } from './match/simulateMatch'
import type { TouchlineShout } from './match/touchlineShouts'
import type { MatchMidState } from './match/halfTime'
import type { LayeredMatchOutput } from './match/simulateMatch'

export function simulateFixture(
  fixture: Fixture,
  clubs: Club[],
  players: Player[],
  tacticsByClub: Record<string, Tactics>,
  seedExtra = 0,
  humanDynamicsBonus = 1,
  referee?: Referee,
  humanCtx?: {
    humanClubId: string
    managerName: string
    manager: {
      style: import('./worldCoaches').CoachStyleId
      power: number
      attackingIQ: number
      defendingIQ: number
      strongVs: string[]
      weakVs: string[]
    } | null
  },
  extras?: {
    teamTalk?: TeamTalkKind | null
    pendingShouts?: TouchlineShout[]
    fidelity?: 'human' | 'ai'
    phase?: 'full' | 'firstHalf' | 'secondHalf' | 'secondHalfClose' | 'extraTime'
    resume?: MatchMidState
    pauseAtMinute?: number
    pendingHumanSubs?: import('./match/halfTime').HalfTimeSub[]
    pendingSubsEarliestMinute?: number
    crowd?: {
      attendance?: number
      passion?: number
      fans?: import('./types').FanState
    }
  },
): LayeredMatchOutput {
  const involvesHuman =
    !!humanCtx &&
    (fixture.homeClubId === humanCtx.humanClubId || fixture.awayClubId === humanCtx.humanClubId)

  return simulateLayeredMatch(fixture, clubs, players, tacticsByClub, {
    seedExtra,
    humanDynamicsBonus,
    referee,
    humanCtx,
    humanClubId: humanCtx?.humanClubId,
    teamTalk: extras?.teamTalk,
    pendingShouts: extras?.pendingShouts,
    fidelity: extras?.fidelity ?? (involvesHuman ? 'human' : 'ai'),
    phase: extras?.phase ?? 'full',
    resume: extras?.resume,
    pauseAtMinute: extras?.pauseAtMinute,
    pendingHumanSubs: extras?.pendingHumanSubs,
    pendingSubsEarliestMinute: extras?.pendingSubsEarliestMinute,
    crowd: extras?.crowd,
  })
}

export function applyMatchFatigue(
  players: Player[],
  tactics: Tactics,
  played: boolean,
  injuryMult = 1,
): Player[] {
  if (!played) return players
  const xi = new Set(tactics.startingXi)
  return players.map((p) => {
    if (!xi.has(p.id) && !tactics.bench.includes(p.id)) {
      let next = {
        ...p,
        condition: Math.min(100, p.condition + 4),
        sharpness: Math.max(30, p.sharpness - 1),
      }
      next = applyMatchWear(next, 'unused')
      return next
    }
    if (!xi.has(p.id)) {
      // ตัวสำรองที่ไม่ได้ลง — พักฟื้นเบา
      let next = {
        ...p,
        condition: Math.min(100, p.condition + 2),
        sharpness: Math.max(30, p.sharpness - 0.5),
      }
      next = applyMatchWear(next, 'unused')
      return next
    }
    const drop = 6 + Math.floor(Math.random() * 6)
    let next = {
      ...p,
      condition: Math.max(45, p.condition - drop),
      sharpness: Math.min(100, p.sharpness + 3),
      form: Math.min(20, Math.max(1, p.form + (Math.random() > 0.5 ? 1 : -1))),
      minutesPlayed: p.minutesPlayed + 90,
    }
    next = applyMatchWear(next, 'starter')
    const wearBonus = bodyWearInjuryBonus(next)
    if (
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
