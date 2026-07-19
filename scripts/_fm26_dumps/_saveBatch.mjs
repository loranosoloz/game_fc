import fs from 'fs'
import path from 'path'

const DIR = path.resolve('scripts/_fm26_dumps/persons')
const INDEX = path.resolve('scripts/_fm26_dumps/person_index.jsonl')
fs.mkdirSync(DIR, { recursive: true })

function buildMd(p) {
  const lines = [
    `ID ${p.id} Name ${p.name} Age ${p.age} DOB ${p.dob} Gender male Nationality ${p.nat} Contracted Club ${p.club}${p.loan ? ` Loan Club ${p.loan}` : ''} Club Contract Type Full-Time Wage ${p.wage} Contract Expires ${p.expires} Contract Signed ${p.signed} Value ${p.value} Estimated Cost ${p.cost}${p.loanExpires ? ` Loan Expires ${p.loanExpires}` : ''} Position ${p.pos} Current Ability`,
    '',
    'change from previous game Potential Ability',
    '',
    `change from previous game CA Remaining ${p.caRem}${p.peaked ? ` ${p.name} has peaked and will not improve in FM26.` : ''}`,
    '',
    `This is a preview of what ${p.name} looks like in FM26.`,
    '',
    '## FAQ',
    '',
    `### How much does ${p.name} cost in Football Manager 26?`,
    `${p.name} is valued at ${p.value} in FM26 but you should expect to pay ${p.cost} if you want to buy him.`,
    '',
    `### How good is ${p.name} in FM 26?`,
    `We rate ${p.name} ${p.stars} / 5 stars in Football Manager 26.`,
    '',
    `### Is ${p.name} likely to improve in FM 2026?`,
    p.improve,
    '',
    `### Does ${p.name} have random potential ability in FM2026?`,
    p.fixed
      ? `No, ${p.name} has fixed potential, this means how much he develops as a footballer will be the same in every new FM26 career you create.`
      : `Yes, ${p.name} has random potential in Football Manager 26.`,
    '',
    `### Is ${p.name} injury prone in FM2026?`,
    p.injury === 'very'
      ? `Yes, ${p.name} is very injury prone in Football Manager 26 and it is likely he will get alot of injuries. Best to avoid signing him.`
      : p.injury
        ? `Yes, ${p.name} is quite injury prone in Football Manager 26. It is likely he will get a few injuries, take this into consideration when thinking about signing him.`
        : `No, ${p.name} is not injury prone in Football Manager 26. It is unlikely he will get more injuries than normal.`,
    '',
    `### What position does ${p.name} play in FM26?`,
    `${p.name} plays as ${p.pos} in Football Manager 26.`,
    '',
    `### What nationality is ${p.name} in FM2026?`,
    `${p.name} is ${p.natAdj} in Football Manager 26.`,
    '',
    `### How old is ${p.name}?`,
    p.ageText,
    '',
    `### How much money does ${p.name} earn at ${p.wageClub || p.club}?`,
    `${p.name} earns ${p.wage} in wages while playing for ${p.wageClub || p.club} in FM26.`,
    '',
    `### When does ${p.name} contract expire in FM26?`,
    `${p.name} has a contract with ${p.club} until ${p.expires}.`,
    '',
    `### Does ${p.name} have a minimum fee release clause in FM26?`,
    p.release
      ? `Yes, ${p.name} has a minimum fee release clause of ${p.release} in Football Manager 26.`
      : `No, ${p.name} does not have a minimum fee release clause in Football Manager 26.`,
  ]
  if (p.loan) {
    lines.push(
      '',
      `### Is ${p.name} on loan in ${p.loan}?`,
      `Yes ${p.name} is on loan to ${p.loan} in Football Manager 26.`,
    )
  }
  return lines.join('\n') + '\n'
}

const players = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'))
let n = 0
for (const p of players) {
  const out = path.join(DIR, `${p.id}.md`)
  if (fs.existsSync(out) && !process.env.FORCE) {
    console.log('skip existing', p.id, p.name)
    continue
  }
  fs.writeFileSync(out, buildMd(p))
  const slug = p.slug
  const url = `https://sortitoutsi.net/football-manager-2026/person/${p.id}/${slug}`
  const index = fs.existsSync(INDEX) ? fs.readFileSync(INDEX, 'utf8') : ''
  if (!index.includes(String(p.id))) {
    fs.appendFileSync(INDEX, JSON.stringify({ name: p.name, fmId: String(p.id), url, slug }) + '\n')
  }
  console.log('saved', p.id, p.name)
  n++
}
console.log('wrote', n)
