import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'
import { sortedTable } from '@/game/simulate'
import { PrimaryButton } from '@/components/ui'
import { ClubCrest } from '@/components/ClubCrest'

const navGroups = [
  {
    label: 'ศูนย์กลาง',
    links: [
      { to: '/portal', label: 'พอร์ทัล' },
      { to: '/media', label: 'สื่อ' },
      { to: '/match', label: 'แมตช์' },
      { to: '/competitions', label: 'ถ้วย' },
      { to: '/table', label: 'ตาราง' },
    ],
  },
  {
    label: 'ทีม',
    links: [
      { to: '/squad', label: 'สควอด' },
      { to: '/meetings', label: 'คุยกับนักเตะ' },
      { to: '/club-vision', label: 'บอร์ด/แฟน' },
      { to: '/tactics', label: 'แท็กติก' },
      { to: '/training', label: 'ซ้อม' },
      { to: '/medical', label: 'แพทย์' },
      { to: '/development', label: 'พัฒนา' },
      { to: '/youth', label: 'เยาวชน' },
    ],
  },
  {
    label: 'สโมสร',
    links: [
      { to: '/staff', label: 'สตาฟ' },
      { to: '/scouting', label: 'สเกาต์' },
      { to: '/transfers', label: 'ตลาด' },
      { to: '/finance', label: 'การเงิน' },
      { to: '/data', label: 'Data' },
      { to: '/save', label: 'เซฟ' },
    ],
  },
]

export function AppShell() {
  const navigate = useNavigate()
  const save = useGameStore((s) => s.save)
  const status = useGameStore((s) => s.status)
  const clearStatus = useGameStore((s) => s.clearStatus)

  if (!save) return null

  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const rank =
    sortedTable(save.table).findIndex((r) => r.clubId === save.humanClubId) + 1
  const nextHuman = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const banned = save.players.filter(
    (p) => p.clubId === save.humanClubId && (p.banMatches ?? 0) > 0,
  ).length
  const injured = save.players.filter(
    (p) => p.clubId === save.humanClubId && p.injuryDays > 0,
  ).length
  const sick = save.players.filter(
    (p) => p.clubId === save.humanClubId && (p.illnessDays ?? 0) > 0,
  ).length

  return (
    <div className="mx-auto flex min-h-full max-w-7xl flex-col gap-4 px-4 py-4 md:py-6">
      <header className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 text-slate-100 shadow-lg">
        <div className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <ClubCrest club={club} size="md" className="rounded-md bg-white/10 p-0.5" />
              <h1 className="truncate text-xl font-bold tracking-tight md:text-2xl">{club.name}</h1>
            </div>
            <p className="mt-1 text-[11px] font-bold tracking-[0.22em] text-lime-300/90 uppercase">
              FC Manager · {save.leagueName}
            </p>
            <p className="mt-1 text-sm text-slate-400">
              {save.managerName} · ฤดูกาล {save.season} · {save.currentDate} · อันดับ #
              {rank || '—'}
              {injured > 0 ? ` · เจ็บ ${injured}` : ''}
              {sick > 0 ? ` · ป่วย ${sick}` : ''}
              {banned > 0 ? ` · แบน ${banned}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {nextHuman ? (
              <span className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                นัดถัดไป MD{nextHuman.matchday}
              </span>
            ) : null}
            <PrimaryButton
              disabled={save.seasonComplete}
              onClick={() => navigate('/match')}
            >
              {save.seasonComplete ? 'จบฤดูกาลแล้ว' : 'เตรียมนัด'}
            </PrimaryButton>
            {save.seasonComplete && !save.board?.sacked ? (
              <PrimaryButton
                onClick={() => {
                  useGameStore.getState().startNewSeason()
                }}
              >
                เริ่มฤดูกาลใหม่
              </PrimaryButton>
            ) : null}
            {!save.seasonComplete && !save.board?.sacked ? (
              <PrimaryButton
                onClick={() => useGameStore.getState().takeManagerHoliday(3)}
              >
                พักร้อน 3 MD
              </PrimaryButton>
            ) : null}
          </div>
        </div>
      </header>

      <nav className="space-y-2" aria-label="เมนูหลัก">
        {navGroups.map((group) => (
          <div key={group.label} className="flex flex-wrap items-center gap-1">
            <span className="mr-1 w-14 shrink-0 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
              {group.label}
            </span>
            {group.links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  cn(
                    'rounded-md px-2.5 py-1.5 text-sm font-medium transition',
                    isActive
                      ? 'bg-slate-900 text-lime-300 shadow-sm'
                      : 'bg-white/70 text-slate-600 ring-1 ring-slate-200/80 hover:bg-white hover:text-slate-900',
                  )
                }
              >
                {link.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {status ? (
        <div
          className="flex items-start justify-between gap-3 rounded-xl border border-lime-400/50 bg-lime-50 px-4 py-2.5 text-sm text-slate-800 shadow-sm"
          role="status"
        >
          <p>{status}</p>
          <button
            type="button"
            className="shrink-0 text-slate-500 hover:text-slate-800"
            onClick={clearStatus}
            aria-label="ปิดข้อความ"
          >
            ×
          </button>
        </div>
      ) : null}

      <main className="flex-1 pb-10">
        <Outlet />
      </main>
    </div>
  )
}
