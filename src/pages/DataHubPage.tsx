import { useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { buildOppositionReport } from '@/game/opposition'
import { roleShort } from '@/game/positions'
import { ffpStatus } from '@/game/financeFfp'

export function DataHubPage() {
  const save = useGameStore((s) => s.save)!
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const table = sortedTable(save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const avg = squad.reduce((s, p) => s + p.overall, 0) / Math.max(1, squad.length)
  const avgAge = squad.reduce((s, p) => s + p.age, 0) / Math.max(1, squad.length)
  const top = [...squad].sort((a, b) => b.overall - a.overall).slice(0, 5)
  const rising = [...squad]
    .filter((p) => p.age <= 23)
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 5)

  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const oppId = nextFx
    ? nextFx.homeClubId === save.humanClubId
      ? nextFx.awayClubId
      : nextFx.homeClubId
    : null
  const report = useMemo(
    () => (oppId ? buildOppositionReport(save, oppId) : null),
    [save, oppId],
  )
  const ffp = ffpStatus(save)

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="space-y-3 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">Data Hub — {club.name}</h2>
        <dl className="grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
          <div>
            <dt className="text-slate-500">อันดับ</dt>
            <dd className="text-xl font-bold">#{rank || '—'}</dd>
          </div>
          <div>
            <dt className="text-slate-500">OVR เฉลี่ย</dt>
            <dd className="text-xl font-bold">{avg.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">อายุเฉลี่ย</dt>
            <dd className="text-xl font-bold">{avgAge.toFixed(1)}</dd>
          </div>
          <div>
            <dt className="text-slate-500">ความสามัคคี</dt>
            <dd className="text-xl font-bold">{save.dynamics.cohesion}</dd>
          </div>
        </dl>
        <div>
          <h3 className="text-sm font-semibold">Top players</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {top.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {roleShort(p.role)} {p.name}
                </span>
                <span>
                  {p.overall} · CA {p.ca}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold">Rising (PA)</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {rising.map((p) => (
              <li key={p.id} className="flex justify-between">
                <span>
                  {roleShort(p.role)} {p.name}
                </span>
                <span>PA {p.pa}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <div>
          <h2 className="text-lg font-semibold">คู่แข่งถัดไป</h2>
          {report ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p>
                รูป {report.formation} · แข็ง {report.strength}
              </p>
              <p>{report.weakness}</p>
              <p>{report.threatPlayers.join(' · ')}</p>
              <p className="text-slate-600">{report.advice}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">ไม่มีนัดถัดไป</p>
          )}
        </div>
        <div>
          <h3 className="font-semibold">FFP snapshot</h3>
          <p className={`mt-1 text-sm ${ffp.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            {ffp.warning ?? 'ผ่านเกณฑ์ FFP-lite'}
          </p>
          <p className="text-xs text-slate-500">
            ขาดทุนฤดูกาล {ffp.loss.toLocaleString('th-TH')} / เพดาน{' '}
            {ffp.maxLoss.toLocaleString('th-TH')}
          </p>
        </div>
        <div>
          <h3 className="font-semibold">Club Vision KPIs</h3>
          <ul className="mt-1 space-y-1 text-sm">
            {save.board.kpis.map((k) => (
              <li key={k.id} className="flex justify-between">
                <span>{k.label}</span>
                <span className={k.met ? 'text-emerald-700' : 'text-slate-500'}>
                  {k.met ? '✓' : '…'} {k.current}/{k.target}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  )
}
