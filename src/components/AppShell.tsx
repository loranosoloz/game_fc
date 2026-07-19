import { NavLink, Outlet } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'
import { sortedTable } from '@/game/simulate'

const links = [
  { to: '/portal', label: 'Portal' },
  { to: '/squad', label: 'Squad' },
  { to: '/tactics', label: 'Tactics' },
  { to: '/match', label: 'Match' },
  { to: '/table', label: 'Table' },
  { to: '/finance', label: 'Finance' },
  { to: '/save', label: 'Save' },
]

export function AppShell() {
  const save = useGameStore((s) => s.save)
  const status = useGameStore((s) => s.status)
  const clearStatus = useGameStore((s) => s.clearStatus)
  const playNextMatchday = useGameStore((s) => s.playNextMatchday)

  if (!save) return null

  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const rank =
    sortedTable(save.table).findIndex((r) => r.clubId === save.humanClubId) + 1
  const aiCount = save.clubs.filter((c) => c.controlledBy === 'ai').length

  return (
    <div className="mx-auto flex min-h-full max-w-6xl flex-col gap-4 px-4 py-4 md:py-6">
      <header className="flex flex-col gap-3 border-b border-slate-300/70 pb-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold tracking-[0.2em] text-slate-500 uppercase">
            FC Manager
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            {club.name}
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            {save.managerName} · Season {save.season} · {save.currentDate} · Rank #{rank || '—'} ·{' '}
            <span className="text-sky-700">You</span> + {aiCount} AI clubs
          </p>
        </div>
        <button
          type="button"
          onClick={playNextMatchday}
          disabled={save.seasonComplete}
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {save.seasonComplete ? 'Season complete' : 'Play next matchday (all 20 clubs)'}
        </button>
      </header>

      <nav className="flex flex-wrap gap-1" aria-label="Main">
        {links.map((link) => (
          <NavLink
            key={link.to}
            to={link.to}
            className={({ isActive }) =>
              cn(
                'rounded-md px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-white/70 hover:text-slate-900',
                isActive && 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200',
              )
            }
          >
            {link.label}
          </NavLink>
        ))}
      </nav>

      {status ? (
        <div
          className="flex items-start justify-between gap-3 rounded-md border border-lime-300/60 bg-lime-50 px-3 py-2 text-sm text-slate-800"
          role="status"
        >
          <p>{status}</p>
          <button
            type="button"
            className="shrink-0 text-slate-500 hover:text-slate-800"
            onClick={clearStatus}
            aria-label="Dismiss status"
          >
            ×
          </button>
        </div>
      ) : null}

      <main className="flex-1 pb-8">
        <Outlet />
      </main>
    </div>
  )
}
