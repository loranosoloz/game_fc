import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DUMP = __dirname

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
  'Czechia',
  'New Zealand',
  'South Africa',
  'Sierra Leone',
]

function splitRawName(raw, clubName) {
  let s = String(raw).trim()
  if (s.endsWith(clubName)) s = s.slice(0, -clubName.length).trim()
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

function extractTableRows(block) {
  const rows = []
  for (const line of block.split('\n')) {
    const m = line.match(
      /^\|\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|\s*([^|]*)\s*\|/,
    )
    if (!m) continue
    const wage = m[4].trim()
    // skip header / empty name rows; allow £0 or blank wage
    if (!m[1].trim() || m[1].trim() === 'Name') continue
    if (wage && !wage.startsWith('£') && wage !== '') continue
    rows.push({
      rawName: m[1].trim(),
      age: Number(m[2]),
      pos: m[3].trim(),
      wage,
      value: m[5].trim(),
      cost: m[6].trim(),
      expires: m[7].trim(),
    })
  }
  return rows
}

function parseTeamMd(md, clubKey) {
  const clubName = CLUB_NAMES[clubKey]
  const playersStart = md.search(/# .+Players in FM26/i)
  const loanStart = md.search(/# .+Loaned Out Players/i)
  const peakedStart = md.search(/# .+Peaked Players/i)
  const staffStart = md.search(/# .+Staff in FM26/i)

  let playersEnd = md.length
  for (const i of [loanStart, peakedStart, staffStart]) {
    if (i > playersStart && i < playersEnd) playersEnd = i
  }
  const playersBlock = playersStart >= 0 ? md.slice(playersStart, playersEnd) : ''

  let peakedEnd = md.length
  // peaked usually after staff; take to footer / end
  const footer = md.search(/\n##### sortitoutsi/i)
  if (footer > peakedStart && footer < peakedEnd) peakedEnd = footer
  const peakedBlock = peakedStart >= 0 ? md.slice(peakedStart, peakedEnd) : ''

  const players = extractTableRows(playersBlock).map((r) => {
    const { name, nationality } = splitRawName(r.rawName, clubName)
    return { ...r, name, nationality }
  })

  const peaked = []
  for (const r of extractTableRows(peakedBlock)) {
    const { name } = splitRawName(r.rawName, clubName)
    if (name && !peaked.includes(name)) peaked.push(name)
  }

  return {
    players,
    peaked,
    meta: {
      hasPlayersSection: playersStart >= 0,
      hasPeakedSection: peakedStart >= 0,
      playerCount: players.length,
      peakedCount: peaked.length,
    },
  }
}

const out = {}
const summary = []

for (const key of Object.keys(CLUB_NAMES)) {
  const file = path.join(DUMP, `${key}_team.md`)
  if (!fs.existsSync(file)) {
    summary.push({ key, ok: false, error: 'missing_md' })
    continue
  }
  const parsed = parseTeamMd(fs.readFileSync(file, 'utf8'), key)
  out[key] = {
    players: parsed.players,
    peaked: parsed.peaked,
  }
  summary.push({
    key,
    ok: true,
    players: parsed.meta.playerCount,
    peaked: parsed.meta.peakedCount,
    hasPeakedSection: parsed.meta.hasPeakedSection,
  })
}

const outPath = path.join(DUMP, 'team_profiles_raw.json')
fs.writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n')
console.log(JSON.stringify(summary, null, 2))
console.log('wrote', outPath)
