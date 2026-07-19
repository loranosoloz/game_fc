/**
 * Patch div2Clubs.ts with jpn/kor real packs + placeholder div2 for other new leagues.
 * Run: node scripts/_patchDiv2Clubs.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), 'utf8'))

function lines(arr) {
  return arr
    .map(
      (c) =>
        `    { key: '${c.key}', name: '${String(c.name).replace(/'/g, "\\'")}', shortName: '${c.shortName}', color: '${c.color}' },`,
    )
    .join('\n')
}

function mk(prefix, names, color) {
  return names.map((name, i) => {
    const key = `${prefix}${(i + 10).toString(36)}`
    return { key, name, shortName: key.toUpperCase(), color: color || '#555555' }
  })
}

const bra2 = [
  'Ceará', 'Sport Recife', 'Goiás', 'Avaí', 'CRB', 'Operário', 'América-MG', 'Paysandu',
  'Amazonas', 'Novorizontino', 'Ponte Preta', 'Guarani', 'Vila Nova', 'Londrina',
  'Figueirense', 'Sampaio Corrêa', 'Náutico', 'Botafogo-SP', 'Ituano', 'Remo B',
]
const tur2 = [
  'Adana Demirspor', 'Ankaragücü', 'Boluspor', 'Erzurumspor', 'Bandırmaspor', 'Manisa',
  'Ümraniyespor', 'Keçiörengücü', 'Sakaryaspor', 'Amedspor', 'Pendikspor', 'Bodrum',
  'Şanlıurfaspor', 'Çorum', 'Esenler', 'Iğdır', 'Altay', 'Göztepe B',
]
const ned2 = [
  'Willem II', 'Roda JC', 'De Graafschap', 'Emmen', 'Dordrecht', 'Helmond', 'MVV', 'Cambuur',
  'Vitesse', 'ADO Den Haag', 'Jong Ajax', 'Jong PSV', 'Jong AZ', 'TOP Oss', 'FC Eindhoven',
  'Den Bosch', 'Almere City', 'FC Emmen B',
]
const prt2 = [
  'Marítimo', 'Académico Viseu', 'Feirense', 'Leixões', 'Penafiel', 'Mafra', 'Torreense',
  'Oliveirense', 'Portimonense', 'Chaves', 'Paços de Ferreira', 'Benfica B', 'Porto B',
  'Sporting B', 'Farense', 'União Leiria', 'Vizela', 'Trofense',
]
const bel2 = [
  'Lommel', 'Beveren', 'RFC Liège', 'Patro Eisden', 'Francs Borains', 'Seraing', 'Deinze',
  'RWDM', 'Lierse', 'Eupen', 'Lokeren', 'Virton', 'Heist', 'Knokke', 'Dessel', 'Oudenaarde',
]
const sco2 = [
  'Partick Thistle', 'Raith Rovers', 'Ayr United', 'Dunfermline', "Queen's Park", 'Inverness',
  'Morton', 'Airdrie', 'Hamilton', 'Cove Rangers', 'Arbroath', 'Queen of the South',
]
const aut2 = [
  'First Vienna', 'Admira', 'Amstetten', 'St. Pölten', 'Stripfing', 'Kapfenberg', 'Horn',
  'Floridsdorf', 'Lafnitz', 'Leoben', 'Sturm Graz II', 'Rapid II',
]
const sui2 = [
  'Xamax', 'Aarau', 'Vaduz', 'Wil', 'Schaffhausen', 'Bellinzona', 'Stade Nyonnais', 'Baden',
  'Rapperswil', 'Cham', 'Kriens', 'Étoile Carouge',
]
const den2 = [
  'AaB', 'Horsens', 'Hillerød', 'Kolding', 'B93', 'HB Køge', 'Hvidovre', 'Næstved',
  'Roskilde', 'Esbjerg', 'Fremad Amager', 'Helsingør',
]
const gre2 = [
  'PAS Giannina', 'Iraklis', 'Kallithea', 'Kalamata', 'Chania', 'Egaleo', 'Panachaiki',
  'Niki Volos', 'Diagoras', 'Ilioupoli', 'Anagennisi', 'Makedonikos', 'PAOK B', 'Olympiacos B',
]

const parts = {
  jpn: cfg.jpn2,
  kor: cfg.kor2,
  bra: mk('xb', bra2, '#009C3B'),
  tur: mk('xt', tur2, '#E30613'),
  ned: mk('xn', ned2, '#FF6600'),
  prt: mk('xp', prt2, '#006600'),
  bel: mk('xe', bel2, '#E30613'),
  sco: mk('xs', sco2, '#0033A0'),
  aut: mk('xa', aut2, '#E30613'),
  sui: mk('xw', sui2, '#E30613'),
  den: mk('xd', den2, '#C8102E'),
  gre: mk('xg', gre2, '#0055A4'),
}

for (const [k, v] of Object.entries(parts)) {
  if (v.length % 2 !== 0) throw new Error(`${k} odd count ${v.length}`)
  console.log(k, v.length)
}

const existing = fs.readFileSync(path.join(ROOT, 'src/data/world/div2Clubs.ts'), 'utf8')
const head = existing.split('export const DIV2_CLUB_NAMES')[0]
const clubsBodyMatch = existing.match(
  /export const DIV2_CLUB_NAMES: Record<LeagueId, Div2ClubDef\[\]> = \{([\s\S]*?)\n\}\r?\n\r?\nexport const DIV2_LEAGUE_NAME/,
)
if (!clubsBodyMatch) throw new Error('DIV2_CLUB_NAMES body not found')
const oldBody = clubsBodyMatch[1]
const keepIds = ['eng', 'esp', 'ger', 'fra', 'ita', 'tha']
let kept = ''
for (const id of keepIds) {
  const m = oldBody.match(new RegExp(`  ${id}: \\[[\\s\\S]*?\\n  \\],`))
  if (!m) throw new Error(`missing ${id}`)
  kept += m[0] + '\n'
}

let extra = ''
for (const [id, arr] of Object.entries(parts)) {
  extra += `  ${id}: [\n${lines(arr)}\n  ],\n`
}

const names = {
  eng: { name: 'Championship', nameTh: 'แชมเปียนชิป' },
  esp: { name: 'LaLiga2', nameTh: 'ลาลีกา 2' },
  ger: { name: '2. Bundesliga', nameTh: 'บุนเดสลีกา 2' },
  fra: { name: 'Ligue 2', nameTh: 'ลีก 2' },
  ita: { name: 'Serie B', nameTh: 'เซเรีย บี' },
  tha: { name: 'Thai League 2', nameTh: 'ไทยลีก 2' },
  jpn: { name: 'J2 League', nameTh: 'เจ2 ลีก' },
  kor: { name: 'K League 2', nameTh: 'เคลีก 2' },
  bra: { name: 'Série B', nameTh: 'เซเรีย บี บราซิล' },
  tur: { name: '1. Lig', nameTh: 'เทิร์กกิช 1. Lig' },
  ned: { name: 'Eerste Divisie', nameTh: 'แอร์สเต ดิวิซี' },
  prt: { name: 'Liga Portugal 2', nameTh: 'ลีกา โปรตุเกส 2' },
  bel: { name: 'Challenger Pro League', nameTh: 'แชลเลนเจอร์ โปรลีก' },
  sco: { name: 'Championship', nameTh: 'แชมเปียนชิป สก็อต' },
  aut: { name: '2. Liga', nameTh: 'ลีกา 2 ออสเตรีย' },
  sui: { name: 'Challenge League', nameTh: 'แชลเลนจ์ลีก' },
  den: { name: '1. Division', nameTh: 'ดิวิชัน 1 เดนมาร์ก' },
  gre: { name: 'Super League 2', nameTh: 'ซูเปอร์ลีก 2' },
}

const cups = {
  eng: { leagueCup: 'EFL Cup', trophy: 'EFL Trophy' },
  esp: { leagueCup: 'Copa de la Liga', trophy: 'Copa Federación' },
  ger: { leagueCup: 'Ligapokal', trophy: '3. Liga Pokal' },
  fra: { leagueCup: 'Coupe de la Ligue', trophy: 'Trophée des Champions L2' },
  ita: { leagueCup: 'Coppa di Lega', trophy: 'Coppa Serie B' },
  tha: { leagueCup: 'ลีกคัพ', trophy: 'แชมเปียนส์คัพ ลีก 2' },
  jpn: { leagueCup: 'J.League Cup', trophy: 'J2 League Cup' },
  kor: { leagueCup: 'Korea League Cup', trophy: 'K2 Cup' },
  bra: { leagueCup: 'Copa do Nordeste', trophy: 'Série B Trophy' },
  tur: { leagueCup: 'Turkish League Cup', trophy: '1. Lig Cup' },
  ned: { leagueCup: 'KNVB Beker', trophy: 'Jupiler League Cup' },
  prt: { leagueCup: 'Taça da Liga', trophy: 'Liga 2 Trophy' },
  bel: { leagueCup: 'Croky Cup', trophy: 'Challenger Cup' },
  sco: { leagueCup: 'League Cup', trophy: 'Challenge Cup' },
  aut: { leagueCup: 'ÖFB Ligapokal', trophy: '2. Liga Cup' },
  sui: { leagueCup: 'Swiss League Cup', trophy: 'Challenge Cup' },
  den: { leagueCup: 'Danish League Cup', trophy: '1. Division Cup' },
  gre: { leagueCup: 'Greek League Cup', trophy: 'Super League 2 Cup' },
}

function rec(obj, mapFn) {
  return Object.entries(obj)
    .map(([id, v]) => `  ${id}: ${mapFn(v)},`)
    .join('\n')
}

const out = `${head}export const DIV2_CLUB_NAMES: Record<LeagueId, Div2ClubDef[]> = {
${kept}${extra}}

export const DIV2_LEAGUE_NAME: Record<LeagueId, { name: string; nameTh: string }> = {
${rec(names, (v) => `{ name: '${v.name}', nameTh: '${v.nameTh}' }`)}
}

export const EXTRA_CUP_NAMES: Record<
  LeagueId,
  { leagueCup: string; trophy: string }
> = {
${rec(cups, (v) => `{ leagueCup: '${v.leagueCup}', trophy: '${v.trophy}' }`)}
}
`

fs.writeFileSync(path.join(ROOT, 'src/data/world/div2Clubs.ts'), out)
console.log('patched div2Clubs.ts')
