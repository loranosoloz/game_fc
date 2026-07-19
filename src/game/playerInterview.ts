import type {
  GameSave,
  MatchResult,
  Player,
  PlayerInterviewState,
  PressAnswerOption,
  PressQuestion,
} from './types'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

function pickStandout(
  save: GameSave,
  result: MatchResult,
): { player: Player; kind: PlayerInterviewState['kind']; blurb: string } | null {
  const human = save.humanClubId
  const xi = new Set(save.tacticsByClub[human]?.startingXi ?? [])
  const squad = save.players.filter((p) => p.clubId === human)
  const byId = new Map(squad.map((p) => [p.id, p]))

  const goals = new Map<string, number>()
  const assists = new Map<string, number>()
  let redId: string | null = null

  for (const e of result.events) {
    if (e.kind === 'goal' && e.clubId === human && e.playerId) {
      goals.set(e.playerId, (goals.get(e.playerId) ?? 0) + 1)
      if (e.assistPlayerId) {
        assists.set(e.assistPlayerId, (assists.get(e.assistPlayerId) ?? 0) + 1)
      }
    }
    if (e.kind === 'card' && e.cardColor === 'red' && e.clubId === human && e.playerId) {
      redId = e.playerId
    }
  }

  if (redId && byId.has(redId)) {
    const p = byId.get(redId)!
    return {
      player: p,
      kind: 'carded',
      blurb: `${p.name} โดนใบแดง — สื่อดึงไปสัมภาษณ์หลังอุโมงค์`,
    }
  }

  const topScorer = [...goals.entries()].sort((a, b) => b[1] - a[1])[0]
  if (topScorer && byId.has(topScorer[0])) {
    const p = byId.get(topScorer[0])!
    return {
      player: p,
      kind: 'scorer',
      blurb: `${p.name} ยิง ${topScorer[1]} ลูก — กล้องวิ่งตามหลังเกม`,
    }
  }

  const usHome = save.fixtures.find((f) => f.id === result.fixtureId)?.homeClubId === human
  const usRating = usHome ? result.homeRating : result.awayRating
  const themRating = usHome ? result.awayRating : result.homeRating
  const usGoals = usHome ? result.homeGoals : result.awayGoals
  const themGoals = usHome ? result.awayGoals : result.homeGoals
  const lost = usGoals < themGoals

  if (lost && usRating + 0.4 < themRating) {
    const flops = squad
      .filter((p) => xi.has(p.id) && p.form <= 9)
      .sort((a, b) => a.form - b.form)
    if (flops[0]) {
      return {
        player: flops[0],
        kind: 'flop',
        blurb: `สื่อจ่อไมค์ ${flops[0].name} หลังเกมที่แฟนไม่พอใจ`,
      }
    }
  }

  const youngHero = squad
    .filter((p) => xi.has(p.id) && (p.isYouth || p.age <= 21) && p.form >= 13)
    .sort((a, b) => b.form - a.form)[0]
  if (youngHero && (usGoals > themGoals || youngHero.form >= 15)) {
    return {
      player: youngHero,
      kind: 'young',
      blurb: `ดาวรุ่ง ${youngHero.name} ถูกดึงไปสัมภาษณ์พิเศษ`,
    }
  }

  const gk = squad.find((p) => xi.has(p.id) && p.role === 'GK' && p.form >= 14)
  if (gk && themGoals <= 1) {
    return {
      player: gk,
      kind: 'keeper',
      blurb: `นายทวาร ${gk.name} ได้ไมค์หลังเกม`,
    }
  }

  const hero = squad
    .filter((p) => xi.has(p.id))
    .sort((a, b) => b.form - a.form || b.overall - a.overall)[0]
  if (hero && (usGoals > themGoals || hero.form >= 14)) {
    return {
      player: hero,
      kind: 'hero',
      blurb: `${hero.name} ถูกยกเป็นผู้เล่นเด่นของเกม`,
    }
  }

  // ~55% chance skip if nothing spicy
  if (Math.random() > 0.55) return null
  const any = squad.filter((p) => xi.has(p.id)).sort((a, b) => b.overall - a.overall)[0]
  if (!any) return null
  return {
    player: any,
    kind: usGoals > themGoals ? 'hero' : 'flop',
    blurb: `สื่อสุ่มจับไมค์ ${any.name} หลังเกม`,
  }
}

function buildInterviewQs(
  save: GameSave,
  player: Player,
  kind: PlayerInterviewState['kind'],
): PressQuestion[] {
  const name = player.name.split(' ').slice(-1)[0] ?? player.name
  const club = save.clubs.find((c) => c.id === save.humanClubId)!

  const pools: Record<PlayerInterviewState['kind'], PressQuestion[]> = {
    scorer: [
      {
        id: 'goal_feel',
        prompt: `สื่อ→${name}: ประตูวันนี้รู้สึกอย่างไร?`,
        answers: [
          {
            id: 'team',
            label: 'ทีมสร้างโอกาส — ผมแค่จบ',
            moraleDelta: 1,
            reputationDelta: 1,
            socialHeadline: `${player.name}: “ทีมสำคัญกว่าประตูผม”`,
            socialTone: 'positive',
          },
          {
            id: 'hungry',
            label: 'อยากได้มากกว่านี้ทุกเกม',
            happinessDelta: 1,
            fansDelta: 1,
            socialHeadline: `${player.name} ยังหิวประตู`,
            socialTone: 'positive',
          },
          {
            id: 'dedicate',
            label: 'มอบให้แฟนที่มาเชียร์',
            fansDelta: 2,
            socialHeadline: `${player.name} มอบประตูให้แฟน ${club.shortName}`,
            socialTone: 'positive',
          },
        ],
      },
      {
        id: 'form',
        prompt: `สื่อ→${name}: ฟอร์มตอนนี้จุดสูงสุดแล้วหรือยัง?`,
        answers: [
          {
            id: 'humble',
            label: 'ยังมีอีกเยอะที่ต้องพัฒนา',
            moraleDelta: 1,
            reputationDelta: 1,
          },
          {
            id: 'confident',
            label: 'ผมอยู่ในจังหวะที่ดีมาก',
            happinessDelta: 1,
            boardDelta: 1,
          },
          {
            id: 'manager',
            label: `โค้ช ${save.managerName} วางบทบาทชัด`,
            reputationDelta: 2,
            socialHeadline: `${player.name} ชื่นชม ${save.managerName}`,
            socialTone: 'positive',
          },
        ],
      },
    ],
    hero: [
      {
        id: 'motm',
        prompt: `สื่อ→${name}: ถูกยกเป็นผู้เล่นเด่น — พูดอะไรกับแฟน?`,
        answers: [
          {
            id: 'thanks',
            label: 'ขอบคุณทุกกำลังใจ',
            fansDelta: 2,
            happinessDelta: 1,
          },
          {
            id: 'next',
            label: 'โฟกัสนัดหน้าทันที',
            moraleDelta: 1,
            reputationDelta: 1,
          },
          {
            id: 'squad',
            label: 'ทั้งสควอดช่วยกัน',
            moraleDelta: 1,
            happinessDelta: 1,
          },
        ],
      },
      {
        id: 'pressure',
        prompt: `สื่อ→${name}: ความกดดันในลีกหนักขึ้นไหม?`,
        answers: [
          {
            id: 'love',
            label: 'กดดันคือส่วนหนึ่งของอาชีพ',
            reputationDelta: 1,
          },
          {
            id: 'block',
            label: 'ผมไม่ฟังโซเชียลมากนัก',
            happinessDelta: 1,
          },
          {
            id: 'win',
            label: 'มีแต่จะชนะเท่านั้นที่สำคัญ',
            fansDelta: 1,
            boardDelta: 1,
          },
        ],
      },
    ],
    young: [
      {
        id: 'debut_feel',
        prompt: `สื่อ→${name}: วัยนี้ได้โอกาสชุดใหญ่ รู้สึกอย่างไร?`,
        answers: [
          {
            id: 'dream',
            label: 'เป็นความฝันตั้งแต่เด็ก',
            fansDelta: 2,
            happinessDelta: 1,
            socialHeadline: `ดาวรุ่ง ${player.name}: “ฝันมาตลอด”`,
            socialTone: 'positive',
          },
          {
            id: 'learn',
            label: 'ยังเรียนจากรุ่นพี่ทุกวัน',
            moraleDelta: 1,
            reputationDelta: 1,
          },
          {
            id: 'ready',
            label: 'พร้อมลงทุกนาทีที่ถูกเรียก',
            boardDelta: 1,
            happinessDelta: 1,
          },
        ],
      },
      {
        id: 'future',
        prompt: `สื่อ→${name}: มองอนาคตกับ ${club.shortName} อย่างไร?`,
        answers: [
          {
            id: 'stay',
            label: 'อยากอยู่ช่วยทีมยาวๆ',
            fansDelta: 1,
            boardDelta: 1,
          },
          {
            id: 'grow',
            label: 'ขอเวลาโตในระบบ',
            moraleDelta: 1,
          },
          {
            id: 'titles',
            label: 'อยากคว้าถ้วยกับสโมสรนี้',
            fansDelta: 2,
            reputationDelta: 1,
          },
        ],
      },
    ],
    flop: [
      {
        id: 'apology',
        prompt: `สื่อ→${name}: แฟนไม่พอใจผลงานวันนี้ — คุณจะพูดอะไร?`,
        answers: [
          {
            id: 'sorry',
            label: 'ขอโทษแฟน — จะดีกว่านี้',
            fansDelta: 2,
            reputationDelta: 1,
            socialHeadline: `${player.name} ขอโทษแฟนหลังเกม`,
            socialTone: 'neutral',
          },
          {
            id: 'fight',
            label: 'ทั้งทีมจะสู้ต่อ ไม่ยอมแพ้',
            moraleDelta: 1,
            boardDelta: 1,
          },
          {
            id: 'deflect',
            label: 'โชคไม่เข้าข้างวันนี้',
            fansDelta: -2,
            reputationDelta: -1,
            socialHeadline: `ดราม่า: ${player.name} โทษโชค`,
            socialTone: 'negative',
          },
        ],
      },
      {
        id: 'fix',
        prompt: `สื่อ→${name}: จะรีบแก้เกมส่วนตัวอย่างไร?`,
        answers: [
          {
            id: 'train',
            label: 'ซ้อมหนักขึ้นทันที',
            moraleDelta: 1,
            happinessDelta: 1,
          },
          {
            id: 'talk',
            label: 'คุยกับโค้ชเพื่อปรับบทบาท',
            reputationDelta: 1,
          },
          {
            id: 'ignore',
            label: 'ไม่คิดมาก — นัดหน้าใหม่',
            happinessDelta: -1,
            fansDelta: -1,
          },
        ],
      },
    ],
    carded: [
      {
        id: 'red',
        prompt: `สื่อ→${name}: ใบแดงวันนี้จำเป็นไหม?`,
        answers: [
          {
            id: 'regret',
            label: 'ผิดพลาดของผม — รับผิดชอบ',
            fansDelta: 1,
            boardDelta: 1,
            reputationDelta: 1,
          },
          {
            id: 'harsh',
            label: 'ใบแรงไปหน่อย',
            fansDelta: -1,
            boardDelta: -1,
          },
          {
            id: 'protect',
            label: 'ปกป้องทีมในจังหวะนั้น',
            moraleDelta: 1,
            happinessDelta: -1,
          },
        ],
      },
      {
        id: 'ban',
        prompt: `สื่อ→${name}: พักโทษแล้วจะกลับมาอย่างไร?`,
        answers: [
          {
            id: 'ready',
            label: 'พร้อมช่วยทีมทันทีที่กลับ',
            moraleDelta: 1,
          },
          {
            id: 'watch',
            label: 'จะเชียร์เพื่อนจากอัฒจันทร์',
            fansDelta: 1,
            happinessDelta: 1,
          },
          {
            id: 'angry',
            label: 'โมโหมาก — แต่ควบคุมได้',
            reputationDelta: -1,
          },
        ],
      },
    ],
    keeper: [
      {
        id: 'saves',
        prompt: `สื่อ→${name}: วันนี้เซฟสำคัญหลายครั้ง?`,
        answers: [
          {
            id: 'wall',
            label: 'หน้าที่นายทวารคือกันประตู',
            reputationDelta: 1,
            fansDelta: 1,
          },
          {
            id: 'defense',
            label: 'แนวรับช่วยเหลือดีมาก',
            moraleDelta: 1,
            happinessDelta: 1,
          },
          {
            id: 'focus',
            label: 'โฟกัสทุกลูกเหมือนลูกสุดท้าย',
            boardDelta: 1,
          },
        ],
      },
      {
        id: 'clean',
        prompt: `สื่อ→${name}: เป้าหมายคลีนชีตฤดูกาลนี้?`,
        answers: [
          {
            id: 'yes',
            label: 'อยากทำสถิติให้แฟนภูมิใจ',
            fansDelta: 2,
          },
          {
            id: 'team',
            label: 'คลีนชีตเป็นของทั้งทีม',
            moraleDelta: 1,
          },
          {
            id: 'one_game',
            label: 'ทีละเกมก่อน',
            reputationDelta: 1,
          },
        ],
      },
    ],
  }

  return pools[kind]
}

export function maybeCreatePlayerInterview(
  save: GameSave,
  result: MatchResult,
): PlayerInterviewState | null {
  const pick = pickStandout(save, result)
  if (!pick) return null
  return {
    pending: true,
    date: save.currentDate,
    playerId: pick.player.id,
    playerName: pick.player.name,
    kind: pick.kind,
    blurb: pick.blurb,
    questions: buildInterviewQs(save, pick.player, pick.kind),
    chosen: [],
  }
}

export function answerPlayerInterview(
  save: GameSave,
  answerIds: string[],
): { save: GameSave; note: string } {
  const iv = save.playerInterview
  if (!iv?.pending) return { save, note: 'ไม่มีสัมภาษณ์ค้าง' }
  if (answerIds.length !== iv.questions.length) {
    return { save, note: 'ต้องตอบครบทุกคำถาม' }
  }

  let next = { ...save }
  const notes: string[] = []
  const socialExtra = [...(next.media?.social ?? [])]

  iv.questions.forEach((q, i) => {
    const ans = q.answers.find((a) => a.id === answerIds[i]) as PressAnswerOption | undefined
    if (!ans) return
    notes.push(ans.label)
    next = applyPlayerAnswer(next, iv.playerId, ans)
    if (ans.socialHeadline) {
      socialExtra.unshift({
        id: `social-iv-${Date.now()}-${i}`,
        date: next.currentDate,
        channel: 'social',
        headline: `สัมภาษณ์ · ${iv.playerName}`,
        body: ans.socialHeadline,
        tone: ans.socialTone ?? 'neutral',
        tags: ['interview', iv.playerId],
        subjectName: iv.playerName,
      })
    }
  })

  next = {
    ...next,
    media: next.media
      ? { ...next.media, social: socialExtra.slice(0, 50) }
      : next.media,
    playerInterview: { ...iv, pending: false, chosen: answerIds },
    inbox: [
      {
        id: `msg-iv-${Date.now()}`,
        date: next.currentDate,
        title: `สัมภาษณ์ ${iv.playerName}`,
        body: notes.join(' · '),
        read: false,
      },
      ...next.inbox,
    ].slice(0, 40),
  }

  return { save: next, note: `สัมภาษณ์ ${iv.playerName} เสร็จ` }
}

export function dismissPlayerInterview(save: GameSave): GameSave {
  if (!save.playerInterview?.pending) return save
  return {
    ...save,
    playerInterview: { ...save.playerInterview, pending: false, chosen: [] },
    players: save.players.map((p) =>
      p.id === save.playerInterview!.playerId
        ? { ...p, happiness: clamp((p.happiness ?? p.morale) - 1, 1, 20) }
        : p,
    ),
  }
}

function applyPlayerAnswer(
  save: GameSave,
  playerId: string,
  ans: PressAnswerOption,
): GameSave {
  let next = save
  if (ans.reputationDelta) {
    next = {
      ...next,
      managerReputation: clamp(
        (next.managerReputation ?? 50) + ans.reputationDelta,
        0,
        100,
      ),
    }
  }
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
  next = {
    ...next,
    players: next.players.map((p) => {
      if (p.id !== playerId) {
        // light squad ripple from morale answers
        if (!ans.moraleDelta) return p
        if (p.clubId !== next.humanClubId) return p
        return {
          ...p,
          morale: clamp(p.morale + Math.sign(ans.moraleDelta) * 0.25, 1, 20),
        }
      }
      return {
        ...p,
        morale: clamp(p.morale + (ans.moraleDelta ?? 0), 1, 20),
        happiness: clamp(
          (p.happiness ?? p.morale) + (ans.happinessDelta ?? 0),
          1,
          20,
        ),
      }
    }),
  }
  return next
}
