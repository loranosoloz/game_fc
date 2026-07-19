import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import type { TrainingFocus } from '@/game/types'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import { formatInjuryStatus, INJURY_TYPE_LABEL } from '@/game/medical'

const FOCUSES: { id: TrainingFocus; label: string }[] = [
  { id: 'tactics', label: 'แท็กติก' },
  { id: 'fitness', label: 'ฟิตเนส' },
  { id: 'attacking', label: 'เกมรุก' },
  { id: 'defending', label: 'เกมรับ' },
  { id: 'setpieces', label: 'ลูกตั้งเตะ' },
  { id: 'rest', label: 'พักฟื้น' },
]

const INTENSITY: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']

export function TrainingPage() {
  const save = useGameStore((s) => s.save)!
  const setTraining = useGameStore((s) => s.setTraining)
  const runTrainingNow = useGameStore((s) => s.runTrainingNow)

  const injured = save.players
    .filter((p) => p.clubId === save.humanClubId && p.injuryDays > 0)
    .sort((a, b) => b.injuryDays - a.injuryDays)

  const lowCond = save.players
    .filter((p) => p.clubId === save.humanClubId && p.injuryDays <= 0 && p.condition < 70)
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 8)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">การซ้อม</h2>
        <p className="text-sm text-slate-600">
          หลังทุกแมตช์เดย์จะซ้อมอัตโนมัติตามแผนนี้ — กดซ้อมพิเศษได้ถ้าต้องการ
        </p>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">โฟกัส</p>
          <div className="flex flex-wrap gap-2">
            {FOCUSES.map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setTraining({ focus: f.id })}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium',
                  save.training.focus === f.id
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white hover:bg-slate-50',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">ความเข้ม</p>
          <div className="flex flex-wrap gap-2">
            {INTENSITY.map((level) => (
              <button
                key={level}
                type="button"
                onClick={() => setTraining({ intensity: level })}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium capitalize',
                  save.training.intensity === level
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white hover:bg-slate-50',
                )}
              >
                {level}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            High = คมขึ้นเร็ว แต่เสี่ยงเจ็บจากซ้อม · Rest = ฟื้นสภาพ
          </p>
        </div>

        <button
          type="button"
          onClick={runTrainingNow}
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
        >
          ซ้อมพิเศษตอนนี้
        </button>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="text-lg font-semibold">Medical (สรุป)</h2>
          <Link
            to="/medical"
            className="text-xs font-medium text-slate-700 underline underline-offset-2"
          >
            เปิด Medical Centre →
          </Link>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">บาดเจ็บ ({injured.length})</h3>
          {injured.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">ไม่มีนักเตะเจ็บ</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {injured.map((p) => (
                <li
                  key={p.id}
                  className="flex justify-between rounded bg-rose-50 px-2 py-1.5 text-rose-900"
                >
                  <span>
                    <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                    {p.injuryType ? (
                      <span className="ml-1 text-xs text-rose-700">
                        ({INJURY_TYPE_LABEL[p.injuryType]})
                      </span>
                    ) : null}
                  </span>
                  <span>{p.injuryDays} วัน</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-slate-700">สภาพต่ำ</h3>
          {lowCond.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">สควอดฟิตดี</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {lowCond.map((p) => (
                <li key={p.id} className="flex justify-between rounded bg-amber-50 px-2 py-1.5">
                  <span>
                    <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                  </span>
                  <span>{formatInjuryStatus(p)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  )
}
