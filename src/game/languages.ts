/**
 * ภาษาโค้ช ↔ นักเตะ
 * ลีกชั้นนำ (Big 5 ดิวิชัน 1): หลายภาษาได้
 * ลีกรอง / ดิวิชัน 2 / ยุโรปไม่ดัง: ภาษาบ้านเกิดอย่างเดียว
 */
import type { Club, GameSave, Player } from './types'
import type { ManagerProfile } from './managerProfile'
import { normalizeNation, playerNationality } from './nationalTeams'

/** ลีกหลักที่นักเตะได้หลายภาษา */
export const TOP_LANG_LEAGUES = new Set(['eng', 'esp', 'ger', 'fra', 'ita'])

/** ภาษาหลักของลีก */
export const LEAGUE_PRIMARY_LANG: Record<string, string> = {
  eng: 'en',
  esp: 'es',
  ger: 'de',
  fra: 'fr',
  ita: 'it',
  tha: 'th',
  jpn: 'ja',
  kor: 'ko',
  bra: 'pt',
  tur: 'tr',
  ned: 'nl',
  prt: 'pt',
  bel: 'fr',
  sco: 'en',
  aut: 'de',
  sui: 'de',
  den: 'da',
  gre: 'el',
}

/** ภาษาหลักของชาติ (รหัสสั้น) */
export const NATION_PRIMARY_LANG: Record<string, string> = {
  England: 'en',
  Scotland: 'en',
  Wales: 'en',
  Ireland: 'en',
  'Northern Ireland': 'en',
  USA: 'en',
  'United States': 'en',
  Australia: 'en',
  Canada: 'en',
  Spain: 'es',
  Mexico: 'es',
  Argentina: 'es',
  Uruguay: 'es',
  Colombia: 'es',
  Chile: 'es',
  Peru: 'es',
  Ecuador: 'es',
  Germany: 'de',
  Austria: 'de',
  Switzerland: 'de',
  France: 'fr',
  Belgium: 'fr',
  Italy: 'it',
  Portugal: 'pt',
  Brazil: 'pt',
  Netherlands: 'nl',
  Japan: 'ja',
  'Korea Republic': 'ko',
  'South Korea': 'ko',
  Thailand: 'th',
  Turkey: 'tr',
  Poland: 'pl',
  Croatia: 'hr',
  Serbia: 'sr',
  Denmark: 'da',
  Sweden: 'sv',
  Norway: 'no',
  Greece: 'el',
  Egypt: 'ar',
  Morocco: 'ar',
  Algeria: 'ar',
  Tunisia: 'ar',
  Senegal: 'fr',
  'Ivory Coast': 'fr',
  Cameroon: 'fr',
  Nigeria: 'en',
  Ghana: 'en',
  Mali: 'fr',
  'Czech Republic': 'cs',
  Czechia: 'cs',
  Slovakia: 'sk',
  Romania: 'ro',
  Hungary: 'hu',
  Ukraine: 'uk',
  Russia: 'ru',
}

export const LANG_LABEL_TH: Record<string, string> = {
  en: 'อังกฤษ',
  es: 'สเปน',
  de: 'เยอรมัน',
  fr: 'ฝรั่งเศส',
  it: 'อิตาลี',
  pt: 'โปรตุเกส',
  nl: 'ดัตช์',
  ja: 'ญี่ปุ่น',
  ko: 'เกาหลี',
  th: 'ไทย',
  tr: 'ตุรกี',
  pl: 'โปแลนด์',
  hr: 'โครเอเชีย',
  sr: 'เซอร์เบีย',
  da: 'เดนมาร์ก',
  sv: 'สวีเดน',
  no: 'นอร์เวย์',
  el: 'กรีก',
  ar: 'อาหรับ',
  cs: 'เช็ก',
  sk: 'สโลวัก',
  ro: 'โรมาเนีย',
  hu: 'ฮังการี',
  uk: 'ยูเครน',
  ru: 'รัสเซีย',
}

/** ชาติที่พูดหลายภาษากลางบ้าน */
const NATION_EXTRA_LANGS: Record<string, string[]> = {
  Belgium: ['nl', 'fr'],
  Switzerland: ['de', 'fr'],
  Canada: ['en', 'fr'],
  Morocco: ['ar', 'fr'],
  Algeria: ['ar', 'fr'],
  Tunisia: ['ar', 'fr'],
}

export function primaryLangForNation(nation: string): string {
  const n = normalizeNation(nation) ?? nation
  return NATION_PRIMARY_LANG[n] ?? NATION_PRIMARY_LANG[nation] ?? 'en'
}

export function langLabelTh(code: string): string {
  return LANG_LABEL_TH[code] ?? code
}

export function formatLanguagesTh(langs: string[]): string {
  return langs.map(langLabelTh).join(' · ')
}

function clubLeagueId(club: Club | undefined, save?: GameSave): string {
  if (!club) return save?.leagueId ?? 'eng'
  if (club.id.startsWith('ucl-') || club.id.startsWith('uel-') || club.id.startsWith('uecl-')) {
    return club.originLeagueId ?? 'misc'
  }
  return club.originLeagueId ?? save?.leagueId ?? 'eng'
}

/** ลีกชั้นนำดิวิชัน 1 — ได้หลายภาษา */
export function isTopLanguageEnvironment(club: Club | undefined, save?: GameSave): boolean {
  if (!club) return false
  if (club.division === 2) return false
  if (club.id.startsWith('ucl-') || club.id.startsWith('uel-') || club.id.startsWith('uecl-')) {
    return false
  }
  const lid = clubLeagueId(club, save)
  return TOP_LANG_LEAGUES.has(lid)
}

/** ภาษาที่ผู้จัดการพูดได้ (จากสัญชาติ + อังกฤษเป็นภาษากลางถ้าไม่ใช่ en) */
export function managerLanguages(profile: ManagerProfile | null | undefined): string[] {
  if (!profile) return ['en']
  if (profile.languages?.length) {
    const out = new Set<string>()
    for (const x of profile.languages) {
      if (x.length <= 3) out.add(x)
      else out.add(primaryLangForNation(x))
    }
    out.add(primaryLangForNation(profile.nation))
    if (![...out].includes('en') && profile.nation !== 'England') out.add('en')
    return [...out]
  }
  const primary = primaryLangForNation(profile.nation)
  return primary === 'en' ? ['en'] : [primary, 'en']
}

/**
 * มอบภาษาให้นักเตะ
 * — ลีกหลัก: แม่ + ภาษาลีก (ถ้าต่างชาติ) + อังกฤษตามระดับ / ชาติหลายภาษา
 * — ลีกรอง: ภาษาบ้านเกิดอย่างเดียว
 */
export function assignPlayerLanguages(player: Player, save?: GameSave): string[] {
  const nat = save
    ? playerNationality(player, save)
    : normalizeNation(player.bio?.nationality ?? null) || 'England'
  const primary = primaryLangForNation(nat)
  const club = save?.clubs.find((c) => c.id === player.clubId)

  if (!isTopLanguageEnvironment(club, save)) {
    return [primary]
  }

  const langs = new Set<string>([primary])
  const extras = NATION_EXTRA_LANGS[normalizeNation(nat) ?? nat]
  if (extras) for (const l of extras) langs.add(l)

  const leagueId = clubLeagueId(club, save)
  const clubLang = LEAGUE_PRIMARY_LANG[leagueId]
  if (clubLang && clubLang !== primary) {
    // ต่างชาติในลีกชั้นนำ — พูดภาษาลีกได้
    langs.add(clubLang)
  }

  const caps = player.ntCaps ?? player.fmInside?.caps ?? 0
  const worldLevel = player.overall >= 72 || player.age >= 24 || caps >= 5
  if (primary !== 'en' && worldLevel) langs.add('en')

  // ดาวใหญ่บางคนพูดได้ 3+ (ภาษากลางยุโรป)
  if (player.overall >= 82 && langs.size < 3 && Math.abs(hashId(player.id)) % 3 === 0) {
    if (!langs.has('es')) langs.add('es')
    else if (!langs.has('fr')) langs.add('fr')
    else if (!langs.has('de')) langs.add('de')
  }

  // primary มาก่อน
  const rest = [...langs].filter((l) => l !== primary)
  return [primary, ...rest]
}

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  return h
}

/** ภาษาของนักเตะ — ใช้ค่าที่เก็บไว้ หรือคำนวณใหม่ */
export function playerLanguages(player: Player, save?: GameSave): string[] {
  if (player.languages?.length) return player.languages
  return assignPlayerLanguages(player, save)
}

export type CommTier = 'native' | 'fluent' | 'basic' | 'poor'

export function communicationTier(
  managerLangs: string[],
  playerLangs: string[],
): { tier: CommTier; score: number; shared: string[] } {
  const shared = managerLangs.filter((l) => playerLangs.includes(l))
  if (shared.length === 0) return { tier: 'poor', score: 0.55, shared: [] }
  if (shared.includes(managerLangs[0]!) && shared.includes(playerLangs[0]!)) {
    return { tier: 'native', score: 1, shared }
  }
  if (shared.includes('en') || shared.length >= 1) {
    return { tier: 'fluent', score: 0.88, shared }
  }
  return { tier: 'basic', score: 0.72, shared }
}

export function commTierLabelTh(tier: CommTier): string {
  if (tier === 'native') return 'สื่อสารคล่อง (ภาษาแม่)'
  if (tier === 'fluent') return 'สื่อสารได้ดี'
  if (tier === 'basic') return 'สื่อสารได้พอใช้'
  return 'สื่อสารยาก — คนละภาษา'
}

/** ตัวคูณผลคุย/จัดการคน (1 = ปกติ) */
export function talkCommMultiplier(save: GameSave, player: Player): number {
  const langs = managerLanguages(save.managerProfile)
  const { score } = communicationTier(langs, playerLanguages(player, save))
  return score
}

export function ensurePlayerLanguages(player: Player, save?: GameSave): Player {
  // คำนวณใหม่ทุกครั้งตามกฎลีก (เซฟเก่าได้อัปเกรด)
  return { ...player, languages: assignPlayerLanguages(player, save) }
}

export function ensureSquadLanguages(save: GameSave): GameSave {
  return {
    ...save,
    players: save.players.map((p) => ensurePlayerLanguages(p, save)),
    managerProfile: save.managerProfile
      ? {
          ...save.managerProfile,
          languages: managerLanguages(save.managerProfile),
        }
      : save.managerProfile,
  }
}
