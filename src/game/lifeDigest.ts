/**
 * สรุปคิวชีวิตนักเตะใน inbox เดียวต่อแมตช์เดย์
 */
import type { GameSave, InboxMessage } from './types'
import { ensureTalks } from './playerTalks'
import { fameLabelTh } from './playerFame'
import { formatFollowers } from './social'
import { tacticalRoleShort } from './tacticalRoles'

export function pushLifeDigestInbox(save: GameSave): GameSave {
  const humanId = save.humanClubId
  const talks = ensureTalks(save)
  const pending = talks.requests.filter(
    (r) => r.status === 'pending' && r.clubId === humanId,
  )
  const squad = save.players.filter((p) => p.clubId === humanId)
  const wantAway = squad.filter((p) => p.wantAway?.active)
  const training = squad.filter((p) => p.styleTrainTarget).slice(0, 5)
  const stars = squad
    .filter((p) => (p.fame ?? 0) >= 70)
    .sort((a, b) => (b.fame ?? 0) - (a.fame ?? 0))
    .slice(0, 3)

  const bits: string[] = []
  if (pending.length) {
    bits.push(`รอตอบคุย ${pending.length} เรื่อง`)
  }
  if (wantAway.length) {
    bits.push(`อยากย้าย ${wantAway.length} คน`)
  }
  if (training.length) {
    bits.push(
      `ฝึกสไตล์: ${training
        .map((p) => `${p.name.split(' ').pop()}→${tacticalRoleShort(p.styleTrainTarget!)}`)
        .join(', ')}`,
    )
  }
  if (stars.length) {
    bits.push(
      `ดัง: ${stars
        .map(
          (p) =>
            `${p.name.split(' ').pop()} ${p.fame} (${fameLabelTh(p.fame ?? 0)}) · แอนตี้ ${formatFollowers(p.antiFanSize ?? 0)}`,
        )
        .join(' · ')}`,
    )
  }

  if (!bits.length) return save

  const msg: InboxMessage = {
    id: `msg-life-${save.matchday}-${save.season}`,
    date: save.currentDate,
    title: 'สรุปชีวิตนักเตะ',
    body: bits.join(' · '),
    read: false,
  }

  // กันซ้ำในแมตช์เดย์เดียวกัน
  if (save.inbox.some((m) => m.id === msg.id)) return save

  return {
    ...save,
    inbox: [msg, ...save.inbox].slice(0, 40),
  }
}
