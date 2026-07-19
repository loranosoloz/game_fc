/**
 * Parse SortItOutSI FM26 team / person markdown dumps into player bios.
 * Usage:
 *   node scripts/buildPlayerBios.mjs
 * Expects team markdown at scripts/_fm26_dumps/{key}_team.md
 * Optional person markdown at scripts/_fm26_dumps/persons/{fmId}.md
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const DUMP = path.join(ROOT, 'scripts/_fm26_dumps')
const ENG = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/playersEng.json'), 'utf8'))
const OUT = path.join(ROOT, 'src/data/world/playerBiosEng.json')

const CLUB_NAMES = {
  ars: 'Arsenal',
  liv: 'Liverpool',
  mci: 'Manchester City',
  che: 'Chelsea',
  mun: 'Manchester United',
  tot: 'Tottenham Hotspur',
  new: 'Newcastle United',
  bre: 'Brentford',
  eve: 'Everton',
  avl: 'Aston Villa',
}

const MULTI_NATIONS = [
  'Northern Ireland',
  'Republic of Ireland',
  'Bosnia and Herzegovina',
  'North Macedonia',
  'Czech Republic',
  'United States',
  'Costa Rica',
  'Saudi Arabia',
  'Ivory Coast',
  'Cape Verde',
  'South Korea',
  'China PR',
  'DR Congo',
  'The Gambia',
  'Burkina Faso',
  'Guinea-Bissau',
  'Trinidad and Tobago',
  'Antigua and Barbuda',
  'Saint Kitts & Nevis',
  'Curaçao',
]

function parseMoneyGbp(raw) {
  if (!raw) return null
  const s = String(raw).trim().replace(/,/g, '')
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

function splitRawName(raw, clubName) {
  let s = raw.trim()
  if (s.endsWith(clubName)) s = s.slice(0, -clubName.length).trim()
  // also try short club aliases
  for (const alias of ['Man City', 'Man Utd', 'Tottenham', 'Newcastle', 'Aston Villa']) {
    if (s.endsWith(alias)) s = s.slice(0, -alias.length).trim()
  }
  for (const n of MULTI_NATIONS) {
    if (s.endsWith(n)) return { name: s.slice(0, -n.length).trim(), nationality: n }
  }
  const parts = s.split(/\s+/)
  if (parts.length >= 2) {
    return { name: parts.slice(0, -1).join(' '), nationality: parts[parts.length - 1] }
  }
  return { name: s, nationality: null }
}

function parseTeamPlayers(md, clubKey) {
  const clubName = CLUB_NAMES[clubKey]
  const playersStart = md.search(/# .+Players in FM26/i)
  const loanStart = md.search(/# .+Loaned Out Players/i)
  const peakedStart = md.search(/# .+Peaked Players/i)
  const staffStart = md.search(/# .+Staff in FM26/i)

  let end = md.length
  for (const i of [loanStart, peakedStart, staffStart]) {
    if (i > playersStart && i < end) end = i
  }
  const block = playersStart >= 0 ? md.slice(playersStart, end) : md

  const peakedBlock =
    peakedStart >= 0
      ? md.slice(peakedStart, staffStart > peakedStart ? staffStart : md.length)
      : ''
  const peakedNames = new Set()
  for (const line of peakedBlock.split('\n')) {
    const m = line.match(/^\|\s*\|\s*(.+?)\s*\|\s*\d+\s*\|/)
    if (!m) continue
    const { name } = splitRawName(m[1], clubName)
    if (name) peakedNames.add(name)
  }

  const rows = []
  for (const line of block.split('\n')) {
    const m = line.match(
      /^\|\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/,
    )
    if (!m) continue
    const wageRaw = m[4].trim()
    if (!wageRaw.startsWith('£') && wageRaw !== '') continue
    const { name, nationality } = splitRawName(m[1], clubName)
    if (!name) continue
    rows.push({
      name,
      nationality,
      age: Number(m[2]),
      fmPos: m[3].trim(),
      wageWeeklyGbp: parseMoneyGbp(wageRaw),
      valueGbp: parseMoneyGbp(m[5].trim()),
      estimatedCostGbp: parseMoneyGbp(m[6].trim()),
      contractExpires: normalizeDate(m[7].trim()) || null,
      peaked: peakedNames.has(name),
      clubKey,
      club: clubName,
    })
  }
  return rows
}

function parsePersonMd(md) {
  const text = String(md)
  const header = text.match(
    /ID\s+(\d+)\s+Name\s+(.+?)\s+Age\s+(\d+)\s+DOB\s+(\S+)\s+Gender\s+(\S+)\s+Nationality\s+(.+?)\s+Contracted Club\s+(.+?)\s+Club Contract Type\s+([^\n]+?)\s+Wage\s+(£[^\s]+)\s+Contract Expires\s+(\S+)\s+Contract Signed\s+(\S+)\s+Value\s+(£[^\s]+)\s+Estimated Cost\s+(£[^\s]+)\s+Position\s+(.+?)\s+Current Ability/i,
  )
  const bio = {
    fmId: null,
    name: null,
    age: null,
    dob: null,
    gender: null,
    nationality: null,
    club: null,
    contractType: null,
    wageWeeklyGbp: null,
    contractExpires: null,
    contractSigned: null,
    valueGbp: null,
    estimatedCostGbp: null,
    fmPos: null,
    caRemaining: null,
    starRating: null,
    peaked: false,
    fixedPotential: null,
    injuryProne: null,
    releaseClauseGbp: undefined,
    developNote: null,
  }
  if (header) {
    bio.fmId = header[1]
    bio.name = header[2].trim()
    bio.age = Number(header[3])
    bio.dob = normalizeDate(header[4])
    bio.gender = header[5]
    bio.nationality = header[6].trim()
    bio.club = header[7].trim()
    bio.contractType = header[8].trim()
    bio.wageWeeklyGbp = parseMoneyGbp(header[9])
    bio.contractExpires = normalizeDate(header[10])
    bio.contractSigned = normalizeDate(header[11])
    bio.valueGbp = parseMoneyGbp(header[12])
    bio.estimatedCostGbp = parseMoneyGbp(header[13])
    bio.fmPos = header[14].trim()
  }
  const caRem = text.match(/CA Remaining\s+(\d+)/i)
  if (caRem) bio.caRemaining = Number(caRem[1])
  const stars = text.match(/rate .+? (\d+)\s*\/\s*5 stars/i)
  if (stars) bio.starRating = Number(stars[1])
  if (/has peaked and will not improve/i.test(text)) {
    bio.peaked = true
    bio.developNote = 'has peaked and will not improve in FM26'
  } else if (/unlikely to improve much/i.test(text)) {
    bio.developNote = 'unlikely to improve much in FM26'
  }
  if (/has fixed potential/i.test(text)) bio.fixedPotential = true
  else if (/has random potential/i.test(text)) bio.fixedPotential = false
  if (/is not injury prone/i.test(text)) bio.injuryProne = false
  else if (/injury prone/i.test(text)) bio.injuryProne = true
  if (/does not have a minimum fee release clause/i.test(text)) bio.releaseClauseGbp = null
  else {
    const rc = text.match(/release clause[^.£]*?(£[\d.]+[kmb]?)/i)
    if (rc) bio.releaseClauseGbp = parseMoneyGbp(rc[1])
  }
  return bio
}

function slugify(name) {
  return name
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

const byName = {}

// 1) Team pages
for (const key of Object.keys(CLUB_NAMES)) {
  const file = path.join(DUMP, `${key}_team.md`)
  if (!fs.existsSync(file)) {
    console.warn('missing team dump', key)
    continue
  }
  const rows = parseTeamPlayers(fs.readFileSync(file, 'utf8'), key)
  console.log(key, 'team rows', rows.length)
  for (const r of rows) {
    byName[r.name] = {
      ...(byName[r.name] ?? {}),
      ...r,
      sourceUrl: `https://sortitoutsi.net/football-manager-2026/team/`,
    }
  }
}

// 2) Person pages override / fill
const personDir = path.join(DUMP, 'persons')
if (fs.existsSync(personDir)) {
  for (const f of fs.readdirSync(personDir).filter((x) => x.endsWith('.md'))) {
    const bio = parsePersonMd(fs.readFileSync(path.join(personDir, f), 'utf8'))
    if (!bio.name) continue
    const prev = byName[bio.name] ?? {}
    byName[bio.name] = {
      ...prev,
      ...Object.fromEntries(Object.entries(bio).filter(([, v]) => v !== null && v !== undefined)),
      sourceUrl: bio.fmId
        ? `https://sortitoutsi.net/football-manager-2026/person/${bio.fmId}/${slugify(bio.name)}`
        : prev.sourceUrl,
    }
  }
}

// Keep only names we care about in playersEng (+ extras from team pages that match)
const engNames = new Set()
for (const rows of Object.values(ENG.clubs ?? {})) {
  for (const r of rows) engNames.add(r.name)
}

const filtered = {}
for (const name of engNames) {
  if (byName[name]) filtered[name] = byName[name]
}

// Also keep team-parsed names that match loosely (accent-insensitive)
function norm(n) {
  return n
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}
const byNorm = Object.fromEntries(Object.entries(byName).map(([k, v]) => [norm(k), v]))
for (const name of engNames) {
  if (filtered[name]) continue
  const hit = byNorm[norm(name)]
  if (hit) filtered[name] = { ...hit, name }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      source: 'sortitoutsi.net FM26',
      note: 'Personal/local display only — not for redistribution or commercial sale.',
      byName: filtered,
    },
    null,
    2,
  ) + '\n',
)

console.log(
  'Wrote',
  OUT,
  'bios',
  Object.keys(filtered).length,
  '/',
  engNames.size,
  'fullPerson',
  Object.values(filtered).filter((b) => b.fmId && b.dob).length,
)
