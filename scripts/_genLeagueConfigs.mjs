/**
 * One-shot generator: scripts/leagueClubConfigs.json
 * Run: node scripts/_genLeagueConfigs.mjs
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')

function club(key, name, id, rep, shortName, color) {
  return { key, name, id, rep, shortName, color }
}

function euroRep(r) {
  if (r == null || typeof r !== 'number') return 64
  return Math.min(90, Math.round(r + 14))
}

const configs = {
  jpn: [
    club('kas', 'Kashima Antlers', 1189, 82, 'KAS', '#8B0000'),
    club('rey', 'Kashiwa Reysol', 1190, 80, 'REY', '#FFD100'),
    club('kyo', 'Kyoto Sanga', 1192, 78, 'KYO', '#6B2D5C'),
    club('san', 'Sanfrecce Hiroshima', 1193, 80, 'SAN', '#7A003C'),
    club('vsk', 'Vissel Kobe', 106844, 83, 'VSK', '#8B0000'),
    club('mdz', 'Machida Zelvia', 788837, 76, 'MDZ', '#0033A0'),
    club('ura', 'Urawa Red Diamonds', 1195, 79, 'URA', '#E30613'),
    club('kaw', 'Kawasaki Frontale', 107296, 81, 'KAW', '#00A0E9'),
    club('gam', 'Gamba Osaka', 1186, 77, 'GAM', '#0033A0'),
    club('cer', 'Cerezo Osaka', 1185, 75, 'CER', '#E6007E'),
    club('fct', 'FC Tokyo', 107313, 74, 'FCT', '#E30613'),
    club('avi', 'Avispa Fukuoka', 1183, 72, 'AVI', '#0033A0'),
    club('fag', 'Fagiano Okayama', 786547, 68, 'FAG', '#8B0000'),
    club('ssp', 'Shimizu S-Pulse', 1194, 70, 'SSP', '#F5A623'),
    club('yfm', 'Yokohama F. Marinos', 1198, 78, 'YFM', '#0033A0'),
    club('ngg', 'Nagoya Grampus', 1191, 73, 'NGG', '#E30613'),
    club('tvr', 'Tokyo Verdy', 1196, 69, 'TVR', '#008C45'),
    club('jef', 'JEF United Chiba', 1187, 67, 'JEF', '#004B9C'),
    club('vvn', 'V-Varen Nagasaki', 786559, 66, 'VVN', '#F5A623'),
    club('mit', 'Mito HollyHock', 107289, 64, 'MIT', '#0033A0'),
  ],
  jpn2: [
    club('sap', 'Hokkaido Consadole Sapporo', 107285, 68, 'SAP', '#E30613'),
    club('vgs', 'Vegalta Sendai', 107283, 67, 'VGS', '#F5A623'),
    club('bla', 'Blaublitz Akita', 107328, 61, 'BLA', '#0033A0'),
    club('yam', 'Montedio Yamagata', 107301, 64, 'YAM', '#0033A0'),
    club('iwk', 'Iwaki FC', 792248, 62, 'IWK', '#E30613'),
    club('omi', 'Omiya Ardija', 107305, 66, 'OMI', '#F5A623'),
    club('yfc', 'Yokohama FC', 7100042, 70, 'YFC', '#0033A0'),
    club('sho', 'Shonan Bellmare', 1184, 69, 'SHO', '#008C45'),
    club('kof', 'Ventforet Kofu', 107314, 63, 'KOF', '#E30613'),
    club('nig', 'Albirex Niigata', 107280, 68, 'NIG', '#F5A623'),
    club('toy', 'Kataller Toyama', 107342, 60, 'TOY', '#0033A0'),
    club('jub', 'Júbilo Iwata', 1188, 66, 'JUB', '#0033A0'),
    club('fuj', 'Fujieda MYFC', 788854, 60, 'FUJ', '#008C45'),
    club('tos', 'Tokushima Vortis', 786384, 65, 'TOS', '#0033A0'),
    club('ima', 'FC Imabari', 788904, 60, 'IMA', '#E30613'),
    club('sgt', 'Sagan Tosu', 107309, 64, 'SGT', '#E30613'),
    club('oit', 'Oita Trinita', 107303, 62, 'OIT', '#0033A0'),
    club('vnh', 'Vanraure Hachinohe', 775154, 60, 'VNH', '#0033A0'),
    club('rnf', 'Renofa Yamaguchi', 775166, 60, 'RNF', '#E30613'),
    club('ehm', 'Ehime FC', 776288, 60, 'EHM', '#F5A623'),
  ],
  kor: [
    club('sel', 'FC Seoul', 130777, 78, 'SEL', '#E30613'),
    club('uls', 'Ulsan HD', 106808, 82, 'ULS', '#0033A0'),
    club('gwn', 'Gangwon FC', 66006663, 74, 'GWN', '#F5A623'),
    club('jbk', 'Jeonbuk Hyundai Motors', 130776, 84, 'JBK', '#008C45'),
    club('poh', 'Pohang Steelers', 106818, 77, 'POH', '#E30613'),
    club('icn', 'Incheon United', 5709008, 72, 'ICN', '#0033A0'),
    club('any', 'FC Anyang', 66029603, 68, 'ANY', '#6B2D5C'),
    club('jju', 'Jeju SK', 106817, 70, 'JJU', '#F5A623'),
    club('djc', 'Daejeon Hana Citizen', 130774, 71, 'DJC', '#6B2D5C'),
    club('buc', 'Bucheon FC 1995', 66010556, 67, 'BUC', '#E30613'),
    club('gms', 'Gimcheon Sangmu', 106809, 66, 'GMS', '#E30613'),
    club('gwj', 'Gwangju FC', 66011708, 69, 'GWJ', '#F5A623'),
  ],
  kor2: [
    club('bsi', 'Busan IPark', 130775, 68, 'BSI', '#E30613'),
    club('ssb', 'Suwon Samsung Bluewings', 106813, 72, 'SSB', '#0033A0'),
    club('dgf', 'Daegu FC', 5705626, 70, 'DGF', '#0033A0'),
    club('swf', 'Suwon FC', 5707530, 69, 'SWF', '#6B2D5C'),
    club('eel', 'Seoul E-Land', 66034891, 64, 'EEL', '#E30613'),
    club('cna', 'Chungnam Asan', 136423, 61, 'CNA', '#F5A623'),
    club('gyn', 'Gyeongnam FC', 5710867, 63, 'GYN', '#E30613'),
    club('snm', 'Seongnam FC', 200373, 65, 'SNM', '#000000'),
    club('chn', 'Cheonan City', 66002956, 60, 'CHN', '#0033A0'),
    club('cbj', 'Chungbuk Cheongju', 66010583, 60, 'CBJ', '#008C45'),
    club('asn', 'Ansan Greeners', 66039783, 60, 'ASN', '#008C45'),
    club('jnd', 'Jeonnam Dragons', 106812, 63, 'JND', '#F5A623'),
  ],
  bra: [
    club('fla', 'Flamengo', 322, 90, 'FLA', '#E30613'),
    club('plm', 'Palmeiras', 329, 89, 'PLM', '#008C45'),
    club('flu', 'Fluminense', 323, 84, 'FLU', '#8B0000'),
    club('sao', 'São Paulo', 337, 85, 'SAO', '#FFFFFF'),
    club('bah', 'Bahia', 315, 80, 'BAH', '#0033A0'),
    club('cap', 'Athletico Paranaense', 107206, 78, 'CAP', '#E30613'),
    club('cfc', 'Coritiba', 104776, 74, 'CFC', '#008C45'),
    club('cam', 'Atlético Mineiro', 314, 86, 'CAM', '#000000'),
    club('rbb', 'Red Bull Bragantino', 317, 79, 'RBB', '#FFFFFF'),
    club('vit', 'Vitória', 340, 74, 'VIT', '#E30613'),
    club('bot', 'Botafogo', 316, 85, 'BOT', '#000000'),
    club('gfb', 'Grêmio', 324, 82, 'GFB', '#0033A0'),
    club('vas', 'Vasco da Gama', 339, 80, 'VAS', '#000000'),
    club('sci', 'Internacional', 326, 83, 'SCI', '#E30613'),
    club('sts', 'Santos', 335, 81, 'STS', '#FFFFFF'),
    club('scc', 'Corinthians', 319, 84, 'SCC', '#000000'),
    club('cru', 'Cruzeiro', 321, 83, 'CRU', '#0033A0'),
    club('rem', 'Remo', 334, 66, 'REM', '#0033A0'),
    club('chp', 'Chapecoense', 301304, 67, 'CHP', '#008C45'),
    club('mrs', 'Mirassol', 301344, 72, 'MRS', '#F5A623'),
  ],
  tur: [
    club('gal', 'Galatasaray', 1871, 88, 'GAL', '#F5A623'),
    club('fen', 'Fenerbahçe', 1870, 87, 'FEN', '#0033A0'),
    club('trb', 'Trabzonspor', 1879, 82, 'TRB', '#8B0000'),
    club('bjk', 'Beşiktaş', 1866, 84, 'BJK', '#000000'),
    club('ibs', 'İstanbul Başakşehir', 130343, 76, 'IBS', '#F5A623'),
    club('goz', 'Göztepe', 130338, 74, 'GOZ', '#E30613'),
    club('sms', 'Samsunspor', 1878, 72, 'SMS', '#E30613'),
    club('riz', 'Çaykur Rizespor', 130366, 70, 'RIZ', '#0033A0'),
    club('kon', 'Konyaspor', 130344, 73, 'KON', '#008C45'),
    club('aly', 'Alanyaspor', 458718, 69, 'ALY', '#F5A623'),
    club('gaz', 'Gaziantep FK', 130341, 68, 'GAZ', '#E30613'),
    club('ksp', 'Kasımpaşa', 130360, 70, 'KSP', '#0033A0'),
    club('gnc', 'Gençlerbirliği', 1873, 66, 'GNC', '#E30613'),
    club('koc', 'Kocaelispor', 1876, 65, 'KOC', '#008C45'),
    club('aty', 'Antalyaspor', 1865, 69, 'ATY', '#E30613'),
    club('eyu', 'Eyüpspor', 130289, 64, 'EYU', '#6B2D5C'),
    club('kay', 'Kayserispor', 1875, 66, 'KAY', '#E30613'),
    club('fkg', 'Fatih Karagümrük', 458631, 64, 'FKG', '#E30613'),
  ],
  ned: [
    club('aja', 'Ajax', 992, euroRep(74), 'AJA', '#E30613'),
    club('psv', 'PSV', 1028, euroRep(75), 'PSV', '#E30613'),
    club('fey', 'Feyenoord', 1013, euroRep(73), 'FEY', '#E30613'),
    club('aza', 'AZ', 991, euroRep(69), 'AZ', '#E30613'),
    club('twe', 'FC Twente', 1009, euroRep(65), 'TWE', '#E30613'),
    club('utr', 'FC Utrecht', 1010, euroRep(63), 'UTR', '#E30613'),
    club('nec', 'NEC', 1025, euroRep(60), 'NEC', '#E30613'),
    club('hee', 'Heerenveen', 1036, euroRep(59), 'HEE', '#0033A0'),
    club('gae', 'Go Ahead Eagles', 1015, euroRep(59), 'GAE', '#E30613'),
    club('spr', 'Sparta Rotterdam', 1039, euroRep(59), 'SPR', '#E30613'),
    club('fsr', 'Fortuna Sittard', 1014, euroRep(58), 'FOR', '#F5A623'),
    club('gro', 'Groningen', 1007, euroRep(57), 'GRO', '#008C45'),
    club('zwl', 'PEC Zwolle', 1012, euroRep(56), 'ZWO', '#0033A0'),
    club('hra', 'Heracles', 1037, euroRep(56), 'HER', '#000000'),
    club('nac', 'NAC Breda', 1024, euroRep(55), 'NAC', '#F5A623'),
    club('exc', 'Excelsior', 1004, euroRep(53), 'EXC', '#000000'),
    club('vld', 'FC Volendam', 1011, euroRep(53), 'VOL', '#F5A623'),
    club('tel', 'Telstar', 1043, euroRep(46), 'TEL', '#FFFFFF'),
  ],
  prt: [
    club('ben', 'Benfica', 1487, euroRep(82), 'SLB', '#E30613'),
    club('fcp', 'FC Porto', 1478, euroRep(81), 'FCP', '#0033A0'),
    club('spo', 'Sporting CP', 1489, euroRep(76), 'SCP', '#008C45'),
    club('scb', 'Braga', 1488, euroRep(67), 'SCB', '#E30613'),
    club('vgu', 'Vitória Guimarães', 1494, euroRep(63), 'VGU', '#FFFFFF'),
    club('fam', 'Famalicão', 2397, euroRep(59), 'FAM', '#0033A0'),
    club('est', 'Estoril Praia', 2390, euroRep(58), 'EST', '#F5A623'),
    club('scl', 'Santa Clara', 2448, euroRep(58), 'SCL', '#E30613'),
    club('gil', 'Gil Vicente', 1481, euroRep(57), 'GIL', '#E30613'),
    club('mor', 'Moreirense', 2389, euroRep(57), 'MOR', '#008C45'),
    club('rav', 'Rio Ave', 2383, euroRep(57), 'RAV', '#008C45'),
    club('aro', 'Arouca', 729500, euroRep(56), 'ARO', '#F5A623'),
    club('cpi', 'Casa Pia', 2443, euroRep(55), 'CPI', '#000000'),
    club('nmd', 'Nacional da Madeira', 2433, euroRep(55), 'NMD', '#000000'),
    club('esa', 'Estrela da Amadora SAD', 2000030636, euroRep(54), 'ESA', '#E30613'),
    club('ton', 'Tondela', 2424, euroRep(54), 'TON', '#008C45'),
    club('alv', 'Alverca SAD', 2391, euroRep(53), 'ALV', '#E30613'),
    club('avs', 'AVS SAD', 2000263090, euroRep(53), 'AVS', '#FFFFFF'),
  ],
  bel: [
    club('cbr', 'Club Brugge', 186, euroRep(72), 'CLB', '#0033A0'),
    club('gnk', 'KRC Genk', 258, euroRep(67), 'GNK', '#0033A0'),
    club('rsc', 'RSC Anderlecht', 256, euroRep(65), 'AND', '#6B2D5C'),
    club('usk', 'Union SG', 288, euroRep(65), 'USG', '#F5A623'),
    club('ant', 'Royal Antwerp', 262, euroRep(64), 'ANT', '#E30613'),
    club('kaa', 'AA Gent', 168, euroRep(63), 'GNT', '#0033A0'),
    club('stl', 'Standard Liège', 250, euroRep(60), 'STD', '#E30613'),
    club('cha', 'Royal Charleroi', 263, euroRep(59), 'CHA', '#000000'),
    club('mec', 'KV Mechelen', 232, euroRep(58), 'MEC', '#E30613'),
    club('wes', 'KV Westerlo', 289, euroRep(58), 'WES', '#F5A623'),
    club('ohl', 'OH Leuven', 280, euroRep(58), 'OHL', '#FFFFFF'),
    club('ceb', 'Cercle Brugge', 184, euroRep(57), 'CEB', '#008C45'),
    club('stv', 'Sint-Truiden', 278, euroRep(56), 'STV', '#F5A623'),
    club('dnd', 'Dender EH', 199, euroRep(56), 'DEN', '#0033A0'),
    club('zwg', 'Zulte Waregem', 299, euroRep(55), 'ZWA', '#E30613'),
    club('lou', 'RAAL La Louvière', 169, euroRep(53), 'LOU', '#FFFFFF'),
  ],
  sco: [
    club('clt', 'Celtic', 1569, euroRep(69), 'CEL', '#008C45'),
    club('rfc', 'Rangers', 1570, euroRep(66), 'RAN', '#0033A0'),
    club('abe', 'Aberdeen', 1536, euroRep(58), 'ABE', '#E30613'),
    club('hrt', 'Hearts', 1573, euroRep(57), 'HRT', '#8B0000'),
    club('hib', 'Hibernian', 1575, euroRep(57), 'HIB', '#008C45'),
    club('duu', 'Dundee United', 1556, euroRep(55), 'DUU', '#F5A623'),
    club('mot', 'Motherwell', 1584, euroRep(54), 'MOT', '#E30613'),
    club('dde', 'Dundee', 1555, euroRep(53), 'DUN', '#0033A0'),
    club('kil', 'Kilmarnock', 1580, euroRep(52), 'KIL', '#0033A0'),
    club('stm', 'St Mirren', 1597, euroRep(52), 'STM', '#000000'),
    club('fal', 'Falkirk', 1563, euroRep(48), 'FAL', '#0033A0'),
    club('lvs', 'Livingston', 1581, 64, 'LVS', '#F5A623'),
  ],
  aut: [
    club('rbs', 'FC RB Salzburg', 158, euroRep(70), 'RBS', '#E30613'),
    club('rap', 'SK Rapid', 155, euroRep(68), 'RAP', '#008C45'),
    club('sgz', 'SK Sturm Graz', 156, euroRep(67), 'STU', '#000000'),
    club('auw', 'FK Austria Vienna', 152, euroRep(65), 'AUS', '#6B2D5C'),
    club('las', 'LASK Linz', 154, euroRep(64), 'LASK', '#000000'),
    club('wac', 'Wolfsberger AC', 16034828, euroRep(64), 'WAC', '#FFFFFF'),
    club('wti', 'WSG Tirol', 16324690, euroRep(61), 'WSG', '#008C45'),
    club('alt', 'SCR Altach', 137973, euroRep(61), 'ALT', '#000000'),
    club('bwl', 'FC Blau-Weiß Linz', 137962, euroRep(60), 'BWL', '#0033A0'),
    club('gak', 'Grazer AK 1902', 16309710, euroRep(60), 'GAK', '#E30613'),
    club('har', 'TSV Hartberg', 137959, euroRep(59), 'HAR', '#0033A0'),
    club('rie', 'SV Ried', 159, euroRep(56), 'RIE', '#008C45'),
  ],
  sui: [
    club('yob', 'Young Boys', 1847, euroRep(64), 'YB', '#F5A623'),
    club('bsl', 'FC Basel', 1849, euroRep(64), 'FCB', '#E30613'),
    club('srv', 'Servette FC', 1858, euroRep(61), 'SER', '#8B0000'),
    club('lug', 'FC Lugano', 1850, euroRep(60), 'LUG', '#000000'),
    club('stg', 'FC St. Gallen', 1853, euroRep(60), 'STG', '#008C45'),
    club('luz', 'FC Luzern', 1851, euroRep(59), 'LUZ', '#0033A0'),
    club('fcz', 'FC Zürich', 1854, euroRep(59), 'FCZ', '#0033A0'),
    club('lau', 'FC Lausanne', 1856, euroRep(58), 'LAU', '#0033A0'),
    club('sio', 'FC Sion', 1852, euroRep(57), 'SIO', '#E30613'),
    club('gcz', 'Grasshoppers', 1855, euroRep(55), 'GCZ', '#0033A0'),
    club('thu', 'Thun', 514173, euroRep(54), 'THU', '#E30613'),
    club('win', 'FC Winterthur', 1200101, 66, 'WIN', '#E30613'),
  ],
  den: [
    club('kop', 'FC København', 505, euroRep(68), 'FCK', '#FFFFFF'),
    club('fcm', 'FC Midtjylland', 526, euroRep(63), 'FCM', '#000000'),
    club('bro', 'Brøndby IF', 496, euroRep(62), 'BIF', '#F5A623'),
    club('nsj', 'Nordsjælland', 932443, euroRep(60), 'FCN', '#E30613'),
    club('ran', 'Randers', 930621, euroRep(57), 'RFC', '#0033A0'),
    club('agf', 'Aarhus GF', 482, euroRep(57), 'AGF', '#FFFFFF'),
    club('vib', 'Viborg', 569, euroRep(55), 'VFF', '#008C45'),
    club('sil', 'Silkeborg IF', 551, euroRep(55), 'SIF', '#E30613'),
    club('obk', 'Odense BK', 545, euroRep(55), 'OB', '#0033A0'),
    club('vej', 'Vejle', 2142, euroRep(53), 'VB', '#E30613'),
    club('son', 'Sønderjyske', 926867, euroRep(52), 'SJE', '#0033A0'),
    club('frd', 'Fredericia', 504, euroRep(47), 'FRE', '#0033A0'),
  ],
  gre: [
    club('oly', 'Olympiacos', 981, euroRep(73), 'OLY', '#E30613'),
    club('pao', 'PAOK', 982, euroRep(70), 'PAOK', '#000000'),
    club('pan', 'Panathinaikos', 983, euroRep(70), 'PAO', '#008C45'),
    club('aek', 'AEK Athens', 967, euroRep(69), 'AEK', '#F5A623'),
    club('ari', 'Aris Saloniki', 969, euroRep(63), 'ARIS', '#F5A623'),
    club('ofi', 'OFI Crete', 980, euroRep(56), 'OFI', '#000000'),
    club('atr', 'Atromitos', 129692, euroRep(55), 'ATR', '#0033A0'),
    club('ast', 'Asteras Tripolis', 694366, euroRep(55), 'AST', '#F5A623'),
    club('lvd', 'Levadeiakos', 979, euroRep(53), 'LEV', '#008C45'),
    club('vlo', 'NPS Volos', 36136195, euroRep(52), 'VLO', '#0033A0'),
    club('ptk', 'Panetolikos', 129665, euroRep(52), 'PAN', '#F5A623'),
    club('psr', 'Panserraikos', 129666, euroRep(51), 'PSE', '#E30613'),
    club('ael', 'AE Larisas', 978, 68, 'AEL', '#8B0000'),
    club('kif', 'AE Kifisias', 36077318, 67, 'KIF', '#0033A0'),
  ],
}

const out = {
  _meta: {
    note: 'Consolidated club configs for new leagues. Remaps: chp/aty/ceb/stg/yob/gcz/scb/fsr; jpn2 fill vnh/rnf/ehm; kor2=12 confirmed IDs.',
    date: '2026-07-19',
  },
  ...configs,
}

fs.writeFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), JSON.stringify(out, null, 2) + '\n')

const existing = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/data/world/fmClubIds.json'), 'utf8'))
const div2 = fs.readFileSync(path.join(ROOT, 'src/data/world/div2Clubs.ts'), 'utf8')
const leagues =
  fs.readFileSync(path.join(ROOT, 'src/data/world/leaguesCore.ts'), 'utf8') +
  fs.readFileSync(path.join(ROOT, 'src/data/world/leaguesRest.ts'), 'utf8') +
  fs.readFileSync(path.join(ROOT, 'src/data/world/leaguesLatinThai.ts'), 'utf8')
const existingKeys = new Set([
  ...Object.keys(existing),
  ...(div2.match(/key:\s*'([a-z0-9]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]),
  ...(leagues.match(/key:\s*'([a-z0-9]+)'/g) || []).map((s) => s.match(/'([^']+)'/)[1]),
])

const seen = new Map()
const collisions = []
const internalDupes = []
for (const [lid, clubs] of Object.entries(configs)) {
  console.log(lid, clubs.length)
  for (const c of clubs) {
    if (seen.has(c.key)) internalDupes.push(`${c.key}: ${seen.get(c.key)} vs ${lid}`)
    else seen.set(c.key, lid)
    if (existingKeys.has(c.key)) collisions.push(`${c.key} (${lid} ${c.name})`)
  }
}
console.log('internalDupes', internalDupes)
console.log('vsExisting', collisions)
console.log('wrote scripts/leagueClubConfigs.json')
