/**
 * Build mediaPersonalities.json — ≥6 retired legends per top-division club.
 * Curated famous names for big clubs; filler alumni for the rest.
 *
 * Usage: node scripts/buildMediaPersonalities.mjs
 */
import fs from 'fs'
import path from 'path'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const ROOT = path.resolve('.')

// Dynamic import of TS leagues is awkward — read from compiled-ish JSON dumps
// Prefer parsing leagueClubConfigs + core league files via require of JSON packs
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), 'utf8'))

/** Minimal club list from league defs (keys that matter for playable top tiers) */
function loadClubsFromTsApprox() {
  // Use leagueClubConfigs for extra leagues + hardcode big5+tha from known keys in fmClubIds / packs
  const clubs = []

  // eng — from playersEng or WORLD — hardcode PL 25/26 keys used in game
  const eng = [
    ['mci', 'Manchester City'], ['liv', 'Liverpool'], ['ars', 'Arsenal'], ['che', 'Chelsea'],
    ['mun', 'Manchester United'], ['new', 'Newcastle United'], ['tot', 'Tottenham Hotspur'],
    ['avl', 'Aston Villa'], ['bha', 'Brighton'], ['not', 'Nottingham Forest'],
    ['bou', 'Bournemouth'], ['cry', 'Crystal Palace'], ['ful', 'Fulham'], ['bre', 'Brentford'],
    ['eve', 'Everton'], ['whu', 'West Ham'], ['lee', 'Leeds United'], ['sun', 'Sunderland'],
    ['wol', 'Wolves'], ['bur', 'Burnley'],
  ]
  for (const [key, name] of eng) clubs.push({ leagueId: 'eng', key, name })

  const esp = [
    ['rma', 'Real Madrid'], ['bar', 'FC Barcelona'], ['atm', 'Atlético Madrid'], ['ath', 'Athletic Club'],
    ['vil', 'Villarreal'], ['rso', 'Real Sociedad'], ['bet', 'Real Betis'], ['sev', 'Sevilla'],
    ['gir', 'Girona'], ['val', 'Valencia'], ['cel', 'Celta Vigo'], ['osa', 'Osasuna'],
    ['mal', 'Mallorca'], ['ray', 'Rayo Vallecano'], ['get', 'Getafe'], ['esp', 'Espanyol'],
    ['ala', 'Alavés'], ['elc', 'Elche'], ['lvt', 'Levante'], ['ovi', 'Real Oviedo'],
  ]
  for (const [key, name] of esp) clubs.push({ leagueId: 'esp', key, name })

  const ger = [
    ['bay', 'Bayern Munich'], ['bvb', 'Borussia Dortmund'], ['b04', 'Bayer Leverkusen'], ['rbl', 'RB Leipzig'],
    ['stu', 'VfB Stuttgart'], ['ein', 'Eintracht Frankfurt'], ['fre', 'SC Freiburg'], ['wob', 'VfL Wolfsburg'],
    ['bmg', 'Borussia Mönchengladbach'], ['uni', 'Union Berlin'], ['hof', 'Hoffenheim'], ['wer', 'Werder Bremen'],
    ['hsv', 'Hamburger SV'], ['m05', 'Mainz 05'], ['aug', 'Augsburg'], ['koe', '1. FC Köln'],
    ['hea', 'Heidenheim'], ['stp', 'St. Pauli'],
  ]
  for (const [key, name] of ger) clubs.push({ leagueId: 'ger', key, name })

  const fra = [
    ['psg', 'Paris Saint-Germain'], ['om', 'Marseille'], ['ol', 'Lyon'], ['asm', 'Monaco'],
    ['lil', 'Lille'], ['ren', 'Rennes'], ['nic', 'Nice'], ['rcl', 'Lens'],
    ['str', 'Strasbourg'], ['nte', 'Nantes'], ['tou', 'Toulouse'], ['sbr', 'Brest'],
    ['aux', 'Auxerre'], ['ang', 'Angers'], ['hac', 'Le Havre'], ['lor', 'Lorient'],
    ['pfc', 'Paris FC'], ['met', 'Metz'],
  ]
  for (const [key, name] of fra) clubs.push({ leagueId: 'fra', key, name })

  const ita = [
    ['int', 'Inter'], ['mil', 'AC Milan'], ['juv', 'Juventus'], ['nap', 'Napoli'],
    ['rom', 'AS Roma'], ['laz', 'Lazio'], ['ata', 'Atalanta'], ['fio', 'Fiorentina'],
    ['bol', 'Bologna'], ['tor', 'Torino'], ['udi', 'Udinese'], ['gen', 'Genoa'],
    ['cag', 'Cagliari'], ['lec', 'Lecce'], ['ver', 'Hellas Verona'], ['par', 'Parma'],
    ['com', 'Como'], ['sas', 'Sassuolo'], ['pis', 'Pisa'], ['cre', 'Cremonese'],
  ]
  for (const [key, name] of ita) clubs.push({ leagueId: 'ita', key, name })

  const tha = [
    ['bru', 'Buriram United'], ['ptc', 'Port FC'], ['rcb', 'Ratchaburi'], ['bgp', 'BG Pathum United'],
    ['bku', 'Bangkok United'], ['prc', 'PT Prachuap'], ['chi', 'Chiangrai United'], ['chu', 'Chonburi'],
    ['ryg', 'Rayong'], ['aya', 'Ayutthaya United'], ['utt', 'Uthai Thani'], ['lmp', 'Lamphun Warriors'],
    ['suk', 'Sukhothai'], ['mtn', 'Muangthong United'], ['nks', 'Nakhon Ratchasima'], ['kpw', 'Kanchanaburi Power'],
  ]
  for (const [key, name] of tha) clubs.push({ leagueId: 'tha', key, name })

  for (const [lid, list] of Object.entries(cfg)) {
    if (!Array.isArray(list) || lid.endsWith('2')) continue
    for (const c of list) {
      if (clubs.some((x) => x.key === c.key)) continue
      clubs.push({ leagueId: lid, key: c.key, name: c.name })
    }
  }
  return clubs
}

const ROLES = [
  { role: 'analyst', roleTh: 'นักวิเคราะห์' },
  { role: 'commentator', roleTh: 'ผู้บรรยาย' },
  { role: 'studio_host', roleTh: 'พิธีกรสตูดิโอ' },
  { role: 'analyst', roleTh: 'นักวิเคราะห์' },
  { role: 'analyst', roleTh: 'นักวิเคราะห์' },
  { role: 'commentator', roleTh: 'ผู้บรรยาย' },
]

/** Famous retired players by club key — aim 6–10 */
const CURATED = {
  mun: [
    ['Ryan Giggs', 'ตำนานปีกซ้าย'], ['Paul Scholes', 'ตำนานกองกลาง'], ['Gary Neville', 'ตำนานแบ็กขวา'],
    ['Roy Keane', 'ตำนานกัปตัน'], ['Eric Cantona', 'ตำนานกองหน้า'], ['Ole Gunnar Solskjær', 'ตำนานซูเปอร์ซับ'],
    ['Rio Ferdinand', 'ตำนานเซ็นเตอร์แบ็ก'], ['Wayne Rooney', 'ตำนานกองหน้า'],
  ],
  liv: [
    ['Steven Gerrard', 'ตำนานกัปตัน'], ['Jamie Carragher', 'ตำนานกองหลัง'], ['Robbie Fowler', 'ตำนานกองหน้า'],
    ['Ian Rush', 'ตำนานกองหน้า'], ['John Barnes', 'ตำนานปีก'], ['Sami Hyypiä', 'ตำนานเซ็นเตอร์แบ็ก'],
    ['Xabi Alonso', 'ตำนานกองกลาง'], ['Fernando Torres', 'ตำนานกองหน้า'],
  ],
  ars: [
    ['Thierry Henry', 'ตำนานกองหน้า'], ['Dennis Bergkamp', 'ตำนานกองหน้า'], ['Tony Adams', 'ตำนานกัปตัน'],
    ['Patrick Vieira', 'ตำนานกองกลาง'], ['Robert Pires', 'ตำนานปีก'], ['Ashley Cole', 'ตำนานแบ็กซ้าย'],
    ['Ian Wright', 'ตำนานกองหน้า'], ['Sol Campbell', 'ตำนานเซ็นเตอร์แบ็ก'],
  ],
  che: [
    ['Frank Lampard', 'ตำนานกองกลาง'], ['John Terry', 'ตำนานกัปตัน'], ['Didier Drogba', 'ตำนานกองหน้า'],
    ['Petr Čech', 'ตำนานโกล'], ['Ashley Cole', 'ตำนานแบ็กซ้าย'], ['Claude Makelele', 'ตำนานCDM'],
    ['Gianfranco Zola', 'ตำนานกองหน้า'], ['Dennis Wise', 'ตำนานกัปตัน'],
  ],
  mci: [
    ['Sergio Agüero', 'ตำนานกองหน้า'], ['David Silva', 'ตำนานกองกลาง'], ['Yaya Touré', 'ตำนานกองกลาง'],
    ['Vincent Kompany', 'ตำนานกัปตัน'], ['Joe Hart', 'ตำนานโกล'], ['Carlos Tevez', 'ตำนานกองหน้า'],
    ['Pablo Zabaleta', 'ตำนานแบ็กขวา'], ['Shaun Wright-Phillips', 'ตำนานปีก'],
  ],
  tot: [
    ['Harry Kane', 'ตำนานกองหน้า'], ['Gareth Bale', 'ตำนานปีก'], ['Ledley King', 'ตำนานกองหลัง'],
    ['Glenn Hoddle', 'ตำนานกองกลาง'], ['Teddy Sheringham', 'ตำนานกองหน้า'], ['Dimitar Berbatov', 'ตำนานกองหน้า'],
    ['Luka Modrić', 'ตำนานกองกลาง'], ['Sonny Perkins', 'ตำนานเยาวชน'],
  ],
  // fix tot - Sonny Perkins is not a legend, replace later
  new: [
    ['Alan Shearer', 'ตำนานกองหน้า'], ['Peter Beardsley', 'ตำนานกองหน้า'], ['Shay Given', 'ตำนานโกล'],
    ['Rob Lee', 'ตำนานกองกลาง'], ['Kevin Keegan', 'ตำนานกองหน้า'], ['Les Ferdinand', 'ตำนานกองหน้า'],
    ['Nolberto Solano', 'ตำนานปีก'], ['Fabricio Coloccini', 'ตำนานกองหลัง'],
  ],
  avl: [
    ['Paul McGrath', 'ตำนานกองหลัง'], ['Dwight Yorke', 'ตำนานกองหน้า'], ['Gareth Barry', 'ตำนานกองกลาง'],
    ['Gordon Cowans', 'ตำนานกองกลาง'], ['Peter Withe', 'ตำนานกองหน้า'], ['Nigel Spink', 'ตำนานโกล'],
  ],
  eve: [
    ['Dixie Dean', 'ตำนานกองหน้า'], ['Neville Southall', 'ตำนานโกล'], ['Duncan Ferguson', 'ตำนานกองหน้า'],
    ['Tim Cahill', 'ตำนานกองกลาง'], ['Leighton Baines', 'ตำนานแบ็กซ้าย'], ['Joe Royle', 'ตำนานกองหน้า'],
  ],
  whu: [
    ['Bobby Moore', 'ตำนานกัปตัน'], ['Paolo Di Canio', 'ตำนานกองหน้า'], ['Trevor Brooking', 'ตำนานกองกลาง'],
    ['Billy Bonds', 'ตำนานกองหลัง'], ['Mark Noble', 'ตำนานกองกลาง'], ['Rio Ferdinand', 'ตำนานเยาวชน'],
  ],
  lee: [
    ['Billy Bremner', 'ตำนานกัปตัน'], ['Johnny Giles', 'ตำนานกองกลาง'], ['Eddie Gray', 'ตำนานปีก'],
    ['Lucas Radebe', 'ตำนานกองหลัง'], ['Tony Yeboah', 'ตำนานกองหน้า'], ['Gary Speed', 'ตำนานกองกลาง'],
  ],
  rma: [
    ['Zinedine Zidane', 'ตำนานกองกลาง'], ['Raúl', 'ตำนานกองหน้า'], ['Iker Casillas', 'ตำนานโกล'],
    ['Ronaldo Nazário', 'ตำนานกองหน้า'], ['Roberto Carlos', 'ตำนานแบ็กซ้าย'], ['Sergio Ramos', 'ตำนานกัปตัน'],
    ['Fernando Hierro', 'ตำนานกองหลัง'], ['Hugo Sánchez', 'ตำนานกองหน้า'], ['Emilio Butragueño', 'ตำนานกองหน้า'],
  ],
  bar: [
    ['Lionel Messi', 'ตำนานกองหน้า'], ['Xavi Hernández', 'ตำนานกองกลาง'], ['Andrés Iniesta', 'ตำนานกองกลาง'],
    ['Carles Puyol', 'ตำนานกัปตัน'], ['Ronaldinho', 'ตำนานกองหน้า'], ['Johan Cruyff', 'ตำนานตำนาน'],
    ['Rivaldo', 'ตำนานกองหน้า'], ['Samuel Eto\'o', 'ตำนานกองหน้า'],
  ],
  atm: [
    ['Fernando Torres', 'ตำนานกองหน้า'], ['Diego Forlán', 'ตำนานกองหน้า'], ['Sergio Agüero', 'ตำนานกองหน้า'],
    ['Koke', 'ตำนานกองกลาง'], ['Diego Godín', 'ตำนานกองหลัง'], ['Radamel Falcao', 'ตำนานกองหน้า'],
    ['Luis Aragonés', 'ตำนานกองหน้า'], ['Adrián López', 'ตำนานกองหน้า'],
  ],
  bay: [
    ['Franz Beckenbauer', 'ตำนานลิเบอโร'], ['Gerd Müller', 'ตำนานกองหน้า'], ['Lothar Matthäus', 'ตำนานกองกลาง'],
    ['Oliver Kahn', 'ตำนานโกล'], ['Philipp Lahm', 'ตำนานกัปตัน'], ['Bastian Schweinsteiger', 'ตำนานกองกลาง'],
    ['Karl-Heinz Rummenigge', 'ตำนานกองหน้า'], ['Miroslav Klose', 'ตำนานกองหน้า'],
  ],
  bvb: [
    ['Marco Reus', 'ตำนานกองหน้า'], ['Jürgen Kohler', 'ตำนานกองหลัง'], ['Lars Ricken', 'ตำนานกองกลาง'],
    ['Stefan Klos', 'ตำนานโกล'], ['Roman Weidenfeller', 'ตำนานโกล'], ['Mats Hummels', 'ตำนานกองหลัง'],
    ['Michael Zorc', 'ตำนานกองกลาง'], ['Stéphane Chapuisat', 'ตำนานกองหน้า'],
  ],
  psg: [
    ['Pauleta', 'ตำนานกองหน้า'], ['Ronaldinho', 'ตำนานกองหน้า'], ['Claude Makelele', 'ตำนานCDM'],
    ['Bernard Lama', 'ตำนานโกล'], ['George Weah', 'ตำนานกองหน้า'], ['Rai', 'ตำนานกองกลาง'],
    ['David Ginola', 'ตำนานปีก'], ['Safet Sušić', 'ตำนานกองกลาง'],
  ],
  juv: [
    ['Alessandro Del Piero', 'ตำนานกองหน้า'], ['Gianluigi Buffon', 'ตำนานโกล'], ['Andrea Pirlo', 'ตำนานกองกลาง'],
    ['Pavel Nedvěd', 'ตำนานกองกลาง'], ['Michel Platini', 'ตำนานกองกลาง'], ['Roberto Baggio', 'ตำนานกองหน้า'],
    ['Giorgio Chiellini', 'ตำนานกองหลัง'], ['David Trezeguet', 'ตำนานกองหน้า'],
  ],
  mil: [
    ['Paolo Maldini', 'ตำนานกัปตัน'], ['Franco Baresi', 'ตำนานลิเบอโร'], ['Andriy Shevchenko', 'ตำนานกองหน้า'],
    ['Kaká', 'ตำนานกองกลาง'], ['Marco van Basten', 'ตำนานกองหน้า'], ['Ruud Gullit', 'ตำนานกองกลาง'],
    ['Gennaro Gattuso', 'ตำนานกองกลาง'], ['Filippo Inzaghi', 'ตำนานกองหน้า'],
  ],
  int: [
    ['Javier Zanetti', 'ตำนานกัปตัน'], ['Ronaldo Nazário', 'ตำนานกองหน้า'], ['Giuseppe Meazza', 'ตำนานกองหน้า'],
    ['Wesley Sneijder', 'ตำนานกองกลาง'], ['Samuel Eto\'o', 'ตำนานกองหน้า'], ['Marco Materazzi', 'ตำนานกองหลัง'],
    ['Giuseppe Baresi', 'ตำนานกองหลัง'], ['Diego Milito', 'ตำนานกองหน้า'],
  ],
  nap: [
    ['Diego Maradona', 'ตำนานกองกลาง'], ['Careca', 'ตำนานกองหน้า'], ['Marek Hamšík', 'ตำนานกองกลาง'],
    ['Giuseppe Bruscolotti', 'ตำนานกองหลัง'], ['Ciro Ferrara', 'ตำนานกองหลัง'], ['Edinson Cavani', 'ตำนานกองหน้า'],
  ],
  rom: [
    ['Francesco Totti', 'ตำนานกัปตัน'], ['Daniele De Rossi', 'ตำนานกองกลาง'], ['Giuseppe Giannini', 'ตำนานกองกลาง'],
    ['Vincent Candela', 'ตำนานแบ็ก'], ['Gabriel Batistuta', 'ตำนานกองหน้า'], ['Bruno Conti', 'ตำนานปีก'],
  ],
  aja: [
    ['Johan Cruyff', 'ตำนานตำนาน'], ['Marco van Basten', 'ตำนานกองหน้า'], ['Dennis Bergkamp', 'ตำนานกองหน้า'],
    ['Frank Rijkaard', 'ตำนานกองกลาง'], ['Clarence Seedorf', 'ตำนานกองกลาง'], ['Edwin van der Sar', 'ตำนานโกล'],
    ['Wesley Sneijder', 'ตำนานกองกลาง'], ['Jari Litmanen', 'ตำนานกองกลาง'],
  ],
  psv: [
    ['Ruud van Nistelrooy', 'ตำนานกองหน้า'], ['Phillip Cocu', 'ตำนานกองกลาง'], ['Luc Nilis', 'ตำนานกองหน้า'],
    ['Romário', 'ตำนานกองหน้า'], ['Ronald Koeman', 'ตำนานกองหลัง'], ['Mark van Bommel', 'ตำนานกองกลาง'],
  ],
  fey: [
    ['Willem van Hanegem', 'ตำนานกองกลาง'], ['Robin van Persie', 'ตำนานกองหน้า'], ['Dirk Kuyt', 'ตำนานกองหน้า'],
    ['Giovanni van Bronckhorst', 'ตำนานแบ็ก'], ['Włodzimierz Smolarek', 'ตำนานกองหน้า'], ['Coen Moulijn', 'ตำนานปีก'],
  ],
  ben: [
    ['Eusébio', 'ตำนานกองหน้า'], [' Rui Costa', 'ตำนานกองกลาง'], ['Nuno Gomes', 'ตำนานกองหน้า'],
    ['Simão', 'ตำนานปีก'], ['Luisão', 'ตำนานกองหลัง'], ['Óscar Cardozo', 'ตำนานกองหน้า'],
  ],
  fcp: [
    ['Vítor Baía', 'ตำนานโกล'], ['Deco', 'ตำนานกองกลาง'], ['Ricardo Carvalho', 'ตำนานกองหลัง'],
    ['Jorge Costa', 'ตำนานกัปตัน'], ['Radamel Falcao', 'ตำนานกองหน้า'], ['Hulk', 'ตำนานปีก'],
  ],
  spo: [
    ['Luís Figo', 'ตำนานปีก'], ['Cristiano Ronaldo', 'ตำนานเยาวชน'], ['Rui Patrício', 'ตำนานโกล'],
    ['João Pinto', 'ตำนานกองหน้า'], ['Pedrinho', 'ตำนานปีก'], ['Ricardo Quaresma', 'ตำนานปีก'],
  ],
  gal: [
    ['Hakan Şükür', 'ตำนานกองหน้า'], ['Gheorghe Hagi', 'ตำนานกองกลาง'], ['Metin Oktay', 'ตำนานกองหน้า'],
    ['Tugay Kerimoğlu', 'ตำนานกองกลาง'], ['Fatih Terim', 'ตำนานกองกลาง'], ['Arda Turan', 'ตำนานปีก'],
  ],
  fen: [
    ['Alex de Souza', 'ตำนานกองกลาง'], ['Lefter Küçükandonyadis', 'ตำนานกองหน้า'], ['Rüştü Reçber', 'ตำนานโกล'],
    ['Emre Belözoğlu', 'ตำนานกองกลาง'], ['Dirk Kuyt', 'ตำนานกองหน้า'], ['Roberto Carlos', 'ตำนานแบ็ก'],
  ],
  bjk: [
    ['Sergen Yalçın', 'ตำนานกองกลาง'], ['Ricardo Quaresma', 'ตำนานปีก'], ['Mario Gómez', 'ตำนานกองหน้า'],
    ['Daniel Pancu', 'ตำนานกองหน้า'], ['İbrahim Üzülmez', 'ตำนานแบ็ก'], ['Pascal Nouma', 'ตำนานกองหน้า'],
  ],
  fla: [
    ['Zico', 'ตำนานกองกลาง'], ['Romário', 'ตำนานกองหน้า'], ['Junior', 'ตำนานแบ็ก'],
    ['Adílio', 'ตำนานกองกลาง'], ['Gabigol', 'ตำนานกองหน้า'], ['Petković', 'ตำนานกองกลาง'],
  ],
  plm: [
    ['Ademir da Guia', 'ตำนานกองกลาง'], ['Marcos', 'ตำนานโกล'], ['Djalminha', 'ตำนานกองกลาง'],
    ['Evair', 'ตำนานกองหน้า'], ['Alex Minella', 'ตำนานกองกลาง'], ['Marcos Assunção', 'ตำนานกองกลาง'],
  ],
  sao: [
    ['Rogério Ceni', 'ตำนานโกล'], ['Raí', 'ตำนานกองกลาง'], ['Kaká', 'ตำนานกองกลาง'],
    ['Careca', 'ตำนานกองหน้า'], ['Leonardo', 'ตำนานกองกลาง'], ['Cafu', 'ตำนานแบ็ก'],
  ],
  scc: [
    ['Sócrates', 'ตำนานกองกลาง'], ['Ronaldo', 'ตำนานเยาวชน'], ['Rivellino', 'ตำนานกองกลาง'],
    ['Neto', 'ตำนานกองกลาง'], ['Marcelinho Carioca', 'ตำนานกองกลาง'], ['Tevez', 'ตำนานกองหน้า'],
  ],
  sts: [
    ['Pelé', 'ตำนานตำนาน'], ['Neymar', 'ตำนานเยาวชน'], ['Robinho', 'ตำนานกองหน้า'],
    ['Diego', 'ตำนานกองกลาง'], ['Giovanni', 'ตำนานกองหน้า'], ['Coutinho', 'ตำนานกองกลาง'],
  ],
  clt: [
    ['Henrik Larsson', 'ตำนานกองหน้า'], ['Jimmy Johnstone', 'ตำนานปีก'], ['Paul McStay', 'ตำนานกองกลาง'],
    ['Billy McNeill', 'ตำนานกัปตัน'], ['Lubomír Moravčík', 'ตำนานกองกลาง'], ['Chris Sutton', 'ตำนานกองหน้า'],
  ],
  rfc: [
    ['Ally McCoist', 'ตำนานกองหน้า'], ['John Greig', 'ตำนานกัปตัน'], ['Brian Laudrup', 'ตำนานปีก'],
    ['Paul Gascoigne', 'ตำนานกองกลาง'], ['Barry Ferguson', 'ตำนานกองกลาง'], ['Davie Cooper', 'ตำนานปีก'],
  ],
  bru: [
    ['Suchao Nutnum', 'ตำนานกองกลาง'], ['Theerathon Bunmathan', 'ตำนานแบ็ก'], ['Diogo Luís Santo', 'ตำนานกองหน้า'],
    ['Andrés Túñez', 'ตำนานกองหลัง'], ['Jajá Coelho', 'ตำนานกองหน้า'], ['Siwaru Tedsungnoen', 'ตำนานโกล'],
  ],
  mtn: [
    ['Datsakorn Thonglao', 'ตำนานกองกลาง'], ['Teerasil Dangda', 'ตำนานกองหน้า'], ['Kawin Thamsatchanan', 'ตำนานโกล'],
    ['Mario Gjurovski', 'ตำนานกองกลาง'], ['Cleiton Silva', 'ตำนานกองหน้า'], ['Piyaphon Phanichakul', 'ตำนานแบ็ก'],
  ],
  bku: [
    ['Teeratep Winothai', 'ตำนานกองหน้า'], ['Sumanya Purisai', 'ตำนานกองกลาง'], ['Everton', 'ตำนานกองหน้า'],
    ['Manuel Bihr', 'ตำนานกองหลัง'], ['Tristan Do', 'ตำนานแบ็ก'], ['Pokklaw Anan', 'ตำนานกองกลาง'],
  ],
  bgp: [
    ['Chananan Pombuppha', 'ตำนานกองหน้า'], ['Surachart Sareepim', 'ตำนานปีก'], ['Chaowat Veerachat', 'ตำนานกองกลาง'],
    ['Kevin Ingreso', 'ตำนานกองกลาง'], ['Barros Tardeli', 'ตำนานกองหน้า'], ['Chatchai Budprom', 'ตำนานโกล'],
  ],
  ptc: [
    ['Totchtawan Sripan', 'ตำนานกองกลาง'], ['Pipob On-Mo', 'ตำนานกองหน้า'], ['David Tweed', 'ตำนานกองหลัง'],
    ['Worawut Srisupha', 'ตำนานโกล'], ['Go Seul-ki', 'ตำนานกองกลาง'], ['Serginho', 'ตำนานกองหน้า'],
  ],
  chu: [
    ['Therdsak Chaiman', 'ตำนานกองกลาง'], ['Pipob On-Mo', 'ตำนานกองหน้า'], ['Sinthaweechai Hathairattanakool', 'ตำนานโกล'],
    ['Natthaphong Samana', 'ตำนานแบ็ก'], ['Anderson dos Santos', 'ตำนานกองกลาง'], ['Juliano Mineiro', 'ตำนานกองหน้า'],
  ],
  chi: [
    ['Victor Igbonefo', 'ตำนานกองหลัง'], ['Sivakorn Tiatrakul', 'ตำนานกองกลาง'], ['Bill Poni Chiroy', 'ตำนานกองหน้า'],
    ['Chotipat Poomkaew', 'ตำนานปีก'], ['Lee Yong-rae', 'ตำนานกองกลาง'], ['Ciro Atuesta', 'ตำนานกองกลาง'],
  ],
  kas: [
    ['Zico', 'ตำนานโค้ชตำนาน'], ['Atsuya Furuta', 'ตำนานโกล'], ['Mitsuo Ogasawara', 'ตำนานกองกลาง'],
    ['Yoshiyuki Hasegawa', 'ตำนานกองหน้า'], ['Masashi Motoyama', 'ตำนานกองกลาง'], ['Daiki Iwamasa', 'ตำนานกองหลัง'],
  ],
  ura: [
    ['Shinji Ono', 'ตำนานกองกลาง'], ['Makoto Hasebe', 'ตำนานกองกลาง'], ['Emerson Sheik', 'ตำนานกองหน้า'],
    ['Keita Suzuki', 'ตำนานกองกลาง'], ['Yuki Abe', 'ตำนานกองกลาง'], ['Nobuhiro Takeda', 'ตำนานกองหน้า'],
  ],
  kaw: [
    ['Kengo Nakamura', 'ตำนานกองกลาง'], ['Yoshito Ōkubo', 'ตำนานกองหน้า'], ['Jong Tae-se', 'ตำนานกองหน้า'],
    ['Yu Kobayashi', 'ตำนานกองหน้า'], ['Renato', 'ตำนานกองกลาง'], ['Kyohei Noborizato', 'ตำนานแบ็ก'],
  ],
  yfm: [
    ['Shunsuke Nakamura', 'ตำนานกองกลาง'], ['Kazuyoshi Miura', 'ตำนานกองหน้า'], ['Naohiro Ishikawa', 'ตำนานปีก'],
    ['Yuji Nakazawa', 'ตำนานกองหลัง'], ['Daisuke Sakata', 'ตำนานกองหน้า'], ['Manabu Saito', 'ตำนานปีก'],
  ],
  gam: [
    ['Yasuyuki Konno', 'ตำนานกองหลัง'], ['Yasuhito Endō', 'ตำนานกองกลาง'], ['Tsuneyasu Miyamoto', 'ตำนานกองหลัง'],
    ['Junichi Inamoto', 'ตำนานกองกลาง'], ['Akira Kaji', 'ตำนานแบ็ก'], ['Takahiro Futagawa', 'ตำนานกองกลาง'],
  ],
  jbk: [
    ['Lee Dong-gook', 'ตำนานกองหน้า'], ['Choi Kang-hee', 'ตำนานกองหลัง'], ['Eninho', 'ตำนานกองกลาง'],
    ['Kim Nam-il', 'ตำนานกองกลาง'], ['Lee Seung-hyun', 'ตำนานปีก'], ['Jung Sung-ryong', 'ตำนานโกล'],
  ],
  sel: [
    ['Park Chu-young', 'ตำนานกองหน้า'], ['Lee Young-pyo', 'ตำนานแบ็ก'], ['Dejan Damjanović', 'ตำนานกองหน้า'],
    ['Kim Dong-jin', 'ตำนานแบ็ก'], ['Ha Dae-sung', 'ตำนานกองกลาง'], ['Choi Yong-soo', 'ตำนานกองหน้า'],
  ],
  uls: [
    ['Kim Young-kwang', 'ตำนานโกล'], ['Lee Chun-soo', 'ตำนานปีก'], ['Kim Shin-wook', 'ตำนานกองหน้า'],
    ['Park Joo-ho', 'ตำนานแบ็ก'], ['Jung Woo-young', 'ตำนานกองกลาง'], ['Kim Tae-hwan', 'ตำนานแบ็ก'],
  ],
  poh: [
    ['Hwang Sun-hong', 'ตำนานกองหน้า'], ['Lee Dong-gook', 'ตำนานกองหน้า'], ['Kim Nam-il', 'ตำนานกองกลาง'],
    ['Park Ji-sung', 'ตำนานเยาวชน'], ['Shin Tae-yong', 'ตำนานกองกลาง'], ['Kim Gi-dong', 'ตำนานกองกลาง'],
  ],
  kop: [
    ['Peter Schmeichel', 'ตำนานโกล'], ['Brian Laudrup', 'ตำนานปีก'], ['Michael Laudrup', 'ตำนานกองกลาง'],
    ['William Kvist', 'ตำนานกองกลาง'], ['Dame N\'Doye', 'ตำนานกองหน้า'], ['Christian Poulsen', 'ตำนานกองกลาง'],
  ],
  oly: [
    ['Predrag Đorđević', 'ตำนานปีก'], ['Rivaldo', 'ตำนานกองกลาง'], ['Giovanni', 'ตำนานกองหน้า'],
    ['Antonis Nikopolidis', 'ตำนานโกล'], ['Ieroklis Stoltidis', 'ตำนานกองกลาง'], ['Kostas Fortounis', 'ตำนานกองกลาง'],
  ],
  rsc: [
    ['Paul Van Himst', 'ตำนานกองหน้า'], ['Franky Vercauteren', 'ตำนานปีก'], ['Michel Preud\'homme', 'ตำนานโกล'],
    ['Vincent Kompany', 'ตำนานเยาวชน'], ['Lukaku', 'ตำนานเยาวชน'], ['Philippe Albert', 'ตำนานกองหลัง'],
  ],
  cbr: [
    ['Jan Ceulemans', 'ตำนานกองกลาง'], ['Franky Van der Elst', 'ตำนานกองกลาง'], ['Gert Verheyen', 'ตำนานปีก'],
    ['Dany Verlinden', 'ตำนานโกล'], ['Timmy Simons', 'ตำนานกองกลาง'], ['Wesley Sonck', 'ตำนานกองหน้า'],
  ],
}

// Fix tot curated (remove fake)
CURATED.tot = [
  ['Harry Kane', 'ตำนานกองหน้า'], ['Gareth Bale', 'ตำนานปีก'], ['Ledley King', 'ตำนานกองหลัง'],
  ['Glenn Hoddle', 'ตำนานกองกลาง'], ['Teddy Sheringham', 'ตำนานกองหน้า'], ['Dimitar Berbatov', 'ตำนานกองหน้า'],
  ['Luka Modrić', 'ตำนานกองกลาง'], ['Steve Perryman', 'ตำนานกัปตัน'],
]

CURATED.ben = [
  ['Eusébio', 'ตำนานกองหน้า'], ['Rui Costa', 'ตำนานกองกลาง'], ['Nuno Gomes', 'ตำนานกองหน้า'],
  ['Simão', 'ตำนานปีก'], ['Luisão', 'ตำนานกองหลัง'], ['Óscar Cardozo', 'ตำนานกองหน้า'],
  ['Coluna', 'ตำนานกองกลาง'], ['Nené', 'ตำนานกองหน้า'],
]

const FIRST = {
  eng: ['James', 'Tom', 'Chris', 'Mark', 'Steve', 'Paul', 'Dave', 'Andy', 'Mike', 'John', 'Gary', 'Ian', 'Neil', 'Tony', 'Kevin'],
  esp: ['Carlos', 'Miguel', 'Javier', 'Luis', 'Antonio', 'Pedro', 'Diego', 'Sergio', 'Raúl', 'Ángel', 'Iván', 'Óscar'],
  ger: ['Thomas', 'Michael', 'Andreas', 'Stefan', 'Markus', 'Christian', 'Oliver', 'Frank', 'Jürgen', 'Uwe'],
  fra: ['Jean', 'Pierre', 'Michel', 'Philippe', 'Alain', 'Laurent', 'Nicolas', 'Olivier', 'David', 'Éric'],
  ita: ['Marco', 'Andrea', 'Roberto', 'Giuseppe', 'Alessandro', 'Francesco', 'Paolo', 'Stefano', 'Luca'],
  tha: ['สมชาย', 'วิชัย', 'สุรชัย', 'ประเสริฐ', 'อนุชา', 'ธนากร', 'พิชัย', 'ชาญวิทย์', 'เกียรติ', 'วรพจน์'],
  jpn: ['Hiroshi', 'Takashi', 'Kenji', 'Yuji', 'Shinji', 'Kazuki', 'Masato', 'Toshiya', 'Naoki'],
  kor: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Han'],
  bra: ['Carlos', 'José', 'Paulo', 'Ricardo', 'André', 'Fábio', 'Marcelo', 'Eduardo', 'Rafael'],
  tur: ['Mehmet', 'Ahmet', 'Mustafa', 'Emre', 'Serkan', 'Ömer', 'Hakan', 'Burak', 'Cenk'],
  ned: ['Jan', 'Peter', 'Erik', 'Marco', 'Dennis', 'Ruud', 'Frank', 'Ronald', 'Wesley'],
  prt: ['João', 'Pedro', 'Miguel', 'Ricardo', 'Nuno', 'Tiago', 'Bruno', 'Carlos', 'Luís'],
  bel: ['Jan', 'Tom', 'Kevin', 'Steven', 'Tim', 'Gilles', 'Nicolas', 'Thomas'],
  sco: ['James', 'John', 'David', 'Alan', 'Craig', 'Stuart', 'Gary', 'Scott', 'Brian'],
  aut: ['Andreas', 'Michael', 'Stefan', 'Thomas', 'Martin', 'Christian', 'Wolfgang'],
  sui: ['Marco', 'Stefan', 'Thomas', 'Alain', 'Pascal', 'Reto', 'Fabian'],
  den: ['Lars', 'Peter', 'Michael', 'Thomas', 'Jakob', 'Christian', 'Mads'],
  gre: ['Giorgos', 'Nikos', 'Kostas', 'Dimitris', 'Thanasis', 'Vasilis', 'Angelos'],
}
const LAST = {
  eng: ['Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Moore', 'Clark', 'Hall', 'Wright', 'King', 'Baker', 'Hill'],
  esp: ['García', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Fernández', 'Ruiz', 'Díaz'],
  ger: ['Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch'],
  fra: ['Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Petit', 'Durand', 'Leroy', 'Moreau', 'Simon'],
  ita: ['Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco'],
  tha: ['ศรีสุข', 'ทองดี', 'ใจดี', 'พงษ์พิพัฒน์', 'วัฒนา', 'บุญมี', 'แสงทอง', 'รัตนโกสินทร์', 'สุวรรณ'],
  jpn: ['Suzuki', 'Takahashi', 'Tanaka', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato'],
  kor: ['Min-jae', 'Sung-woo', 'Ji-hoon', 'Dong-hyun', 'Seung-ho', 'Young-jin', 'Hyun-soo', 'Jae-won'],
  bra: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Ferreira', 'Alves', 'Pereira', 'Costa'],
  tur: ['Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Aydın', 'Öztürk', 'Arslan'],
  ned: ['de Jong', 'van Dijk', 'de Vries', 'Jansen', 'Bakker', 'Visser', 'Smit', 'Meijer'],
  prt: ['Silva', 'Santos', 'Ferreira', 'Pereira', 'Oliveira', 'Costa', 'Rodrigues', 'Martins'],
  bel: ['Peeters', 'Janssens', 'Maes', 'Jacobs', 'Mertens', 'Willems', 'Claes'],
  sco: ['Campbell', 'MacDonald', 'Stewart', 'Robertson', 'Murray', 'Thomson', 'Reid', 'Grant'],
  aut: ['Gruber', 'Huber', 'Bauer', 'Wagner', 'Mayer', 'Pichler', 'Steiner'],
  sui: ['Müller', 'Schmid', 'Keller', 'Meier', 'Weber', 'Fischer', 'Brunner'],
  den: ['Nielsen', 'Jensen', 'Hansen', 'Pedersen', 'Andersen', 'Christensen', 'Larsen'],
  gre: ['Papadopoulos', 'Nikolaidis', 'Georgiou', 'Ioannou', 'Christou', 'Dimitriou'],
}

const ROLE_TAGS = ['กองหน้า', 'กองกลาง', 'กองหลัง', 'โกล', 'ปีก', 'กัปตัน', 'แบ็ก', 'เซ็นเตอร์แบ็ก']

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

function fillerName(leagueId, clubKey, i) {
  const f = FIRST[leagueId] ?? FIRST.eng
  const l = LAST[leagueId] ?? LAST.eng
  const h = hash(`${clubKey}:${i}`)
  if (leagueId === 'kor') {
    return `${f[h % f.length]} ${l[(h >> 4) % l.length]}`
  }
  if (leagueId === 'tha') {
    return `${f[h % f.length]} ${l[(h >> 3) % l.length]}`
  }
  return `${f[h % f.length]} ${l[(h >> 5) % l.length]}`
}

function slugId(name, clubKey, i) {
  const base = String(name)
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 40)
  return `${clubKey}_${base || 'leg'}_${i}`
}

const MIN = 6

const clubs = loadClubsFromTsApprox()
const personalities = []
const seenIds = new Set()
const seenNames = new Set()

for (const club of clubs) {
  const curated = CURATED[club.key] ?? []
  const list = []
  for (let i = 0; i < curated.length; i++) {
    const [name, tag] = curated[i]
    list.push({ name: name.trim(), tag })
  }
  let i = list.length
  while (list.length < MIN) {
    let name = fillerName(club.leagueId, club.key, i)
    // avoid exact dup within club
    while (list.some((x) => x.name === name)) {
      i++
      name = fillerName(club.leagueId, club.key, i)
    }
    const tag = ROLE_TAGS[hash(name) % ROLE_TAGS.length]
    list.push({ name, tag })
    i++
  }
  // cap at 10 if curated was huge
  const use = list.slice(0, Math.max(MIN, Math.min(10, list.length)))

  use.forEach((entry, idx) => {
    const roleMeta = ROLES[idx % ROLES.length]
    let id = slugId(entry.name, club.key, idx)
    if (seenIds.has(id)) id = `${id}_${club.key}`
    seenIds.add(id)
    // allow same legend name on multiple clubs (e.g. Torres) — unique by id
    const nameKey = `${entry.name}|${club.key}`
    if (seenNames.has(nameKey)) return
    seenNames.add(nameKey)

    personalities.push({
      id,
      name: entry.name,
      nameEn: entry.name,
      role: roleMeta.role,
      roleTh: roleMeta.roleTh,
      legendClubKey: club.key,
      legendClubName: club.name,
      bioTh: `ตำนาน${entry.tag}${club.name} · เลิกเล่นแล้ว ปัจจุบันเป็น${roleMeta.roleTh}เกม`,
      leagueIds: [club.leagueId],
    })
  })
}

// Global hosts usable everywhere (extra, not counting toward per-club min)
const globals = [
  {
    id: 'global_lineker',
    name: 'Gary Lineker',
    nameEn: 'Gary Lineker',
    role: 'studio_host',
    roleTh: 'พิธีกรสตูดิโอ',
    legendClubKey: 'tot',
    legendClubName: 'Tottenham / Leicester / ทีมชาติอังกฤษ',
    bioTh: 'ตำนานกองหน้าอังกฤษ · เลิกเล่นแล้ว ปัจจุบันเป็นพิธีกรสตูดิโอระดับโลก',
    leagueIds: clubs.map((c) => c.leagueId).filter((v, i, a) => a.indexOf(v) === i),
  },
  {
    id: 'global_kiatisuk',
    name: 'กิตติศักดิ์ เสน่ห์มวง',
    nameEn: 'Kiatisuk Senamuang',
    role: 'analyst',
    roleTh: 'นักวิเคราะห์',
    legendClubKey: 'tha_nt',
    legendClubName: 'ทีมชาติไทย',
    bioTh: 'ตำนานกองหน้าทีมชาติไทย (Zico ไทย) · เลิกเล่นแล้ว ปัจจุบันเป็นนักวิเคราะห์และผู้บรรยายเกม',
    leagueIds: ['tha', 'eng', 'jpn', 'kor'],
  },
]

for (const g of globals) {
  if (!seenIds.has(g.id)) {
    personalities.push(g)
    seenIds.add(g.id)
  }
}

const byClub = {}
for (const p of personalities) {
  byClub[p.legendClubKey] = (byClub[p.legendClubKey] || 0) + 1
}
const short = Object.entries(byClub).filter(([, n]) => n < MIN)
const out = {
  _note: `ตำนานเลิกเล่น (≥${MIN}/สโมสรชั้นนำ) — ไม่ใช่นักเตะในสกวด · สร้างโดย scripts/buildMediaPersonalities.mjs`,
  _stats: {
    personalities: personalities.length,
    clubs: clubs.length,
    minPerClub: MIN,
    clubsBelowMin: short.length,
  },
  personalities,
}

const dest = path.join(ROOT, 'src/data/mediaPersonalities.json')
fs.writeFileSync(dest, JSON.stringify(out, null, 2) + '\n')
console.log('wrote', dest)
console.log(out._stats)
if (short.length) console.log('below min', short.slice(0, 20))
