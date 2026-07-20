import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import type { IndividualFocus } from '@/game/types'
import { individualFocusOptions } from '@/game/training'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import { PlayerFace } from '@/components/PlayerFace'

export function DevelopmentPage() {
  const save = useGameStore((s) => s.save)!
  const setIndividualFocus = useGameStore((s) => s.setIndividualFocus)
  const setMentor = useGameStore((s) => s.setMentor)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save.players, save.humanClubId],
  )
  const selected = squad.find((p) => p.id === selectedId) ?? squad[0] ?? null
  const focuses = individualFocusOptions()
  const mentors = squad.filter((p) => selected && p.id !== selected.id && p.ca >= (selected?.ca ?? 0) + 5)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">Player development</h2>
        <p className="mt-1 text-sm text-slate-600">
          Individual focus · Mentoring (อายุ ≤ 23) · Personality events หลังแมตช์เดย์
        </p>
        <p className="mt-2 text-xs text-slate-500">{save.development.lastMentorNote}</p>
        <ul className="mt-4 max-h-[28rem] space-y-1 overflow-y-auto text-sm">
          {squad.map((p) => {
            const focus = save.training.individual?.[p.id] ?? 'none'
            const mentor = p.mentorId ? squad.find((x) => x.id === p.mentorId) : null
            return (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(p.id)}
                  className={cn(
                    'flex w-full items-center gap-2.5 rounded-md border px-3 py-2 text-left',
                    selected?.id === p.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <PlayerFace name={p.name} size="sm" />
                  <span className="min-w-0 flex-1">
                    <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      Learn {p.growth.learningRate} · focus {focus}
                      {mentor ? ` · mentor ${mentor.name}` : ''}
                    </span>
                  </span>
                  <span className="shrink-0 text-right text-xs">
                    <span className="block font-bold">CA {p.ca}</span>
                    <span className="text-slate-500">PA {p.pa}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        {selected ? (
          <>
            <div className="flex items-center gap-3">
              <PlayerFace name={selected.name} size="lg" className="ring-2 ring-slate-200" />
              <h3 className="text-lg font-semibold">
                {selected.name}{' '}
                <span className="block text-sm font-normal text-slate-500">
                  {roleShort(selected.role)} · {selected.age}y · CA {selected.ca} / PA {selected.pa}
                </span>
              </h3>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Individual training focus</p>
              <div className="flex flex-wrap gap-1">
                {focuses.map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setIndividualFocus(selected.id, f.id as IndividualFocus)}
                    className={cn(
                      'rounded border px-2 py-1 text-xs font-medium',
                      (save.training.individual?.[selected.id] ?? 'none') === f.id
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
              <p className="mb-1 text-xs font-medium text-slate-500">Mentor</p>
              {selected.age > 23 ? (
                <p className="text-sm text-slate-500">Mentoring สำหรับอายุ ≤ 23 เท่านั้น</p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  <select
                    className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
                    value={selected.mentorId ?? ''}
                    onChange={(e) =>
                      setMentor(selected.id, e.target.value ? e.target.value : null)
                    }
                  >
                    <option value="">— ไม่มีเมนเทอร์ —</option>
                    {mentors.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} (CA {m.ca})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <div>
              <p className="text-xs font-medium text-slate-500">Growth profile</p>
              <ul className="mt-1 grid grid-cols-2 gap-1 text-xs">
                <li>Determination {selected.growth.determination}</li>
                <li>Ambition {selected.growth.ambition}</li>
                <li>Professionalism {selected.growth.professionalism}</li>
                <li>Learning {selected.growth.learningRate}</li>
              </ul>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-500">ไม่มีนักเตะ</p>
        )}

        <div className="border-t border-slate-100 pt-4">
          <h4 className="text-sm font-semibold">Personality events ล่าสุด</h4>
          <ul className="mt-2 max-h-48 space-y-2 overflow-y-auto text-sm">
            {(save.development.personalityLog ?? []).length === 0 ? (
              <li className="text-slate-500">ยังไม่มีเหตุการณ์</li>
            ) : (
              save.development.personalityLog.slice(0, 8).map((ev) => (
                <li key={ev.id} className="rounded bg-slate-50 px-2 py-1.5">
                  <p className="font-medium">{ev.title}</p>
                  <p className="text-xs text-slate-600">{ev.body}</p>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>
    </div>
  )
}
