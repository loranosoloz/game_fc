import type {
  GameSave,
  MediaItem,
  PressAnswerOption,
  PressConferenceState,
  PressQuestion,
} from './types'
import { adjustManagerReputation, ensureMediaFeed } from './media'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function buildQuestions(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): PressQuestion[] {
  const won = usGoals > themGoals
  const lost = usGoals < themGoals
  const resultQ: PressQuestion = {
    id: 'result',
    prompt: won
      ? `สื่อ: ชนะ ${oppName} ${usGoals}–${themGoals} — คุณพอใจแค่ไหน?`
      : lost
        ? `สื่อ: แพ้ ${oppName} — คุณรับผิดชอบอย่างไร?`
        : `สื่อ: เสมอ ${oppName} — พอใจกับแต้มนี้ไหม?`,
    answers: won
      ? [
          {
            id: 'humble',
            label: 'ชื่นชมทีม — โฟกัสนัดหน้า',
            moraleDelta: 1,
            reputationDelta: 1,
            fansDelta: 1,
            socialHeadline: `${save.managerName} ชื่นชมสควอดหลังชนะ`,
            socialTone: 'positive',
          },
          {
            id: 'boast',
            label: 'เรายังไปได้ไกลกว่านี้',
            boardDelta: 1,
            reputationDelta: 2,
            happinessDelta: -1,
            socialHeadline: `${save.managerName} คุยโวหลังเกม`,
            socialTone: 'neutral',
          },
          {
            id: 'tactical',
            label: 'แผนใช้งานได้ — ปรับรายละเอียด',
            moraleDelta: 1,
            reputationDelta: 1,
          },
        ]
      : lost
        ? [
            {
              id: 'own',
              label: 'รับผิดชอบเต็มๆ — จะแก้ทันที',
              boardDelta: 2,
              reputationDelta: 1,
              fansDelta: 1,
              socialHeadline: `${save.managerName} รับผิดชอบหลังแพ้`,
              socialTone: 'neutral',
            },
            {
              id: 'defend',
              label: 'โชคไม่เข้าข้าง — ทีมเล่นได้',
              boardDelta: -2,
              fansDelta: -2,
              reputationDelta: -1,
              socialHeadline: `ดราม่า: ${save.managerName} โทษโชคหลังแพ้`,
              socialTone: 'negative',
            },
            {
              id: 'squad',
              label: 'บางคนต้องทำได้ดีกว่านี้',
              moraleDelta: -2,
              happinessDelta: -2,
              boardDelta: 1,
              socialHeadline: `${save.managerName} จวกนักเตะหลังเกม`,
              socialTone: 'negative',
            },
          ]
        : [
            {
              id: 'ok',
              label: 'แต้มสำคัญในเส้นทางยาว',
              boardDelta: 1,
              reputationDelta: 1,
            },
            {
              id: 'want_more',
              label: 'ควรได้มากกว่านี้',
              moraleDelta: -1,
              fansDelta: 1,
            },
            {
              id: 'rotate',
              label: 'หมุนเวียนเพื่อเกมใหญ่',
              happinessDelta: -1,
              reputationDelta: 1,
            },
          ],
  }

  const xiQ: PressQuestion = {
    id: 'xi',
    prompt: 'สื่อ: มีเสียงวิจารณ์เรื่ององค์ประกอบ XI — คุณตอบอย่างไร?',
    answers: [
      {
        id: 'trust',
        label: 'เชื่อมั่นในทีมชุดนี้',
        moraleDelta: 1,
        happinessDelta: 1,
      },
      {
        id: 'change',
        label: 'จะปรับเมื่อจำเป็น',
        reputationDelta: 1,
        boardDelta: 1,
      },
      {
        id: 'youth',
        label: 'เปิดโอกาสเด็กอะคาเดมี่',
        fansDelta: 1,
        happinessDelta: 1,
        socialHeadline: `${save.managerName} ย้ำนโยบายเยาวชน`,
        socialTone: 'positive',
      },
    ],
  }

  const marketQ: PressQuestion = {
    id: 'market',
    prompt: 'สื่อ: ตลาดนักเตะ — สโมสรจะเสริมแกร่งไหม?',
    answers: [
      {
        id: 'quiet',
        label: 'พอใจสควอด — ไม่รีบ',
        boardDelta: 1,
        reputationDelta: 1,
      },
      {
        id: 'active',
        label: 'พร้อมเสริมถ้ามีเป้าหมายใช่',
        fansDelta: 1,
        reputationDelta: 1,
        socialHeadline: `วงใน: ${save.managerName} เปิดไฟเขียวตลาด`,
        socialTone: 'rumor',
      },
      {
        id: 'sell',
        label: 'อาจปล่อยคนที่ไม่แฮปปี้',
        happinessDelta: -1,
        boardDelta: 1,
        socialHeadline: `${save.managerName} ไม่ปิดโอกาสขายนักเตะ`,
        socialTone: 'rumor',
      },
    ],
  }

  const talksPending = (save.talks?.requests ?? []).filter(
    (r) => r.status === 'pending' && r.clubId === save.humanClubId,
  ).length
  const injuryCount = save.players.filter(
    (p) => p.clubId === save.humanClubId && p.injuryDays > 0,
  ).length

  const rivalryQ: PressQuestion = {
    id: 'rivalry',
    prompt: `สื่อ: นัดกับ ${oppName} มีความหมายพิเศษ — คุณส่งสารอะไรถึงแฟนบอล?`,
    answers: [
      {
        id: 'respect',
        label: 'เคารพคู่แข่ง — โฟกัสเกมของเรา',
        reputationDelta: 1,
        fansDelta: 1,
      },
      {
        id: 'fire',
        label: 'นี่คือเกมที่ต้องชนะเพื่อแฟน',
        fansDelta: 2,
        boardDelta: 1,
        happinessDelta: -1,
        socialHeadline: `${save.managerName} จุดไฟก่อนดาร์บี้`,
        socialTone: 'positive',
      },
      {
        id: 'calm',
        label: 'ไม่สร้างความกดดันเกินจริง',
        moraleDelta: 1,
        reputationDelta: 1,
      },
    ],
  }

  const injuryQ: PressQuestion = {
    id: 'injury',
    prompt:
      injuryCount > 0
        ? `สื่อ: มี ${injuryCount} คนเจ็บในสควอด — จะเร่งกลับไหม?`
        : 'สื่อ: ภาระงานแน่น — มีแผนพักนักเตะหลักไหม?',
    answers: [
      {
        id: 'careful',
        label: 'สุขภาพมาก่อน — ไม่เร่ง',
        happinessDelta: 1,
        boardDelta: 1,
      },
      {
        id: 'push',
        label: 'ต้องสู้ให้ครบเกมสำคัญ',
        boardDelta: 1,
        moraleDelta: -1,
        reputationDelta: 1,
      },
      {
        id: 'rotate',
        label: 'หมุนเวียนชัดเจนสัปดาห์นี้',
        moraleDelta: 1,
        fansDelta: 1,
      },
    ],
  }

  const dressingQ: PressQuestion = {
    id: 'dressing',
    prompt:
      talksPending > 0
        ? `สื่อ: มีข่าวว่า ${talksPending} คนขอคุยส่วนตัว — บรรยากาศห้องแต่งตัวเป็นอย่างไร?`
        : 'สื่อ: ความสัมพันธ์ในห้องแต่งตัวตอนนี้เป็นอย่างไร?',
    answers: [
      {
        id: 'united',
        label: 'สามัคคี — พร้อมลุยด้วยกัน',
        moraleDelta: 1,
        happinessDelta: 1,
        reputationDelta: 1,
      },
      {
        id: 'honest',
        label: 'มีเรื่องต้องเคลียร์ แต่จัดการได้',
        boardDelta: 1,
        socialHeadline: `${save.managerName} ยอมรับมีประเด็นในทีม`,
        socialTone: 'neutral',
      },
      {
        id: 'deny',
        label: 'ไม่มีปัญหาอะไรทั้งสิ้น',
        reputationDelta: -1,
        fansDelta: -1,
      },
    ],
  }

  const financeQ: PressQuestion = {
    id: 'finance',
    prompt: 'สื่อ: บอร์ดกดดันเรื่องงบ — คุณจะคุมค่าเหนื่อยอย่างไร?',
    answers: [
      {
        id: 'prudent',
        label: 'วินัยการเงินสำคัญเท่าผลงาน',
        boardDelta: 2,
        reputationDelta: 1,
      },
      {
        id: 'invest',
        label: 'ต้องลงทุนเพื่อแข่งขัน',
        fansDelta: 1,
        boardDelta: -1,
      },
      {
        id: 'balance',
        label: 'สมดุลระหว่างอนาคตกับปัจจุบัน',
        boardDelta: 1,
        reputationDelta: 1,
      },
    ],
  }

  // 5 คำถาม: ผลเกม + สุ่ม 4 จากพูล
  const pool = [xiQ, marketQ, rivalryQ, injuryQ, dressingQ, financeQ]
  const picked: PressQuestion[] = [resultQ]
  const rng = Math.abs(
    (usGoals * 17 + themGoals * 31 + save.matchday * 13 + oppName.length) % pool.length,
  )
  for (let i = 0; i < 4; i++) {
    picked.push(pool[(rng + i * 2) % pool.length])
  }
  // unique by id
  const seen = new Set<string>()
  return picked.filter((q) => {
    if (seen.has(q.id)) return false
    seen.add(q.id)
    return true
  }).slice(0, 5)
}

export function createPressConference(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): PressConferenceState {
  const outcome = usGoals > themGoals ? 'ชนะ' : usGoals === themGoals ? 'เสมอ' : 'แพ้'
  return {
    pending: true,
    date: save.currentDate,
    matchSummary: `${outcome} พบ ${oppName} ${usGoals}–${themGoals}`,
    questions: buildQuestions(save, usGoals, themGoals, oppName),
    chosen: [],
  }
}

export function answerPressConference(
  save: GameSave,
  answerIds: string[],
): { save: GameSave; note: string } {
  const conf = save.pressConference
  if (!conf?.pending) return { save, note: 'ไม่มีแถลงข่าวค้าง' }
  if (answerIds.length !== conf.questions.length) {
    return { save, note: 'ต้องตอบครบทุกคำถาม' }
  }

  let next = { ...save }
  const notes: string[] = []
  const media = ensureMediaFeed(next)
  const socialExtra: MediaItem[] = [...media.social]

  conf.questions.forEach((q, i) => {
    const ans = q.answers.find((a) => a.id === answerIds[i])
    if (!ans) return
    next = applyAnswer(next, ans)
    notes.push(ans.label)
    if (ans.socialHeadline) {
      socialExtra.unshift({
        id: uid('social'),
        date: next.currentDate,
        channel: 'social',
        headline: 'Post-match press',
        body: ans.socialHeadline,
        tone: ans.socialTone ?? 'neutral',
        tags: ['press'],
      })
    }
  })

  const humanSquad = next.players.filter((p) => p.clubId === next.humanClubId)
  const avgHandling =
    humanSquad.reduce((s, p) => s + (p.mediaHandling ?? 10), 0) / Math.max(1, humanSquad.length)
  if (avgHandling >= 14) {
    next = {
      ...next,
      players: next.players.map((p) =>
        p.clubId === next.humanClubId ? { ...p, morale: clamp(p.morale + 1, 1, 20) } : p,
      ),
    }
  }

  next = {
    ...next,
    media: { ...media, social: socialExtra.slice(0, 40) },
    pressConference: { ...conf, pending: false, chosen: answerIds },
    inbox: [
      {
        id: `msg-press-${Date.now()}`,
        date: next.currentDate,
        title: 'สรุปแถลงข่าว',
        body: `ตอบสื่อ: ${notes.join(' · ')}`,
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }

  return { save: next, note: 'แถลงข่าวเสร็จ — สื่อจะขยายความบนโซเชียล' }
}

function applyAnswer(save: GameSave, ans: PressAnswerOption): GameSave {
  let next = save
  if (ans.reputationDelta) next = adjustManagerReputation(next, ans.reputationDelta)
  if (ans.boardDelta) {
    next = {
      ...next,
      board: {
        ...next.board,
        confidence: clamp(next.board.confidence + ans.boardDelta, 0, 100),
      },
    }
  }
  if (ans.fansDelta) {
    next = {
      ...next,
      fans: {
        ...next.fans,
        mood: clamp(next.fans.mood + ans.fansDelta, 0, 100),
      },
    }
  }
  if (ans.moraleDelta || ans.happinessDelta) {
    next = {
      ...next,
      players: next.players.map((p) => {
        if (p.clubId !== next.humanClubId) return p
        const handling = p.mediaHandling ?? 10
        const soft = handling >= 14 ? 0.5 : handling <= 6 ? 1.25 : 1
        return {
          ...p,
          morale: clamp(p.morale + (ans.moraleDelta ?? 0) * soft, 1, 20),
          happiness: clamp((p.happiness ?? p.morale) + (ans.happinessDelta ?? 0) * soft, 1, 20),
        }
      }),
    }
  }
  return next
}

export function dismissPressConference(save: GameSave): GameSave {
  if (!save.pressConference?.pending) return save
  return {
    ...adjustManagerReputation(save, -1),
    pressConference: { ...save.pressConference, pending: false, chosen: [] },
  }
}
