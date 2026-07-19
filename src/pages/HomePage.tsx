import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listClubOptionsForLeague } from '@/game/worldSeed'
import { listLeagues, type LeagueId } from '@/data/world'
import { useGameStore } from '@/store/gameStore'
import { loadFromStorage } from '@/game/save'

export function HomePage() {
  const navigate = useNavigate()
  const newGame = useGameStore((s) => s.newGame)
  const continueGame = useGameStore((s) => s.continueGame)
  const hasSave = useMemo(() => Boolean(loadFromStorage()), [])
  const leagues = listLeagues()
  const [leagueId, setLeagueId] = useState<LeagueId>('eng')
  const clubs = useMemo(() => listClubOptionsForLeague(leagueId), [leagueId])
  const [managerName, setManagerName] = useState('Manager')
  const [clubId, setClubId] = useState(clubs[0]?.id ?? 'club-1')

  // Reset club when league changes
  const onLeagueChange = (id: LeagueId) => {
    setLeagueId(id)
    const nextClubs = listClubOptionsForLeague(id)
    setClubId(nextClubs[0]?.id ?? 'club-1')
  }

  const start = () => {
    newGame(managerName, clubId, leagueId)
    navigate('/portal')
  }

  const resume = () => {
    if (continueGame()) navigate('/portal')
  }

  const leagueMeta = leagues.find((l) => l.id === leagueId)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
          World leagues
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          FC Manager
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          เลือกลีกจริง 6 ลีก — อังกฤษ สเปน เยอรมัน ฝรั่งเศส อิตาลี ไทย — คุม 1 สโมสร ที่เหลือ 19 เป็น
          AI ชื่อสโมสรและนักเตะดาวใช้ชื่อจริง
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <h2 className="text-lg font-semibold text-slate-900">เริ่มอาชีพใหม่</h2>
        <div className="mt-4 grid gap-4">
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700">ชื่อผู้จัดการ</span>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
              value={managerName}
              onChange={(e) => setManagerName(e.target.value)}
            />
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700">ลีก</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
              value={leagueId}
              onChange={(e) => onLeagueChange(e.target.value as LeagueId)}
            >
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.nameTh} — {l.name}
                </option>
              ))}
            </select>
            {leagueMeta ? (
              <span className="text-xs text-slate-500">
                {leagueMeta.nation} · ถ้วย {leagueMeta.cupName}
              </span>
            ) : null}
          </label>
          <label className="grid gap-1.5 text-sm">
            <span className="font-medium text-slate-700">เลือกสโมสรของคุณ (ที่เหลือเป็น AI)</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
            >
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.shortName}) · ชื่อเสียง {c.reputation}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={start}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
          >
            เริ่มฤดูกาล
          </button>
        </div>
      </section>

      {hasSave ? (
        <button
          type="button"
          onClick={resume}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          โหลดเกมที่เซฟไว้
        </button>
      ) : null}
    </div>
  )
}
