import { useGameStore } from '@/store/gameStore'
import { upgradeAcademy } from '@/game/youth'
import { roleShort } from '@/game/positions'
import { formatMoney } from '@/lib/format'

export function YouthPage() {
  const save = useGameStore((s) => s.save)!
  const upgradeYouthAcademy = useGameStore((s) => s.upgradeYouthAcademy)
  const cost = 250_000 + save.youth.academyLevel * 120_000
  const youth = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .sort((a, b) => b.pa - a.pa)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">Youth academy</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">ระดับอะคาเดมี่</dt>
            <dd className="text-xl font-bold">{save.youth.academyLevel}/20</dd>
          </div>
          <div>
            <dt className="text-slate-500">Intake ถัดไป</dt>
            <dd className="font-semibold">แมตช์เดย์ {save.youth.nextIntakeMatchday}</dd>
          </div>
        </dl>
        <p className="text-sm text-slate-600">{save.youth.lastIntakeNote}</p>
        <button
          type="button"
          onClick={upgradeYouthAcademy}
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
        >
          อัปเกรดอะคาเดมี่ ({formatMoney(cost)})
        </button>
        <p className="text-xs text-slate-500">
          ค่าใช้จ่ายจริงตอนกดจะเช็คงบในคลับ · {upgradeAcademy(save).ok ? 'พร้อมอัป' : 'งบอาจไม่พอ'}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">นักเตะเยาวชนในชุดใหญ่</h2>
        <ul className="mt-3 space-y-1 text-sm">
          {youth.length === 0 ? (
            <li className="text-slate-500">ยังไม่มี — รอ intake</li>
          ) : (
            youth.map((p) => (
              <li key={p.id} className="flex justify-between rounded bg-slate-50 px-2 py-1.5">
                <span>
                  <span className="font-semibold">{roleShort(p.role)}</span> {p.name} · {p.age}ย
                </span>
                <span>
                  OVR {p.overall} · PA {p.pa}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
