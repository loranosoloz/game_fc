import type { LeagueDef } from './leaguesCore'

export const LEAGUES_REST: LeagueDef[] = [
  {
    id: 'esp',
    name: 'La Liga',
    nameTh: 'ลาลีกา สเปน',
    nation: 'Spain',
    cupName: 'Copa del Rey',
    clubs: [
      { key: 'rma', name: 'Real Madrid', shortName: 'RMA', color: '#FFFFFF', rep: 94, stars: [
        { name: 'Vinícius Júnior', role: 'LW', ovr: 90, age: 25 },
        { name: 'Jude Bellingham', role: 'CM', ovr: 89, age: 22 },
        { name: 'Kylian Mbappé', role: 'ST', ovr: 91, age: 26 },
        { name: 'Thibaut Courtois', role: 'GK', ovr: 89, age: 33 },
      ]},
      { key: 'bar', name: 'FC Barcelona', shortName: 'BAR', color: '#A50044', rep: 92, stars: [
        { name: 'Robert Lewandowski', role: 'ST', ovr: 88, age: 36 },
        { name: 'Pedri', role: 'CM', ovr: 86, age: 22 },
        { name: 'Lamine Yamal', role: 'RW', ovr: 84, age: 17 },
        { name: 'Frenkie de Jong', role: 'CM', ovr: 86, age: 28 },
      ]},
      { key: 'atm', name: 'Atlético Madrid', shortName: 'ATM', color: '#CB3524', rep: 86, stars: [
        { name: 'Antoine Griezmann', role: 'SS', ovr: 85, age: 34 },
        { name: 'Julián Álvarez', role: 'ST', ovr: 85, age: 25 },
        { name: 'Jan Oblak', role: 'GK', ovr: 88, age: 32 },
      ]},
      { key: 'ath', name: 'Athletic Club', shortName: 'ATH', color: '#EE2523', rep: 82, stars: [
        { name: 'Nico Williams', role: 'LW', ovr: 84, age: 22 },
        { name: 'Unai Simón', role: 'GK', ovr: 83, age: 28 },
      ]},
      { key: 'vil', name: 'Villarreal', shortName: 'VIL', color: '#FFE014', rep: 81, stars: [
        { name: 'Álex Baena', role: 'CAM', ovr: 82, age: 23 },
        { name: 'Gérard Moreno', role: 'ST', ovr: 81, age: 33 },
      ]},
      { key: 'rso', name: 'Real Sociedad', shortName: 'RSO', color: '#0067B1', rep: 79, stars: [
        { name: 'Mikel Oyarzabal', role: 'ST', ovr: 83, age: 28 },
        { name: 'Takefusa Kubo', role: 'RW', ovr: 82, age: 24 },
      ]},
      { key: 'bet', name: 'Real Betis', shortName: 'BET', color: '#0BB363', rep: 77, stars: [
        { name: 'Isco', role: 'CAM', ovr: 81, age: 33 },
        { name: 'Pablo Fornals', role: 'CM', ovr: 79, age: 29 },
      ]},
      { key: 'sev', name: 'Sevilla', shortName: 'SEV', color: '#D4A017', rep: 76, stars: [
        { name: 'Youssef En-Nesyri', role: 'ST', ovr: 80, age: 28 },
        { name: 'Jesús Navas', role: 'RB', ovr: 76, age: 39 },
      ]},
      { key: 'gir', name: 'Girona', shortName: 'GIR', color: '#CD2534', rep: 75, stars: [
        { name: 'Viktor Tsygankov', role: 'RW', ovr: 81, age: 27 },
        { name: 'Paulo Gazzaniga', role: 'GK', ovr: 78, age: 33 },
      ]},
      { key: 'val', name: 'Valencia', shortName: 'VAL', color: '#EE3524', rep: 74, stars: [
        { name: 'Hugo Duro', role: 'ST', ovr: 78, age: 25 },
        { name: 'José Gayà', role: 'LB', ovr: 78, age: 30 },
      ]},
      { key: 'cel', name: 'Celta Vigo', shortName: 'CEL', color: '#8AC3EE', rep: 71, stars: [
        { name: 'Iago Aspas', role: 'ST', ovr: 82, age: 37 },
        { name: 'Óscar Mingueza', role: 'RB', ovr: 76, age: 26 },
      ]},
      { key: 'osa', name: 'Osasuna', shortName: 'OSA', color: '#D91A21', rep: 70, stars: [
        { name: 'Ante Budimir', role: 'ST', ovr: 78, age: 33 },
        { name: 'Aimar Oroz', role: 'CM', ovr: 76, age: 23 },
      ]},
      { key: 'mal', name: 'Mallorca', shortName: 'MLL', color: '#E20613', rep: 69, stars: [
        { name: 'Vedat Muriqi', role: 'ST', ovr: 78, age: 31 },
        { name: 'Predrag Rajković', role: 'GK', ovr: 77, age: 29 },
      ]},
      { key: 'ray', name: 'Rayo Vallecano', shortName: 'RAY', color: '#E30613', rep: 69, stars: [
        { name: 'Isi Palazón', role: 'RW', ovr: 78, age: 30 },
        { name: 'Álvaro García', role: 'LW', ovr: 77, age: 32 },
      ]},
      { key: 'get', name: 'Getafe', shortName: 'GET', color: '#004FA3', rep: 68, stars: [
        { name: 'Borja Mayoral', role: 'ST', ovr: 77, age: 28 },
        { name: 'Djené', role: 'CB', ovr: 76, age: 33 },
      ]},
      { key: 'esp', name: 'Espanyol', shortName: 'ESP', color: '#1B3A6D', rep: 67, stars: [
        { name: 'Javi Puado', role: 'ST', ovr: 76, age: 27 },
        { name: 'Joan García', role: 'GK', ovr: 75, age: 24 },
      ]},
      { key: 'ala', name: 'Alavés', shortName: 'ALA', color: '#004B9C', rep: 66, stars: [
        { name: 'Kike García', role: 'ST', ovr: 74, age: 35 },
        { name: 'Antonio Sivera', role: 'GK', ovr: 74, age: 28 },
      ]},
      { key: 'elc', name: 'Elche', shortName: 'ELC', color: '#007A3D', rep: 65, stars: [
        { name: 'Matías Dituro', role: 'GK', ovr: 73, age: 37 },
        { name: 'Nicolás Fernández Mercau', role: 'CM', ovr: 72, age: 25 },
      ]},
      { key: 'lvt', name: 'Levante', shortName: 'LEV', color: '#005CA9', rep: 64, stars: [
        { name: 'José Luis Morales', role: 'ST', ovr: 74, age: 37 },
        { name: 'Pablo Campos', role: 'GK', ovr: 72, age: 24 },
      ]},
      { key: 'ovi', name: 'Real Oviedo', shortName: 'OVI', color: '#0055A4', rep: 63, stars: [
        { name: 'Aarón Escandell', role: 'GK', ovr: 72, age: 29 },
        { name: 'Santi Cazorla', role: 'CM', ovr: 74, age: 40 },
      ]},
    ],
  },
  {
    id: 'ger',
    name: 'Bundesliga',
    nameTh: 'บุนเดสลีกา เยอรมัน',
    nation: 'Germany',
    cupName: 'DFB-Pokal',
    clubs: [
      { key: 'bay', name: 'Bayern Munich', shortName: 'BAY', color: '#DC052D', rep: 93, stars: [
        { name: 'Harry Kane', role: 'ST', ovr: 90, age: 31 },
        { name: 'Jamal Musiala', role: 'CAM', ovr: 87, age: 22 },
        { name: 'Manuel Neuer', role: 'GK', ovr: 86, age: 39 },
        { name: 'Joshua Kimmich', role: 'CDM', ovr: 86, age: 30 },
      ]},
      { key: 'bvb', name: 'Borussia Dortmund', shortName: 'BVB', color: '#FDE100', rep: 86, stars: [
        { name: 'Julian Brandt', role: 'CAM', ovr: 83, age: 28 },
        { name: 'Karim Adeyemi', role: 'RW', ovr: 81, age: 23 },
        { name: 'Gregor Kobel', role: 'GK', ovr: 85, age: 27 },
      ]},
      { key: 'b04', name: 'Bayer Leverkusen', shortName: 'B04', color: '#E32221', rep: 85, stars: [
        { name: 'Florian Wirtz', role: 'CAM', ovr: 88, age: 22 },
        { name: 'Granit Xhaka', role: 'CM', ovr: 83, age: 32 },
        { name: 'Victor Boniface', role: 'ST', ovr: 82, age: 24 },
      ]},
      { key: 'rbl', name: 'RB Leipzig', shortName: 'RBL', color: '#DD0741', rep: 84, stars: [
        { name: 'Xavi Simons', role: 'CAM', ovr: 83, age: 22 },
        { name: 'Lois Openda', role: 'ST', ovr: 83, age: 25 },
      ]},
      { key: 'stu', name: 'VfB Stuttgart', shortName: 'VFB', color: '#E32219', rep: 78, stars: [
        { name: 'Deniz Undav', role: 'ST', ovr: 82, age: 28 },
        { name: 'Chris Führich', role: 'LW', ovr: 80, age: 27 },
      ]},
      { key: 'ein', name: 'Eintracht Frankfurt', shortName: 'SGE', color: '#E1000F', rep: 77, stars: [
        { name: 'Hugo Ekitiké', role: 'ST', ovr: 80, age: 23 },
        { name: 'Ansgar Knauff', role: 'RW', ovr: 77, age: 23 },
      ]},
      { key: 'fre', name: 'SC Freiburg', shortName: 'SCF', color: '#000000', rep: 75, stars: [
        { name: 'Vincenzo Grifo', role: 'LW', ovr: 81, age: 32 },
        { name: 'Merlin Röhl', role: 'CM', ovr: 76, age: 22 },
      ]},
      { key: 'wob', name: 'VfL Wolfsburg', shortName: 'WOB', color: '#65B32E', rep: 74, stars: [
        { name: 'Jonas Wind', role: 'ST', ovr: 78, age: 26 },
        { name: 'Maximilian Arnold', role: 'CM', ovr: 79, age: 31 },
      ]},
      { key: 'bmg', name: 'Borussia Mönchengladbach', shortName: 'BMG', color: '#000000', rep: 73, stars: [
        { name: 'Alassane Pléa', role: 'ST', ovr: 79, age: 32 },
        { name: 'Florian Neuhaus', role: 'CM', ovr: 77, age: 28 },
      ]},
      { key: 'uni', name: 'Union Berlin', shortName: 'FCU', color: '#EB1923', rep: 72, stars: [
        { name: 'Kevin Volland', role: 'ST', ovr: 77, age: 32 },
        { name: 'Robin Knoche', role: 'CB', ovr: 76, age: 33 },
      ]},
      { key: 'hof', name: 'TSG Hoffenheim', shortName: 'TSG', color: '#1C63B7', rep: 72, stars: [
        { name: 'Andrej Kramarić', role: 'ST', ovr: 80, age: 34 },
        { name: 'Anton Stach', role: 'CM', ovr: 77, age: 26 },
      ]},
      { key: 'wer', name: 'Werder Bremen', shortName: 'SVW', color: '#1D9053', rep: 71, stars: [
        { name: 'Marvin Ducksch', role: 'ST', ovr: 78, age: 31 },
        { name: 'Romano Schmid', role: 'CAM', ovr: 76, age: 25 },
      ]},
      { key: 'hsv', name: 'Hamburger SV', shortName: 'HSV', color: '#0033A0', rep: 70, stars: [
        { name: 'Robert Glatzel', role: 'ST', ovr: 76, age: 31 },
        { name: 'Ludovit Reis', role: 'CM', ovr: 75, age: 25 },
      ]},
      { key: 'm05', name: 'Mainz 05', shortName: 'M05', color: '#C3141E', rep: 70, stars: [
        { name: 'Jonathan Burkardt', role: 'ST', ovr: 78, age: 24 },
        { name: 'Lee Jae-sung', role: 'CAM', ovr: 77, age: 32 },
      ]},
      { key: 'aug', name: 'FC Augsburg', shortName: 'FCA', color: '#BA3733', rep: 68, stars: [
        { name: 'Ermedin Demirović', role: 'ST', ovr: 78, age: 27 },
        { name: 'Jeffrey Gouweleeuw', role: 'CB', ovr: 76, age: 34 },
      ]},
      { key: 'koe', name: '1. FC Köln', shortName: 'KOE', color: '#ED1C24', rep: 67, stars: [
        { name: 'Davie Selke', role: 'ST', ovr: 75, age: 30 },
        { name: 'Eric Martel', role: 'CDM', ovr: 74, age: 23 },
      ]},
      { key: 'hea', name: 'Heidenheim', shortName: 'FCH', color: '#E30613', rep: 66, stars: [
        { name: 'Tim Kleindienst', role: 'ST', ovr: 77, age: 29 },
        { name: 'Jan-Niklas Beste', role: 'LW', ovr: 76, age: 26 },
      ]},
      { key: 'stp', name: 'FC St. Pauli', shortName: 'STP', color: '#E30613', rep: 64, stars: [
        { name: 'Marcel Hartel', role: 'CAM', ovr: 75, age: 29 },
        { name: 'Jackson Irvine', role: 'CM', ovr: 74, age: 32 },
      ]},
    ],
  },
]
