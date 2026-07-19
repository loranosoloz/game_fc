import type {
  GameSave,
  MediaItem,
  PressAnswerOption,
  PressConferenceState,
} from './types'
import { adjustManagerReputation, ensureMediaFeed } from './media'
import { buildPressContext, pickPressQuestions, pressPoolStats } from './pressPool'

function uid(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export { pressPoolStats }

export function createPressConference(
  save: GameSave,
  usGoals: number,
  themGoals: number,
  oppName: string,
): PressConferenceState {
  const outcome = usGoals > themGoals ? 'ชนะ' : usGoals === themGoals ? 'เสมอ' : 'แพ้'
  const ctx = buildPressContext(save, usGoals, themGoals, oppName)
  return {
    pending: true,
    date: save.currentDate,
    matchSummary: `${outcome} พบ ${oppName} ${usGoals}–${themGoals}`,
    questions: pickPressQuestions(save, ctx),
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
        outlet: q.prompt.split(':')[0],
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
    media: { ...media, social: socialExtra.slice(0, 50) },
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
