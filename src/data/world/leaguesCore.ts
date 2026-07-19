import type { RoleCode } from '@/game/types'

export type LeagueId = 'eng' | 'esp' | 'ger' | 'fra' | 'ita' | 'tha'

export interface StarDef {
  name: string
  role: RoleCode
  ovr: number
  age: number
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
}

export const WORLD_LEAGUES: LeagueDef[] = [
  {
    id: 'eng',
    name: 'Premier League',
    nameTh: 'พรีเมียร์ลีก อังกฤษ',
    nation: 'England',
    cupName: 'FA Cup',
    clubs: [
      { key: 'mci', name: 'Manchester City', shortName: 'MCI', color: '#6CABDD', rep: 92, stars: [
        { name: 'Erling Haaland', role: 'ST', ovr: 91, age: 24 },
        { name: 'Kevin De Bruyne', role: 'CAM', ovr: 89, age: 33 },
        { name: 'Rodri', role: 'CDM', ovr: 90, age: 28 },
        { name: 'Phil Foden', role: 'LW', ovr: 86, age: 24 },
      ]},
      { key: 'ars', name: 'Arsenal', shortName: 'ARS', color: '#EF0107', rep: 90, stars: [
        { name: 'Bukayo Saka', role: 'RW', ovr: 87, age: 23 },
        { name: 'Martin Ødegaard', role: 'CAM', ovr: 87, age: 26 },
        { name: 'William Saliba', role: 'CB', ovr: 86, age: 24 },
        { name: 'Declan Rice', role: 'CDM', ovr: 86, age: 26 },
      ]},
      { key: 'liv', name: 'Liverpool', shortName: 'LIV', color: '#C8102E', rep: 90, stars: [
        { name: 'Mohamed Salah', role: 'RW', ovr: 89, age: 32 },
        { name: 'Virgil van Dijk', role: 'CB', ovr: 88, age: 33 },
        { name: 'Alexis Mac Allister', role: 'CM', ovr: 84, age: 26 },
        { name: 'Alisson', role: 'GK', ovr: 88, age: 32 },
      ]},
      { key: 'che', name: 'Chelsea', shortName: 'CHE', color: '#034694', rep: 84, stars: [
        { name: 'Cole Palmer', role: 'CAM', ovr: 85, age: 23 },
        { name: 'Enzo Fernández', role: 'CM', ovr: 82, age: 24 },
        { name: 'Reece James', role: 'RB', ovr: 83, age: 25 },
      ]},
      { key: 'tot', name: 'Tottenham Hotspur', shortName: 'TOT', color: '#132257', rep: 82, stars: [
        { name: 'Son Heung-min', role: 'LW', ovr: 86, age: 32 },
        { name: 'James Maddison', role: 'CAM', ovr: 83, age: 28 },
        { name: 'Cristian Romero', role: 'CB', ovr: 84, age: 27 },
      ]},
      { key: 'mun', name: 'Manchester United', shortName: 'MUN', color: '#DA291C', rep: 83, stars: [
        { name: 'Bruno Fernandes', role: 'CAM', ovr: 86, age: 30 },
        { name: 'Kobbie Mainoo', role: 'CM', ovr: 78, age: 19 },
        { name: 'André Onana', role: 'GK', ovr: 82, age: 29 },
      ]},
      { key: 'new', name: 'Newcastle United', shortName: 'NEW', color: '#241F20', rep: 80, stars: [
        { name: 'Alexander Isak', role: 'ST', ovr: 85, age: 25 },
        { name: 'Bruno Guimarães', role: 'CDM', ovr: 84, age: 27 },
      ]},
      { key: 'ast', name: 'Aston Villa', shortName: 'AVL', color: '#670E36', rep: 79, stars: [
        { name: 'Ollie Watkins', role: 'ST', ovr: 84, age: 29 },
        { name: 'Emiliano Martínez', role: 'GK', ovr: 86, age: 32 },
      ]},
      { key: 'whu', name: 'West Ham United', shortName: 'WHU', color: '#7A263A', rep: 74, stars: [
        { name: 'Jarrod Bowen', role: 'RW', ovr: 82, age: 28 },
        { name: 'Lucas Paquetá', role: 'CAM', ovr: 82, age: 27 },
      ]},
      { key: 'bha', name: 'Brighton & Hove Albion', shortName: 'BHA', color: '#0057B8', rep: 76, stars: [
        { name: 'Kaoru Mitoma', role: 'LW', ovr: 82, age: 27 },
        { name: 'Lewis Dunk', role: 'CB', ovr: 80, age: 33 },
      ]},
      { key: 'ful', name: 'Fulham', shortName: 'FUL', color: '#FFFFFF', rep: 72, stars: [
        { name: 'Alex Iwobi', role: 'CM', ovr: 79, age: 28 },
        { name: 'Raúl Jiménez', role: 'ST', ovr: 78, age: 33 },
      ]},
      { key: 'cry', name: 'Crystal Palace', shortName: 'CRY', color: '#1B458F', rep: 71, stars: [
        { name: 'Eberechi Eze', role: 'CAM', ovr: 82, age: 26 },
        { name: 'Marc Guéhi', role: 'CB', ovr: 80, age: 24 },
      ]},
      { key: 'wol', name: 'Wolverhampton Wanderers', shortName: 'WOL', color: '#FDB913', rep: 70, stars: [
        { name: 'Matheus Cunha', role: 'ST', ovr: 80, age: 25 },
        { name: 'José Sá', role: 'GK', ovr: 78, age: 32 },
      ]},
      { key: 'eve', name: 'Everton', shortName: 'EVE', color: '#003399', rep: 69, stars: [
        { name: 'Jordan Pickford', role: 'GK', ovr: 82, age: 31 },
        { name: 'Dominic Calvert-Lewin', role: 'ST', ovr: 77, age: 28 },
      ]},
      { key: 'bou', name: 'AFC Bournemouth', shortName: 'BOU', color: '#DA291C', rep: 68, stars: [
        { name: 'Dominic Solanke', role: 'ST', ovr: 79, age: 27 },
        { name: 'Antoine Semenyo', role: 'RW', ovr: 77, age: 25 },
      ]},
      { key: 'bre', name: 'Brentford', shortName: 'BRE', color: '#E30613', rep: 70, stars: [
        { name: 'Ivan Toney', role: 'ST', ovr: 81, age: 29 },
        { name: 'Bryan Mbeumo', role: 'RW', ovr: 80, age: 25 },
      ]},
      { key: 'not', name: 'Nottingham Forest', shortName: 'NFO', color: '#DD0000', rep: 69, stars: [
        { name: 'Morgan Gibbs-White', role: 'CAM', ovr: 80, age: 25 },
        { name: 'Chris Wood', role: 'ST', ovr: 78, age: 33 },
      ]},
      { key: 'lee', name: 'Leicester City', shortName: 'LEI', color: '#003090', rep: 67, stars: [
        { name: 'Jamie Vardy', role: 'ST', ovr: 78, age: 38 },
        { name: 'Wilfred Ndidi', role: 'CDM', ovr: 79, age: 28 },
      ]},
      { key: 'sou', name: 'Southampton', shortName: 'SOU', color: '#ED1A3B', rep: 64, stars: [
        { name: 'Adam Armstrong', role: 'ST', ovr: 75, age: 28 },
        { name: 'Flynn Downes', role: 'CM', ovr: 74, age: 26 },
      ]},
      { key: 'ips', name: 'Ipswich Town', shortName: 'IPS', color: '#0033A0', rep: 62, stars: [
        { name: 'Leif Davis', role: 'LB', ovr: 75, age: 25 },
        { name: 'Sammie Szmodics', role: 'CAM', ovr: 74, age: 29 },
      ]},
    ],
  },
]
