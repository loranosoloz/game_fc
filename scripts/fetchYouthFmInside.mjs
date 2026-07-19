/**
 * Fetch FMInside dumps for youth players missing attrs.
 * Usage: node scripts/fetchYouthFmInside.mjs [--limit=50]
 */
import fs from 'fs'
import path from 'path'
import { curlGet, sleep, slugify } from './lib/fmtuPack.mjs'
import { htmlToMd } from './lib/fmInsideHtmlToMd.mjs'

const ROOT = path.resolve('.')
const FMIN = path.join(ROOT, 'scripts/_fm26_dumps/fminside')
const ATTRS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/fmInsideAttrs.json'), 'utf8'))
const byName = ATTRS.byName ?? {}

const idFiles = ['eng', 'esp', 'ger', 'fra', 'ita'].map((id) =>
  path.join(ROOT, `scripts/_fm26_dumps/${id}_fm_ids.json`),
)

const limitArg = process.argv.find((a) => a.startsWith('--limit='))
const limit = limitArg ? Number(limitArg.slice('--limit='.length)) : 9999

const queue = []
for (const file of idFiles) {
  if (!fs.existsSync(file)) continue
  const ids = JSON.parse(fs.readFileSync(file, 'utf8'))
  for (const [name, meta] of Object.entries(ids.byName ?? {})) {
    if (!meta.youth) continue
    if (byName[name]?.attrs?.technical && Object.keys(byName[name].attrs.technical).length >= 5) continue
    const dest = path.join(FMIN, `${meta.fmId}.md`)
    if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
      const md = fs.readFileSync(dest, 'utf8')
      if (/###\s*Technical[\s\S]*?\|\s*\d+\s*\|/.test(md)) continue
    }
    queue.push({ name, fmId: String(meta.fmId), slug: meta.slug || slugify(name) })
  }
}

console.log('youth missing FM', queue.length, 'fetching up to', limit)
fs.mkdirSync(FMIN, { recursive: true })
const tmp = path.join(FMIN, '_tmp_youth.html')
let ok = 0
let fail = 0
for (let i = 0; i < Math.min(queue.length, limit); i++) {
  const item = queue[i]
  const url = `https://fminside.net/players/7-fm-26/${item.fmId}-${item.slug}`
  if (!curlGet(url, tmp)) {
    fail++
    console.log(`[${i + 1}] CURL FAIL ${item.name}`)
    continue
  }
  const html = fs.readFileSync(tmp, 'utf8')
  if (html.length < 5000 || /just a moment|Too Many Requests/i.test(html)) {
    fail++
    console.log(`[${i + 1}] BLOCK ${item.name}`)
  } else {
    const md = htmlToMd(html, item.fmId)
    fs.writeFileSync(path.join(FMIN, `${item.fmId}.md`), md)
    ok++
    if (ok % 25 === 0 || i < 3) console.log(`[${i + 1}/${queue.length}] OK ${item.name}`)
  }
  await sleep(280 + Math.floor(Math.random() * 180))
}
try {
  fs.unlinkSync(tmp)
} catch {}
console.log({ ok, fail, queued: queue.length })
