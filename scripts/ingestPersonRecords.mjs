/**
 * Convert person_records.json → persons/{id}.md + merge into playerBiosEng via buildPlayerBios
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const REC = path.join(ROOT, 'scripts/_fm26_dumps/person_records.json')
const DIR = path.join(ROOT, 'scripts/_fm26_dumps/persons')
fs.mkdirSync(DIR, { recursive: true })

const records = JSON.parse(fs.readFileSync(REC, 'utf8'))

function toMd(r) {
  const peakedLine = r.peaked ? `${r.name} has peaked and will not improve in FM26.` : ''
  const val = r.value ?? ''
  const cost = r.cost ?? ''
  const stars = r.stars ?? 4
  const fixed = r.fixedPotential
    ? `No, ${r.name} has fixed potential, this means how much he develops as a footballer will be the same in every new FM26 career you create.`
    : `Yes, ${r.name} has random potential in Football Manager 26.`
  const injury = r.injuryProne
    ? `Yes, ${r.name} is quite injury prone in Football Manager 26. It is likely he will get a few injuries, take this into consideration when thinking about signing him.`
    : `No, ${r.name} is not injury prone in Football Manager 26. It is unlikely he will get more injuries than normal.`
  const release =
    r.releaseClause == null
      ? `No, ${r.name} does not have a minimum fee release clause in Football Manager 26.`
      : `${r.name} has a minimum fee release clause of ${r.releaseClause}.`
  const develop =
    r.developNote?.includes('peaked')
      ? peakedLine
      : r.developNote
        ? `Even with good training and match time, ${r.name} is unlikely to improve much in Football Manager 26.`
        : ''

  return `ID ${r.fmId} Name ${r.name} Age ${r.age} DOB ${r.dob} Gender ${r.gender} Nationality ${r.nationality} Contracted Club ${r.club} Club Contract Type ${r.contractType} Wage ${r.wage} Contract Expires ${r.expires} Contract Signed ${r.signed} Value ${val} Estimated Cost ${cost} Position ${r.pos} Current Ability

change from previous game Potential Ability

change from previous game CA Remaining ${r.caRemaining ?? 0} ${peakedLine}

## FAQ

### How good is ${r.name} in FM 26?
We rate ${r.name} ${stars} / 5 stars in Football Manager 26.

### Is ${r.name} likely to improve in FM 2026?
${develop}

### Does ${r.name} have random potential ability in FM2026?
${fixed}

### Is ${r.name} injury prone in FM2026?
${injury}

### Does ${r.name} have a minimum fee release clause in FM26?
${release}
`
}

let n = 0
for (const r of records) {
  fs.writeFileSync(path.join(DIR, `${r.fmId}.md`), toMd(r))
  n++
}
console.log('wrote person md', n)
