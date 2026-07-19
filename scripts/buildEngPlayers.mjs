/**
 * Build src/data/world/playersEng.json from SortItOutSI FM26 markdown dumps.
 * Usage: node scripts/buildEngPlayers.mjs [path-to-md-or-txt...]
 */
import fs from 'fs'
import path from 'path'

const CLUB_SUFFIXES = [
  'Manchester City',
  'Manchester United',
  'Tottenham Hotspur',
  'Aston Villa',
  'Crystal Palace',
  'West Ham United',
  'Wolverhampton Wanderers',
  'Brighton & Hove Albion',
  'Nottingham Forest',
  'Newcastle United',
  'AFC Bournemouth',
  'Leeds United',
  'Brentford',
  'Liverpool',
  'Chelsea',
  'Arsenal',
  'Everton',
  'Fulham',
  'Burnley',
  'Sunderland',
]

const KEY_BY_NAME = {
  'Manchester City': 'mci',
  Arsenal: 'ars',
  Liverpool: 'liv',
  Chelsea: 'che',
  'Tottenham Hotspur': 'tot',
  'Manchester United': 'mun',
  'Newcastle United': 'new',
  'Aston Villa': 'avl',
  'West Ham United': 'whu',
  'Brighton & Hove Albion': 'bha',
  Fulham: 'ful',
  'Crystal Palace': 'cry',
  'Wolverhampton Wanderers': 'wol',
  Everton: 'eve',
  'AFC Bournemouth': 'bou',
  Brentford: 'bre',
  'Nottingham Forest': 'not',
  Burnley: 'bur',
  'Leeds United': 'lee',
  Sunderland: 'sun',
}

const CLUB_ABILITY = {
  mci: 91,
  liv: 91,
  ars: 90,
  che: 85,
  mun: 84,
  new: 84,
  tot: 83,
  avl: 82,
  bha: 81,
  not: 80,
  bou: 79,
  cry: 79,
  ful: 79,
  bre: 78,
  eve: 78,
  whu: 78,
  lee: 76,
  sun: 76,
  wol: 76,
  bur: 74,
}

function mapRole(fmPos) {
  const p = fmPos.toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (/\bST\b/.test(p) || p.includes('F C') || p.includes('AM/F')) return 'ST'
  if (p.includes('AM RL') || p.includes('AM RLC')) {
    if (p.includes('ST') || p.includes('F C')) return 'ST'
    return 'CAM'
  }
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

function parseWageK(w) {
  const m = String(w).match(/£([\d.]+)k/i)
  return m ? Number(m[1]) : 0
}

function ovrFrom(wageK, clubAbil, idx) {
  let o = clubAbil - Math.floor(idx * 0.5)
  if (wageK >= 350) o = Math.max(o, 90)
  else if (wageK >= 250) o = Math.max(o, 87)
  else if (wageK >= 180) o = Math.max(o, 85)
  else if (wageK >= 120) o = Math.max(o, 82)
  else if (wageK >= 70) o = Math.max(o, 78)
  else if (wageK >= 40) o = Math.max(o, 74)
  else if (wageK >= 20) o = Math.max(o, 70)
  else o = Math.min(o, 68)
  return Math.max(55, Math.min(94, Math.round(o)))
}

function stripName(raw, clubName) {
  let s = raw.trim()
  if (s.endsWith(clubName)) s = s.slice(0, -clubName.length).trim()
  // remove trailing nation token(s) — last word(s) that aren't part of known multi-word nations
  // Format: "Name Nation Club" already stripped club; nation is last 1–3 tokens
  const nations = [
    'Northern Ireland',
    'Republic of Ireland',
    'Burkina Faso',
    'Guinea-Bissau',
    'Bosnia and Herzegovina',
    'North Macedonia',
    'Czechia',
    'South Korea',
    'United States',
    'Costa Rica',
    'Saudi Arabia',
    'Ivory Coast',
    'Cape Verde',
    'China PR',
    'The Gambia',
    'DR Congo',
    'Curaçao',
    'Saint Kitts & Nevis',
  ]
  for (const n of nations) {
    if (s.endsWith(n)) return s.slice(0, -n.length).trim()
  }
  // single-word nation
  const parts = s.split(/\s+/)
  if (parts.length >= 2) return parts.slice(0, -1).join(' ')
  return s
}

function parseFile(text) {
  const loanAt = text.indexOf('Loaned Out Players')
  const block = loanAt > 0 ? text.slice(0, loanAt) : text
  const byClub = {}
  for (const line of block.split(/\n/)) {
    const m = line.match(/^\|\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*([^|]+)\s*\|\s*(£[^|]+)\s*\|/)
    if (!m) continue
    const raw = m[1].trim()
    const clubName = CLUB_SUFFIXES.find((c) => raw.endsWith(c))
    if (!clubName) continue
    const key = KEY_BY_NAME[clubName]
    if (!key) continue
    const name = stripName(raw, clubName)
    if (!name || name.length < 2) continue
    const age = Number(m[2])
    const pos = m[3].trim()
    const wage = m[4].trim()
    const wageK = parseWageK(wage)
    // senior first team: skip very low wage youth unless already in top
    ;(byClub[key] ??= []).push({ name, age, pos, wage, wageK, role: mapRole(pos) })
  }
  return byClub
}

function finalize(byClub) {
  const out = {
    source: 'sortitoutsi.net FM26 Premier League',
    sourceUrl: 'https://sortitoutsi.net/football-manager-2026/competition/11/premier-league',
    clubs: {},
  }
  for (const [key, list] of Object.entries(byClub)) {
    // keep top by wage, max 28, prefer age 16–38 with wage>=8k or top 22
    const sorted = [...list].sort((a, b) => b.wageK - a.wageK)
    const senior = sorted.filter((p) => p.wageK >= 8 || p.age >= 21).slice(0, 28)
    const abil = CLUB_ABILITY[key] ?? 75
    out.clubs[key] = senior.map((p, idx) => ({
      name: p.name,
      role: p.role,
      age: p.age,
      ovr: ovrFrom(p.wageK, abil, idx),
      fmPos: p.pos,
    }))
  }
  return out
}

const files = process.argv.slice(2)
const merged = {}
for (const f of files) {
  const text = fs.readFileSync(f, 'utf8')
  const part = parseFile(text)
  for (const [k, arr] of Object.entries(part)) {
    merged[k] = [...(merged[k] ?? []), ...arr]
  }
}

// dedupe by name per club
for (const k of Object.keys(merged)) {
  const seen = new Set()
  merged[k] = merged[k].filter((p) => {
    if (seen.has(p.name)) return false
    seen.add(p.name)
    return true
  })
}

const out = finalize(merged)
const dest = path.resolve('src/data/world/playersEng.json')
fs.mkdirSync(path.dirname(dest), { recursive: true })
fs.writeFileSync(dest, JSON.stringify(out, null, 2))
console.log(
  'Wrote',
  dest,
  Object.fromEntries(Object.entries(out.clubs).map(([k, v]) => [k, v.length])),
)
