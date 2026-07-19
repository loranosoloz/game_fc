/**
 * Download coach faces from FotMob (managers flagged isCoach).
 * https://images.fotmob.com/image_resources/playerimages/{id}.png
 *
 * Usage:
 *   node scripts/downloadCoachPhotos.mjs
 *   node scripts/downloadCoachPhotos.mjs --force
 */
import fs from 'fs'
import path from 'path'
import https from 'https'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const OUT = path.join(ROOT, 'public/coaches')
const MAP_OUT = path.join(ROOT, 'src/data/world/coachPhotos.json')
const COACHES = path.join(ROOT, 'src/data/worldCoaches.json')
const FORCE = process.argv.includes('--force')

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function hasUsablePng(file) {
  if (!fs.existsSync(file) || fs.statSync(file).size < 800) return false
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
  return r.status === 0 && hasUsablePng(dest)
}

function getJson(url) {
  return new Promise((resolve, reject) => {
    https
      .get(
        url,
        {
          headers: {
            'User-Agent': 'FCManagerLocal/1.0',
            Accept: 'application/json',
          },
        },
        (res) => {
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
        },
      )
      .on('error', reject)
  })
}

async function findFotmobCoachId(name) {
  const data = await getJson(
    `https://apigw.fotmob.com/searchapi/suggest?term=${encodeURIComponent(name)}&lang=en`,
  )
  const opts = data?.squadMemberSuggest?.[0]?.options ?? []
  // prefer isCoach
  const coach = opts.find((o) => o.payload?.isCoach)
  if (coach?.payload?.id) return String(coach.payload.id)
  // fallback: exact name match without requiring isCoach (some retired managers)
  const exact = opts.find((o) => String(o.text || '').split('|')[0]?.toLowerCase() === name.toLowerCase())
  if (exact?.payload?.id) return String(exact.payload.id)
  if (opts[0]?.payload?.id) return String(opts[0].payload.id)
  return null
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  const db = JSON.parse(fs.readFileSync(COACHES, 'utf8'))
  const coaches = db.coaches ?? []
  let map = { byId: {}, byName: {}, source: 'FotMob playerimages (isCoach)', generatedAt: '' }
  if (fs.existsSync(MAP_OUT) && !FORCE) {
    try {
      map = { ...map, ...JSON.parse(fs.readFileSync(MAP_OUT, 'utf8')) }
      map.byId = map.byId ?? {}
      map.byName = map.byName ?? {}
    } catch {}
  }

  let ok = 0
  let skip = 0
  let fail = 0

  for (const c of coaches) {
    const existing = map.byId[c.id]
    const destExisting = existing ? path.join(OUT, `${existing}.png`) : null
    if (!FORCE && existing && destExisting && hasUsablePng(destExisting)) {
      skip++
      continue
    }

    process.stdout.write(`… ${c.name} `)
    let fotId = null
    try {
      fotId = await findFotmobCoachId(c.name)
    } catch (e) {
      console.log(`search fail (${e.message})`)
      fail++
      await sleep(400)
      continue
    }
    if (!fotId) {
      console.log('no fotmob id')
      fail++
      await sleep(350)
      continue
    }

    const dest = path.join(OUT, `${fotId}.png`)
    const url = `https://images.fotmob.com/image_resources/playerimages/${fotId}.png`
    if (!FORCE && hasUsablePng(dest)) {
      map.byId[c.id] = fotId
      map.byName[c.name] = fotId
      ok++
      console.log(`cached ${fotId}`)
      continue
    }

    if (curlDownload(url, dest)) {
      map.byId[c.id] = fotId
      map.byName[c.name] = fotId
      ok++
      console.log(`ok ${fotId}`)
    } else {
      try {
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
      } catch {}
      fail++
      console.log(`dl fail ${fotId}`)
    }
    await sleep(450)
  }

  map.generatedAt = new Date().toISOString()
  map.stats = { ok, skip, fail, total: coaches.length, mapped: Object.keys(map.byId).length }
  fs.writeFileSync(MAP_OUT, JSON.stringify(map, null, 2) + '\n', 'utf8')
  fs.writeFileSync(
    path.join(OUT, 'README.txt'),
    'Coach faces from FotMob (manager portraits).\nPersonal/local display only — not for redistribution or commercial sale.\n',
    'utf8',
  )

  // cleanup test file if present
  const test = path.join(OUT, 'test-pep.png')
  if (fs.existsSync(test)) fs.unlinkSync(test)

  console.log('\nDone', map.stats)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
