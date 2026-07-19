/**
 * Build src/data/world/fmInsideAttrs.json from scripts/_fm26_dumps/fminside/*.md
 * Usage: node scripts/buildFmInsideAttrs.mjs
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

// Inline parser (avoid TS import in plain node)
function parseEuro(raw) {
  if (!raw) return null
  const s = String(raw).replace(/\s/g, '').replace(/€/g, '')
  const m = s.match(/([\d.,]+)\s*([KMB])?/i)
  if (!m) return null
  const n = Number(m[1].replace(/,/g, ''))
  if (!Number.isFinite(n)) return null
  const u = (m[2] ?? '').toUpperCase()
  if (u === 'K') return Math.round(n * 1_000)
  if (u === 'M') return Math.round(n * 1_000_000)
  if (u === 'B') return Math.round(n * 1_000_000_000)
  return Math.round(n)
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function parseAttrsBlock(text, heading) {
  const out = {}
  const re = new RegExp(`###\\s*${heading}[\\s\\S]*?(?=###|$)`, 'i')
  const block = text.match(re)?.[0] ?? ''
  for (const m of block.matchAll(/\|\s*([^|]+?)\s*\|\s*(\d{1,3})\s*\|/g)) {
    const key = m[1].trim()
    if (key.length < 2 || /^-+$/.test(key)) continue
    out[key] = Number(m[2])
  }
  return out
}

function parseRoles(text, heading) {
  const out = []
  const re = new RegExp(`##\\s*${heading}[\\s\\S]*?(?=##\\s|#\\s|$)`, 'i')
  const block = text.match(re)?.[0] ?? ''
  for (const m of block.matchAll(/\d+\.\s+(.+?)(\d+(?:\.\d+)?)/g)) {
    out.push({ name: m[1].trim(), score: Number(m[2]) })
  }
  return out.slice(0, 8)
}

function parseFmInsideMarkdown(md, fmIdHint) {
  const text = String(md)
  const nameM = text.match(/^#\s+(.+)$/m)
  const name = nameM?.[1]?.trim()
  if (!name) return null
  const grab = (label) => {
    const re = new RegExp(label + '\\s*([^\\n]+)', 'i')
    const m = text.match(re)
    return m ? m[1].trim() : null
  }
  const age = Number(grab('Age')?.replace(/\D/g, '')) || undefined
  const heightRaw = grab('Height')
  const heightCm = heightRaw ? Number(heightRaw.replace(/\D/g, '')) || null : null
  const leftFoot = Number(grab('Left foot')) || null
  const rightFoot = Number(grab('Right foot')) || null
  const positions = grab('Position\\(s\\)') || grab('Position')
  const capsRaw = grab('Caps / Goals')
  let caps = null
  let goalsIntl = null
  if (capsRaw) {
    const cm = capsRaw.match(/(\d+)\s*\/\s*(\d+)/)
    if (cm) {
      caps = Number(cm[1])
      goalsIntl = Number(cm[2])
    }
  }
  const club = grab('Club')
  const sellValueEur = parseEuro(grab('Sell value'))
  const wageEurPw = parseEuro(grab('Wages')?.replace(/\s*pw/i, ''))
  const contractEnd = grab('Contract end')
  const fmId =
    fmIdHint ||
    text.match(/players\/7-fm-26\/(\d+)/)?.[1] ||
    ''

  return {
    fmId: String(fmId),
    name,
    age,
    heightCm,
    leftFoot,
    rightFoot,
    positions,
    caps,
    goalsIntl,
    club,
    sellValueEur,
    wageEurPw,
    contractEnd,
    attrs: {
      goalkeeping: parseAttrsBlock(text, 'Goalkeeping'),
      technical: parseAttrsBlock(text, 'Technical'),
      mental: parseAttrsBlock(text, 'Mental'),
      physical: parseAttrsBlock(text, 'Physical'),
      setPieces: parseAttrsBlock(text, 'Set Pieces'),
    },
    bestRolesIn: parseRoles(text, 'Best in posession roles'),
    bestRolesOut: parseRoles(text, 'Best out posession roles'),
    sourceUrl: fmId
      ? `https://fminside.net/players/7-fm-26/${fmId}-${slugify(name)}/`
      : undefined,
  }
}

const ROOT = path.resolve('.')
const DIR = path.join(ROOT, 'scripts/_fm26_dumps/fminside')
const OUT = path.join(ROOT, 'src/data/world/fmInsideAttrs.json')
const bios = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/playerBiosEng.json'), 'utf8'))
const engIds = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_fm26_dumps/eng_fm_ids.json'), 'utf8'))
const eng2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/eng2_fm_ids.json')
const eng2Ids = fs.existsSync(eng2IdsPath) ? JSON.parse(fs.readFileSync(eng2IdsPath, 'utf8')) : { byName: {} }
const espIdsPath = path.join(ROOT, 'scripts/_fm26_dumps/esp_fm_ids.json')
const espIds = fs.existsSync(espIdsPath) ? JSON.parse(fs.readFileSync(espIdsPath, 'utf8')) : { byName: {} }
const esp2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/esp2_fm_ids.json')
const esp2Ids = fs.existsSync(esp2IdsPath) ? JSON.parse(fs.readFileSync(esp2IdsPath, 'utf8')) : { byName: {} }
const gerIdsPath = path.join(ROOT, 'scripts/_fm26_dumps/ger_fm_ids.json')
const gerIds = fs.existsSync(gerIdsPath) ? JSON.parse(fs.readFileSync(gerIdsPath, 'utf8')) : { byName: {} }
const ger2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/ger2_fm_ids.json')
const ger2Ids = fs.existsSync(ger2IdsPath) ? JSON.parse(fs.readFileSync(ger2IdsPath, 'utf8')) : { byName: {} }
const fraIdsPath = path.join(ROOT, 'scripts/_fm26_dumps/fra_fm_ids.json')
const fraIds = fs.existsSync(fraIdsPath) ? JSON.parse(fs.readFileSync(fraIdsPath, 'utf8')) : { byName: {} }
const fra2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/fra2_fm_ids.json')
const fra2Ids = fs.existsSync(fra2IdsPath) ? JSON.parse(fs.readFileSync(fra2IdsPath, 'utf8')) : { byName: {} }
const itaIdsPath = path.join(ROOT, 'scripts/_fm26_dumps/ita_fm_ids.json')
const itaIds = fs.existsSync(itaIdsPath) ? JSON.parse(fs.readFileSync(itaIdsPath, 'utf8')) : { byName: {} }
const ita2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/ita2_fm_ids.json')
const ita2Ids = fs.existsSync(ita2IdsPath) ? JSON.parse(fs.readFileSync(ita2IdsPath, 'utf8')) : { byName: {} }
const thaIdsPath = path.join(ROOT, 'scripts/_fm26_dumps/tha_fm_ids.json')
const thaIds = fs.existsSync(thaIdsPath) ? JSON.parse(fs.readFileSync(thaIdsPath, 'utf8')) : { byName: {} }
const tha2IdsPath = path.join(ROOT, 'scripts/_fm26_dumps/tha2_fm_ids.json')
const tha2Ids = fs.existsSync(tha2IdsPath) ? JSON.parse(fs.readFileSync(tha2IdsPath, 'utf8')) : { byName: {} }
const EXTRA_ID_FILES = [
  'jpn', 'jpn2', 'kor', 'kor2', 'bra', 'tur', 'ned', 'prt', 'bel', 'sco', 'aut', 'sui', 'den', 'gre',
  'vie', 'idn', 'mys', 'sgp', 'sau',
]
const extraIds = EXTRA_ID_FILES.map((id) => {
  const p = path.join(ROOT, `scripts/_fm26_dumps/${id}_fm_ids.json`)
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { byName: {} }
})

fs.mkdirSync(DIR, { recursive: true })

const idToName = {}
for (const [name, meta] of Object.entries(engIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(eng2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(espIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(esp2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(gerIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(ger2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(fraIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(fra2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(itaIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(ita2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(thaIds.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const [name, meta] of Object.entries(tha2Ids.byName ?? {})) {
  idToName[String(meta.fmId)] = name
}
for (const pack of extraIds) {
  for (const [name, meta] of Object.entries(pack.byName ?? {})) {
    idToName[String(meta.fmId)] = name
  }
}
for (const [name, b] of Object.entries(bios.byName ?? {})) {
  if (b.fmId && !idToName[String(b.fmId)]) idToName[String(b.fmId)] = name
}

const byName = {}
if (fs.existsSync(DIR)) {
  for (const f of fs.readdirSync(DIR).filter((x) => x.endsWith('.md'))) {
    const id = f.replace(/\.md$/, '')
    if (!/^\d+$/.test(id)) continue
    const profile = parseFmInsideMarkdown(fs.readFileSync(path.join(DIR, f), 'utf8'), id)
    if (!profile?.name) continue
    const key = idToName[id] || profile.name
    byName[key] = profile
  }
}

fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'fminside.net FM26',
      note: 'Personal/local display only — not for redistribution or commercial sale.',
      byName,
    },
    null,
    2,
  ) + '\n',
)

const ok = Object.values(byName).filter((p) => Object.keys(p.attrs?.technical ?? {}).length > 5).length
console.log('Wrote', OUT, 'profiles', Object.keys(byName).length, 'withAttrs', ok)
