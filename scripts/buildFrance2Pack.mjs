/**
 * France Ligue 2 (fra2)
 * Usage: node scripts/buildFrance2Pack.mjs --download-clubs | --resolve | --fetch-fminside | --all
 */
import path from 'path'
import { runDiv2Pack } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')

await runDiv2Pack({
  clubs: {
    rei: { id: 2047, name: 'Reims', rep: 68 },
    mtp: { id: 859, name: 'Montpellier', rep: 69 },
    ase: { id: 828, name: 'Saint-Étienne', rep: 70 },
    aca: { id: 400362, name: 'Ajaccio', rep: 62 },
    cae: { id: 877, name: 'Caen', rep: 63 },
    gre: { id: 852, name: 'Grenoble', rep: 61 },
    ami: { id: 831, name: 'Amiens', rep: 62 },
    bas: { id: 876, name: 'Bastia', rep: 63 },
    pau: { id: 2090, name: 'Pau FC', rep: 60 },
    rod: { id: 2048, name: 'Rodez', rep: 59 },
    gui: { id: 840, name: 'Guingamp', rep: 64 },
    dun: { id: 2072, name: 'Dunkerque', rep: 58 },
    anc: { id: 85052735, name: 'Annecy', rep: 58 },
    try: { id: 1971, name: 'Troyes', rep: 64 },
    lvl: { id: 2062, name: 'Laval', rep: 59 },
    qrm: { id: 50034825, name: 'Quevilly', rep: 57 },
    cnc: { id: 3501956, name: 'Concarneau', rep: 56 },
    vac: { id: 888, name: 'Valenciennes', rep: 60 },
  },
  fmtuDir: path.join(ROOT, 'scripts/_fm26_dumps/fmtu_fra2'),
  idsOut: path.join(ROOT, 'scripts/_fm26_dumps/fra2_fm_ids.json'),
  playersOut: path.join(ROOT, 'src/data/world/playersFra2.json'),
  sourceLabel: 'Ligue 2',
  packNote: 'Not for redistribution or commercial sale. Ligue 2 / fra2 pack.',
  tmpTag: 'fra2',
})
