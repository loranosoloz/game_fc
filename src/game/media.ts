import type { GameSave, MediaFeed, MediaItem, MediaTone, PressStory } from './types'
import { pickOutlet, pickTalkShow } from './mediaOutlets'
import { formatPersonalityCredit, personalitySays, pickPersonality } from './mediaPersonalities'

/** rough market value for rumor copy (avoid circular import with transfer.ts) */
function roughValue(overall: number, age: number): number {
  const ageFactor = age <= 24 ? 1.25 : age <= 29 ? 1.0 : age <= 32 ? 0.7 : 0.45
  return Math.round(overall ** 2 * 900 * ageFactor)
}

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function createMediaFeed(): MediaFeed {
  return { news: [], social: [], romano: [], lastPlantByClub: {} }
}

export function ensureMediaFeed(save: GameSave): MediaFeed {
  if (save.media?.news) {
    return {
      ...save.media,
      social: save.media.social ?? [],
      romano: save.media.romano ?? [],
      lastPlantByClub: save.media.lastPlantByClub ?? {},
    }
  }
  // migrate legacy press → news
  const news: MediaItem[] = (save.press ?? []).map((p) => ({
    id: p.id,
    date: p.date,
    channel: 'news' as const,
    headline: p.headline,
    body: p.body,
    tone: 'neutral' as MediaTone,
  }))
  return { news, social: [], romano: [], lastPlantByClub: {} }
}

function item(
  channel: MediaItem['channel'],
  date: string,
  headline: string,
  body: string,
  tone: MediaTone,
  extra?: Partial<MediaItem>,
): MediaItem {
  return {
    id: uid(channel),
    date,
    channel,
    headline,
    body,
    tone,
    ...extra,
  }
}

function withOutlet(save: GameSave, salt: number, story: MediaItem): MediaItem {
  const outlet = pickOutlet(save, salt)
  return { ...story, outlet: outlet.name, headline: `${outlet.name} · ${story.headline}` }
}

/** Official / tabloid news after a match */
export function newsAfterMatch(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const outlet = pickOutlet(save, usGoals + themGoals * 3)
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  const pundit = pickPersonality(save, usGoals * 5 + themGoals)
  const credit = formatPersonalityCredit(pundit)
  const altBodies = won
    ? [
        `คอลัมน์ ${outlet.name} ชี้ว่าแผนของ ${save.managerName} เริ่มชัด — แฟนเชื่อฤดูกาลนี้ไปได้ไกล`,
        personalitySays(pundit, `จังหวะเปลี่ยนตัวและความเข้มเกมรับของ ${club.shortName} น่าประทับใจ`),
        `โซเชียลแตก — แฮชแท็ก ${club.shortName} พุ่งหลังสกอร์ ${usGoals}–${themGoals}`,
      ]
    : drawn
      ? [
          `${outlet.name} มองว่ายังขาดความคมในกรอบ — บอร์ดจับตา 3 นัดถัดไป`,
          personalitySays(pundit, `แต้มนี้ “พอใช้” หรือ “เสียโอกาสทอง” ยังถกเถียงได้`),
          `สถิติชี้ครองบอลดีแต่จบไม่คม — โจทย์ซ้อมสัปดาห์นี้ชัดเจน`,
        ]
      : [
          `สกอร์ ${usGoals}–${themGoals} ถูกนำไปพาดหัว — ความมั่นใจบอร์ดถูกพูดถึงในทอล์คโชว์`,
          `${outlet.name} เปิดสายแฟนโหวตอนาคต ${save.managerName} หลังเกมนี้ — ${credit} ร่วมวงสนทนา`,
          personalitySays(pundit, `คู่แข่งกดดันได้สำเร็จ — ต้องแก้เกมรุก/รับทันที`),
        ]
  const body = altBodies[Math.abs(save.matchday + usGoals) % altBodies.length]!
  const punditMeta = {
    punditName: pundit.name,
    punditRole: pundit.roleTh,
    punditBio: pundit.bioTh,
  }
  if (won) {
    return item(
      'news',
      save.currentDate,
      `${club.shortName} ทุบ ${oppName} ${usGoals}–${themGoals}`,
      body,
      'positive',
      { tags: ['match', 'result'], outlet: outlet.name, ...punditMeta },
    )
  }
  if (drawn) {
    return item(
      'news',
      save.currentDate,
      `${club.shortName} แบ่งแต้ม ${oppName}`,
      body,
      'neutral',
      { tags: ['match', 'result'], outlet: outlet.name, ...punditMeta },
    )
  }
  return item(
    'news',
    save.currentDate,
    `คำถามถึง ${save.managerName} หลังแพ้ ${oppName}`,
    body,
    'negative',
    { tags: ['match', 'result'], outlet: outlet.name, ...punditMeta },
  )
}

export function newsAfterTransfer(save: GameSave, playerName: string, isBuy: boolean): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  return withOutlet(
    save,
    21,
    item(
      'news',
      save.currentDate,
      isBuy ? `${club.shortName} ปิดดีลคว้า ${playerName}` : `${club.shortName} ปล่อย ${playerName}`,
      isBuy
        ? `สำนักข่าวรายงานว่าข้อตกลงผ่านเพราะสเกาต์และงบที่ยังพอหมุน`
        : `ฝั่งการเงินมองว่าสมเหตุสมผล ขณะที่แฟนบางส่วนไม่พอใจ`,
      isBuy ? 'positive' : 'neutral',
      { tags: ['transfer'] },
    ),
  )
}

export function newsAfterInjury(
  save: GameSave,
  playerName: string,
  injuryType: string | null,
  days: number,
): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const typeTh =
    injuryType === 'ligament' ? 'เอ็น' : injuryType === 'bone' ? 'กระดูก' : 'กล้ามเนื้อ'
  const severe = days >= 10
  return item(
    'news',
    save.currentDate,
    severe
      ? `${club.shortName}: ${playerName} เจ็บหนัก พักอย่างน้อย ${days} วัน`
      : `อัปเดตแพทย์ ${club.shortName}: ${playerName} เจ็บ${typeTh}`,
    severe
      ? `สื่อรายงานอาการ${typeTh} — คาดพลาดหลายนัด · แผนรักษาอยู่ในมือ physio`
      : `สโมสรยืนยันอาการ${typeTh} ประมาณ ${days} วัน · ยังไม่ใช่ปัญหาเรื้อรัง`,
    severe ? 'negative' : 'neutral',
    { tags: ['medical', 'injury'], subjectName: playerName },
  )
}

export function newsAfterIllness(
  save: GameSave,
  playerName: string,
  illnessType: string,
  days: number,
): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const label: Record<string, string> = {
    cold: 'หวัด',
    flu: 'ไข้หวัดใหญ่',
    stomach: 'ท้องเสีย',
    virus: 'ไวรัส',
    fever: 'มีไข้',
  }
  const th = label[illnessType] ?? 'ป่วย'
  return item(
    'news',
    save.currentDate,
    `${club.shortName}: ${playerName} ป่วย${th}`,
    `ทีมแพทย์ยืนยันต้องพักประมาณ ${days} วัน — ยังไม่เกี่ยวกับอาการบาดเจ็บกล้ามเนื้อ`,
    'neutral',
    { tags: ['medical', 'illness'], subjectName: playerName },
  )
}

export function newsAfterYouth(save: GameSave, names: string): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  return item(
    'news',
    save.currentDate,
    `${club.shortName} ดันเยาวชนขึ้นชุดใหญ่`,
    `อะคาเดมี่ส่ง ${names} เข้าทีมหลัก — สื่อท้องถิ่นยกให้เป็นสัญญาณลงทุนระยะยาว`,
    'positive',
    { tags: ['youth'] },
  )
}

export function newsAfterTitle(
  save: GameSave,
  competitionName: string,
  championName: string,
  isHuman: boolean,
): MediaItem {
  if (isHuman) {
    return item(
      'news',
      save.currentDate,
      `แชมป์! ${championName} คว้า ${competitionName}`,
      `พาดหัวทั่วประเทศ — ชื่อ ${save.managerName} ถูกพูดถึงในฐานะผู้สร้างทีมยุคใหม่`,
      'positive',
      { tags: ['title', 'trophy'] },
    )
  }
  return item(
    'news',
    save.currentDate,
    `${championName} ครอง ${competitionName}`,
    `คู่แข่งในลีกถูกนำไปเปรียบเทียบทันที — ความกดดันบน ${save.managerName} เพิ่มขึ้นเล็กน้อย`,
    'neutral',
    { tags: ['title'] },
  )
}

export function newsAfterContract(save: GameSave, playerName: string, years: number): MediaItem {
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  return item(
    'news',
    save.currentDate,
    `${club.shortName} ต่อสัญญา ${playerName}`,
    `ข้อตกลง ${years} ปีผ่านฉลุย — ฝ่ายสื่อสโมสรย้ำว่าเป็นส่วนหนึ่งของแผนสร้างความต่อเนื่อง`,
    'positive',
    { tags: ['contract'], subjectName: playerName },
  )
}

/** Occasional headline about a nearby rival's result (not every AI match). */
export function newsRivalResult(
  save: GameSave,
  rivalShort: string,
  oppShort: string,
  rivalGoals: number,
  oppGoals: number,
): MediaItem {
  const won = rivalGoals > oppGoals
  const drawn = rivalGoals === oppGoals
  const pundit = pickPersonality(save, rivalGoals * 3 + oppGoals + 11)
  return item(
    'news',
    save.currentDate,
    won
      ? `คู่แข่งตรง ${rivalShort} ชนะ ${oppShort} ${rivalGoals}–${oppGoals}`
      : drawn
        ? `${rivalShort} แบ่งแต้ม ${oppShort}`
        : `${rivalShort} สะดุด แพ้ ${oppShort}`,
    won
      ? personalitySays(pundit, `${save.managerName} ต้องตอบด้วยผลงานนัดหน้า หลังตารางตึงขึ้น`)
      : drawn
        ? `โอกาสของ ${save.clubs.find((c) => c.id === save.humanClubId)?.shortName ?? 'คุณ'} ยังเปิดอยู่`
        : `ช่องว่างแต้มอาจขยับ — สื่อเริ่มคุยถึงจังหวะล่าแต้ม`,
    won ? 'negative' : drawn ? 'neutral' : 'positive',
    {
      tags: ['rival', 'league'],
      punditName: pundit.name,
      punditRole: pundit.roleTh,
      punditBio: pundit.bioTh,
    },
  )
}

/** Detect human-club players who newly became injured. */
export function detectNewInjuries(
  before: { id: string; injuryDays: number }[],
  after: { id: string; name: string; clubId: string; injuryDays: number; injuryType: string | null }[],
  humanClubId: string,
): { name: string; injuryType: string | null; days: number }[] {
  const prev = new Map(before.map((p) => [p.id, p.injuryDays]))
  const out: { name: string; injuryType: string | null; days: number }[] = []
  for (const p of after) {
    if (p.clubId !== humanClubId) continue
    const was = prev.get(p.id) ?? 0
    if (was <= 0 && p.injuryDays > 0) {
      out.push({ name: p.name, injuryType: p.injuryType, days: p.injuryDays })
    }
  }
  return out
}

/** Fan / player social posts — พูลใหญ่ขึ้น */
export function generateSocialBurst(save: GameSave): MediaItem[] {
  const rng = mulberry32(save.season * 500 + save.matchday * 33)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const posts: MediaItem[] = []
  const talk = pickTalkShow(save, save.matchday)
  const outlet = pickOutlet(save, 40)

  const generators: Array<() => MediaItem | null> = [
    () =>
      item(
        'social',
        save.currentDate,
        `@Ultras${club.shortName}`,
        save.fans.mood >= 65
          ? `สัปดาห์นี้ฟีลดีมาก 🔥 ${club.name} คือชีวิต`
          : save.fans.mood < 40
            ? `บอร์ดตื่นได้แล้ว — แฟนทนไม่ไหว`
            : `ขอแค่ลงสม่ำเสมอ อย่าสลับ XI มั่ว`,
        save.fans.mood >= 65 ? 'positive' : save.fans.mood < 40 ? 'negative' : 'neutral',
        { tags: ['fans'] },
      ),
    () => {
      const p = squad[Math.floor(rng() * squad.length)]
      if (!p) return null
      const act = p.lastActivityId
      return item(
        'social',
        save.currentDate,
        p.social?.handle ?? `${p.name.split(' ').slice(-1)[0]} ✨`,
        act === 'pub_night' || act === 'club_party'
          ? `คืนที่แล้ว… 🤫 (สตอรี่หายไปแล้ว)`
          : act === 'dawn_gym' || act === 'extra_shooting'
            ? `งานไม่เคยโกหก 💪 กลับมาซ้อมต่อ`
            : `ขอบคุณทุกกำลังใจ — โฟกัสแมตช์หน้า`,
        'neutral',
        { tags: ['player', p.id], subjectName: p.name },
      )
    },
    () => {
      const pundit = pickPersonality(save, 77)
      return item(
        'social',
        save.currentDate,
        talk,
        save.board.confidence < 45
          ? `${formatPersonalityCredit(pundit)} เปิดประเด็น: ${save.managerName} ยังปลอดภัยอยู่ไหม?`
          : `${formatPersonalityCredit(pundit)} ชวนคุย — ใครคือ MVP ของ ${club.shortName} ซีซั่นนี้?`,
        save.board.confidence < 45 ? 'negative' : 'positive',
        {
          tags: ['talk', 'pundit'],
          outlet: talk,
          punditName: pundit.name,
          punditRole: pundit.roleTh,
          punditBio: pundit.bioTh,
        },
      )
    },
    () =>
      item(
        'social',
        save.currentDate,
        `@Family${club.shortName}`,
        save.fans.factions.soft >= 60
          ? `พาลูกมาสนามนัดหน้าได้ไหม? ขอโซนครอบครัวชัดๆ 🙏`
          : `เชียร์แบบสงบก็มีความสุข — ขอแค่ทีมสู้`,
        'neutral',
        { tags: ['fans', 'soft'] },
      ),
    () => {
      const star = [...squad].sort((a, b) => b.overall - a.overall)[0]
      if (!star) return null
      return item(
        'social',
        save.currentDate,
        `FanEdit Bot`,
        `คลิปไฮไลต์ ${star.name} ทะลุล้านวิว — ใครเซฟไว้บ้าง?`,
        'positive',
        { tags: ['viral', star.id], subjectName: star.name },
      )
    },
    () =>
      item(
        'social',
        save.currentDate,
        outlet.name,
        `โพลด่วน: ${club.shortName} ควรเสริมตำแหน่งไหนก่อนหน้าต่างตลาด?`,
        'rumor',
        { tags: ['poll'], outlet: outlet.name },
      ),
    () => {
      const young = squad.filter((p) => p.age <= 21 || p.isYouth)[0]
      if (!young) return null
      return item(
        'social',
        save.currentDate,
        `@AcademyWatch`,
        `${young.name} คืออนาคตไหม? อะคาเดมี่แฟนเพจเปิดโหวต`,
        'positive',
        { tags: ['youth', young.id], subjectName: young.name },
      )
    },
    () =>
      item(
        'social',
        save.currentDate,
        `@AwayDays${club.shortName}`,
        save.fans.mood >= 50
          ? `นัดเยือนรอบหน้า — ใครไปบ้างทักในคอมเมนต์ 🚌`
          : `ขายตั๋วเยือนช้า… บรรยากาศยังไม่คึก`,
        save.fans.mood >= 50 ? 'positive' : 'negative',
        { tags: ['fans', 'away'] },
      ),
    () => {
      const rich = [...squad].sort((a, b) => (b.social?.followers ?? 0) - (a.social?.followers ?? 0))[0]
      if (!rich?.social) return null
      return item(
        'social',
        save.currentDate,
        rich.social.handle,
        rich.social.heat >= 60
          ? `อินบ็อกซ์ระเบิด 😅 ขอบคุณทุกคน — พักก่อนแข่ง`
          : `วันธรรมดา · กาแฟ · โฟกัสซ้อม`,
        'neutral',
        { tags: ['player', rich.id], subjectName: rich.name },
      )
    },
    () =>
      item(
        'social',
        save.currentDate,
        `MemeFC`,
        save.fans.mood < 35
          ? `มีมใหม่ทุกชั่วโมงหลังเกมแย่… 😂💔`
          : `มีมฉลองสกอร์ — ไทม์ไลน์เขียวหมด`,
        save.fans.mood < 35 ? 'negative' : 'positive',
        { tags: ['meme'] },
      ),
    () =>
      item(
        'social',
        save.currentDate,
        club.social?.handle ?? `@${club.shortName}`,
        `อัปเดตทางการ: ตารางซ้อมสัปดาห์นี้ + ตั๋วนัดเหย้าเปิดขายตามรอบ`,
        'neutral',
        { tags: ['club'] },
      ),
    () => {
      if (save.board.ultimatum && rng() < 0.7) {
        return item(
          'social',
          save.currentDate,
          talk,
          `คำขาดบอร์ดเป็นข่าวใหญ่ — แฟนแบ่งเป็นสองขั้วทันที`,
          'negative',
          { tags: ['board', 'talk'] },
        )
      }
      return null
    },
  ]

  // ยิง 4–7 โพสต์ต่อสัปดาห์
  const target = 4 + Math.floor(rng() * 4)
  const order = generators.map((_, i) => i).sort(() => rng() - 0.5)
  for (const idx of order) {
    if (posts.length >= target) break
    if (rng() > 0.82 && posts.length >= 3) continue
    const post = generators[idx]!()
    if (post) posts.push(post)
  }

  const low = squad.filter((p) => p.morale <= 7).slice(0, 2)
  for (const p of low) {
    if ((p.mediaHandling ?? 10) >= 14 && rng() < 0.55) continue
    posts.push(
      item(
        'social',
        save.currentDate,
        `LeakBot`,
        `วงใน: ${p.name} ไม่แฮปปี้กับเวลาลงเล่น — โซเชียลแตกเป็นสองฝ่าย`,
        'negative',
        { tags: ['leak', p.id], subjectName: p.name },
      ),
    )
  }

  return posts
}

/**
 * “Romano” — backroom / transfer intel with reliability %.
 * High reliability ≈ “Here we go”
 */
export function generateRomanoIntel(save: GameSave): MediaItem[] {
  const rng = mulberry32(save.season * 777 + save.matchday * 41 + 9)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const items: MediaItem[] = []

  // Transfer rumor on a market target
  const targets = save.players
    .filter((p) => p.clubId !== save.humanClubId && p.overall >= 72)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 12)
  if (targets.length && rng() < 0.55) {
    const p = targets[Math.floor(rng() * Math.min(6, targets.length))]
    const seller = save.clubs.find((c) => c.id === p.clubId)
    const reliability = Math.round(35 + rng() * 55)
    const value = roughValue(p.overall, p.age)
    const hereWeGo = reliability >= 85
    items.push(
      item(
        'romano',
        save.currentDate,
        hereWeGo
          ? `Here we go: ${p.name} → ${club.shortName}`
          : reliability >= 70
            ? `Here we go? ${club.shortName} ลุยดีล ${p.name}`
            : `วงใน: ${club.shortName} สนใจ ${p.name}`,
        hereWeGo
          ? `ข้อตกลงใกล้ปิด — มูลค่าแถว ${(value / 1_000_000).toFixed(1)} ล้าน · ${seller?.name ?? 'ต้นสังกัด'} เปิดเจรจา`
          : `แหล่งข่าวใกล้สโมสรบอกว่ามีการคุยเบื้องต้น · ความเชื่อมั่นข่าว ${reliability}% · ยังไม่ใช่ข้อตกลงสุดท้าย`,
        'rumor',
        {
          tags: ['transfer', p.id],
          reliability,
          subjectName: p.name,
        },
      ),
    )
  }

  // Outgoing rumor — ธงอยากย้าย / ไม่แฮปปี้
  const outgoing = save.players
    .filter(
      (p) =>
        p.clubId === save.humanClubId &&
        (p.wantAway?.active || (p.happiness ?? 12) < 9),
    )
    .sort((a, b) => {
      const wa = (x: typeof a) =>
        (x.wantAway?.publicNews ? 30 : 0) +
        (x.wantAway?.intensity ?? 0) -
        (x.happiness ?? 12)
      return wa(b) - wa(a)
    })
  if (outgoing[0] && rng() < (outgoing[0].wantAway?.active ? 0.65 : 0.4)) {
    const p = outgoing[0]
    const reliability = Math.round(
      40 + rng() * 40 + (p.wantAway?.publicNews ? 15 : 0),
    )
    items.push(
      item(
        'romano',
        save.currentDate,
        p.wantAway?.publicNews
          ? `Here we go?: ${p.name} อาจลา ${club.shortName}`
          : `วงใน: ${p.name} อาจลา ${club.shortName}`,
        p.wantAway?.active
          ? `ธงอยากย้ายทำงานอยู่ · ${p.wantAway.reasonTh ?? 'ไม่แฮปปี้'} · ความเชื่อมั่น ${reliability}%`
          : `เอเยนต์เปิดรับฟังข้อเสนอ · ความเชื่อมั่น ${reliability}% · สโมสรยังไม่ยืนยัน`,
        'rumor',
        { tags: ['outgoing', 'want_away', p.id], reliability, subjectName: p.name },
      ),
    )
  }

  // Medical / dressing room backroom
  const injured = save.players.filter((p) => p.clubId === save.humanClubId && p.injuryDays > 5)
  if (injured[0] && rng() < 0.45) {
    const p = injured[0]
    items.push(
      item(
        'romano',
        save.currentDate,
        `อัปเดตการแพทย์: ${p.name}`,
        `แหล่งข่าวสตาฟบอกว่าอาการดีขึ้นช้ากว่าที่คาด — อาจพลาด ${Math.ceil(p.injuryDays / 7)} นัด · ไม่ใช่ข่าวทางการ`,
        'rumor',
        { tags: ['medical', p.id], reliability: Math.round(50 + rng() * 30), subjectName: p.name },
      ),
    )
  }

  // Board / manager
  if (save.board.confidence < 42 && rng() < 0.5) {
    items.push(
      item(
        'romano',
        save.currentDate,
        `หลังบ้านบอร์ด: อนาคต ${save.managerName}`,
        `มีการประชุมเงียบๆ เรื่องวิสัยทัศน์ — ยังไม่ถึงขั้นตัดสินใจ · ความเชื่อมั่นข่าว ${Math.round(45 + rng() * 35)}%`,
        'rumor',
        { tags: ['board'], reliability: Math.round(45 + rng() * 35) },
      ),
    )
  }

  // Staff / head coach whisper
  const coach = save.staff.pool?.find((p) => p.clubId === save.humanClubId && p.role === 'coach')
  if (coach && coach.morale <= 8 && rng() < 0.35) {
    items.push(
      item(
        'romano',
        save.currentDate,
        `วงใน: โค้ชหลัก ${coach.name}`,
        `บรรยากาศในห้องโค้ชตึงเครียด — มีการพูดถึงทิศทางแท็กติกกับผู้จัดการ · ยังไม่ยืนยันความขัดแย้ง`,
        'rumor',
        { tags: ['staff', coach.id], reliability: Math.round(40 + rng() * 35), subjectName: coach.name },
      ),
    )
  }

  if (items.length === 0 && rng() < 0.4) {
    items.push(
      item(
        'romano',
        save.currentDate,
        `Romano: สัปดาห์นี้เงียบที่ ${club.shortName}`,
        `ยังไม่มีดีลใหญ่ที่ “Here we go” — ติดตามตลาดต่อ`,
        'neutral',
        { reliability: 60 },
      ),
    )
  }

  return items
}

/** Run weekly media cycle after matchday */
export function advanceMediaWeek(save: GameSave): GameSave {
  const media = ensureMediaFeed(save)
  const social = [...generateSocialBurst(save), ...media.social].slice(0, 40)
  const romano = [...generateRomanoIntel(save), ...media.romano].slice(0, 40)
  return {
    ...save,
    media: { ...media, social, romano },
    // keep legacy press in sync with news head
    press: media.news.slice(0, 30).map(
      (n): PressStory => ({
        id: n.id,
        date: n.date,
        headline: n.headline,
        body: n.body,
      }),
    ),
  }
}

export function pushNews(save: GameSave, story: MediaItem): GameSave {
  const media = ensureMediaFeed(save)
  const news = [story, ...media.news].slice(0, 40)
  return {
    ...save,
    media: { ...media, news },
    press: news.slice(0, 30).map((n) => ({
      id: n.id,
      date: n.date,
      headline: n.headline,
      body: n.body,
    })),
  }
}

/**
 * ข่าวเปิดเกมทุกครั้งที่เริ่มใหม่ — หลังจบบอลโลก / เข้าปรีซีซั่น
 * (วันที่ควรเป็น ~20 ก.ค.)
 */
export function seedOpeningNews(save: GameSave): GameSave {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const clubName = club?.name ?? 'สโมสรของคุณ'
  const date = save.currentDate
  const wcChamp =
    save.worldCup?.championTh ||
    save.worldCup?.champion ||
    save.lastIntlTournamentReports?.find((r) => /โลก|world/i.test(r.labelTh || ''))
      ?.championTh ||
    null
  const leagueName = save.leagueName

  const stories: Array<{
    id: string
    headline: string
    body: string
    tone: MediaTone
    tags: string[]
    salt: number
  }> = [
    {
      id: `news-open-wc-${save.season}`,
      headline: wcChamp
        ? `หลังฟุตบอลโลก ${save.season}: ${wcChamp} ฉลองแชมป์ — ดาวดังทยอยกลับสโมสร`
        : `หลังฟุตบอลโลก ${save.season}: นักเตะทีมชาติทยอยกลับสโมสร`,
      body: wcChamp
        ? `ทัวร์นาเมนต์ใหญ่จบลงแล้ว แชมป์โลก ${wcChamp} · ลีกยุโรปเข้าสู่ช่วงปรีซีซั่นก่อนเปิดฤดูกาลกลางสิงหาคม`
        : `ทัวร์นาเมนต์ทีมชาติฤดูร้อนจบลง · สโมสรเตรียมอุ่นเครื่องก่อนเปิดลีก`,
      tone: 'neutral',
      tags: ['opening', 'world_cup', 'international'],
      salt: 11,
    },
    {
      id: `news-open-manager-${save.humanClubId}`,
      headline: `${clubName} แต่งตั้งผู้จัดการคนใหม่`,
      body: `บอร์ด ${clubName} ยืนยันแต่งตั้งผู้จัดการคนใหม่ใน ${leagueName} · ภารกิจแรกคือเลือกแผนปรีซีซั่นและจัดทัพก่อน MD1`,
      tone: 'positive',
      tags: ['opening', 'club', 'manager'],
      salt: 22,
    },
    {
      id: `news-open-market-${save.season}`,
      headline: 'ตลาดนักเตะเดือด — หน้าต่างซัมเมอร์เปิดเต็มที่',
      body: `เอเยนต์และสโมสรเร่งเจรจาก่อนเปิดลีก · คาดว่าจะมีดีลใหญ่ต่อเนื่องตลอดเดือนกรกฎาคม–สิงหาคม`,
      tone: 'neutral',
      tags: ['opening', 'transfer'],
      salt: 33,
    },
    {
      id: `news-open-preseason-${save.season}`,
      headline: 'ปรีซีซั่นเริ่มแล้ว — สโมสรเลือกทัวร์อุ่นเครื่อง',
      body: `หลายทีมเปิดค่ายซ้อมและรับข้อเสนอทัวร์ต่างประเทศ · นัดอุ่นเครื่องช่วยเก็บความฟิตก่อน Community Shield และ MD1`,
      tone: 'neutral',
      tags: ['opening', 'preseason'],
      salt: 44,
    },
  ]

  let next = save
  // push จากท้าย → หัวข่าวแรกอยู่บนสุด
  for (const s of [...stories].reverse()) {
    const outlet = pickOutlet(next, s.salt)
    next = pushNews(next, {
      id: s.id,
      date,
      channel: 'news',
      headline: `${outlet.name} · ${s.headline}`,
      body: s.body,
      tone: s.tone,
      tags: s.tags,
      outlet: outlet.name,
      subjectName: clubName,
    })
  }
  return next
}

/** Compatibility: empty legacy feed (prefer createMediaFeed) */
export function createPressFeed(): PressStory[] {
  return []
}

export function gossipLine(save: GameSave): string {
  const media = ensureMediaFeed(save)
  const top = media.romano[0]
  if (top) {
    const conf = top.reliability != null ? ` (${top.reliability}%)` : ''
    return `Romano${conf}: ${top.headline}`
  }
  const lowMorale = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => a.morale - b.morale)[0]
  if (lowMorale && lowMorale.morale <= 6) {
    return `ซุบซิบ: ${lowMorale.name} ไม่พอใจเวลาลงเล่น`
  }
  if (save.dynamics.cohesion < 45) return 'ซุบซิบ: ห้องแต่งตัวมีเสียงวิจารณ์แท็กติก'
  if (save.board.confidence < 40) return 'ซุบซิบ: บอร์ดเริ่มคุยเรื่องอนาคตผู้จัดการ'
  return 'ซุบซิบ: สัปดาห์นี้เงียบเป็นพิเศษ'
}

/** Count news items dated today (portal badge). */
export function countTodaysNews(save: GameSave): number {
  const media = ensureMediaFeed(save)
  return media.news.filter((n) => n.date === save.currentDate).length
}

export function adjustManagerReputation(save: GameSave, delta: number): GameSave {
  const next = Math.max(0, Math.min(100, (save.managerReputation ?? 50) + delta))
  return { ...save, managerReputation: next }
}
