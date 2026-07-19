import { useGameStore } from '@/store/gameStore'
import cupFormat from '@/data/cupFormat.json'
import uclFormat from '@/data/uclFormat.json'

export function CompetitionsPage() {
  const save = useGameStore((s) => s.save)!
  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id

  const cupFx = save.fixtures
    .filter((f) => f.competition === 'cup')
    .sort((a, b) => a.matchday - b.matchday)

  const uclFx = save.fixtures
    .filter((f) => f.competition === 'ucl')
    .sort((a, b) => a.matchday - b.matchday)

  const cupByRound = cupFormat.rounds.map((r) => ({
    ...r,
    fixtures: cupFx.filter((f) => f.cupRound === r.id),
  }))

  const uclByRound = uclFormat.rounds.map((r) => ({
    ...r,
    fixtures: uclFx.filter((f) => f.cupRound === r.id),
  }))

  const ucl = save.ucl

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div className="rounded-xl border border-amber-200 bg-gradient-to-br from-amber-50 to-white p-5">
          <h2 className="text-lg font-semibold text-amber-950">{ucl?.name ?? 'UEFA Champions League'}</h2>
          {ucl?.championClubId ? (
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              แชมป์ยุโรป: {nameOf(ucl.championClubId)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">
              Top 4 ลีกในประเทศ + สโมสรเชิญจากลีกอื่น · R16 → Final · ไม่มีเสมอ
            </p>
          )}
        </div>

        {uclByRound.map((round) => (
          <section key={`ucl-${round.id}`} className="rounded-xl border border-amber-100 bg-white/80 p-5">
            <h3 className="font-semibold text-amber-950">
              UCL · {round.label}{' '}
              <span className="text-sm font-normal text-slate-500">· MD {round.matchdayOffset}</span>
            </h3>
            {round.fixtures.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ยังไม่จับสลาก / รอรอบก่อนหน้า</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {round.fixtures.map((f) => (
                  <li key={f.id} className="flex justify-between rounded bg-amber-50/80 px-2 py-1.5">
                    <span>
                      {nameOf(f.homeClubId)} vs {nameOf(f.awayClubId)}
                    </span>
                    <span className="font-semibold">
                      {f.played ? `${f.homeGoals}–${f.awayGoals}` : f.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </section>

      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">{save.cup.name}</h2>
          {save.cup.championClubId ? (
            <p className="mt-2 text-sm font-semibold text-emerald-800">
              แชมป์: {nameOf(save.cup.championClubId)}
            </p>
          ) : (
            <p className="mt-2 text-sm text-slate-600">แข่งคู่ขนานลีก · ไม่มีเสมอ (มีผู้ชนะเสมอ)</p>
          )}
        </div>

        {cupByRound.map((round) => (
          <section key={round.id} className="rounded-xl border border-slate-200 bg-white/80 p-5">
            <h3 className="font-semibold">
              {round.label}{' '}
              <span className="text-sm font-normal text-slate-500">· MD {round.matchdayOffset}</span>
            </h3>
            {round.fixtures.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ยังไม่จับสลาก / รอรอบก่อนหน้า</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {round.fixtures.map((f) => (
                  <li key={f.id} className="flex justify-between rounded bg-slate-50 px-2 py-1.5">
                    <span>
                      {nameOf(f.homeClubId)} vs {nameOf(f.awayClubId)}
                    </span>
                    <span className="font-semibold">
                      {f.played ? `${f.homeGoals}–${f.awayGoals}` : f.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </section>
    </div>
  )
}
