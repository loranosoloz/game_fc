import type { MatchResult, TeamMatchStats } from '@/game/types'
import { Panel, SectionLabel } from '@/components/ui'

function StatRow({
  label,
  home,
  away,
}: {
  label: string
  home: number | string
  away: number | string
}) {
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-100 py-1.5 text-sm last:border-0">
      <span className="text-right font-semibold tabular-nums text-slate-900">{home}</span>
      <span className="min-w-[5.5rem] text-center text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
        {label}
      </span>
      <span className="font-semibold tabular-nums text-slate-900">{away}</span>
    </div>
  )
}

function PossBar({ home, away }: { home: number; away: number }) {
  return (
    <div className="mt-2 mb-1">
      <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
        <span>{home}%</span>
        <span>ครองบอล</span>
        <span>{away}%</span>
      </div>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200">
        <div className="bg-sky-500" style={{ width: `${home}%` }} />
        <div className="bg-rose-400" style={{ width: `${away}%` }} />
      </div>
    </div>
  )
}

export function MatchStatsPanel({
  result,
  homeName,
  awayName,
}: {
  result: MatchResult
  homeName: string
  awayName: string
}) {
  const h = result.stats?.home ?? emptyStats()
  const a = result.stats?.away ?? emptyStats()

  return (
    <Panel className="!p-4">
      <SectionLabel>สถิติแมตช์</SectionLabel>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <p className="truncate text-sm font-bold text-sky-800">{homeName}</p>
        <p className="font-mono text-2xl font-bold tabular-nums">
          {result.homeGoals}–{result.awayGoals}
        </p>
        <p className="truncate text-right text-sm font-bold text-rose-800">{awayName}</p>
      </div>
      <PossBar home={h.possession} away={a.possession} />
      <div className="mt-1">
        <StatRow label="xG" home={(h.xg ?? 0).toFixed(2)} away={(a.xg ?? 0).toFixed(2)} />
        <StatRow label="ยิง" home={h.shots} away={a.shots} />
        <StatRow label="เข้ากรอบ" home={h.shotsOnTarget} away={a.shotsOnTarget} />
        <StatRow label="มุม" home={h.corners} away={a.corners} />
        <StatRow label="ฟาล์ว" home={h.fouls} away={a.fouls} />
        <StatRow label="ใบเหลือง" home={h.yellows} away={a.yellows} />
        <StatRow label="ใบแดง" home={h.reds} away={a.reds} />
        {result.penalties ? (
          <StatRow
            label="จุดโทษ"
            home={result.penalties.home}
            away={result.penalties.away}
          />
        ) : null}
        {result.wentToExtraTime ? (
          <p className="mt-2 text-center text-[11px] font-semibold text-rose-800">
            ไปต่อเวลา{result.wentToPens ? ' + ยิงจุดโทษ' : ''}
          </p>
        ) : null}
        <StatRow
          label="เรตติ้งทีม"
          home={result.homeRating.toFixed(1)}
          away={result.awayRating.toFixed(1)}
        />
      </div>
      {result.manOfTheMatchName ? (
        <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-center text-sm font-semibold text-amber-950">
          MOM · {result.manOfTheMatchName}
          {result.attendance != null
            ? ` · ผู้ชม ${result.attendance.toLocaleString('th-TH')}`
            : ''}
        </p>
      ) : result.attendance != null ? (
        <p className="mt-3 text-center text-xs font-medium text-slate-600">
          ผู้ชม {result.attendance.toLocaleString('th-TH')}
        </p>
      ) : null}
      {result.playerRatings && result.playerRatings.length > 0 ? (
        <div className="mt-3 border-t border-slate-100 pt-3">
          <SectionLabel>เรตติ้งรายคน</SectionLabel>
          <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
            {result.playerRatings.slice(0, 22).map((r) => (
              <li
                key={r.playerId}
                className="grid grid-cols-[1fr_auto_auto] gap-2 border-b border-slate-50 py-1 last:border-0"
              >
                <span className="truncate font-medium text-slate-800">
                  {r.team === 'home' ? 'H' : 'A'} · {r.name}
                </span>
                <span className="tabular-nums text-slate-500">
                  {r.goals > 0 ? `${r.goals}G ` : ''}
                  {r.xg > 0 ? `${r.xg.toFixed(2)}xG` : ''}
                </span>
                <span className="font-bold tabular-nums text-slate-900">{r.rating.toFixed(1)}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </Panel>
  )
}

function emptyStats(): TeamMatchStats {
  return {
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    fouls: 0,
    yellows: 0,
    reds: 0,
    possession: 50,
    xg: 0,
  }
}
