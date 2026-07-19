import type { RoleCode } from '@/game/types'
import type { StarDef } from './leaguesCore'

type YouthRow = {
  name: string
  role: string
  age: number
  ovr: number
  youthGroup?: StarDef['youthGroup']
  isYouth?: boolean
}

type PackWithYouth = { youth?: Record<string, YouthRow[]> }

/** Youth / wonderkids roster for a club from pack JSON `youth` key */
export function youthRosterFromPack(pack: PackWithYouth, clubKey: string): StarDef[] {
  const rows = pack.youth?.[clubKey]
  if (!rows?.length) return []
  return rows.map((r) => ({
    name: r.name,
    role: r.role as RoleCode,
    age: r.age,
    ovr: r.ovr,
    isYouth: true,
    youthGroup: r.youthGroup,
  }))
}
