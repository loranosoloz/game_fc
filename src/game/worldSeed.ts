import type { Club, Player, RoleCode, SquadRole } from '@/game/types'
import { roleGroup } from '@/game/positions'
import {
  caFromOverall,
  makeAttrs,
  makeHidden,
  makePa,
  overallFromCa,
  pickPersonality,
} from '@/game/attributes'
import { getLeague, type LeagueId, type ClubDef, DIV2_CLUB_NAMES } from '@/data/world'
import { REAL_NAME_BANKS } from '@/data/world/realNameBanks'
import { REAL_NAME_OVERFLOW } from '@/data/world/realNameOverflow'
import { createBodyMap } from '@/game/bodyMap'
import { rollPlayerSkills } from '@/game/playerSkills'
import { createClubSocial, createPlayerSocial } from '@/game/social'
import { createClubFans } from '@/game/fans'
import { engRosterForClub, engYouthForClub } from '@/data/world/engPlayers'
import { eng2RosterForClub } from '@/data/world/eng2Players'
import { espRosterForClub, espYouthForClub } from '@/data/world/espPlayers'
import { esp2RosterForClub } from '@/data/world/esp2Players'
import { gerRosterForClub, gerYouthForClub } from '@/data/world/gerPlayers'
import { ger2RosterForClub } from '@/data/world/ger2Players'
import { fraRosterForClub, fraYouthForClub } from '@/data/world/fraPlayers'
import { fra2RosterForClub } from '@/data/world/fra2Players'
import { itaRosterForClub, itaYouthForClub } from '@/data/world/itaPlayers'
import { ita2RosterForClub } from '@/data/world/ita2Players'
import { thaRosterForClub } from '@/data/world/thaPlayers'
import { tha2RosterForClub } from '@/data/world/tha2Players'
import { jpnRosterForClub } from '@/data/world/jpnPlayers'
import { jpn2RosterForClub } from '@/data/world/jpn2Players'
import { korRosterForClub } from '@/data/world/korPlayers'
import { kor2RosterForClub } from '@/data/world/kor2Players'
import { braRosterForClub } from '@/data/world/braPlayers'
import { turRosterForClub } from '@/data/world/turPlayers'
import { nedRosterForClub } from '@/data/world/nedPlayers'
import { prtRosterForClub } from '@/data/world/prtPlayers'
import { belRosterForClub } from '@/data/world/belPlayers'
import { scoRosterForClub } from '@/data/world/scoPlayers'
import { autRosterForClub } from '@/data/world/autPlayers'
import { suiRosterForClub } from '@/data/world/suiPlayers'
import { denRosterForClub } from '@/data/world/denPlayers'
import { greRosterForClub } from '@/data/world/grePlayers'
import { vieRosterForClub } from '@/data/world/viePlayers'
import { idnRosterForClub } from '@/data/world/idnPlayers'
import { mysRosterForClub } from '@/data/world/mysPlayers'
import { sgpRosterForClub } from '@/data/world/sgpPlayers'
import { sauRosterForClub } from '@/data/world/sauPlayers'
import { bioForPlayerName } from '@/data/world/playerBios'
import {
  contractEndSeasonFromDate,
  yearsLeftFromExpires,
} from '@/game/playerBio'
import { fmInsideForPlayerName } from '@/data/world/fmInsidePlayers'
import { playerAttrsFromFmInside } from '@/game/fmInside'

/** All real names across leagues + overflow (deduped) for fill when regional bank is empty. */
const GLOBAL_REAL_NAMES: string[] = [
  ...new Set([...Object.values(REAL_NAME_BANKS).flat(), ...REAL_NAME_OVERFLOW]),
]

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function clamp(n: number, min = 1, max = 20) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

type Slot = { role: RoleCode; count: number; ovr: number }

function squadTemplate(rep: number): Slot[] {
  const base = Math.round(58 + (rep - 48) * 0.45)
  return [
    { role: 'GK', count: 2, ovr: base - 2 },
    { role: 'CB', count: 3, ovr: base },
    { role: 'LB', count: 2, ovr: base },
    { role: 'RB', count: 2, ovr: base },
    { role: 'CDM', count: 2, ovr: base + 1 },
    { role: 'CM', count: 3, ovr: base + 1 },
    { role: 'CAM', count: 1, ovr: base + 1 },
    { role: 'LW', count: 1, ovr: base + 1 },
    { role: 'RW', count: 1, ovr: base + 1 },
    { role: 'ST', count: 2, ovr: base + 2 },
    { role: 'SS', count: 1, ovr: base + 2 },
  ]
}

function pickSquadRole(overall: number, age: number, indexInClub: number): SquadRole {
  if (indexInClub < 3 && overall >= 70) return 'key'
  if (indexInClub < 11) return 'regular'
  if (age <= 21) return 'prospect'
  return 'squad'
}

export function createClubsFromLeague(leagueId: LeagueId, humanClubId: string): Club[] {
  const league = getLeague(leagueId)
  const div1 = league.clubs.map((def, i) => {
    const id = `club-${i + 1}`
    const isHuman = id === humanClubId
    const saudi = leagueId === 'sau'
    const balance = saudi
      ? Math.round(180_000_000 + def.rep * 4_500_000 + (isHuman ? 20_000_000 : 0))
      : Math.round(8_000_000 + def.rep * 220_000 + (isHuman ? 500_000 : 0))
    return {
      id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      controlledBy: (isHuman ? 'human' : 'ai') as Club['controlledBy'],
      reputation: def.rep,
      stadiumCapacity: (saudi ? 40_000 : 18_000) + def.rep * 450,
      balance,
      wageBudgetWeekly: saudi
        ? Math.round(900_000 + def.rep * 28_000)
        : Math.round(80_000 + def.rep * 2_800),
      seasonStartBalance: balance,
      division: 1 as const,
      crestKey: def.key,
      clubFans: createClubFans(def.rep),
      social: createClubSocial({
        id,
        name: def.name,
        shortName: def.shortName,
        reputation: def.rep,
        stadiumCapacity: 18_000 + def.rep * 450,
        division: 1,
      }),
    }
  })

  const d2names = DIV2_CLUB_NAMES[leagueId]
  /** Championship pack club ability → club reputation (others keep formula) */
  const ENG2_REP: Record<string, number> = {
    lei: 72,
    cov: 70,
    mid: 70,
    nor: 70,
    mlw: 68,
    stk: 68,
    wat: 68,
    blb: 67,
    swa: 67,
    der: 66,
    qpr: 66,
    por: 66,
    hul: 65,
    pne: 65,
    shw: 64,
    car: 64,
    ply: 62,
    oxf: 62,
    hud: 61,
    brr: 60,
  }
  const ESP2_REP: Record<string, number> = {
    alm: 70,
    lpa: 69,
    leg: 68,
    gra: 68,
    vll: 67,
    zar: 66,
    rac: 66,
    gij: 65,
    eib: 65,
    ten: 64,
    mir: 64,
    alb: 63,
    hue: 63,
    brg: 63,
    cor: 63,
    cas: 62,
    and: 61,
    ctg: 60,
    fer: 59,
    eld: 58,
  }
  const GER2_REP: Record<string, number> = {
    s04: 72,
    hbs: 70,
    h96: 68,
    boc: 67,
    kie: 66,
    f95: 66,
    fck: 65,
    svd: 65,
    nur: 64,
    scp: 63,
    ksc: 63,
    sgf: 62,
    mdg: 61,
    elv: 60,
    hro: 60,
    ebs: 59,
    wie: 58,
    prm: 58,
  }
  const FRA2_REP: Record<string, number> = {
    ase: 70,
    mtp: 69,
    rei: 68,
    gui: 64,
    try: 64,
    cae: 63,
    bas: 63,
    aca: 62,
    ami: 62,
    gre: 61,
    pau: 60,
    vac: 60,
    rod: 59,
    lvl: 59,
    dun: 58,
    anc: 58,
    qrm: 57,
    cnc: 56,
  }
  const ITA2_REP: Record<string, number> = {
    sam: 70,
    mnz: 69,
    pal: 68,
    ven: 68,
    emp: 67,
    spe: 66,
    sal: 66,
    bri: 65,
    bsa: 64,
    mod: 63,
    ces: 63,
    caz: 62,
    ctd: 62,
    asc: 61,
    sud: 61,
    cos: 60,
    rgn: 60,
    trn: 59,
    ubs: 58,
    lco: 57,
  }
  const THA2_REP: Record<string, number> = {
    npu: 63,
    pte: 62,
    nbp: 61,
    spb: 61,
    kku: 60,
    cmu: 60,
    spc: 59,
    pat: 59,
    trt: 58,
    cnb: 58,
    lam: 57,
    sis: 57,
    cus: 56,
    msh: 56,
    phr: 55,
    ssc: 55,
  }
  const JPN2_REP: Record<string, number> = {
    sap: 68, vgs: 67, bla: 61, yam: 64, iwk: 62, omi: 66, yfc: 70, sho: 69,
    kof: 63, nig: 68, toy: 60, jub: 66, fuj: 60, tos: 65, ima: 60, sgt: 64,
    oit: 62, vnh: 60, rnf: 60, ehm: 60,
  }
  const KOR2_REP: Record<string, number> = {
    bsi: 68, ssb: 72, dgf: 70, swf: 69, eel: 64, cna: 61, gyn: 63, snm: 65,
    chn: 60, cbj: 60, asn: 60, jnd: 63,
  }
  const div2 = d2names.map((def, i) => {
    const id = `d2-${i + 1}`
    let rep = 42 + (i % 8) + Math.floor(i / 5)
    if (leagueId === 'eng' && def.key && ENG2_REP[def.key] != null) rep = ENG2_REP[def.key]
    if (leagueId === 'esp' && def.key && ESP2_REP[def.key] != null) rep = ESP2_REP[def.key]
    if (leagueId === 'ger' && def.key && GER2_REP[def.key] != null) rep = GER2_REP[def.key]
    if (leagueId === 'fra' && def.key && FRA2_REP[def.key] != null) rep = FRA2_REP[def.key]
    if (leagueId === 'ita' && def.key && ITA2_REP[def.key] != null) rep = ITA2_REP[def.key]
    if (leagueId === 'tha' && def.key && THA2_REP[def.key] != null) rep = THA2_REP[def.key]
    if (leagueId === 'jpn' && def.key && JPN2_REP[def.key] != null) rep = JPN2_REP[def.key]
    if (leagueId === 'kor' && def.key && KOR2_REP[def.key] != null) rep = KOR2_REP[def.key]
    const balance = Math.round(2_500_000 + rep * 90_000)
    return {
      id,
      name: def.name,
      shortName: def.shortName,
      color: def.color,
      controlledBy: 'ai' as const,
      reputation: rep,
      stadiumCapacity: 10_000 + rep * 280,
      balance,
      wageBudgetWeekly: Math.round(35_000 + rep * 1_200),
      seasonStartBalance: balance,
      division: 2 as const,
      crestKey: (def.key ?? null) as string | null,
      clubFans: createClubFans(rep),
      social: createClubSocial({
        id,
        name: def.name,
        shortName: def.shortName,
        reputation: rep,
        stadiumCapacity: 10_000 + rep * 280,
        division: 2,
      }),
    }
  })

  return [...div1, ...div2]
}

export function listClubOptionsForLeague(leagueId: LeagueId) {
  return getLeague(leagueId).clubs.map((def, i) => ({
    id: `club-${i + 1}`,
    name: def.name,
    shortName: def.shortName,
    color: def.color,
    reputation: def.rep,
    crestKey: def.key,
  }))
}

/** Pick a unique real footballer name (league bank → overflow → numbered suffix). */
function uniqueRealName(
  rng: () => number,
  leagueId: LeagueId,
  used: Set<string>,
): string {
  const primary = REAL_NAME_BANKS[leagueId] ?? []
  for (const pool of [primary, GLOBAL_REAL_NAMES]) {
    if (pool.length === 0) continue
    const start = Math.floor(rng() * pool.length)
    for (let i = 0; i < pool.length; i++) {
      const name = pool[(start + i) % pool.length]
      if (!used.has(name)) {
        used.add(name)
        return name
      }
    }
  }
  const base = primary[0] ?? GLOBAL_REAL_NAMES[0] ?? 'Player'
  for (let i = 2; i < 9999; i++) {
    const name = `${base} ${i}`
    if (!used.has(name)) {
      used.add(name)
      return name
    }
  }
  const fallback = `${base} ${Math.floor(rng() * 99999)}`
  used.add(fallback)
  return fallback
}

export function createPlayersForClubDef(opts: {
  leagueId: LeagueId
  club: Club
  def: ClubDef
  seed: number
  idPrefix?: string
  startN?: number
  usedNames?: Set<string>
}): { players: Player[]; nextN: number } {
  const {
    leagueId,
    club,
    def,
    seed,
    idPrefix = 'p',
    startN = 0,
    usedNames = new Set<string>(),
  } = opts
  const rng = mulberry32(seed)
  const template = squadTemplate(def.rep)
  const clubPlayers: Player[] = []
  let n = startN

  const engRoster = leagueId === 'eng' ? engRosterForClub(def.key) : []
  const eng2Roster = leagueId === 'eng' ? eng2RosterForClub(def.key) : []
  const espRoster = leagueId === 'esp' ? espRosterForClub(def.key) : []
  const esp2Roster = leagueId === 'esp' ? esp2RosterForClub(def.key) : []
  const gerRoster = leagueId === 'ger' ? gerRosterForClub(def.key) : []
  const ger2Roster = leagueId === 'ger' ? ger2RosterForClub(def.key) : []
  const fraRoster = leagueId === 'fra' ? fraRosterForClub(def.key) : []
  const fra2Roster = leagueId === 'fra' ? fra2RosterForClub(def.key) : []
  const itaRoster = leagueId === 'ita' ? itaRosterForClub(def.key) : []
  const ita2Roster = leagueId === 'ita' ? ita2RosterForClub(def.key) : []
  const thaRoster = leagueId === 'tha' ? thaRosterForClub(def.key) : []
  const tha2Roster = leagueId === 'tha' ? tha2RosterForClub(def.key) : []
  const jpnRoster = leagueId === 'jpn' ? jpnRosterForClub(def.key) : []
  const jpn2Roster = leagueId === 'jpn' ? jpn2RosterForClub(def.key) : []
  const korRoster = leagueId === 'kor' ? korRosterForClub(def.key) : []
  const kor2Roster = leagueId === 'kor' ? kor2RosterForClub(def.key) : []
  const braRoster = leagueId === 'bra' ? braRosterForClub(def.key) : []
  const turRoster = leagueId === 'tur' ? turRosterForClub(def.key) : []
  const nedRoster = leagueId === 'ned' ? nedRosterForClub(def.key) : []
  const prtRoster = leagueId === 'prt' ? prtRosterForClub(def.key) : []
  const belRoster = leagueId === 'bel' ? belRosterForClub(def.key) : []
  const scoRoster = leagueId === 'sco' ? scoRosterForClub(def.key) : []
  const autRoster = leagueId === 'aut' ? autRosterForClub(def.key) : []
  const suiRoster = leagueId === 'sui' ? suiRosterForClub(def.key) : []
  const denRoster = leagueId === 'den' ? denRosterForClub(def.key) : []
  const greRoster = leagueId === 'gre' ? greRosterForClub(def.key) : []
  const vieRoster = leagueId === 'vie' ? vieRosterForClub(def.key) : []
  const idnRoster = leagueId === 'idn' ? idnRosterForClub(def.key) : []
  const mysRoster = leagueId === 'mys' ? mysRosterForClub(def.key) : []
  const sgpRoster = leagueId === 'sgp' ? sgpRosterForClub(def.key) : []
  const sauRoster = leagueId === 'sau' ? sauRosterForClub(def.key) : []
  const candidates = [
    engRoster, eng2Roster, espRoster, esp2Roster, gerRoster, ger2Roster,
    fraRoster, fra2Roster, itaRoster, ita2Roster, thaRoster, tha2Roster,
    jpnRoster, jpn2Roster, korRoster, kor2Roster, braRoster, turRoster,
    nedRoster, prtRoster, belRoster, scoRoster, autRoster, suiRoster,
    denRoster, greRoster, vieRoster, idnRoster, mysRoster, sgpRoster, sauRoster,
  ]
  const minRoster = leagueId === 'sgp' ? 12 : 16
  const realRoster = candidates.find((r) => r.length >= minRoster) ?? []
  const useFullEngRoster = realRoster.length >= minRoster
  const youthRoster =
    leagueId === 'eng'
      ? engYouthForClub(def.key)
      : leagueId === 'esp'
        ? espYouthForClub(def.key)
        : leagueId === 'ger'
          ? gerYouthForClub(def.key)
          : leagueId === 'fra'
            ? fraYouthForClub(def.key)
            : leagueId === 'ita'
              ? itaYouthForClub(def.key)
              : []
  const seniorNames = new Set(realRoster.map((s) => s.name))
  const youthExtra = youthRoster.filter((y) => !seniorNames.has(y.name) && !usedNames.has(y.name))
  const starQueue = useFullEngRoster
    ? [...realRoster, ...youthExtra]
    : [...def.stars.slice(), ...youthExtra]
  const usedRoles = new Map<RoleCode, number>()

  for (const star of starQueue) {
    n += 1
    usedNames.add(star.name)
    const asYouth = Boolean(star.isYouth)
    const ca = caFromOverall(star.ovr)
    const personality = pickPersonality(rng, star.age, star.ovr)
    usedRoles.set(star.role, (usedRoles.get(star.role) ?? 0) + 1)
    const bio = bioForPlayerName(star.name)
    const fmInside = fmInsideForPlayerName(star.name)
    let pa = makePa(rng, ca, star.age)
    if (bio?.peaked) pa = ca + Math.min(4, bio.caRemaining ?? 2)
    else if (bio?.caRemaining != null) pa = ca + bio.caRemaining
    else if (asYouth) pa = Math.max(pa, ca + 8 + Math.floor(rng() * 10))
    const hidden = makeHidden(rng)
    if (bio?.injuryProne === true) hidden.injuryProneness = Math.max(14, hidden.injuryProneness)
    if (bio?.injuryProne === false) hidden.injuryProneness = Math.min(8, hidden.injuryProneness)
    // BIO £ wages preferred; else FMInside € wages (~£0.86 → ฿×45 ≈ ×39)
    const wageFromBio =
      bio?.wageWeeklyGbp != null ? Math.round(bio.wageWeeklyGbp * 45) : null
    const wageFromFm =
      wageFromBio == null && fmInside?.wageEurPw != null
        ? Math.round(fmInside.wageEurPw * 39)
        : null
    const wageResolved =
      wageFromBio ??
      wageFromFm ??
      Math.round((asYouth ? 400 : 1200) + star.ovr * (asYouth ? 60 : 140) + club.reputation * (asYouth ? 20 : 50))
    const contractExpires = bio?.contractExpires ?? fmInside?.contractEnd ?? null
    const endSeason = contractEndSeasonFromDate(contractExpires) ?? 2029
    const yearsLeft = yearsLeftFromExpires(contractExpires) ?? (asYouth ? 2 : 3)
    const releaseFromBio =
      bio?.releaseClauseGbp === null
        ? null
        : bio?.releaseClauseGbp != null
          ? Math.round(bio.releaseClauseGbp * 45)
          : fmInside?.sellValueEur != null && star.ovr >= 72
            ? Math.round(fmInside.sellValueEur * 39)
            : star.ovr >= 80
              ? Math.round(star.ovr ** 2 * 1200)
              : null
    const attrs = fmInside ? playerAttrsFromFmInside(fmInside) : makeAttrs(rng, star.ovr, star.role)
    clubPlayers.push({
      id: `${idPrefix}-${n}`,
      clubId: club.id,
      name: star.name,
      age: star.age,
      role: star.role,
      position: roleGroup(star.role),
      overall: overallFromCa(ca),
      ca,
      pa,
      attrs,
      hidden,
      growth: personality.growth,
      personalityId: personality.personalityId,
      condition: 88 + Math.floor(rng() * 12),
      sharpness: 75 + Math.floor(rng() * 20),
      form: 8 + Math.floor(rng() * 8),
      morale: 12 + Math.floor(rng() * 6),
      happiness: 12 + Math.floor(rng() * 6),
      wage: wageResolved,
      cash: Math.round(wageResolved * (8 + rng() * 10)),
      squadRole: asYouth ? 'prospect' : 'key',
      injuryDays: 0,
      injuryType: null,
      treatment: null,
      injuryBodyPart: null,
      bodyMap: createBodyMap(rng),
      injuryHistory: [],
      illnessDays: 0,
      illnessType: null,
      seasonYellows: 0,
      banMatches: 0,
      leaveDays: 0,
      contractYears: yearsLeft,
      contractEndSeason: endSeason,
      releaseClause: releaseFromBio,
      minutesPlayed: 0,
      isYouth: asYouth,
      mentorId: null,
      mediaHandling: 6 + Math.floor(rng() * 12),
      skills: rollPlayerSkills(roleGroup(star.role), overallFromCa(ca), rng, {
        role: star.role,
        attrs,
        id: `${idPrefix}-${n}`,
      }),
      social: createPlayerSocial(
        {
          id: `${idPrefix}-${n}`,
          name: star.name,
          overall: overallFromCa(ca),
          age: star.age,
          mediaHandling: 6 + Math.floor(rng() * 12),
          isYouth: asYouth,
        },
        club.social?.followers ?? 100_000,
      ),
      bio: bio ?? null,
      fmInside: fmInside ?? null,
    })
  }

  if (!useFullEngRoster) for (const row of template) {
    const already = usedRoles.get(row.role) ?? 0
    const need = Math.max(0, row.count - already)
    for (let i = 0; i < need; i++) {
      n += 1
      const overall = clamp(row.ovr + (rng() - 0.5) * 7, 45, Math.min(88, def.rep + 5))
      const age = 17 + Math.floor(rng() * 18)
      const name = uniqueRealName(rng, leagueId, usedNames)
      const ca = caFromOverall(overall)
      const personality = pickPersonality(rng, age, overall)
      const years = 1 + Math.floor(rng() * 4)
      const attrs = makeAttrs(rng, overall, row.role)
      const ovr = overallFromCa(ca)
      clubPlayers.push({
        id: `${idPrefix}-${n}`,
        clubId: club.id,
        name,
        age,
        role: row.role,
        position: roleGroup(row.role),
        overall: ovr,
        ca,
        pa: makePa(rng, ca, age),
        attrs,
        hidden: makeHidden(rng),
        growth: personality.growth,
        personalityId: personality.personalityId,
        condition: 85 + Math.floor(rng() * 15),
        sharpness: 70 + Math.floor(rng() * 25),
        form: 6 + Math.floor(rng() * 8),
        morale: 10 + Math.floor(rng() * 8),
        happiness: 10 + Math.floor(rng() * 8),
        wage: Math.round(800 + overall * 90 + club.reputation * 40),
        cash: Math.round((800 + overall * 90 + club.reputation * 40) * (6 + rng() * 12)),
        squadRole: 'squad',
        injuryDays: 0,
        injuryType: null,
        treatment: null,
        injuryBodyPart: null,
        bodyMap: createBodyMap(rng),
        injuryHistory: [],
        illnessDays: 0,
        illnessType: null,
        seasonYellows: 0,
        banMatches: 0,
        leaveDays: 0,
        contractYears: years,
        contractEndSeason: 2026 + years,
        releaseClause: overall >= 78 ? Math.round(overall ** 2 * 1000) : null,
        minutesPlayed: 0,
        isYouth: false,
        mentorId: null,
        mediaHandling: 6 + Math.floor(rng() * 12),
        skills: rollPlayerSkills(roleGroup(row.role), ovr, rng, {
          role: row.role,
          attrs,
          id: `${idPrefix}-${n}`,
        }),
        social: createPlayerSocial(
          {
            id: `${idPrefix}-${n}`,
            name,
            overall: overallFromCa(ca),
            age,
            mediaHandling: 6 + Math.floor(rng() * 12),
            isYouth: false,
          },
          club.social?.followers ?? 80_000,
        ),
      })
    }
  }

  clubPlayers.sort((a, b) => {
    if (a.isYouth !== b.isYouth) return a.isYouth ? 1 : -1
    return b.overall - a.overall
  })
  clubPlayers.forEach((p, idx) => {
    if (p.isYouth) p.squadRole = 'prospect'
    else if (p.squadRole !== 'key') p.squadRole = pickSquadRole(p.overall, p.age, idx)
  })

  return { players: clubPlayers, nextN: n }
}

export function createPlayersFromLeague(
  leagueId: LeagueId,
  clubs: Club[],
  seed = 2026,
): Player[] {
  const league = getLeague(leagueId)
  const players: Player[] = []
  const usedNames = new Set<string>()
  let n = 0

  clubs.forEach((club, clubIndex) => {
    let def: ClubDef
    if (club.division === 2 || club.id.startsWith('d2-')) {
      const d2idx = Number(club.id.replace('d2-', '')) - 1
      const d2meta = DIV2_CLUB_NAMES[leagueId][d2idx]
      def = {
        key: d2meta?.key ?? club.crestKey ?? club.id,
        name: club.name,
        shortName: club.shortName,
        color: club.color,
        rep: club.reputation,
        stars: [],
      }
    } else {
      const idx = Number(club.id.replace('club-', '')) - 1
      def = league.clubs[idx] ?? league.clubs[clubIndex % league.clubs.length]
    }
    const built = createPlayersForClubDef({
      leagueId,
      club,
      def,
      seed: seed + clubIndex * 131 + leagueId.charCodeAt(0) * 97,
      startN: n,
      usedNames,
      idPrefix: club.division === 2 ? 'd2p' : 'p',
    })
    n = built.nextN
    players.push(...built.players)
  })

  return players
}
