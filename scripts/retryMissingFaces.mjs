/**
 * Retry missing faces: FMInside → SortItOutSI cutout CDN → FotMob
 * SortItOutSI: https://sortitoutsidospaces.b-cdn.net/megapacks/cutoutfaces/originals/{ver}/{fmId}.png
 *
 * Usage: node scripts/retryMissingFaces.mjs
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import https from 'https'

const ROOT = path.resolve('.')
const OUT = path.join(ROOT, 'public/players')
const MAP_OUT = path.join(ROOT, 'src/data/world/playerPhotos.json')
const MISSING = path.join(ROOT, 'scripts/_fm26_dumps/missing_faces_retry.json')

/** Prefer newest-looking pack folders that actually host files */
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

function curlTo(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '--max-time',
      '35',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0 && fs.existsSync(dest)
}

function moveTmp(tmp, dest) {
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
}

function tryFmInside(fmId) {
  const tmp = path.join(OUT, '_tmp_retry_face.png')
  const url = `https://img.fminside.net/facesfm26/${fmId}.png`
  if (!curlTo(url, tmp) || !hasUsablePng(tmp)) {
    try {
      fs.unlinkSync(tmp)
    } catch {}
    return null
  }
  const key = `fmi-${fmId}`
  moveTmp(tmp, path.join(OUT, `${key}.png`))
  return key
}

function trySortItOutSi(fmId) {
  const tmp = path.join(OUT, '_tmp_retry_face.png')
  for (const ver of SOI_VERSIONS) {
    const url = `https://sortitoutsidospaces.b-cdn.net/megapacks/cutoutfaces/originals/${ver}/${fmId}.png`
    if (!curlTo(url, tmp) || !hasUsablePng(tmp)) {
      try {
        fs.unlinkSync(tmp)
      } catch {}
      continue
    }
    const key = `soi-${fmId}`
    moveTmp(tmp, path.join(OUT, `${key}.png`))
    return { key, ver }
  }
  return null
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(url, { headers: { 'User-Agent': 'FCManagerLocal/1.0', Accept: 'application/json' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          getJson(res.headers.location).then(resolve, reject)
          return
        }
        let data = ''
        res.on('data', (c) => (data += c))
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`HTTP ${res.statusCode}`))
            return
          }
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            reject(e)
          }
        })
      })
      .on('error', reject)
  })
}

function downloadHttps(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https
      .get(url, { headers: { 'User-Agent': 'FCManagerLocal/1.0' } }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          file.close()
          try {
            fs.unlinkSync(dest)
          } catch {}
          downloadHttps(res.headers.location, dest).then(resolve, reject)
          return
        }
        if (res.statusCode !== 200) {
          file.close()
          try {
            fs.unlinkSync(dest)
          } catch {}
          reject(new Error(`HTTP ${res.statusCode}`))
          return
        }
        res.pipe(file)
        file.on('finish', () => file.close(() => resolve(dest)))
      })
      .on('error', (err) => {
        fs.unlink(dest, () => reject(err))
      })
  })
}

async function tryFotmob(name, mapped) {
  let fotId = mapped && !String(mapped).startsWith('fmi-') && !String(mapped).startsWith('soi-') ? String(mapped) : null
  if (!fotId) {
    try {
      const data = await getJson(
        `https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(name)}&lang=en`,
      )
      const opts = (data?.squadMemberSuggest?.[0]?.options ?? []).filter((o) => !o.payload?.isCoach)
      if (opts.length) fotId = String(opts[0].payload.id)
    } catch {}
  }
  if (!fotId) return null
  const dest = path.join(OUT, `${fotId}.png`)
  try {
    await downloadHttps(`https://images.fotmob.com/image_resources/playerimages/${fotId}.png`, dest)
    if (hasUsablePng(dest)) return fotId
    try {
      fs.unlinkSync(dest)
    } catch {}
  } catch {}
  return null
}

function rebuildMissing() {
  const photos = JSON.parse(fs.readFileSync(MAP_OUT, 'utf8')).byName || {}
  const leagues = {
    eng: 'playersEng',
    eng2: 'playersEng2',
    esp: 'playersEsp',
    esp2: 'playersEsp2',
    ger: 'playersGer',
    ger2: 'playersGer2',
    fra: 'playersFra',
    fra2: 'playersFra2',
    ita: 'playersIta',
    ita2: 'playersIta2',
    tha: 'playersTha',
    tha2: 'playersTha2',
    jpn: 'playersJpn',
    jpn2: 'playersJpn2',
    kor: 'playersKor',
    kor2: 'playersKor2',
    bra: 'playersBra',
    tur: 'playersTur',
    ned: 'playersNed',
    prt: 'playersPrt',
    bel: 'playersBel',
    sco: 'playersSco',
    aut: 'playersAut',
    sui: 'playersSui',
    den: 'playersDen',
    gre: 'playersGre',
    vie: 'playersVie',
    idn: 'playersIdn',
    mys: 'playersMys',
    sgp: 'playersSgp',
    sau: 'playersSau',
  }
  const idFiles = {
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
  const missing = []
  for (const [league, file] of Object.entries(leagues)) {
    const packPath = path.join(ROOT, 'src/data/world', `${file}.json`)
    if (!fs.existsSync(packPath)) continue
    const pack = JSON.parse(fs.readFileSync(packPath, 'utf8'))
    const ids = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/_fm26_dumps', idFiles[league]), 'utf8'))
      .byName
    for (const rows of Object.values(pack.clubs ?? {})) {
      for (const r of rows) {
        const pid = photos[r.name]
        const ok = pid && hasUsablePng(path.join(OUT, `${pid}.png`))
        if (!ok) {
          missing.push({
            league,
            name: r.name,
            fmId: ids[r.name]?.fmId ? String(ids[r.name].fmId) : null,
            mapped: pid || null,
          })
        }
      }
    }
  }
  fs.writeFileSync(MISSING, JSON.stringify(missing, null, 2))
  return missing
}

fs.mkdirSync(OUT, { recursive: true })
const missing = rebuildMissing()
const map = JSON.parse(fs.readFileSync(MAP_OUT, 'utf8'))
const byName = { ...(map.byName ?? {}) }

let okFmi = 0
let okSoi = 0
let okFot = 0
let fail = 0

console.log('retry', missing.length)

for (let i = 0; i < missing.length; i++) {
  const m = missing[i]
  const progress = `[${i + 1}/${missing.length}]`
  if (!m.fmId) {
    fail++
    console.log(progress, 'NO FMID', m.name)
    continue
  }

  const fmi = tryFmInside(m.fmId)
  if (fmi) {
    byName[m.name] = fmi
    okFmi++
    console.log(progress, 'OK FMI', m.name, fmi)
    await sleep(60)
    continue
  }

  const soi = trySortItOutSi(m.fmId)
  if (soi) {
    byName[m.name] = soi.key
    okSoi++
    console.log(progress, 'OK SOI', m.name, soi.key, soi.ver)
    await sleep(60)
    continue
  }

  const fot = await tryFotmob(m.name, m.mapped)
  await sleep(120)
  if (fot) {
    byName[m.name] = fot
    okFot++
    console.log(progress, 'OK FOT', m.name, fot)
    continue
  }

  fail++
  console.log(progress, 'FAIL', m.league, m.name, m.fmId)
  if (i % 15 === 0) {
    fs.writeFileSync(
      MAP_OUT,
      JSON.stringify({ source: map.source, note: map.note, byName }, null, 2) + '\n',
    )
  }
}

fs.writeFileSync(
  MAP_OUT,
  JSON.stringify(
    {
      source: 'FMInside facesfm26 → SortItOutSI cutoutfaces → FotMob',
      note: 'Personal/local display only — not for redistribution or commercial sale.',
      byName,
    },
    null,
    2,
  ) + '\n',
)

console.log({ okFmi, okSoi, okFot, fail, total: missing.length })
