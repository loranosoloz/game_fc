/**
 * Germany Bundesliga pipeline (same shape as Spain pack).
 * Usage:
 *   node scripts/buildGermanyPack.mjs --download-clubs
 *   node scripts/buildGermanyPack.mjs --resolve
 *   node scripts/buildGermanyPack.mjs --fetch-fminside
 *   node scripts/buildGermanyPack.mjs --all
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const FMTU_DIR = path.join(ROOT, 'scripts/_fm26_dumps/fmtu_ger')
const FMIN_DIR = path.join(ROOT, 'scripts/_fm26_dumps/fminside')
const IDS_OUT = path.join(ROOT, 'scripts/_fm26_dumps/ger_fm_ids.json')
const PLAYERS_OUT = path.join(ROOT, 'src/data/world/playersGer.json')

/** FM unique club IDs (fmtransferupdate) — Bundesliga 25/26 (18 teams) */
const CLUBS = {
  bay: { id: 915, name: 'Bayern Munich', rep: 93 },
  bvb: { id: 907, name: 'Borussia Dortmund', rep: 86 },
  b04: { id: 901, name: 'Bayer Leverkusen', rep: 85 },
  rbl: { id: 91013388, name: 'RB Leipzig', rep: 84 },
  stu: { id: 960, name: 'VfB Stuttgart', rep: 78 },
  ein: { id: 912, name: 'Eintracht Frankfurt', rep: 77 },
  fre: { id: 944, name: 'SC Freiburg', rep: 75 },
  wob: { id: 961, name: 'VfL Wolfsburg', rep: 74 },
  bmg: { id: 908, name: 'Borussia Mönchengladbach', rep: 73 },
  uni: { id: 121182, name: 'Union Berlin', rep: 72 },
  hof: { id: 879226, name: 'TSG Hoffenheim', rep: 72 },
  wer: { id: 948, name: 'Werder Bremen', rep: 71 },
  m05: { id: 918, name: 'Mainz 05', rep: 70 },
  aug: { id: 2238, name: 'FC Augsburg', rep: 68 },
  koe: { id: 916, name: '1. FC Köln', rep: 67 },
  hea: { id: 880295, name: 'Heidenheim', rep: 66 },
  stp: { id: 946, name: 'FC St. Pauli', rep: 64 },
  hsv: { id: 947, name: 'Hamburger SV', rep: 70 },
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function curlGet(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H',
      'Accept: text/html',
      '--max-time',
      '45',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 1000
}

function mapRole(fmPos) {
  const p = String(fmPos || '').toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (/\bST\b/.test(p) || p.includes('F C') || p.includes('AM/F')) return 'ST'
  if (p.includes('AM RL') || p.includes('AM RLC')) return p.includes('ST') || p.includes('F C') ? 'ST' : 'CAM'
  if (p.includes('AM L') && !p.includes('R')) return 'LW'
  if (p.includes('AM R') && !p.includes('L')) return 'RW'
  if (p.includes('AM C') || p.includes('AM LC') || p.includes('AM RC')) return 'CAM'
  if (p.includes('DM')) return 'CDM'
  if (p.includes('M C') || p.includes('M RC') || p.includes('M LC') || p.includes('M R') || p.includes('M L'))
    return 'CM'
  if (p.includes('D/WB R') || p.includes('WB R') || (p.includes('D R') && !p.includes('L') && !p.includes('C')))
    return 'RB'
  if (p.includes('D/WB L') || p.includes('WB L') || (p.includes('D L') && !p.includes('R') && !p.includes('C')))
    return 'LB'
  if (p.includes('D C') || p.includes('D RC') || p.includes('D LC') || p.includes('D RLC')) return 'CB'
  if (p.includes('D/WB RL') || p.includes('D RL')) return 'RB'
  return 'CM'
}

function titleCaseSlug(slug) {
  // vinicius-junior → Vinicius Junior (approx; accents lost)
  return slug
    .split('-')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function parseClubPlayers(html, clubKey, rep) {
  const depth =
    html.match(
      /id="panel-squad_depth"[\s\S]*?(?=id="panel-wonderkids"|id="panel-loaned"|data-tabs-panel="wonderkids"|$)/i,
    )?.[0] ?? ''

  const sectionRole = {
    Goalkeepers: 'GK',
    Defenders: 'CB',
    Midfielders: 'CM',
    Forwards: 'ST',
  }

  const players = []
  const seen = new Set()

  for (const [section, defaultRole] of Object.entries(sectionRole)) {
    const re = new RegExp(
      `<h5[^>]*>\\s*${section}\\s*<\\/h5>([\\s\\S]*?)(?=<h5[^>]*>|$)`,
      'i',
    )
    const block = depth.match(re)?.[1] ?? ''
    for (const m of block.matchAll(
      /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-([a-z0-9-]+)"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,500}?(\d{2})\s*y\/?o/gi,
    )) {
      const fmId = m[1]
      if (seen.has(fmId)) continue
      seen.add(fmId)
      const slug = m[2]
      const name = m[3].replace(/\s+/g, ' ').trim()
      const age = Number(m[4]) || 24
      if (!name) continue
      players.push({
        name,
        role: defaultRole,
        age,
        ovr: rep,
        fmPos: section,
        fmId,
        slug,
        clubKey,
      })
    }
  }

  // Refine roles using players panel position when available
  const panel =
    html.match(/id="panel-players"[\s\S]*?(?=id="panel-staff"|$)/i)?.[0] ?? ''
  const posById = new Map()
  for (const m of panel.matchAll(
    /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-[a-z0-9-]+"[^>]*>[\s\S]{0,800}?<span class="order-4[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi,
  )) {
    posById.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  }
  for (const p of players) {
    const fmPos = posById.get(p.fmId)
    if (fmPos) {
      p.fmPos = fmPos
      p.role = mapRole(fmPos)
    }
  }

  players.forEach((r, i) => {
    if (i < 18) r.ovr = Math.max(64, Math.min(94, rep - Math.floor(i / 3)))
    else r.ovr = Math.max(58, Math.min(80, rep - 8 - Math.floor((i - 18) / 2)))
  })

  return players
}

async function downloadClubs() {
  fs.mkdirSync(FMTU_DIR, { recursive: true })
  for (const [key, meta] of Object.entries(CLUBS)) {
    const dest = path.join(FMTU_DIR, `${key}.html`)
    const url = `https://fmtransferupdate.com/clubs/${meta.id}`
    const ok = curlGet(url, dest)
    const title = ok
      ? fs.readFileSync(dest, 'utf8').match(/<title>([^<]+)/)?.[1]
      : 'FAIL'
    console.log(key, meta.id, ok ? fs.statSync(dest).size : 0, title)
    await sleep(200)
  }
}

function resolveAndBuildPlayers() {
  const byName = {}
  const clubs = {}
  let total = 0
  // Deterministic ovr: rank within club by appearance order (first XI-ish higher)
  for (const [key, meta] of Object.entries(CLUBS)) {
    const file = path.join(FMTU_DIR, `${key}.html`)
    if (!fs.existsSync(file)) {
      console.warn('missing', key)
      continue
    }
    const html = fs.readFileSync(file, 'utf8')
    const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
    if (/Not Found/i.test(title)) {
      console.warn('not found', key, meta.id)
      continue
    }
    const rows = parseClubPlayers(html, key, meta.rep)
    clubs[key] = rows.map(({ name, role, age, ovr, fmPos }) => ({ name, role, age, ovr, fmPos }))
    for (const r of rows) {
      byName[r.name] = { fmId: r.fmId, clubKey: key, slug: r.slug }
    }
    total += rows.length
    console.log(key, title.slice(0, 40), '→', rows.length, rows.slice(0, 3).map((r) => r.name).join(', '))
  }

  fs.writeFileSync(
    IDS_OUT,
    JSON.stringify({ source: 'fmtransferupdate Bundesliga', matched: Object.keys(byName).length, byName }, null, 2),
  )
  fs.writeFileSync(
    PLAYERS_OUT,
    JSON.stringify(
      {
        source: 'fmtransferupdate.com + FMInside (personal display)',
        sourceUrl: 'https://fmtransferupdate.com/',
        note: 'Not for redistribution or commercial sale.',
        clubs,
      },
      null,
      2,
    ) + '\n',
  )
  console.log('players', total, 'unique names', Object.keys(byName).length)
  console.log('wrote', PLAYERS_OUT, IDS_OUT)
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
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
  return lines.join('\n')
}

async function fetchFmInside() {
  fs.mkdirSync(FMIN_DIR, { recursive: true })
  const ids = JSON.parse(fs.readFileSync(IDS_OUT, 'utf8'))
  const queue = Object.entries(ids.byName).map(([name, meta]) => ({
    name,
    fmId: String(meta.fmId),
    slug: meta.slug || slugify(name),
  }))
  let ok = 0
  let skip = 0
  let fail = 0
  const tmp = path.join(FMIN_DIR, '_tmp_ger.html')
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i]
    const dest = path.join(FMIN_DIR, `${item.fmId}.md`)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      const existing = fs.readFileSync(dest, 'utf8')
      if (/###\s*Technical[\s\S]*?\|\s*\d+\s*\|/.test(existing)) {
        skip++
        continue
      }
    }
    const url = `https://fminside.net/players/7-fm-26/${item.fmId}-${item.slug}`
    if (!curlGet(url, tmp)) {
      fail++
      console.log(`[${i + 1}/${queue.length}] CURL FAIL ${item.name}`)
      continue
    }
    const html = fs.readFileSync(tmp, 'utf8')
    if (html.length < 5000 || /just a moment|Access denied/i.test(html)) {
      fail++
      console.log(`[${i + 1}/${queue.length}] BLOCK ${item.name}`)
    } else {
      const md = htmlToMd(html, item.fmId)
      const attrCount = (md.match(/\|\s*\d{1,3}\s*\|/g) || []).length
      fs.writeFileSync(dest, md)
      if (attrCount < 8) {
        fail++
        console.log(`[${i + 1}/${queue.length}] PARSE LOW ${item.name} attrs=${attrCount}`)
      } else {
        ok++
        if (ok % 25 === 0 || i < 5) console.log(`[${i + 1}/${queue.length}] OK ${item.name} attrs=${attrCount}`)
      }
    }
    await sleep(280 + Math.floor(Math.random() * 200))
  }
  try {
    fs.unlinkSync(tmp)
  } catch {}
  console.log({ ok, skip, fail, total: queue.length })
}

const args = new Set(process.argv.slice(2))
const runAll = args.has('--all')
if (runAll || args.has('--download-clubs')) await downloadClubs()
if (runAll || args.has('--resolve')) resolveAndBuildPlayers()
if (runAll || args.has('--fetch-fminside')) await fetchFmInside()
if (!runAll && args.size === 0) {
  console.log('Usage: --download-clubs | --resolve | --fetch-fminside | --all')
}
