/**
 * Append shortName → key entries to crests.ts from leagueClubConfigs.json
 * Skips shortNames already present.
 */
import fs from 'fs'
import path from 'path'

const ROOT = path.resolve('.')
const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/leagueClubConfigs.json'), 'utf8'))
const crestPath = path.join(ROOT, 'src/lib/crests.ts')
let src = fs.readFileSync(crestPath, 'utf8')

const existing = new Set(
  [...src.matchAll(/^\s+([A-Z0-9]+):\s*'[^']+',/gm)].map((m) => m[1]),
)

const lines = []
for (const [lid, clubs] of Object.entries(cfg)) {
  if (!Array.isArray(clubs)) continue
  lines.push(`  // ${lid}`)
  for (const c of clubs) {
    const sn = String(c.shortName).toUpperCase()
    if (existing.has(sn)) {
      console.log('skip existing shortName', sn, '→ would be', c.key)
      continue
    }
    existing.add(sn)
    lines.push(`  ${sn}: '${c.key}',`)
  }
}

const marker = '  SIS: \'sis\',\n}'
if (!src.includes(marker)) throw new Error('crest marker not found')
src = src.replace(marker, `  SIS: 'sis',\n${lines.join('\n')}\n}`)
fs.writeFileSync(crestPath, src)
console.log('appended crest shortNames')
