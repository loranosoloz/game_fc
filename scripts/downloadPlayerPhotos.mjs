/**
 * Download player faces from FMInside CDN (primary photo source).
 * https://img.fminside.net/facesfm26/{fmId}.png
 *
 * Usage:
 *   node scripts/downloadPlayerPhotos.mjs
 *   node scripts/downloadPlayerPhotos.mjs --league=esp,ger
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const OUT = path.join(ROOT, 'public/players')
const MAP_OUT = path.join(ROOT, 'src/data/world/playerPhotos.json')

const PACKS = {
  eng: path.join(ROOT, 'src/data/world/playersEng.json'),
  eng2: path.join(ROOT, 'src/data/world/playersEng2.json'),
  esp: path.join(ROOT, 'src/data/world/playersEsp.json'),
  esp2: path.join(ROOT, 'src/data/world/playersEsp2.json'),
  ger: path.join(ROOT, 'src/data/world/playersGer.json'),
  ger2: path.join(ROOT, 'src/data/world/playersGer2.json'),
  fra: path.join(ROOT, 'src/data/world/playersFra.json'),
  fra2: path.join(ROOT, 'src/data/world/playersFra2.json'),
  ita: path.join(ROOT, 'src/data/world/playersIta.json'),
  ita2: path.join(ROOT, 'src/data/world/playersIta2.json'),
  tha: path.join(ROOT, 'src/data/world/playersTha.json'),
  tha2: path.join(ROOT, 'src/data/world/playersTha2.json'),
  jpn: path.join(ROOT, 'src/data/world/playersJpn.json'),
  jpn2: path.join(ROOT, 'src/data/world/playersJpn2.json'),
  kor: path.join(ROOT, 'src/data/world/playersKor.json'),
  kor2: path.join(ROOT, 'src/data/world/playersKor2.json'),
  bra: path.join(ROOT, 'src/data/world/playersBra.json'),
  tur: path.join(ROOT, 'src/data/world/playersTur.json'),
  ned: path.join(ROOT, 'src/data/world/playersNed.json'),
  prt: path.join(ROOT, 'src/data/world/playersPrt.json'),
  bel: path.join(ROOT, 'src/data/world/playersBel.json'),
  sco: path.join(ROOT, 'src/data/world/playersSco.json'),
  aut: path.join(ROOT, 'src/data/world/playersAut.json'),
  sui: path.join(ROOT, 'src/data/world/playersSui.json'),
  den: path.join(ROOT, 'src/data/world/playersDen.json'),
  gre: path.join(ROOT, 'src/data/world/playersGre.json'),
  vie: path.join(ROOT, 'src/data/world/playersVie.json'),
  idn: path.join(ROOT, 'src/data/world/playersIdn.json'),
  mys: path.join(ROOT, 'src/data/world/playersMys.json'),
  sgp: path.join(ROOT, 'src/data/world/playersSgp.json'),
  sau: path.join(ROOT, 'src/data/world/playersSau.json'),
}

const ID_FILES = {
  eng: 'eng_fm_ids.json',
  eng2: 'eng2_fm_ids.json',
  esp: 'esp_fm_ids.json',
  esp2: 'esp2_fm_ids.json',
  ger: 'ger_fm_ids.json',
  ger2: 'ger2_fm_ids.json',
  fra: 'fra_fm_ids.json',
  fra2: 'fra2_fm_ids.json',
  ita: 'ita_fm_ids.json',
  ita2: 'ita2_fm_ids.json',
  tha: 'tha_fm_ids.json',
  tha2: 'tha2_fm_ids.json',
  jpn: 'jpn_fm_ids.json',
  jpn2: 'jpn2_fm_ids.json',
  kor: 'kor_fm_ids.json',
  kor2: 'kor2_fm_ids.json',
  bra: 'bra_fm_ids.json',
  tur: 'tur_fm_ids.json',
  ned: 'ned_fm_ids.json',
  prt: 'prt_fm_ids.json',
  bel: 'bel_fm_ids.json',
  sco: 'sco_fm_ids.json',
  aut: 'aut_fm_ids.json',
  sui: 'sui_fm_ids.json',
  den: 'den_fm_ids.json',
  gre: 'gre_fm_ids.json',
  vie: 'vie_fm_ids.json',
  idn: 'idn_fm_ids.json',
  mys: 'mys_fm_ids.json',
  sgp: 'sgp_fm_ids.json',
  sau: 'sau_fm_ids.json',
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function hasUsablePng(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 1000) return false
  const buf = Buffer.alloc(8)
  const fd = fs.openSync(file, 'r')
  fs.readSync(fd, buf, 0, 8, 0)
  fs.closeSync(fd)
  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47
}

function curlDownload(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
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

function parseLeagues() {
  const arg = process.argv.find((a) => a.startsWith('--league='))
  const all = Object.keys(PACKS).filter((id) => fs.existsSync(PACKS[id]))
  if (!arg) return all
  const list = arg
    .slice('--league='.length)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
  for (const id of list) {
    if (!PACKS[id]) throw new Error(`Unknown league: ${id}`)
  }
  return list
}

function loadFmIds(leagueId) {
  const file = ID_FILES[leagueId]
  if (!file) return {}
  const p = path.join(ROOT, 'scripts/_fm26_dumps', file)
  if (!fs.existsSync(p)) return {}
  return JSON.parse(fs.readFileSync(p, 'utf8')).byName ?? {}
}

function writeMap(byName) {
  fs.writeFileSync(
    MAP_OUT,
    JSON.stringify(
      {
        source: 'FMInside facesfm26 → SortItOutSI cutoutfaces',
        note: 'Personal/local display only — not for redistribution or commercial sale.',
        byName,
      },
      null,
      2,
    ) + '\n',
  )
}

fs.mkdirSync(OUT, { recursive: true })
const leagues = parseLeagues()
const existing = fs.existsSync(MAP_OUT) ? JSON.parse(fs.readFileSync(MAP_OUT, 'utf8')) : { byName: {} }
const byName = { ...(existing.byName ?? {}) }

const jobs = []
for (const leagueId of leagues) {
  if (!fs.existsSync(PACKS[leagueId])) {
    console.warn('skip missing pack', leagueId)
    continue
  }
  const pack = JSON.parse(fs.readFileSync(PACKS[leagueId], 'utf8'))
  const ids = loadFmIds(leagueId)
  for (const rows of Object.values(pack.clubs ?? {})) {
    for (const row of rows) {
      const fmId = ids[row.name]?.fmId ? String(ids[row.name].fmId) : null
      if (!fmId) {
        jobs.push({ name: row.name, leagueId, fmId: null })
        continue
      }
      const key = `fmi-${fmId}`
      const dest = path.join(OUT, `${key}.png`)
      if (hasUsablePng(dest)) {
        byName[row.name] = key
        continue
      }
      jobs.push({ name: row.name, leagueId, fmId, key, dest })
    }
  }
}

const SOI_VERSIONS = [
  '2026.05',
  '2026.04',
  '2026.03',
  '2026.02',
  '2026.01',
  '2026.00',
  '2025.03',
  '2025.00',
]

function saveTmpAs(tmp, destKey) {
  const dest = path.join(OUT, `${destKey}.png`)
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
  return destKey
}

function tryDownloadFace(fmId) {
  const tmp = path.join(OUT, '_tmp_face.png')
  if (curlDownload(`https://img.fminside.net/facesfm26/${fmId}.png`, tmp) && hasUsablePng(tmp)) {
    return saveTmpAs(tmp, `fmi-${fmId}`)
  }
  try {
    fs.unlinkSync(tmp)
  } catch {}
  for (const ver of SOI_VERSIONS) {
    const url = `https://sortitoutsidospaces.b-cdn.net/megapacks/cutoutfaces/originals/${ver}/${fmId}.png`
    if (curlDownload(url, tmp) && hasUsablePng(tmp)) {
      return saveTmpAs(tmp, `soi-${fmId}`)
    }
    try {
      fs.unlinkSync(tmp)
    } catch {}
  }
  return null
}

console.log('leagues', leagues.join(','), 'jobs', jobs.length)

let ok = 0
let fail = 0
let skip = 0

for (let i = 0; i < jobs.length; i++) {
  const j = jobs[i]
  const progress = `[${i + 1}/${jobs.length}]`
  if (!j.fmId) {
    fail++
    if (i % 40 === 0) console.log(progress, 'NO FMID', j.leagueId, j.name)
    continue
  }
  const key = tryDownloadFace(j.fmId)
  if (!key) {
    fail++
    if (i % 30 === 0) console.log(progress, 'NO FACE', j.leagueId, j.name, j.fmId)
    continue
  }
  byName[j.name] = key
  ok++
  console.log(progress, 'OK', j.leagueId, j.name, key, fs.statSync(path.join(OUT, `${key}.png`)).size)
  if (i % 25 === 0) writeMap(byName)
  await sleep(60)
}

writeMap(byName)
fs.writeFileSync(
  path.join(OUT, 'README.txt'),
  'Player faces: FMInside facesfm26, fallback SortItOutSI cutoutfaces.\nPersonal/local display only — not for redistribution or commercial sale.\n',
)
console.log({ ok, fail, skip, mapped: Object.keys(byName).length })
