/**
 * Shared FMTU → players JSON → FMInside dump helpers for div2 packs.
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'
import { htmlToMd } from './fmInsideHtmlToMd.mjs'

export function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

export function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

export function slugify(name) {
  return String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export function curlGet(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '-H',
      'Accept: text/html',
      '--max-time',
      '45',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 1000
}

function mapRole(fmPos) {
  const p = String(fmPos || '').toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (/\bST\b/.test(p) || p.includes('F C') || p.includes('AM/F')) return 'ST'
  if (p.includes('AM RL') || p.includes('AM RLC')) return p.includes('ST') || p.includes('F C') ? 'ST' : 'CAM'
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

export function parseClubPlayers(html, clubKey, rep) {
  const depth =
    html.match(
      /id="panel-squad_depth"[\s\S]*?(?=id="panel-wonderkids"|id="panel-loaned"|data-tabs-panel="wonderkids"|$)/i,
    )?.[0] ?? ''

  const sectionRole = {
    Goalkeepers: 'GK',
    Defenders: 'CB',
    Midfielders: 'CM',
    Forwards: 'ST',
  }

  const players = []
  const seen = new Set()

  for (const [section, defaultRole] of Object.entries(sectionRole)) {
    const re = new RegExp(`<h5[^>]*>\\s*${section}\\s*<\\/h5>([\\s\\S]*?)(?=<h5[^>]*>|$)`, 'i')
    const block = depth.match(re)?.[1] ?? ''
    for (const m of block.matchAll(
      /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-([a-z0-9-]+)"[^>]*>\s*([^<]+?)\s*<\/a>[\s\S]{0,500}?(\d{2})\s*y\/?o/gi,
    )) {
      const fmId = m[1]
      if (seen.has(fmId)) continue
      seen.add(fmId)
      const slug = m[2]
      const name = decodeEntities(m[3]).replace(/\s+/g, ' ').trim()
      const age = Number(m[4]) || 24
      if (!name) continue
      players.push({
        name,
        role: defaultRole,
        age,
        ovr: rep,
        fmPos: section,
        fmId,
        slug,
        clubKey,
      })
    }
  }

  const panel = html.match(/id="panel-players"[\s\S]*?(?=id="panel-staff"|$)/i)?.[0] ?? ''
  const posById = new Map()
  for (const m of panel.matchAll(
    /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-[a-z0-9-]+"[^>]*>[\s\S]{0,800}?<span class="order-4[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi,
  )) {
    posById.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  }
  for (const p of players) {
    const fmPos = posById.get(p.fmId)
    if (fmPos) {
      p.fmPos = fmPos
      p.role = mapRole(fmPos)
    }
  }

  players.forEach((r, i) => {
    if (i < 18) r.ovr = Math.max(58, Math.min(82, rep - Math.floor(i / 3)))
    else r.ovr = Math.max(52, Math.min(72, rep - 8 - Math.floor((i - 18) / 2)))
  })

  return players
}

/**
 * @param {{
 *   clubs: Record<string, { id: number, name: string, rep: number }>,
 *   fmtuDir: string,
 *   idsOut: string,
 *   playersOut: string,
 *   sourceLabel: string,
 *   packNote: string,
 *   tmpTag: string,
 * }} cfg
 */
export async function runDiv2Pack(cfg) {
  const args = new Set(process.argv.slice(2))
  const runAll = args.has('--all')
  const ROOT = path.resolve('.')
  const FMIN_DIR = path.join(ROOT, 'scripts/_fm26_dumps/fminside')

  async function downloadClubs() {
    fs.mkdirSync(cfg.fmtuDir, { recursive: true })
    for (const [key, meta] of Object.entries(cfg.clubs)) {
      const dest = path.join(cfg.fmtuDir, `${key}.html`)
      const url = `https://fmtransferupdate.com/clubs/${meta.id}`
      let ok = false
      let title = 'FAIL'
      for (let attempt = 1; attempt <= 4; attempt++) {
        ok = curlGet(url, dest)
        title = ok ? fs.readFileSync(dest, 'utf8').match(/<title>([^<]+)/)?.[1] ?? '' : 'FAIL'
        if (ok && !/Too Many Requests/i.test(title) && !/Not Found/i.test(title)) break
        console.warn(key, 'retry', attempt, title.slice(0, 40))
        await sleep(3000 * attempt)
      }
      console.log(key, meta.id, ok ? fs.statSync(dest).size : 0, title)
      await sleep(700)
    }
  }

  function resolveAndBuildPlayers() {
    const byName = {}
    const clubs = {}
    let total = 0
    for (const [key, meta] of Object.entries(cfg.clubs)) {
      const file = path.join(cfg.fmtuDir, `${key}.html`)
      if (!fs.existsSync(file)) {
        console.warn('missing', key)
        continue
      }
      const html = fs.readFileSync(file, 'utf8')
      const title = html.match(/<title>([^<]+)/)?.[1] ?? ''
      if (/Not Found/i.test(title) || /Too Many Requests/i.test(title)) {
        console.warn('bad page', key, meta.id, title.slice(0, 40))
        continue
      }
      const rows = parseClubPlayers(html, key, meta.rep)
      clubs[key] = rows.map(({ name, role, age, ovr, fmPos }) => ({ name, role, age, ovr, fmPos }))
      for (const r of rows) {
        byName[r.name] = { fmId: r.fmId, clubKey: key, slug: r.slug }
      }
      total += rows.length
      console.log(key, title.slice(0, 40), '→', rows.length, rows.slice(0, 3).map((r) => r.name).join(', '))
    }

    fs.writeFileSync(
      cfg.idsOut,
      JSON.stringify(
        { source: `fmtransferupdate ${cfg.sourceLabel}`, matched: Object.keys(byName).length, byName },
        null,
        2,
      ),
    )
    fs.writeFileSync(
      cfg.playersOut,
      JSON.stringify(
        {
          source: 'fmtransferupdate.com + FMInside (personal display)',
          sourceUrl: 'https://fmtransferupdate.com/',
          note: cfg.packNote,
          clubs,
        },
        null,
        2,
      ) + '\n',
    )
    console.log('players', total, 'unique names', Object.keys(byName).length)
    console.log('wrote', cfg.playersOut, cfg.idsOut)
  }

  async function fetchFmInside() {
    fs.mkdirSync(FMIN_DIR, { recursive: true })
    const ids = JSON.parse(fs.readFileSync(cfg.idsOut, 'utf8'))
    const queue = Object.entries(ids.byName).map(([name, meta]) => ({
      name,
      fmId: String(meta.fmId),
      slug: meta.slug || slugify(name),
    }))
    let ok = 0
    let skip = 0
    let fail = 0
    const tmp = path.join(FMIN_DIR, `_tmp_${cfg.tmpTag}.html`)
    for (let i = 0; i < queue.length; i++) {
      const item = queue[i]
      const dest = path.join(FMIN_DIR, `${item.fmId}.md`)
      if (fs.existsSync(dest) && fs.statSync(dest).size > 500) {
        const existing = fs.readFileSync(dest, 'utf8')
        if (
          /###\s*Technical[\s\S]*?\|\s*\d+\s*\|/.test(existing) &&
          (!/GK|Goalkeeper/i.test(item.name) || /###\s*Goalkeeping[\s\S]*?\|\s*\d+\s*\|/.test(existing))
        ) {
          skip++
          continue
        }
      }
      const url = `https://fminside.net/players/7-fm-26/${item.fmId}-${item.slug}`
      if (!curlGet(url, tmp)) {
        fail++
        console.log(`[${i + 1}/${queue.length}] CURL FAIL ${item.name}`)
        continue
      }
      const html = fs.readFileSync(tmp, 'utf8')
      if (html.length < 5000 || /just a moment|Access denied|Too Many Requests/i.test(html)) {
        fail++
        console.log(`[${i + 1}/${queue.length}] BLOCK ${item.name}`)
      } else {
        const md = htmlToMd(html, item.fmId)
        const attrCount = (md.match(/\|\s*\d{1,3}\s*\|/g) || []).length
        fs.writeFileSync(dest, md)
        if (attrCount < 8) {
          fail++
          console.log(`[${i + 1}/${queue.length}] PARSE LOW ${item.name} attrs=${attrCount}`)
        } else {
          ok++
          if (ok % 25 === 0 || i < 5) console.log(`[${i + 1}/${queue.length}] OK ${item.name} attrs=${attrCount}`)
        }
      }
      await sleep(280 + Math.floor(Math.random() * 200))
    }
    try {
      fs.unlinkSync(tmp)
    } catch {}
    console.log({ ok, skip, fail, total: queue.length })
  }

  if (runAll || args.has('--download-clubs')) await downloadClubs()
  if (runAll || args.has('--resolve')) resolveAndBuildPlayers()
  if (runAll || args.has('--fetch-fminside')) await fetchFmInside()
  if (!runAll && args.size === 0) {
    console.log('Usage: --download-clubs | --resolve | --fetch-fminside | --all')
  }
}
