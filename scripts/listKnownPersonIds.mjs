/**
 * Write compact person MD from known SortItOutSI IDs, then user/agents can enrich.
 * Also accepts inline header+faq text.
 */
import fs from 'fs'
import path from 'path'

const DIR = path.resolve('scripts/_fm26_dumps/persons')
fs.mkdirSync(DIR, { recursive: true })

/** id → { name, slug } */
const KNOWN = {
  49039004: { name: 'William Saliba', slug: 'william-saliba' },
  19351309: { name: 'Gabriel Martinelli', slug: 'gabriel-martinelli' },
  53095137: { name: 'Martin Ødegaard', slug: 'martin-odegaard' },
  29111433: { name: 'David Raya', slug: 'david-raya' },
  93070271: { name: 'Viktor Gyökeres', slug: 'viktor-gyokeres' },
  91151081: { name: 'Kai Havertz', slug: 'kai-havertz' },
  29156522: { name: 'Ebere Eze', slug: 'ebere-eze' },
  29141472: { name: 'Benjamin White', slug: 'benjamin-white' },
  37063644: { name: 'Jurriën Timber', slug: 'jurrien-timber' },
  37076092: { name: 'Noni Madueke', slug: 'noni-madueke' },
  29179241: { name: 'Erling Haaland', slug: 'erling-haaland' },
  43252073: { name: 'Gianluigi Donnarumma', slug: 'gianluigi-donnarumma' },
  55070299: { name: 'Rúben Dias', slug: 'ruben-dias' },
  28108494: { name: 'Phil Foden', slug: 'phil-foden' },
  67217524: { name: 'Rodri', slug: 'rodri' },
  98028755: { name: 'Mohamed Salah', slug: 'mohamed-salah' },
  37024025: { name: 'Virgil van Dijk', slug: 'virgil-van-dijk' },
  91193048: { name: 'Florian Wirtz', slug: 'florian-wirtz' },
  19058734: { name: 'Alisson', slug: 'alisson' },
  93070286: { name: 'Alexander Isak', slug: 'alexander-isak' },
  28106491: { name: 'Declan Rice', slug: 'declan-rice' },
  28122642: { name: 'Bukayo Saka', slug: 'bukayo-saka' },
}

const indexPath = path.resolve('scripts/_fm26_dumps/person_index.jsonl')
const index = fs.existsSync(indexPath) ? fs.readFileSync(indexPath, 'utf8') : ''

for (const [id, meta] of Object.entries(KNOWN)) {
  const url = `https://sortitoutsi.net/football-manager-2026/person/${id}/${meta.slug}`
  if (!index.includes(String(id))) {
    fs.appendFileSync(
      indexPath,
      JSON.stringify({ name: meta.name, fmId: id, url, slug: meta.slug }) + '\n',
    )
  }
}

console.log('index entries', Object.keys(KNOWN).length)
console.log('Fetch these URLs with WebFetch and save to persons/{id}.md')
for (const [id, meta] of Object.entries(KNOWN)) {
  console.log(`${id}\t${meta.name}\thttps://sortitoutsi.net/football-manager-2026/person/${id}/${meta.slug}`)
}
