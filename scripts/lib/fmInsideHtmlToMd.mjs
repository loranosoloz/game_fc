/**
 * Shared FMInside HTML → markdown converter (attrs 0–99).
 * Includes Goalkeeping for keepers.
 */
export function decodeEntities(s) {
  return String(s)
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
}

const ATTR_SECTIONS = ['Goalkeeping', 'Technical', 'Mental', 'Physical', 'Set Pieces']

export function htmlToMd(html, fmId) {
  const t = decodeEntities(
    html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''),
  )
  const name =
    t.match(/<h1[^>]*title="([^"]+)"/i)?.[1] ||
    t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]?.replace(/<[^>]+>/g, '').trim() ||
    'Unknown'
  const lines = [`# ${name}`, `players/7-fm-26/${fmId}`]
  const pick = (label) => {
    const re = new RegExp(`${label}<\\/[^>]+>\\s*<[^>]+>([^<]+)`, 'i')
    return t.match(re)?.[1]?.trim() ?? null
  }
  for (const label of [
    'Age',
    'Height',
    'Left foot',
    'Right foot',
    'Position(s)',
    'Caps / Goals',
    'Club',
    'Sell value',
    'Wages',
    'Contract end',
  ]) {
    const v = pick(label)
    if (v) lines.push(`${label} ${v}`)
  }
  for (const sec of ATTR_SECTIONS) {
    const re = new RegExp(`<h3[^>]*>\\s*${sec}\\s*<\\/h3>\\s*<table[\\s\\S]*?<\\/table>`, 'i')
    const block = t.match(re)?.[0] ?? ''
    const rows = [
      ...block.matchAll(
        /<td class="name"><acronym[^>]*>([^<]+)<\/acronym><\/td>\s*<td class="stat[^"]*">(\d{1,3})<\/td>/gi,
      ),
    ]
    // Always emit section if GK-related or has rows (keeps parsers stable)
    if (rows.length === 0 && sec !== 'Goalkeeping') {
      lines.push(`### ${sec}`)
      continue
    }
    if (rows.length === 0) continue
    lines.push(`### ${sec}`)
    for (const row of rows) {
      lines.push(`| ${row[1].trim()} | ${row[2]} |`)
    }
  }
  return lines.join('\n')
}

export { ATTR_SECTIONS }
