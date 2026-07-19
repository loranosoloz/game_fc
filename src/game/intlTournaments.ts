/**
 * จำลองทัวร์นาเมนต์ทีมชาติแบบย่อ (WC / ยูโร / ทวีป / อุ่นเครื่อง)
 * — ไม่ใช่โหมดคุมชาติเต็มรูป แต่มีผลแคป · ล้า · เจ็บ · ข่าว
 */
import type { GameSave } from './types'
import type { IntlTournamentEvent } from './seasonCalendar'
import { allAssociationNations, ensureAssociations } from './associations'
import { ntTeam, normalizeNation, applyNtCaps, playerNationality } from './nationalTeams'
import { pushNews } from './media'
import { pickOutlet } from './mediaOutlets'
import { runWorldCupFinals } from './worldCup'
import {
  applyNationTournamentReputation,
  applyTournamentPlayerFame,
  bumpClubReputation,
} from './reputation'

export interface IntlMatchResultLite {
  home: string
  away: string
  homeTh: string
  awayTh: string
  hg: number
  ag: number
  stage: string
}

export interface IntlTournamentReport {
  eventId: string
  labelTh: string
  year: number
  champion: string
  championTh: string
  matches: IntlMatchResultLite[]
  humanClubPlayersAffected: number
  note: string
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function nationStrength(save: GameSave, nation: string): number {
  const n = normalizeNation(nation) ?? nation
  const players = save.players.filter((p) => playerNationality(p, save) === n)
  if (players.length === 0) {
    const assoc = save.associations?.[n]
    return assoc ? Math.max(55, 100 - assoc.fifaRank * 0.45) : 62
  }
  const top = [...players].sort((a, b) => b.overall - a.overall).slice(0, 16)
  return top.reduce((s, p) => s + p.overall, 0) / top.length
}

function labelThOf(nation: string): string {
  return ntTeam(nation)?.labelTh ?? nation
}

function pickNationsForEvent(
  save: GameSave,
  event: IntlTournamentEvent,
  count: number,
  rng: () => number,
): string[] {
  let pool = allAssociationNations()
  if (event.confederation === 'UEFA') {
    pool = pool.filter((n) =>
      [
        'England',
        'Spain',
        'Germany',
        'France',
        'Italy',
        'Portugal',
        'Netherlands',
        'Belgium',
        'Croatia',
        'Switzerland',
        'Denmark',
        'Austria',
        'Scotland',
        'Wales',
        'Poland',
        'Serbia',
        'Turkey',
        'Sweden',
        'Norway',
        'Greece',
      ].includes(n),
    )
  } else if (event.confederation === 'AFC') {
    pool = pool.filter((n) =>
      ['Japan', 'Korea Republic', 'Australia', 'Saudi Arabia', 'Iran', 'Thailand', 'Qatar'].includes(
        n,
      ) || n.includes('Korea') || n === 'Japan' || n === 'Thailand' || n === 'Australia',
    )
  } else if (event.confederation === 'CONMEBOL') {
    pool = pool.filter((n) =>
      ['Brazil', 'Argentina', 'Uruguay', 'Colombia', 'Chile', 'Ecuador', 'Peru'].includes(n),
    )
  } else if (event.confederation === 'CAF') {
    pool = pool.filter((n) =>
      ['Morocco', 'Senegal', 'Egypt', 'Nigeria', 'Cameroon', 'Ghana', 'Algeria'].includes(n),
    )
  } else if (event.confederation === 'CONCACAF') {
    pool = pool.filter((n) =>
      ['USA', 'United States', 'Mexico', 'Canada', 'Costa Rica', 'Jamaica'].includes(n),
    )
  }

  if (pool.length < 4) pool = allAssociationNations()

  const scored = pool
    .map((n) => ({ n, s: nationStrength(save, n) + rng() * 8 }))
    .sort((a, b) => b.s - a.s)

  const take = Math.min(count, scored.length)
  const picked = scored.slice(0, take).map((x) => x.n)
  // สุ่มสลับในครึ่งบนเล็กน้อย
  for (let i = picked.length - 1; i > 0; i--) {
    if (rng() < 0.35) {
      const j = Math.floor(rng() * (i + 1))
      ;[picked[i], picked[j]] = [picked[j]!, picked[i]!]
    }
  }
  return picked
}

function simMatch(
  save: GameSave,
  home: string,
  away: string,
  rng: () => number,
  stage: string,
): IntlMatchResultLite {
  const hs = nationStrength(save, home)
  const as_ = nationStrength(save, away)
  const hp = hs / (hs + as_)
  let hg = 0
  let ag = 0
  for (let i = 0; i < 4; i++) {
    if (rng() < hp * 0.42) hg++
    if (rng() < (1 - hp) * 0.42) ag++
  }
  if (hg === ag && (stage.includes('Knock') || stage.includes('Final') || stage.includes('SF'))) {
    if (rng() < hp) hg++
    else ag++
  }
  return {
    home,
    away,
    homeTh: labelThOf(home),
    awayTh: labelThOf(away),
    hg,
    ag,
    stage,
  }
}

/** เรียกนักเตะคลับผู้เล่นไปทัวร์นาเมนต์ + จำลองผลแบบย่อ */
export function runSummerIntlTournaments(save: GameSave): {
  save: GameSave
  reports: IntlTournamentReport[]
} {
  let next = ensureAssociations(save)
  const events = next.seasonCalendar?.summerEvents ?? []
  if (events.length === 0) return { save: next, reports: [] }

  const reports: IntlTournamentReport[] = []
  let players = next.players.slice()
  const humanId = next.humanClubId

  for (const event of events) {
    const rng = mulberry32(next.season * 997 + event.id.length * 131 + event.year)

    // ฟุตบอลโลก 32 ทีม — เฉพาะปีชิงหลังคัดเลือก ~2 ปี
    if (event.kind === 'world_cup') {
      const wc = runWorldCupFinals(next, event.year)
      if (!wc) {
        next = {
          ...next,
          inbox: [
            {
              id: `msg-wc-skip-${event.year}-${Date.now()}`,
              date: next.currentDate,
              title: `ฟุตบอลโลก ${event.year} — ยังไม่เข้า 32 ทีม`,
              body:
                next.worldCup?.note ??
                `ต้องคัดเลือกตามทวีป ~2 ปีก่อน · เป้าปัจจุบันฟุตบอลโลก ${next.worldCup?.finalsYear ?? '—'}`,
              read: false,
            },
            ...next.inbox,
          ].slice(0, 45),
        }
        continue
      }
      next = wc.save
      players = next.players.slice()
      reports.push(wc.report)
      continue
    }

    const isFriendly = event.kind === 'friendly'
    const fieldSize = isFriendly ? 8 : 12
    const nations = pickNationsForEvent(next, event, fieldSize, rng)
    const matches: IntlMatchResultLite[] = []

    // เรียกตัวจากคลับผู้เล่นที่สัญชาติอยู่ในทัวร์
    const nationSet = new Set(nations.map((n) => normalizeNation(n) ?? n))
    let affected = 0
    const callRecords: {
      playerId: string
      playerName: string
      nation: string
      nationTh: string
      coachName: string
      clubId: string
      clubName: string
      score: number
      reasons: string[]
      firstCap: boolean
      styleFit: number
    }[] = []

    players = players.map((p) => {
      const nat = playerNationality(p, next)
      if (!nationSet.has(nat)) return p
      if (p.overall < 68 && rng() > 0.35) return p
      if (p.clubId === humanId) affected += 1
      const leave = Math.min(event.weeks, isFriendly ? 1 : event.weeks)
      const injure = !isFriendly && rng() < 0.06
      callRecords.push({
        playerId: p.id,
        playerName: p.name,
        nation: nat,
        nationTh: labelThOf(nat),
        coachName: 'NT',
        clubId: p.clubId,
        clubName: next.clubs.find((c) => c.id === p.clubId)?.shortName ?? '',
        score: p.overall,
        reasons: [`ติดโผ${event.labelTh}`],
        firstCap: (p.ntCaps ?? 0) < 1,
        styleFit: 1,
      })
      return {
        ...p,
        leaveDays: Math.max(p.leaveDays ?? 0, leave),
        condition: clamp(p.condition - (isFriendly ? 4 : 10 + rng() * 8), 25, 100),
        sharpness: clamp(p.sharpness + (isFriendly ? 1 : 3), 1, 100),
        morale: clamp(p.morale + 1, 1, 20),
        injuryDays: injure ? Math.max(p.injuryDays, 5 + Math.floor(rng() * 10)) : p.injuryDays,
        injuryType: injure ? p.injuryType ?? ('muscle' as const) : p.injuryType,
      }
    })
    players = applyNtCaps(players, callRecords)

    // จำลองน็อคเอาต์ย่อ
    let remaining = nations.slice()
    let round = 1
    while (remaining.length >= 2) {
      const nextRound: string[] = []
      const stage =
        remaining.length === 2
          ? 'Final'
          : remaining.length <= 4
            ? 'SF'
            : remaining.length <= 8
              ? 'QF'
              : `R${remaining.length}`
      for (let i = 0; i + 1 < remaining.length; i += 2) {
        const m = simMatch(next, remaining[i]!, remaining[i + 1]!, rng, stage)
        matches.push(m)
        nextRound.push(m.hg >= m.ag ? m.home : m.away)
      }
      if (remaining.length % 2 === 1) nextRound.push(remaining[remaining.length - 1]!)
      remaining = nextRound
      round++
      if (round > 8) break
    }

    const champion = remaining[0] ?? nations[0]!
    const finalMatch = [...matches].reverse().find((m) => m.stage === 'Final')
    const runnerUp = finalMatch
      ? finalMatch.hg >= finalMatch.ag
        ? finalMatch.away
        : finalMatch.home
      : null
    const semis = matches
      .filter((m) => m.stage === 'SF')
      .flatMap((m) => [m.home, m.away])
      .filter((n) => n !== champion && n !== runnerUp)

    const report: IntlTournamentReport = {
      eventId: event.id,
      labelTh: event.labelTh,
      year: event.year,
      champion,
      championTh: labelThOf(champion),
      matches: matches.slice(-12),
      humanClubPlayersAffected: affected,
      note: isFriendly
        ? 'อุ่นเครื่องทีมชาติ — ล้าเล็กน้อย'
        : `${event.labelTh} ${event.year} · แชมป์ ${labelThOf(champion)}`,
    }
    reports.push(report)

    if (!isFriendly) {
      next = applyNationTournamentReputation(next, champion, runnerUp, semis)
      const fameMult =
        event.kind === 'continental' || event.kind === 'euros' || event.kind === 'copa'
          ? 1.35
          : event.kind === 'asian_cup' || event.kind === 'afcon'
            ? 1.25
            : 1.1
      players = applyTournamentPlayerFame(
        { ...next, players },
        callRecords.map((c) => c.playerId),
        { championNation: champion, multiplier: fameMult },
      )
      const champPlayerClubs = new Set(
        players
          .filter((p) => callRecords.some((c) => c.playerId === p.id && c.nation === champion))
          .map((p) => p.clubId),
      )
      next = {
        ...next,
        clubs: next.clubs.map((c) =>
          champPlayerClubs.has(c.id) ? bumpClubReputation(c, 1) : c,
        ),
      }
    }

    next = pushNews(next, {
      id: `news-intl-${event.id}-${event.year}`,
      date: next.currentDate,
      channel: 'news',
      headline: `${event.labelTh} ${event.year}: แชมป์ ${labelThOf(champion)}`,
      body: report.note + (affected ? ` · นักเตะคลับคุณไป ${affected} คน` : ''),
      tone: 'neutral',
      tags: ['international', event.id],
      subjectName: labelThOf(champion),
      outlet: pickOutlet(next, 3).name,
    })
  }

  next = {
    ...next,
    players,
    lastIntlTournamentReports: reports,
    inbox: [
      {
        id: `msg-intl-summer-${Date.now()}`,
        date: next.currentDate,
        title: 'สรุปทัวร์นาเมนต์ทีมชาติ (ฤดูร้อน)',
        body: reports
          .map(
            (r) =>
              `${r.labelTh}: แชมป์ ${r.championTh}` +
              (r.humanClubPlayersAffected
                ? ` · ลูกทีมคุณไป ${r.humanClubPlayersAffected} คน`
                : ''),
          )
          .join('\n'),
        read: false,
      },
      ...next.inbox,
    ].slice(0, 45),
  }

  return { save: next, reports }
}

/** FIFA window สั้น — อุ่นเครื่อง/เนชันส์ลีกย่อ (ผลต่อนักเตะที่ถูกเรียก) */
export function applyIntlBreakMatchWear(save: GameSave): GameSave {
  const br = save.internationalBreak
  if (!br || br.weeksLeft <= 0) return save
  const called = new Set(br.calledUpIds)
  if (called.size === 0) return save
  const rng = mulberry32(save.season * 44 + save.matchday * 9 + br.weeksLeft)
  const players = save.players.map((p) => {
    if (!called.has(p.id)) return p
    const injure = rng() < 0.04
    return {
      ...p,
      condition: clamp(p.condition - (4 + rng() * 6), 30, 100),
      sharpness: clamp(p.sharpness + 2, 1, 100),
      injuryDays: injure ? Math.max(p.injuryDays, 3 + Math.floor(rng() * 8)) : p.injuryDays,
      injuryType: injure ? (p.injuryType ?? ('muscle' as const)) : p.injuryType,
    }
  })
  return { ...save, players }
}
