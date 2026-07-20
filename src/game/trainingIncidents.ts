/**
 * เหตุการณ์ตอนซ้อม — ทะเลาะ · ปะทะ · ซีเนียร์แทรก · พี่เลี้ยง
 */
import type { DynamicsState, Player, Tactics, TrainingFocus, TrainingState } from './types'
import { applyInjury } from './medical'
import {
  isSquadSenior,
  listSquadSeniors,
  seniorEscalates,
  seniorInterveneChance,
  youthNeedsSenior,
} from './squadSeniors'
import { scaleStaminaLoss } from './playerStamina'

export type TrainingIncidentKind =
  | 'argument'
  | 'fight'
  | 'senior_calm'
  | 'senior_escalate'
  | 'mentor_boost'
  | 'senior_lecture'

export interface TrainingIncident {
  kind: TrainingIncidentKind
  text: string
  playerIds: string[]
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function mulberry(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pickTwo(pool: Player[], rng: () => number): [Player, Player] | null {
  if (pool.length < 2) return null
  const i = Math.floor(rng() * pool.length)
  let j = Math.floor(rng() * (pool.length - 1))
  if (j >= i) j += 1
  return [pool[i]!, pool[j]!]
}

function hotHeadScore(p: Player): number {
  return (
    (20 - (p.growth?.professionalism ?? 10)) * 1.2 +
    (p.hidden?.dirtiness ?? 10) * 0.8 +
    (p.growth?.ambition ?? 10) * 0.35 +
    (p.condition < 55 ? 8 : 0) +
    (p.morale <= 8 ? 6 : 0)
  )
}

/**
 * รันหลังซ้อม — ทะเลาะ/ปะทะ + อิทธิพลซีเนียร์ + บูสต์พี่เลี้ยง
 */
export function resolveTrainingIncidents(
  players: Player[],
  clubId: string,
  opts: {
    training: TrainingState
    focus: TrainingFocus
    tactics?: Tactics | null
    dynamics: DynamicsState
    matchday: number
    season?: number
  },
): {
  players: Player[]
  dynamics: DynamicsState
  incidents: TrainingIncident[]
  noteLines: string[]
} {
  const rng = mulberry(
    (opts.season ?? 1) * 10_000 + opts.matchday * 97 + clubId.length * 13 + opts.focus.length * 3,
  )
  const squad = players.filter((p) => p.clubId === clubId)
  const active = squad.filter(
    (p) =>
      p.injuryDays <= 0 &&
      (p.illnessDays ?? 0) <= 0 &&
      (p.banMatches ?? 0) <= 0 &&
      (p.leaveDays ?? 0) <= 0,
  )
  const seniors = listSquadSeniors(active, opts.tactics, 5)
  const incidents: TrainingIncident[] = []
  const byId = new Map(players.map((p) => [p.id, { ...p }]))

  let cohesion = opts.dynamics.cohesion
  let hierarchy = opts.dynamics.hierarchyStability
  let mood = opts.dynamics.dressingRoomMood

  const intensity = opts.training.intensity
  const intensityMul = intensity === 'high' ? 1.45 : intensity === 'low' ? 0.55 : 1
  const restMul = opts.focus === 'rest' ? 0.25 : 1
  const tenseMul = cohesion < 45 ? 1.4 : cohesion > 75 ? 0.65 : 1

  // ——— พี่เลี้ยง / ซีเนียร์คุยกับดาวรุ่ง ———
  for (const youth of active.filter(youthNeedsSenior)) {
    if (rng() > 0.22 * (opts.focus === 'rest' ? 1.2 : 1)) continue
    const mentor = youth.mentorId ? byId.get(youth.mentorId) : null
    const senior =
      mentor && mentor.clubId === clubId
        ? mentor
        : seniors[0]?.player && seniors[0]!.player.id !== youth.id
          ? seniors[0]!.player
          : null
    if (!senior || senior.id === youth.id) continue
    const y = byId.get(youth.id)!
    const learn = (y.growth?.learningRate ?? 10) / 20
    byId.set(youth.id, {
      ...y,
      sharpness: clamp(y.sharpness + 1 + (learn > 0.6 ? 1 : 0), 30, 100),
      morale: clamp(y.morale + 1, 1, 20),
      happiness: clamp((y.happiness ?? y.morale) + 1, 1, 20),
    })
    const kind: TrainingIncidentKind = mentor?.id === senior.id ? 'mentor_boost' : 'senior_lecture'
    const text =
      kind === 'mentor_boost'
        ? `${senior.name} (พี่เลี้ยง) ดึง ${youth.name} ซ้อมเพิ่ม — ดาวรุ่งโฟกัสขึ้น`
        : `ซีเนียร์ ${senior.name} สั่งสอน ${youth.name} หลังซ้อม`
    incidents.push({ kind, text, playerIds: [senior.id, youth.id] })
    hierarchy = clamp(hierarchy + 1, 0, 100)
    if (incidents.filter((i) => i.kind === 'mentor_boost' || i.kind === 'senior_lecture').length >= 2)
      break
  }

  // ——— ทะเลาะ / ปะทะ ———
  if (opts.focus !== 'rest' || rng() < 0.15) {
    let conflictChance =
      0.08 * intensityMul * restMul * tenseMul + (100 - mood) / 500 + (100 - cohesion) / 400
    // ฟิตสูง / แท็กเคิลในซ้อมรับ-รุก
    if (opts.focus === 'fitness' || opts.focus === 'defending') conflictChance += 0.04
    if (opts.focus === 'attacking') conflictChance += 0.02

    if (rng() < Math.min(0.42, conflictChance)) {
      const hot = [...active].sort((a, b) => hotHeadScore(b) - hotHeadScore(a)).slice(0, 8)
      const pair = pickTwo(hot.length >= 2 ? hot : active, rng)
      if (pair) {
        const [a, b] = pair
        const fight =
          intensity === 'high' &&
          rng() < 0.35 + (hotHeadScore(a) + hotHeadScore(b)) / 120
        const kind: TrainingIncidentKind = fight ? 'fight' : 'argument'
        let text = fight
          ? `${a.name} กับ ${b.name} ปะทะกันแรงในสนามซ้อม!`
          : `${a.name} ทะเลาะกับ ${b.name} ตอนซ้อม「${opts.focus}」`

        let pa = byId.get(a.id)!
        let pb = byId.get(b.id)!
        const hitA = scaleStaminaLoss(fight ? 6 : 3, pa.attrs?.stamina ?? 70)
        const hitB = scaleStaminaLoss(fight ? 6 : 3, pb.attrs?.stamina ?? 70)
        pa = {
          ...pa,
          condition: clamp(pa.condition - hitA, 28, 100),
          morale: clamp(pa.morale - (fight ? 2 : 1), 1, 20),
          happiness: clamp((pa.happiness ?? pa.morale) - (fight ? 2 : 1), 1, 20),
        }
        pb = {
          ...pb,
          condition: clamp(pb.condition - hitB, 28, 100),
          morale: clamp(pb.morale - (fight ? 2 : 1), 1, 20),
          happiness: clamp((pb.happiness ?? pb.morale) - (fight ? 2 : 1), 1, 20),
        }

        // ปะทะอาจเจ็บเล็กน้อย
        if (fight && rng() < 0.28) {
          const victim = rng() < 0.5 ? pa : pb
          const injured = applyInjury(victim, 'training', rng)
          if (victim.id === pa.id) pa = injured
          else pb = injured
          text += ` · ${injured.name} เจ็บจากจังหวะนั้น`
        }

        cohesion = clamp(cohesion - (fight ? 8 : 4), 0, 100)
        mood = clamp(mood - (fight ? 7 : 3), 0, 100)
        hierarchy = clamp(hierarchy - (fight ? 3 : 1), 0, 100)

        // ซีเนียร์เข้าแทรก
        const intervening = seniors.find(
          (s) => s.player.id !== a.id && s.player.id !== b.id && rng() < seniorInterveneChance(s.player),
        )
        if (intervening) {
          const s = intervening.player
          if (seniorEscalates(s, rng)) {
            text += ` · ${s.name} (ซีเนียร์) เข้าไปแล้วเรื่องใหญ่ขึ้น!`
            incidents.push({
              kind: 'senior_escalate',
              text: `${s.name} เข้าข้างฝ่ายหนึ่ง — บรรยากาศแย่ลง`,
              playerIds: [s.id, a.id, b.id],
            })
            cohesion = clamp(cohesion - 3, 0, 100)
            hierarchy = clamp(hierarchy - 4, 0, 100)
            const hs = byId.get(s.id)!
            byId.set(s.id, {
              ...hs,
              morale: clamp(hs.morale - 1, 1, 20),
            })
          } else {
            text += ` · ซีเนียร์ ${s.name} เข้าห้าม — สงบได้`
            incidents.push({
              kind: 'senior_calm',
              text: `${s.name} รวบรวมน้องๆ หลังซ้อม — ลำดับชั้นมั่นคงขึ้น`,
              playerIds: [s.id, a.id, b.id],
            })
            cohesion = clamp(cohesion + 3, 0, 100)
            hierarchy = clamp(hierarchy + 4, 0, 100)
            mood = clamp(mood + 2, 0, 100)
            pa = { ...pa, morale: clamp(pa.morale + 1, 1, 20) }
            pb = { ...pb, morale: clamp(pb.morale + 1, 1, 20) }
          }
        }

        // ดาวรุ่ง vs ซีเนียร์ — กระทบลำดับชั้นแรง
        const aSen = isSquadSenior(a, seniors)
        const bSen = isSquadSenior(b, seniors)
        if (aSen !== bSen) {
          hierarchy = clamp(hierarchy - 5, 0, 100)
          text += ' · รุ่นพี่/รุ่นน้องขัดแย้ง'
        }

        byId.set(a.id, pa)
        byId.set(b.id, pb)
        incidents.unshift({ kind, text, playerIds: [a.id, b.id] })
      }
    }
  }

  // ซีเนียร์ไม่พอใจซ้อมหนักเกินไป
  if (intensity === 'high' && opts.focus !== 'rest' && seniors[0] && rng() < 0.18) {
    const s = seniors[0].player
    const sp = byId.get(s.id)!
    byId.set(s.id, {
      ...sp,
      morale: clamp(sp.morale - 1, 1, 20),
      happiness: clamp((sp.happiness ?? sp.morale) - 1, 1, 20),
    })
    incidents.push({
      kind: 'argument',
      text: `ซีเนียร์ ${s.name} บ่นซ้อมหนักเกินไป — ขอให้สตาฟลดความเข้ม`,
      playerIds: [s.id],
    })
    mood = clamp(mood - 2, 0, 100)
  }

  const nextPlayers = players.map((p) => byId.get(p.id) ?? p)
  const noteLines = incidents.map((i) => i.text)
  const seniorNames = seniors.slice(0, 3).map((s) => s.player.name)
  if (seniorNames.length && rng() < 0.35 && noteLines.length === 0) {
    noteLines.push(`แกนซีเนียร์ (${seniorNames.join(', ')}) คุมจังหวะห้องซ้อมได้ดี`)
    hierarchy = clamp(hierarchy + 1, 0, 100)
  }

  return {
    players: nextPlayers,
    dynamics: {
      ...opts.dynamics,
      cohesion: clamp(cohesion, 0, 100),
      hierarchyStability: clamp(hierarchy, 0, 100),
      dressingRoomMood: clamp(mood, 0, 100),
      lastNote:
        noteLines[0] ??
        (seniors[0]
          ? `ซีเนียร์นำโดย ${seniors[0].player.name} · ห้องซ้อม${cohesion >= 70 ? 'สามัคคี' : 'ปกติ'}`
          : opts.dynamics.lastNote),
    },
    incidents,
    noteLines,
  }
}
