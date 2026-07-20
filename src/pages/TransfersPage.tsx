import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { estimatedValue, listMarketPlayers, minAcceptableFee, marketSellPremium, winterMarketHintTh, marketValueHints } from '@/game/transfer'
import { agentStyleFor, AGENT_STYLE_LABEL, AGENT_STYLE_DESC, agentLabelTh, AGENT_KIND_LABEL } from '@/game/agents'
import { focusLabelTh, negotiationProfile } from '@/game/contractNegotiation'
import { emptyAddonPackage } from '@/game/transferClauses'
import type { TransferAddonPackage } from '@/game/types'
import { analyzeBuy, analyzeSell, analyzeAddons } from '@/game/transferIntel'
import { roleLabel, roleShort } from '@/game/positions'
import { formatMoney } from '@/lib/format'
import type { PositionGroup } from '@/game/types'
import { cn } from '@/lib/cn'
import { TransferIntelPanel } from '@/components/TransferIntelPanel'
import { ensureFans, fanMoodLabel } from '@/game/fans'
import { ensureScouting, knowledgeOf, recentFormForPlayer, revealOverall, revealPa } from '@/game/scouting'
import { ensureTransferDesk } from '@/game/transferDesk'
import { isShortlisted } from '@/game/shortlist'
import { activeLoansForClub, canRecallLoanDeal } from '@/game/loans'
import { isTransferWindowOpen, transferWindowLabel, transferWindowKind } from '@/game/transferWindow'
import { isTransferDeadlineActive } from '@/game/transferDeadline'
import { Link } from 'react-router-dom'
import { PlayerFace } from '@/components/PlayerFace'
import {
  releaseClauseLabelTh,
  releaseClauseVisibility,
  releaseIntelHintTh,
} from '@/game/releaseClauseIntel'
import {
  FEE_PAYMENT_PRESETS,
  buildFeePaymentSchedule,
  describePaymentScheduleTh,
  pendingInstallmentsForClub,
  sellerPresentValue,
} from '@/game/transferPayments'
import { canApproachBosman, isBosmanApproachWindow } from '@/game/transferAdvanced'
import {
  affinityHintsTh,
  hasHandshakeWith,
} from '@/game/playerAmbition'
import { listAgentApproachOffers } from '@/game/agentApproach'
import {
  runTransferMedical,
  squadRegistrationStatus,
} from '@/game/transferExtras'
import { ensureInsolvency, insolvencyLabelTh, insolvencyBlocksBuying } from '@/game/insolvency'
import type { FeePaymentPreset } from '@/game/types'

type Tab = 'buy' | 'sell'

export function TransfersPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureFans(saveRaw)
  const offerBuyPlayer = useGameStore((s) => s.offerBuyPlayer)
  const offerBuyNegotiated = useGameStore((s) => s.offerBuyNegotiated)
  const offerExchange = useGameStore((s) => s.offerExchange)
  const offerSellPlayer = useGameStore((s) => s.offerSellPlayer)
  const loanInPlayer = useGameStore((s) => s.loanInPlayer)
  const loanOutPlayer = useGameStore((s) => s.loanOutPlayer)
  const recallLoanDeal = useGameStore((s) => s.recallLoanDeal)
  const buyLoanOption = useGameStore((s) => s.buyLoanOption)
  const setPlayerTransferListed = useGameStore((s) => s.setPlayerTransferListed)
  const mutualTerminatePlayer = useGameStore((s) => s.mutualTerminatePlayer)
  const signBosmanPreContract = useGameStore((s) => s.signBosmanPreContract)
  const tryPlayerSecretHandshake = useGameStore((s) => s.tryPlayerSecretHandshake)
  const triggerPlayerBuyBack = useGameStore((s) => s.triggerPlayerBuyBack)
  const acceptRofrOffer = useGameStore((s) => s.acceptRofrOffer)
  const declineRofrOffer = useGameStore((s) => s.declineRofrOffer)
  const startPlayerAuction = useGameStore((s) => s.startPlayerAuction)
  const togglePlayerShortlist = useGameStore((s) => s.togglePlayerShortlist)
  const acceptTransferCounter = useGameStore((s) => s.acceptTransferCounter)
  const acceptWantAwayOffer = useGameStore((s) => s.acceptWantAwayOffer)
  const rejectWantAwayOffer = useGameStore((s) => s.rejectWantAwayOffer)
  const acceptAgentApproach = useGameStore((s) => s.acceptAgentApproach)
  const declineAgentApproachOffer = useGameStore((s) => s.declineAgentApproachOffer)
  const renewPlayerContract = useGameStore((s) => s.renewPlayerContract)
  const cancelPlayerContractTalk = useGameStore((s) => s.cancelPlayerContractTalk)
  const triggerClause = useGameStore((s) => s.triggerReleaseClause)
  const runScout = useGameStore((s) => s.runScout)

  const [tab, setTab] = useState<Tab>('buy')
  const [pos, setPos] = useState<PositionGroup | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [fee, setFee] = useState(0)
  const [wage, setWage] = useState(0)
  const [years, setYears] = useState(3)
  const [signingOn, setSigningOn] = useState(0)
  const [perAppearanceBonus, setPerAppearanceBonus] = useState(0)
  const [perGoalBonus, setPerGoalBonus] = useState(0)
  const [addons, setAddons] = useState<TransferAddonPackage>(() => ({
    ...emptyAddonPackage(),
    appearanceFee: 50_000,
    appearanceNeeded: 10,
    sellOnPercent: 10,
    perAppearance: 5_000,
    perCleanSheet: 8_000,
  }))
  const [exchangeOurId, setExchangeOurId] = useState('')
  const [exchangeCash, setExchangeCash] = useState(0)
  const [loanBackUntilNextSeason, setLoanBackUntilNextSeason] = useState(false)
  const [paymentPreset, setPaymentPreset] = useState<FeePaymentPreset>('full')
  const [loanOutClubId, setLoanOutClubId] = useState('')
  const [loanWageShare, setLoanWageShare] = useState(0.5)
  const [loanObligation, setLoanObligation] = useState<
    '' | 'always' | 'avoid_relegation' | 'appearances'
  >('')
  const [loanObligationFee, setLoanObligationFee] = useState(0)
  const [acceptCautionMedical, setAcceptCautionMedical] = useState(false)
  const [allowSellToRival, setAllowSellToRival] = useState(false)

  const patchAddon = <K extends keyof TransferAddonPackage>(key: K, value: TransferAddonPackage[K]) => {
    setAddons((prev) => ({ ...prev, [key]: value }))
  }

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const scouting = ensureScouting(save)
  const market = useMemo(() => listMarketPlayers(save), [save])
  const mySquad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .map((p) => ({ ...p, value: estimatedValue(p) }))
        .sort((a, b) => b.overall - a.overall),
    [save],
  )

  const filteredBuy = market.filter((p) => {
    if (pos !== 'ALL' && p.position !== pos) return false
    if (q && !p.name.includes(q) && !p.clubName.includes(q)) return false
    return true
  })

  const selectedBuy = market.find((p) => p.id === selectedId)
  const selectedSell = mySquad.find((p) => p.id === selectedId)
  const sellerClub = selectedBuy
    ? save.clubs.find((c) => c.id === selectedBuy.clubId)
    : null

  const intel = useMemo(() => {
    if (tab === 'buy' && selectedBuy)
      return analyzeBuy(save, selectedBuy, save.fans)
    if (tab === 'sell' && selectedSell)
      return analyzeSell(save, selectedSell, save.fans)
    return null
  }, [tab, selectedBuy, selectedSell, save])

  const addonIntel = useMemo(() => {
    if (tab === 'buy' && selectedBuy)
      return analyzeAddons(save, selectedBuy, 'buy', fee, wage, years, addons)
    if (tab === 'sell' && selectedSell)
      return analyzeAddons(save, selectedSell, 'sell', fee, wage, years, addons)
    return null
  }, [tab, selectedBuy, selectedSell, save, fee, wage, years, addons])

  const pickBuy = (id: string) => {
    const p = market.find((x) => x.id === id)!
    const report = analyzeBuy(save, p, save.fans)
    setSelectedId(id)
    setFee(report.suggestedFee)
    setWage(report.suggestedWage ?? Math.round(p.wage * 1.1))
    setYears(3)
    setLoanBackUntilNextSeason(false)
    setPaymentPreset('full')
  }

  const pickSell = (id: string) => {
    const p = mySquad.find((x) => x.id === id)!
    const report = analyzeSell(save, p, save.fans)
    setSelectedId(id)
    setFee(report.suggestedFee)
    setWage(p.wage)
    setYears(Math.max(1, p.contractYears ?? 2))
  }

  const desk = ensureTransferDesk(save)
  const loans = activeLoansForClub(save, save.humanClubId)
  const feeInstallments = pendingInstallmentsForClub(save, save.humanClubId)
  const buySchedule = useMemo(
    () => buildFeePaymentSchedule(Math.max(0, fee), paymentPreset, save.season),
    [fee, paymentPreset, save.season],
  )
  const buySellerNpv = useMemo(() => {
    if (!selectedBuy) return buySchedule.dueNow
    return sellerPresentValue(buySchedule, marketSellPremium(save, selectedBuy) > 1)
  }, [buySchedule, save, selectedBuy])
  const counters = desk.offers.filter((o) => o.status === 'countered')
  const rofrOffers = desk.offers.filter(
    (o) => o.isRofrMatch && o.status === 'pending' && o.expiresMatchday >= save.matchday,
  )
  const inboundBuys = desk.offers.filter(
    (o) =>
      o.kind === 'sell' &&
      o.status === 'pending' &&
      o.fromClubId === save.humanClubId &&
      o.expiresMatchday >= save.matchday,
  )
  const agentPitches = listAgentApproachOffers(save)
  const squadReg = squadRegistrationStatus(save)
  const windowOpen = isTransferWindowOpen(save)
  const windowKind = transferWindowKind(save)
  const deadline = isTransferDeadlineActive(save)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1.15fr]">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <div
          className={cn(
            'mb-3 rounded-md px-3 py-2 text-sm',
            deadline
              ? 'border border-amber-300 bg-amber-50 text-amber-950'
              : windowOpen
                ? 'bg-lime-50 text-lime-950'
                : 'bg-amber-50 text-amber-950',
          )}
        >
          {deadline
            ? '⏰ โหมดปิดตลาด — นับชั่วโมง · ตลาดชุกชุม'
            : windowKind === 'winter'
              ? '❄ ตลาดวินเทอร์เปิดอยู่'
              : windowKind === 'summer'
                ? '☀ ตลาดซัมเมอร์เปิดอยู่'
                : windowKind === 'offseason'
                  ? 'ออฟซีซัน — ตลาดเปิด'
                  : 'ตลาดปิด'}{' '}
          · {transferWindowLabel(save)}
        </div>
        {(() => {
          const block = insolvencyBlocksBuying(save)
          if (!block) return null
          const inv = ensureInsolvency(save)
          return (
            <div className="mb-3 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-950">
              <strong>{insolvencyLabelTh(inv.stage)}</strong>
              {' — '}
              {block}
              {inv.fireSalePlayerIds.length > 0
                ? ` · Fire sale ${inv.fireSalePlayerIds.length} คน`
                : ''}
            </div>
          )
        })()}
        {deadline && save.transferDeadline ? (
          <div className="mb-3 rounded-md border border-amber-200 bg-white px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold text-amber-950">
              นาฬิกา {String(save.transferDeadline.clockHour).padStart(2, '0')}:00 · เหลือ{' '}
              {save.transferDeadline.hoursRemaining} / 72 ชม.
            </p>
            <p className="mt-1 text-slate-500">
              กด «+1 ชั่วโมง» ที่หน้าแมตช์เพื่อเดินหน้า · ดูข้อเสนอในกล่องจดหมายด้านล่าง
            </p>
            {save.transferDeadline.log[0] ? (
              <p className="mt-1 text-slate-600">
                ล่าสุด: {save.transferDeadline.log[0].body}
              </p>
            ) : null}
          </div>
        ) : null}
        {winterMarketHintTh(save) && !deadline ? (
          <div className="mb-3 rounded-md border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-950">
            {winterMarketHintTh(save)}
          </div>
        ) : null}
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">ตลาดซื้อขาย</h2>
          {(['buy', 'sell'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setSelectedId(null)
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-semibold',
                tab === t
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white hover:bg-slate-50',
              )}
            >
              {t === 'buy' ? 'ซื้อจาก AI' : 'ขายให้ AI'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          งบคุณ: <strong>{formatMoney(human.balance)}</strong> · แฟน:{' '}
          <strong>
            {fanMoodLabel(save.fans.mood)} ({save.fans.mood}/100)
          </strong>
          <br />
          <span className={cn('text-xs', squadReg.ok ? 'text-slate-500' : 'text-rose-700 font-semibold')}>
            ขนาดสควอด: {squadReg.reason}
          </span>
        </p>

        {rofrOffers.length > 0 ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
            <p className="font-semibold text-violet-950">สิทธิ์ปฏิเสธครั้งแรก (ROFR)</p>
            <ul className="mt-1 space-y-1.5">
              {rofrOffers.map((o) => {
                const p = save.players.find((x) => x.id === o.playerId)
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {p?.name}: {o.note}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-violet-400 bg-white px-2 py-0.5 text-xs font-semibold"
                      onClick={() => acceptRofrOffer(o.id)}
                    >
                      แมตช์ราคา · ดึงกลับ
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                      onClick={() => declineRofrOffer(o.id)}
                    >
                      ปล่อยผ่าน
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {agentPitches.length > 0 ? (
          <div className="mt-3 rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-sm">
            <p className="font-semibold text-violet-950">เอเยนต์มาคุย — เสนอขายลูกค้า</p>
            <p className="mt-0.5 text-[11px] text-violet-800">
              เอเยนต์คนเดียวอาจดูแลหลายนักเตะ · ยื่นเพราะอยากย้าย / ไม่พอใจ / ทีมในฝัน ฯลฯ
            </p>
            <ul className="mt-2 space-y-2">
              {agentPitches.map((o) => {
                const p = save.players.find((x) => x.id === o.playerId)
                const club = save.clubs.find((c) => c.id === o.fromClubId)
                return (
                  <li
                    key={o.id}
                    className="rounded border border-violet-200 bg-white/80 px-2 py-1.5"
                  >
                    <p className="font-medium text-slate-900">
                      {o.agentName}{' '}
                      <span className="font-normal text-slate-500">
                        ({o.agentAgency}
                        {o.agentClientCount != null
                          ? ` · ลูกค้า ${o.agentClientCount} คน`
                          : ''}
                        )
                      </span>
                    </p>
                    <p className="text-xs text-slate-700">
                      เสนอ {p?.name ?? o.playerId} จาก {club?.shortName ?? '—'} · ขอ{' '}
                      {formatMoney(o.fee)} · ค่าเหนื่อย {formatMoney(o.wage)} · {o.contractYears}{' '}
                      ปี
                    </p>
                    {o.approachReasonTh ? (
                      <p className="text-[11px] text-violet-900">เหตุผล: {o.approachReasonTh}</p>
                    ) : null}
                    <p className="text-[11px] text-slate-500">หมดอายุ MD{o.expiresMatchday}</p>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="rounded border border-violet-500 bg-violet-100 px-2 py-0.5 text-xs font-semibold text-violet-950"
                        onClick={() => acceptAgentApproach(o.id)}
                      >
                        รับข้อเสนอ · ซื้อ
                      </button>
                      <button
                        type="button"
                        className="rounded border border-slate-300 bg-white px-2 py-0.5 text-xs"
                        onClick={() => {
                          setTab('buy')
                          setSelectedId(o.playerId)
                          setFee(o.fee)
                          setWage(o.wage)
                          setYears(o.contractYears)
                        }}
                      >
                        เปิดในตลาด
                      </button>
                      <button
                        type="button"
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs text-rose-900"
                        onClick={() => declineAgentApproachOffer(o.id)}
                      >
                        ปฏิเสธ
                      </button>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {counters.length > 0 ? (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm">
            <p className="font-semibold text-amber-950">ข้อเสนอโต้กลับค้าง</p>
            <ul className="mt-1 space-y-1">
              {counters.map((o) => {
                const p = save.players.find((x) => x.id === o.playerId)
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span>
                      {p?.name}: {o.note}
                    </span>
                    <button
                      type="button"
                      className="rounded border border-amber-400 bg-white px-2 py-0.5 text-xs font-semibold"
                      onClick={() => acceptTransferCounter(o.id)}
                    >
                      รับราคาโต้
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {inboundBuys.length > 0 ? (
          <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm">
            <p className="font-semibold text-rose-950">ข้อเสนอซื้อจากข่าวอยากย้าย</p>
            <ul className="mt-1 space-y-1.5">
              {inboundBuys.map((o) => {
                const p = save.players.find((x) => x.id === o.playerId)
                const buyer = save.clubs.find((c) => c.id === o.toClubId)
                return (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span className="text-rose-950">
                      {buyer?.shortName ?? 'AI'} → {p?.name}: {formatMoney(o.fee)}
                      <span className="text-rose-800/80"> · {o.note}</span>
                    </span>
                    <button
                      type="button"
                      className="rounded border border-emerald-500 bg-white px-2 py-0.5 text-xs font-semibold text-emerald-900"
                      onClick={() => acceptWantAwayOffer(o.id)}
                    >
                      รับขาย
                    </button>
                    <button
                      type="button"
                      className="rounded border border-slate-400 bg-white px-2 py-0.5 text-xs font-semibold"
                      onClick={() => rejectWantAwayOffer(o.id)}
                    >
                      ปฏิเสธ
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {(desk.clauses ?? []).filter((c) => c.status === 'active').length > 0 ? (
          <div className="mt-3 max-h-36 overflow-y-auto rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950">
            <p className="font-semibold">เงื่อนไขที่ยังค้าง</p>
            <ul className="mt-1 space-y-0.5">
              {(desk.clauses ?? [])
                .filter((c) => c.status === 'active')
                .slice(0, 12)
                .map((c) => (
                  <li key={c.id}>
                    {c.playerName}: {c.note}
                    {c.appearancesNeeded > 0
                      ? ` · ${c.appearancesSoFar}/${c.appearancesNeeded}`
                      : c.appearancesSoFar > 0
                        ? ` · จ่ายแล้ว ${c.appearancesSoFar} ครั้ง`
                        : ''}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}

        {feeInstallments.length > 0 ? (
          <div className="mt-2 rounded-lg border border-orange-200 bg-orange-50/80 px-3 py-2 text-xs text-orange-950">
            <p className="font-semibold">งวดค่าตัวค้าง: {feeInstallments.length} งวด</p>
            <ul className="mt-1 space-y-0.5">
              {feeInstallments.slice(0, 8).map((i) => (
                <li key={i.id}>
                  {i.playerName}: {formatMoney(i.amount)} · ฤดูกาล {i.dueSeason}
                  {i.status === 'overdue' ? ' · ค้างจ่าย!' : ''}
                  {i.fromClubId === save.humanClubId ? ' (คุณจ่าย)' : ' (คุณรับ)'}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {loans.length > 0 ? (
          <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950">
            <p className="font-semibold">สัญญายืมที่เกี่ยวกับคุณ: {loans.length} ฉบับ</p>
            <ul className="mt-1.5 space-y-2">
              {loans.slice(0, 10).map((d) => {
                const p = save.players.find((x) => x.id === d.playerId)
                const host = save.clubs.find((c) => c.id === d.toClubId)
                const parent = save.clubs.find((c) => c.id === d.fromClubId)
                if (d.kind === 'buy_loan_back') {
                  return (
                    <li key={d.id} className="rounded border border-amber-200/80 bg-white/60 px-2 py-1.5">
                      <p>
                        {p?.name ?? d.playerId}: ซื้อแล้ว · {host?.shortName ?? d.toClubId}{' '}
                        ยืมใช้จนจบฤดูกาล · ฤดูกาลหน้าเข้าทีมคุณ
                      </p>
                      <p className="mt-0.5 text-[10px] text-amber-800/80">เรียกกลับไม่ได้ (ตามดีล)</p>
                    </li>
                  )
                }
                const isOutgoing = d.fromClubId === save.humanClubId
                const isIncoming = d.toClubId === save.humanClubId
                const recallCheck = canRecallLoanDeal(save, d)
                return (
                  <li
                    key={d.id}
                    className="rounded border border-amber-200/80 bg-white/60 px-2 py-1.5 space-y-1"
                  >
                    <p>
                      {p?.name ?? d.playerId}
                      {isOutgoing
                        ? ` · ปล่อยยืมที่ ${host?.shortName ?? d.toClubId}`
                        : ` · ยืมจาก ${parent?.shortName ?? d.fromClubId}`}
                      {' · '}ถึง MD{d.endMatchday}
                      {!d.recallable ? ' · เรียกกลับไม่ได้' : ''}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {isOutgoing ? (
                        <button
                          type="button"
                          className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-950 hover:bg-rose-100 disabled:opacity-50"
                          disabled={!recallCheck.ok}
                          title={recallCheck.ok ? 'เรียกกลับทีมคุณ' : recallCheck.reason}
                          onClick={() => recallLoanDeal(d.id)}
                        >
                          {recallCheck.ok
                            ? 'เรียกกลับ'
                            : `เรียกกลับไม่ได้ (${'reason' in recallCheck ? recallCheck.reason : ''})`}
                        </button>
                      ) : null}
                      {isIncoming && d.optionToBuy ? (
                        <button
                          type="button"
                          className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-950 hover:bg-emerald-100"
                          onClick={() => buyLoanOption(d.id)}
                        >
                          ใช้สิทธิ์ซื้อ · {formatMoney(d.optionToBuy)}
                        </button>
                      ) : null}
                      {isIncoming && d.recallable ? (
                        <span className="text-[10px] text-amber-800/80 self-center">
                          ต้นสังกัดอาจเรียกกลับได้
                        </span>
                      ) : null}
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}

        {tab === 'buy' ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                placeholder="ค้นชื่อ / สโมสร"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                value={pos}
                onChange={(e) => setPos(e.target.value as PositionGroup | 'ALL')}
              >
                <option value="ALL">ทุกตำแหน่ง</option>
                <option value="GK">GK</option>
                <option value="DF">DF</option>
                <option value="MF">MF</option>
                <option value="FW">FW</option>
              </select>
            </div>
            <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto text-sm">
              {filteredBuy.slice(0, 80).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pickBuy(p.id)}
                    className={cn(
                      'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left',
                      selectedId === p.id
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-100 bg-slate-50 hover:bg-slate-100',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span className="min-w-0">
                        <span className="font-semibold" title={roleLabel(p.role)}>
                          {roleShort(p.role)}
                        </span>{' '}
                        {p.name}
                        <span className="mt-0.5 block text-xs text-slate-500">
                          {p.clubName} · อายุ {p.age}
                        </span>
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">
                        {revealOverall(p.overall, knowledgeOf(scouting, p.id))}
                      </span>
                      <span className="text-xs text-slate-500">
                        รู้ {knowledgeOf(scouting, p.id)}%
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto text-sm">
            {mySquad.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickSell(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left',
                    selectedId === p.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerFace name={p.name} size="xs" />
                    <span className="min-w-0">
                      <span className="font-semibold" title={roleLabel(p.role)}>
                        {roleShort(p.role)}
                      </span>{' '}
                      {p.name}
                      <span className="mt-0.5 block text-xs text-slate-500">อายุ {p.age}</span>
                    </span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{p.overall}</span>
                    <span className="text-xs text-slate-500">{formatMoney(p.value)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="max-h-[42rem] overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-5">
        <h3 className="text-lg font-semibold">ต่อรอง + เหตุผล AI</h3>
        {tab === 'buy' && selectedBuy && sellerClub ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <PlayerFace name={selectedBuy.name} size="md" />
              <span>
                <strong>{selectedBuy.name}</strong> · {roleShort(selectedBuy.role)} · OVR{' '}
                {revealOverall(selectedBuy.overall, knowledgeOf(scouting, selectedBuy.id))}
              </span>
            </p>
            <p className="text-slate-600">
              สังกัด: {selectedBuy.clubName} (AI)
              {selectedBuy.originLeague ? ` · ลีกต้นทาง ${selectedBuy.originLeague}` : ''}
              <br />
              ความรู้สเกาต์: {knowledgeOf(scouting, selectedBuy.id)}%
              {scouting.alumniIds.includes(selectedBuy.id) ? ' · อดีตลูกทีม (พื้น 50%)' : ' · เริ่มจาก 0%'}
              <br />
              PA {revealPa(selectedBuy.pa, knowledgeOf(scouting, selectedBuy.id))}
              <br />
              มูลค่าประเมิน: {formatMoney(selectedBuy.value)}
              {marketValueHints(selectedBuy).length > 0 ? (
                <>
                  <br />
                  <span className="text-amber-900">
                    {marketValueHints(selectedBuy).join(' · ')}
                  </span>
                </>
              ) : null}
              <br />
              ค่าตัวขั้นต่ำโดยประมาณ:{' '}
              {formatMoney(minAcceptableFee(selectedBuy, sellerClub, save))}
              {marketSellPremium(save, selectedBuy) > 1 ? (
                <span className="text-amber-800">
                  {' '}
                  · วินเทอร์×{marketSellPremium(save, selectedBuy).toFixed(2)}
                </span>
              ) : null}
              {(selectedBuy.marketHeat ?? 0) > 0 || (selectedBuy.form ?? 10) !== 10 ? (
                <>
                  <br />
                  <span className="text-xs text-slate-500">
                    ฟอร์ม {selectedBuy.form}/20
                    {(selectedBuy.marketHeat ?? 0) > 0
                      ? ` · ความสนใจตลาด ${selectedBuy.marketHeat}/20`
                      : ''}
                  </span>
                </>
              ) : null}
            </p>
            {winterMarketHintTh(save) ? (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                {winterMarketHintTh(save)}
              </p>
            ) : null}
            {recentFormForPlayer(scouting, selectedBuy.id, 3).length > 0 ? (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-950">
                ฟอร์มที่เห็น:{' '}
                {recentFormForPlayer(scouting, selectedBuy.id, 3)
                  .map((f) => `MD${f.matchday} ${f.form}/10`)
                  .join(' · ')}{' '}
                (แค่นัดต่อนัด)
              </p>
            ) : (
              <p className="text-xs text-slate-500">
                ยังไม่มีฟอร์มนัด —{' '}
                <Link to="/scouting" className="font-semibold underline underline-offset-2">
                  จ้างสเกาต์ดูนัด
                </Link>{' '}
                หรือรอแขกสนาม
              </p>
            )}
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50"
              onClick={() => runScout(selectedBuy.id)}
            >
              ส่งสเกาต์ (+ความรู้ทั่วไป)
            </button>
            <Link
              to="/scouting"
              className="block w-full rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-950 hover:bg-amber-100"
            >
              ดูฟอร์ม / แขกสนาม →
            </Link>
            <label className="grid gap-1">
              <span>เสนอค่าตัว</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span>ค่าเหนื่อย/สัปดาห์</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={wage}
                onChange={(e) => setWage(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span>ระยะสัญญา (ปี)</span>
              <input
                type="number"
                min={1}
                max={5}
                className="rounded-md border border-slate-300 px-3 py-2"
                value={years}
                onChange={(e) => setYears(Number(e.target.value))}
              />
            </label>
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs font-semibold text-slate-700">Add-on → คลับขาย (จ่ายทีหลัง)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-0.5 text-xs">
                  <span>ลงแข่งครบ (€)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.appearanceFee}
                    onChange={(e) => patchAddon('appearanceFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เป้า (นัด)</span>
                  <input
                    type="number"
                    min={1}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.appearanceNeeded}
                    onChange={(e) => patchAddon('appearanceNeeded', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ประตูครบ (€)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.goalsFee}
                    onChange={(e) => patchAddon('goalsFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เป้า (ประตู)</span>
                  <input
                    type="number"
                    min={1}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.goalsNeeded}
                    onChange={(e) => patchAddon('goalsNeeded', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>แอสซิสต์ครบ (€)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.assistsFee}
                    onChange={(e) => patchAddon('assistsFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เป้า (ครั้ง)</span>
                  <input
                    type="number"
                    min={1}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.assistsNeeded}
                    onChange={(e) => patchAddon('assistsNeeded', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>คลีนชีตครบ (€)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.cleanSheetsFee}
                    onChange={(e) => patchAddon('cleanSheetsFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เป้า (นัด CS)</span>
                  <input
                    type="number"
                    min={1}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.cleanSheetsNeeded}
                    onChange={(e) => patchAddon('cleanSheetsNeeded', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>Sell-on %</span>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.sellOnPercent}
                    onChange={(e) => patchAddon('sellOnPercent', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>Sell-on แบบ</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.sellOnMode ?? 'fee'}
                    onChange={(e) =>
                      patchAddon('sellOnMode', e.target.value as 'fee' | 'profit')
                    }
                  >
                    <option value="fee">% ของค่าตัวถัดไป</option>
                    <option value="profit">% ของกำไร</option>
                  </select>
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>แคปชาติ (€)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.intlCapsFee ?? 0}
                    onChange={(e) => patchAddon('intlCapsFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เป้าแคป</span>
                  <input
                    type="number"
                    min={1}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.intlCapsNeeded ?? 10}
                    onChange={(e) => patchAddon('intlCapsNeeded', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>Buy-back ราคา</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.buyBackFee ?? 0}
                    onChange={(e) => patchAddon('buyBackFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>Buy-back ปี</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.buyBackYears ?? 3}
                    onChange={(e) => patchAddon('buyBackYears', Number(e.target.value))}
                  />
                </label>
                <label className="flex items-center gap-2 text-xs col-span-2">
                  <input
                    type="checkbox"
                    checked={Boolean(addons.firstRefusal)}
                    onChange={(e) => patchAddon('firstRefusal', e.target.checked)}
                  />
                  สิทธิ์ปฏิเสธครั้งแรก (ROFR) ให้ผู้ขาย
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>เลื่อนชั้น</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.promotionFee}
                    onChange={(e) => patchAddon('promotionFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>แชมป์ลีก</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.leagueTitleFee}
                    onChange={(e) => patchAddon('leagueTitleFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>โซนยุโรป (ท็อป 4)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.europeFee}
                    onChange={(e) => patchAddon('europeFee', Number(e.target.value))}
                  />
                </label>
              </div>
              <p className="text-xs font-semibold text-slate-700">โบนัสนักเตะ (สัญญา)</p>
              <div className="grid grid-cols-2 gap-2">
                <label className="grid gap-0.5 text-xs">
                  <span>เงินเซ็นสัญญา</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.signingOnFee}
                    onChange={(e) => patchAddon('signingOnFee', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ต่อนัดที่ลง</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.perAppearance}
                    onChange={(e) => patchAddon('perAppearance', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ต่อประตู</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.perGoal}
                    onChange={(e) => patchAddon('perGoal', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ต่อแอสซิสต์</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.perAssist}
                    onChange={(e) => patchAddon('perAssist', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs col-span-2">
                  <span>ต่อคลีนชีต (GK/DF)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.perCleanSheet}
                    onChange={(e) => patchAddon('perCleanSheet', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ขึ้นค่าเหนื่อย%/ปี</span>
                  <input
                    type="number"
                    min={0}
                    max={15}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.annualWageRisePercent ?? 0}
                    onChange={(e) => patchAddon('annualWageRisePercent', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>โบนัสค่าเหนื่อย%ยุโรป</span>
                  <input
                    type="number"
                    min={0}
                    max={25}
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.europeWageBumpPercent ?? 0}
                    onChange={(e) => patchAddon('europeWageBumpPercent', Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>ฉีกเมื่อตกชั้น (0=ฟรี)</span>
                  <input
                    type="number"
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.relegationReleaseFee ?? ''}
                    placeholder="ว่าง = ไม่ใส่"
                    onChange={(e) =>
                      patchAddon(
                        'relegationReleaseFee',
                        e.target.value === '' ? null : Number(e.target.value),
                      )
                    }
                  />
                </label>
                <label className="grid gap-0.5 text-xs">
                  <span>สถานะในทีม (สัญญา)</span>
                  <select
                    className="rounded border border-slate-300 px-2 py-1.5"
                    value={addons.contractedSquadStatus ?? ''}
                    onChange={(e) =>
                      patchAddon(
                        'contractedSquadStatus',
                        (e.target.value || undefined) as TransferAddonPackage['contractedSquadStatus'],
                      )
                    }
                  >
                    <option value="">— ไม่ระบุ —</option>
                    <option value="star">Star</option>
                    <option value="regular">Regular</option>
                    <option value="squad">Squad</option>
                    <option value="impact">Impact Sub</option>
                    <option value="prospect">Prospect</option>
                  </select>
                </label>
              </div>
            </div>
            <p className="text-xs text-slate-500">
              เอเยนต์: {AGENT_STYLE_LABEL[agentStyleFor(selectedBuy)]} ·{' '}
              {AGENT_STYLE_DESC[agentStyleFor(selectedBuy)]} · เงื่อนไขจ่ายจริงหลังแมตช์/จบฤดูกาล
            </p>
            <div className="rounded-md border border-orange-200 bg-orange-50/60 p-3 space-y-2">
              <p className="text-xs font-semibold text-orange-950">แผนจ่ายค่าตัว</p>
              <select
                className="w-full rounded-md border border-orange-300 bg-white px-2 py-1.5 text-sm"
                value={paymentPreset}
                onChange={(e) => setPaymentPreset(e.target.value as FeePaymentPreset)}
              >
                {FEE_PAYMENT_PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.labelTh} — {p.hintTh}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-orange-900/90 leading-relaxed">
                {describePaymentScheduleTh(buySchedule)}
                {paymentPreset !== 'full' ? (
                  <>
                    <br />
                    ผู้ขายประเมิน NPV ~{formatMoney(buySellerNpv)} (ผ่อนยาว/หนักท้าย → ยอมยากขึ้น)
                  </>
                ) : null}
              </p>
            </div>
            <label className="flex items-start gap-2 rounded-md border border-teal-200 bg-teal-50/70 px-3 py-2 text-xs text-teal-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={loanBackUntilNextSeason}
                onChange={(e) => setLoanBackUntilNextSeason(e.target.checked)}
              />
              <span>
                <span className="font-semibold">ซื้อแล้วให้ต้นสังกัดยืมใช้จนจบฤดูกาล</span>
                <span className="mt-0.5 block text-teal-900/80">
                  จ่ายงวดแรกทันที · นักเตะยังเล่นอยู่ทีมเดิม · ฤดูกาลหน้าค่อยเข้าทีมคุณ (เรียกกลับไม่ได้)
                </span>
              </span>
            </label>
            {(() => {
              const med = runTransferMedical(selectedBuy)
              return (
                <div
                  className={cn(
                    'rounded-md border px-3 py-2 text-xs',
                    med.grade === 'fail'
                      ? 'border-rose-300 bg-rose-50 text-rose-950'
                      : med.grade === 'caution'
                        ? 'border-amber-300 bg-amber-50 text-amber-950'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-950',
                  )}
                >
                  <p className="font-semibold">เมดิคอล: {med.message}</p>
                  {med.grade === 'caution' ? (
                    <label className="mt-1.5 flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={acceptCautionMedical}
                        onChange={(e) => setAcceptCautionMedical(e.target.checked)}
                      />
                      ยอมรับเงื่อนไข (ค่าตัว×{med.feeMul.toFixed(2)}
                      {med.forceInsurance
                        ? ` · ประกัน ~${formatMoney(med.forceInsurance)}`
                        : ''}
                      )
                    </label>
                  ) : null}
                </div>
              )
            })()}
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-lime-300 hover:bg-slate-800"
              onClick={() =>
                offerBuyPlayer(selectedBuy.id, fee, wage, years, {
                  loanBackUntilNextSeason,
                  paymentPreset,
                  acceptCautionMedical,
                })
              }
            >
              1) ส่งค่าตัวทันที
              {paymentPreset !== 'full' ? ' (ผ่อน)' : ''}
              {loanBackUntilNextSeason ? ' (+ยืมกลับ)' : ''}
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 bg-white px-4 py-2 font-semibold hover:bg-slate-50"
              onClick={() =>
                offerBuyNegotiated(
                  selectedBuy.id,
                  fee,
                  wage,
                  years,
                  addons.appearanceFee,
                  addons.sellOnPercent,
                  addons,
                  { loanBackUntilNextSeason, paymentPreset, acceptCautionMedical },
                )
              }
            >
              1) เจรจาค่าตัว (+เงื่อนไขครบ)
              {paymentPreset !== 'full' ? ' (ผ่อน)' : ''}
              {loanBackUntilNextSeason ? ' (+ยืมกลับ)' : ''}
            </button>
            {(() => {
              const vis = releaseClauseVisibility(save, selectedBuy)
              const hint = releaseIntelHintTh(save, selectedBuy)
              if (vis.status === 'known') {
                return (
                  <button
                    type="button"
                    className="w-full rounded-md border border-violet-400 bg-violet-50 px-4 py-2 font-semibold text-violet-950 hover:bg-violet-100"
                    onClick={() => triggerClause(selectedBuy.id, wage, years)}
                  >
                    กดเงื่อนไขซื้อขาด · {formatMoney(vis.value)}
                  </button>
                )
              }
              if (vis.status === 'none') {
                return (
                  <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                    ไม่มีเงื่อนไขซื้อขาดในสัญญา
                  </p>
                )
              }
              return (
                <div className="space-y-1 rounded-md border border-dashed border-violet-300 bg-violet-50/50 px-3 py-2">
                  <p className="text-xs font-semibold text-violet-950">
                    เงื่อนไขซื้อขาด: ไม่ทราบ (ความลับ)
                  </p>
                  <p className="text-[11px] text-violet-900/80">
                    สนิทกับเอเยนต์ (เจรจาค่าตัว) หรือคุยกับนักเตะจนเปิดเผย — ใช้ได้กับทุกทีมรวม AI
                  </p>
                  {hint ? <p className="text-[11px] text-slate-500">{hint}</p> : null}
                  <button
                    type="button"
                    className="w-full rounded-md border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-900 hover:bg-violet-50"
                    onClick={() => triggerClause(selectedBuy.id, wage, years)}
                  >
                    ลองสอบถามเงื่อนไขซื้อขาด
                  </button>
                </div>
              )
            })()}
            <div className="rounded-md border border-slate-200 bg-slate-50 p-3 space-y-2">
              <p className="text-xs font-semibold text-slate-600">แลกตัว + เงินปรับ</p>
              <p className="text-[11px] text-slate-500">
                ส่งนักเตะในทีมคุณแลกเป้าหมาย · เงินส่วนต่างใช้แผนจ่ายด้านบนได้ · ติ๊กยืมกลับได้เช่นกัน
              </p>
              <select
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                value={exchangeOurId}
                onChange={(e) => setExchangeOurId(e.target.value)}
              >
                <option value="">— เลือกนักเตะในทีมคุณ —</option>
                {mySquad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {formatMoney(p.value)}
                  </option>
                ))}
              </select>
              <input
                type="number"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                placeholder="เงินเพิ่ม (รวมทั้งสัญญา — ผ่อนตามแผนด้านบน)"
                value={exchangeCash}
                onChange={(e) => setExchangeCash(Number(e.target.value))}
              />
              {exchangeCash > 0 && paymentPreset !== 'full' ? (
                <p className="text-[11px] text-slate-600">
                  เงินแลก: {describePaymentScheduleTh(
                    buildFeePaymentSchedule(exchangeCash, paymentPreset, save.season),
                  )}
                </p>
              ) : null}
              <button
                type="button"
                className="w-full rounded-md border border-slate-400 bg-white px-3 py-1.5 text-sm font-semibold"
                disabled={!exchangeOurId}
                onClick={() =>
                  offerExchange(selectedBuy.id, exchangeOurId, exchangeCash, {
                    loanBackUntilNextSeason,
                    paymentPreset,
                  })
                }
              >
                แลกตัว
                {paymentPreset !== 'full' && exchangeCash > 0 ? ' (ผ่อนเงินส่วนต่าง)' : ''}
                {loanBackUntilNextSeason ? ' (+ยืมกลับ)' : ''}
              </button>
            </div>
            <button
              type="button"
              className="w-full rounded-md border border-sky-300 bg-sky-50 px-4 py-2 font-semibold text-sky-950 hover:bg-sky-100"
              onClick={() => loanInPlayer(selectedBuy.id)}
            >
              ยืมตัวเข้าทีม (12 MD)
            </button>
            {(() => {
              const bosman = canApproachBosman(save, selectedBuy.id)
              const inBosman = isBosmanApproachWindow(selectedBuy, save)
              const hasHs = hasHandshakeWith(selectedBuy, save.humanClubId)
              const know = knowledgeOf(ensureScouting(save), selectedBuy.id)
              const hints = affinityHintsTh(selectedBuy, save.clubs, know)
              return (
                <>
                  {hints.length > 0 ? (
                    <p className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] text-slate-700">
                      {hints.join(' · ')}
                    </p>
                  ) : null}
                  {hasHs ? (
                    <p className="rounded-md border border-violet-200 bg-violet-50 px-2 py-1.5 text-[11px] font-medium text-violet-950">
                      มีสัญญาใจแล้ว
                      {selectedBuy.secretHandshake?.exposed ? ' (โดนจับแล้ว)' : ' (ลับ)'}
                      — รอหน้าต่างบอสแมนแล้วเซ็นพรี-คอนแทรกต์
                    </p>
                  ) : null}
                  {!inBosman && !hasHs ? (
                    <button
                      type="button"
                      className="w-full rounded-md border border-violet-300 bg-violet-50 px-4 py-2 font-semibold text-violet-950 hover:bg-violet-100"
                      onClick={() => tryPlayerSecretHandshake(selectedBuy.id)}
                    >
                      สัญญาใจ — อย่าต่อสัญญา รอหมดแล้วเซ็นฟรี
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="w-full rounded-md border border-emerald-300 bg-emerald-50 px-4 py-2 font-semibold text-emerald-950 hover:bg-emerald-100 disabled:opacity-50"
                    disabled={!bosman.ok}
                    title={bosman.ok ? 'เซ็นล่วงหน้า ย้ายฟรีฤดูกาลหน้า' : bosman.reason}
                    onClick={() => signBosmanPreContract(selectedBuy.id, wage, years)}
                  >
                    {bosman.ok
                      ? hasHs
                        ? 'เซ็นพรี-คอนแทรกต์ (มีสัญญาใจ — ง่ายขึ้น)'
                        : 'เซ็นพรี-คอนแทรกต์ (บอสแมน / ฟรีฤดูกาลหน้า)'
                      : `บอสแมนยังไม่ได้ (${bosman.reason})`}
                  </button>
                </>
              )
            })()}
            {selectedBuy.buyBack?.clubId === save.humanClubId ? (
              <button
                type="button"
                className="w-full rounded-md border border-rose-300 bg-rose-50 px-4 py-2 font-semibold text-rose-950 hover:bg-rose-100"
                onClick={() => triggerPlayerBuyBack(selectedBuy.id)}
              >
                ใช้สิทธิ์ซื้อคืน · {formatMoney(selectedBuy.buyBack.fee)}
              </button>
            ) : null}
            <button
              type="button"
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-4 py-2 font-semibold text-amber-950 hover:bg-amber-100"
              onClick={() => togglePlayerShortlist(selectedBuy.id)}
            >
              {isShortlisted(save, selectedBuy.id) ? 'เอาออกจาก Shortlist' : 'ใส่ Shortlist'}
            </button>
          </div>
        ) : null}

        {tab === 'sell' && selectedSell ? (
          <div className="mt-3 space-y-3 text-sm">
            <p className="flex items-center gap-2">
              <PlayerFace name={selectedSell.name} size="md" />
              <span>
                <strong>{selectedSell.name}</strong> · {roleShort(selectedSell.role)} · OVR{' '}
                {selectedSell.overall}
              </span>
            </p>
            <p className="text-slate-600">
              มูลค่าประเมิน: {formatMoney(selectedSell.value)}
              {marketValueHints(selectedSell).length > 0 ? (
                <>
                  <br />
                  <span className="text-amber-900">
                    {marketValueHints(selectedSell).join(' · ')}
                  </span>
                </>
              ) : null}
              {(selectedSell.marketHeat ?? 0) > 0 ? (
                <>
                  <br />
                  <span className="text-xs text-slate-500">
                    ฟอร์ม {selectedSell.form}/20 · ความสนใจตลาด {selectedSell.marketHeat}/20
                  </span>
                </>
              ) : null}
              <br />
              สัญญาถึงฤดูกาล {selectedSell.contractEndSeason ?? '—'} · เหลือ ~
              {selectedSell.contractYears ?? '—'} ปี · ค่าเหนื่อย{' '}
              {formatMoney(selectedSell.wage)}
              <br />
              {releaseClauseLabelTh(save, selectedSell, formatMoney)}
              <br />
              เอเยนต์: {AGENT_STYLE_LABEL[agentStyleFor(selectedSell)]} ·{' '}
              {AGENT_STYLE_DESC[agentStyleFor(selectedSell)]}
            </p>
            <label className="grid gap-1">
              <span>ตั้งราคาขาย</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </label>
            <label className="flex items-start gap-2 rounded-md border border-rose-200 bg-rose-50/70 px-3 py-2 text-xs text-rose-950">
              <input
                type="checkbox"
                className="mt-0.5"
                checked={allowSellToRival}
                onChange={(e) => setAllowSellToRival(e.target.checked)}
              />
              <span>
                <span className="font-semibold">ฝ่าฝืนสุภาพบุรุษ — ยอมขายให้คู่แข่ง</span>
                <span className="mt-0.5 block text-rose-900/80">
                  ค่าเริ่มต้นบล็อกขายให้คู่แข่ง · ติ๊กนี้แฟนจะโกรธแรง
                </span>
              </span>
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-lime-300 hover:bg-slate-800"
              onClick={() =>
                offerSellPlayer(selectedSell.id, fee, { allowToRival: allowSellToRival })
              }
            >
              เสนอขายให้ AI
            </button>
            <button
              type="button"
              className="w-full rounded-md border border-violet-300 bg-violet-50 px-4 py-2 font-semibold text-violet-950 hover:bg-violet-100"
              onClick={() => startPlayerAuction(selectedSell.id, fee)}
            >
              เปิดประมูล (AI ประมูล 2 MD)
            </button>
            <div className="rounded-md border border-sky-200 bg-sky-50/80 p-3 space-y-2">
              <p className="text-xs font-semibold text-sky-950">
                ปล่อยยืมออก (12 MD · เรียกกลับเฉพาะวินเทอร์ · ห้ามลงเจอทีมแม่)
              </p>
              <select
                className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
                value={loanOutClubId}
                onChange={(e) => setLoanOutClubId(e.target.value)}
              >
                <option value="">— เลือกคลับ AI ที่จะยืม —</option>
                {save.clubs
                  .filter((c) => c.controlledBy === 'ai' && c.id !== save.humanClubId)
                  .sort((a, b) => b.reputation - a.reputation)
                  .slice(0, 40)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · rep {c.reputation}
                    </option>
                  ))}
              </select>
              <label className="grid gap-0.5 text-xs">
                <span>ต้นสังกัดจ่ายค่าเหนื่อย {Math.round(loanWageShare * 100)}%</span>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={Math.round(loanWageShare * 100)}
                  onChange={(e) => setLoanWageShare(Number(e.target.value) / 100)}
                />
              </label>
              <select
                className="w-full rounded-md border border-sky-300 bg-white px-2 py-1.5 text-sm"
                value={loanObligation}
                onChange={(e) =>
                  setLoanObligation(e.target.value as typeof loanObligation)
                }
              >
                <option value="">ไม่บังคับซื้อ</option>
                <option value="always">Obligation: บังคับซื้อเมื่อจบยืม</option>
                <option value="avoid_relegation">Obligation: ซื้อถ้าทีมยืมรอดตกชั้น</option>
                <option value="appearances">Obligation: ซื้อถ้ารวมนัดถึงเป้า</option>
              </select>
              {loanObligation ? (
                <input
                  type="number"
                  className="w-full rounded-md border border-sky-300 px-2 py-1.5 text-sm"
                  placeholder="ราคาบังคับซื้อ"
                  value={loanObligationFee || Math.round(selectedSell.value * 1.05)}
                  onChange={(e) => setLoanObligationFee(Number(e.target.value))}
                />
              ) : null}
              <button
                type="button"
                className="w-full rounded-md border border-sky-400 bg-white px-3 py-1.5 text-sm font-semibold text-sky-950 hover:bg-sky-100 disabled:opacity-50"
                disabled={!loanOutClubId}
                onClick={() => {
                  if (!loanOutClubId) return
                  loanOutPlayer(selectedSell.id, loanOutClubId, {
                    wageShareParent: loanWageShare,
                    obligationMode: loanObligation || null,
                    obligationToBuy: loanObligation
                      ? loanObligationFee || Math.round(selectedSell.value * 1.05)
                      : null,
                    obligationAppearances: 15,
                    recallWinterOnly: true,
                  })
                  setLoanOutClubId('')
                }}
              >
                ปล่อยยืมออก
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className="flex-1 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-950"
                onClick={() =>
                  setPlayerTransferListed(
                    selectedSell.id,
                    !selectedSell.transferListed,
                    fee,
                  )
                }
              >
                {selectedSell.transferListed ? 'เอาออกจากบัญชีย้าย' : 'ขึ้นบัญชีย้ายทีม'}
              </button>
              <button
                type="button"
                className="flex-1 rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-950"
                onClick={() => mutualTerminatePlayer(selectedSell.id)}
              >
                ยกเลิกสัญญา (Mutual)
              </button>
            </div>
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <p className="font-semibold text-slate-800">ต่อสัญญา</p>
              <p className="mt-1 text-[11px] text-slate-500">
                เจรจาหลายรอบตามนิสัยเอเยนต์/นักเตะ · จุดติดอาจเป็นค่าเหนื่อย · ปี · เงินเซ็น ·
                โบนัสลงแข่ง — ยกเลิกได้ถ้าไม่ลงตัว
              </p>
              {(() => {
                const open = (save.contractTalks?.talks ?? []).find(
                  (t) => t.playerId === selectedSell.id && t.status === 'open',
                )
                const style = agentStyleFor(selectedSell)
                const prof = negotiationProfile(selectedSell, style)
                return (
                  <>
                    <p className="mt-1 rounded bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                      {agentLabelTh(selectedSell)}
                      {selectedSell.agentKind
                        ? ` · ${AGENT_KIND_LABEL[selectedSell.agentKind]}`
                        : ''}
                    </p>
                    <p className="mt-1 text-[11px] text-slate-500">
                      สไตล์เจรจา: {AGENT_STYLE_LABEL[style]} — {AGENT_STYLE_DESC[style]} · สูงสุด{' '}
                      {open?.maxRounds ?? prof.maxRounds} รอบ
                    </p>
                    {open ? (
                      <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-950">
                        รอบ {open.round}/{open.maxRounds}
                        {open.focus ? ` · จุดติด: ${focusLabelTh(open.focus)}` : ''}
                        {(open.askSigningOn ?? 0) > 0
                          ? ` · ขอเงินเซ็น ~${formatMoney(open.askSigningOn!)}`
                          : ''}
                        {(open.askPerAppearance ?? 0) > 0
                          ? ` · ขอโบนัสนัด ~${formatMoney(open.askPerAppearance!)}`
                          : ''}
                        {(open.askPerGoal ?? 0) > 0
                          ? ` · ขอโบนัสประตู ~${formatMoney(open.askPerGoal!)}`
                          : ''}
                        <br />
                        {open.note}
                      </p>
                    ) : null}
                  </>
                )
              })()}
              <div className="mt-2 grid grid-cols-2 gap-2">
                <label className="grid gap-1">
                  <span className="text-xs text-slate-500">ค่าเหนื่อย</span>
                  <input
                    type="number"
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                    value={wage}
                    onChange={(e) => setWage(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-500">ปี</span>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                    value={years}
                    onChange={(e) => setYears(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-500">เงินเซ็น</span>
                  <input
                    type="number"
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                    value={signingOn}
                    onChange={(e) => setSigningOn(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-xs text-slate-500">โบนัส/นัด</span>
                  <input
                    type="number"
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                    value={perAppearanceBonus}
                    onChange={(e) => setPerAppearanceBonus(Number(e.target.value))}
                  />
                </label>
                <label className="grid gap-1 col-span-2">
                  <span className="text-xs text-slate-500">โบนัส/ประตู (ถ้าขอ)</span>
                  <input
                    type="number"
                    className="rounded-md border border-slate-300 px-2 py-1.5"
                    value={perGoalBonus}
                    onChange={(e) => setPerGoalBonus(Number(e.target.value))}
                  />
                </label>
              </div>
              <button
                type="button"
                className="mt-2 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-white"
                onClick={() =>
                  renewPlayerContract(selectedSell.id, wage, years, {
                    signingOnFee: signingOn,
                    perAppearance: perAppearanceBonus,
                    perGoal: perGoalBonus,
                  })
                }
              >
                ยื่นข้อเสนอรอบนี้
              </button>
              {(save.contractTalks?.talks ?? []).some(
                (t) => t.playerId === selectedSell.id && t.status === 'open',
              ) ? (
                <button
                  type="button"
                  className="mt-2 w-full rounded-md border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-950 hover:bg-rose-100"
                  onClick={() => cancelPlayerContractTalk(selectedSell.id)}
                >
                  ยกเลิกการเจรจา (ไม่ลงตัว)
                </button>
              ) : null}
              <p className="mt-1 text-[11px] text-slate-500">
                แต่ละรอบมีจุดติดชัดเจน · ครบรอบแล้วยังไม่ตกลง = เอเยนต์พาเดินออก · ยกเลิกเองได้แต่เบากว่า
              </p>
            </div>
          </div>
        ) : null}

        {!selectedId ? (
          <p className="mt-3 text-sm text-slate-500">
            เลือกนักเตะเพื่อดูว่าทำไมควรซื้อ/ขาย — AI จะแตกเหตุผลหลายมุมให้
          </p>
        ) : null}

        {intel ? (
          <TransferIntelPanel
            intel={intel}
            addonIntel={addonIntel}
            onApplySuggestion={() => {
              setFee(intel.suggestedFee)
              if (intel.suggestedWage) setWage(intel.suggestedWage)
            }}
          />
        ) : null}
      </aside>
    </div>
  )
}
