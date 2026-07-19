/**
 * Germany 2. Bundesliga (ger2)
 * Usage: node scripts/buildGermany2Pack.mjs --download-clubs | --resolve | --fetch-fminside | --all
 */
import path from 'path'
import { runDiv2Pack } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')

await runDiv2Pack({
  clubs: {
    h96: { id: 927, name: 'Hannover 96', rep: 68 },
    s04: { id: 920, name: 'Schalke 04', rep: 72 },
    kie: { id: 2245, name: 'Holstein Kiel', rep: 66 },
    fck: { id: 945, name: 'Kaiserslautern', rep: 65 },
    nur: { id: 899, name: 'Nürnberg', rep: 64 },
    sgf: { id: 2253, name: 'Greuther Fürth', rep: 62 },
    mdg: { id: 2233, name: 'Magdeburg', rep: 61 },
    boc: { id: 905, name: 'VfL Bochum', rep: 67 },
    scp: { id: 121198, name: 'Paderborn', rep: 63 },
    ksc: { id: 931, name: 'Karlsruhe', rep: 63 },
    elv: { id: 121200, name: 'Elversberg', rep: 60 },
    hbs: { id: 2247, name: 'Hertha BSC', rep: 70 },
    f95: { id: 921, name: 'Düsseldorf', rep: 66 },
    ebs: { id: 2237, name: 'Braunschweig', rep: 59 },
    wie: { id: 121208, name: 'Wiesbaden', rep: 58 },
    hro: { id: 928, name: 'Rostock', rep: 60 },
    svd: { id: 108997, name: 'Darmstadt', rep: 65 },
    prm: { id: 935, name: 'Münster', rep: 58 },
  },
  fmtuDir: path.join(ROOT, 'scripts/_fm26_dumps/fmtu_ger2'),
  idsOut: path.join(ROOT, 'scripts/_fm26_dumps/ger2_fm_ids.json'),
  playersOut: path.join(ROOT, 'src/data/world/playersGer2.json'),
  sourceLabel: '2. Bundesliga',
  packNote: 'Not for redistribution or commercial sale. 2. Bundesliga / ger2 pack.',
  tmpTag: 'ger2',
})
