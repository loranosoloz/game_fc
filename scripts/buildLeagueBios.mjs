/**
 * Download SortItOutSI top-flight team pages → parse wages/contracts/nationality
 * → write playerBios{Esp,Ger,Fra,Ita}.json (filtered to roster names).
 *
 * Usage:
 *   node scripts/buildLeagueBios.mjs esp --download
 *   node scripts/buildLeagueBios.mjs esp --resolve
 *   node scripts/buildLeagueBios.mjs esp --all
 *   node scripts/buildLeagueBios.mjs all --all
 */
import fs from 'fs'
import path from 'path'
import { spawnSync } from 'child_process'

const ROOT = path.resolve('.')
const DUMP_ROOT = path.join(ROOT, 'scripts/_fm26_dumps')

const LEAGUES = {
  esp: {
    label: 'La Liga',
    playersJson: 'src/data/world/playersEsp.json',
    outJson: 'src/data/world/playerBiosEsp.json',
    idsJson: 'scripts/_fm26_dumps/esp_fm_ids.json',
    dumpDir: 'siosi_esp',
    clubs: {
      rma: { id: 1736, slug: 'real-madrid', name: 'Real Madrid' },
      bar: { id: 1708, slug: 'barcelona', name: 'FC Barcelona' },
      atm: { id: 1687, slug: 'atletico-madrid', name: 'Atlético Madrid' },
      ath: { id: 1664, slug: 'athletic-club', name: 'Athletic Club' },
      rso: { id: 1742, slug: 'real-sociedad', name: 'Real Sociedad' },
      vil: { id: 1777, slug: 'villarreal', name: 'Villarreal' },
      bet: { id: 1733, slug: 'real-betis', name: 'Real Betis' },
      sev: { id: 1759, slug: 'sevilla', name: 'Sevilla' },
      val: { id: 1775, slug: 'valencia', name: 'Valencia' },
      gir: { id: 814089, slug: 'girona', name: 'Girona' },
      osa: { id: 1685, slug: 'osasuna', name: 'Osasuna' },
      cel: { id: 1724, slug: 'celta-vigo', name: 'Celta Vigo' },
      mal: { id: 1726, slug: 'mallorca', name: 'Mallorca' },
      get: { id: 1710, slug: 'getafe', name: 'Getafe' },
      ray: { id: 1729, slug: 'rayo-vallecano', name: 'Rayo Vallecano' },
      ala: { id: 1688, slug: 'alaves', name: 'Alavés' },
      esp: { id: 1725, slug: 'espanyol', name: 'Espanyol' },
      elc: { id: 1707, slug: 'elche', name: 'Elche' },
      lvt: { id: 1717, slug: 'levante', name: 'Levante' },
      ovi: { id: 1741, slug: 'real-oviedo', name: 'Real Oviedo' },
    },
  },
  ger: {
    label: 'Bundesliga',
    playersJson: 'src/data/world/playersGer.json',
    outJson: 'src/data/world/playerBiosGer.json',
    idsJson: 'scripts/_fm26_dumps/ger_fm_ids.json',
    dumpDir: 'siosi_ger',
    clubs: {
      bay: { id: 915, slug: 'bayern-munich', name: 'Bayern Munich' },
      bvb: { id: 907, slug: 'borussia-dortmund', name: 'Borussia Dortmund' },
      b04: { id: 901, slug: 'bayer-leverkusen', name: 'Bayer Leverkusen' },
      rbl: { id: 91013388, slug: 'rb-leipzig', name: 'RB Leipzig' },
      stu: { id: 960, slug: 'vfb-stuttgart', name: 'VfB Stuttgart' },
      ein: { id: 912, slug: 'eintracht-frankfurt', name: 'Eintracht Frankfurt' },
      fre: { id: 944, slug: 'sc-freiburg', name: 'SC Freiburg' },
      wob: { id: 961, slug: 'vfl-wolfsburg', name: 'VfL Wolfsburg' },
      bmg: { id: 908, slug: 'borussia-monchengladbach', name: 'Borussia Mönchengladbach' },
      uni: { id: 121182, slug: 'union-berlin', name: 'Union Berlin' },
      hof: { id: 879226, slug: 'tsg-hoffenheim', name: 'TSG Hoffenheim' },
      wer: { id: 948, slug: 'werder-bremen', name: 'Werder Bremen' },
      m05: { id: 918, slug: 'mainz-05', name: 'Mainz 05' },
      aug: { id: 2238, slug: 'fc-augsburg', name: 'FC Augsburg' },
      koe: { id: 916, slug: '1-fc-koln', name: '1. FC Köln' },
      hea: { id: 880295, slug: 'heidenheim', name: 'Heidenheim' },
      stp: { id: 946, slug: 'fc-st-pauli', name: 'FC St. Pauli' },
      hsv: { id: 947, slug: 'hamburger-sv', name: 'Hamburger SV' },
    },
  },
  fra: {
    label: 'Ligue 1',
    playersJson: 'src/data/world/playersFra.json',
    outJson: 'src/data/world/playerBiosFra.json',
    idsJson: 'scripts/_fm26_dumps/fra_fm_ids.json',
    dumpDir: 'siosi_fra',
    clubs: {
      psg: { id: 868, slug: 'paris-saint-germain', name: 'Paris Saint-Germain' },
      om: { id: 866, slug: 'olympique-de-marseille', name: 'Olympique de Marseille' },
      ol: { id: 865, slug: 'olympique-lyonnais', name: 'Olympique Lyonnais' },
      asm: { id: 826, slug: 'as-monaco', name: 'AS Monaco' },
      lil: { id: 858, slug: 'lille', name: 'Lille' },
      ren: { id: 884, slug: 'stade-rennais', name: 'Stade Rennais' },
      nic: { id: 862, slug: 'ogc-nice', name: 'OGC Nice' },
      rcl: { id: 871, slug: 'rc-lens', name: 'RC Lens' },
      nte: { id: 846, slug: 'nantes', name: 'Nantes' },
      str: { id: 872, slug: 'strasbourg', name: 'Strasbourg' },
      tou: { id: 886, slug: 'toulouse', name: 'Toulouse' },
      sbr: { id: 2061, slug: 'brest', name: 'Brest' },
      // dump file cannot be aux.html on Windows (AUX is a reserved device name)
      auxerre: { id: 824, slug: 'auxerre', name: 'Auxerre', clubKey: 'aux' },
      ang: { id: 875, slug: 'angers', name: 'Angers' },
      hac: { id: 856, slug: 'le-havre', name: 'Le Havre' },
      lor: { id: 2005, slug: 'lorient', name: 'Lorient' },
      pfc: { id: 867, slug: 'paris-fc', name: 'Paris FC' },
      met: { id: 844, slug: 'metz', name: 'Metz' },
    },
  },
  ita: {
    label: 'Serie A',
    playersJson: 'src/data/world/playersIta.json',
    outJson: 'src/data/world/playerBiosIta.json',
    idsJson: 'scripts/_fm26_dumps/ita_fm_ids.json',
    dumpDir: 'siosi_ita',
    clubs: {
      int: { id: 1135, slug: 'inter', name: 'Inter Milan' },
      mil: { id: 1099, slug: 'ac-milan', name: 'AC Milan' },
      juv: { id: 1139, slug: 'juventus', name: 'Juventus' },
      nap: { id: 1150, slug: 'napoli', name: 'Napoli' },
      ata: { id: 1106, slug: 'atalanta', name: 'Atalanta' },
      rom: { id: 1100, slug: 'as-roma', name: 'AS Roma' },
      laz: { id: 1140, slug: 'lazio', name: 'Lazio' },
      fio: { id: 1129, slug: 'fiorentina', name: 'Fiorentina' },
      bol: { id: 1111, slug: 'bologna', name: 'Bologna' },
      tor: { id: 1174, slug: 'torino', name: 'Torino' },
      udi: { id: 1178, slug: 'udinese', name: 'Udinese' },
      gen: { id: 1132, slug: 'genoa', name: 'Genoa' },
      cag: { id: 1114, slug: 'cagliari', name: 'Cagliari' },
      lec: { id: 1141, slug: 'lecce', name: 'Lecce' },
      ver: { id: 2201, slug: 'hellas-verona', name: 'Hellas Verona' },
      par: { id: 1156, slug: 'parma', name: 'Parma' },
      com: { id: 1123, slug: 'como', name: 'Como' },
      sas: { id: 3800256, slug: 'sassuolo', name: 'Sassuolo' },
      pis: { id: 2215, slug: 'pisa', name: 'Pisa' },
      cre: { id: 1125, slug: 'cremonese', name: 'Cremonese' },
    },
  },
  esp2: {
    label: 'LaLiga2',
    playersJson: 'src/data/world/playersEsp2.json',
    outJson: 'src/data/world/playerBiosEsp2.json',
    idsJson: 'scripts/_fm26_dumps/esp2_fm_ids.json',
    dumpDir: 'siosi_esp2',
    clubs: {
      zar: { id: 1749, slug: 'real-zaragoza', name: 'Real Zaragoza' },
      gij: { id: 1744, slug: 'sporting-gijon', name: 'Sporting Gijón' },
      ten: { id: 1680, slug: 'tenerife', name: 'Tenerife' },
      alb: { id: 1660, slug: 'albacete', name: 'Albacete' },
      rac: { id: 1728, slug: 'racing-santander', name: 'Racing Santander' },
      hue: { id: 4212294, slug: 'huesca', name: 'Huesca' },
      mir: { id: 4212197, slug: 'mirandes', name: 'Mirandés' },
      leg: { id: 1678, slug: 'leganes', name: 'Leganés' },
      eib: { id: 1753, slug: 'eibar', name: 'Eibar' },
      lpa: { id: 1772, slug: 'las-palmas', name: 'Las Palmas' },
      vll: { id: 1747, slug: 'valladolid', name: 'Valladolid' },
      ctg: { id: 4203003, slug: 'cartagena', name: 'Cartagena' },
      brg: { id: 4200566, slug: 'burgos', name: 'Burgos' },
      gra: { id: 1714, slug: 'granada', name: 'Granada CF' },
      alm: { id: 1661, slug: 'almeria', name: 'Almería' },
      eld: { id: 4212207, slug: 'eldense', name: 'Eldense' },
      fer: { id: 1727, slug: 'racing-ferrol', name: 'Racing Ferrol' },
      and: { id: 1709, slug: 'andorra', name: 'Andorra CF' },
      cas: { id: 1690, slug: 'castellon', name: 'Castellón' },
      cor: { id: 1704, slug: 'cordoba', name: 'Córdoba' },
    },
  },
  ger2: {
    label: '2. Bundesliga',
    playersJson: 'src/data/world/playersGer2.json',
    outJson: 'src/data/world/playerBiosGer2.json',
    idsJson: 'scripts/_fm26_dumps/ger2_fm_ids.json',
    dumpDir: 'siosi_ger2',
    clubs: {
      h96: { id: 927, slug: 'hannover-96', name: 'Hannover 96' },
      s04: { id: 920, slug: 'schalke-04', name: 'Schalke 04' },
      kie: { id: 2245, slug: 'holstein-kiel', name: 'Holstein Kiel' },
      fck: { id: 945, slug: 'kaiserslautern', name: 'Kaiserslautern' },
      nur: { id: 899, slug: 'nurnberg', name: 'Nürnberg' },
      sgf: { id: 2253, slug: 'greuther-furth', name: 'Greuther Fürth' },
      mdg: { id: 2233, slug: 'magdeburg', name: 'Magdeburg' },
      boc: { id: 905, slug: 'vfl-bochum', name: 'VfL Bochum' },
      scp: { id: 121198, slug: 'paderborn', name: 'Paderborn' },
      ksc: { id: 931, slug: 'karlsruhe', name: 'Karlsruhe' },
      elv: { id: 121200, slug: 'elversberg', name: 'Elversberg' },
      hbs: { id: 2247, slug: 'hertha-bsc', name: 'Hertha BSC' },
      f95: { id: 921, slug: 'dusseldorf', name: 'Düsseldorf' },
      ebs: { id: 2237, slug: 'braunschweig', name: 'Braunschweig' },
      wie: { id: 121208, slug: 'wiesbaden', name: 'Wiesbaden' },
      hro: { id: 928, slug: 'rostock', name: 'Rostock' },
      svd: { id: 108997, slug: 'darmstadt', name: 'Darmstadt' },
      prm: { id: 935, slug: 'munster', name: 'Münster' },
    },
  },
  fra2: {
    label: 'Ligue 2',
    playersJson: 'src/data/world/playersFra2.json',
    outJson: 'src/data/world/playerBiosFra2.json',
    idsJson: 'scripts/_fm26_dumps/fra2_fm_ids.json',
    dumpDir: 'siosi_fra2',
    clubs: {
      rei: { id: 2047, slug: 'reims', name: 'Reims' },
      mtp: { id: 859, slug: 'montpellier', name: 'Montpellier' },
      ase: { id: 828, slug: 'saint-etienne', name: 'Saint-Étienne' },
      aca: { id: 400362, slug: 'ajaccio', name: 'Ajaccio' },
      cae: { id: 877, slug: 'caen', name: 'Caen' },
      gre: { id: 852, slug: 'grenoble', name: 'Grenoble' },
      ami: { id: 831, slug: 'amiens', name: 'Amiens' },
      bas: { id: 876, slug: 'bastia', name: 'Bastia' },
      pau: { id: 2090, slug: 'pau-fc', name: 'Pau FC' },
      rod: { id: 2048, slug: 'rodez', name: 'Rodez' },
      gui: { id: 840, slug: 'guingamp', name: 'Guingamp' },
      dun: { id: 2072, slug: 'dunkerque', name: 'Dunkerque' },
      anc: { id: 85052735, slug: 'annecy', name: 'Annecy' },
      try: { id: 1971, slug: 'troyes', name: 'Troyes' },
      lvl: { id: 2062, slug: 'laval', name: 'Laval' },
      qrm: { id: 50034825, slug: 'quevilly', name: 'Quevilly' },
      cnc: { id: 3501956, slug: 'concarneau', name: 'Concarneau' },
      vac: { id: 888, slug: 'valenciennes', name: 'Valenciennes' },
    },
  },
  ita2: {
    label: 'Serie B',
    playersJson: 'src/data/world/playersIta2.json',
    outJson: 'src/data/world/playerBiosIta2.json',
    idsJson: 'scripts/_fm26_dumps/ita2_fm_ids.json',
    dumpDir: 'siosi_ita2',
    clubs: {
      pal: { id: 2194, slug: 'palermo', name: 'Palermo' },
      caz: { id: 1119, slug: 'catanzaro', name: 'Catanzaro' },
      cos: { id: 1124, slug: 'cosenza', name: 'Cosenza' },
      mod: { id: 1147, slug: 'modena', name: 'Modena' },
      mnz: { id: 1149, slug: 'monza', name: 'Monza' },
      asc: { id: 1105, slug: 'ascoli', name: 'Ascoli' },
      ctd: { id: 2195, slug: 'cittadella', name: 'Cittadella' },
      bsa: { id: 1113, slug: 'brescia', name: 'Brescia' },
      rgn: { id: 1164, slug: 'reggiana', name: 'Reggiana' },
      sam: { id: 1167, slug: 'sampdoria', name: 'Sampdoria' },
      spe: { id: 1173, slug: 'spezia', name: 'Spezia' },
      bri: { id: 1110, slug: 'bari', name: 'Bari' },
      ubs: { id: 43058693, slug: 'union-brescia', name: 'Union Brescia' },
      sud: { id: 829172, slug: 'sudtirol', name: 'Südtirol' },
      trn: { id: 2227, slug: 'ternana', name: 'Ternana' },
      lco: { id: 2205, slug: 'lecco', name: 'Lecco' },
      emp: { id: 1126, slug: 'empoli', name: 'Empoli' },
      ven: { id: 1179, slug: 'venezia', name: 'Venezia' },
      ces: { id: 1120, slug: 'cesena', name: 'Cesena' },
      sal: { id: 1166, slug: 'salernitana', name: 'Salernitana' },
    },
  },
  eng2: {
    label: 'Championship',
    playersJson: 'src/data/world/playersEng2.json',
    outJson: 'src/data/world/playerBiosEng2.json',
    idsJson: 'scripts/_fm26_dumps/eng2_fm_ids.json',
    dumpDir: 'siosi_eng2',
    clubs: {
      brr: { id: 620, slug: 'bristol-rovers', name: 'Bristol Rovers' },
      ply: { id: 697, slug: 'plymouth-argyle', name: 'Plymouth Argyle' },
      der: { id: 645, slug: 'derby-county', name: 'Derby County' },
      blb: { id: 612, slug: 'blackburn-rovers', name: 'Blackburn Rovers' },
      hud: { id: 664, slug: 'huddersfield-town', name: 'Huddersfield Town' },
      mlw: { id: 686, slug: 'millwall', name: 'Millwall' },
      stk: { id: 721, slug: 'stoke-city', name: 'Stoke City' },
      swa: { id: 724, slug: 'swansea-city', name: 'Swansea City' },
      cov: { id: 639, slug: 'coventry-city', name: 'Coventry City' },
      mid: { id: 685, slug: 'middlesbrough', name: 'Middlesbrough' },
      qpr: { id: 701, slug: 'queens-park-rangers', name: 'Queens Park Rangers' },
      shw: { id: 709, slug: 'sheffield-wednesday', name: 'Sheffield Wednesday' },
      wat: { id: 732, slug: 'watford', name: 'Watford' },
      nor: { id: 691, slug: 'norwich-city', name: 'Norwich City' },
      hul: { id: 665, slug: 'hull-city', name: 'Hull City' },
      pne: { id: 700, slug: 'preston-north-end', name: 'Preston North End' },
      car: { id: 625, slug: 'cardiff-city', name: 'Cardiff City' },
      oxf: { id: 695, slug: 'oxford-united', name: 'Oxford United' },
      por: { id: 699, slug: 'portsmouth', name: 'Portsmouth' },
      lei: { id: 673, slug: 'leicester-city', name: 'Leicester City' },
    },
  },
  sau: {
    label: 'Saudi Pro League',
    playersJson: 'src/data/world/playersSau.json',
    outJson: 'src/data/world/playerBiosSau.json',
    idsJson: 'scripts/_fm26_dumps/sau_fm_ids.json',
    dumpDir: 'siosi_sau',
    clubs: {
      hil: { id: 102852, slug: 'al-hilal', name: 'Al-Hilal' },
      nas: { id: 102862, slug: 'al-nassr', name: 'Al-Nassr' },
      itt: { id: 106063, slug: 'al-ittihad', name: 'Al-Ittihad' },
      ahl: { id: 102850, slug: 'al-ahli', name: 'Al-Ahli' },
      qad: { id: 1104149, slug: 'al-qadsiah', name: 'Al-Qadsiah' },
      neo: { id: 2000326380, slug: 'neom-sc', name: 'Neom SC' },
      shb: { id: 1535, slug: 'al-shabab', name: 'Al-Shabab' },
      taa: { id: 7920352, slug: 'al-taawoun', name: 'Al-Taawoun' },
      etf: { id: 135427, slug: 'al-ettifaq', name: 'Al-Ettifaq' },
      fat: { id: 7920359, slug: 'al-fateh', name: 'Al-Fateh' },
      fay: { id: 7920365, slug: 'al-fayha', name: 'Al-Fayha' },
      khj: { id: 7920260, slug: 'al-khaleej', name: 'Al-Khaleej' },
      dam: { id: 7920502, slug: 'damac', name: 'Damac' },
      haz: { id: 7920356, slug: 'al-hazem', name: 'Al-Hazem' },
      kho: { id: 1031631, slug: 'al-kholood', name: 'Al-Kholood' },
      riy: { id: 135423, slug: 'al-riyadh', name: 'Al-Riyadh' },
      okh: { id: 7920489, slug: 'al-okhdood', name: 'Al-Okhdood' },
      njm: { id: 135425, slug: 'al-najmah', name: 'Al-Najmah' },
    },
  },
  tur: {
    label: 'Süper Lig',
    playersJson: 'src/data/world/playersTur.json',
    outJson: 'src/data/world/playerBiosTur.json',
    idsJson: 'scripts/_fm26_dumps/tur_fm_ids.json',
    dumpDir: 'siosi_tur',
    clubs: {
      gal: { id: 1871, slug: 'galatasaray', name: 'Galatasaray' },
      fen: { id: 1870, slug: 'fenerbahce', name: 'Fenerbahçe' },
      trb: { id: 1879, slug: 'trabzonspor', name: 'Trabzonspor' },
      bjk: { id: 1866, slug: 'besiktas', name: 'Beşiktaş' },
      ibs: { id: 130343, slug: 'istanbul-basaksehir', name: 'İstanbul Başakşehir' },
      goz: { id: 130338, slug: 'goztepe', name: 'Göztepe' },
      sms: { id: 1878, slug: 'samsunspor', name: 'Samsunspor' },
      riz: { id: 130366, slug: 'caykur-rizespor', name: 'Çaykur Rizespor' },
      kon: { id: 130344, slug: 'konyaspor', name: 'Konyaspor' },
      aly: { id: 458718, slug: 'alanyaspor', name: 'Alanyaspor' },
      gaz: { id: 130341, slug: 'gaziantep-fk', name: 'Gaziantep FK' },
      ksp: { id: 130360, slug: 'kasimpasa', name: 'Kasımpaşa' },
      gnc: { id: 1873, slug: 'genclerbirligi', name: 'Gençlerbirliği' },
      koc: { id: 1876, slug: 'kocaelispor', name: 'Kocaelispor' },
      aty: { id: 1865, slug: 'antalyaspor', name: 'Antalyaspor' },
      eyu: { id: 130289, slug: 'eyupspor', name: 'Eyüpspor' },
      kay: { id: 1875, slug: 'kayserispor', name: 'Kayserispor' },
      fkg: { id: 458631, slug: 'fatih-karagumruk', name: 'Fatih Karagümrük' },
    },
  },
  sau2: {
    label: 'Saudi First Division',
    playersJson: 'src/data/world/playersSau2.json',
    outJson: 'src/data/world/playerBiosSau2.json',
    idsJson: 'scripts/_fm26_dumps/sau2_fm_ids.json',
    dumpDir: 'siosi_sau2',
    clubs: {
      abh: { id: 7920353, slug: 'abha-club', name: 'Abha' },
      fsy: { id: 7920362, slug: 'al-faisaly-ksa-fc', name: 'Al-Faisaly' },
      dir: { id: 1031614, slug: 'al-diriyah-club', name: 'Al-Diriyah' },
      ula: { id: 1031640, slug: 'al-ula-football-club', name: 'Al-Ula' },
      orb: { id: 7920357, slug: 'al-orobah-football-club', name: 'Al-Orobah' },
      jba: { id: 135426, slug: 'al-jabalain-club', name: 'Al-Jabalain' },
      rae: { id: 135424, slug: 'al-raed-saudi-football-club', name: 'Al-Raed' },
      zlf: { id: 23228258, slug: 'al-zulfi-football-club', name: 'Al-Zulfi' },
      tai: { id: 106780, slug: 'al-tai-football-club', name: 'Al-Tai' },
      whd: { id: 106781, slug: 'al-wehda-football-club', name: 'Al-Wehda' },
      buk: { id: 23469190, slug: 'al-bukiryah-football-club', name: 'Al-Bukiryah' },
      anw: { id: 1030680, slug: 'al-anwar-saudi-sports-club', name: 'Al-Anwar' },
      jed: { id: 23405283, slug: 'jeddah-club', name: 'Jeddah' },
      adl: { id: 7920361, slug: 'al-adalah-football-club', name: 'Al-Adalah' },
      jdl: { id: 23002934, slug: 'al-jandal-sport-club', name: 'Al-Jandal' },
      btn: { id: 7920492, slug: 'al-batin-football-club', name: 'Al-Batin' },
      arb: { id: 7920364, slug: 'al-arabi-saudi-sports-club', name: 'Al-Arabi' },
      jbi: { id: 23002953, slug: 'al-jubail-saudi-club', name: 'Al-Jubail' },
    },
  },
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms))
}

function curlGet(url, dest) {
  const r = spawnSync(
    'curl.exe',
    [
      '-sL',
      '-A',
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      '--max-time',
      '45',
      '-o',
      dest,
      url,
    ],
    { encoding: 'utf8' },
  )
  return r.status === 0 && fs.existsSync(dest) && fs.statSync(dest).size > 5000
}

function decodeEntities(s) {
  return String(s)
    .replace(/&pound;/gi, '£')
    .replace(/&euro;/gi, '€')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
}

function parseMoneyGbp(raw) {
  if (!raw) return null
  const s = decodeEntities(String(raw)).trim().replace(/,/g, '')
  const gbp = s.match(/£\s*([\d.]+)\s*([kmb])?/i)
  if (gbp) {
    const n = Number(gbp[1])
    if (!Number.isFinite(n)) return null
    const u = (gbp[2] ?? '').toLowerCase()
    if (u === 'k') return Math.round(n * 1_000)
    if (u === 'm') return Math.round(n * 1_000_000)
    if (u === 'b') return Math.round(n * 1_000_000_000)
    return Math.round(n)
  }
  // SI sometimes shows € on continental pages — store as GBP-approx (£ ≈ € / 1.17)
  const eur = s.match(/€\s*([\d.]+)\s*([kmb])?/i)
  if (eur) {
    const n = Number(eur[1])
    if (!Number.isFinite(n)) return null
    const u = (eur[2] ?? '').toLowerCase()
    let eurAmt = n
    if (u === 'k') eurAmt = n * 1_000
    else if (u === 'm') eurAmt = n * 1_000_000
    else if (u === 'b') eurAmt = n * 1_000_000_000
    return Math.round(eurAmt / 1.17)
  }
  return null
}

function normalizeDate(raw) {
  if (!raw) return null
  const s = String(raw).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  const dmy = s.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  return s
}

function stripTags(html) {
  return decodeEntities(html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
}

function countStars(cellHtml) {
  const n = (cellHtml.match(/fa-star(?!-)/g) || []).length
  return n || null
}

function normName(n) {
  return n
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function parseTeamHtml(html, clubKey, clubName) {
  const playersIdx = html.search(/Players in FM26/i)
  const loanIdx = html.search(/Loaned Out Players/i)
  const peakedIdx = html.search(/Peaked Players/i)
  let end = html.length
  for (const i of [loanIdx, peakedIdx]) {
    if (i > playersIdx && i < end) end = i
  }
  const block = playersIdx >= 0 ? html.slice(playersIdx, end) : html
  const peakedBlock =
    peakedIdx >= 0 ? html.slice(peakedIdx, Math.min(html.length, peakedIdx + 80_000)) : ''
  const peakedNames = new Set()
  for (const m of peakedBlock.matchAll(/person\/\d+\/[a-z0-9-]+"[^>]*>\s*([^<]+?)\s*<\/a>/gi)) {
    peakedNames.add(decodeEntities(m[1]).replace(/\s+/g, ' ').trim())
  }

  const rows = []
  for (const tr of block.matchAll(/<tr class="border-left-gender-mens"[\s\S]*?<\/tr>/gi)) {
    const row = tr[0]
    const person = row.match(
      /href="https:\/\/sortitoutsi\.net\/football-manager-2026\/person\/(\d+)\/([a-z0-9-]+)"[^>]*>\s*([^<]+?)\s*<\/a>/i,
    )
    if (!person) continue
    const nation = row.match(
      /football-manager-2026\/nation\/\d+\/[a-z0-9-]+"[^>]*>[\s\S]*?<\/a>\s*([^<]+?)\s*<\/a>/i,
    )
    const natAlt = row.match(/uploads\/flags_sm\/[^"]+"\s*\/>\s*([A-Za-z][A-Za-z .&'-]+)\s*<\/a>/i)
    const tds = [...row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((m) => m[1])
    if (tds.length < 8) continue
    const age = Number(stripTags(tds[2])) || null
    const fmPos = stripTags(tds[3]) || null
    const wageWeeklyGbp = parseMoneyGbp(tds[4])
    const moneyCell = decodeEntities(tds[4])
    if (wageWeeklyGbp == null && !/[£€]/.test(moneyCell) && !/&pound;|&euro;/i.test(tds[4])) continue
    const name = decodeEntities(person[3]).replace(/\s+/g, ' ').trim()
    rows.push({
      fmId: person[1],
      name,
      nationality: decodeEntities(natAlt?.[1] || nation?.[1] || '')
        .replace(/\s+/g, ' ')
        .trim() || null,
      age,
      fmPos,
      wageWeeklyGbp,
      valueGbp: parseMoneyGbp(tds[5]),
      estimatedCostGbp: parseMoneyGbp(tds[6]),
      contractExpires: normalizeDate(stripTags(tds[7])) || null,
      starRating: countStars(tds[8] ?? ''),
      peaked: peakedNames.has(name),
      clubKey,
      club: clubName,
      sourceUrl: `https://sortitoutsi.net/football-manager-2026/person/${person[1]}/${person[2]}`,
    })
  }
  return rows
}

async function download(leagueKey) {
  const league = LEAGUES[leagueKey]
  const dump = path.join(DUMP_ROOT, league.dumpDir)
  fs.mkdirSync(dump, { recursive: true })
  let okCount = 0
  for (const [key, meta] of Object.entries(league.clubs)) {
    const dest = path.join(dump, `${key}.html`)
    const url = `https://sortitoutsi.net/football-manager-2026/team/${meta.id}/${meta.slug}`
    const ok = curlGet(url, dest)
    const size = ok ? fs.statSync(dest).size : 0
    const title = ok
      ? fs.readFileSync(dest, 'utf8').match(/<title>([^<]+)/)?.[1]?.slice(0, 55)
      : 'FAIL'
    const good = ok && !/Just a moment|Access denied/i.test(title ?? '')
    if (good) okCount++
    console.log(`[${leagueKey}]`, meta.clubKey ?? key, meta.id, size, title)
    await sleep(350)
  }
  console.log(`[${leagueKey}] download ok`, okCount, '/', Object.keys(league.clubs).length)
}

function dtValue(html, label) {
  const re = new RegExp(
    `<dt[^>]*>\\s*${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*</dt>\\s*<dd[^>]*>([\\s\\S]*?)</dd>`,
    'i',
  )
  const m = html.match(re)
  return m ? stripTags(m[1]) : null
}

function parsePersonHtml(html, fmId, rosterName, slug) {
  if (!html || /Just a moment|Access denied/i.test(html) || html.length < 3000) return null
  const wageWeeklyGbp = parseMoneyGbp(dtValue(html, 'Wage'))
  const valueGbp = parseMoneyGbp(dtValue(html, 'Value'))
  const estimatedCostGbp = parseMoneyGbp(dtValue(html, 'Estimated Cost'))
  const contractExpires = normalizeDate(dtValue(html, 'Contract Expires')) || null
  const contractSigned = normalizeDate(dtValue(html, 'Contract Signed')) || null
  const fmPos = dtValue(html, 'Position') || null
  const ageRaw = dtValue(html, 'Age')
  const age = ageRaw && /^\d+$/.test(ageRaw) ? Number(ageRaw) : null
  const dob = normalizeDate(dtValue(html, 'DOB') || dtValue(html, 'Date of Birth')) || null
  const club =
    html.match(/football-manager-2026\/team\/\d+\/[a-z0-9-]+"[^>]*>\s*([^<]+)/i)?.[1]?.trim() ||
    null
  const nationality =
    html
      .match(/uploads\/flags_sm\/[^"]+"\s*\/>\s*([A-Za-z][A-Za-z .&'-]+)\s*<\/a>/i)?.[1]
      ?.trim() || null
  const peaked = /has peaked and will not improve/i.test(html)
  let developNote = null
  if (peaked) developNote = 'has peaked and will not improve in FM26'
  else if (/unlikely to improve much/i.test(html)) developNote = 'unlikely to improve much in FM26'
  let injuryProne = null
  if (/is not injury prone/i.test(html)) injuryProne = false
  else if (/injury prone/i.test(html)) injuryProne = true
  const caRem = html.match(/CA Remaining[^0-9]*(\d+)/i)
  return {
    fmId: String(fmId),
    name: rosterName,
    nationality,
    age,
    dob,
    fmPos,
    wageWeeklyGbp,
    valueGbp,
    estimatedCostGbp,
    contractExpires,
    contractSigned,
    peaked,
    developNote,
    injuryProne,
    caRemaining: caRem ? Number(caRem[1]) : null,
    club,
    sourceUrl: `https://sortitoutsi.net/football-manager-2026/person/${fmId}/${slug || 'player'}`,
  }
}

function loadKnownBiosByFmId(excludeLeagueKey) {
  const files = [
    'playerBiosEng.json',
    'playerBiosEsp.json',
    'playerBiosGer.json',
    'playerBiosFra.json',
    'playerBiosIta.json',
    'playerBiosEsp2.json',
    'playerBiosGer2.json',
    'playerBiosFra2.json',
    'playerBiosIta2.json',
    'playerBiosEng2.json',
    'playerBiosSau.json',
    'playerBiosTur.json',
    'playerBiosSau2.json',
  ]
  const skip = excludeLeagueKey
    ? `playerBios${excludeLeagueKey[0].toUpperCase()}${excludeLeagueKey.slice(1)}.json`
    : null
  const m = new Map()
  for (const f of files) {
    if (skip && f.toLowerCase() === skip.toLowerCase()) continue
    // normalize: esp2 → playerBiosEsp2.json
    const p = path.join(ROOT, 'src/data/world', f)
    if (!fs.existsSync(p)) continue
    const pack = JSON.parse(fs.readFileSync(p, 'utf8'))
    for (const [name, bio] of Object.entries(pack.byName ?? {})) {
      if (bio?.fmId && !m.has(String(bio.fmId))) m.set(String(bio.fmId), { ...bio, name })
    }
  }
  return m
}

async function resolveLeague(leagueKey, { fetchMissing = false } = {}) {
  const league = LEAGUES[leagueKey]
  const dump = path.join(DUMP_ROOT, league.dumpDir)
  const personDump = path.join(DUMP_ROOT, 'siosi_persons')
  const playersPath = path.join(ROOT, league.playersJson)
  const outPath = path.join(ROOT, league.outJson)
  const idsPath = path.join(ROOT, league.idsJson)
  const pack = JSON.parse(fs.readFileSync(playersPath, 'utf8'))
  const idsPack = fs.existsSync(idsPath) ? JSON.parse(fs.readFileSync(idsPath, 'utf8')) : { byName: {} }
  const engById = loadKnownBiosByFmId(leagueKey)

  const roster = []
  for (const [clubKey, rows] of Object.entries(pack.clubs ?? {})) {
    for (const r of rows) roster.push({ name: r.name, clubKey })
  }

  const byName = {}
  const byFmId = new Map()
  let parsed = 0
  for (const [key, meta] of Object.entries(league.clubs)) {
    const file = path.join(dump, `${key}.html`)
    if (!fs.existsSync(file)) {
      console.warn(`[${leagueKey}] missing`, key)
      continue
    }
    const html = fs.readFileSync(file, 'utf8')
    if (/Just a moment|Access denied/i.test(html) || html.length < 5000) {
      console.warn(`[${leagueKey}] bad page`, key)
      continue
    }
    const rows = parseTeamHtml(html, meta.clubKey ?? key, meta.name)
    parsed += rows.length
    console.log(
      `[${leagueKey}]`,
      meta.clubKey ?? key,
      'rows',
      rows.length,
      rows
        .slice(0, 2)
        .map((r) => `${r.name} £${r.wageWeeklyGbp}`)
        .join(', '),
    )
    for (const r of rows) {
      const prev = byName[r.name] ?? {}
      const bio = {
        ...prev,
        fmId: r.fmId ?? prev.fmId,
        nationality: r.nationality ?? prev.nationality,
        age: r.age ?? prev.age,
        fmPos: r.fmPos ?? prev.fmPos,
        wageWeeklyGbp: r.wageWeeklyGbp ?? prev.wageWeeklyGbp,
        valueGbp: r.valueGbp ?? prev.valueGbp,
        estimatedCostGbp: r.estimatedCostGbp ?? prev.estimatedCostGbp,
        contractExpires: r.contractExpires ?? prev.contractExpires,
        starRating: r.starRating ?? prev.starRating,
        peaked: r.peaked || prev.peaked || false,
        clubKey: r.clubKey,
        club: r.club,
        sourceUrl: r.sourceUrl ?? prev.sourceUrl,
      }
      byName[r.name] = bio
      if (bio.fmId) byFmId.set(String(bio.fmId), bio)
    }
  }

  const byNorm = Object.fromEntries(
    Object.entries(byName).map(([k, v]) => [normName(k), { ...v, _k: k }]),
  )

  const filtered = {}
  let viaName = 0
  let viaNorm = 0
  let viaFmId = 0
  let viaEng = 0
  let viaPerson = 0
  const needPerson = []

  for (const { name } of roster) {
    if (byName[name]) {
      filtered[name] = { ...byName[name], name }
      viaName++
      continue
    }
    const hitN = byNorm[normName(name)]
    if (hitN) {
      const { _k, ...rest } = hitN
      filtered[name] = { ...rest, name }
      viaNorm++
      continue
    }
    const idMeta = idsPack.byName?.[name]
    const fmId = idMeta?.fmId != null ? String(idMeta.fmId) : null
    if (fmId && byFmId.has(fmId)) {
      filtered[name] = { ...byFmId.get(fmId), name, fmId }
      viaFmId++
      continue
    }
    if (fmId && engById.has(fmId)) {
      const eng = engById.get(fmId)
      filtered[name] = { ...eng, name, fmId }
      viaEng++
      continue
    }
    if (fmId && idMeta?.slug) {
      needPerson.push({ name, fmId, slug: idMeta.slug })
    }
  }

  if (fetchMissing && needPerson.length) {
    fs.mkdirSync(personDump, { recursive: true })
    console.log(`[${leagueKey}] fetching ${needPerson.length} person pages…`)
    for (const { name, fmId, slug } of needPerson) {
      const dest = path.join(personDump, `${fmId}.html`)
      if (!fs.existsSync(dest) || fs.statSync(dest).size < 3000) {
        const url = `https://sortitoutsi.net/football-manager-2026/person/${fmId}/${slug}`
        const ok = curlGet(url, dest)
        if (!ok) {
          console.warn(`[${leagueKey}] person fail`, fmId, name)
          continue
        }
        await sleep(280)
      }
      if (!fs.existsSync(dest)) continue
      const bio = parsePersonHtml(fs.readFileSync(dest, 'utf8'), fmId, name, slug)
      if (!bio || (bio.wageWeeklyGbp == null && bio.valueGbp == null)) {
        console.warn(`[${leagueKey}] person parse empty`, fmId, name)
        continue
      }
      filtered[name] = bio
      viaPerson++
    }
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true })
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        source: 'sortitoutsi.net FM26',
        league: leagueKey,
        label: league.label,
        note: 'Personal/local display only — not for redistribution or commercial sale. Matched by name / accent / fmId / person page.',
        byName: filtered,
      },
      null,
      2,
    ) + '\n',
  )

  const matched = Object.keys(filtered).length
  console.log(
    `[${leagueKey}] parsed`,
    parsed,
    'matched',
    matched,
    '/',
    roster.length,
    `(name ${viaName} norm ${viaNorm} fmId ${viaFmId} eng ${viaEng} person ${viaPerson})`,
    'wrote',
    outPath,
  )
  return { matched, total: roster.length }
}

const argv = process.argv.slice(2)
const leagueArg = argv.find((a) => !a.startsWith('--')) ?? ''
const flags = new Set(argv.filter((a) => a.startsWith('--')))
const runAll = flags.has('--all')
const doDownload = runAll || flags.has('--download')
const doResolve = runAll || flags.has('--resolve') || flags.has('--fetch-missing')
const fetchMissing = runAll || flags.has('--fetch-missing')

const TOP = ['esp', 'ger', 'fra', 'ita']
const DIV2 = ['esp2', 'ger2', 'fra2', 'ita2', 'eng2']
const EXTRA = ['sau', 'tur', 'sau2']

const leagueKeys =
  leagueArg === 'all'
    ? TOP
    : leagueArg === 'div2'
      ? DIV2
      : leagueArg === 'extra'
        ? EXTRA
        : LEAGUES[leagueArg]
          ? [leagueArg]
          : []

if (!leagueKeys.length || (!doDownload && !doResolve)) {
  console.log(
    'Usage: node scripts/buildLeagueBios.mjs <esp|ger|fra|ita|esp2|ger2|fra2|ita2|eng2|sau|tur|all|div2|extra> (--download | --resolve | --fetch-missing | --all)',
  )
  process.exit(1)
}

for (const key of leagueKeys) {
  if (doDownload) await download(key)
  if (doResolve) await resolveLeague(key, { fetchMissing })
}
