import fs from 'fs'

const pe = JSON.parse(fs.readFileSync('src/data/world/playersEng.json', 'utf8'))

const meta = [
  { key: 'mci', name: 'Manchester City', short: 'MCI', color: '#6CABDD', rep: 91 },
  { key: 'liv', name: 'Liverpool', short: 'LIV', color: '#C8102E', rep: 91 },
  { key: 'ars', name: 'Arsenal', short: 'ARS', color: '#EF0107', rep: 90 },
  { key: 'che', name: 'Chelsea', short: 'CHE', color: '#034694', rep: 85 },
  { key: 'mun', name: 'Manchester United', short: 'MUN', color: '#DA291C', rep: 84 },
  { key: 'new', name: 'Newcastle United', short: 'NEW', color: '#241F20', rep: 84 },
  { key: 'tot', name: 'Tottenham Hotspur', short: 'TOT', color: '#132257', rep: 83 },
  { key: 'avl', name: 'Aston Villa', short: 'AVL', color: '#670E36', rep: 82 },
  { key: 'bha', name: 'Brighton & Hove Albion', short: 'BHA', color: '#0057B8', rep: 81 },
  { key: 'not', name: 'Nottingham Forest', short: 'NFO', color: '#DD0000', rep: 80 },
  { key: 'bou', name: 'AFC Bournemouth', short: 'BOU', color: '#DA291C', rep: 79 },
  { key: 'cry', name: 'Crystal Palace', short: 'CRY', color: '#1B458F', rep: 79 },
  { key: 'ful', name: 'Fulham', short: 'FUL', color: '#FFFFFF', rep: 79 },
  { key: 'bre', name: 'Brentford', short: 'BRE', color: '#E30613', rep: 78 },
  { key: 'eve', name: 'Everton', short: 'EVE', color: '#003399', rep: 78 },
  { key: 'whu', name: 'West Ham United', short: 'WHU', color: '#7A263A', rep: 78 },
  { key: 'lee', name: 'Leeds United', short: 'LEE', color: '#FFCD00', rep: 76 },
  { key: 'sun', name: 'Sunderland', short: 'SUN', color: '#EB172B', rep: 76 },
  { key: 'wol', name: 'Wolverhampton Wanderers', short: 'WOL', color: '#FDB913', rep: 76 },
  { key: 'bur', name: 'Burnley', short: 'BUR', color: '#6C1D45', rep: 74 },
]

const fallbackStars = {
  bha: [
    { name: 'Kaoru Mitoma', role: 'LW', ovr: 82, age: 28 },
    { name: 'João Pedro', role: 'ST', ovr: 80, age: 24 },
    { name: 'Lewis Dunk', role: 'CB', ovr: 79, age: 34 },
  ],
  not: [
    { name: 'Morgan Gibbs-White', role: 'CAM', ovr: 81, age: 26 },
    { name: 'Chris Wood', role: 'ST', ovr: 78, age: 34 },
    { name: 'Murillo', role: 'CB', ovr: 79, age: 23 },
  ],
  bou: [
    { name: 'Justin Kluivert', role: 'CAM', ovr: 78, age: 26 },
    { name: 'Dean Huijsen', role: 'CB', ovr: 77, age: 20 },
    { name: 'Evanilson', role: 'ST', ovr: 78, age: 26 },
  ],
  cry: [
    { name: 'Jean-Philippe Mateta', role: 'ST', ovr: 80, age: 28 },
    { name: 'Adam Wharton', role: 'CM', ovr: 79, age: 21 },
    { name: 'Dean Henderson', role: 'GK', ovr: 78, age: 28 },
  ],
  ful: [
    { name: 'Alex Iwobi', role: 'CM', ovr: 79, age: 29 },
    { name: 'Raúl Jiménez', role: 'ST', ovr: 77, age: 34 },
    { name: 'Antonee Robinson', role: 'LB', ovr: 78, age: 28 },
  ],
  whu: [
    { name: 'Jarrod Bowen', role: 'RW', ovr: 81, age: 29 },
    { name: 'Lucas Paquetá', role: 'CAM', ovr: 80, age: 28 },
    { name: 'Niclas Füllkrug', role: 'ST', ovr: 78, age: 32 },
  ],
  lee: [
    { name: 'Anton Stach', role: 'CDM', ovr: 78, age: 26 },
    { name: 'Joe Rodon', role: 'CB', ovr: 76, age: 28 },
    { name: 'Wilfried Gnonto', role: 'RW', ovr: 75, age: 22 },
  ],
  sun: [
    { name: 'Jobe Bellingham', role: 'CM', ovr: 76, age: 20 },
    { name: 'Trai Hume', role: 'RB', ovr: 74, age: 23 },
    { name: 'Wilson Isidor', role: 'ST', ovr: 75, age: 25 },
  ],
  wol: [
    { name: 'Jørgen Strand Larsen', role: 'ST', ovr: 78, age: 25 },
    { name: 'José Sá', role: 'GK', ovr: 77, age: 33 },
    { name: 'João Gomes', role: 'CDM', ovr: 78, age: 24 },
  ],
  bur: [
    { name: 'Josh Brownhill', role: 'CM', ovr: 74, age: 32 },
    { name: 'Lyle Foster', role: 'ST', ovr: 73, age: 25 },
    { name: 'Maxime Estève', role: 'CB', ovr: 74, age: 23 },
  ],
}

function starsFor(key) {
  const roster = pe.clubs[key]
  if (roster?.length) {
    return roster.slice(0, 4).map((p) => ({ name: p.name, role: p.role, ovr: p.ovr, age: p.age }))
  }
  return fallbackStars[key] || []
}

function esc(s) {
  return s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")
}

let out = ''
for (const m of meta) {
  const stars = starsFor(m.key)
  out += `      { key: '${m.key}', name: '${esc(m.name)}', shortName: '${m.short}', color: '${m.color}', rep: ${m.rep}, stars: [\n`
  for (const s of stars) {
    out += `        { name: '${esc(s.name)}', role: '${s.role}', ovr: ${s.ovr}, age: ${s.age} },\n`
  }
  out += `      ]},\n`
}
fs.writeFileSync('scripts/_eng_clubs_snippet.txt', out)
console.log('wrote snippet', meta.length, 'clubs')
