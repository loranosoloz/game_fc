import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { buildOppositionReport } from '@/game/opposition'
import { roleShort } from '@/game/positions'
import { ffpStatus } from '@/game/financeFfp'
import { formationLabel } from '@/game/types'
import { ensureAwards } from '@/game/awards'
import { PageHeader, Panel, SectionLabel } from '@/components/ui'

export function DataHubPage() {
  const save = useGameStore((s) => s.save)!
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const table = sortedTable(save.table)
  const rank = table.findIndex((r) => r.clubId === save.humanClubId) + 1
  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const avg = squad.reduce((s, p) => s + p.overall, 0) / Math.max(1, squad.length)
  const avgAge = squad.reduce((s, p) => s + p.age, 0) / Math.max(1, squad.length)
  const avgCond = squad.reduce((s, p) => s + p.condition, 0) / Math.max(1, squad.length)
  const top = [...squad].sort((a, b) => b.overall - a.overall).slice(0, 5)
  const rising = [...squad]
    .filter((p) => p.age <= 23)
    .sort((a, b) => b.pa - a.pa)
    .slice(0, 5)
  const youth = squad.filter((p) => p.isYouth)

  const humanPlayed = save.fixtures.filter(
    (f) =>
      f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const form = humanPlayed.slice(-5).map((f) => {
    const home = f.homeClubId === save.humanClubId
    const gf = home ? (f.homeGoals ?? 0) : (f.awayGoals ?? 0)
    const ga = home ? (f.awayGoals ?? 0) : (f.homeGoals ?? 0)
    if (gf > ga) return 'W'
    if (gf === ga) return 'D'
    return 'L'
  })
  const formPts = form.reduce((s, x) => s + (x === 'W' ? 3 : x === 'D' ? 1 : 0), 0)

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

  const recentOppReports = useMemo(() => {
    return humanPlayed
      .slice(-3)
      .reverse()
      .map((f) => {
        const oid = f.homeClubId === save.humanClubId ? f.awayClubId : f.homeClubId
        const opp = save.clubs.find((c) => c.id === oid)
        const r = buildOppositionReport(save, oid)
        const home = f.homeClubId === save.humanClubId
        return {
          id: f.id,
          name: opp?.shortName ?? oid,
          score: `${home ? f.homeGoals : f.awayGoals}–${home ? f.awayGoals : f.homeGoals}`,
          formation: r.formation,
          advice: r.advice,
        }
      })
  }, [humanPlayed, save])

  const ffp = ffpStatus(save)
  const last = save.lastHumanResult
  const awards = ensureAwards(save)
  const seasonLeaders = Object.values(awards.seasonPlayers ?? {})
    .filter((p) => {
      const pl = save.players.find((x) => x.id === p.playerId)
      return pl?.clubId === save.humanClubId
    })
    .sort((a, b) => b.goalsLeague - a.goalsLeague || b.shoePoints - a.shoePoints)
    .slice(0, 5)

  const lastFx = last
    ? save.fixtures.find((f) => f.id === last.fixtureId)
    : null
  const humanSide: 'home' | 'away' | null = lastFx
    ? lastFx.homeClubId === save.humanClubId
      ? 'home'
      : 'away'
    : null
  const ratingLeaders = [...(last?.playerRatings ?? [])]
    .filter((r) => !humanSide || r.team === humanSide)
    .sort((a, b) => b.rating - a.rating)
    .slice(0, 6)

  const restHint = avgCond < 68

  return (
    <div className="space-y-5">
      <PageHeader
        title="Data Hub"
        subtitle={`${club.name} · วิเคราะห์จากแมตช์เอนจิน · xG · เรตติ้ง · คู่แข่ง · ฟอร์ม`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="อันดับ" value={`#${rank || '—'}`} />
        <Stat label="OVR เฉลี่ย" value={avg.toFixed(1)} />
        <Stat label="อายุเฉลี่ย" value={avgAge.toFixed(1)} />
        <Stat label="ความสามัคคี" value={String(save.dynamics.cohesion)} />
        <Stat label="สภาพเฉลี่ย" value={avgCond.toFixed(0)} warn={restHint} />
      </div>

      {restHint ? (
        <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
          สควอดเหนื่อย — แนะนำโฟกัสซ้อม「พักฟื้น」ที่{' '}
          <Link to="/training" className="font-semibold underline">
            หน้าซ้อม
          </Link>
        </p>
      ) : null}

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel className="!p-4">
          <SectionLabel>ฟอร์ม 5 นัดล่าสุด</SectionLabel>
          <p className="mt-2 font-mono text-lg font-bold tracking-widest">
            {form.length ? form.join(' ') : '—'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            {form.length} นัด · {formPts} แต้มจาก {form.length * 3} แต้มเต็ม
          </p>

          {last ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <SectionLabel>นัดล่าสุด · Match Engine</SectionLabel>
              <p className="mt-2 text-sm font-semibold">
                {last.homeGoals}–{last.awayGoals}
                {last.manOfTheMatchName ? ` · MOM ${last.manOfTheMatchName}` : ''}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                xG {last.stats?.home?.xg?.toFixed(2) ?? '—'} –{' '}
                {last.stats?.away?.xg?.toFixed(2) ?? '—'}
                {last.attendance != null
                  ? ` · ผู้ชม ${last.attendance.toLocaleString('th-TH')}`
                  : ''}
              </p>
              {ratingLeaders.length > 0 ? (
                <ul className="mt-2 space-y-1 text-xs">
                  {ratingLeaders.map((r) => (
                    <li key={r.playerId} className="flex justify-between gap-2">
                      <span className="truncate">{r.name}</span>
                      <span className="tabular-nums font-semibold">
                        {r.rating.toFixed(1)}
                        {r.goals > 0 ? ` · ${r.goals}G` : ''}
                        {r.xg > 0 ? ` · ${r.xg.toFixed(2)}xG` : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              {last.breakdown?.lines?.length ? (
                <ul className="mt-2 space-y-0.5 text-[11px] text-slate-600">
                  {last.breakdown.lines.slice(0, 4).map((line, i) => (
                    <li key={i}>· {line}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มีผลแมตช์มนุษย์</p>
          )}
        </Panel>

        <Panel className="!p-4">
          <SectionLabel>คู่แข่งถัดไป · Opposition</SectionLabel>
          {report ? (
            <div className="mt-2 space-y-1 text-sm text-slate-700">
              <p className="font-semibold">
                รูป {formationLabel(report.formation, true)} · แข็ง {report.strength}
              </p>
              <p>{report.weakness}</p>
              <p className="text-xs">{report.threatPlayers.join(' · ')}</p>
              <p className="text-slate-600">{report.advice}</p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-500">ไม่มีนัดถัดไป</p>
          )}
          {recentOppReports.length > 0 ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="text-xs font-semibold text-slate-500 uppercase">3 คู่ล่าสุด</p>
              <ul className="mt-2 space-y-2 text-xs">
                {recentOppReports.map((r) => (
                  <li key={r.id} className="rounded bg-slate-50 px-2 py-1.5">
                    <span className="font-semibold">
                      vs {r.name} {r.score}
                    </span>
                    <span className="text-slate-500">
                      {' '}
                      · {formationLabel(r.formation, true)}
                    </span>
                    <p className="mt-0.5 text-slate-600">{r.advice}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>

        <Panel className="!p-4">
          <SectionLabel>สถิติฤดูกาล (ทีมคุณ)</SectionLabel>
          {seasonLeaders.length ? (
            <ul className="mt-2 space-y-1 text-sm">
              {seasonLeaders.map((p) => (
                <li key={p.playerId} className="flex justify-between gap-2">
                  <span className="truncate">{p.name}</span>
                  <span className="shrink-0 tabular-nums text-xs">
                    {p.goalsLeague}G · shoe {p.shoePoints.toFixed(1)} · {p.appsLeague} นัด
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">เล่นแมตช์เดย์เพื่อสะสมสถิติ</p>
          )}
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
            <div className="rounded bg-slate-50 px-2 py-2">
              <p className="text-slate-500">ซ้อม</p>
              <p className="font-semibold">
                {save.training.focus} · {save.training.intensity}
              </p>
            </div>
            <div className="rounded bg-slate-50 px-2 py-2">
              <p className="text-slate-500">เยาวชน</p>
              <p className="font-semibold">
                {youth.length} คน · อะคาเดมี่ {save.youth.academyLevel}
              </p>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            <Link to="/awards" className="underline">
              รางวัลลีก
            </Link>
            {' · '}
            <Link to="/youth" className="underline">
              เยาวชน
            </Link>
            {' · '}
            <Link to="/training" className="underline">
              ซ้อม
            </Link>
          </p>
        </Panel>

        <Panel className="!p-4">
          <SectionLabel>สควอด · FFP · Vision</SectionLabel>
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold text-slate-500">Top players</p>
              <ul className="mt-1 space-y-1 text-sm">
                {top.map((p) => (
                  <li key={p.id} className="flex justify-between">
                    <span>
                      {roleShort(p.role)} {p.name}
                    </span>
                    <span>{p.overall}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500">Rising PA</p>
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
          </div>
          <p className={`mt-3 text-sm ${ffp.ok ? 'text-emerald-700' : 'text-rose-700'}`}>
            FFP: {ffp.warning ?? 'ผ่านเกณฑ์'}
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {save.board.kpis.map((k) => (
              <li key={k.id} className="flex justify-between">
                <span>{k.label}</span>
                <span className={k.met ? 'text-emerald-700' : 'text-slate-500'}>
                  {k.met ? '✓' : '…'} {k.current}/{k.target}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  warn,
}: {
  label: string
  value: string
  warn?: boolean
}) {
  return (
    <div
      className={`rounded-xl border px-3 py-3 ${warn ? 'border-amber-300 bg-amber-50' : 'border-slate-200 bg-white/80'}`}
    >
      <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-slate-900">{value}</p>
    </div>
  )
}
