import { useMemo, useState } from 'react'
import {
  getWorldHistory,
  historyTimeline,
  leagueChampions,
  type HistoryTimelineEvent,
} from '@/game/worldHistory'
import { PageHeader, Panel } from '@/components/ui'
import { cn } from '@/lib/cn'

type Tab = 'timeline' | 'leagues' | 'ballon' | 'coaches' | 'players'

const TABS: { id: Tab; label: string }[] = [
  { id: 'timeline', label: 'ไทม์ไลน์' },
  { id: 'leagues', label: 'ลีก' },
  { id: 'ballon', label: 'บัลลงดอร์' },
  { id: 'coaches', label: 'โค้ช' },
  { id: 'players', label: 'นักเตะ' },
]

const LEAGUE_TABS = [
  { id: 'eng', label: 'พรีเมียร์ลีก' },
  { id: 'esp', label: 'ลาลีกา' },
  { id: 'ger', label: 'บุนเดสลีกา' },
  { id: 'ita', label: 'เซเรีย อา' },
  { id: 'fra', label: 'ลีกเอิง' },
]

function EventCard({ e }: { e: HistoryTimelineEvent }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          {e.year}
          {e.season ? ` · ${e.season}` : ''}
        </p>
        <span
          className={cn(
            'rounded px-2 py-0.5 text-[10px] font-bold text-white',
            e.kind === 'nation' ? 'bg-indigo-600' : 'bg-lime-700',
          )}
        >
          {e.kind === 'nation' ? 'ทีมชาติ' : 'สโมสร'}
        </span>
      </div>
      <h3 className="mt-1 text-base font-bold text-slate-900">{e.titleTh}</h3>
      <p className="text-xs text-slate-500">{e.title}</p>
      <p className="mt-2 text-sm font-semibold text-slate-800">
        แชมป์: {e.winnerTh ?? e.winner}
        {e.runnerUp ? (
          <span className="font-normal text-slate-600">
            {' '}
            · รอง {e.runnerUpTh ?? e.runnerUp}
          </span>
        ) : null}
      </p>
      {e.coach ? (
        <p className="mt-0.5 text-xs text-slate-600">โค้ช: {e.coach}</p>
      ) : null}
      {e.keyPlayers && e.keyPlayers.length > 0 ? (
        <p className="mt-0.5 text-xs text-slate-600">
          นักเตะเด่น: {e.keyPlayers.join(' · ')}
        </p>
      ) : null}
      {e.blurbTh ? <p className="mt-2 text-sm text-slate-700">{e.blurbTh}</p> : null}
    </article>
  )
}

export function HistoryPage() {
  const hist = getWorldHistory()
  const [tab, setTab] = useState<Tab>('timeline')
  const [leagueId, setLeagueId] = useState('eng')
  const [kindFilter, setKindFilter] = useState<'all' | 'nation' | 'club'>('all')

  const events = useMemo(() => {
    if (kindFilter === 'all') return historyTimeline()
    return historyTimeline({ kind: kindFilter })
  }, [kindFilter])

  const champs = leagueChampions(leagueId)

  return (
    <div className="space-y-5">
      <PageHeader
        title="ประวัติย้อนหลัง 10 ปี"
        subtitle={`${hist.range.from}–${hist.range.to} · ${hist.noteTh}`}
      />

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm font-semibold transition',
              tab === t.id
                ? 'bg-slate-900 text-lime-300'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'timeline' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ['all', 'ทั้งหมด'],
                ['nation', 'ทีมชาติ'],
                ['club', 'สโมสร'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setKindFilter(id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold',
                  kindFilter === id
                    ? 'bg-indigo-900 text-white'
                    : 'bg-slate-100 text-slate-700',
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {events.map((e, i) => (
              <EventCard key={`${e.year}-${e.title}-${i}`} e={e} />
            ))}
          </div>
        </div>
      ) : null}

      {tab === 'leagues' ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {LEAGUE_TABS.map((l) => (
              <button
                key={l.id}
                type="button"
                onClick={() => setLeagueId(l.id)}
                className={cn(
                  'rounded-md px-2.5 py-1 text-xs font-semibold',
                  leagueId === l.id
                    ? 'bg-slate-900 text-lime-300'
                    : 'bg-slate-100 text-slate-700',
                )}
              >
                {l.label}
              </button>
            ))}
          </div>
          <Panel>
            <h3 className="text-sm font-bold text-slate-900">
              {hist.leagues[leagueId]?.nameTh ?? leagueId} · แชมป์ย้อนหลัง
            </h3>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[28rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                    <th className="py-2 pr-2">ฤดูกาล</th>
                    <th className="py-2 pr-2">แชมป์</th>
                    <th className="py-2">โค้ช</th>
                  </tr>
                </thead>
                <tbody>
                  {champs.map((r) => (
                    <tr key={r.season} className="border-b border-slate-100">
                      <td className="py-2 pr-2 tabular-nums text-slate-600">{r.season}</td>
                      <td className="py-2 pr-2 font-semibold text-slate-900">
                        {r.clubTh}
                        <span className="ml-1 font-normal text-slate-500">({r.club})</span>
                      </td>
                      <td className="py-2 text-slate-700">{r.coach ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      ) : null}

      {tab === 'ballon' ? (
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">Ballon d&apos;Or 2016–2025</h3>
          <ul className="mt-3 space-y-2">
            {hist.ballonDor
              .slice()
              .reverse()
              .map((b) => (
                <li
                  key={b.year}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm"
                >
                  <span className="font-bold tabular-nums text-slate-500">{b.year}</span>
                  {b.player ? (
                    <span className="min-w-0 flex-1 font-semibold text-slate-900">
                      {b.player}
                      <span className="font-normal text-slate-600">
                        {' '}
                        · {b.nation} · {b.club}
                      </span>
                    </span>
                  ) : (
                    <span className="min-w-0 flex-1 text-slate-600">{b.noteTh}</span>
                  )}
                </li>
              ))}
          </ul>
        </Panel>
      ) : null}

      {tab === 'coaches' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {hist.coaches.map((c) => (
            <article
              key={c.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="font-bold text-slate-900">{c.name}</h3>
              <p className="text-xs text-slate-500">{c.nationTh}</p>
              <p className="mt-2 text-sm text-slate-700">{c.summaryTh}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                {c.honours2016to2026.map((h) => (
                  <li key={h} className="flex gap-1.5">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-lime-600" />
                    {h}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}

      {tab === 'players' ? (
        <div className="grid gap-3 lg:grid-cols-2">
          {hist.players.map((p) => (
            <article
              key={p.name}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
            >
              <h3 className="font-bold text-slate-900">{p.name}</h3>
              <p className="text-xs text-slate-500">
                {p.nationTh} · {p.clubs.join(' → ')}
              </p>
              <p className="mt-2 text-sm text-slate-700">{p.summaryTh}</p>
              {p.peakStats ? (
                <p className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700">
                  <span className="font-semibold">{p.peakStats.season}</span>
                  {p.peakStats.goals != null ? ` · ${p.peakStats.goals} ประตู` : ''}
                  {p.peakStats.assists != null ? ` · ${p.peakStats.assists} แอสซิสต์` : ''}
                  {p.peakStats.noteTh ? ` — ${p.peakStats.noteTh}` : ''}
                </p>
              ) : null}
              <ul className="mt-2 flex flex-wrap gap-1">
                {p.honours.map((h) => (
                  <span
                    key={`${h.year}-${h.label}`}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950"
                  >
                    {h.year} · {h.label}
                  </span>
                ))}
              </ul>
            </article>
          ))}
        </div>
      ) : null}
    </div>
  )
}
