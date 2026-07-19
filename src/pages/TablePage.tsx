import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { cn } from '@/lib/cn'
import { DIV2_LEAGUE_NAME, type LeagueId, promoRelegCount } from '@/data/world'
import { ensurePhase5 } from '@/game/save'
import { ClubCrest } from '@/components/ClubCrest'

export function TablePage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const lid = (save.leagueId || 'eng') as LeagueId
  const [tab, setTab] = useState<'d1' | 'd2'>('d1')
  const rows = sortedTable(tab === 'd1' ? save.table : save.tableDiv2 ?? [])
  const humanDiv = save.clubs.find((c) => c.id === save.humanClubId)?.division ?? 1
  const teamN = rows.length || (lid === 'ger' || lid === 'fra' ? 18 : 20)
  const slots = promoRelegCount(lid)

  return (
    <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
      <div className="flex flex-wrap items-center gap-2">
        <h2 className="mr-auto text-lg font-semibold">ตารางลีก</h2>
        <button
          type="button"
          onClick={() => setTab('d1')}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-semibold',
            tab === 'd1'
              ? 'border-slate-900 bg-slate-900 text-lime-300'
              : 'border-slate-300 bg-white',
          )}
        >
          ดิวิชัน 1
        </button>
        <button
          type="button"
          onClick={() => setTab('d2')}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-semibold',
            tab === 'd2'
              ? 'border-slate-900 bg-slate-900 text-lime-300'
              : 'border-slate-300 bg-white',
          )}
        >
          {DIV2_LEAGUE_NAME[lid].nameTh}
        </button>
      </div>
      <p className="text-sm text-slate-500">
        {teamN} สโมสร · ท้ายฤดูกาล {slots} ทีมท้ายดิวิชัน 1 ตกชั้น · {slots} ทีมนำ
        {DIV2_LEAGUE_NAME[lid].nameTh} เลื่อนชั้น
        {lid === 'ger' || lid === 'fra' ? ' · ฤดูกาล 34 นัด' : ' · ฤดูกาล 38 นัด'}
        {humanDiv === 2 ? ' · คุณอยู่ในลีกล่าง' : ''}
      </p>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[720px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
              <th className="py-2 pr-2 font-medium">#</th>
              <th className="py-2 pr-2 font-medium">สโมสร</th>
              <th className="py-2 pr-2 font-medium">คุมโดย</th>
              <th className="py-2 pr-2 font-medium">แข่ง</th>
              <th className="py-2 pr-2 font-medium">ชนะ</th>
              <th className="py-2 pr-2 font-medium">เสมอ</th>
              <th className="py-2 pr-2 font-medium">แพ้</th>
              <th className="py-2 pr-2 font-medium">ได้</th>
              <th className="py-2 pr-2 font-medium">เสีย</th>
              <th className="py-2 pr-2 font-medium">ผลต่าง</th>
              <th className="py-2 font-medium">แต้ม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => {
              const club = save.clubs.find((c) => c.id === row.clubId)
              if (!club) return null
              const you = club.id === save.humanClubId
              const zone =
                tab === 'd1' && i >= 17
                  ? 'bg-rose-50/90'
                  : tab === 'd2' && i < 3
                    ? 'bg-lime-50/90'
                    : you
                      ? 'bg-sky-50/80'
                      : ''
              return (
                <tr key={row.clubId} className={cn('border-b border-slate-100', zone)}>
                  <td className="py-2 pr-2 font-semibold">{i + 1}</td>
                  <td className="py-2 pr-2">
                    <span className="inline-flex items-center gap-2">
                      <ClubCrest club={club} size="xs" />
                      <span>
                        {club.name}
                        {tab === 'd1' && i >= 17 ? (
                          <span className="ml-1 text-[10px] text-rose-700">ตกชั้น</span>
                        ) : null}
                        {tab === 'd2' && i < 3 ? (
                          <span className="ml-1 text-[10px] text-lime-800">เลื่อนชั้น</span>
                        ) : null}
                      </span>
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {you ? (
                      <span className="rounded bg-sky-100 px-1.5 py-0.5 text-xs font-semibold text-sky-800">
                        คุณ
                      </span>
                    ) : (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-semibold text-slate-600">
                        AI
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-2">{row.played}</td>
                  <td className="py-2 pr-2">{row.won}</td>
                  <td className="py-2 pr-2">{row.drawn}</td>
                  <td className="py-2 pr-2">{row.lost}</td>
                  <td className="py-2 pr-2">{row.gf}</td>
                  <td className="py-2 pr-2">{row.ga}</td>
                  <td className="py-2 pr-2">{row.gf - row.ga}</td>
                  <td className="py-2 font-bold">{row.points}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </section>
  )
}
