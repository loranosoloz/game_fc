import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'

export function SquadPage() {
  const save = useGameStore((s) => s.save)!
  const squad = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => b.overall - a.overall)

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Squad</h2>
          <p className="text-sm text-slate-500">{squad.length} players · your club only</p>
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 font-medium">Pos</th>
              <th className="py-2 pr-2 font-medium">Name</th>
              <th className="py-2 pr-2 font-medium">Age</th>
              <th className="py-2 pr-2 font-medium">OVR</th>
              <th className="py-2 pr-2 font-medium">Cond</th>
              <th className="py-2 pr-2 font-medium">Form</th>
              <th className="py-2 font-medium">Wage</th>
            </tr>
          </thead>
          <tbody>
            {squad.map((p) => (
              <tr key={p.id} className="border-b border-slate-100">
                <td className="py-2 pr-2 font-semibold text-slate-700">{p.position}</td>
                <td className="py-2 pr-2">{p.name}</td>
                <td className="py-2 pr-2 text-slate-600">{p.age}</td>
                <td className="py-2 pr-2 font-semibold">{p.overall}</td>
                <td className="py-2 pr-2">
                  <span
                    className={cn(
                      p.condition < 70 ? 'text-amber-700' : 'text-slate-700',
                    )}
                  >
                    {p.condition}%
                  </span>
                </td>
                <td className="py-2 pr-2">{p.form}</td>
                <td className="py-2">£{p.wage.toLocaleString()}/w</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
