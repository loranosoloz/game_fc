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
import { simulateLayeredMatch } from './match/simulateMatch'
import type { TouchlineShout } from './match/touchlineShouts'
import type { MatchMidState } from './match/halfTime'
import type { LayeredMatchOutput } from './match/simulateMatch'
import { applyPersistentMatchStamina } from './playerStamina'

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
      manManagement: number
      adaptability: number
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
    stadiumVisitors?: import('./types').StadiumVisit[]
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
    stadiumVisitors: extras?.stadiumVisitors,
  })
}

export function applyMatchFatigue(
  players: Player[],
  tactics: Tactics,
  played: boolean,
  injuryMult = 1,
  extras?: {
    minutesById?: Record<string, number>
    finalConditions?: Record<string, number>
    ratings?: Array<{ playerId: string; minutes: number }>
    clubId?: string
  },
): Player[] {
  return applyPersistentMatchStamina(players, tactics, {
    played,
    injuryMult,
    minutesById: extras?.minutesById,
    finalConditions: extras?.finalConditions,
    ratings: extras?.ratings,
    clubId: extras?.clubId,
  })
}
