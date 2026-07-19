import pack from '@/data/referees.json'
import type { CompetitionKind, Fixture, Referee } from './types'

export const REFEREES: Referee[] = pack.referees.map((r) => ({
  id: r.id,
  name: r.name,
  nation: r.nation,
  reputation: r.reputation,
  strictness: r.strictness,
}))

export function getReferee(id: string | undefined | null): Referee | undefined {
  if (!id) return undefined
  return REFEREES.find((r) => r.id === id)
}

export function strictnessLabel(strictness: number): string {
  if (strictness >= 16) return 'เข้มงวดมาก'
  if (strictness >= 13) return 'เข้มงวด'
  if (strictness >= 10) return 'ปกติ'
  return 'ผ่อนปรน'
}

export function reputationLabel(reputation: number): string {
  if (reputation >= 18) return 'Elite'
  if (reputation >= 15) return 'FIFA'
  if (reputation >= 12) return 'Pro'
  return 'Domestic'
}

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Prefer higher-rep refs for UCL/cup; still deterministic from fixture id. */
export function pickRefereeId(fixtureId: string, competition: CompetitionKind): string {
  const minRep =
    competition === 'ucl' || competition === 'uel' || competition === 'uecl'
      ? 15
      : competition === 'cup'
        ? 12
        : 1
  const pool = REFEREES.filter((r) => r.reputation >= minRep)
  const list = pool.length > 0 ? pool : REFEREES
  const idx = hashStr(fixtureId) % list.length
  return list[idx].id
}

export function assignRefereesToFixtures(fixtures: Fixture[]): Fixture[] {
  return fixtures.map((f) =>
    f.refereeId
      ? f
      : { ...f, refereeId: pickRefereeId(f.id, f.competition ?? 'league') },
  )
}

export function refereeKickoffNote(ref: Referee): string {
  return `ผู้ตัดสิน ${ref.name} (${reputationLabel(ref.reputation)} · ${strictnessLabel(ref.strictness)})`
}
