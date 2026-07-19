import type { LeagueDef } from './leaguesCore'

export const LEAGUES_LATIN_THAI: LeagueDef[] = [
  {
    id: 'fra',
    name: 'Ligue 1',
    nameTh: 'ลีกเอิง ฝรั่งเศส',
    nation: 'France',
    cupName: 'Coupe de France',
    clubs: [
      { key: 'psg', name: 'Paris Saint-Germain', shortName: 'PSG', color: '#004170', rep: 91, stars: [
        { name: 'Ousmane Dembélé', role: 'RW', ovr: 86, age: 28 },
        { name: 'Vitinha', role: 'CM', ovr: 85, age: 25 },
        { name: 'Gianluigi Donnarumma', role: 'GK', ovr: 87, age: 26 },
        { name: 'Achraf Hakimi', role: 'RB', ovr: 85, age: 26 },
      ]},
      { key: 'om', name: 'Olympique de Marseille', shortName: 'OM', color: '#2FAEE0', rep: 80, stars: [
        { name: 'Pierre-Emerick Aubameyang', role: 'ST', ovr: 81, age: 36 },
        { name: 'Amine Harit', role: 'CAM', ovr: 78, age: 28 },
      ]},
      { key: 'ol', name: 'Olympique Lyonnais', shortName: 'OL', color: '#DA291C', rep: 78, stars: [
        { name: 'Alexandre Lacazette', role: 'ST', ovr: 80, age: 34 },
        { name: 'Rayan Cherki', role: 'CAM', ovr: 79, age: 21 },
      ]},
      { key: 'asm', name: 'AS Monaco', shortName: 'ASM', color: '#E30613', rep: 81, stars: [
        { name: 'Takumi Minamino', role: 'CAM', ovr: 80, age: 30 },
        { name: 'Folarin Balogun', role: 'ST', ovr: 79, age: 23 },
      ]},
      { key: 'lil', name: 'Lille', shortName: 'LIL', color: '#E01A22', rep: 79, stars: [
        { name: 'Jonathan David', role: 'ST', ovr: 84, age: 25 },
        { name: 'Edon Zhegrova', role: 'RW', ovr: 80, age: 26 },
      ]},
      { key: 'ren', name: 'Stade Rennais', shortName: 'REN', color: '#E30613', rep: 76, stars: [
        { name: 'Arnaud Kalimuendo', role: 'ST', ovr: 78, age: 23 },
        { name: 'Benjamin Bourigeaud', role: 'CM', ovr: 78, age: 31 },
      ]},
      { key: 'nic', name: 'OGC Nice', shortName: 'NIC', color: '#ED1C24', rep: 75, stars: [
        { name: 'Terem Moffi', role: 'ST', ovr: 78, age: 26 },
        { name: 'Youssouf Ndayishimiye', role: 'CDM', ovr: 77, age: 26 },
      ]},
      { key: 'rcl', name: 'RC Lens', shortName: 'RCL', color: '#E30613', rep: 76, stars: [
        { name: 'Elye Wahi', role: 'ST', ovr: 78, age: 22 },
        { name: 'Facundo Medina', role: 'CB', ovr: 78, age: 26 },
      ]},
      { key: 'str', name: 'Strasbourg', shortName: 'RCS', color: '#009FE3', rep: 72, stars: [
        { name: 'Emanuel Emegha', role: 'ST', ovr: 76, age: 22 },
        { name: 'Dilane Bakwa', role: 'RW', ovr: 75, age: 22 },
      ]},
      { key: 'nte', name: 'Nantes', shortName: 'FCN', color: '#FFE100', rep: 70, stars: [
        { name: 'Mostafa Mohamed', role: 'ST', ovr: 76, age: 27 },
        { name: 'Pedro Chirivella', role: 'CM', ovr: 74, age: 28 },
      ]},
      { key: 'tou', name: 'Toulouse', shortName: 'TFC', color: '#6C1D45', rep: 70, stars: [
        { name: 'Thijs Dallinga', role: 'ST', ovr: 76, age: 24 },
        { name: 'Vincent Sierro', role: 'CM', ovr: 74, age: 29 },
      ]},
      { key: 'sbr', name: 'Brest', shortName: 'SB29', color: '#E30613', rep: 73, stars: [
        { name: 'Steve Mounié', role: 'ST', ovr: 76, age: 30 },
        { name: 'Pierre Lees-Melou', role: 'CM', ovr: 77, age: 32 },
      ]},
      { key: 'aux', name: 'Auxerre', shortName: 'AJA', color: '#FFFFFF', rep: 66, stars: [
        { name: 'Lassine Sinayoko', role: 'ST', ovr: 73, age: 25 },
        { name: 'Gauthier Hein', role: 'RW', ovr: 74, age: 28 },
      ]},
      { key: 'ang', name: 'Angers', shortName: 'SCO', color: '#000000', rep: 65, stars: [
        { name: 'Himad Abdelli', role: 'CAM', ovr: 74, age: 25 },
        { name: 'Farid El Melali', role: 'RW', ovr: 73, age: 28 },
      ]},
      { key: 'hac', name: 'Le Havre', shortName: 'HAC', color: '#00A3E0', rep: 66, stars: [
        { name: 'André Ayew', role: 'ST', ovr: 74, age: 35 },
        { name: 'Christopher Operi', role: 'LB', ovr: 73, age: 28 },
      ]},
      { key: 'lor', name: 'Lorient', shortName: 'FCL', color: '#FF6600', rep: 64, stars: [
        { name: 'Eli Junior Kroupi', role: 'ST', ovr: 72, age: 19 },
        { name: 'Laurent Abergel', role: 'CDM', ovr: 73, age: 32 },
      ]},
      { key: 'pfc', name: 'Paris FC', shortName: 'PFC', color: '#0033A0', rep: 68, stars: [
        { name: 'Ilan Kebbal', role: 'CAM', ovr: 74, age: 26 },
        { name: 'Maxime Lopez', role: 'CM', ovr: 74, age: 27 },
      ]},
      { key: 'met', name: 'Metz', shortName: 'FCM', color: '#6C1D45', rep: 63, stars: [
        { name: 'Georges Mikautadze', role: 'ST', ovr: 76, age: 24 },
        { name: 'Kévin N\u2019Doram', role: 'CDM', ovr: 72, age: 29 },
      ]},
    ],
  },
  {
    id: 'ita',
    name: 'Serie A',
    nameTh: 'เซเรียอา อิตาลี',
    nation: 'Italy',
    cupName: 'Coppa Italia',
    clubs: [
      { key: 'int', name: 'Inter Milan', shortName: 'INT', color: '#010E80', rep: 90, stars: [
        { name: 'Lautaro Martínez', role: 'ST', ovr: 88, age: 27 },
        { name: 'Nicolò Barella', role: 'CM', ovr: 86, age: 28 },
        { name: 'Marcus Thuram', role: 'ST', ovr: 84, age: 27 },
        { name: 'Yann Sommer', role: 'GK', ovr: 85, age: 36 },
      ]},
      { key: 'mil', name: 'AC Milan', shortName: 'MIL', color: '#FB090B', rep: 87, stars: [
        { name: 'Rafael Leão', role: 'LW', ovr: 86, age: 25 },
        { name: 'Mike Maignan', role: 'GK', ovr: 87, age: 29 },
        { name: 'Christian Pulisic', role: 'RW', ovr: 83, age: 26 },
      ]},
      { key: 'juv', name: 'Juventus', shortName: 'JUV', color: '#000000', rep: 86, stars: [
        { name: 'Dušan Vlahović', role: 'ST', ovr: 84, age: 25 },
        { name: 'Federico Chiesa', role: 'RW', ovr: 83, age: 27 },
        { name: 'Manuel Locatelli', role: 'CDM', ovr: 82, age: 27 },
      ]},
      { key: 'nap', name: 'Napoli', shortName: 'NAP', color: '#12A0D7', rep: 85, stars: [
        { name: 'Khvicha Kvaratskhelia', role: 'LW', ovr: 86, age: 24 },
        { name: 'Victor Osimhen', role: 'ST', ovr: 87, age: 26 },
        { name: 'Stanislav Lobotka', role: 'CDM', ovr: 84, age: 30 },
      ]},
      { key: 'rom', name: 'AS Roma', shortName: 'ROM', color: '#8E1F2F', rep: 82, stars: [
        { name: 'Paulo Dybala', role: 'SS', ovr: 84, age: 31 },
        { name: 'Lorenzo Pellegrini', role: 'CAM', ovr: 82, age: 28 },
      ]},
      { key: 'laz', name: 'Lazio', shortName: 'LAZ', color: '#87D8F7', rep: 80, stars: [
        { name: 'Mattia Zaccagni', role: 'LW', ovr: 82, age: 29 },
        { name: 'Pedro', role: 'RW', ovr: 78, age: 37 },
      ]},
      { key: 'ata', name: 'Atalanta', shortName: 'ATA', color: '#1E71B8', rep: 83, stars: [
        { name: 'Ademola Lookman', role: 'ST', ovr: 84, age: 27 },
        { name: 'Teun Koopmeiners', role: 'CM', ovr: 83, age: 27 },
      ]},
      { key: 'fio', name: 'Fiorentina', shortName: 'FIO', color: '#482E92', rep: 78, stars: [
        { name: 'Albert Guðmundsson', role: 'CAM', ovr: 80, age: 28 },
        { name: 'Lucas Beltrán', role: 'ST', ovr: 78, age: 24 },
      ]},
      { key: 'bol', name: 'Bologna', shortName: 'BOL', color: '#1A2F5A', rep: 77, stars: [
        { name: 'Riccardo Orsolini', role: 'RW', ovr: 81, age: 28 },
        { name: 'Joshua Zirkzee', role: 'ST', ovr: 80, age: 24 },
      ]},
      { key: 'tor', name: 'Torino', shortName: 'TOR', color: '#8B0000', rep: 74, stars: [
        { name: 'Duván Zapata', role: 'ST', ovr: 79, age: 34 },
        { name: 'Nikola Vlašić', role: 'CAM', ovr: 78, age: 27 },
      ]},
      { key: 'udi', name: 'Udinese', shortName: 'UDI', color: '#000000', rep: 71, stars: [
        { name: 'Lorenzo Lucca', role: 'ST', ovr: 77, age: 24 },
        { name: 'Florian Thauvin', role: 'RW', ovr: 76, age: 32 },
      ]},
      { key: 'gen', name: 'Genoa', shortName: 'GEN', color: '#C8102E', rep: 70, stars: [
        { name: 'Mateo Retegui', role: 'ST', ovr: 79, age: 26 },
        { name: 'Morten Frendrup', role: 'CM', ovr: 77, age: 24 },
      ]},
      { key: 'cag', name: 'Cagliari', shortName: 'CAG', color: '#A71F23', rep: 68, stars: [
        { name: 'Gianluca Gaetano', role: 'CAM', ovr: 75, age: 24 },
        { name: 'Yerry Mina', role: 'CB', ovr: 76, age: 30 },
      ]},
      { key: 'lec', name: 'Lecce', shortName: 'LEC', color: '#FFED00', rep: 67, stars: [
        { name: 'Nikola Krstović', role: 'ST', ovr: 76, age: 25 },
        { name: 'Rémi Oudin', role: 'CAM', ovr: 74, age: 28 },
      ]},
      { key: 'ver', name: 'Hellas Verona', shortName: 'VER', color: '#FFCC00', rep: 66, stars: [
        { name: 'Cyril Ngonge', role: 'RW', ovr: 75, age: 25 },
        { name: 'Darko Lazović', role: 'LW', ovr: 74, age: 34 },
      ]},
      { key: 'par', name: 'Parma', shortName: 'PAR', color: '#FFE100', rep: 68, stars: [
        { name: 'Dennis Man', role: 'RW', ovr: 76, age: 26 },
        { name: 'Ange-Yoan Bonny', role: 'ST', ovr: 74, age: 21 },
      ]},
      { key: 'com', name: 'Como', shortName: 'COM', color: '#003399', rep: 65, stars: [
        { name: 'Patrick Cutrone', role: 'ST', ovr: 74, age: 27 },
        { name: 'Gabriel Strefezza', role: 'RW', ovr: 75, age: 28 },
      ]},
      { key: 'sas', name: 'Sassuolo', shortName: 'SAS', color: '#008C45', rep: 69, stars: [
        { name: 'Andrea Pinamonti', role: 'ST', ovr: 77, age: 26 },
        { name: 'Kristian Thorstvedt', role: 'CM', ovr: 75, age: 26 },
      ]},
      { key: 'pis', name: 'Pisa', shortName: 'PISA', color: '#0033A0', rep: 64, stars: [
        { name: 'Matteo Tramoni', role: 'LW', ovr: 73, age: 25 },
        { name: 'Adrian Šemper', role: 'GK', ovr: 72, age: 27 },
      ]},
      { key: 'cre', name: 'Cremonese', shortName: 'CRE', color: '#8B0000', rep: 63, stars: [
        { name: 'Dennis Johnsen', role: 'LW', ovr: 73, age: 27 },
        { name: 'Michele Castagnetti', role: 'CM', ovr: 72, age: 35 },
      ]},
    ],
  },
  {
    id: 'tha',
    name: 'Thai League 1',
    nameTh: 'ไทยลีก 1',
    nation: 'Thailand',
    cupName: 'FA Cup Thailand',
    clubs: [
      { key: 'bru', name: 'Buriram United', shortName: 'BRU', color: '#0033A0', rep: 82, stars: [
        { name: 'Supachai Chaided', role: 'ST', ovr: 76, age: 26 },
        { name: 'Theerathon Bunmathan', role: 'LB', ovr: 75, age: 35 },
      ]},
      { key: 'ptc', name: 'Port FC', shortName: 'PTC', color: '#0033A0', rep: 79, stars: [
        { name: 'Bordin Phala', role: 'LW', ovr: 73, age: 30 },
        { name: 'Worachit Kanitsribampen', role: 'CAM', ovr: 74, age: 28 },
      ]},
      { key: 'rcb', name: 'Ratchaburi FC', shortName: 'RBF', color: '#FFFFFF', rep: 78, stars: [
        { name: 'Jakkapan Praisuwan', role: 'CB', ovr: 71, age: 31 },
        { name: 'Njiva Rakotoharimalala', role: 'ST', ovr: 72, age: 32 },
      ]},
      { key: 'bgp', name: 'BG Pathum United', shortName: 'BGP', color: '#78BE20', rep: 76, stars: [
        { name: 'Chanathip Songkrasin', role: 'CAM', ovr: 78, age: 31 },
        { name: 'Teerasil Dangda', role: 'ST', ovr: 74, age: 36 },
      ]},
      { key: 'bku', name: 'Bangkok United', shortName: 'BKU', color: '#FF6600', rep: 77, stars: [
        { name: 'Pokklaw Anan', role: 'CM', ovr: 73, age: 34 },
        { name: 'Everton', role: 'ST', ovr: 75, age: 32 },
      ]},
      { key: 'prc', name: 'PT Prachuap', shortName: 'PRC', color: '#E30613', rep: 71, stars: [
        { name: 'Samuel Abass', role: 'ST', ovr: 70, age: 28 },
        { name: 'Saharat Kaewsangsai', role: 'CM', ovr: 68, age: 29 },
      ]},
      { key: 'chi', name: 'Chiangrai United', shortName: 'CRU', color: '#FF6600', rep: 69, stars: [
        { name: 'Sivakorn Tiatrakul', role: 'CAM', ovr: 72, age: 31 },
        { name: 'Chotipat Poomkeaw', role: 'RW', ovr: 70, age: 27 },
      ]},
      { key: 'chu', name: 'Chonburi FC', shortName: 'CHO', color: '#0033A0', rep: 70, stars: [
        { name: 'Songchai Thongcham', role: 'CB', ovr: 66, age: 24 },
        { name: 'Kuroteda', role: 'CM', ovr: 68, age: 28 },
      ]},
      { key: 'ryg', name: 'Rayong FC', shortName: 'RYG', color: '#0033A0', rep: 64, stars: [
        { name: 'Yashir Pinto', role: 'ST', ovr: 68, age: 34 },
        { name: 'Wasusiwakit Phosririt', role: 'CM', ovr: 65, age: 32 },
      ]},
      { key: 'aya', name: 'Ayutthaya United', shortName: 'AYU', color: '#8B0000', rep: 65, stars: [
        { name: 'Nantawat Suankaew', role: 'ST', ovr: 63, age: 26 },
        { name: 'Wattana Playnum', role: 'CDM', ovr: 64, age: 31 },
      ]},
      { key: 'utt', name: 'Uthai Thani FC', shortName: 'UTF', color: '#FF6600', rep: 71, stars: [
        { name: 'Ricardo Santos', role: 'ST', ovr: 70, age: 34 },
        { name: 'Sumanya Purisai', role: 'CAM', ovr: 71, age: 38 },
      ]},
      { key: 'lmp', name: 'Lamphun Warriors', shortName: 'LPW', color: '#006633', rep: 67, stars: [
        { name: 'Akarawin Sawasdee', role: 'ST', ovr: 70, age: 34 },
        { name: 'Mohammed Osman', role: 'CAM', ovr: 71, age: 31 },
      ]},
      { key: 'suk', name: 'Sukhothai FC', shortName: 'SKT', color: '#0033A0', rep: 62, stars: [
        { name: 'John Baggio', role: 'CAM', ovr: 69, age: 33 },
        { name: 'Piyapat Panhiran', role: 'CM', ovr: 66, age: 28 },
      ]},
      { key: 'mtn', name: 'Muangthong United', shortName: 'MTU', color: '#E30613', rep: 72, stars: [
        { name: 'Poramet Arjviriyakul', role: 'ST', ovr: 71, age: 26 },
        { name: 'Willen', role: 'ST', ovr: 73, age: 32 },
      ]},
      { key: 'nks', name: 'Nakhon Ratchasima', shortName: 'NRA', color: '#F5A623', rep: 64, stars: [
        { name: 'Dennis Murillo', role: 'ST', ovr: 68, age: 31 },
        { name: 'Amadou Ouattara', role: 'CM', ovr: 66, age: 30 },
      ]},
      { key: 'kpw', name: 'Kanchanaburi Power', shortName: 'KPW', color: '#008C45', rep: 72, stars: [
        { name: 'Chenrop Samphaodi', role: 'ST', ovr: 67, age: 29 },
        { name: 'Suriya Singmui', role: 'LB', ovr: 66, age: 30 },
      ]},
    ],
  },
]
