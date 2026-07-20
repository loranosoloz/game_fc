/**
 * ดราม่าโซเชียลหลังแมตช์ — แฟนด่า/ชม · นักเตะตัดพ้อ/ฉลอง/ตอกกลับ
 * เทมเพลตเยอะ · ผูกเรตติ้งรายคน
 */
import type {
  GameSave,
  MatchPlayerRating,
  MatchResult,
  MediaItem,
  Player,
  PlayerSocialMood,
  PlayerSocialPost,
  PlayerSocialPostKind,
} from './types'
import { ensureMediaFeed } from './media'
import { ensurePlayerSocial, formatFollowers } from './social'
import { bumpClubLoyalty } from './playerLoyalty'
import {
  antiFanHandle,
  applyFameAfterRating,
  famePraiseExtra,
  fameRoastExtra,
  fanClubHandle,
} from './playerFame'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!
}

function fanHandle(): string {
  const bases = [
    'Ultra',
    'DieHard',
    'SeasonTicket',
    'CouchCoach',
    'VARVictim',
    'TifoKid',
    'BanterFC',
    'xGNerd',
    'TerraceVoice',
    'KitCollector',
    'AwayDay',
    'Superfan',
  ]
  return `@${pick(bases)}${Math.floor(Math.random() * 9000 + 100)}`
}

/** ——— แฟนด่า (เรตติ้งต่ำ) ——— */
const FAN_ROAST: Array<(n: string, r: string) => string> = [
  (n, r) => `${n} เรตติ้ง ${r} วันนี้เล่นเหมือนโดนสาป 😂`,
  (n, r) => `ใครปล่อย ${n} ลงตัวจริงอีก เรต ${r} อายแทน`,
  (n, r) => `${n} วันนี้หายไปไหนทั้งเกม (${r}) — คืนค่าตั๋วมา`,
  (n, r) => `สถิติ ${n}: วิ่งเยอะ จบเกมว่างเปล่า · ${r}`,
  (n, r) => `${n} ทำบอลหลุดเหมือนมือถือตกพื้น · ${r}`,
  (n, r) => `แฟนเพจเงียบหมดเพราะ ${n} (${r})`,
  (n, r) => `${n} อย่าโทษสนามเลยพี่ เรต ${r} ชัดเจน`,
  (n, r) => `โค้ชเห็น ${n} แล้วก็คงอยากพักผ่อน · ${r}`,
  (n, r) => `${n} วันนี้เป็นไฮไลต์… ของทีมตรงข้าม (${r})`,
  (n, r) => `ขอร้อง อย่าเริ่ม ${n} อีกถ้ายังฟอร์มนี้ (${r})`,
  (n, r) => `${n} เล่นเหมือนยังอยู่ในห้องแต่งตัว · ${r}`,
  (n, r) => `VAR ก็ช่วย ${n} ไม่ได้แล้ววันนี้ (${r})`,
  (n, r) => `${n} โดนติ๊กต๊อกแบนเทอร์ย่อย · เรต ${r}`,
  (n, r) => `มึงดู ${n} แล้วจะเข้าใจคำว่า "โหลดเกมไม่ขึ้น" (${r})`,
  (n, r) => `${n} วันนี้ฟอร์มเหมือนซีซันทัวร์ปรีซีซัน · ${r}`,
]

/** ——— แฟนชม (เรตติ้งสูง / MOM) ——— */
const FAN_PRAISE: Array<(n: string, r: string) => string> = [
  (n, r) => `${n} วันนี้เทพ 🔥 เรต ${r}`,
  (n, r) => `นี่แหละ ${n} ที่เรารัก · ${r} เฉียบ`,
  (n, r) => `${n} คุมเกมทั้งสนาม (${r}) ยกให้เลย`,
  (n, r) => `คลิปไฮไลต์ ${n} กำลังแตก · เรต ${r}`,
  (n, r) => `${n} เล่นเหมือนคนละคนกับอาทิตย์ก่อน (${r})`,
  (n, r) => `MOM ในใจ: ${n} (${r})`,
  (n, r) => `${n} ทำให้ค่าตั๋วคุ้มใน 90 นาที · ${r}`,
  (n, r) => `โซเชียลล้นด้วยชื่อ ${n} ตอนนี้ (${r})`,
  (n, r) => `${n} คือเหตุผลที่ยังเชียร์อยู่ · ${r}`,
  (n, r) => `ต่างชาติเริ่มรีทวีตคลิป ${n} แล้ว (${r})`,
  (n, r) => `${n} ฟอร์มแบบนี้ขายแพงได้อีก · ${r}`,
  (n, r) => `กัปตันโดยพฤตินัยคืนนี้: ${n} (${r})`,
]

/** ——— นักเตะตัดพ้อ / งอล ——— */
const PLAYER_SULK: string[] = [
  'บางวันมันก็หนัก… โฟกัสเกมหน้า 🙏',
  'อ่านคอมเมนต์จบแล้ว — พักก่อน',
  'ไม่โอเคกับตัวเองวันนี้ ต้องดีกว่านี้',
  'เงียบๆ ไปก่อน ไว้คุยในสนาม',
  'ทุกคนมีวันที่แย่ วันนี้เป็นของผม',
  'ปิดแจ้งเตือนแล้วครับ 😴',
  'อยากได้การสนับสนุน ไม่ใช่ด่าอย่างเดียว',
  'ผลออกมาแล้ว — รับผิดชอบเต็มที่',
  'อย่าลืมว่าเราเป็นมนุษย์เหมือนกัน',
  'พรุ่งนี้ซ้อมต่อ ไม่มีทางลัด',
  'ตัดพ้อกับตัวเองมากกว่าใคร',
  'โซเชียลวันนี้แรงไปนะ…',
  'ขอเวลาให้ทีมกับตัวเองหน่อย',
  'ไม่สนแบนเทอร์ โฟกัสครอบครัวกับทีม',
  'วันแย่ผ่านไปได้ ถ้าไม่จมกับมัน',
]

/** ——— นักเตะฉลอง / เฟล็ก ——— */
const PLAYER_FLEX: string[] = [
  'สามแต้มสำคัญ 🔥 ขอบคุณแฟนทุกคน',
  'งานเสร็จ — กลับบ้านยิ้มได้',
  'ทีมมาก่อนเสมอ ❤️',
  'Tonight we eat 🍽️',
  'ฟอร์มนี้ต้องรักษาไว้ 💪',
  'เสียงเชียร์ในสนามคือพลัง',
  'Gaffer วางแผนดี เราแค่ทำตาม',
  'คลิปไฮไลต์เดี๋ยวอัป 👀',
  'วันดีๆ แบบนี้เก็บไว้ในใจ',
  'ขอบคุณเพื่อนร่วมทีมที่เชื่อใจ',
  'Still hungry 🚀',
  'เล่นเพื่อเสื้อตัวนี้ทุกนัด',
  'แฟมมิลี่ไว้ใจได้เสมอ',
  'Keep believing ✨',
  'นัดหน้าเอาอีก',
]

/** ——— ตอกกลับแบนเทอร์ ——— */
const PLAYER_CLAPBACK: string[] = [
  'พิมพ์เก่งอยู่นะ — ลงสนามเมื่อไหร่บอก',
  'คอมเมนต์ฟรี แต่ผลงานมีตัวเลข',
  'เก็บพลังไปเชียร์ทีมดีกว่ามานั่งด่า',
  'เห็นแล้วครับ ขอบคุณคำติชม… บางส่วน',
  'เล่นเกมเองก่อนค่อยมาวิจารณ์ยาวๆ',
  'ความเห็นมีค่าเมื่อมาจากคนที่เข้าใจเกม',
  'ปิดแชทแล้ว เจอกันในสนาม',
  'Banter OK — ความเคารพก็สำคัญ',
]

/** ——— เพื่อนร่วมทีมป้องกัน ——— */
const TEAMMATE_DEFEND: Array<(n: string) => string> = [
  (n) => `${n} คือพี่น้องในทีม — อย่าเพิ่งตัด ❤️`,
  (n) => `ทุกคนพลาดได้ รวมถึง ${n} ด้วย เราโตไปด้วยกัน`,
  (n) => `${n} ซ้อมหนักสุดกลุ่มหนึ่ง — เชื่อมือ`,
  (n) => `ด่าคนเดียวไม่ช่วยทีม ดันหลัง ${n} ดีกว่า`,
]

/** ——— มีม / แฟนเพจ ——— */
const MEME_LINES: Array<(n: string) => string> = [
  (n) => `เมื่อเห็น ${n} วันนี้: 🫠🫠🫠`,
  (n) => `POV: คุณคือ ${n} ตอนนาทีที่ 70`,
  (n) => `${n} speedrun any% ทำลายสถิติการหายตัว`,
  (n) => `Chat is this ${n} real?`,
  (n) => `ใหม่: สกิน ${n} "Invisible Mode"`,
]

const AGENT_PR: Array<(n: string) => string> = [
  (n) => `ลูกค้า ${n} โฟกัสพักฟื้นและเกมหน้า — ขอบคุณเสียงเชียร์`,
  (n) => `${n} ขอบคุณแฟนคลับที่สนับสนุนตลอดมา`,
  (n) => `ทีมงานยืนยัน ${n} พร้อมทำงานต่อเพื่อสโมสร`,
]

function postKindLabel(kind: PlayerSocialPostKind): string {
  switch (kind) {
    case 'fan_roast':
      return 'แฟนด่า'
    case 'fan_praise':
      return 'แฟนชม'
    case 'player_sulk':
      return 'ตัดพ้อ'
    case 'player_flex':
      return 'ฉลอง'
    case 'player_clapback':
      return 'ตอกกลับ'
    case 'teammate_defend':
      return 'เพื่อนป้อง'
    case 'meme':
      return 'มีม'
    case 'agent_pr':
      return 'เอเยนต์ PR'
  }
}

function moodFromEvents(
  hadRoast: boolean,
  hadPraise: boolean,
  playerPosted: 'sulk' | 'flex' | 'clapback' | 'quiet',
): PlayerSocialMood {
  if (playerPosted === 'sulk') return 'salty'
  if (playerPosted === 'clapback') return 'tilted'
  if (playerPosted === 'flex') return 'buzzing'
  if (hadRoast && !hadPraise) return 'radio_silent'
  if (hadPraise) return 'buzzing'
  return 'chill'
}

export const SOCIAL_MOOD_LABEL: Record<PlayerSocialMood, string> = {
  buzzing: 'ฟีลดี / โซเชียลร้อนในทางบวก',
  chill: 'ปกติ',
  salty: 'งอล / ตัดพ้อ',
  tilted: 'หงุดหงิด ตอกกลับ',
  radio_silent: 'เงียบ — ปิดแจ้งเตือน',
}

function pushPlayerPost(
  social: Player['social'],
  post: PlayerSocialPost,
): Player['social'] {
  const recent = [post, ...(social.recentPosts ?? [])].slice(0, 12)
  return {
    ...social,
    recentPosts: recent,
    postsWeek: clamp((social.postsWeek ?? 0) + (post.kind.startsWith('player_') ? 1 : 0), 0, 20),
    lastDramaMatchday: post.matchday,
  }
}

type DramaEvent = {
  playerId: string
  media: MediaItem
  mutate: (p: Player) => Player
}

function ratingStr(r: number): string {
  return r.toFixed(1)
}

/**
 * สร้างดราม่าโซเชียลจากผลแมตช์ที่มี playerRatings
 * โฟกัสทีม human + สตาร์ไวรัลจากแมตช์อื่นเล็กน้อย
 */
export function processMatchSocialDrama(
  save: GameSave,
  results: MatchResult[],
): GameSave {
  if (!results.length) return save
  const humanId = save.humanClubId
  const events: DramaEvent[] = []
  const date = save.currentDate
  const md = save.matchday

  for (const result of results) {
    const ratings = result.playerRatings ?? []
    if (!ratings.length) continue
    const fixture = save.fixtures.find((f) => f.id === result.fixtureId)
    if (!fixture) continue
    const humanInMatch =
      fixture.homeClubId === humanId || fixture.awayClubId === humanId
    const momId = result.manOfTheMatchId

    const sorted = [...ratings].sort((a, b) => a.rating - b.rating)
    const worst = sorted.filter((r) => r.minutes >= 45 && r.rating <= 5.8).slice(0, 3)
    const best = [...sorted]
      .reverse()
      .filter((r) => r.minutes >= 45 && r.rating >= 7.8)
      .slice(0, 3)

    const consider = (pr: MatchPlayerRating) => {
      const p = save.players.find((x) => x.id === pr.playerId)
      if (!p) return false
      if (humanInMatch && (p.clubId === humanId || Math.random() < 0.35)) return true
      if (!humanInMatch && p.overall >= 82 && Math.random() < 0.2) return true
      return humanInMatch
    }

    // ——— ด่า ———
    for (const pr of worst) {
      if (!consider(pr)) continue
      const p = save.players.find((x) => x.id === pr.playerId)!
      const roastCount =
        1 +
        (Math.random() < 0.45 ? 1 : 0) +
        (pr.rating <= 5 ? 1 : 0) +
        fameRoastExtra(p, pr.rating)
      for (let i = 0; i < roastCount; i++) {
        const text = pick(FAN_ROAST)(p.name, ratingStr(pr.rating))
        const useAnti = (p.antiFanSize ?? 0) > 8_000 && (p.fame ?? 0) >= 50 && Math.random() < 0.45
        const handle = useAnti ? antiFanHandle(p) : fanHandle()
        const likes = Math.round(
          80 +
            Math.random() * 4000 +
            (100 - (p.mediaHandling ?? 10)) * 30 +
            (p.fame ?? 0) * 40 +
            (useAnti ? (p.antiFanSize ?? 0) * 0.002 : 0),
        )
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-roast'),
            date,
            channel: 'social',
            headline: `${handle} ด่า ${p.name}${useAnti ? ' (แอนตี้)' : ''}${(p.fame ?? 0) >= 70 ? ' · คนดังเฟล' : ''}`,
            body: text,
            tone: 'negative',
            tags: ['fan_roast', p.id, 'match_drama', useAnti ? 'anti_fan' : 'fan'],
            subjectName: p.name,
            outlet: useAnti ? 'แอนตี้เพจ' : 'แฟนเพจ / ไทม์ไลน์',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            const post: PlayerSocialPost = {
              id: uid('pp'),
              date,
              matchday: md,
              kind: 'fan_roast',
              text,
              fromHandle: handle,
              likes,
            }
            const mh = pl.mediaHandling ?? 10
            const thinSkin = mh <= 8 || pl.personalityId === 'temperamental'
            const fameHit = (pl.fame ?? 0) >= 65 ? 1 : 0
            let next = {
              ...pl,
              happiness: clamp((pl.happiness ?? 10) - (thinSkin ? 2 : 1) - fameHit, 1, 20),
              morale: clamp(pl.morale - (thinSkin ? 1 : 0) - (fameHit ? 1 : 0), 1, 20),
              social: {
                ...pushPlayerPost(social, post),
                heat: clamp(social.heat + 6 + (thinSkin ? 4 : 0) + fameHit * 3, 0, 100),
                followers: Math.max(
                  500,
                  Math.round(social.followers * (0.998 - Math.random() * 0.004)),
                ),
                mood: 'salty' as PlayerSocialMood,
              },
            }
            next = applyFameAfterRating(next, pr.rating, pr.minutes)
            return next
          },
        })
      }

      // มีม
      if (Math.random() < 0.4) {
        const text = pick(MEME_LINES)(p.name)
        const handle = fanHandle()
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-meme'),
            date,
            channel: 'social',
            headline: `มีม: ${p.name}`,
            body: text,
            tone: 'rumor',
            tags: ['meme', p.id, 'match_drama'],
            subjectName: p.name,
            outlet: 'มีมเพจ',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            return {
              ...pl,
              social: pushPlayerPost(social, {
                id: uid('pp'),
                date,
                matchday: md,
                kind: 'meme',
                text,
                fromHandle: handle,
                likes: Math.round(200 + Math.random() * 8000),
              }),
            }
          },
        })
      }

      // นักเตะตอบ — ตัดพ้อ / ตอกกลับ / เงียบ
      const mh = p.mediaHandling ?? 10
      const pid = p.personalityId
      let reaction: 'sulk' | 'clapback' | 'quiet' | 'agent' = 'quiet'
      const roll = Math.random()
      if (pid === 'temperamental' || mh <= 7) {
        reaction = roll < 0.45 ? 'clapback' : roll < 0.8 ? 'sulk' : 'quiet'
      } else if (pid === 'model_pro') {
        reaction = roll < 0.35 ? 'sulk' : roll < 0.45 ? 'agent' : 'quiet'
      } else if (pid === 'driven') {
        reaction = roll < 0.4 ? 'sulk' : 'quiet'
      } else if (p.lifestyleOrder === 'media_quiet') {
        reaction = 'quiet'
      } else {
        reaction = roll < 0.3 ? 'sulk' : roll < 0.4 ? 'clapback' : roll < 0.5 ? 'agent' : 'quiet'
      }

      if (reaction === 'sulk') {
        const text = pick(PLAYER_SULK)
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-sulk'),
            date,
            channel: 'social',
            headline: `${p.social?.handle ?? p.name} ตัดพ้อ`,
            body: text,
            tone: 'negative',
            tags: ['player_sulk', p.id, 'match_drama'],
            subjectName: p.name,
            outlet: p.social?.handle ?? 'นักเตะ',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            return {
              ...pl,
              happiness: clamp((pl.happiness ?? 10) - 1, 1, 20),
              social: {
                ...pushPlayerPost(social, {
                  id: uid('pp'),
                  date,
                  matchday: md,
                  kind: 'player_sulk',
                  text,
                  fromHandle: social.handle,
                  likes: Math.round(150 + Math.random() * 5000),
                }),
                mood: 'salty',
                heat: clamp(social.heat + 5, 0, 100),
              },
            }
          },
        })
      } else if (reaction === 'clapback') {
        const text = pick(PLAYER_CLAPBACK)
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-clap'),
            date,
            channel: 'social',
            headline: `${p.name} ตอกกลับ`,
            body: text,
            tone: 'rumor',
            tags: ['player_clapback', p.id, 'match_drama'],
            subjectName: p.name,
            outlet: p.social?.handle ?? 'นักเตะ',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            let next = {
              ...pl,
              social: {
                ...pushPlayerPost(social, {
                  id: uid('pp'),
                  date,
                  matchday: md,
                  kind: 'player_clapback',
                  text,
                  fromHandle: social.handle,
                  likes: Math.round(300 + Math.random() * 9000),
                }),
                mood: 'tilted' as PlayerSocialMood,
                heat: clamp(social.heat + 10, 0, 100),
              },
            }
            // ตอกกลับแรง → ภักดีแฟนอาจสะเทือนนิด / ความสุขตก
            next = {
              ...next,
              happiness: clamp((next.happiness ?? 10) - 1, 1, 20),
            }
            return next
          },
        })
      } else if (reaction === 'agent') {
        const text = pick(AGENT_PR)(p.name)
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-ag'),
            date,
            channel: 'social',
            headline: `เอเยนต์ ${p.name} ออก PR`,
            body: text,
            tone: 'neutral',
            tags: ['agent_pr', p.id, 'match_drama'],
            subjectName: p.name,
            outlet: p.agentName ?? 'เอเยนต์',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            return {
              ...pl,
              social: pushPlayerPost(social, {
                id: uid('pp'),
                date,
                matchday: md,
                kind: 'agent_pr',
                text,
                fromHandle: `@${(p.agentAgency ?? 'Agency').replace(/\s+/g, '').slice(0, 14)}`,
                likes: Math.round(100 + Math.random() * 2000),
              }),
            }
          },
        })
      }

      // เพื่อนป้อง
      if (p.clubId === humanId && Math.random() < 0.35) {
        const mates = save.players.filter(
          (x) => x.clubId === humanId && x.id !== p.id && x.overall >= 70,
        )
        const mate = mates[Math.floor(Math.random() * Math.min(5, mates.length))]
        if (mate) {
          const text = pick(TEAMMATE_DEFEND)(p.name)
          events.push({
            playerId: mate.id,
            media: {
              id: uid('soc-def'),
              date,
              channel: 'social',
              headline: `${mate.name} ป้อง ${p.name}`,
              body: text,
              tone: 'positive',
              tags: ['teammate_defend', p.id, mate.id, 'match_drama'],
              subjectName: mate.name,
              outlet: mate.social?.handle ?? mate.name,
            },
            mutate: (pl) => {
              if (pl.id !== mate.id) return pl
              const social = ensurePlayerSocial(pl).social
              return {
                ...pl,
                social: pushPlayerPost(social, {
                  id: uid('pp'),
                  date,
                  matchday: md,
                  kind: 'teammate_defend',
                  text,
                  fromHandle: social.handle,
                  likes: Math.round(200 + Math.random() * 4000),
                }),
              }
            },
          })
          // ผู้ถูกป้องมีความสุขขึ้นนิด
          events.push({
            playerId: p.id,
            media: {
              id: uid('soc-def2'),
              date,
              channel: 'social',
              headline: `${p.name} ได้รับการสนับสนุน`,
              body: `เพื่อนร่วมทีมออกโรงปกป้องหลังถูกด่า`,
              tone: 'positive',
              tags: ['teammate_defend', p.id, 'match_drama'],
              subjectName: p.name,
            },
            mutate: (pl) => ({
              ...pl,
              happiness: clamp((pl.happiness ?? 10) + 1, 1, 20),
            }),
          })
        }
      }
    }

    // ——— ชม ———
    for (const pr of best) {
      if (!consider(pr)) continue
      const p = save.players.find((x) => x.id === pr.playerId)!
      const isMom = momId === pr.playerId
      const praiseN =
        1 + (isMom ? 1 : 0) + (pr.rating >= 8.5 ? 1 : 0) + famePraiseExtra(p, pr.rating)
      for (let i = 0; i < praiseN; i++) {
        const text = pick(FAN_PRAISE)(p.name, ratingStr(pr.rating))
        const useFc = (p.fanClubSize ?? 0) > 20_000 && Math.random() < 0.5
        const handle = useFc ? fanClubHandle(p) : fanHandle()
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-praise'),
            date,
            channel: 'social',
            headline: `${handle} ชม ${p.name}${isMom ? ' · MOM' : ''}${useFc ? ' · แฟนคลับ' : ''}`,
            body: text,
            tone: 'positive',
            tags: [
              'fan_praise',
              p.id,
              'match_drama',
              ...(isMom ? ['mom'] : []),
              ...(useFc ? ['fan_club'] : []),
            ],
            subjectName: p.name,
            outlet: useFc ? 'แฟนคลับทางการ' : 'ไทม์ไลน์แฟน',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            let next = {
              ...pl,
              happiness: clamp((pl.happiness ?? 10) + 1, 1, 20),
              morale: clamp(pl.morale + (isMom ? 1 : 0), 1, 20),
              social: {
                ...pushPlayerPost(social, {
                  id: uid('pp'),
                  date,
                  matchday: md,
                  kind: 'fan_praise' as const,
                  text,
                  fromHandle: handle,
                  likes: Math.round(
                    200 + Math.random() * 8000 + (pl.fame ?? 0) * 50 + (useFc ? 2000 : 0),
                  ),
                }),
                heat: clamp(social.heat + 3, 0, 100),
                followers: Math.round(social.followers * (1.001 + Math.random() * 0.003)),
                mood: 'buzzing' as PlayerSocialMood,
              },
            }
            next = applyFameAfterRating(next, pr.rating, pr.minutes)
            return next
          },
        })
      }

      // นักเตะโพสฉลอง
      const flexChance =
        p.personalityId === 'temperamental'
          ? 0.55
          : p.personalityId === 'model_pro'
            ? 0.35
            : 0.45
      if (Math.random() < flexChance && p.lifestyleOrder !== 'media_quiet') {
        const text = pick(PLAYER_FLEX)
        events.push({
          playerId: p.id,
          media: {
            id: uid('soc-flex'),
            date,
            channel: 'social',
            headline: `${p.social?.handle ?? p.name} โพสหลังเกม`,
            body: text,
            tone: 'positive',
            tags: ['player_flex', p.id, 'match_drama'],
            subjectName: p.name,
            outlet: p.social?.handle ?? 'นักเตะ',
          },
          mutate: (pl) => {
            const social = ensurePlayerSocial(pl).social
            let nextPl: Player = {
              ...pl,
              happiness: clamp((pl.happiness ?? 10) + 1, 1, 20),
              social: {
                ...pushPlayerPost(social, {
                  id: uid('pp'),
                  date,
                  matchday: md,
                  kind: 'player_flex',
                  text,
                  fromHandle: social.handle,
                  likes: Math.round(400 + Math.random() * 15000),
                }),
                mood: 'buzzing',
                heat: clamp(social.heat + 4, 0, 100),
                followers: Math.round(social.followers * 1.004 + 200),
              },
            }
            if (pl.clubId === humanId) nextPl = bumpClubLoyalty(nextPl, 1)
            return nextPl
          },
        })
      }
    }
  }

  if (!events.length) return save

  // รวม mutate ต่อผู้เล่น (ลำดับเหตุการณ์)
  const byPlayer = new Map<string, Array<(p: Player) => Player>>()
  for (const e of events) {
    const list = byPlayer.get(e.playerId) ?? []
    list.push(e.mutate)
    byPlayer.set(e.playerId, list)
  }

  let players = save.players.map((p) => {
    const fns = byPlayer.get(p.id)
    if (!fns?.length) return p
    return fns.reduce((acc, fn) => fn(acc), p)
  })

  // ตั้ง mood สรุปถ้ามีโพสหลายแบบ
  players = players.map((p) => {
    const posts = p.social?.recentPosts?.filter((x) => x.matchday === md) ?? []
    if (!posts.length) return p
    const hadRoast = posts.some((x) => x.kind === 'fan_roast' || x.kind === 'meme')
    const hadPraise = posts.some((x) => x.kind === 'fan_praise')
    const sulk = posts.some((x) => x.kind === 'player_sulk')
    const flex = posts.some((x) => x.kind === 'player_flex')
    const clap = posts.some((x) => x.kind === 'player_clapback')
    const mood = moodFromEvents(
      hadRoast,
      hadPraise,
      sulk ? 'sulk' : clap ? 'clapback' : flex ? 'flex' : 'quiet',
    )
    return {
      ...p,
      social: { ...ensurePlayerSocial(p).social, ...p.social, mood },
    }
  })

  const media = ensureMediaFeed(save)
  const socialItems = events.map((e) => e.media).slice(0, 28)
  const humanTouched = players.filter(
    (p) =>
      p.clubId === humanId &&
      (p.social?.recentPosts ?? []).some((x) => x.matchday === md),
  )
  const inbox =
    humanTouched.length > 0
      ? [
          {
            id: uid('msg-soc'),
            date,
            title: `โซเชียลหลังเกม · ${humanTouched.length} คนถูกพูดถึง`,
            body: humanTouched
              .slice(0, 6)
              .map((p) => {
                const kinds = [
                  ...new Set(
                    (p.social?.recentPosts ?? [])
                      .filter((x) => x.matchday === md)
                      .map((x) => postKindLabel(x.kind)),
                  ),
                ]
                return `${p.name}: ${kinds.join('/')}`
              })
              .join(' · '),
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40)
      : save.inbox

  return {
    ...save,
    players,
    media: {
      ...media,
      social: [...socialItems, ...media.social].slice(0, 80),
    },
    inbox,
  }
}

export function recentSocialForPlayer(player: Player, limit = 8): PlayerSocialPost[] {
  return (player.social?.recentPosts ?? []).slice(0, limit)
}

export function socialDramaSummaryTh(player: Player): string | null {
  const mood = player.social?.mood
  if (!mood || mood === 'chill') return null
  return SOCIAL_MOOD_LABEL[mood]
}
