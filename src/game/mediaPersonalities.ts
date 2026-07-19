import personalitiesDb from '@/data/mediaPersonalities.json'
import type { GameSave } from './types'
import { leagueIdOfSave } from './mediaOutlets'

export type MediaPersonalityRole = 'commentator' | 'analyst' | 'studio_host'

export interface MediaPersonality {
  id: string
  name: string
  nameEn: string
  role: MediaPersonalityRole
  roleTh: string
  legendClubKey: string
  legendClubName: string
  bioTh: string
  leagueIds: string[]
}

const ALL = personalitiesDb.personalities as MediaPersonality[]

export function allMediaPersonalities(): MediaPersonality[] {
  return ALL
}

/** ตำนานของสโมสรหนึ่งทีม */
export function personalitiesForClub(clubKey: string | null | undefined): MediaPersonality[] {
  if (!clubKey) return []
  return ALL.filter((p) => p.legendClubKey === clubKey)
}

/** ตำนานที่ผูกกับลีกของเซฟ (fallback เป็นพูลรวม) */
export function personalitiesForLeague(leagueId: string): MediaPersonality[] {
  const local = ALL.filter((p) => p.leagueIds.includes(leagueId))
  return local.length > 0 ? local : ALL
}

/** เลือกตำนาน — เน้นสโมสรผู้เล่นถ้ามีพูลพอ */
export function pickPersonality(save: GameSave, salt = 0): MediaPersonality {
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const clubPool = personalitiesForClub(club?.crestKey)
  const leaguePool = personalitiesForLeague(leagueIdOfSave(save))
  // ~60% จากตำนานสโมสรตัวเอง ถ้ามี ≥3 คน
  const useClub = clubPool.length >= 3 && Math.abs(save.matchday + salt) % 5 < 3
  const list = useClub ? clubPool : leaguePool.length ? leaguePool : ALL
  const i = Math.abs(save.matchday * 19 + save.season * 7 + salt) % list.length
  return list[i]!
}

/** เครดิตสั้นสำหรับใส่ในข่าว/ทอล์คโชว์ */
export function formatPersonalityCredit(p: MediaPersonality): string {
  return `${p.name} (${p.roleTh} · ตำนาน ${p.legendClubName})`
}

/** ประโยคนำวิเคราะห์ — แทน “นักวิเคราะห์” 匿名 */
export function personalitySays(p: MediaPersonality, quote: string): string {
  return `${formatPersonalityCredit(p)} กล่าวว่า ${quote}`
}
