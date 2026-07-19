import pack from '@/data/referees.json'
import type { CompetitionKind, Fixture, Referee } from './types'

function hashStr(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** homeBias 1–20 จาก id ถ้าไม่มีใน data */
function deriveHomeBias(id: string, raw?: number): number {
  if (typeof raw === 'number' && raw >= 1 && raw <= 20) return Math.round(raw)
  return 5 + (hashStr(id) % 12) // 5–16
}

export const REFEREES: Referee[] = pack.referees.map((r) => ({
  id: r.id,
  name: r.name,
  nation: r.nation,
  reputation: r.reputation,
  strictness: r.strictness,
  homeBias: deriveHomeBias(r.id, (r as { homeBias?: number }).homeBias),
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

export function homeBiasLabel(homeBias: number): string {
  if (homeBias >= 16) return 'เอียงเจ้าบ้านชัด'
  if (homeBias >= 13) return 'เอียงเจ้าบ้านเล็กน้อย'
  if (homeBias <= 7) return 'เข้มกับเจ้าบ้าน'
  return 'กลาง'
}

export function reputationLabel(reputation: number): string {
  if (reputation >= 18) return 'Elite'
  if (reputation >= 15) return 'FIFA'
  if (reputation >= 12) return 'Pro'
  return 'Domestic'
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
  return `ผู้ตัดสิน ${ref.name} (${reputationLabel(ref.reputation)} · ${strictnessLabel(ref.strictness)} · ${homeBiasLabel(ref.homeBias)})`
}
