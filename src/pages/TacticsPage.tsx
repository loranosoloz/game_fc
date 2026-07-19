import { useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { FormationId } from '@/game/types'
import { FORMATION_SLOTS } from '@/game/types'
import { positionLabel } from '@/game/seed'
import { cn } from '@/lib/cn'

const FORMATIONS: FormationId[] = ['4-3-3', '4-4-2', '4-2-3-1']

export function TacticsPage() {
  const save = useGameStore((s) => s.save)!
  const setFormation = useGameStore((s) => s.setFormation)
  const setStartingXi = useGameStore((s) => s.setStartingXi)
  const autoPickHumanXi = useGameStore((s) => s.autoPickHumanXi)

  const tactics = save.tacticsByClub[save.humanClubId]
  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save.players, save.humanClubId],
  )

  const slots = FORMATION_SLOTS[tactics.formation]

  const togglePlayer = (playerId: string) => {
    const set = new Set(tactics.startingXi)
    if (set.has(playerId)) {
      set.delete(playerId)
    } else if (set.size < slots.length) {
      set.add(playerId)
    }
    setStartingXi([...set])
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">แผนการเล่น</h2>
        <div className="flex flex-wrap gap-2">
          {FORMATIONS.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFormation(f)}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-medium',
                tactics.formation === f
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={autoPickHumanXi}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          เลือก XI อัตโนมัติ
        </button>
        <p className="text-xs text-slate-500">
          เลือกแล้ว {tactics.startingXi.length}/{slots.length} · ทีม AI เลือก XI เองก่อนทุกแมตช์เดย์
        </p>
        <ol className="space-y-1 text-sm">
          {tactics.startingXi.map((id, i) => {
            const p = save.players.find((x) => x.id === id)
            return (
              <li key={id} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                <span>
                  {positionLabel(slots[i])} · {p?.name}
                </span>
                <span className="text-slate-500">{p?.overall}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">เลือกตัวจริง</h2>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {squad.map((p) => {
            const selected = tactics.startingXi.includes(p.id)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => togglePlayer(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
                    selected
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                  )}
                >
                  <span>
                    <span className="font-semibold">{positionLabel(p.position)}</span> {p.name}
                  </span>
                  <span className="text-slate-500">{p.overall}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
