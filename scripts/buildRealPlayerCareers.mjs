/**
 * Build real player careers from Transfermarkt open dataset
 * (dcaribou/transfermarkt-datasets — appearances / transfers / intl).
 *
 * Prereq: CSVs in scripts/_tm_data/ (players, appearances, games, transfers, clubs, competitions)
 * Usage: node scripts/buildRealPlayerCareers.mjs
 *
 * Output: public/data/realPlayerCareers.json
 */
import fs from 'fs'
import path from 'path'
import zlib from 'zlib'
import readline from 'readline'
import { fileURLToPath } from 'url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const TM = path.join(ROOT, 'scripts', '_tm_data')
const OUT = path.join(ROOT, 'public', 'data', 'realPlayerCareers.json')
const HISTORY = path.join(ROOT, 'src', 'data', 'world', 'worldHistory.json')

const ROSTER_FILES = [
  'playersEng.json',
  'playersEsp.json',
  'playersGer.json',
  'playersIta.json',
  'playersFra.json',
  'playersTha.json',
  'playersEng2.json',
  'playersEsp2.json',
  'playersGer2.json',
  'playersIta2.json',
  'playersFra2.json',
  'playersTha2.json',
]

const WC_COMP = new Set(['FIWC'])
const EURO_COMP = new Set(['EURO'])
/** แข่งขันทีมชาติ — ไม่นับเป็นฤดูกาลสโมสร */
const INTL_COMP = new Set(['FIWC', 'EURO', 'COPA', 'AFAC', 'AFCN'])
const MAJOR_INTL = {
  EURO: { name: 'UEFA Euro', nameTh: 'ยูโร' },
  COPA: { name: 'Copa América', nameTh: 'โกปา อเมริกา' },
  AFAC: { name: 'AFC Asian Cup', nameTh: 'เอเชียนคัพ' },
  AFCN: { name: 'AFCON', nameTh: 'แอฟริกา คัพ ออฟ เนชันส์' },
}

function normalize(name) {
  return String(name || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[''`]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

function seasonLabel(endYear) {
  return `${endYear - 1}/${String(endYear).slice(2)}`
}

function parseCsvLine(line) {
  const out = []
  let cur = ''
  let q = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"'
        i++
      } else q = !q
      continue
    }
    if (c === ',' && !q) {
      out.push(cur)
      cur = ''
      continue
    }
    cur += c
  }
  out.push(cur)
  return out
}

async function* readGzipCsv(file) {
  const stream = fs.createReadStream(file).pipe(zlib.createGunzip())
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })
  let headers = null
  for await (const line of rl) {
    if (!line) continue
    const cols = parseCsvLine(line)
    if (!headers) {
      headers = cols
      continue
    }
    const row = {}
    for (let i = 0; i < headers.length; i++) row[headers[i]] = cols[i] ?? ''
    yield row
  }
}

function collectRosterNames() {
  const names = new Set()
  for (const f of ROSTER_FILES) {
    const p = path.join(ROOT, 'src', 'data', 'world', f)
    if (!fs.existsSync(p)) continue
    const json = JSON.parse(fs.readFileSync(p, 'utf8'))
    const clubs = json.clubs || json
    for (const arr of Object.values(clubs)) {
      if (!Array.isArray(arr)) continue
      for (const pl of arr) {
        if (pl?.name) names.add(pl.name)
      }
    }
  }
  return [...names]
}

function pickBestPlayer(candidates) {
  return candidates.sort((a, b) => {
    const ls = (Number(b.last_season) || 0) - (Number(a.last_season) || 0)
    if (ls) return ls
    return (Number(b.market_value_in_eur) || 0) - (Number(a.market_value_in_eur) || 0)
  })[0]
}

async function main() {
  console.log('Collecting roster names…')
  const rosterNames = collectRosterNames()
  const wantNorm = new Map()
  for (const n of rosterNames) {
    const k = normalize(n)
    if (!wantNorm.has(k)) wantNorm.set(k, n)
  }
  console.log(`Roster players: ${rosterNames.length}`)

  console.log('Indexing Transfermarkt players…')
  /** @type {Map<string, any[]>} */
  const byNorm = new Map()
  let tmCount = 0
  for await (const row of readGzipCsv(path.join(TM, 'players.csv.gz'))) {
    tmCount++
    const n = normalize(row.name)
    if (!wantNorm.has(n)) continue
    if (!byNorm.has(n)) byNorm.set(n, [])
    byNorm.get(n).push(row)
  }
  console.log(`TM players scanned: ${tmCount}, name hits: ${byNorm.size}`)

  /** @type {Map<string, any>} name -> matched TM player */
  const matched = new Map()
  /** @type {Map<string, string>} tmId -> game name */
  const idToName = new Map()
  for (const [norm, gameName] of wantNorm) {
    const cands = byNorm.get(norm)
    if (!cands?.length) continue
    const best = pickBestPlayer(cands)
    matched.set(gameName, best)
    idToName.set(String(best.player_id), gameName)
  }
  console.log(`Matched: ${matched.size} / ${rosterNames.length}`)

  const targetIds = new Set(idToName.keys())

  console.log('Loading games (season map)…')
  /** @type {Map<string, { season: number, competition_id: string }>} */
  const games = new Map()
  for await (const row of readGzipCsv(path.join(TM, 'games.csv.gz'))) {
    if (!row.game_id) continue
    games.set(String(row.game_id), {
      season: Number(row.season) || 0,
      competition_id: row.competition_id || '',
    })
  }
  console.log(`Games: ${games.size}`)

  console.log('Loading clubs…')
  const clubs = new Map()
  for await (const row of readGzipCsv(path.join(TM, 'clubs.csv.gz'))) {
    clubs.set(String(row.club_id), row.name || row.club_code || String(row.club_id))
  }

  console.log('Aggregating appearances…')
  /** playerId -> Map seasonKey -> agg */
  const seasonAgg = new Map()
  /** playerId -> WC / major intl bags */
  const intlBags = new Map()

  let appRows = 0
  for await (const row of readGzipCsv(path.join(TM, 'appearances.csv.gz'))) {
    const pid = String(row.player_id)
    if (!targetIds.has(pid)) continue
    appRows++
    const g = games.get(String(row.game_id))
    const seasonStart = g?.season || (row.date ? Number(String(row.date).slice(0, 4)) : 0)
    if (!seasonStart) continue
    const clubId = String(row.player_club_id || '')
    const clubName = clubs.get(clubId) || null
    const comp = row.competition_id || g?.competition_id || ''
    const goals = Number(row.goals) || 0
    const assists = Number(row.assists) || 0
    const mins = Number(row.minutes_played) || 0
    const yellows = Number(row.yellow_cards) || 0
    const reds = Number(row.red_cards) || 0
    const dateYear = row.date ? Number(String(row.date).slice(0, 4)) : seasonStart

    // ทีมชาติ / ทัวร์นาเมนต์นานาชาติ → intl เท่านั้น
    if (INTL_COMP.has(comp)) {
      if (!intlBags.has(pid)) intlBags.set(pid, { wc: new Map(), majors: new Map() })
      const intl = intlBags.get(pid)
      if (WC_COMP.has(comp)) {
        const e = intl.wc.get(dateYear) || { year: dateYear, apps: 0, goals: 0, assists: 0 }
        e.apps += 1
        e.goals += goals
        e.assists += assists
        intl.wc.set(dateYear, e)
      } else if (MAJOR_INTL[comp]) {
        const mk = `${comp}|${dateYear}`
        const meta = MAJOR_INTL[comp]
        const e = intl.majors.get(mk) || {
          year: dateYear,
          name: meta.name,
          nameTh: meta.nameTh,
          apps: 0,
          goals: 0,
        }
        e.apps += 1
        e.goals += goals
        intl.majors.set(mk, e)
      }
      continue
    }

    // สโมสรที่ไม่รู้จักใน clubs.csv (เช่น ทีมชาติ / ข้อมูลผิด) — ข้าม
    if (!clubName) continue

    if (!seasonAgg.has(pid)) seasonAgg.set(pid, new Map())
    const key = `${seasonStart}|${clubName}`
    const bag = seasonAgg.get(pid)
    const cur = bag.get(key) || {
      seasonStart,
      clubName,
      clubId,
      apps: 0,
      goals: 0,
      assists: 0,
      minutes: 0,
      yellows: 0,
      reds: 0,
    }
    cur.apps += 1
    cur.goals += goals
    cur.assists += assists
    cur.minutes += mins
    cur.yellows += yellows
    cur.reds += reds
    bag.set(key, cur)
  }
  console.log(`Appearance rows for matched players: ${appRows}`)

  console.log('Loading transfers…')
  const transfersById = new Map()
  for await (const row of readGzipCsv(path.join(TM, 'transfers.csv.gz'))) {
    const pid = String(row.player_id)
    if (!targetIds.has(pid)) continue
    if (!transfersById.has(pid)) transfersById.set(pid, [])
    const feeRaw = row.transfer_fee
    const feeNum = feeRaw === '' || feeRaw == null ? NaN : Number(feeRaw)
    const fee = Number.isFinite(feeNum) ? Math.round(feeNum) : null
    const year = row.transfer_date
      ? Number(String(row.transfer_date).slice(0, 4))
      : (() => {
          const part = String(row.transfer_season || '').split('/')[0]
          const n = Number(part)
          if (!Number.isFinite(n)) return 0
          return n < 100 ? 2000 + n : n
        })()
    transfersById.get(pid).push({
      year: Number.isFinite(year) ? year : 0,
      fromClub: row.from_club_name || '—',
      toClub: row.to_club_name || '—',
      feeEur: fee,
      kind: fee === 0 ? 'free' : 'transfer',
      noteTh: row.transfer_season ? `ฤดูกาล ${row.transfer_season}` : undefined,
    })
  }

  let history = { timeline: [], leagues: {}, players: [] }
  if (fs.existsSync(HISTORY)) {
    history = JSON.parse(fs.readFileSync(HISTORY, 'utf8'))
  }

  console.log('Building output…')
  const byName = {}
  let withApps = 0
  for (const [gameName, tm] of matched) {
    const pid = String(tm.player_id)
    const bags = seasonAgg.get(pid)
    /** merge to club+season totals (all comps) */
    const bySeasonClub = new Map()
    if (bags) {
      for (const row of bags.values()) {
        const k = `${row.seasonStart}|${row.clubName}`
        const cur = bySeasonClub.get(k) || {
          season: row.seasonStart + 1, // end-year convention
          label: `${row.seasonStart}/${String(row.seasonStart + 1).slice(2)}`,
          clubName: row.clubName,
          apps: 0,
          goals: 0,
          assists: 0,
          minutes: 0,
          yellows: 0,
          reds: 0,
        }
        cur.apps += row.apps
        cur.goals += row.goals
        cur.assists += row.assists
        cur.minutes += row.minutes
        cur.yellows += row.yellows
        cur.reds += row.reds
        bySeasonClub.set(k, cur)
      }
    }
    let seasons = [...bySeasonClub.values()].sort((a, b) => a.season - b.season || a.clubName.localeCompare(b.clubName))

    // กรองสโมสรที่นัดน้อยมาก (ข้อมูลผิด / นัดเดียว)
    const appsByClub = new Map()
    for (const s of seasons) appsByClub.set(s.clubName, (appsByClub.get(s.clubName) || 0) + s.apps)
    seasons = seasons.filter((s) => (appsByClub.get(s.clubName) || 0) >= 3)
    if (seasons.length) withApps++

    // club path — เรียงตามฤดูกาลที่ลงสนามครั้งแรก (ไม่ใช้ min year อย่างเดียว)
    const clubMeta = new Map()
    for (const s of seasons) {
      const prev = clubMeta.get(s.clubName) || {
        clubName: s.clubName,
        fromYear: s.season - 1,
        toYear: s.season,
        firstSeason: s.season,
        apps: 0,
      }
      prev.fromYear = Math.min(prev.fromYear, s.season - 1)
      prev.toYear = Math.max(prev.toYear, s.season)
      prev.firstSeason = Math.min(prev.firstSeason, s.season)
      prev.apps += s.apps
      clubMeta.set(s.clubName, prev)
    }
    const clubsPath = [...clubMeta.values()]
      .sort((a, b) => a.firstSeason - b.firstSeason || a.fromYear - b.fromYear)
      .map(({ clubName, fromYear, toYear }) => ({ clubName, fromYear, toYear }))

    let transfers = (transfersById.get(pid) || [])
      .filter((t) => t.year >= 2008 && t.fromClub !== t.toClub)
      .sort((a, b) => a.year - b.year)

    // ชุด transfers บน R2 ไม่ครบ — อนุมานจากเส้นทางสโมสรเมื่อว่าง
    if (transfers.length === 0 && clubsPath.length > 1) {
      for (let i = 1; i < clubsPath.length; i++) {
        const from = clubsPath[i - 1]
        const to = clubsPath[i]
        transfers.push({
          year: to.fromYear,
          fromClub: from.clubName,
          toClub: to.clubName,
          feeEur: null,
          kind: 'transfer',
          noteTh: 'อนุมานจากประวัติลงสนาม (ชุด transfers เปิดไม่ครบ)',
        })
      }
    }
    transfers = transfers.slice(-24)

    // titles from worldHistory when player logged apps at champion club that year
    const titles = []
    for (const league of Object.values(history.leagues || {})) {
      for (const ch of league.champions || []) {
        const hit = seasons.some(
          (s) =>
            s.season === ch.endYear &&
            (normalize(s.clubName) === normalize(ch.club) ||
              normalize(s.clubName).includes(normalize(ch.club).split(' ').pop() || '___') ||
              normalize(ch.club).includes(normalize(s.clubName).split(' ').pop() || '___')),
        )
        if (!hit) continue
        titles.push({
          year: ch.endYear,
          label: `${league.name} ${ch.season}`,
          labelTh: `${league.nameTh} ${ch.season}`,
          competition: 'league',
          clubName: ch.club,
        })
      }
    }
    for (const ev of history.timeline || []) {
      if (ev.comp !== 'ucl' || !ev.winner) continue
      const hit = seasons.some(
        (s) =>
          s.season === ev.year &&
          (normalize(s.clubName) === normalize(ev.winner) ||
            normalize(s.clubName).includes(normalize(ev.winner).split(' ').pop() || '___')),
      )
      if (!hit) continue
      titles.push({
        year: ev.year,
        label: `UCL ${ev.season || ev.year}`,
        labelTh: `แชมเปียนส์ลีก ${ev.season || ev.year}`,
        competition: 'ucl',
        clubName: ev.winner,
      })
    }

    const intlRaw = intlBags.get(pid)
    const worldCups = [...(intlRaw?.wc?.values() || [])]
      .sort((a, b) => a.year - b.year)
      .map((w) => ({
        year: w.year,
        apps: w.apps,
        goals: w.goals,
        assists: w.assists,
        bestStage: w.apps >= 6 ? 'Final' : w.apps >= 4 ? 'Knockout' : 'Group',
        bestStageTh: w.apps >= 6 ? 'ลึก / ชิง' : w.apps >= 4 ? 'รอบน็อกเอาต์' : 'รอบกลุ่ม',
        champion: false,
      }))
    for (const w of worldCups) {
      const champ = (history.timeline || []).find(
        (e) => e.comp === 'world_cup' && e.year === w.year,
      )
      if (champ && normalize(champ.winner) === normalize(tm.country_of_citizenship || '')) {
        w.champion = true
        w.bestStage = 'Winner'
        w.bestStageTh = 'แชมป์โลก'
        titles.push({
          year: w.year,
          label: `FIFA World Cup ${w.year}`,
          labelTh: `ฟุตบอลโลก ${w.year}`,
          competition: 'world_cup',
          nation: tm.country_of_citizenship,
        })
      }
    }

    const majorTournaments = [...(intlRaw?.majors?.values() || [])]
      .sort((a, b) => a.year - b.year)
      .map((e) => ({
        year: e.year,
        name: e.name,
        nameTh: e.nameTh,
        apps: e.apps,
        goals: e.goals,
        bestStageTh: e.apps >= 4 ? 'รอบน็อกเอาต์' : 'รอบกลุ่ม',
      }))

    const caps = Number(tm.international_caps) || 0
    const intlGoals = Number(tm.international_goals) || 0
    const nation = tm.country_of_citizenship || tm.country_of_birth || '—'
    const appsTot = seasons.reduce((s, r) => s + r.apps, 0)
    const goalsTot = seasons.reduce((s, r) => s + r.goals, 0)

    byName[gameName] = {
      source: 'transfermarkt',
      tmPlayerId: Number(tm.player_id),
      tmUrl: tm.url || null,
      nation,
      seasons,
      clubs: clubsPath,
      transfers,
      titles: titles.sort((a, b) => b.year - a.year),
      intl: {
        nation,
        nationTh: nation,
        caps,
        goals: intlGoals,
        worldCups,
        majorTournaments,
      },
      debutYear: clubsPath[0]?.fromYear || (seasons[0] ? seasons[0].season - 1 : null),
      summaryTh: `${gameName} · ข้อมูลจริง Transfermarkt · ${appsTot} นัด ${goalsTot} ประตู · แคปชาติ ${caps} · ย้าย ${transfers.length} ครั้ง · แชมป์ที่ตรวจพบ ${titles.length}`,
    }
  }

  const unmatched = rosterNames.filter((n) => !matched.has(n))
  const out = {
    version: 1,
    source: 'transfermarkt-datasets (dcaribou)',
    sourceUrl: 'https://github.com/dcaribou/transfermarkt-datasets',
    generatedAt: new Date().toISOString(),
    noteTh:
      'สถิติจาก Transfermarkt open dataset — นัด/ประตู/แอส/แคปชาติ/บอลโลก ตามชื่อที่จับคู่ได้ · แชมป์ลีก/UCL โยงจากประวัติเมื่อเคยลงสนามกับทีมแชมป์ปีนั้น · ประวัติย้ายอนุมานจากเส้นทางสโมสรถ้าชุด transfers เปิดไม่ครบ · ไม่มีประวัติเจ็บในชุดข้อมูลนี้',
    stats: {
      roster: rosterNames.length,
      matched: matched.size,
      withAppearances: withApps,
      unmatched: unmatched.length,
    },
    unmatchedSample: unmatched.slice(0, 40),
    byName,
  }

  fs.mkdirSync(path.dirname(OUT), { recursive: true })
  fs.writeFileSync(OUT, JSON.stringify(out))
  console.log(`Wrote ${OUT}`)
  console.log(JSON.stringify(out.stats, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
