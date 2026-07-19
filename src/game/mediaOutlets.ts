import outletsDb from '@/data/mediaOutlets.json'
import type { LeagueId } from '@/data/world'
import type { GameSave } from './types'

export interface MediaOutlet {
  id: string
  name: string
  style: string
}

const BY_LEAGUE = outletsDb.byLeague as Record<string, MediaOutlet[]>
const TALK = outletsDb.talkShows as Record<string, string[]>

export function leagueIdOfSave(save: GameSave): LeagueId {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const lid = save.leagueId || club?.originLeagueId
  if (lid && BY_LEAGUE[lid]) return lid as LeagueId
  return 'eng'
}

export function outletsForLeague(leagueId: string): MediaOutlet[] {
  return BY_LEAGUE[leagueId] ?? BY_LEAGUE.eng
}

export function pickOutlet(save: GameSave, salt = 0): MediaOutlet {
  const list = outletsForLeague(leagueIdOfSave(save))
  const i = Math.abs(save.matchday * 17 + save.season * 3 + salt) % list.length
  return list[i]!
}

export function pickTalkShow(save: GameSave, salt = 0): string {
  const list = TALK[leagueIdOfSave(save)] ?? TALK.eng
  const i = Math.abs(save.matchday * 11 + salt) % list.length
  return list[i]!
}

export function allOutletsFlat(): MediaOutlet[] {
  return Object.values(BY_LEAGUE).flat()
}
