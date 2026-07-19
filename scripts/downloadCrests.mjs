/**
 * Download club crests from FMInside logo CDN.
 * https://img.fminside.net/logos/Men/Clubs/Normal/{fmClubId}.png
 * Usage: node scripts/downloadCrests.mjs
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const OUT = path.resolve('public/crests')
const CLUB_IDS = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/fmClubIds.json'), 'utf8'))

function hasUsablePng(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 500) return false
  const buf = Buffer.alloc(4)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, buf, 0, 4, 0)
  fs.closeSync(fd)
  return buf[0] === 0x89 && buf[1] === 0x50
}

function curlDownload(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      '--max-time',
      '25',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0
}

fs.mkdirSync(OUT, { recursive: true })
const manifest = fs.existsSync(path.join(OUT, 'manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(OUT, 'manifest.json'), 'utf8'))
  : {}

let ok = 0
let fail = 0
let skip = 0

for (const [key, id] of Object.entries(CLUB_IDS)) {
  const dest = path.join(OUT, `${key}.png`)
  if (hasUsablePng(dest) && process.argv.includes('--skip-existing')) {
    manifest[key] = `/crests/${key}.png`
    skip++
    continue
  }
  const url = `https://img.fminside.net/logos/Men/Clubs/Normal/${id}.png`
  const tmp = path.join(OUT, `_tmp_crest.png`)
  if (!curlDownload(url, tmp) || !hasUsablePng(tmp)) {
    fail++
    console.error('FAIL', key, id)
    try {
      fs.unlinkSync(tmp)
    } catch {}
    continue
  }
  try {
    if (fs.existsSync(dest)) fs.unlinkSync(dest)
  } catch {}
  try {
    fs.renameSync(tmp, dest)
  } catch {
    fs.copyFileSync(tmp, dest)
    try {
      fs.unlinkSync(tmp)
    } catch {}
  }
  manifest[key] = `/crests/${key}.png`
  ok++
  console.log('OK', key, id, fs.statSync(dest).size)
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n')
fs.writeFileSync(
  path.join(OUT, 'README.txt'),
  'Club crests from FMInside logos CDN for local/personal display only.\nNot for redistribution or commercial sale.\nSource: img.fminside.net/logos\n',
)
console.log({ ok, fail, skip, total: Object.keys(CLUB_IDS).length })
