/**
 * รัน 10 แมตช์ demo — สรุป event kinds (node scripts/matchDemoAudit.ts via vite-node)
 */
import { buildMatchDemo } from '../src/game/matchDemo'

const kinds: Record<string, number> = {}
const perMatch: string[] = []

for (let i = 0; i < 10; i++) {
  const seed = 1000 + i * 777
  const b = buildMatchDemo({ seed })
  for (const e of b.events) {
    kinds[e.kind] = (kinds[e.kind] ?? 0) + 1
  }
  const subs = b.events.filter((e) => e.kind === 'substitution').length
  const subQ = b.events.filter((e) => e.text.includes('ขอเปลี่ยนตัว')).length
  const inj = b.events.filter((e) => /เจ็บ|บาดเจ็บ/.test(e.text)).length
  const tac = b.events.filter((e) => /แก้เกม|ปรับแผน/.test(e.text)).length
  const tackle = b.events.filter((e) => /สไลด์|สกัด|แท็ก|ดักตัด|บังไลน์/.test(e.text)).length
  const foul = b.events.filter((e) => e.kind === 'foul').length
  perMatch.push(
    `seed ${seed}: ${b.events.length} ev · ${b.result.homeGoals}-${b.result.awayGoals} · subs ${subs} (queue ${subQ}) · tac ${tac} · tackle ${tackle} · foul ${foul} · inj ${inj}`,
  )
}

console.log('=== 10 MATCHES ===')
console.log(perMatch.join('\n'))
console.log('\n=== KIND TOTALS ===')
console.log(JSON.stringify(kinds, null, 2))
