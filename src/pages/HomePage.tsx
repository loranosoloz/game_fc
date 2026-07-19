import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listClubOptions } from '@/game/seed'
import { useGameStore } from '@/store/gameStore'
import { loadFromStorage } from '@/game/save'

export function HomePage() {
  const navigate = useNavigate()
  const newGame = useGameStore((s) => s.newGame)
  const continueGame = useGameStore((s) => s.continueGame)
  const hasSave = useMemo(() => Boolean(loadFromStorage()), [])
  const clubs = listClubOptions()
  const [managerName, setManagerName] = useState('Alex Manager')
  const [clubId, setClubId] = useState(clubs[12]?.id ?? clubs[0].id)

  const start = () => {
    newGame(managerName, clubId)
    navigate('/portal')
  }

  const resume = () => {
    if (continueGame()) navigate('/portal')
  }

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
          Single-player league
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          FC Manager
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          20-club league. You control one club — the other 19 are AI. Every matchday simulates{' '}
          <strong>all fixtures</strong>, then updates one shared table.
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">New career</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Manager name</span>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700">Your club (AI take the rest)</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.shortName}) · rep {c.reputation}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={start}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
          >
            Start season
          </button>
        </div>
      </section>

      {hasSave ? (
        <button
          type="button"
          onClick={resume}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          Continue saved career
        </button>
      ) : null}
    </div>
  )
}
