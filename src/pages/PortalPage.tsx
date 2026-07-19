import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'

export function PortalPage() {
  const save = useGameStore((s) => s.save)!
  const markInboxRead = useGameStore((s) => s.markInboxRead)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const opp = nextFx
    ? save.clubs.find(
        (c) =>
          c.id ===
          (nextFx.homeClubId === save.humanClubId ? nextFx.awayClubId : nextFx.homeClubId),
      )
    : null
  const table = sortedTable(save.table)
  const top5 = table.slice(0, 5)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">Club pulse</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-slate-500">Balance</dt>
              <dd className="font-semibold">£{club.balance.toLocaleString()}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Matchday</dt>
              <dd className="font-semibold">{save.matchday || 'Pre-season'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Next vs</dt>
              <dd className="font-semibold">
                {opp ? (
                  <>
                    {opp.name}{' '}
                    <span className="text-xs font-normal text-slate-500">(AI)</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">World</dt>
              <dd className="font-semibold">1 human · 19 AI</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">Inbox</h2>
          <ul className="mt-3 space-y-2">
            {save.inbox.length === 0 ? (
              <li className="text-sm text-slate-500">No messages.</li>
            ) : (
              save.inbox.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => markInboxRead(msg.id)}
                    className="w-full rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-sm font-medium ${msg.read ? 'text-slate-500' : 'text-slate-900'}`}>
                        {msg.title}
                      </span>
                      <span className="text-xs text-slate-400">{msg.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{msg.body}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">League snapshot</h2>
        <p className="mt-1 text-xs text-slate-500">Shared table — AI results count too</p>
        <ol className="mt-3 space-y-1.5 text-sm">
          {top5.map((row, i) => {
            const c = save.clubs.find((x) => x.id === row.clubId)!
            const you = c.id === save.humanClubId
            return (
              <li
                key={row.clubId}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 ${you ? 'bg-sky-50 ring-1 ring-sky-200' : ''}`}
              >
                <span>
                  {i + 1}. {c.shortName}{' '}
                  {you ? (
                    <span className="text-xs text-sky-700">YOU</span>
                  ) : (
                    <span className="text-xs text-slate-400">AI</span>
                  )}
                </span>
                <span className="font-semibold">{row.points} pts</span>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
