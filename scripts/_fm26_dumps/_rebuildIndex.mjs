import fs from 'fs'
import path from 'path'

const DIR = path.resolve('scripts/_fm26_dumps/persons')
const INDEX = path.resolve('scripts/_fm26_dumps/person_index.jsonl')
const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.md'))
const lines = []
for (const f of files) {
  const id = f.replace('.md', '')
  const md = fs.readFileSync(path.join(DIR, f), 'utf8')
  const nameM = md.match(/Name\s+(.+?)\s+Age/)
  const name = nameM ? nameM[1].trim() : id
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  const url = `https://sortitoutsi.net/football-manager-2026/person/${id}/${slug}`
  lines.push(JSON.stringify({ name, fmId: id, url, slug }))
}
fs.writeFileSync(INDEX, lines.join('\n') + '\n')
console.log('rebuilt index entries', lines.length)
