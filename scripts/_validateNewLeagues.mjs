import fs from 'fs'

const cfg = JSON.parse(fs.readFileSync('scripts/leagueClubConfigs.json', 'utf8'))
const fm = JSON.parse(fs.readFileSync('src/data/world/fmClubIds.json', 'utf8'))
const div2 = fs.readFileSync('src/data/world/div2Clubs.ts', 'utf8')
const leagues =
  fs.readFileSync('src/data/world/leaguesCore.ts', 'utf8') +
  fs.readFileSync('src/data/world/leaguesRest.ts', 'utf8') +
  fs.readFileSync('src/data/world/leaguesLatinThai.ts', 'utf8') +
  fs.readFileSync('src/data/world/leaguesExtra.ts', 'utf8')

const oldKeys = new Set([
  ...Object.keys(fm),
  ...(div2.match(/key:\s*'([a-z0-9]+)'/g) || [])
    .map((s) => s.match(/'([^']+)'/)[1])
    .filter((_, i, arr) => {
      // approximate: only count keys before jpn: block
      return true
    }),
  ...(leagues.match(/key:\s*'([a-z0-9]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]),
])

// Rebuild oldKeys carefully: fm + eng..tha from div2 + big5/tha from leagues files without Extra
const div2Old = div2.split('  jpn: [')[0]
const leaguesOld =
  fs.readFileSync('src/data/world/leaguesCore.ts', 'utf8') +
  fs.readFileSync('src/data/world/leaguesRest.ts', 'utf8') +
  fs.readFileSync('src/data/world/leaguesLatinThai.ts', 'utf8')
const baseline = new Set([
  ...Object.keys(fm),
  ...(div2Old.match(/key:\s*'([a-z0-9]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]),
  ...(leaguesOld.match(/key:\s*'([a-z0-9]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]),
])

const expected = {
  jpn: 20, jpn2: 20, kor: 12, kor2: 12, bra: 20, tur: 18, ned: 18, prt: 18,
  bel: 16, sco: 12, aut: 12, sui: 12, den: 12, gre: 14,
}

const seen = new Map()
const dups = []
const collide = []
for (const [lid, clubs] of Object.entries(cfg)) {
  if (!Array.isArray(clubs)) continue
  console.log(lid, clubs.length, 'expected', expected[lid] ?? '?')
  if (expected[lid] && clubs.length !== expected[lid]) console.log('  SIZE MISMATCH')
  for (const c of clubs) {
    if (seen.has(c.key)) dups.push(`${c.key}: ${seen.get(c.key)} vs ${lid}`)
    else seen.set(c.key, lid)
    if (baseline.has(c.key)) collide.push(`${c.key} (${lid} ${c.name})`)
  }
}

const remaps = ['chp', 'aty', 'ceb', 'stg', 'yob', 'gcz', 'scb', 'clt', 'rsc', 'lvs', 'bsl', 'sgz', 'kop', 'fsr']
console.log('internalDupes', dups)
console.log('vsBaseline', collide)
console.log(
  'remaps',
  remaps.map((k) => `${k}:${seen.has(k) ? 'ok' : 'MISSING'}`).join(' '),
)

// leaguesExtra club counts
const extra = fs.readFileSync('src/data/world/leaguesExtra.ts', 'utf8')
for (const id of ['jpn', 'kor', 'bra', 'tur', 'ned', 'prt', 'bel', 'sco', 'aut', 'sui', 'den', 'gre']) {
  const m = extra.match(new RegExp(`id: '${id}'[\\s\\S]*?clubs: \\[([\\s\\S]*?)\\n    \\],`))
  const n = m ? (m[1].match(/key:/g) || []).length : 0
  const exp = expected[id]
  console.log('extra', id, n, n === exp ? 'ok' : `WANT ${exp}`)
}
