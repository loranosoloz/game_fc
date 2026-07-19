/**
 * Parse fmtransferupdate.com club HTML → name→fmId for eng roster.
 * Usage: node scripts/resolveFmIdsFromFmtu.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const DIR = path.join(ROOT, 'scripts/_fm26_dumps/fmtu')
const ENG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/playersEng.json'), 'utf8'))
const OUT = path.join(ROOT, 'scripts/_fm26_dumps/eng_fm_ids.json')

function norm(s) {
  return String(s)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugToName(slug) {
  return slug.replace(/-/g, ' ').trim()
}

function parseClubHtml(html) {
  const out = []
  const seen = new Set()
  // href="https://fmtransferupdate.com/players/28106491-declan-rice"
  const re = /fmtransferupdate\.com\/players\/(\d+)-([a-z0-9-]+)/gi
  for (const m of html.matchAll(re)) {
    const fmId = m[1]
    if (seen.has(fmId)) continue
    seen.add(fmId)
    out.push({ fmId, slug: m[2], nameFromSlug: slugToName(m[2]) })
  }
  return out
}

function matchPlayer(engName, rows) {
  const n = norm(engName)
  const bySlug = new Map(rows.map((r) => [norm(r.nameFromSlug), r]))
  if (bySlug.has(n)) return bySlug.get(n)

  // exact last-name unique
  const last = n.split(' ').pop()
  const cands = rows.filter((r) => {
    const k = norm(r.nameFromSlug)
    return k === n || k.endsWith(' ' + last) || k.split(' ').pop() === last
  })
  if (cands.length === 1) return cands[0]

  // containment
  const contain = rows.filter((r) => {
    const k = norm(r.nameFromSlug)
    return k.includes(n) || n.includes(k)
  })
  if (contain.length === 1) return contain[0]

  // special short names
  if (n === 'amad') {
    const a = rows.find((r) => /amad/.test(norm(r.nameFromSlug)))
    if (a) return a
  }
  if (n === 'rodri') {
    const a = rows.find((r) => norm(r.nameFromSlug) === 'rodri')
    if (a) return a
  }
  if (n === 'gabriel') {
    const a = rows.find((r) => norm(r.nameFromSlug) === 'gabriel')
    if (a) return a
  }
  if (n === 'alisson') {
    const a = rows.find((r) => /alisson/.test(norm(r.nameFromSlug)))
    if (a) return a
  }

  return null
}

const byClub = {}
for (const key of Object.keys(ENG.clubs)) {
  const file = path.join(DIR, `${key}.html`)
  const html = fs.readFileSync(file, 'utf8')
  const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
  const rows = parseClubHtml(html)
  byClub[key] = rows
  console.log(key, title.slice(0, 40), '→', rows.length, 'unique player links')
}

const byName = {}
const matched = []
const miss = []

for (const [key, list] of Object.entries(ENG.clubs)) {
  const rows = byClub[key] ?? []
  for (const p of list) {
    const hit = matchPlayer(p.name, rows)
    if (hit) {
      matched.push({ name: p.name, clubKey: key, fmId: hit.fmId, slug: hit.slug })
      byName[p.name] = { fmId: hit.fmId, clubKey: key, slug: hit.slug }
    } else {
      miss.push({ name: p.name, clubKey: key })
    }
  }
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'fmtransferupdate.com club pages',
      matched: matched.length,
      missed: miss.length,
      byName,
      miss,
    },
    null,
    2,
  ),
)

console.log('matched', matched.length, '/', matched.length + miss.length)
console.log('miss', miss)
