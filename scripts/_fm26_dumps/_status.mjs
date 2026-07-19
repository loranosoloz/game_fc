import fs from 'fs'
import path from 'path'

const idx = fs.readFileSync('scripts/_fm26_dumps/person_index.jsonl', 'utf8')
console.log('index bytes', idx.length)
console.log('index lines', idx.trim().split('\n').filter(Boolean).length)
console.log(idx.slice(0, 500))

const files = fs.readdirSync('scripts/_fm26_dumps/persons').filter((f) => f.endsWith('.md'))
const eng = JSON.parse(fs.readFileSync('src/data/world/playersEng.json', 'utf8'))
const clubs = ['tot', 'new', 'avl', 'bre', 'eve']
const want = new Map()
for (const c of clubs) {
  for (const p of eng.clubs[c]) want.set(p.name.toLowerCase(), { club: c, ...p })
}

const found = []
for (const f of files) {
  const md = fs.readFileSync(path.join('scripts/_fm26_dumps/persons', f), 'utf8')
  const m = md.match(/Name\s+(.+?)\s+Age/)
  if (!m) continue
  const name = m[1].trim()
  const meta = want.get(name.toLowerCase())
  if (meta) found.push({ id: f.replace('.md', ''), name, club: meta.club, ovr: meta.ovr })
}
found.sort((a, b) => b.ovr - a.ovr)
console.log('\nexact target hits', found.length)
for (const x of found) console.log(x.ovr, x.club, x.name, x.id)

const missing = [...want.values()]
  .filter((p) => !found.some((f) => f.name.toLowerCase() === p.name.toLowerCase()))
  .sort((a, b) => b.ovr - a.ovr)
console.log('\nmissing top 45:')
missing.slice(0, 45).forEach((p, i) => console.log(String(i + 1).padStart(2), p.ovr, p.club, p.name))
