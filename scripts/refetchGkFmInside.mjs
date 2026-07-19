/**
 * Re-fetch FMInside pages for all GKs so Goalkeeping attrs are captured.
 * Usage: node scripts/refetchGkFmInside.mjs
 *        node scripts/refetchGkFmInside.mjs --limit=20
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { htmlToMd } from './lib/fmInsideHtmlToMd.mjs'

const ROOT = path.resolve('.')
const DIR = path.join(ROOT, 'scripts/_fm26_dumps/fminside')
const PACKS = [
  ['eng', 'playersEng'],
  ['eng2', 'playersEng2'],
  ['esp', 'playersEsp'],
  ['esp2', 'playersEsp2'],
  ['ger', 'playersGer'],
  ['ger2', 'playersGer2'],
  ['fra', 'playersFra'],
  ['fra2', 'playersFra2'],
  ['ita', 'playersIta'],
  ['ita2', 'playersIta2'],
  ['tha', 'playersTha'],
  ['tha2', 'playersTha2'],
  ['jpn', 'playersJpn'],
  ['jpn2', 'playersJpn2'],
  ['kor', 'playersKor'],
  ['kor2', 'playersKor2'],
  ['bra', 'playersBra'],
  ['tur', 'playersTur'],
  ['ned', 'playersNed'],
  ['prt', 'playersPrt'],
  ['bel', 'playersBel'],
  ['sco', 'playersSco'],
  ['aut', 'playersAut'],
  ['sui', 'playersSui'],
  ['den', 'playersDen'],
  ['gre', 'playersGre'],
]

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
  return r.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 3000
}

const queue = []
const seen = new Set()
for (const [league, file] of PACKS) {
  const pack = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world', `${file}.json`), 'utf8'))
  const idsPath = path.join(ROOT, 'scripts/_fm26_dumps', `${league}_fm_ids.json`)
  if (!fs.existsSync(idsPath)) continue
  const ids = JSON.parse(fs.readFileSync(idsPath, 'utf8')).byName ?? {}
  for (const rows of Object.values(pack.clubs ?? {})) {
    for (const r of rows) {
      if (r.role !== 'GK') continue
      const meta = ids[r.name]
      if (!meta?.fmId) continue
      const fmId = String(meta.fmId)
      if (seen.has(fmId)) continue
      seen.add(fmId)
      const dest = path.join(DIR, `${fmId}.md`)
      const hasGk =
        fs.existsSync(dest) && /###\s*Goalkeeping[\s\S]*?\|\s*\d+\s*\|/i.test(fs.readFileSync(dest, 'utf8'))
      if (hasGk) continue
      queue.push({
        name: r.name,
        fmId,
        slug: meta.slug || slugify(r.name),
        league,
      })
    }
  }
}

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.split('=')[1]) : Infinity
const jobs = queue.slice(0, limit)
console.log('GK refetch jobs', jobs.length, '(of', queue.length, 'missing Goalkeeping)')

fs.mkdirSync(DIR, { recursive: true })
const tmp = path.join(DIR, '_tmp_gk.html')
let ok = 0
let fail = 0

for (let i = 0; i < jobs.length; i++) {
  const item = jobs[i]
  const url = `https://fminside.net/players/7-fm-26/${item.fmId}-${item.slug}`
  const progress = `[${i + 1}/${jobs.length}]`
  if (!curlGet(url, tmp)) {
    fail++
    console.log(progress, 'CURL FAIL', item.league, item.name)
    continue
  }
  const html = fs.readFileSync(tmp, 'utf8')
  if (html.length < 5000 || /just a moment|Access denied|Too Many Requests/i.test(html)) {
    fail++
    console.log(progress, 'BLOCK', item.league, item.name)
    await sleep(800)
    continue
  }
  const md = htmlToMd(html, item.fmId)
  const gkCount = (md.match(/###\s*Goalkeeping[\s\S]*?(?=###|$)/i)?.[0].match(/\|\s*\d{1,3}\s*\|/g) || [])
    .length
  fs.writeFileSync(path.join(DIR, `${item.fmId}.md`), md)
  if (gkCount < 5) {
    fail++
    console.log(progress, 'LOW GK', item.league, item.name, 'attrs=' + gkCount)
  } else {
    ok++
    if (ok <= 5 || ok % 25 === 0) console.log(progress, 'OK', item.league, item.name, 'gk=' + gkCount)
  }
  await sleep(280 + Math.floor(Math.random() * 180))
}

try {
  fs.unlinkSync(tmp)
} catch {}
console.log({ ok, fail, total: jobs.length })
