import type { RoleCode } from '@/game/types'

export type LeagueId =
  | 'eng'
  | 'esp'
  | 'ger'
  | 'fra'
  | 'ita'
  | 'tha'
  | 'jpn'
  | 'kor'
  | 'bra'
  | 'tur'
  | 'ned'
  | 'prt'
  | 'bel'
  | 'sco'
  | 'aut'
  | 'sui'
  | 'den'
  | 'gre'
  | 'vie'
  | 'idn'
  | 'mys'
  | 'sgp'
  | 'sau'

export interface StarDef {
  name: string
  role: RoleCode
  ovr: number
  age: number
  /** Seeded as academy youth (not first-team depth) */
  isYouth?: boolean
  /** Age band from FMTU wonderkids: U16 / U18 / U21 / U23 */
  youthGroup?: 'U16' | 'U18' | 'U21' | 'U23'
}

export interface ClubDef {
  key: string
  name: string
  shortName: string
  color: string
  rep: number
  stars: StarDef[]
}

export interface LeagueDef {
  id: LeagueId
  name: string
  nameTh: string
  nation: string
  cupName: string
  clubs: ClubDef[]
}

/** Regional filler names when expanding beyond club stars */
export const NAME_POOLS: Record<LeagueId, { first: string[]; last: string[] }> = {
  eng: {
    first: [
      'James', 'Harry', 'Jack', 'George', 'Charlie', 'Oliver', 'Thomas', 'William', 'Callum', 'Mason',
      'Reece', 'Bukayo', 'Phil', 'Marcus', 'Declan', 'Trent', 'Jordan', 'Kyle', 'Luke', 'Adam',
    ],
    last: [
      'Smith', 'Jones', 'Taylor', 'Brown', 'Wilson', 'Evans', 'Walker', 'Robinson', 'Thompson', 'White',
      'Harris', 'Clarke', 'Wright', 'Mitchell', 'Turner', 'Phillips', 'Campbell', 'Parker', 'Edwards', 'Collins',
    ],
  },
  esp: {
    first: [
      'Carlos', 'Diego', 'Pablo', 'Álvaro', 'Sergio', 'Iker', 'Marc', 'Ferran', 'Pedri', 'Gavi',
      'Dani', 'Jesús', 'Mario', 'Óscar', 'Hugo', 'Alejandro', 'Rodri', 'Mikel', 'Unai', 'Ander',
    ],
    last: [
      'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Ruiz',
      'Díaz', 'Álvarez', 'Romero', 'Torres', 'Navarro', 'Ramos', 'Serrano', 'Molina', 'Delgado', 'Castro',
    ],
  },
  ger: {
    first: [
      'Leon', 'Jonas', 'Felix', 'Niklas', 'Lukas', 'Max', 'Tim', 'Julian', 'Kai', 'Florian',
      'Joshua', 'Serge', 'Jamal', 'Leroy', 'Thomas', 'Manuel', 'Mats', 'Toni', 'Ilkay', 'Emre',
    ],
    last: [
      'Müller', 'Schmidt', 'Schneider', 'Fischer', 'Weber', 'Wagner', 'Becker', 'Hoffmann', 'Schulz', 'Koch',
      'Bauer', 'Richter', 'Klein', 'Wolf', 'Schröder', 'Neumann', 'Schwarz', 'Zimmermann', 'Braun', 'Krüger',
    ],
  },
  fra: {
    first: [
      'Kylian', 'Antoine', 'Ousmane', 'NGolo', 'Paul', 'Hugo', 'Kingsley', 'Aurélien', 'Randal', 'Bradley',
      'Theo', 'William', 'Jules', 'Eduardo', 'Mike', 'Benjamin', 'Adrien', 'Presnel', 'Dayot', 'Youssouf',
    ],
    last: [
      'Martin', 'Bernard', 'Dubois', 'Thomas', 'Robert', 'Richard', 'Petit', 'Durand', 'Leroy', 'Moreau',
      'Simon', 'Laurent', 'Lefebvre', 'Michel', 'Garcia', 'David', 'Bertrand', 'Roux', 'Vincent', 'Fournier',
    ],
  },
  ita: {
    first: [
      'Lorenzo', 'Federico', 'Nicolo', 'Alessandro', 'Gianluigi', 'Ciro', 'Giacomo', 'Sandro', 'Davide', 'Marco',
      'Andrea', 'Matteo', 'Rafael', 'Lautaro', 'Khvicha', 'Nicolò', 'Manuel', 'Giovanni', 'Simone', 'Stefano',
    ],
    last: [
      'Rossi', 'Russo', 'Ferrari', 'Esposito', 'Bianchi', 'Romano', 'Colombo', 'Ricci', 'Marino', 'Greco',
      'Bruno', 'Gallo', 'Conti', 'De Luca', 'Mancini', 'Costa', 'Giordano', 'Rizzo', 'Lombardi', 'Moretti',
    ],
  },
  tha: {
    first: [
      'Chanathip', 'Theerathon', 'Teerasil', 'Kawin', 'Sarach', 'Supachok', 'Suphanat', 'Pokklaw', 'Adisorn', 'Narubadin',
      'Pansa', 'Ekanit', 'Worachit', 'Jaroensak', 'Bordin', 'Sumanya', 'Charyl', 'Philip', 'Tristan', 'Jonathan',
    ],
    last: [
      'Songkrasin', 'Bunmathan', 'Dangda', 'Thamsatchanan', 'Yooyen', 'Sarachat', 'Mueanta', 'Anan', 'Promrak', 'Weerawatnodom',
      'Hemviboon', 'Panya', 'Giorgio', 'Chaiyasan', 'Phala', 'Purimet', 'Chantamu', 'Srisuwan', 'Kaewprom', 'Praisuwan',
    ],
  },
  jpn: {
    first: ['Hiroshi', 'Takumi', 'Yuki', 'Daichi', 'Kento', 'Ritsu', 'Kaoru', 'Wataru', 'Shogo', 'Ao'],
    last: ['Tanaka', 'Suzuki', 'Takahashi', 'Watanabe', 'Ito', 'Yamamoto', 'Nakamura', 'Kobayashi', 'Kato', 'Yoshida'],
  },
  kor: {
    first: ['Min-jae', 'Heung-min', 'Kang-in', 'Jae-sung', 'In-beom', 'Ui-jo', 'Hee-chan', 'Seung-ho', 'Jin-su', 'Sang-ho'],
    last: ['Kim', 'Lee', 'Park', 'Choi', 'Jung', 'Kang', 'Cho', 'Yoon', 'Han', 'Song'],
  },
  bra: {
    first: ['Lucas', 'Gabriel', 'Pedro', 'Bruno', 'Matheus', 'Rafael', 'Thiago', 'André', 'João', 'Gustavo'],
    last: ['Silva', 'Santos', 'Oliveira', 'Souza', 'Lima', 'Costa', 'Almeida', 'Ferreira', 'Rodrigues', 'Nascimento'],
  },
  tur: {
    first: ['Yusuf', 'Emre', 'Cenk', 'Hakan', 'Burak', 'Ozan', 'Kenan', 'Arda', 'Okay', 'Merih'],
    last: ['Yılmaz', 'Demir', 'Şahin', 'Kaya', 'Çelik', 'Öztürk', 'Aydın', 'Arslan', 'Doğan', 'Koç'],
  },
  ned: {
    first: ['Davy', 'Frenkie', 'Memphis', 'Cody', 'Xavi', 'Jurriën', 'Ryan', 'Teun', 'Steven', 'Brian'],
    last: ['de Jong', 'van Dijk', 'de Ligt', 'Blind', 'Klaassen', 'Bergwijn', 'Malen', 'Timber', 'Schouten', 'Veerman'],
  },
  prt: {
    first: ['João', 'Rúben', 'Bruno', 'Diogo', 'Rafael', 'Nuno', 'Pedro', 'Gonçalo', 'Ricardo', 'Francisco'],
    last: ['Silva', 'Santos', 'Ferreira', 'Costa', 'Oliveira', 'Pereira', 'Rodrigues', 'Martins', 'Almeida', 'Carvalho'],
  },
  bel: {
    first: ['Kevin', 'Eden', 'Romelu', 'Youri', 'Axel', 'Amadou', 'Leandro', 'Dodi', 'Charles', 'Lois'],
    last: ['De Bruyne', 'Hazard', 'Lukaku', 'Tielemans', 'Witsel', 'Onana', 'Trossard', 'Lukebakio', 'De Ketelaere', 'Openda'],
  },
  sco: {
    first: ['Andrew', 'John', 'James', 'Scott', 'Callum', 'Ryan', 'Lewis', 'Craig', 'Stuart', 'Greg'],
    last: ['McGregor', 'McGinn', 'Armstrong', 'Robertson', 'McTominay', 'Fraser', 'Dykes', 'Adams', 'Christie', 'McLean'],
  },
  aut: {
    first: ['David', 'Marcel', 'Florian', 'Konrad', 'Xaver', 'Christoph', 'Michael', 'Stefan', 'Marko', 'Andreas'],
    last: ['Alaba', 'Sabitzer', 'Grillitsch', 'Laimer', 'Schlager', 'Baumgartner', 'Gregoritsch', 'Ullmann', 'Arnautovic', 'Hinteregger'],
  },
  sui: {
    first: ['Xherdan', 'Granit', 'Breel', 'Manuel', 'Nico', 'Denis', 'Remo', 'Silvan', 'Ricardo', 'Yann'],
    last: ['Shaqiri', 'Xhaka', 'Embolo', 'Akanji', 'Elvedi', 'Zakaria', 'Freuler', 'Widmer', 'Rodriguez', 'Sommer'],
  },
  den: {
    first: ['Christian', 'Kasper', 'Pierre', 'Andreas', 'Jonas', 'Rasmus', 'Mikkel', 'Thomas', 'Simon', 'Mathias'],
    last: ['Eriksen', 'Schmeichel', 'Højbjerg', 'Christensen', 'Wind', 'Højlund', 'Damsgaard', 'Delaney', 'Kjær', 'Jensen'],
  },
  gre: {
    first: ['Kostas', 'Giorgos', 'Anastasios', 'Vangelis', 'Dimitris', 'Petros', 'Nikos', 'Sokratis', 'Andreas', 'Christos'],
    last: ['Mitroglou', 'Masouras', 'Bakasetas', 'Pavlidis', 'Siopis', 'Mantalos', 'Galanopoulos', 'Papadopoulos', 'Bouchalakis', 'Tzolis'],
  },
  vie: {
    first: ['Minh', 'Duc', 'Hung', 'Tuan', 'Quang', 'Hieu', 'Son', 'Cong', 'Long', 'Nam'],
    last: ['Nguyen', 'Tran', 'Le', 'Pham', 'Hoang', 'Vu', 'Dang', 'Bui', 'Do', 'Ngo'],
  },
  idn: {
    first: ['Egy', 'Witan', 'Marselino', 'Rizky', 'Asnawi', 'Pratama', 'Evan', 'Saddil', 'Irfan', 'Fachruddin'],
    last: ['Maulana', 'Dimas', 'Putra', 'Santoso', 'Wijaya', 'Hidayat', 'Nugroho', 'Saputra', 'Prasetyo', 'Kurniawan'],
  },
  mys: {
    first: ['Safawi', 'Syafiq', 'Arif', 'Faisal', 'Hakim', 'Nazmi', 'Azam', 'Irfan', 'Akhyar', 'Darren'],
    last: ['Rasid', 'Ahmad', 'Ibrahim', 'Rahman', 'Ismail', 'Hassan', 'Yusof', 'Abdullah', 'Chong', 'Corbin'],
  },
  sgp: {
    first: ['Ikhsan', 'Faris', 'Song', 'Shawal', 'Hami', 'Adam', 'Hariss', 'Safuwan', 'Madhu', 'Gabriel'],
    last: ['Fandi', 'Ramli', 'Ui-young', 'Anuar', 'Syahin', 'Swandi', 'Harun', 'Baharudin', 'Mohana', 'Quak'],
  },
  sau: {
    first: ['Salem', 'Abdullah', 'Fahad', 'Saleh', 'Nawaf', 'Sultan', 'Mohammed', 'Ali', 'Yasser', 'Hassan'],
    last: ['Al-Dawsari', 'Al-Shehri', 'Al-Buraikan', 'Al-Faraj', 'Al-Owais', 'Al-Ghannam', 'Al-Amri', 'Al-Qahtani', 'Al-Harbi', 'Al-Najei'],
  },
}

export const WORLD_LEAGUES: LeagueDef[] = [
  {
    id: 'eng',
    name: 'Premier League',
    nameTh: 'พรีเมียร์ลีก อังกฤษ',
    nation: 'England',
    cupName: 'FA Cup',
    // FM26 Premier League (SortItOutSI) — full squads in playersEng.json where available
    clubs: [
      { key: 'mci', name: 'Manchester City', shortName: 'MCI', color: '#6CABDD', rep: 91, stars: [
        { name: 'Erling Haaland', role: 'ST', ovr: 91, age: 24 },
        { name: 'Rodri', role: 'CDM', ovr: 90, age: 29 },
        { name: 'Gianluigi Donnarumma', role: 'GK', ovr: 90, age: 26 },
        { name: 'Phil Foden', role: 'CAM', ovr: 88, age: 25 },
      ]},
      { key: 'liv', name: 'Liverpool', shortName: 'LIV', color: '#C8102E', rep: 91, stars: [
        { name: 'Mohamed Salah', role: 'ST', ovr: 91, age: 33 },
        { name: 'Virgil van Dijk', role: 'CB', ovr: 91, age: 34 },
        { name: 'Alexander Isak', role: 'ST', ovr: 90, age: 25 },
        { name: 'Florian Wirtz', role: 'CAM', ovr: 89, age: 22 },
      ]},
      { key: 'ars', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', rep: 90, stars: [
        { name: 'Bukayo Saka', role: 'RW', ovr: 90, age: 23 },
        { name: 'Declan Rice', role: 'CDM', ovr: 90, age: 26 },
        { name: 'Martin Odegaard', role: 'CAM', ovr: 89, age: 26 },
        { name: 'William Saliba', role: 'CB', ovr: 88, age: 24 },
      ]},
      { key: 'che', name: 'Chelsea', shortName: 'CHE', color: '#034694', rep: 85, stars: [
        { name: 'Cole Palmer', role: 'CAM', ovr: 87, age: 23 },
        { name: 'Reece James', role: 'RB', ovr: 87, age: 25 },
        { name: 'Enzo Fernandez', role: 'CM', ovr: 85, age: 24 },
        { name: 'Moisés Caicedo', role: 'CDM', ovr: 85, age: 23 },
      ]},
      { key: 'mun', name: 'Manchester United', shortName: 'MUN', color: '#DA291C', rep: 84, stars: [
        { name: 'Bruno Fernandes', role: 'CAM', ovr: 87, age: 30 },
        { name: 'Matheus Cunha', role: 'ST', ovr: 85, age: 26 },
        { name: 'Bryan Mbeumo', role: 'RW', ovr: 82, age: 25 },
        { name: 'Matthijs de Ligt', role: 'CB', ovr: 85, age: 25 },
      ]},
      { key: 'new', name: 'Newcastle United', shortName: 'NEW', color: '#241F20', rep: 84, stars: [
        { name: 'Bruno Guimaraes', role: 'CDM', ovr: 85, age: 27 },
        { name: 'Sandro Tonali', role: 'CDM', ovr: 84, age: 25 },
        { name: 'Anthony Gordon', role: 'LW', ovr: 83, age: 24 },
        { name: 'Nick Woltemade', role: 'ST', ovr: 83, age: 23 },
      ]},
      { key: 'tot', name: 'Tottenham Hotspur', shortName: 'TOT', color: '#132257', rep: 83, stars: [
        { name: 'Cristian Romero', role: 'CB', ovr: 85, age: 27 },
        { name: 'Xavi Simons', role: 'CAM', ovr: 85, age: 22 },
        { name: 'Dominic Solanke', role: 'ST', ovr: 84, age: 27 },
        { name: 'James Maddison', role: 'CAM', ovr: 83, age: 28 },
      ]},
      { key: 'avl', name: 'Aston Villa', shortName: 'AVL', color: '#670E36', rep: 82, stars: [
        { name: 'Ollie Watkins', role: 'ST', ovr: 84, age: 29 },
        { name: 'Emiliano Martinez', role: 'GK', ovr: 86, age: 32 },
        { name: 'Morgan Rogers', role: 'CAM', ovr: 82, age: 22 },
        { name: 'Boubacar Kamara', role: 'CDM', ovr: 82, age: 25 },
      ]},
      { key: 'bha', name: 'Brighton & Hove Albion', shortName: 'BHA', color: '#0057B8', rep: 81, stars: [
        { name: 'Kaoru Mitoma', role: 'LW', ovr: 82, age: 28 },
        { name: 'Joao Pedro', role: 'ST', ovr: 80, age: 24 },
        { name: 'Lewis Dunk', role: 'CB', ovr: 79, age: 34 },
      ]},
      { key: 'not', name: 'Nottingham Forest', shortName: 'NFO', color: '#DD0000', rep: 80, stars: [
        { name: 'Morgan Gibbs-White', role: 'CAM', ovr: 81, age: 26 },
        { name: 'Chris Wood', role: 'ST', ovr: 78, age: 34 },
        { name: 'Murillo', role: 'CB', ovr: 79, age: 23 },
      ]},
      { key: 'bou', name: 'AFC Bournemouth', shortName: 'BOU', color: '#DA291C', rep: 79, stars: [
        { name: 'Justin Kluivert', role: 'CAM', ovr: 78, age: 26 },
        { name: 'Evanilson', role: 'ST', ovr: 78, age: 26 },
        { name: 'Dean Huijsen', role: 'CB', ovr: 77, age: 20 },
      ]},
      { key: 'cry', name: 'Crystal Palace', shortName: 'CRY', color: '#1B458F', rep: 79, stars: [
        { name: 'Jean-Philippe Mateta', role: 'ST', ovr: 80, age: 28 },
        { name: 'Adam Wharton', role: 'CM', ovr: 79, age: 21 },
        { name: 'Dean Henderson', role: 'GK', ovr: 78, age: 28 },
      ]},
      { key: 'ful', name: 'Fulham', shortName: 'FUL', color: '#FFFFFF', rep: 79, stars: [
        { name: 'Alex Iwobi', role: 'CM', ovr: 79, age: 29 },
        { name: 'Raul Jimenez', role: 'ST', ovr: 77, age: 34 },
        { name: 'Antonee Robinson', role: 'LB', ovr: 78, age: 28 },
      ]},
      { key: 'bre', name: 'Brentford', shortName: 'BRE', color: '#E30613', rep: 78, stars: [
        { name: 'Thiago', role: 'ST', ovr: 80, age: 24 },
        { name: 'Caoimhin Kelleher', role: 'GK', ovr: 80, age: 26 },
        { name: 'Dango Ouattara', role: 'RW', ovr: 79, age: 23 },
      ]},
      { key: 'eve', name: 'Everton', shortName: 'EVE', color: '#003399', rep: 78, stars: [
        { name: 'Jordan Pickford', role: 'GK', ovr: 85, age: 31 },
        { name: 'Jack Grealish', role: 'CAM', ovr: 84, age: 29 },
        { name: 'Jarrad Branthwaite', role: 'CB', ovr: 82, age: 23 },
      ]},
      { key: 'whu', name: 'West Ham United', shortName: 'WHU', color: '#7A263A', rep: 78, stars: [
        { name: 'Jarrod Bowen', role: 'RW', ovr: 81, age: 29 },
        { name: 'Lucas Paqueta', role: 'CAM', ovr: 80, age: 28 },
        { name: 'Niclas Fullkrug', role: 'ST', ovr: 78, age: 32 },
      ]},
      { key: 'lee', name: 'Leeds United', shortName: 'LEE', color: '#FFCD00', rep: 76, stars: [
        { name: 'Anton Stach', role: 'CDM', ovr: 78, age: 26 },
        { name: 'Joe Rodon', role: 'CB', ovr: 76, age: 28 },
        { name: 'Wilfried Gnonto', role: 'RW', ovr: 75, age: 22 },
      ]},
      { key: 'sun', name: 'Sunderland', shortName: 'SUN', color: '#EB172B', rep: 76, stars: [
        { name: 'Jobe Bellingham', role: 'CM', ovr: 76, age: 20 },
        { name: 'Trai Hume', role: 'RB', ovr: 74, age: 23 },
        { name: 'Wilson Isidor', role: 'ST', ovr: 75, age: 25 },
      ]},
      { key: 'wol', name: 'Wolverhampton Wanderers', shortName: 'WOL', color: '#FDB913', rep: 76, stars: [
        { name: 'Jorgen Strand Larsen', role: 'ST', ovr: 78, age: 25 },
        { name: 'Jose Sa', role: 'GK', ovr: 77, age: 33 },
        { name: 'Joao Gomes', role: 'CDM', ovr: 78, age: 24 },
      ]},
      { key: 'bur', name: 'Burnley', shortName: 'BUR', color: '#6C1D45', rep: 74, stars: [
        { name: 'Josh Brownhill', role: 'CM', ovr: 74, age: 32 },
        { name: 'Lyle Foster', role: 'ST', ovr: 73, age: 25 },
        { name: 'Maxime Esteve', role: 'CB', ovr: 74, age: 23 },
      ]},
    ],
  },
]
