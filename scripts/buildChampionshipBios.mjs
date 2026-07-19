/**
 * Download SortItOutSI Championship team pages → parse wages/contracts/nationality
 * → merge into playerBiosEng.json (keep existing PL bios).
 *
 * Usage:
 *   node scripts/buildChampionshipBios.mjs --download
 *   node scripts/buildChampionshipBios.mjs --resolve
 *   node scripts/buildChampionshipBios.mjs --all
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const DUMP = path.join(ROOT, 'scripts/_fm26_dumps/siosi_eng2')
const ENG2 = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/playersEng2.json'), 'utf8'))
const BIOS_OUT = path.join(ROOT, 'src/data/world/playerBiosEng.json')

/** SI team id + URL slug */
const CLUBS = {
  brr: { id: 620, slug: 'bristol-rovers', name: 'Bristol Rovers' },
  ply: { id: 697, slug: 'plymouth-argyle', name: 'Plymouth Argyle' },
  der: { id: 645, slug: 'derby-county', name: 'Derby County' },
  blb: { id: 612, slug: 'blackburn-rovers', name: 'Blackburn Rovers' },
  hud: { id: 664, slug: 'huddersfield-town', name: 'Huddersfield Town' },
  mlw: { id: 686, slug: 'millwall', name: 'Millwall' },
  stk: { id: 721, slug: 'stoke-city', name: 'Stoke City' },
  swa: { id: 724, slug: 'swansea-city', name: 'Swansea City' },
  cov: { id: 639, slug: 'coventry-city', name: 'Coventry City' },
  mid: { id: 685, slug: 'middlesbrough', name: 'Middlesbrough' },
  qpr: { id: 701, slug: 'queens-park-rangers', name: 'Queens Park Rangers' },
  shw: { id: 709, slug: 'sheffield-wednesday', name: 'Sheffield Wednesday' },
  wat: { id: 732, slug: 'watford', name: 'Watford' },
  nor: { id: 691, slug: 'norwich-city', name: 'Norwich City' },
  hul: { id: 665, slug: 'hull-city', name: 'Hull City' },
  pne: { id: 700, slug: 'preston-north-end', name: 'Preston North End' },
  car: { id: 625, slug: 'cardiff-city', name: 'Cardiff City' },
  oxf: { id: 695, slug: 'oxford-united', name: 'Oxford United' },
  por: { id: 699, slug: 'portsmouth', name: 'Portsmouth' },
  lei: { id: 673, slug: 'leicester-city', name: 'Leicester City' },
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function curlGet(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '--max-time',
      '45',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 5000
}

function decodeEntities(s) {
  return String(s)
    .replace(/&pound;/gi, '£')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseMoneyGbp(raw) {
  if (!raw) return null
  const s = decodeEntities(String(raw)).trim().replace(/,/g, '')
  const m = s.match(/£\s*([\d.]+)\s*([kmb])?/i)
  if (!m) return null
  const n = Number(m[1])
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? '').toLowerCase()
  if (u === 'k') return Math.round(n * 1_000)
  if (u === 'm') return Math.round(n * 1_000_000)
  if (u === 'b') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

function normalizeDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return s
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function countStars(cellHtml) {
  const n = (cellHtml.match(/fa-star(?!-)/g) || []).length
  return n || null
}

function parseTeamHtml(html, clubKey, clubName) {
  const playersIdx = html.search(/Players in FM26/i)
  const loanIdx = html.search(/Loaned Out Players/i)
  const peakedIdx = html.search(/Peaked Players/i)
  let end = html.length
  for (const i of [loanIdx, peakedIdx]) {
    if (i > playersIdx && i < end) end = i
  }
  const block = playersIdx >= 0 ? html.slice(playersIdx, end) : html
  const peakedBlock =
    peakedIdx >= 0 ? html.slice(peakedIdx, Math.min(html.length, peakedIdx + 80_000)) : ''
  const peakedNames = new Set()
  for (const m of peakedBlock.matchAll(
    /person\/\d+\/[a-z0-9-]+"[^>]*>\s*([^<]+?)\s*<\/a>/gi,
  )) {
    peakedNames.add(decodeEntities(m[1]).replace(/\s+/g, ' ').trim())
  }

  const rows = []
  for (const tr of block.matchAll(/<tr class="border-left-gender-mens"[\s\S]*?<\/tr>/gi)) {
    const row = tr[0]
    const person = row.match(
      /href="https:\/\/sortitoutsi\.net\/football-manager-2026\/person\/(\d+)\/([a-z0-9-]+)"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    )
    if (!person) continue
    const nation = row.match(
      /football-manager-2026\/nation\/\d+\/[a-z0-9-]+"[^>]*>[\s\S]*?<\/a>\s*([^<]+?)\s*<\/a>/i,
    )
    // simpler nationality: flag link text
    const natAlt = row.match(
      /uploads\/flags_sm\/[^"]+"\s*\/>\s*([A-Za-z][A-Za-z .&'-]+)\s*<\/a>/i,
    )
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
    // td0 icon, td1 name block, td2 age, td3 pos, td4 wage, td5 value, td6 cost, td7 expires, td8 rating, td9 pot
    if (tds.length < 8) continue
    const age = Number(stripTags(tds[2])) || null
    const fmPos = stripTags(tds[3]) || null
    const wageWeeklyGbp = parseMoneyGbp(tds[4])
    if (wageWeeklyGbp == null && !/£/.test(decodeEntities(tds[4]))) continue
    const name = decodeEntities(person[3]).replace(/\s+/g, ' ').trim()
    rows.push({
      fmId: person[1],
      name,
      nationality: decodeEntities(natAlt?.[1] || nation?.[1] || '')
        .replace(/\s+/g, ' ')
        .trim() || null,
      age,
      fmPos,
      wageWeeklyGbp,
      valueGbp: parseMoneyGbp(tds[5]),
      estimatedCostGbp: parseMoneyGbp(tds[6]),
      contractExpires: normalizeDate(stripTags(tds[7])) || null,
      starRating: countStars(tds[8] ?? ''),
      peaked: peakedNames.has(name),
      clubKey,
      club: clubName,
      sourceUrl: `https://sortitoutsi.net/football-manager-2026/person/${person[1]}/${person[2]}`,
    })
  }
  return rows
}

async function download() {
  fs.mkdirSync(DUMP, { recursive: true })
  for (const [key, meta] of Object.entries(CLUBS)) {
    const dest = path.join(DUMP, `${key}.html`)
    const url = `https://sortitoutsi.net/football-manager-2026/team/${meta.id}/${meta.slug}`
    const ok = curlGet(url, dest)
    const size = ok ? fs.statSync(dest).size : 0
    const title = ok
      ? fs.readFileSync(dest, 'utf8').match(/<title>([^<]+)/)?.[1]?.slice(0, 50)
      : 'FAIL'
    console.log(key, meta.id, size, title)
    await sleep(350)
  }
}

function resolveAndMerge() {
  const eng2Names = new Set()
  for (const rows of Object.values(ENG2.clubs ?? {})) {
    for (const r of rows) eng2Names.add(r.name)
  }

  const existing = fs.existsSync(BIOS_OUT)
    ? JSON.parse(fs.readFileSync(BIOS_OUT, 'utf8'))
    : { byName: {} }
  const byName = { ...(existing.byName ?? {}) }

  let parsed = 0
  let matched = 0
  for (const [key, meta] of Object.entries(CLUBS)) {
    const file = path.join(DUMP, `${key}.html`)
    if (!fs.existsSync(file)) {
      console.warn('missing', key)
      continue
    }
    const html = fs.readFileSync(file, 'utf8')
    if (/Just a moment|Access denied/i.test(html) || html.length < 5000) {
      console.warn('bad page', key)
      continue
    }
    const rows = parseTeamHtml(html, key, meta.name)
    parsed += rows.length
    console.log(key, 'rows', rows.length, rows.slice(0, 2).map((r) => `${r.name} £${r.wageWeeklyGbp}`).join(', '))
    for (const r of rows) {
      // Prefer matching eng2 roster names; still store all team rows for fuzzy later
      const prev = byName[r.name] ?? {}
      byName[r.name] = {
        ...prev,
        fmId: r.fmId ?? prev.fmId,
        nationality: r.nationality ?? prev.nationality,
        age: r.age ?? prev.age,
        fmPos: r.fmPos ?? prev.fmPos,
        wageWeeklyGbp: r.wageWeeklyGbp ?? prev.wageWeeklyGbp,
        valueGbp: r.valueGbp ?? prev.valueGbp,
        estimatedCostGbp: r.estimatedCostGbp ?? prev.estimatedCostGbp,
        contractExpires: r.contractExpires ?? prev.contractExpires,
        starRating: r.starRating ?? prev.starRating,
        peaked: r.peaked || prev.peaked || false,
        clubKey: r.clubKey,
        club: r.club,
        sourceUrl: r.sourceUrl ?? prev.sourceUrl,
      }
      if (eng2Names.has(r.name)) matched++
    }
  }

  // Accent-insensitive match for eng2 names missing exact key
  function norm(n) {
    return n
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  }
  const byNorm = Object.fromEntries(Object.entries(byName).map(([k, v]) => [norm(k), { ...v, _k: k }]))
  for (const name of eng2Names) {
    if (byName[name]) continue
    const hit = byNorm[norm(name)]
    if (hit) {
      const { _k, ...rest } = hit
      byName[name] = { ...rest, name }
      matched++
    }
  }

  fs.writeFileSync(
    BIOS_OUT,
    JSON.stringify(
      {
        source: 'sortitoutsi.net FM26',
        note: 'Personal/local display only — not for redistribution or commercial sale. Includes Premier League + Championship team pages.',
        byName,
      },
      null,
      2,
    ) + '\n',
  )

  let eng2Bio = 0
  for (const name of eng2Names) if (byName[name]) eng2Bio++
  console.log('parsed team rows', parsed, 'eng2 matched', eng2Bio, '/', eng2Names.size, 'total bios', Object.keys(byName).length)
  console.log('wrote', BIOS_OUT)
}

const args = new Set(process.argv.slice(2))
const runAll = args.has('--all')
if (runAll || args.has('--download')) await download()
if (runAll || args.has('--resolve')) resolveAndMerge()
if (!runAll && args.size === 0) {
  console.log('Usage: --download | --resolve | --all')
}
