import type { LeagueId } from './leaguesCore'

/** ขนาดลีกตามความเป็นจริง */
export function leagueTeamCount(leagueId: LeagueId | string): number {
  if (leagueId === 'tha') return 16
  if (leagueId === 'kor' || leagueId === 'mys') return 12
  if (leagueId === 'sco' || leagueId === 'aut' || leagueId === 'sui' || leagueId === 'den') return 12
  if (leagueId === 'bel') return 16
  if (leagueId === 'gre' || leagueId === 'vie') return 14
  if (leagueId === 'sgp') return 8
  if (
    leagueId === 'ger' ||
    leagueId === 'fra' ||
    leagueId === 'tur' ||
    leagueId === 'ned' ||
    leagueId === 'prt' ||
    leagueId === 'idn' ||
    leagueId === 'sau'
  ) {
    return 18
  }
  // eng/esp/ita/tha default · jpn/bra · jpn2 parent uses 20
  return 20
}

/** จำนวนทีมเลื่อน/ตกชั้นต่อรอบ */
export function promoRelegCount(leagueId: LeagueId | string): number {
  if (
    leagueId === 'ger' ||
    leagueId === 'fra' ||
    leagueId === 'tur' ||
    leagueId === 'ned' ||
    leagueId === 'prt' ||
    leagueId === 'bel' ||
    leagueId === 'kor' ||
    leagueId === 'sco' ||
    leagueId === 'aut' ||
    leagueId === 'sui' ||
    leagueId === 'den' ||
    leagueId === 'gre' ||
    leagueId === 'vie' ||
    leagueId === 'idn' ||
    leagueId === 'mys' ||
    leagueId === 'sgp' ||
    leagueId === 'sau'
  ) {
    return 2
  }
  return 3
}

/** div2 roster size (pack / DIV2_CLUB_NAMES length) — 0 = no div2 scaffold */
export function div2TeamCount(parentLeagueId: LeagueId | string): number {
  if (
    parentLeagueId === 'vie' ||
    parentLeagueId === 'idn' ||
    parentLeagueId === 'mys' ||
    parentLeagueId === 'sgp' ||
    parentLeagueId === 'sau'
  ) {
    return 0
  }
  if (parentLeagueId === 'tha') return 16
  if (parentLeagueId === 'ger' || parentLeagueId === 'fra') return 18
  if (parentLeagueId === 'kor') return 12
  if (parentLeagueId === 'jpn') return 20
  return 20
}

/** จำนวนนัดลีกทั้งฤดูกาล (เหย้า+เยือน) */
export function leagueMatchdays(leagueId: LeagueId | string): number {
  return (leagueTeamCount(leagueId) - 1) * 2
}

/** หน้าต่างวินเทอร์: กลางฤดูกาล ±2 MD */
export function winterWindowRange(leagueId: LeagueId | string): { start: number; end: number } {
  const mid = Math.round(leagueMatchdays(leagueId) / 2)
  return { start: mid - 2, end: mid + 2 }
}

export function isValidLeagueSize(n: number): boolean {
  return n >= 4 && n % 2 === 0
}
