import type { BoardState, BoardUltimatum, GameSave, PlayStyle, TableRow, VisionKpi } from './types'
import { ensureOwner } from './owner'

function sortedTable(table: TableRow[]) {
  return table.slice().sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    const gdA = a.gf - a.ga
    const gdB = b.gf - b.ga
    if (gdB !== gdA) return gdB - gdA
    return b.gf - a.gf
  })
}

function clamp(n: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(n)))
}

export function createBoardState(reputation: number): BoardState {
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
    lowConfidenceStreak: 0,
    ultimatum: null,
    sacked: false,
    sackedNote: null,
    lastBudgetRequestMatchday: -99,
    transferFreezeUntil: -1,
    lastStadiumVisitMatchday: -99,
    publicSupport: false,
  }
}

export function ensureBoard(save: GameSave): BoardState {
  const b = save.board
  if (!b) return createBoardState(50)
  return {
    ...createBoardState(50),
    ...b,
    lowConfidenceStreak: b.lowConfidenceStreak ?? 0,
    ultimatum: b.ultimatum ?? null,
    sacked: b.sacked ?? false,
    sackedNote: b.sackedNote ?? null,
    lastBudgetRequestMatchday: b.lastBudgetRequestMatchday ?? -99,
    transferFreezeUntil: b.transferFreezeUntil ?? -1,
    lastStadiumVisitMatchday: b.lastStadiumVisitMatchday ?? -99,
    publicSupport: b.publicSupport ?? false,
    kpis: b.kpis?.length ? b.kpis : createBoardState(50).kpis,
  }
}

export function refreshVisionKpis(save: GameSave): BoardState {
  const board = ensureBoard(save)
  const humanClub = save.clubs.find((c) => c.id === save.humanClubId)
  const useDiv2 = humanClub?.division === 2
  const table = sortedTable(useDiv2 ? save.tableDiv2 ?? save.table : save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1 || 20
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const tactics = save.tacticsByClub[save.humanClubId]
  const styleMatch = tactics.instructions.style === board.preferredStyle ? 1 : 0
  const youthMins = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .reduce((s, p) => s + p.minutesPlayed, 0)

  const targetRank = useDiv2 ? Math.min(board.targetMaxRank, 6) : board.targetMaxRank

  const kpis = board.kpis.map((k) => {
    if (k.id === 'league_rank') {
      return {
        ...k,
        label: useDiv2 ? `ติดท็อป ${targetRank} (เลื่อนชั้น)` : k.label,
        target: targetRank,
        current: rank,
        met: rank <= targetRank && rank > 0,
      }
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

export function applyMatchToBoard(
  save: GameSave,
  usGoals: number,
  themGoals: number,
): BoardState {
  let board = refreshVisionKpis(save)
  const table = sortedTable(save.table)
  const humanClub = save.clubs.find((c) => c.id === save.humanClubId)
  const rankTable =
    humanClub?.division === 2 ? sortedTable(save.tableDiv2 ?? save.table) : table
  const rank = rankTable.findIndex((r) => r.clubId === save.humanClubId) + 1 || 20
  const won = usGoals > themGoals
  const drawn = usGoals === themGoals
  const owner = ensureOwner(save)

  let delta = won ? 3 : drawn ? 0 : -4
  const target = humanClub?.division === 2 ? Math.min(board.targetMaxRank, 6) : board.targetMaxRank
  if (rank <= target) delta += 1
  else if (rank >= target + 5) delta -= 2

  const kpiBonus = board.kpis.filter((k) => k.met).length
  delta += Math.floor(kpiBonus / 2) - 1

  // เจ้าของมีผลต่อความเร็วของ confidence
  if (owner.personality === 'ambitious' && !won) delta -= 1
  if (owner.personality === 'patient' && !won) delta += 1

  const confidence = clamp(board.confidence + delta)
  let lowConfidenceStreak = confidence < 40 ? board.lowConfidenceStreak + 1 : 0
  let lastNote = board.lastNote
  if (confidence >= 75) lastNote = `บอร์ดพอใจ — อันดับ #${rank} · KPI ผ่าน ${kpiBonus}/4`
  else if (confidence <= 35)
    lastNote = `บอร์ดกดดันหนัก — อันดับ #${rank} ต่ำกว่าเป้าท็อป ${board.targetMaxRank}`
  else if (won) lastNote = `ผลชนะช่วยพยุงความมั่นใจบอร์ด (อันดับ #${rank})`
  else if (!drawn) lastNote = `ผลแพ้ฉุดความมั่นใจบอร์ด (อันดับ #${rank})`

  let ultimatum = board.ultimatum
  if (ultimatum) {
    const winsSoFar = won ? ultimatum.winsSoFar + 1 : ultimatum.winsSoFar
    ultimatum = { ...ultimatum, winsSoFar }
    if (winsSoFar >= ultimatum.winsNeeded) {
      lastNote = 'ผ่านคำขาดของบอร์ด — ความมั่นใจดีขึ้น'
      return {
        ...board,
        confidence: clamp(confidence + 8),
        lastNote,
        lowConfidenceStreak: 0,
        ultimatum: null,
      }
    }
  }

  return {
    ...board,
    confidence,
    lastNote,
    lowConfidenceStreak,
    ultimatum,
  }
}

/** ตรวจคำขาด / ไล่โค้ช / takeover heat */
export function processBoardPolitics(save: GameSave): GameSave {
  let board = ensureBoard(save)
  if (board.sacked) return { ...save, board }
  const owner = ensureOwner(save)
  let inbox = save.inbox
  let ownerNext = owner

  // ออกคำขาดเมื่อ confidence ต่ำนาน
  const thresh = owner.personality === 'patient' ? 5 : owner.personality === 'ambitious' ? 2 : 3
  if (
    !board.ultimatum &&
    board.lowConfidenceStreak >= thresh &&
    board.confidence < 38
  ) {
    const ultimatum: BoardUltimatum = {
      issuedMatchday: save.matchday,
      deadlineMatchday: save.matchday + 3,
      kind: 'win_streak',
      note: 'บอร์ดออกคำขาด: ต้องชนะอย่างน้อย 2 จาก 3 นัดถัดไป',
      winsNeeded: 2,
      winsSoFar: 0,
    }
    board = {
      ...board,
      ultimatum,
      lastNote: ultimatum.note,
    }
    inbox = [
      {
        id: `msg-ulti-${Date.now()}`,
        date: save.currentDate,
        title: 'คำขาดจากบอร์ด',
        body: ultimatum.note,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  // พ้นกำหนดคำขาด → ไล่
  if (board.ultimatum && save.matchday > board.ultimatum.deadlineMatchday) {
    if (board.ultimatum.winsSoFar < board.ultimatum.winsNeeded) {
      const sackedNote = `${owner.name} และบอร์ดมีมติปลดคุณ — ไม่ผ่านคำขาด`
      board = {
        ...board,
        sacked: true,
        sackedNote,
        confidence: 0,
        lastNote: sackedNote,
        ultimatum: null,
      }
      inbox = [
        {
          id: `msg-sack-${Date.now()}`,
          date: save.currentDate,
          title: 'คุณถูกปลด',
          body: sackedNote,
          read: false,
        },
        ...inbox,
      ].slice(0, 40)
    } else {
      board = { ...board, ultimatum: null, lowConfidenceStreak: 0 }
    }
  }

  // sack ฉุกเฉินถ้า confidence ต่ำมาก + owner ไม่อดทน
  if (
    !board.sacked &&
    board.confidence <= 18 &&
    board.lowConfidenceStreak >= (owner.personality === 'patient' ? 6 : 3) &&
    owner.relationship < 35
  ) {
    const sackedNote = `วิกฤตความเชื่อมั่น — ${owner.name} สั่งปลดผู้จัดการ`
    board = {
      ...board,
      sacked: true,
      sackedNote,
      confidence: 0,
      lastNote: sackedNote,
      ultimatum: null,
    }
    inbox = [
      {
        id: `msg-sack-${Date.now()}`,
        date: save.currentDate,
        title: 'คุณถูกปลด',
        body: sackedNote,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  // takeover rumor
  if (!board.sacked && owner.takeoverHeat >= 75 && Math.random() < 0.25) {
    ownerNext = {
      ...owner,
      takeoverHeat: clamp(owner.takeoverHeat - 20),
      lastNote: 'มีข่าวลือเทคโอเวอร์ — เจ้าของยืนยันยังคุมคลับ',
      warChest: Math.round(owner.warChest * 1.15),
    }
    inbox = [
      {
        id: `msg-takeover-${Date.now()}`,
        date: save.currentDate,
        title: 'ข่าวลือเทคโอเวอร์',
        body: ownerNext.lastNote,
        read: false,
      },
      ...inbox,
    ].slice(0, 40)
  }

  return { ...save, board, owner: ownerNext, inbox }
}

export function boardLabel(confidence: number): string {
  if (confidence >= 75) return 'มั่นใจสูง'
  if (confidence >= 55) return 'พอใจ'
  if (confidence >= 40) return 'กังวล'
  return 'วิกฤต'
}
