import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function MatchPage() {
  const navigate = useNavigate()
  const save = useGameStore((s) => s.save)!
  const startLiveMatch = useGameStore((s) => s.startLiveMatch)
  const playNextMatchday = useGameStore((s) => s.playNextMatchday)

  const humanFixtures = save.fixtures.filter(
    (f) => f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId,
  )
  const next = humanFixtures.find((f) => !f.played)
  const recent = humanFixtures.filter((f) => f.played).slice(-5).reverse()
  const last = save.lastHumanResult

  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id
  const tag = (id: string) => (id === save.humanClubId ? 'คุณ' : 'AI')

  const dayFixtures =
    next != null ? save.fixtures.filter((f) => f.matchday === next.matchday) : []

  const enterLive = () => {
    if (startLiveMatch()) navigate('/match/live')
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">นัดถัดไปของคุณ</h2>
        {next ? (
          <div className="mt-3 space-y-3">
            <p className="text-2xl font-bold tracking-tight">
              {nameOf(next.homeClubId)}{' '}
              <span className="text-sm font-normal text-slate-400">({tag(next.homeClubId)})</span>
              <span className="mx-2 text-slate-400">พบ</span>
              {nameOf(next.awayClubId)}{' '}
              <span className="text-sm font-normal text-slate-400">({tag(next.awayClubId)})</span>
            </p>
            <p className="text-sm text-slate-600">
              แมตช์เดย์ {next.matchday} · {next.date}
            </p>
            <p className="text-sm text-slate-600">
              วันเดียวกันมี <strong>{dayFixtures.length}</strong> นัด (นัดคุณบนสนาม + นัด AI
              ในพื้นหลัง)
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={enterLive}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
              >
                เข้าแมตช์ (สนาม + คำบรรยาย)
              </button>
              <button
                type="button"
                onClick={playNextMatchday}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
              >
                ผลทันที
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-slate-600">ไม่มีนัดเหลือสำหรับทีมคุณ</p>
            {!save.seasonComplete ? (
              <button
                type="button"
                onClick={playNextMatchday}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
              >
                จำลองแมตช์เดย์ AI ถัดไป
              </button>
            ) : null}
          </div>
        )}

        {last ? (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="font-semibold">ผลล่าสุด (คุณ)</h3>
            <p className="mt-1 text-xl font-bold">
              {last.homeGoals} – {last.awayGoals}
            </p>
            <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-sm text-slate-600">
              {last.events
                .filter((e) => e.kind === 'goal' || e.kind === 'fulltime')
                .map((e) => (
                  <li key={e.id ?? `${e.minute}-${e.playerName}`}>
                    {e.minute}&apos; {e.text ?? `${e.playerName ?? 'เหตุการณ์'}`}
                  </li>
                ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">ผลล่าสุดของทีมคุณ</h2>
        <ul className="mt-3 space-y-2 text-sm">
          {recent.length === 0 ? (
            <li className="text-slate-500">ยังไม่เคยลงแข่ง</li>
          ) : (
            recent.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-md bg-slate-50 px-3 py-2"
              >
                <span>
                  {nameOf(f.homeClubId)} พบ {nameOf(f.awayClubId)}
                </span>
                <span className="font-semibold">
                  {f.homeGoals}–{f.awayGoals}
                </span>
              </li>
            ))
          )}
        </ul>
      </section>
    </div>
  )
}
