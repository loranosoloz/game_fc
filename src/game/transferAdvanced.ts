/**
 * Advanced transfer subsystems: Bosman, buy-back, ROFR, transfer list,
 * mutual termination, wage rises, pre-contracts, agent lockout, squad status.
 */
import type {
  FeePaymentPreset,
  GameSave,
  LoanDeal,
  Player,
  SquadStatusGuarantee,
  TransferAddonPackage,
  TransferDeskState,
} from './types'
import { formatMoney } from '@/lib/format'
import { ensureClubFinance } from './playerEconomy'
import { autoPickTactics } from './seed'
import { injuryHistoryPenalty } from './medical'
import { rollingFormMarketMul, formWindowAvg } from './contractLifecycle'
import {
  affinityWageMul,
  hasHandshakeWith,
  withEnsuredAffinity,
} from './playerAmbition'

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 5)}`
}

/** หลีกเลี่ยง circular import กับ transfer.ts */
function negotiationFormHeatMul(player: Player): number {
  const f = Math.min(20, Math.max(1, formWindowAvg(player, 4)))
  let m = 0.94 + (f / 20) * 0.16
  const h = Math.min(20, Math.max(0, player.marketHeat ?? 0))
  if (h >= 12) m *= 1.04
  else if (h >= 7) m *= 1.02
  return Math.round(m * 1000) / 1000
}

function rawMarketValue(player: Player): number {
  const ageFactor = player.age <= 24 ? 1.25 : player.age <= 29 ? 1.0 : player.age <= 32 ? 0.7 : 0.45
  const injuryFactor = injuryHistoryPenalty(player) * (player.injuryDays > 0 ? 0.85 : 1)
  let v = Math.round(player.overall ** 2 * 900 * ageFactor * injuryFactor)
  v = Math.round(v * rollingFormMarketMul(player))
  const h = Math.min(20, Math.max(0, player.marketHeat ?? 0))
  v = Math.round(v * (1 + (h / 20) * 0.18))
  return v
}

export const SQUAD_STATUS_LABEL: Record<SquadStatusGuarantee, string> = {
  star: 'Star Player (คีย์แมน)',
  regular: 'Regular Starter',
  squad: 'Squad Player',
  impact: 'Impact Sub',
  prospect: 'Youngster / Hot Prospect',
}

/** เป้าหมายนาที/นัดโดยประมาณ (0–1 ของแมตช์ลีก) */
export function squadStatusPlayShare(status: SquadStatusGuarantee): number {
  switch (status) {
    case 'star':
      return 0.9
    case 'regular':
      return 0.7
    case 'squad':
      return 0.4
    case 'impact':
      return 0.25
    case 'prospect':
      return 0.15
  }
}

export function mapSquadRoleToStatus(
  role: Player['squadRole'],
): SquadStatusGuarantee {
  if (role === 'key') return 'star'
  if (role === 'regular') return 'regular'
  if (role === 'prospect') return 'prospect'
  return 'squad'
}

/** มูลค่าหลังหักสัญญาใกล้หมด / ลิสต์ขาย / อยากย้าย */
export function estimatedValueAdvanced(player: Player, save?: GameSave): number {
  let v = rawMarketValue(player)
  const years = player.contractYears ?? 0
  // Contract running down
  if (years <= 0) v = Math.round(v * 0.15)
  else if (years === 1) v = Math.round(v * 0.42)
  else if (years === 2) v = Math.round(v * 0.72)

  if (player.transferListed) v = Math.round(v * 0.78)
  if (player.wantAway?.active && player.wantAway.publicNews) v = Math.round(v * 0.85)
  if (player.refuseContractRenewal) v = Math.round(v * 0.7)

  // Bosman window: last half-season of final year ≈ matchday high + 1 year left
  if (save && isBosmanApproachWindow(player, save)) {
    v = Math.round(v * 0.2)
  }
  return Math.max(50_000, v)
}

/** เหลือสัญญา ≤6 เดือนโดยประมาณ หรือเข้าปีสุดท้ายหลัง MD14 */
export function isBosmanApproachWindow(player: Player, save: GameSave): boolean {
  if (player.refuseContractRenewal && (player.contractYears ?? 0) <= 1) return true
  if ((player.contractYears ?? 99) > 1) return false
  if ((player.contractEndSeason ?? 9999) > save.season + 1) return false
  // ปีสุดท้าย: หลัง MD 14 (ประมาณ ม.ค.) เปิด approach ล่วงหน้าได้
  return save.matchday >= 14 || (player.contractEndSeason ?? 0) <= save.season
}

export function canApproachBosman(save: GameSave, playerId: string): { ok: true } | { ok: false; reason: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p) return { ok: false, reason: 'ไม่พบนักเตะ' }
  if (p.clubId === save.humanClubId) return { ok: false, reason: 'อยู่ในทีมแล้ว' }
  if (p.loanParentClubId) return { ok: false, reason: 'กำลังยืมอยู่' }
  if (p.preContract?.clubId) {
    return { ok: false, reason: 'มีพรี-คอนแทรกต์กับสโมสรอื่นแล้ว' }
  }
  if (!isBosmanApproachWindow(p, save)) {
    return { ok: false, reason: 'ยังไม่เข้าช่วงบอสแมน (ต้องเหลือสัญญา ~6 เดือน / ปีสุดท้ายหลัง MD14)' }
  }
  if (isAgentLocked(p, save)) {
    return { ok: false, reason: `เอเยนต์ล็อกคุยถึง MD${p.agentLockUntilMatchday}` }
  }
  return { ok: true }
}

/** เซ็นพรี-คอนแทรกต์ — ย้ายฟรีฤดูกาลหน้า */
export function signPreContract(
  save: GameSave,
  playerId: string,
  wage: number,
  years = 3,
  squadStatus?: SquadStatusGuarantee,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const check = canApproachBosman(save, playerId)
  if (!check.ok) return { ok: false, message: check.reason }
  const pRaw = save.players.find((x) => x.id === playerId)!
  const p = withEnsuredAffinity(pRaw, save.clubs)
  const handshakeBonus = hasHandshakeWith(p, save.humanClubId) ? 0.9 : 1
  const wageFloor = Math.round(
    p.wage *
      1.05 *
      negotiationFormHeatMul(p) *
      affinityWageMul(p, save.humanClubId) *
      handshakeBonus,
  )
  if (wage < wageFloor) {
    return {
      ok: false,
      message: `นักเตะขออย่างน้อย ${formatMoney(wageFloor)}/สัปดาห์${
        handshakeBonus < 1 ? ' (มีสัญญาใจ — ขอลดนิด)' : ''
      }`,
    }
  }
  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const next: GameSave = {
    ...save,
    players: save.players.map((pl) =>
      pl.id === playerId
        ? {
            ...pl,
            preContract: {
              clubId: human.id,
              wage,
              years,
              startSeason: save.season + 1,
              squadStatus: squadStatus ?? mapSquadRoleToStatus(pl.squadRole),
            },
            secretHandshake: null,
            happiness: Math.min(20, (pl.happiness ?? 10) + 2),
          }
        : pl,
    ),
    inbox: [
      {
        id: uid('msg-bosman'),
        date: save.currentDate,
        title: `พรี-คอนแทรกต์: ${p.name}`,
        body: `เซ็นล่วงหน้าแบบบอสแมน · ค่าเหนื่อย ${formatMoney(wage)} · ${years} ปี · ย้ายฟรีวันที่เปิดฤดูกาล ${save.season + 1} (ไม่จ่ายค่าตัวให้ ${save.clubs.find((c) => c.id === p.clubId)?.shortName ?? 'ต้นสังกัด'})`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
  return {
    ok: true,
    message: `เซ็นพรี-คอนแทรกต์ ${p.name} สำเร็จ — ย้ายฟรีฤดูกาลหน้า`,
    save: next,
  }
}

/** เปิดฤดูกาลใหม่ — ใช้พรี-คอนแทรกต์ */
export function applyPreContractsOnSeasonStart(save: GameSave, newSeason: number): GameSave {
  let players = save.players
  let tacticsByClub = { ...save.tacticsByClub }
  const notes: string[] = []

  for (const p of save.players) {
    const pc = p.preContract
    if (!pc || pc.startSeason > newSeason) continue
    const fromId = p.clubId
    players = players.map((pl) =>
      pl.id === p.id
        ? {
            ...pl,
            clubId: pc.clubId,
            loanParentClubId: null,
            wage: pc.wage,
            wageWeekly: pc.wage,
            contractYears: pc.years,
            contractEndSeason: newSeason + pc.years,
            contractedSquadStatus: pc.squadStatus ?? pl.contractedSquadStatus,
            preContract: null,
            wantAway: null,
            refuseContractRenewal: false,
            transferListed: false,
          }
        : pl,
    )
    notes.push(`${p.name} ย้ายฟรีตามพรี-คอนแทรกต์ → ${save.clubs.find((c) => c.id === pc.clubId)?.shortName}`)
    if (tacticsByClub[fromId]) {
      tacticsByClub[fromId] = autoPickTactics(fromId, players, tacticsByClub[fromId].formation)
    }
    if (tacticsByClub[pc.clubId]) {
      tacticsByClub[pc.clubId] = autoPickTactics(pc.clubId, players, tacticsByClub[pc.clubId].formation)
    }
  }

  if (!notes.length) return save
  return {
    ...save,
    players,
    tacticsByClub,
    inbox: [
      {
        id: uid('msg-bosman-join'),
        date: save.currentDate,
        title: 'ย้ายฟรีตามบอสแมน',
        body: notes.join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

export function isAgentLocked(player: Player, save: GameSave): boolean {
  return (player.agentLockUntilMatchday ?? -1) >= save.matchday
}

export function lockAgentAfterWalk(save: GameSave, playerId: string, monthsApprox = 2.5): GameSave {
  const lockMd = save.matchday + Math.round(monthsApprox * 4) // ~4 MD ≈ เดือน
  return {
    ...save,
    players: save.players.map((p) =>
      p.id === playerId ? { ...p, agentLockUntilMatchday: lockMd } : p,
    ),
  }
}

/** ขึ้นบัญชีย้ายทีมโดยสโมสร */
export function setTransferListed(
  save: GameSave,
  playerId: string,
  listed: boolean,
  minFee?: number,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p || p.clubId !== save.humanClubId) return { ok: false, message: 'เลือกนักเตะในทีมคุณ' }
  const next: GameSave = {
    ...save,
    players: save.players.map((pl) =>
      pl.id === playerId
        ? {
            ...pl,
            transferListed: listed,
            transferListMinFee: listed ? (minFee ?? Math.round(estimatedValueAdvanced(pl, save) * 0.85)) : null,
            happiness: listed ? Math.max(1, (pl.happiness ?? 10) - 1) : pl.happiness,
          }
        : pl,
    ),
    inbox: [
      {
        id: uid('msg-tlist'),
        date: save.currentDate,
        title: listed ? `ขึ้นบัญชีย้าย: ${p.name}` : `เอาออกจากบัญชีย้าย: ${p.name}`,
        body: listed
          ? `ตั้งขาย · ราคาเริ่ม ~${formatMoney(minFee ?? estimatedValueAdvanced(p, save) * 0.85)} — AI จะยื่นถูกกว่าปกติ`
          : 'ยกเลิกลิสต์ขาย',
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
  return {
    ok: true,
    message: listed ? `ขึ้นบัญชีย้าย ${p.name}` : `ยกเลิกลิสต์ ${p.name}`,
    save: next,
  }
}

/** ยกเลิกสัญญา — จ่ายชดเชยบางส่วน → ฟรีเอเยนต์ */
export function mutualTerminateContract(
  save: GameSave,
  playerId: string,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p || p.clubId !== save.humanClubId) return { ok: false, message: 'เลือกนักเตะในทีมคุณ' }
  const years = Math.max(0.25, p.contractYears ?? 1)
  const compensation = Math.round(p.wage * 52 * years * 0.35)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  if (club.balance < compensation) {
    return { ok: false, message: `งบไม่พอค่าชดเชย ~${formatMoney(compensation)}` }
  }
  let players = save.players.map((pl) =>
    pl.id === playerId
      ? {
          ...pl,
          clubId: `fa-${pl.id}`,
          loanParentClubId: null,
          wage: Math.round(pl.wage * 0.7),
          contractYears: 0,
          contractEndSeason: save.season,
          transferListed: false,
          wantAway: null,
          releaseClause: null,
          relegationReleaseClause: null,
          buyBack: null,
          firstRefusalClubId: null,
        }
      : pl,
  )
  // สร้างคลับฟรีเอเยนต์เสมือนถ้ายังไม่มี — ใช้ clubId พิเศษที่ market มองเห็น
  // เก็บไว้ที่คลับว่าง: ใช้ human league free pool โดยตั้ง clubId เป็น '__free__'
  players = players.map((pl) =>
    pl.id === playerId ? { ...pl, clubId: '__free__' } : pl,
  )

  let tacticsByClub = { ...save.tacticsByClub }
  if (tacticsByClub[save.humanClubId]) {
    tacticsByClub[save.humanClubId] = autoPickTactics(
      save.humanClubId,
      players,
      tacticsByClub[save.humanClubId].formation,
    )
  }

  const finance = ensureClubFinance(save)
  const next: GameSave = {
    ...save,
    clubs: save.clubs.map((c) =>
      c.id === save.humanClubId ? { ...c, balance: c.balance - compensation } : c,
    ),
    players,
    tacticsByClub,
    clubFinance: {
      ...finance,
      transferOutSeason: (finance.transferOutSeason ?? 0) + compensation,
      ledger: [
        {
          id: uid('led-term'),
          date: save.currentDate,
          kind: 'other' as const,
          amount: -compensation,
          note: `ยกเลิกสัญญา: ${p.name}`,
        },
        ...finance.ledger,
      ].slice(0, 50),
    },
    inbox: [
      {
        id: uid('msg-term'),
        date: save.currentDate,
        title: `ยกเลิกสัญญา: ${p.name}`,
        body: `Mutual termination · จ่ายชดเชย ${formatMoney(compensation)} · กลายเป็นฟรีเอเยนต์`,
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
  return { ok: true, message: `ยกเลิกสัญญา ${p.name} · ชดเชย ${formatMoney(compensation)}`, save: next }
}

/** ขึ้นค่าเหนื่อยรายปีตอนเปิดฤดูกาล */
export function applyAnnualWageRises(save: GameSave): GameSave {
  let dirty = false
  const players = save.players.map((p) => {
    const pct = p.annualWageRisePercent
    if (!pct || pct <= 0) return p
    dirty = true
    const nextWage = Math.round(p.wage * (1 + pct / 100))
    return { ...p, wage: nextWage, wageWeekly: nextWage }
  })
  if (!dirty) return save
  return {
    ...save,
    players,
    inbox: [
      {
        id: uid('msg-wage-rise'),
        date: save.currentDate,
        title: 'ขึ้นค่าเหนื่อยประจำปี',
        body: 'สัญญามีเงื่อนไขขึ้นค่าเหนื่อยอัตโนมัติ — หักงบรายสัปดาห์ใหม่แล้ว',
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** โบนัสค่าเหนื่อยเมื่อติดโซนยุโรป (ท็อป 4 ดิวิชัน 1) */
export function applyEuropeWageBumps(save: GameSave, europeClubIds: string[]): GameSave {
  const set = new Set(europeClubIds)
  let notes: string[] = []
  const players = save.players.map((p) => {
    const pct = p.europeWageBumpPercent
    if (!pct || pct <= 0 || !set.has(p.clubId)) return p
    const nextWage = Math.round(p.wage * (1 + pct / 100))
    notes.push(`${p.name} +${pct}%`)
    return { ...p, wage: nextWage, wageWeekly: nextWage }
  })
  if (!notes.length) return save
  return {
    ...save,
    players,
    inbox: [
      {
        id: uid('msg-eu-wage'),
        date: save.currentDate,
        title: 'โบนัสค่าเหนื่อยโซนยุโรป',
        body: notes.slice(0, 12).join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** ตกชั้น → เปิดฉีกสัญญาราคาถูก / ฟรี */
export function applyRelegationReleaseClauses(save: GameSave, relegatedIds: string[]): GameSave {
  const set = new Set(relegatedIds)
  let notes: string[] = []
  const players = save.players.map((p) => {
    if (!set.has(p.clubId) || p.relegationReleaseClause == null) return p
    notes.push(
      `${p.name}: ฉีกตกชั้น ${p.relegationReleaseClause === 0 ? 'ฟรี' : formatMoney(p.relegationReleaseClause)}`,
    )
    return {
      ...p,
      releaseClause: p.relegationReleaseClause,
      wantAway: {
        active: true,
        intensity: 12,
        publicNews: true,
        refuseCount: p.wantAway?.refuseCount ?? 0,
        sinceMatchday: save.matchday,
        reasonTh: 'ฉีกสัญญาเมื่อตกชั้น',
      },
    }
  })
  if (!notes.length) return save
  return {
    ...save,
    players,
    inbox: [
      {
        id: uid('msg-rel-clause'),
        date: save.currentDate,
        title: 'ฉีกสัญญาเมื่อตกชั้น',
        body: notes.join(' · '),
        read: false,
      },
      ...save.inbox,
    ].slice(0, 40),
  }
}

/** ติด buy-back / ROFR หลังขาย */
export function attachSaleRights(
  save: GameSave,
  playerId: string,
  sellerClubId: string,
  opts: { buyBackFee?: number; buyBackYears?: number; firstRefusal?: boolean },
): GameSave {
  if (!opts.buyBackFee && !opts.firstRefusal) return save
  return {
    ...save,
    players: save.players.map((p) => {
      if (p.id !== playerId) return p
      return {
        ...p,
        buyBack:
          opts.buyBackFee && opts.buyBackFee > 0
            ? {
                clubId: sellerClubId,
                fee: opts.buyBackFee,
                untilSeason: save.season + (opts.buyBackYears ?? 3),
              }
            : p.buyBack,
        firstRefusalClubId: opts.firstRefusal ? sellerClubId : p.firstRefusalClubId,
      }
    }),
  }
}

/** ใช้สิทธิ์ซื้อคืน */
export function triggerBuyBack(
  save: GameSave,
  playerId: string,
): { ok: true; message: string; save: GameSave } | { ok: false; message: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p?.buyBack) return { ok: false, message: 'ไม่มีเงื่อนไขซื้อคืน' }
  if (p.buyBack.clubId !== save.humanClubId) {
    return { ok: false, message: 'สิทธิ์ซื้อคืนไม่ใช่ของสโมสรคุณ' }
  }
  if (p.buyBack.untilSeason < save.season) {
    return { ok: false, message: 'สิทธิ์ซื้อคืนหมดอายุแล้ว' }
  }
  const fee = p.buyBack.fee
  const buyer = save.clubs.find((c) => c.id === save.humanClubId)!
  const seller = save.clubs.find((c) => c.id === p.clubId)!
  if (buyer.balance < fee) return { ok: false, message: `งบไม่พอ ${formatMoney(fee)}` }

  let players = save.players.map((pl) =>
    pl.id === playerId
      ? {
          ...pl,
          clubId: buyer.id,
          loanParentClubId: null,
          buyBack: null,
          firstRefusalClubId: null,
          morale: Math.min(20, pl.morale + 1),
        }
      : pl,
  )
  let tacticsByClub = { ...save.tacticsByClub }
  tacticsByClub[seller.id] = autoPickTactics(seller.id, players, tacticsByClub[seller.id]?.formation)
  tacticsByClub[buyer.id] = autoPickTactics(buyer.id, players, tacticsByClub[buyer.id]?.formation)

  return {
    ok: true,
    message: `ซื้อคืน ${p.name} สำเร็จ · ${formatMoney(fee)}`,
    save: {
      ...save,
      players,
      tacticsByClub,
      clubs: save.clubs.map((c) => {
        if (c.id === buyer.id) return { ...c, balance: c.balance - fee }
        if (c.id === seller.id) return { ...c, balance: c.balance + fee }
        return c
      }),
      inbox: [
        {
          id: uid('msg-bb'),
          date: save.currentDate,
          title: `ซื้อคืน: ${p.name}`,
          body: `ใช้ Buy-back clause · ${formatMoney(fee)} จาก ${seller.name}`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
  }
}

/** ROFR: ก่อนปิดดีลซื้อ — ถามต้นสังกัดเก่า */
export function checkRightOfFirstRefusal(
  save: GameSave,
  playerId: string,
  offerFee: number,
): { needsRofr: false } | { needsRofr: true; holderClubId: string; fee: number; playerName: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p?.firstRefusalClubId) return { needsRofr: false }
  if (p.firstRefusalClubId === save.humanClubId) return { needsRofr: false }
  return {
    needsRofr: true,
    holderClubId: p.firstRefusalClubId,
    fee: offerFee,
    playerName: p.name,
  }
}

/** AI ตัดสินใจใช้ ROFR หรือปล่อย */
export function resolveRofrForAi(
  save: GameSave,
  playerId: string,
  offerFee: number,
): { save: GameSave; blocked: boolean; message: string } {
  const p = save.players.find((x) => x.id === playerId)
  if (!p?.firstRefusalClubId) {
    return { save, blocked: false, message: '' }
  }
  const holder = save.clubs.find((c) => c.id === p.firstRefusalClubId)
  if (!holder) return { save, blocked: false, message: '' }

  // Human holds ROFR และเป็นผู้ซื้อ = ใช้สิทธิ์แมตช์ราคาเอง แล้วไปต่อ
  if (holder.id === save.humanClubId) {
    return {
      save: {
        ...save,
        players: save.players.map((pl) =>
          pl.id === playerId ? { ...pl, firstRefusalClubId: null } : pl,
        ),
        inbox: [
          {
            id: uid('msg-rofr-use'),
            date: save.currentDate,
            title: `ใช้ ROFR: ${p.name}`,
            body: `คุณใช้สิทธิ์ปฏิเสธครั้งแรก · แมตช์ราคา ${formatMoney(offerFee)}`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
      blocked: false,
      message: 'ใช้ ROFR แล้ว',
    }
  }

  // AI holder: ใช้สิทธิ์ถ้างบพอและราคาคุ้ม
  const value = estimatedValueAdvanced(p, save)
  const use =
    holder.controlledBy === 'ai' &&
    holder.balance >= offerFee &&
    offerFee <= value * 1.15 &&
    Math.random() < 0.45

  if (!use) {
    return {
      save: {
        ...save,
        players: save.players.map((pl) =>
          pl.id === playerId ? { ...pl, firstRefusalClubId: null } : pl,
        ),
        inbox: [
          {
            id: uid('msg-rofr-pass'),
            date: save.currentDate,
            title: `ROFR ปล่อยผ่าน: ${p.name}`,
            body: `${holder.name} ไม่ใช้สิทธิ์ปฏิเสธครั้งแรก — ดีลดำเนินต่อได้`,
            read: false,
          },
          ...save.inbox,
        ].slice(0, 40),
      },
      blocked: false,
      message: `${holder.name} ไม่ใช้ ROFR`,
    }
  }

  // AI buys back via ROFR
  let players = save.players.map((pl) =>
    pl.id === playerId
      ? {
          ...pl,
          clubId: holder.id,
          firstRefusalClubId: null,
          buyBack: null,
        }
      : pl,
  )
  return {
    save: {
      ...save,
      players,
      clubs: save.clubs.map((c) => {
        if (c.id === holder.id) return { ...c, balance: c.balance - offerFee }
        if (c.id === p.clubId) return { ...c, balance: c.balance + offerFee }
        return c
      }),
      inbox: [
        {
          id: uid('msg-rofr-ai'),
          date: save.currentDate,
          title: `ROFR: ${holder.name} ดึง ${p.name}`,
          body: `ใช้สิทธิ์แมตช์ราคา ${formatMoney(offerFee)} — ดีลของคุณถูกบล็อก`,
          read: false,
        },
        ...save.inbox,
      ].slice(0, 40),
    },
    blocked: true,
    message: `${holder.name} ใช้ ROFR ดึง ${p.name} ไปแล้ว`,
  }
}

/** ห้ามลงแข่งเจอทีมแม่ */
export function isIneligibleVsParent(
  player: Player,
  opponentClubId: string,
  deal?: LoanDeal | null,
): boolean {
  if (!player.loanParentClubId) return false
  if (deal?.blockVsParent === false) return false
  return player.loanParentClubId === opponentClubId
}

/** กรอง XI/bench ก่อนแมตช์ */
export function stripParentClubBlocked(
  playerIds: string[],
  players: Player[],
  opponentClubId: string,
  loans: LoanDeal[] | null | undefined,
): string[] {
  const loanByPlayer = new Map(
    (loans ?? []).filter((d) => d.status === 'active').map((d) => [d.playerId, d]),
  )
  return playerIds.filter((id) => {
    const p = players.find((x) => x.id === id)
    if (!p) return false
    return !isIneligibleVsParent(p, opponentClubId, loanByPlayer.get(id))
  })
}

export function emptyAdvancedAddons(): Partial<TransferAddonPackage> {
  return {
    sellOnMode: 'fee',
    intlCapsFee: 0,
    intlCapsNeeded: 10,
    buyBackFee: 0,
    buyBackYears: 3,
    firstRefusal: false,
    annualWageRisePercent: 0,
    europeWageBumpPercent: 0,
    relegationReleaseFee: null,
    contractedSquadStatus: undefined,
  }
}

export type { TransferDeskState, FeePaymentPreset }
