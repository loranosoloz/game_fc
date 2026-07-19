import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { cn } from '@/lib/cn'

export function TablePage() {
  const save = useGameStore((s) => s.save)!
  const rows = sortedTable(save.table)

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">พรีเมียร์ ดิวิชัน</h2>
      <p className="text-sm text-slate-500">
        20 สโมสร · ผลจากนัดของคุณและ AI อัปเดตตารางเดียวกัน
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">สโมสร</th>
              <th className="py-2 pr-2 font-medium">คุมโดย</th>
              <th className="py-2 pr-2 font-medium">แข่ง</th>
              <th className="py-2 pr-2 font-medium">ชนะ</th>
              <th className="py-2 pr-2 font-medium">เสมอ</th>
              <th className="py-2 pr-2 font-medium">แพ้</th>
              <th className="py-2 pr-2 font-medium">ได้</th>
              <th className="py-2 pr-2 font-medium">เสีย</th>
              <th className="py-2 pr-2 font-medium">ผลต่าง</th>
              <th className="py-2 font-medium">แต้ม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const club = save.clubs.find((c) => c.id === row.clubId)!
              const you = club.controlledBy === 'human'
              return (
                <tr key={row.clubId} className={cn('border-b border-slate-100', you && 'bg-sky-50/80')}>
                  <td className="py-2 pr-2 font-semibold">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: club.color }}
                      aria-hidden
                    />
                    {club.name}
                  </td>
                  <td className="py-2 pr-2">
                    {you ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800">
                        คุณ
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                        AI
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2">{row.played}</td>
                  <td className="py-2 pr-2">{row.won}</td>
                  <td className="py-2 pr-2">{row.drawn}</td>
                  <td className="py-2 pr-2">{row.lost}</td>
                  <td className="py-2 pr-2">{row.gf}</td>
                  <td className="py-2 pr-2">{row.ga}</td>
                  <td className="py-2 pr-2">{row.gf - row.ga}</td>
                  <td className="py-2 font-bold">{row.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
