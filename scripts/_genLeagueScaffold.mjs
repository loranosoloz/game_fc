/**
 * Generate leaguesExtra.ts + empty players stubs from leagueClubConfigs.json
 * Run: node scripts/_genLeagueScaffold.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), 'utf8'))

const META = {
  jpn: { name: 'J1 League', nameTh: 'เจ1 ลีก', nation: 'Japan', cupName: 'Emperor\'s Cup' },
  kor: { name: 'K League 1', nameTh: 'เคลีก 1', nation: 'South Korea', cupName: 'Korean FA Cup' },
  bra: { name: 'Brasileirão Série A', nameTh: 'บราซิเลย์เรา', nation: 'Brazil', cupName: 'Copa do Brasil' },
  tur: { name: 'Süper Lig', nameTh: 'ซูเปอร์ลีก', nation: 'Turkey', cupName: 'Turkish Cup' },
  ned: { name: 'Eredivisie', nameTh: 'เอเรดิวิซี', nation: 'Netherlands', cupName: 'KNVB Cup' },
  prt: { name: 'Primeira Liga', nameTh: 'ปรีไมราลีกา', nation: 'Portugal', cupName: 'Taça de Portugal' },
  bel: { name: 'Pro League', nameTh: 'โปรลีก', nation: 'Belgium', cupName: 'Belgian Cup' },
  sco: { name: 'Scottish Premiership', nameTh: 'สกอตติช พรีเมียร์ชิป', nation: 'Scotland', cupName: 'Scottish Cup' },
  aut: { name: 'Austrian Bundesliga', nameTh: 'บุนเดสลีกา ออสเตรีย', nation: 'Austria', cupName: 'ÖFB Cup' },
  sui: { name: 'Swiss Super League', nameTh: 'ซูเปอร์ลีก สวิส', nation: 'Switzerland', cupName: 'Swiss Cup' },
  den: { name: 'Superliga', nameTh: 'ซูเปอร์ลีกา', nation: 'Denmark', cupName: 'Danish Cup' },
  gre: { name: 'Super League Greece', nameTh: 'ซูเปอร์ลีก กรีซ', nation: 'Greece', cupName: 'Greek Cup' },
}

const TOP = Object.keys(META)

function clubLine(c) {
  return `      { key: '${c.key}', name: '${c.name.replace(/'/g, "\\'")}', shortName: '${c.shortName}', color: '${c.color}', rep: ${c.rep}, stars: [] },`
}

let ts = `import type { LeagueDef } from './leaguesCore'\n\n/** Extra playable top divisions (pack-backed; stars filled from players*.json when ready) */\nexport const LEAGUES_EXTRA: LeagueDef[] = [\n`

for (const id of TOP) {
  const m = META[id]
  const clubs = cfg[id]
  ts += `  {\n`
  ts += `    id: '${id}',\n`
  ts += `    name: '${m.name}',\n`
  ts += `    nameTh: '${m.nameTh}',\n`
  ts += `    nation: '${m.nation}',\n`
  ts += `    cupName: '${m.cupName}',\n`
  ts += `    clubs: [\n`
  for (const c of clubs) ts += clubLine(c) + '\n'
  ts += `    ],\n`
  ts += `  },\n`
}
ts += `]\n`

fs.writeFileSync(path.join(ROOT, 'src/data/world/leaguesExtra.ts'), ts)

const PACK_IDS = [
  ...TOP,
  'jpn2',
  'kor2',
]

const CAP = {
  jpn: 'Jpn', jpn2: 'Jpn2', kor: 'Kor', kor2: 'Kor2',
  bra: 'Bra', tur: 'Tur', ned: 'Ned', prt: 'Prt',
  bel: 'Bel', sco: 'Sco', aut: 'Aut', sui: 'Sui',
  den: 'Den', gre: 'Gre',
}

for (const id of PACK_IDS) {
  const clubs = {}
  for (const c of cfg[id]) clubs[c.key] = []
  const label = id
  const json = {
    source: 'fmtransferupdate.com + FMInside (personal display)',
    sourceUrl: 'https://fmtransferupdate.com/',
    note: `Not for redistribution or commercial sale. Placeholder ${label} pack — run buildNationPack --league=${id}.`,
    clubs,
  }
  fs.writeFileSync(
    path.join(ROOT, `src/data/world/players${CAP[id]}.json`),
    JSON.stringify(json, null, 2) + '\n',
  )

  const fn = id.replace(/2$/, '2')
  const rosterFn = `${id}RosterForClub`
  const keysFn = `${id}RosterClubKeys`
  const playersTs = `import players from '@/data/world/players${CAP[id]}.json'
import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type Row = { name: string; role: string; age: number; ovr: number }

/** FM26 ${label} squads — keyed by club key */
export function ${rosterFn}(clubKey: string): StarDef[] {
  const rows = (players as { clubs: Record<string, Row[]> }).clubs?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
  }))
}

export function ${keysFn}(): string[] {
  return Object.keys((players as { clubs: Record<string, Row[]> }).clubs ?? {})
}
`
  fs.writeFileSync(path.join(ROOT, `src/data/world/${id}Players.ts`), playersTs)
}

console.log('wrote leaguesExtra.ts +', PACK_IDS.length, 'player stubs')
