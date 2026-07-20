/**
 * Build a nation / league pack from scripts/leagueClubConfigs.json
 *
 * Usage:
 *   node scripts/buildNationPack.mjs --league=jpn
 *   node scripts/buildNationPack.mjs --league=jpn2 --download-clubs
 *   node scripts/buildNationPack.mjs --league=prt --resolve
 *   node scripts/buildNationPack.mjs --league=bel --fetch-fminside
 */
import path from 'path'
import fs from 'fs'
import { runDiv2Pack } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')
const CFG = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), 'utf8'))

const CAP = {
  jpn: 'Jpn',
  jpn2: 'Jpn2',
  kor: 'Kor',
  kor2: 'Kor2',
  bra: 'Bra',
  tur: 'Tur',
  ned: 'Ned',
  prt: 'Prt',
  bel: 'Bel',
  sco: 'Sco',
  aut: 'Aut',
  sui: 'Sui',
  den: 'Den',
  gre: 'Gre',
  vie: 'Vie',
  idn: 'Idn',
  mys: 'Mys',
  sgp: 'Sgp',
  sau: 'Sau',
  sau2: 'Sau2',
}

const LABELS = {
  jpn: 'J1 League',
  jpn2: 'J2 League',
  kor: 'K League 1',
  kor2: 'K League 2',
  bra: 'Brasileirão Série A',
  tur: 'Süper Lig',
  ned: 'Eredivisie',
  prt: 'Primeira Liga',
  bel: 'Belgian Pro League',
  sco: 'Scottish Premiership',
  aut: 'Austrian Bundesliga',
  sui: 'Swiss Super League',
  den: 'Danish Superliga',
  gre: 'Super League Greece',
  vie: 'V.League 1',
  idn: 'Liga 1',
  mys: 'Malaysia Super League',
  sgp: 'Singapore Premier League',
  sau: 'Saudi Pro League',
  sau2: 'Saudi First Division',
}

const arg = process.argv.find((a) => a.startsWith('--league='))
if (!arg) {
  console.error('Usage: node scripts/buildNationPack.mjs --league=<id> [--download-clubs|--resolve|--fetch-fminside|--all]')
  console.error('Leagues:', Object.keys(CAP).join(', '))
  process.exit(1)
}

const leagueId = arg.slice('--league='.length)
if (!CAP[leagueId] || !CFG[leagueId]) {
  console.error('Unknown league:', leagueId)
  process.exit(1)
}

const clubs = Object.fromEntries(
  CFG[leagueId].map((c) => [c.key, { id: c.id, name: c.name, rep: c.rep }]),
)

await runDiv2Pack({
  clubs,
  fmtuDir: path.join(ROOT, `scripts/_fm26_dumps/fmtu_${leagueId}`),
  idsOut: path.join(ROOT, `scripts/_fm26_dumps/${leagueId}_fm_ids.json`),
  playersOut: path.join(ROOT, `src/data/world/players${CAP[leagueId]}.json`),
  sourceLabel: LABELS[leagueId] ?? leagueId,
  packNote: `Not for redistribution or commercial sale. ${LABELS[leagueId] ?? leagueId} / ${leagueId} pack.`,
  tmpTag: leagueId,
})
