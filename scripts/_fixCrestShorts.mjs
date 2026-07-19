import fs from 'fs'

const cfg = JSON.parse(fs.readFileSync('scripts/leagueClubConfigs.json', 'utf8'))
let crest = fs.readFileSync('src/lib/crests.ts', 'utf8')
const existing = new Set([...crest.matchAll(/^\s+([A-Z0-9]+):/gm)].map((m) => m[1]))
const add = []
for (const clubs of Object.values(cfg)) {
  if (!Array.isArray(clubs)) continue
  for (const c of clubs) {
    const sn = String(c.shortName).toUpperCase()
    if (!existing.has(sn)) {
      existing.add(sn)
      add.push(`  ${sn}: '${c.key}',`)
    }
  }
}
console.log('to add', add.length, add.slice(0, 20))
if (add.length) {
  if (!/\n\}\n\nexport function crestKeyForShortName/.test(crest)) {
    throw new Error('crest end marker not found')
  }
  crest = crest.replace(
    /\n\}\n\nexport function crestKeyForShortName/,
    `\n${add.join('\n')}\n}\n\nexport function crestKeyForShortName`,
  )
  fs.writeFileSync('src/lib/crests.ts', crest)
}
