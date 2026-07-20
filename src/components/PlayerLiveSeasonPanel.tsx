import { liveSeasonAvgRating } from '@/game/playerMatchStats'
import type { GameSave, Player, PlayerLiveSeasonStats, PlayerMatchLogEntry } from '@/game/types'
import { competitionLabelTh } from '@/game/matchArchive'
import { cn } from '@/lib/cn'

function clubShort(save: GameSave, id: string) {
  return save.clubs.find((c) => c.id === id)?.shortName ?? save.clubs.find((c) => c.id === id)?.name ?? id
}

/** สถิติฤดูกาลนี้ + นัดล่าสุด ติดตัวนักเตะ */
export function PlayerLiveSeasonPanel({
  save,
  player,
  compact = false,
}: {
  save: GameSave
  player: Player
  compact?: boolean
}) {
  const live = player.liveSeason
  const recent = player.recentMatches ?? []
  const history = player.seasonHistory ?? []

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
          สถิติฤดูกาลนี้ (ในเซฟ)
        </p>
        {live && live.apps > 0 ? (
          <LiveSeasonTable live={live} clubName={clubShort(save, live.clubId)} />
        ) : (
          <p className="mt-1 text-xs text-slate-500">ยังไม่ลงแข่งฤดูกาลนี้</p>
        )}
      </div>

      {recent.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            นัดล่าสุด
          </p>
          <ul
            className={cn(
              'mt-1 space-y-1 overflow-y-auto text-[11px]',
              compact ? 'max-h-28' : 'max-h-40',
            )}
          >
            {recent.map((m) => (
              <RecentMatchRow key={`${m.fixtureId}-${m.date}`} save={save} m={m} />
            ))}
          </ul>
        </div>
      ) : null}

      {history.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            ฤดูกาลก่อนหน้าในเซฟ
          </p>
          <div className={cn('mt-1 overflow-auto', compact ? 'max-h-24' : 'max-h-32')}>
            <table className="w-full text-left text-[11px]">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1 pr-1 font-semibold">ปี</th>
                  <th className="py-1 pr-1 font-semibold">ทีม</th>
                  <th className="py-1 pr-1 font-semibold">นัด</th>
                  <th className="py-1 pr-1 font-semibold">G</th>
                  <th className="py-1 pr-1 font-semibold">A</th>
                  <th className="py-1 font-semibold">เรต</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h, i) => (
                  <tr key={`${h.season}-${h.clubId}-${i}`} className="border-b border-slate-50">
                    <td className="py-1 pr-1 tabular-nums">{h.label}</td>
                    <td className="max-w-[5rem] truncate py-1 pr-1">{h.clubName}</td>
                    <td className="py-1 pr-1 tabular-nums">{h.apps}</td>
                    <td className="py-1 pr-1 tabular-nums font-semibold">{h.goals}</td>
                    <td className="py-1 pr-1 tabular-nums">{h.assists}</td>
                    <td className="py-1 tabular-nums">{h.avgRating.toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function LiveSeasonTable({
  live,
  clubName,
}: {
  live: PlayerLiveSeasonStats
  clubName: string
}) {
  const avg = liveSeasonAvgRating(live)
  return (
    <div className="mt-1 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-800">
      <p className="font-semibold text-slate-900">
        S{live.season} · {clubName}
      </p>
      <p className="mt-1 tabular-nums">
        <span className="font-bold">{live.apps}</span> นัด
        {live.starts > 0 ? ` (${live.starts} ตัวจริง)` : ''} ·{' '}
        <span className="font-bold">{live.goals}</span>G{' '}
        <span className="font-bold">{live.assists}</span>A · {live.minutes}' · เรต{' '}
        <span className="font-bold">{avg.toFixed(2)}</span>
      </p>
      <p className="mt-0.5 tabular-nums text-slate-500">
        ใบเหลือง {live.yellows} · ใบแดง {live.reds}
        {live.motm > 0 ? ` · MOM ${live.motm}` : ''}
        {live.cleanSheets > 0 ? ` · CS ${live.cleanSheets}` : ''}
        {live.shots > 0 ? ` · ยิง ${live.shots}` : ''}
        {live.xg > 0 ? ` · xG ${live.xg.toFixed(1)}` : ''}
      </p>
    </div>
  )
}

function RecentMatchRow({ save, m }: { save: GameSave; m: PlayerMatchLogEntry }) {
  const vs = clubShort(save, m.opponentClubId)
  return (
    <li className="flex flex-wrap items-baseline justify-between gap-x-2 border-b border-slate-50 pb-1">
      <span className="text-slate-600">
        MD{m.matchday} · {competitionLabelTh(m.competition)} · {m.home ? 'vs' : '@'} {vs}
      </span>
      <span className="tabular-nums font-semibold text-slate-900">
        {m.goals}G {m.assists}A · {m.minutes}' · {m.rating.toFixed(1)}
        {m.motm ? ' ★' : ''}
      </span>
    </li>
  )
}
