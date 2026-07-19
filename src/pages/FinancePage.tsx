import { useGameStore } from '@/store/gameStore'
import { formatMoney } from '@/lib/format'
import { ffpStatus } from '@/game/financeFfp'
import { ensureClubFinance, PLAYER_SPENDINGS } from '@/game/playerEconomy'
import { ensurePhase5 } from '@/game/save'
import { PageHeader, Panel, ProgressBar, StatTile } from '@/components/ui'

export function FinancePage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const finance = ensureClubFinance(save)
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="การเงิน"
        subtitle="ตั๋ว + เสื้อเข้าคลับ · ค่าเหนื่อยเข้ากระเป๋านักเตะ · DB การใช้จ่ายส่วนตัว"
      />

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
          label="ขายเสื้อฤดูกาลนี้"
          value={formatMoney(finance.shirtSeason || club.shirtRevenueSeason || 0)}
          hint={
            finance.lastMatchShirts
              ? `นัดล่าสุด ${formatMoney(finance.lastMatchShirts)}`
              : undefined
          }
        />
        <StatTile
          label="กระเป๋านักเตะรวม"
          value={formatMoney(squadCash)}
          hint={`ค่าเหนื่อย/สัปดาห์ ${formatMoney(weeklyWages)}`}
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
          label="FFP"
          value={ffp.ok ? 'ผ่าน' : 'เสี่ยง'}
          hint={ffp.warning ?? 'อยู่ในเกณฑ์'}
        />
        <StatTile
          label="รายการใช้จ่ายใน DB"
          value={PLAYER_SPENDINGS.length}
          hint="นักเตะสุ่มใช้ตามบุคลิก/เงิน"
        />
      </div>

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

      <div className="grid gap-5 lg:grid-cols-2">
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
