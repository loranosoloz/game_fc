import { useGameStore } from '@/store/gameStore'
import { formatMoney } from '@/lib/format'
import { ffpStatus } from '@/game/financeFfp'
import { ensureClubFinance, PLAYER_SPENDINGS } from '@/game/playerEconomy'
import { cashflowForecast, ensureClubIncome, prizeAmountFor, prizeTable, domesticPrizeScale } from '@/game/clubIncome'
import { DISCIPLINE_FINES } from '@/game/disciplineFines'
import { ensurePhase5 } from '@/game/save'
import {
  ensureFacilities,
  FACILITY_LABEL,
  facilityUpgradeCost,
  facilityCurrentTier,
  facilityMaxTier,
  facilityProgressLabel,
  stadiumCapacityForTier,
} from '@/game/facilities'
import type { FacilityKind } from '@/game/types'
import { PageHeader, Panel, ProgressBar, StatTile, GhostButton } from '@/components/ui'
import {
  ensureInsolvency,
  insolvencyLabelTh,
} from '@/game/insolvency'

export function FinancePage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const proposeFacilityUpgrade = useGameStore((s) => s.proposeFacilityUpgrade)
  const requestOwnerBailout = useGameStore((s) => s.requestOwnerBailout)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const finance = ensureClubFinance(save)
  const income = ensureClubIncome(save)
  const facilities = ensureFacilities(save)
  const forecast = cashflowForecast(save)
  const insolvency = ensureInsolvency(save)
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const weeklyWages = squad.reduce((s, p) => s + p.wage, 0)
  const squadCash = squad.reduce((s, p) => s + (p.cash ?? 0), 0)
  const wagePct = Math.min(100, Math.round((weeklyWages / club.wageBudgetWeekly) * 100))
  const ffp = ffpStatus(save)
  const delta = club.balance - club.seasonStartBalance
  const topWages = [...squad].sort((a, b) => b.wage - a.wage).slice(0, 6)
  const richest = [...squad].sort((a, b) => (b.cash ?? 0) - (a.cash ?? 0)).slice(0, 6)
  const spendLogs = finance.spendLogs.slice(0, 12)
  const ledger = finance.ledger.slice(0, 10)
  const fireSaleNames = insolvency.fireSalePlayerIds
    .map((id) => squad.find((p) => p.id === id)?.name)
    .filter(Boolean)

  return (
    <div className="space-y-5">
      <PageHeader
        title="การเงิน"
        subtitle="ตั๋ว·เสื้อ·สปอนเซอร์·TV·รางวัลถ้วย · พยากรณ์กระแสเงิน · FFP · วิกฤตสภาพคล่อง"
      />

      {insolvency.stage !== 'ok' ? (
        <Panel tone="warn">
          <h3 className="text-sm font-bold text-slate-900">
            {insolvencyLabelTh(insolvency.stage)}
          </h3>
          <p className="mt-1 text-xs text-slate-600">{insolvency.lastNote}</p>
          <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">ค้างค่าเหนื่อย</dt>
              <dd className="font-semibold text-rose-700">
                {formatMoney(insolvency.unpaidWages)}
              </dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">สตรีคติดลบ</dt>
              <dd className="font-semibold">{insolvency.negativeStreak} MD</dd>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2">
              <dt className="text-xs text-slate-500">หักแต้มฤดูกาลนี้</dt>
              <dd className="font-semibold">
                {insolvency.pointsDeductedThisSeason > 0
                  ? `${insolvency.pointsDeductedThisSeason} ครั้ง`
                  : '—'}
              </dd>
            </div>
          </dl>
          {fireSaleNames.length > 0 ? (
            <p className="mt-2 text-xs text-rose-800">
              Fire sale: {fireSaleNames.join(' · ')}
            </p>
          ) : null}
          <p className="mt-2 text-xs text-slate-500">
            ห้ามซื้อ · ขายเพื่อเคลียร์หนี้ · หรือขอเจ้าของฉีดเงิน / เปิดทางเทคโอเวอร์
          </p>
          <div className="mt-3">
            <GhostButton type="button" onClick={() => requestOwnerBailout()}>
              ขอเจ้าของฉีดเงินกู้วิกฤต
            </GhostButton>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="เงินในบัญชี" value={formatMoney(club.balance)} accent />
        <StatTile
          label="ตั๋วฤดูกาลนี้"
          value={formatMoney(finance.ticketSeason || club.ticketRevenueSeason || 0)}
          hint={
            finance.lastMatchCrowd
              ? `นัดเหย้าล่าสุด ผู้ชม ~${finance.lastMatchCrowd.toLocaleString('th-TH')}`
              : 'หลังนัดเหย้าจะอัปเดต'
          }
        />
        <StatTile
          label="สปอนเซอร์ฤดูกาล"
          value={formatMoney(finance.sponsorSeason ?? 0)}
          hint={income.sponsors.map((s) => s.name).join(' · ')}
        />
        <StatTile
          label="TV + รางวัล"
          value={formatMoney((finance.tvSeason ?? 0) + (finance.prizeSeason ?? 0))}
          hint={`TV ${formatMoney(finance.tvSeason ?? 0)} · ถ้วย ${formatMoney(finance.prizeSeason ?? 0)}`}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="เทียบต้นฤดูกาล"
          value={`${delta >= 0 ? '+' : ''}${formatMoney(delta)}`}
          hint={`เริ่มที่ ${formatMoney(club.seasonStartBalance)}`}
        />
        <StatTile
          label="ค่าเหนื่อยจ่ายสะสม"
          value={formatMoney(finance.wageSeason)}
          hint={`งบสัปดาห์ ${formatMoney(club.wageBudgetWeekly)} · ${wagePct}%`}
        />
        <StatTile
          label="ค่าปรับวินัย (เข้าคลับ)"
          value={formatMoney(finance.fineSeason ?? 0)}
          hint={`DB ปรับ ${DISCIPLINE_FINES.length} แบบ · สุ่มหน้างาน`}
        />
        <StatTile
          label="FFP"
          value={
            'exempt' in ffp && ffp.exempt
              ? 'ยกเว้น'
              : ffp.ok
                ? ffp.nearBreach
                  ? 'ใกล้เพดาน'
                  : 'ผ่าน'
                : 'บล็อก'
          }
          hint={
            'exempt' in ffp && ffp.exempt
              ? ffp.exemptLabel
              : (ffp.warning ?? 'อยู่ในเกณฑ์')
          }
        />
      </div>

      <Panel tone={ffp.ok ? undefined : 'warn'}>
        <h3 className="text-sm font-bold text-slate-900">Financial Fair Play</h3>
        <p className="mt-1 text-xs text-slate-500">
          {'exempt' in ffp && ffp.exempt
            ? 'ซาอุดี Pro League — บอร์ดไม่บังคับ FFP (เงินถุงเงินถัง) · ซื้อได้ตามเงินในบัญชี'
            : 'บล็อกซื้อถ้าขาดทุนเกินเพดาน · ค่าเหนื่อยเกินงบ · หรือซื้อสุทธิเกินเพดานตลาด — ฝ่าเพดานหนักบอร์ดระงับตลาด 3 MD'}
        </p>
        {'exempt' in ffp && ffp.exempt ? null : (
        <dl className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">ขาดทุนฤดูกาล</dt>
            <dd className={ffp.lossOk ? 'font-semibold' : 'font-semibold text-rose-700'}>
              {formatMoney(ffp.loss)} / {formatMoney(ffp.maxLoss)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">ค่าเหนื่อย / งบสัปดาห์</dt>
            <dd className={ffp.wageOk ? 'font-semibold' : 'font-semibold text-rose-700'}>
              {formatMoney(ffp.wages)} / {formatMoney(ffp.wageBudget)}
            </dd>
          </div>
          <div className="rounded-lg bg-slate-50 px-3 py-2">
            <dt className="text-xs text-slate-500">ซื้อสุทธิ / เพดานตลาด</dt>
            <dd className={ffp.transferOk ? 'font-semibold' : 'font-semibold text-rose-700'}>
              {formatMoney(ffp.netSpend)} / {formatMoney(ffp.transferCap)}
            </dd>
            <dd className="text-[10px] text-slate-500">
              จ่ายซื้อ {formatMoney(ffp.transferOut)} · รับขาย {formatMoney(ffp.transferIn)}
            </dd>
          </div>
        </dl>
        )}
        {ffp.boardFrozen ? (
          <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
            ตลาดถูกระงับชั่วคราว — {ffp.warning}
          </p>
        ) : null}
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ตารางเงินรางวัลถ้วย</h3>
        <p className="mt-1 text-xs text-slate-500">
          ถ้วยในประเทศสเกลตามลีก ×{domesticPrizeScale(save.leagueId).toFixed(2)} · ถ้วยทวีปยอดคงที่
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[28rem] text-left text-xs">
            <thead>
              <tr className="border-b border-slate-200 text-slate-500">
                <th className="py-1.5 pr-2 font-medium">ถ้วย</th>
                <th className="py-1.5 pr-2 font-medium">แชมป์</th>
                <th className="py-1.5 pr-2 font-medium">รองฯ</th>
                <th className="py-1.5 pr-2 font-medium">QF</th>
                <th className="py-1.5 font-medium">SF</th>
              </tr>
            </thead>
            <tbody>
              {(
                [
                  ['ucl', 'UCL'],
                  ['uel', 'Europa'],
                  ['uecl', 'Conference'],
                  ['acl', 'ACL'],
                  ['asean_cup', 'ASEAN'],
                  ['cup', 'ถ้วยชาติ'],
                  ['league_cup', 'ลีกคัพ'],
                  ['trophy', 'ถ้วยลีกล่าง'],
                ] as const
              ).map(([key, label]) => {
                const prizes = prizeTable()
                const progress =
                  key === 'ucl' ||
                  key === 'uel' ||
                  key === 'uecl' ||
                  key === 'acl' ||
                  key === 'asean_cup'
                    ? (prizes.progress as Record<string, { qf: number; sf: number }>)[key]
                    : null
                const champ = prizeAmountFor(save, key, 'champion')
                const ru = prizeAmountFor(save, key, 'runnerUp')
                return (
                  <tr key={key} className="border-b border-slate-100">
                    <td className="py-1.5 pr-2 font-medium text-slate-800">{label}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{formatMoney(champ)}</td>
                    <td className="py-1.5 pr-2 tabular-nums">{formatMoney(ru)}</td>
                    <td className="py-1.5 pr-2 tabular-nums text-slate-600">
                      {progress ? formatMoney(progress.qf) : '—'}
                    </td>
                    <td className="py-1.5 tabular-nums text-slate-600">
                      {progress ? formatMoney(progress.sf) : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          รางวัลถ้วยฤดูกาลนี้สะสม {formatMoney(finance.prizeSeason ?? 0)} · เช่น ไทยลีกถ้วยชาติ ≈{' '}
          {formatMoney(prizeAmountFor({ ...save, leagueId: 'tha' } as typeof save, 'cup', 'champion'))}{' '}
          · พรีเมียร์ลีก ≈ {formatMoney(prizeAmountFor({ ...save, leagueId: 'eng' } as typeof save, 'cup', 'champion'))}
        </p>
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">พยากรณ์กระแสเงิน 6 แมตช์เดย์</h3>
        <p className="mt-1 text-xs text-slate-500">
          สปอนเซอร์+TV ต่อ MD ลบค่าเหนื่อย (ยังไม่รวมตั๋วนัดเหย้า/ซื้อขาย)
        </p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {forecast.map((row) => (
            <li
              key={row.matchday}
              className="rounded-lg bg-slate-50 px-3 py-2 text-xs"
            >
              <span className="font-semibold">MD{row.matchday}</span>
              <span className="mt-0.5 block text-slate-600">
                เข้า {formatMoney(row.income)} · จ่าย {formatMoney(row.wages)}
              </span>
              <span
                className={
                  row.net >= 0 ? 'font-semibold text-lime-800' : 'font-semibold text-rose-700'
                }
              >
                สุทธิ {row.net >= 0 ? '+' : ''}
                {formatMoney(row.net)} → {formatMoney(row.projectedBalance)}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          กระเป๋านักเตะรวม {formatMoney(squadCash)} · ขายเสื้อฤดูกาล{' '}
          {formatMoney(finance.shirtSeason || 0)}
        </p>
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">สนามและสิ่งอำนวยความสะดวก</h3>
        <p className="mt-1 text-xs text-slate-500">
          ผู้จัดการเสนอได้เท่านั้น — เจ้าของอนุมัติที่หน้าบอร์ด/แฟน · เงินหักจากบัญชีสโมสร ·
          สนาม Lv.n ≈ n×10,000 ที่นั่ง (Lv.10 = 100,000) · ทีมใหญ่เพดานสูงกว่า
        </p>
        {facilities.pendingProposal ? (
          <p className="mt-2 rounded-md bg-sky-50 px-3 py-2 text-sm text-sky-950">
            รอเจ้าของ: {facilities.pendingProposal.note} ·{' '}
            {formatMoney(facilities.pendingProposal.cost)} — ไปหน้าบอร์ด/แฟนเพื่ออนุมัติ
          </p>
        ) : facilities.project ? (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            กำลังก่อสร้าง: {facilities.project.note} · เสร็จ MD{facilities.project.doneMatchday}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{facilities.lastNote}</p>
        )}
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              'stadium',
              'training',
              'medical',
              'commercial',
              'youth',
            ] as FacilityKind[]
          ).map((kind) => {
            const tier = facilityCurrentTier(facilities, kind)
            const max = facilityMaxTier(facilities, kind)
            const atCap = tier >= max
            const canPropose =
              !facilities.project && !facilities.pendingProposal && !atCap
            return (
              <div key={kind} className="rounded-md bg-slate-50 px-2 py-2">
                <dt className="text-slate-500 leading-tight">{FACILITY_LABEL[kind]}</dt>
                <dd className="text-lg font-bold">
                  {tier}/{max}
                </dd>
                <dd className="text-[10px] leading-snug text-slate-500">
                  {facilityProgressLabel(facilities, kind)}
                </dd>
                <dd className="mt-0.5 text-[10px] text-slate-400">
                  {atCap ? 'เพดานคลับ' : formatMoney(facilityUpgradeCost(kind, tier))}
                </dd>
                <GhostButton
                  className="mt-1 w-full text-xs"
                  onClick={() => proposeFacilityUpgrade(kind)}
                  disabled={!canPropose}
                >
                  เสนอเจ้าของ
                </GhostButton>
              </div>
            )
          })}
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          ความจุปัจจุบัน {club.stadiumCapacity.toLocaleString('th-TH')} ที่นั่ง · เพดานคลับ{' '}
          {stadiumCapacityForTier(facilities.maxStadiumTier).toLocaleString('th-TH')} · เงินในบัญชี{' '}
          {formatMoney(club.balance)}
        </p>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">งบค่าเหนื่อย</h3>
          <ProgressBar value={wagePct} max={100} className="mt-3" />
          <p className="mt-2 text-xs text-slate-500">
            จ่ายเข้ากระเป๋านักเตะทุกแมตช์เดย์ · ความจุสนาม{' '}
            {club.stadiumCapacity.toLocaleString('th-TH')} ที่นั่ง
          </p>
          <ul className="mt-3 space-y-2">
            {topWages.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="font-semibold tabular-nums">{formatMoney(p.wage)}/สัปดาห์</span>
              </li>
            ))}
          </ul>
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">รวยสุดในห้องแต่งตัว</h3>
          <ul className="mt-3 space-y-2">
            {richest.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-slate-800">{p.name}</span>
                <span className="font-semibold tabular-nums text-lime-800">
                  {formatMoney(p.cash ?? 0)}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">สมุดบัญชีสนาม</h3>
          {ledger.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายการ — เล่นนัดเหย้า / จ่ายค่าเหนื่อย</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {ledger.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-2 rounded-md border border-slate-100 px-3 py-2"
                >
                  <span>
                    <span className="text-[10px] font-bold tracking-wide text-slate-400 uppercase">
                      {e.kind}
                    </span>
                    <span className="mt-0.5 block text-slate-700">{e.note}</span>
                  </span>
                  <span
                    className={
                      e.amount >= 0
                        ? 'shrink-0 font-semibold text-lime-800'
                        : 'shrink-0 font-semibold text-rose-700'
                    }
                  >
                    {e.amount >= 0 ? '+' : ''}
                    {formatMoney(e.amount)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel tone="warn">
          <h3 className="text-sm font-bold text-slate-900">ค่าปรับวินัยล่าสุด</h3>
          <p className="mt-1 text-xs text-amber-900/80">
            DB {DISCIPLINE_FINES.length} แบบ — สุ่มตามหน้างาน (ขาดซ้อม / ผับ / พนัน / ใบแดง ฯลฯ)
          </p>
          {(finance.fineLogs ?? []).length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มี — พอมีเคสวินัยจะหักเงินเข้าตรงนี้</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {(finance.fineLogs ?? []).slice(0, 12).map((l) => (
                <li key={l.id} className="rounded-md border border-rose-100 bg-white/80 px-3 py-2">
                  <p className="font-semibold text-slate-900">
                    {l.playerName} · {l.labelTh}
                  </p>
                  <p className="text-xs text-slate-600">
                    −{formatMoney(l.amount)} · {l.note}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel tone="warn">
          <h3 className="text-sm font-bold text-slate-900">นักเตะใช้เงินล่าสุด</h3>
          <p className="mt-1 text-xs text-amber-900/80">
            จากฐานข้อมูล {PLAYER_SPENDINGS.length} รายการ — รถหรู / การกุศล / ผับ / ลงทุน ฯลฯ
          </p>
          {spendLogs.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มี — ผ่านแมตช์เดย์เพื่อจำลองการใช้จ่าย</p>
          ) : (
            <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm">
              {spendLogs.map((l) => (
                <li key={l.id} className="rounded-md border border-amber-100 bg-white/80 px-3 py-2">
                  <p className="font-semibold text-slate-900">
                    {l.playerName} · {l.labelTh}
                  </p>
                  <p className="text-xs text-slate-600">
                    −{formatMoney(l.amount)} · {l.note}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
