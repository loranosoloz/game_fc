import type { TeamMatchStats } from '@/game/types'

/** แถบสถิติสั้นระหว่างแข่ง — ครองบอล · ยิง · มุม */
export function LiveMatchStatsStrip({
  homeName,
  awayName,
  homeGoals,
  awayGoals,
  home,
  away,
}: {
  homeName: string
  awayName: string
  homeGoals: number
  awayGoals: number
  home: TeamMatchStats
  away: TeamMatchStats
}) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white/95 p-3 shadow-sm">
      <div className="flex items-baseline justify-between gap-2">
        <p className="truncate text-xs font-bold text-sky-800">{homeName}</p>
        <p className="font-mono text-xl font-bold tabular-nums">
          {homeGoals}–{awayGoals}
        </p>
        <p className="truncate text-right text-xs font-bold text-rose-800">{awayName}</p>
      </div>
      <div className="mt-2 mb-1 flex justify-between text-[10px] font-semibold text-slate-600">
        <span>{home.possession}%</span>
        <span>ครองบอล</span>
        <span>{away.possession}%</span>
      </div>
      <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-200">
        <div className="bg-sky-500" style={{ width: `${home.possession}%` }} />
        <div className="bg-rose-400" style={{ width: `${away.possession}%` }} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-center text-[10px]">
        <StatChip label="ยิง" h={home.shots} a={away.shots} />
        <StatChip label="กรอบ" h={home.shotsOnTarget} a={away.shotsOnTarget} />
        <StatChip label="มุม" h={home.corners} a={away.corners} />
        <StatChip label="xG" h={home.xg.toFixed(1)} a={away.xg.toFixed(1)} />
      </div>
      <div className="mt-1 grid grid-cols-3 gap-1 text-center text-[10px]">
        <StatChip label="ฟาล์ว" h={home.fouls} a={away.fouls} />
        <StatChip label="เหลือง" h={home.yellows} a={away.yellows} />
        <StatChip label="แดง" h={home.reds} a={away.reds} />
      </div>
    </section>
  )
}

function StatChip({
  label,
  h,
  a,
}: {
  label: string
  h: number | string
  a: number | string
}) {
  return (
    <div className="rounded-md bg-slate-50 px-1 py-1.5">
      <p className="font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className="font-mono font-bold tabular-nums text-slate-900">
        {h}–{a}
      </p>
    </div>
  )
}
