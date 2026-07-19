/**
 * Thai League 2 (tha2)
 * Usage: node scripts/buildThai2Pack.mjs --download-clubs | --resolve | --fetch-fminside | --all
 */
import path from 'path'
import { runDiv2Pack } from './lib/fmtuPack.mjs'

const ROOT = path.resolve('.')

await runDiv2Pack({
  clubs: {
    pte: { id: 23402301, name: 'Police Tero', rep: 62 },
    kku: { id: 23295560, name: 'Khon Kaen United', rep: 60 },
    nbp: { id: 23295563, name: 'Nongbua Pitchaya', rep: 61 },
    npu: { id: 5637859, name: 'Nakhon Pathom United', rep: 63 },
    spc: { id: 23485683, name: 'Samut Prakan City', rep: 59 },
    trt: { id: 23177028, name: 'Trat FC', rep: 58 },
    cmu: { id: 97208548, name: 'Chiangmai United', rep: 60 },
    cus: { id: 2000117797, name: 'Customs United', rep: 56 },
    spb: { id: 5637854, name: 'Suphanburi', rep: 61 },
    lam: { id: 23103659, name: 'Lampang FC', rep: 57 },
    phr: { id: 23077993, name: 'Phrae United', rep: 55 },
    cnb: { id: 97208550, name: 'Chainat Hornbill', rep: 58 },
    msh: { id: 23077984, name: 'Mahasarakham', rep: 56 },
    pat: { id: 2000292732, name: 'Pattaya United', rep: 59 },
    ssc: { id: 2000192169, name: 'Samut Sakhon City', rep: 55 },
    sis: { id: 23177022, name: 'Sisaket United', rep: 57 },
  },
  fmtuDir: path.join(ROOT, 'scripts/_fm26_dumps/fmtu_tha2'),
  idsOut: path.join(ROOT, 'scripts/_fm26_dumps/tha2_fm_ids.json'),
  playersOut: path.join(ROOT, 'src/data/world/playersTha2.json'),
  sourceLabel: 'Thai League 2',
  packNote: 'Not for redistribution or commercial sale. Thai League 2 / tha2 pack.',
  tmpTag: 'tha2',
})
