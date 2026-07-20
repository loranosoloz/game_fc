import { Link } from 'react-router-dom'
import type { Club, GameSave, TableRow } from '@/game/types'
import { sortedTable } from '@/game/simulate'
import { cn } from '@/lib/cn'
import { ClubCrest } from '@/components/ClubCrest'

function rankTone(i: number): string {
  if (i === 0) return 'bg-amber-100 text-amber-950'
  if (i === 1) return 'bg-slate-200 text-slate-800'
  if (i === 2) return 'bg-orange-100 text-orange-950'
  return 'bg-slate-100 text-slate-600'
}

export function LeagueTableMini({
  save,
  limit = 5,
}: {
  save: GameSave
  limit?: number
}) {
  const all = sortedTable(save.table)
  const rows = all.slice(0, limit)
  const humanRank = all.findIndex((r) => r.clubId === save.humanClubId) + 1

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">สรุปตารางลีก</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {save.leagueName} · อันดับคุณ #{humanRank || '—'}
          </p>
        </div>
        <Link
          to="/table"
          className="shrink-0 text-xs font-semibold text-sky-800 underline underline-offset-2 hover:text-sky-950"
        >
          ตารางเต็ม →
        </Link>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              <th className="w-8 py-2 pl-2">#</th>
              <th className="py-2 pr-1">สโมสร</th>
              <th className="w-7 py-2 text-center">แข่ง</th>
              <th className="w-7 py-2 text-center">ชนะ</th>
              <th className="w-7 py-2 text-center">เสมอ</th>
              <th className="w-7 py-2 text-center">แพ้</th>
              <th className="w-8 py-2 text-center">+/-</th>
              <th className="w-9 py-2 pr-2 text-center">แต้ม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <TableRowItem
                key={row.clubId}
                row={row}
                rank={i + 1}
                club={save.clubs.find((c) => c.id === row.clubId)!}
                you={row.clubId === save.humanClubId}
              />
            ))}
          </tbody>
        </table>
      </div>

      {humanRank > limit ? (
        <p className="text-center text-[11px] text-slate-500">
          ทีมคุณอยู่อันดับ {humanRank} —{' '}
          <Link to="/table" className="font-semibold text-sky-800 underline">
            ดูตารางทั้งหมด
          </Link>
        </p>
      ) : null}
    </div>
  )
}

function TableRowItem({
  row,
  rank,
  club,
  you,
}: {
  row: TableRow
  rank: number
  club: Club
  you: boolean
}) {
  const gd = row.gf - row.ga
  return (
    <tr
      className={cn(
        'border-b border-slate-100 last:border-0',
        you ? 'bg-sky-50/90' : 'hover:bg-slate-50/80',
      )}
    >
      <td className="py-2 pl-2">
        <span
          className={cn(
            'inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold',
            rankTone(rank - 1),
          )}
        >
          {rank}
        </span>
      </td>
      <td className="py-2 pr-1">
        <span className="flex min-w-0 items-center gap-1.5">
          <ClubCrest club={club} size="xs" />
          <span className="min-w-0 truncate font-semibold text-slate-900">
            {club.shortName}
            {you ? (
              <span className="ml-1 rounded bg-sky-200 px-1 py-px text-[9px] font-bold text-sky-900">
                คุณ
              </span>
            ) : (
              <span className="ml-1 text-[9px] font-medium text-slate-400">AI</span>
            )}
          </span>
        </span>
      </td>
      <td className="py-2 text-center tabular-nums text-slate-600">{row.played}</td>
      <td className="py-2 text-center tabular-nums text-slate-600">{row.won}</td>
      <td className="py-2 text-center tabular-nums text-slate-600">{row.drawn}</td>
      <td className="py-2 text-center tabular-nums text-slate-600">{row.lost}</td>
      <td
        className={cn(
          'py-2 text-center tabular-nums font-medium',
          gd > 0 ? 'text-lime-700' : gd < 0 ? 'text-rose-600' : 'text-slate-500',
        )}
      >
        {gd > 0 ? `+${gd}` : gd}
      </td>
      <td className="py-2 pr-2 text-center text-sm font-bold tabular-nums text-slate-900">
        {row.points}
      </td>
    </tr>
  )
}
