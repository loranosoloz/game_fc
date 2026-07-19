import type { GameSave, OwnerPersonality, OwnerState } from './types'

const OWNER_NAMES = [
  'ธนา พิทักษ์กิจ',
  'สมชาย โชคดีกรุ๊ป',
  'วิไล รัตนโฮลดิ้ง',
  'James Harrington',
  'Elena Vargas',
  'Klaus Bergmann',
  'Marco Bellini',
  'สุรชัย ศรีเจริญ',
]

const PERSONALITIES: OwnerPersonality[] = [
  'ambitious',
  'patient',
  'frugal',
  'meddling',
  'glory_hunter',
  'local_hero',
]

export const OWNER_PERSONALITY_LABEL: Record<OwnerPersonality, string> = {
  ambitious: 'ทะเยอทะยาน',
  patient: 'อดทน',
  frugal: 'ประหยัด',
  meddling: 'ชอบแทรกแซง',
  glory_hunter: 'ล่าเกียรติยศ',
  local_hero: 'รักถิ่น',
}

export const OWNER_PERSONALITY_DESC: Record<OwnerPersonality, string> = {
  ambitious: 'ต้องการอันดับสูง — แพ้บ่อยจะกดดันเร็ว',
  patient: 'ให้อเวลาสร้างทีม — sack ช้ากว่าปกติ',
  frugal: 'ระวังเงิน — ของบยาก แต่ FFP สำคัญ',
  meddling: 'แทรกแซงตลาด/แท็กติกบ่อย',
  glory_hunter: 'อยากได้ถ้วย — ตกรอบถ้วยฉุดความสัมพันธ์',
  local_hero: 'รักแฟนท้องถิ่น — มู้ดแฟนกระทบเจ้าของแรง',
}

function clamp(n: number, lo = 0, hi = 100) {
  return Math.max(lo, Math.min(hi, Math.round(n)))
}

export function createOwnerState(clubRep: number, seed = Date.now()): OwnerState {
  const rng = ((seed * 9301 + 49297) % 233280) / 233280
  const personality = PERSONALITIES[Math.floor(rng * PERSONALITIES.length)]
  const name = OWNER_NAMES[Math.floor((seed * 7 + rng * 11) % OWNER_NAMES.length)]
  return {
    name,
    personality,
    patience: personality === 'patient' ? 72 : personality === 'ambitious' ? 45 : 58,
    relationship: clamp(55 + Math.round(clubRep / 10)),
    warChest: Math.round(5_000_000 + clubRep * 200_000 + rng * 8_000_000),
    lastNote: `${name} (${OWNER_PERSONALITY_LABEL[personality]}) — ${OWNER_PERSONALITY_DESC[personality]}`,
    takeoverHeat: personality === 'frugal' && clubRep < 55 ? 18 : 8,
  }
}

export function ensureOwner(save: GameSave): OwnerState {
  if (save.owner?.name) return save.owner
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  return createOwnerState(club?.reputation ?? 50, save.season * 100 + save.matchday)
}

/** หลังแมตช์ — เจ้าของตอบสนองผลงาน/แฟน/งบ */
export function applyMatchToOwner(
  save: GameSave,
  usGoals: number,
  themGoals: number,
): OwnerState {
  const owner = ensureOwner(save)
  const fans = save.fans
  const board = save.board
  const won = usGoals > themGoals
  const lost = usGoals < themGoals
  let rel = 0
  let patience = 0
  let heat = 0
  let note = owner.lastNote

  if (won) {
    rel = 2
    patience = 1
    note = `${owner.name} พอใจผลชนะ`
  } else if (lost) {
    rel = owner.personality === 'patient' ? -1 : -3
    patience = owner.personality === 'ambitious' ? -3 : -1
    note = `${owner.name} ไม่พอใจผลแพ้`
  }

  if (owner.personality === 'local_hero' && fans.mood < 40) {
    rel -= 2
    note = `${owner.name} กังวลเสียงแฟนท้องถิ่น`
  }
  if (owner.personality === 'glory_hunter' && save.cup.eliminated.includes(save.humanClubId)) {
    rel -= 1
  }
  if (owner.personality === 'frugal' && board.kpis?.some((k) => k.id === 'finance' && !k.met)) {
    rel -= 2
    patience -= 1
  }
  if (owner.personality === 'meddling' && Math.random() < 0.18) {
    note = `${owner.name} ส่งข้อความแทรกแซงเรื่องตลาด/XI`
    rel -= 1
  }

  if (board.confidence < 35) heat += 4
  if (fans.mood < 30) heat += 3
  if (won && board.confidence > 70) heat -= 2

  return {
    ...owner,
    relationship: clamp(owner.relationship + rel),
    patience: clamp(owner.patience + patience),
    takeoverHeat: clamp(owner.takeoverHeat + heat),
    lastNote: note,
  }
}

/** ของบจากเจ้าของ/บอร์ด — อัปเดต save เสมอ */
export function requestClubBudget(
  save: GameSave,
  amount: number,
): { ok: boolean; save: GameSave; message: string } {
  const owner = ensureOwner(save)
  const board = save.board
  if (board.sacked) return { ok: false, save, message: 'คุณถูกปลดแล้ว — ไม่สามารถของบ' }
  if (save.matchday - (board.lastBudgetRequestMatchday ?? -99) < 4) {
    return { ok: false, save, message: 'เพิ่งขอไป — รออย่างน้อย 4 แมตช์เดย์' }
  }
  if (amount <= 0 || amount > owner.warChest) {
    return {
      ok: false,
      save,
      message: `ขอได้ไม่เกิน war chest ฿${owner.warChest.toLocaleString('th-TH')}`,
    }
  }

  let chance = 0.35 + owner.relationship / 200 + board.confidence / 300
  if (owner.personality === 'frugal') chance -= 0.22
  if (owner.personality === 'ambitious' || owner.personality === 'glory_hunter') chance += 0.12
  if (owner.personality === 'patient') chance += 0.05
  if (board.confidence < 40) chance -= 0.15

  const approved = Math.random() <= Math.min(0.88, Math.max(0.08, chance))
  const nextBoard = {
    ...board,
    lastBudgetRequestMatchday: save.matchday,
  }

  if (!approved) {
    return {
      ok: false,
      save: {
        ...save,
        board: nextBoard,
        owner: {
          ...owner,
          relationship: clamp(owner.relationship - 4),
          lastNote: `${owner.name} ปฏิเสธของบ ฿${amount.toLocaleString('th-TH')}`,
        },
        inbox: [
          {
            id: `msg-budget-${Date.now()}`,
            date: save.currentDate,
            title: 'บอร์ดปฏิเสธของบ',
            body: `${owner.name} ไม่เห็นด้วยกับคำขอ ฿${amount.toLocaleString('th-TH')}`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
      message: `${owner.name} ปฏิเสธของบ`,
    }
  }

  const clubs = save.clubs.map((c) =>
    c.id === save.humanClubId
      ? {
          ...c,
          balance: c.balance + amount,
          wageBudgetWeekly: Math.round(c.wageBudgetWeekly * 1.02),
        }
      : c,
  )

  return {
    ok: true,
    save: {
      ...save,
      clubs,
      board: {
        ...nextBoard,
        confidence: clamp(board.confidence + 2),
        lastNote: `บอร์ดอนุมัติฉีดเงิน ฿${amount.toLocaleString('th-TH')}`,
      },
      owner: {
        ...owner,
        warChest: Math.max(0, owner.warChest - amount),
        relationship: clamp(owner.relationship + 3),
        lastNote: `${owner.name} อนุมัติงบเพิ่มจาก war chest`,
      },
      inbox: [
        {
          id: `msg-budget-${Date.now()}`,
          date: save.currentDate,
          title: 'ฉีดเงินจากเจ้าของ',
          body: `ได้รับ ฿${amount.toLocaleString('th-TH')} จาก ${owner.name}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
    message: `ได้งบ ฿${amount.toLocaleString('th-TH')} จาก ${owner.name}`,
  }
}
