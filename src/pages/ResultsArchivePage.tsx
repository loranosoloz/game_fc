import { useEffect, useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { MatchStatsPanel } from '@/components/MatchStatsPanel'
import { PageHeader, Panel, SectionLabel } from '@/components/ui'
import {
  archiveEntryToMatchResult,
  competitionLabelTh,
  type MatchArchiveEntry,
} from '@/game/matchArchive'
import { ensureMatchStatsHydrated } from '@/game/matchStatsDb'
import { cn } from '@/lib/cn'

type Filter = 'all' | 'human' | 'league' | 'cup'

export function ResultsArchivePage() {
  const save = useGameStore((s) => s.save)!
  const [filter, setFilter] = useState<Filter>('all')
  const [mdFilter, setMdFilter] = useState<number | 'all'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [archive, setArchive] = useState<MatchArchiveEntry[]>(() => save.matchArchive ?? [])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void ensureMatchStatsHydrated(save)
      .then((rows) => {
        if (!cancelled) setArchive(rows)
      })
      .catch(() => {
        if (!cancelled) setArchive(save.matchArchive ?? [])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [save.createdAt, save.humanClubId, save.leagueId, save.matchday, save.season, save.matchArchive])

  const clubName = (id: string) =>
    save.clubs.find((c) => c.id === id)?.shortName ??
    save.clubs.find((c) => c.id === id)?.name ??
    id

  const matchdays = useMemo(() => {
    const set = new Set(archive.map((e) => e.matchday))
    return [...set].sort((a, b) => b - a)
  }, [archive])

  const filtered = useMemo(() => {
    let list = archive
    if (filter === 'human') list = list.filter((e) => e.involvesHuman)
    if (filter === 'league') list = list.filter((e) => e.competition === 'league')
    if (filter === 'cup') list = list.filter((e) => e.competition !== 'league')
    if (mdFilter !== 'all') list = list.filter((e) => e.matchday === mdFilter)
    const qq = q.trim().toLowerCase()
    if (qq) {
      list = list.filter((e) => {
        const h = clubName(e.homeClubId).toLowerCase()
        const a = clubName(e.awayClubId).toLowerCase()
        return h.includes(qq) || a.includes(qq) || e.id.toLowerCase().includes(qq)
      })
    }
    return list
  }, [archive, filter, mdFilter, q, save.clubs])

  const selected: MatchArchiveEntry | null =
    filtered.find((e) => e.id === selectedId) ?? filtered[0] ?? null

  return (
    <div className="space-y-5">
      <PageHeader
        title="คลังสถิติแมตช์"
        subtitle={`ทุกนัดในเซฟ รวม AI vs AI · DB เก็บแล้ว ${archive.length.toLocaleString('th-TH')} นัด${loading ? ' · กำลังโหลด…' : ''}`}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'ทั้งหมด'],
            ['human', 'ทีมคุณ'],
            ['league', 'ลีก'],
            ['cup', 'ถ้วย/ยุโรป'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-semibold',
              filter === id
                ? 'border-slate-900 bg-slate-900 text-lime-300'
                : 'border-slate-300 bg-white hover:bg-slate-50',
            )}
          >
            {label}
          </button>
        ))}
        <select
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
          value={mdFilter === 'all' ? 'all' : String(mdFilter)}
          onChange={(e) =>
            setMdFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
          }
        >
          <option value="all">ทุกแมตช์เดย์</option>
          {matchdays.map((md) => (
            <option key={md} value={md}>
              MD {md}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ค้นหาชื่อทีม…"
          className="min-w-[10rem] flex-1 rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1fr_minmax(280px,360px)]">
        <Panel className="!p-0 overflow-hidden">
          <div className="border-b border-slate-100 px-4 py-3">
            <SectionLabel>รายการนัด ({filtered.length})</SectionLabel>
          </div>
          <ul className="max-h-[70vh] divide-y divide-slate-100 overflow-y-auto">
            {filtered.length === 0 ? (
              <li className="px-4 py-8 text-center text-sm text-slate-500">
                ยังไม่มีสถิติในคลัง — เล่นแมตช์เดย์เพื่อสะสม (นัด AI ถูกเก็บด้วย)
              </li>
            ) : (
              filtered.map((e) => {
                const active = selected?.id === e.id
                const h = e.stats.home
                const a = e.stats.away
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(e.id)}
                      className={cn(
                        'flex w-full flex-col gap-1 px-4 py-3 text-left hover:bg-slate-50',
                        active && 'bg-sky-50',
                      )}
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
                          S{e.season} · MD{e.matchday} · {competitionLabelTh(e.competition, e.cupRound)}
                          {e.involvesHuman ? ' · คุณ' : ' · AI'}
                        </span>
                        <span className="font-mono text-lg font-bold tabular-nums">
                          {e.homeGoals}–{e.awayGoals}
                        </span>
                      </div>
                      <p className="text-sm font-bold text-slate-900">
                        {clubName(e.homeClubId)}{' '}
                        <span className="font-normal text-slate-400">vs</span>{' '}
                        {clubName(e.awayClubId)}
                      </p>
                      <p className="text-[11px] tabular-nums text-slate-500">
                        ครอง {h.possession}–{a.possession}% · ยิง {h.shots}–{a.shots} · มุม{' '}
                        {h.corners}–{a.corners} · xG {h.xg.toFixed(1)}–{a.xg.toFixed(1)}
                      </p>
                    </button>
                  </li>
                )
              })
            )}
          </ul>
        </Panel>

        <div className="space-y-3">
          {selected ? (
            <>
              <MatchStatsPanel
                result={archiveEntryToMatchResult(selected)}
                homeName={clubName(selected.homeClubId)}
                awayName={clubName(selected.awayClubId)}
              />
              <Panel className="!p-4">
                <SectionLabel>สรุปสั้น</SectionLabel>
                <p className="mt-2 text-sm text-slate-700">
                  {selected.date} · {competitionLabelTh(selected.competition, selected.cupRound)}
                  {selected.manOfTheMatchName
                    ? ` · MOM ${selected.manOfTheMatchName}`
                    : ''}
                  {selected.attendance != null
                    ? ` · ผู้ชม ${selected.attendance.toLocaleString('th-TH')}`
                    : ''}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  เรตติ้งทีม {selected.homeRating.toFixed(1)} – {selected.awayRating.toFixed(1)}
                </p>
              </Panel>
            </>
          ) : (
            <Panel className="!p-6 text-center text-sm text-slate-500">เลือกนัดเพื่อดูสถิติ</Panel>
          )}
        </div>
      </div>
    </div>
  )
}
