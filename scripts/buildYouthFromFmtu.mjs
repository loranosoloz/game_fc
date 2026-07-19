/**
 * Enrich top-league player packs with youth (U16/U18/U21/U23) from FMTU Wonderkids.
 *
 * FMTU first-team pages do not expose full U21 squads — Wonderkids panel is the
 * reliable youth source. Age buckets:
 *   <=16 U16 · <=18 U18 · <=21 U21 · <=23 U23
 *
 * Usage:
 *   node scripts/buildYouthFromFmtu.mjs
 *   node scripts/buildYouthFromFmtu.mjs --league=eng,esp
 */
import fs from 'fs'
import path from 'path'
import { decodeEntities, parseClubPlayers } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')

/** Top leagues: dump dir → players JSON → fm_ids file */
const LEAGUES = {
  eng: {
    dump: 'scripts/_fm26_dumps/fmtu',
    players: 'src/data/world/playersEng.json',
    ids: 'scripts/_fm26_dumps/eng_fm_ids.json',
    defaultRep: 78,
  },
  esp: {
    dump: 'scripts/_fm26_dumps/fmtu_esp',
    players: 'src/data/world/playersEsp.json',
    ids: 'scripts/_fm26_dumps/esp_fm_ids.json',
    defaultRep: 74,
  },
  ger: {
    dump: 'scripts/_fm26_dumps/fmtu_ger',
    players: 'src/data/world/playersGer.json',
    ids: 'scripts/_fm26_dumps/ger_fm_ids.json',
    defaultRep: 72,
  },
  fra: {
    dump: 'scripts/_fm26_dumps/fmtu_fra',
    players: 'src/data/world/playersFra.json',
    ids: 'scripts/_fm26_dumps/fra_fm_ids.json',
    defaultRep: 72,
  },
  ita: {
    dump: 'scripts/_fm26_dumps/fmtu_ita',
    players: 'src/data/world/playersIta.json',
    ids: 'scripts/_fm26_dumps/ita_fm_ids.json',
    defaultRep: 72,
  },
}

function youthGroup(age) {
  if (age <= 16) return 'U16'
  if (age <= 18) return 'U18'
  if (age <= 21) return 'U21'
  if (age <= 23) return 'U23'
  return null
}

function mapRole(fmPos) {
  const p = String(fmPos || '').toUpperCase()
  if (p.includes('GK')) return 'GK'
  if (/\bST\b/.test(p) || p.includes('F C') || p.includes('AM/F')) return 'ST'
  if (p.includes('AM RL') || p.includes('AM RLC')) return 'CAM'
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
  return 'CM'
}

/** Positions from panel-players (age is a bare number span, not "y/o") */
function posByIdFromPanel(html) {
  const panel = html.match(/id="panel-players"[\s\S]*?(?=id="panel-staff"|id="panel-on_loan"|$)/i)?.[0] ?? ''
  const map = new Map()
  for (const m of panel.matchAll(
    /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-[a-z0-9-]+"[^>]*>[\s\S]{0,400}?<span class="order-4[^"]*"[^>]*>\s*([^<]+?)\s*<\/span>/gi,
  )) {
    map.set(m[1], m[2].replace(/\s+/g, ' ').trim())
  }
  return map
}

function parseWonderkids(html, clubKey, rep, seniorNames) {
  const wk =
    html.match(
      /id="panel-wonderkids"[\s\S]*?(?=id="panel-|data-tabs-panel="(?!wonderkids)|$)/i,
    )?.[0] ?? ''
  const posById = posByIdFromPanel(html)
  const out = []
  const seen = new Set()
  for (const m of wk.matchAll(
    /href="https:\/\/fmtransferupdate\.com\/players\/(\d+)-([a-z0-9-]+)"[^>]*>\s*([^<]*?)\s*<\/a>[\s\S]{0,600}?(\d{2})\s*y\/?o/gi,
  )) {
    const fmId = m[1]
    if (seen.has(fmId)) continue
    seen.add(fmId)
    const name = decodeEntities(m[3]).replace(/\s+/g, ' ').trim()
    if (!name || seniorNames.has(name)) continue
    const age = Number(m[4]) || 18
    const group = youthGroup(age)
    if (!group) continue
    const fmPos = posById.get(fmId) || 'Wonderkid'
    const role = mapRole(fmPos)
    const ovr = Math.max(
      48,
      Math.min(76, Math.round(rep - 14 - Math.max(0, 20 - age) * 0.8 + (group === 'U16' ? -2 : 0))),
    )
    out.push({
      name,
      role,
      age,
      ovr,
      fmPos,
      youthGroup: group,
      isYouth: true,
      fmId,
      slug: m[2],
    })
  }
  return out
}

/** Also flag young players already in senior depth as youthGroup metadata only? Skip — they're first team. */

function selectedLeagues() {
  const arg = process.argv.find((a) => a.startsWith('--league='))
  if (!arg) return Object.keys(LEAGUES)
  return arg
    .slice('--league='.length)
    .split(',')
    .map((s) => s.trim())
    .filter((id) => LEAGUES[id])
}

let totalYouth = 0
for (const leagueId of selectedLeagues()) {
  const cfg = LEAGUES[leagueId]
  const dumpDir = path.join(ROOT, cfg.dump)
  const playersPath = path.join(ROOT, cfg.players)
  if (!fs.existsSync(dumpDir) || !fs.existsSync(playersPath)) {
    console.warn('skip', leagueId, 'missing dump or players')
    continue
  }
  const pack = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
  const idsPath = path.join(ROOT, cfg.ids)
  const ids = fs.existsSync(idsPath)
    ? JSON.parse(fs.readFileSync(idsPath, 'utf8'))
    : { source: `youth ${leagueId}`, matched: 0, byName: {} }
  ids.byName = ids.byName ?? {}

  const youth = {}
  let leagueCount = 0
  const files = fs.readdirSync(dumpDir).filter((f) => f.endsWith('.html'))
  for (const file of files) {
    const key = file.replace(/\.html$/, '')
    // only clubs that exist in pack (or always store)
    const html = fs.readFileSync(path.join(dumpDir, file), 'utf8')
    if (/Too Many Requests|Not Found/i.test(html.match(/<title>([^<]+)/)?.[1] ?? '')) continue
    const senior = pack.clubs?.[key] ?? []
    const seniorNames = new Set(senior.map((r) => r.name))
    // if club not in pack, still try — use parseClubPlayers names as senior set
    if (!pack.clubs?.[key]) {
      const depth = parseClubPlayers(html, key, cfg.defaultRep)
      for (const r of depth) seniorNames.add(r.name)
    }
    const rows = parseWonderkids(html, key, cfg.defaultRep, seniorNames)
    if (!rows.length) continue
    youth[key] = rows.map(({ name, role, age, ovr, fmPos, youthGroup, isYouth }) => ({
      name,
      role,
      age,
      ovr,
      fmPos,
      youthGroup,
      isYouth,
    }))
    for (const r of rows) {
      if (!ids.byName[r.name]) {
        ids.byName[r.name] = { fmId: r.fmId, clubKey: key, slug: r.slug, youth: true }
      }
    }
    leagueCount += rows.length
    const bags = { U16: 0, U18: 0, U21: 0, U23: 0 }
    for (const r of rows) bags[r.youthGroup]++
    console.log(
      leagueId,
      key,
      'youth',
      rows.length,
      `U16:${bags.U16} U18:${bags.U18} U21:${bags.U21} U23:${bags.U23}`,
    )
  }

  pack.youth = youth
  pack.youthNote =
    'FMTU Wonderkids panel · age buckets U16/U18/U21/U23 · not a full academy roster'
  fs.writeFileSync(playersPath, JSON.stringify(pack, null, 2) + '\n')
  ids.matched = Object.keys(ids.byName).length
  fs.writeFileSync(idsPath, JSON.stringify(ids, null, 2))
  totalYouth += leagueCount
  console.log('→', leagueId, 'youth players', leagueCount, 'clubs', Object.keys(youth).length)
}

console.log('total youth rows', totalYouth)
