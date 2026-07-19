import type { GameSave, PlayStyle, TableRow, VisionKpi } from './types'

function sortedTable(table: TableRow[]) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

export function createBoardState(reputation: number) {
  const targetMaxRank = reputation >= 70 ? 6 : reputation >= 60 ? 10 : reputation >= 52 ? 14 : 18
  const preferredStyle: PlayStyle =
    reputation >= 70 ? 'possession' : reputation <= 52 ? 'counter' : 'balanced'
  const youthMinutesTarget = reputation >= 65 ? 450 : 900
  const kpis: VisionKpi[] = [
    {
      id: 'league_rank',
      label: `ติดท็อป ${targetMaxRank}`,
      target: targetMaxRank,
      current: 20,
      met: false,
    },
    {
      id: 'style',
      label: `เล่นสไตล์ ${preferredStyle}`,
      target: 1,
      current: 0,
      met: false,
    },
    {
      id: 'youth',
      label: `นาทีเยาวชน ≥ ${youthMinutesTarget}`,
      target: youthMinutesTarget,
      current: 0,
      met: false,
    },
    {
      id: 'finance',
      label: 'งบไม่ติดลบ',
      target: 0,
      current: 0,
      met: true,
    },
  ]
  return {
    confidence: 62,
    targetMaxRank,
    lastNote: `บอร์ดตั้งเป้าติดท็อป ${targetMaxRank} · สไตล์ ${preferredStyle}`,
    preferredStyle,
    youthMinutesTarget,
    kpis,
  }
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function refreshVisionKpis(save: GameSave) {
  const board = save.board
  const table = sortedTable(save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1 || 20
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const tactics = save.tacticsByClub[save.humanClubId]
  const styleMatch = tactics.instructions.style === board.preferredStyle ? 1 : 0
  const youthMins = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .reduce((s, p) => s + p.minutesPlayed, 0)

  const kpis = board.kpis.map((k) => {
    if (k.id === 'league_rank') {
      return { ...k, current: rank, met: rank <= board.targetMaxRank && rank > 0 }
    }
    if (k.id === 'style') {
      return { ...k, current: styleMatch, met: styleMatch === 1 }
    }
    if (k.id === 'youth') {
      return {
        ...k,
        current: youthMins,
        met: youthMins >= board.youthMinutesTarget,
      }
    }
    if (k.id === 'finance') {
      return { ...k, current: human.balance, met: human.balance >= 0 }
    }
    return k
  })

  return { ...board, kpis }
}

export function applyMatchToBoard(save: GameSave, usGoals: number, themGoals: number) {
  const board = refreshVisionKpis(save)
  const table = sortedTable(save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1 || 20
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals

  let delta = won ? 3 : drawn ? 0 : -4
  if (rank <= board.targetMaxRank) delta += 1
  else if (rank >= board.targetMaxRank + 5) delta -= 2

  const kpiBonus = board.kpis.filter((k) => k.met).length
  delta += Math.floor(kpiBonus / 2) - 1

  const confidence = clamp(board.confidence + delta)
  let lastNote = board.lastNote
  if (confidence >= 75) lastNote = `บอร์ดพอใจ — อันดับ #${rank} · KPI ผ่าน ${kpiBonus}/4`
  else if (confidence <= 35)
    lastNote = `บอร์ดกดดันหนัก — อันดับ #${rank} ต่ำกว่าเป้าท็อป ${board.targetMaxRank}`
  else if (won) lastNote = `ผลชนะช่วยพยุงความมั่นใจบอร์ด (อันดับ #${rank})`
  else if (!drawn) lastNote = `ผลแพ้ฉุดความมั่นใจบอร์ด (อันดับ #${rank})`

  return { ...board, confidence, lastNote }
}

export function boardLabel(confidence: number): string {
  if (confidence >= 75) return 'มั่นใจสูง'
  if (confidence >= 55) return 'พอใจ'
  if (confidence >= 40) return 'กังวล'
  return 'วิกฤต'
}
