/**
 * Italy Serie B (ita2)
 * Usage: node scripts/buildItaly2Pack.mjs --download-clubs | --resolve | --fetch-fminside | --all
 */
import path from 'path'
import { runDiv2Pack } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')

await runDiv2Pack({
  clubs: {
    pal: { id: 2194, name: 'Palermo', rep: 68 },
    caz: { id: 1119, name: 'Catanzaro', rep: 62 },
    cos: { id: 1124, name: 'Cosenza', rep: 60 },
    mod: { id: 1147, name: 'Modena', rep: 63 },
    mnz: { id: 1149, name: 'Monza', rep: 69 },
    asc: { id: 1105, name: 'Ascoli', rep: 61 },
    ctd: { id: 2195, name: 'Cittadella', rep: 62 },
    bsa: { id: 1113, name: 'Brescia', rep: 64 },
    rgn: { id: 1164, name: 'Reggiana', rep: 60 },
    sam: { id: 1167, name: 'Sampdoria', rep: 70 },
    spe: { id: 1173, name: 'Spezia', rep: 66 },
    bri: { id: 1110, name: 'Bari', rep: 65 },
    ubs: { id: 43058693, name: 'Union Brescia', rep: 58 },
    sud: { id: 829172, name: 'Südtirol', rep: 61 },
    trn: { id: 2227, name: 'Ternana', rep: 59 },
    lco: { id: 2205, name: 'Lecco', rep: 57 },
    emp: { id: 1126, name: 'Empoli', rep: 67 },
    ven: { id: 1179, name: 'Venezia', rep: 68 },
    ces: { id: 1120, name: 'Cesena', rep: 63 },
    sal: { id: 1166, name: 'Salernitana', rep: 66 },
  },
  fmtuDir: path.join(ROOT, 'scripts/_fm26_dumps/fmtu_ita2'),
  idsOut: path.join(ROOT, 'scripts/_fm26_dumps/ita2_fm_ids.json'),
  playersOut: path.join(ROOT, 'src/data/world/playersIta2.json'),
  sourceLabel: 'Serie B',
  packNote: 'Not for redistribution or commercial sale. Serie B / ita2 pack. ubs = Union Brescia (ex-Feralpisalò).',
  tmpTag: 'ita2',
})
