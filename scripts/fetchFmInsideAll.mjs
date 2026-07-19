/**
 * Download FMInside FM26 player pages for all eng roster fmIds (via curl.exe).
 * Usage: node scripts/fetchFmInsideAll.mjs
 *        node scripts/fetchFmInsideAll.mjs --ids-only
 *        node scripts/fetchFmInsideAll.mjs --limit 20
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const IDS_PATH = path.join(ROOT, 'scripts/_fm26_dumps/eng_fm_ids.json')
const DIR = path.join(ROOT, 'scripts/_fm26_dumps/fminside')

const MANUAL = {
  'Patrick Dorgu': { fmId: '27164470', slug: 'patrick-dorgu', clubKey: 'mun' },
  'Deivid Washington': { fmId: '2000206497', slug: 'deivid-washington', clubKey: 'che' },
  'Reiss Nelson': { fmId: '28107919', slug: 'reiss-nelson', clubKey: 'bre' },
  'Aaron Ramsdale': { fmId: '29137172', slug: 'aaron-ramsdale', clubKey: 'new' },
  'William Osula': { fmId: '28128173', slug: 'william-osula', clubKey: 'new' },
  'Rayan Aït-Nouri': { fmId: '49047581', slug: 'rayan-ait-nouri', clubKey: 'mci' },
  'João Palhinha': { fmId: '55070285', slug: 'joao-palhinha', clubKey: 'tot' },
  'Randal Kolo Muani': { fmId: '48043873', slug: 'randal-kolo-muani', clubKey: 'tot' },
  'Djed Spence': { fmId: '29178504', slug: 'djed-spence', clubKey: 'tot' },
  'Wilson Odobert': { fmId: '2000102722', slug: 'wilson-odobert', clubKey: 'tot' },
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
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
      '-H',
      'Accept: text/html,application/xhtml+xml',
      '-H',
      'Accept-Language: en-US,en;q=0.9',
      '--max-time',
      '40',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

function htmlToMd(html, fmId) {
  const t = decodeEntities(html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''))
  const name =
    t.match(/<h1[^>]*title="([^"]+)"/i)?.[1] ||
    t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ||
    'Unknown'

  const lines = [`# ${name}`, `players/7-fm-26/${fmId}`]

  const pick = (label) => {
    const re = new RegExp(`${label}<\\/[^>]+>\\s*<[^>]+>([^<]+)`, 'i')
    return t.match(re)?.[1]?.trim() ?? null
  }
  for (const label of [
    'Age',
    'Height',
    'Left foot',
    'Right foot',
    'Position(s)',
    'Caps / Goals',
    'Club',
    'Sell value',
    'Wages',
    'Contract end',
  ]) {
    const v = pick(label)
    if (v) lines.push(`${label} ${v}`)
  }

  for (const sec of ['Goalkeeping', 'Technical', 'Mental', 'Physical', 'Set Pieces']) {
    lines.push(`### ${sec}`)
    const re = new RegExp(`<h3[^>]*>\\s*${sec}\\s*<\\/h3>\\s*<table[\\s\\S]*?</table>`, 'i')
    const block = t.match(re)?.[0] ?? ''
    for (const row of block.matchAll(
      /<td class="name"><acronym[^>]*>([^<]+)<\/acronym><\/td>\s*<td class="stat[^"]*">(\d{1,3})<\/td>/g,
    )) {
      lines.push(`| ${row[1].trim()} | ${row[2]} |`)
    }
  }

  lines.push('')
  lines.push('## Best in posession roles')
  // optional roles — skip if hard
  lines.push('')
  lines.push('## Best out posession roles')

  return lines.join('\n')
}

// patch ids
const ids = JSON.parse(fs.readFileSync(IDS_PATH, 'utf8'))
for (const [name, meta] of Object.entries(MANUAL)) ids.byName[name] = meta
ids.miss = []
ids.missed = 0
ids.matched = Object.keys(ids.byName).length
fs.writeFileSync(IDS_PATH, JSON.stringify(ids, null, 2))
console.log('eng fmIds', ids.matched)
if (process.argv.includes('--ids-only')) process.exit(0)

fs.mkdirSync(DIR, { recursive: true })
const limitArg = process.argv.find((a) => a.startsWith('--limit'))
const limit = limitArg
  ? Number(limitArg.includes('=') ? limitArg.split('=')[1] : process.argv[process.argv.indexOf(limitArg) + 1])
  : Infinity

const queue = Object.entries(ids.byName).map(([name, meta]) => ({
  name,
  fmId: String(meta.fmId),
  slug: meta.slug || slugify(name),
}))

let ok = 0
let skip = 0
let fail = 0
const failures = []
const tmpHtml = path.join(DIR, '_tmp.html')

for (let i = 0; i < queue.length && ok + skip + fail < limit; i++) {
  const item = queue[i]
  const dest = path.join(DIR, `${item.fmId}.md`)
  if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
    // re-check has attrs
    const existing = fs.readFileSync(dest, 'utf8')
    if (/###\s*Technical[\s\S]*?\|\s*\d+\s*\|/.test(existing)) {
      skip++
      continue
    }
  }
  const url = `https://fminside.net/players/7-fm-26/${item.fmId}-${item.slug}`
  const got = curlGet(url, tmpHtml)
  if (!got || !fs.existsSync(tmpHtml)) {
    fail++
    failures.push({ name: item.name, fmId: item.fmId, err: 'curl failed' })
    console.log(`[${i + 1}/${queue.length}] CURL FAIL ${item.name}`)
    continue
  }
  const html = fs.readFileSync(tmpHtml, 'utf8')
  if (html.length < 5000 || /just a moment|cf-browser-verification|Access denied/i.test(html)) {
    fail++
    failures.push({ name: item.name, fmId: item.fmId, err: 'blocked', len: html.length })
    console.log(`[${i + 1}/${queue.length}] BLOCK ${item.name} len=${html.length}`)
  } else {
    const md = htmlToMd(html, item.fmId)
    const attrCount = (md.match(/\|\s*\d{1,3}\s*\|/g) || []).length
    if (attrCount < 8) {
      fail++
      failures.push({ name: item.name, fmId: item.fmId, err: 'parse_low', attrCount })
      console.log(`[${i + 1}/${queue.length}] PARSE LOW ${item.name} attrs=${attrCount}`)
      // still save for debug
      fs.writeFileSync(dest, md)
    } else {
      fs.writeFileSync(dest, md)
      ok++
      console.log(`[${i + 1}/${queue.length}] OK ${item.name} attrs=${attrCount}`)
    }
  }
  await sleep(280 + Math.floor(Math.random() * 220))
}

try {
  fs.unlinkSync(tmpHtml)
} catch {}
try {
  fs.unlinkSync(path.join(DIR, '_test_rice.html'))
} catch {}

fs.writeFileSync(
  path.join(ROOT, 'scripts/_fm26_dumps/fminside_fetch_report.json'),
  JSON.stringify({ ok, skip, fail, failures: failures.slice(0, 50), totalFailures: failures.length }, null, 2),
)
console.log({ ok, skip, fail, total: queue.length })
