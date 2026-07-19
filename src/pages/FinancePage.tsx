import { useGameStore } from '@/store/gameStore'
import { formatMoney } from '@/lib/format'
import { ffpStatus } from '@/game/financeFfp'

export function FinancePage() {
  const save = useGameStore((s) => s.save)!
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const weeklyWages = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .reduce((s, p) => s + p.wage, 0)
  const ffp = ffpStatus(save)

  return (
    <section className="max-w-xl rounded-xl border border-slate-200 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">การเงิน</h2>
      <p className="text-sm text-slate-500">FFP-lite · ค่าเหนื่อย · ตั๋วเหย้า</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">เงินในบัญชี</dt>
          <dd className="text-lg font-bold">{formatMoney(club.balance)}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">ยอดต้นฤดูกาล</dt>
          <dd className="font-semibold">{formatMoney(club.seasonStartBalance)}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">ค่าเหนื่อยรวม/สัปดาห์</dt>
          <dd className="font-semibold">
            {formatMoney(weeklyWages)} / งบ {formatMoney(club.wageBudgetWeekly)}
          </dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">FFP</dt>
          <dd className={ffp.ok ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
            {ffp.warning ?? 'ผ่านเกณฑ์'}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">ความจุสนาม</dt>
          <dd className="font-semibold">{club.stadiumCapacity.toLocaleString('th-TH')}</dd>
        </div>
      </dl>
    </section>
  )
}
