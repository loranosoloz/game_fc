import { useGameStore } from '@/store/gameStore'
import cupFormat from '@/data/cupFormat.json'
import leagueCupFormat from '@/data/leagueCupFormat.json'
import trophyFormat from '@/data/trophyFormat.json'
import uclFormat from '@/data/uclFormat.json'
import { ensurePhase5 } from '@/game/save'

function RoundBlock({
  title,
  rounds,
  fixtures,
  nameOf,
  tone = 'slate',
}: {
  title: string
  champion?: string | null
  subtitle?: string
  rounds: Array<{ id: string; label: string; matchdayOffset?: number }>
  fixtures: Array<{
    id: string
    cupRound?: string
    homeClubId: string
    awayClubId: string
    played: boolean
    homeGoals?: number
    awayGoals?: number
    date: string
    matchday: number
  }>
  nameOf: (id: string) => string
  tone?: 'slate' | 'amber' | 'violet' | 'emerald'
}) {
  const border =
    tone === 'amber'
      ? 'border-amber-100'
      : tone === 'violet'
        ? 'border-violet-100'
        : tone === 'emerald'
          ? 'border-emerald-100'
          : 'border-slate-200'
  const bg =
    tone === 'amber'
      ? 'bg-amber-50/80'
      : tone === 'violet'
        ? 'bg-violet-50/80'
        : tone === 'emerald'
          ? 'bg-emerald-50/80'
          : 'bg-slate-50'

  return (
    <section className="space-y-4">
      <div className={`rounded-xl border ${border} bg-white/80 p-5`}>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {rounds.map((round) => {
        const list = fixtures.filter((f) => f.cupRound === round.id)
        const md =
          round.matchdayOffset ??
          (list[0]?.matchday != null ? list[0].matchday : '—')
        return (
          <section key={`${title}-${round.id}`} className={`rounded-xl border ${border} bg-white/80 p-5`}>
            <h3 className="font-semibold">
              {round.label}{' '}
              <span className="text-sm font-normal text-slate-500">· MD {md}</span>
            </h3>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ยังไม่จับสลาก / รอรอบก่อนหน้า</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {list.map((f) => (
                  <li key={f.id} className={`flex justify-between rounded ${bg} px-2 py-1.5`}>
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
        )
      })}
    </section>
  )
}

export function CompetitionsPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id

  const byComp = (comp: string) =>
    save.fixtures
      .filter((f) => f.competition === comp)
      .sort((a, b) => a.matchday - b.matchday)

  return (
    <div className="space-y-8">
      <RoundBlock
        title={save.ucl?.name ?? 'UEFA Champions League'}
        rounds={uclFormat.rounds.map((r) => ({
          id: r.id,
          label: r.label,
          matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
        }))}
        fixtures={byComp('ucl')}
        nameOf={nameOf}
        tone="amber"
      />
      {save.ucl?.championClubId ? (
        <p className="-mt-6 text-sm font-semibold text-emerald-800">
          แชมป์ยุโรป: {nameOf(save.ucl.championClubId)}
        </p>
      ) : (
        <p className="-mt-6 text-sm text-slate-600">
          League phase → Top 8 → QF/SF/Final
        </p>
      )}

      <RoundBlock
        title={save.cup.name}
        rounds={cupFormat.rounds}
        fixtures={byComp('cup')}
        nameOf={nameOf}
      />
      {save.cup.championClubId ? (
        <p className="-mt-6 text-sm font-semibold text-emerald-800">
          แชมป์ถ้วยชาติ: {nameOf(save.cup.championClubId)}
        </p>
      ) : (
        <p className="-mt-6 text-sm text-slate-600">ถ้วยใหญ่ · รวมทีมจากทั้งสองดิวิชัน (top 16 ตามชื่อเสียง)</p>
      )}

      <RoundBlock
        title={save.leagueCup?.name ?? 'League Cup'}
        rounds={leagueCupFormat.rounds}
        fixtures={byComp('league_cup')}
        nameOf={nameOf}
        tone="violet"
      />
      <p className="-mt-6 text-sm text-slate-600">ลีกคัพ · 32 ทีมจากดิวิชัน 1+2</p>

      <RoundBlock
        title={save.trophy?.name ?? 'Trophy'}
        rounds={trophyFormat.rounds}
        fixtures={byComp('trophy')}
        nameOf={nameOf}
        tone="emerald"
      />
      <p className="-mt-6 text-sm text-slate-600">ถ้วยลีกล่าง · เฉพาะดิวิชัน 2 (16 ทีม)</p>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">ลีกอื่นในโลก</h2>
        <p className="mt-1 text-xs text-slate-500">สรุปเบาๆ — อัปเดตหลังแมตช์เดย์</p>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">
          {(save.worldPulse?.leagues ?? []).map((l) => (
            <li key={l.leagueId} className="rounded-md bg-slate-50 px-3 py-2 text-sm">
              <p className="font-semibold">{l.nameTh}</p>
              <p className="text-xs text-slate-500">
                นำ {l.leader} · ที่ 2 {l.second} · MD{l.matchday}
              </p>
              <p className="text-xs text-slate-600">{l.note}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
