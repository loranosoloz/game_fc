import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { cn } from '@/lib/cn'
import { sortedTable } from '@/game/simulate'
import { PrimaryButton } from '@/components/ui'
import { ClubCrest } from '@/components/ClubCrest'
import { StatusModal } from '@/components/StatusModal'
import { canAdvanceDay, dayAdvanceBlockMessage } from '@/game/advanceGates'

/** เมนูแนวนอนแบบ FM — กลุ่มคั่นด้วยเส้น */
const navGroups = [
  {
    label: 'ศูนย์กลาง',
    links: [
      { to: '/portal', label: 'พอร์ทัล' },
      { to: '/calendar', label: 'ปฏิทิน' },
      { to: '/preseason', label: 'ปรีซีซั่น' },
      { to: '/media', label: 'สื่อ' },
      { to: '/awards', label: 'รางวัล' },
      { to: '/history', label: 'ประวัติ' },
      { to: '/match', label: 'แมตช์' },
      { to: '/competitions', label: 'ถ้วย' },
      { to: '/table', label: 'ตาราง' },
    ],
  },
  {
    label: 'ทีม',
    links: [
      { to: '/squad', label: 'สควอด' },
      { to: '/registration', label: 'ทะเบียน' },
      { to: '/meetings', label: 'ประชุม' },
      { to: '/dynamics', label: 'Dynamics' },
      { to: '/club-vision', label: 'บอร์ด' },
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
    <div className="flex min-h-full w-full flex-col">
      <header className="sticky top-0 z-40 w-full border-b border-slate-800 bg-slate-900 text-slate-100 shadow-md">
        {/* Title bar */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2 lg:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <ClubCrest club={club} size="sm" className="shrink-0 rounded bg-white/10 p-0.5" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                <h1 className="truncate text-sm font-bold tracking-tight md:text-base">{club.name}</h1>
                <span className="hidden text-[10px] font-bold tracking-[0.16em] text-lime-300/90 uppercase sm:inline">
                  FC Manager
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">
                {save.managerName} · {save.leagueName} · S{save.season} · {save.currentDate} · #
                {rank || '—'}
                {injured > 0 ? ` · เจ็บ ${injured}` : ''}
                {sick > 0 ? ` · ป่วย ${sick}` : ''}
                {banned > 0 ? ` · แบน ${banned}` : ''}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {nextHuman ? (
              <span className="hidden rounded border border-slate-700 bg-slate-800/80 px-2 py-1 text-[11px] text-slate-300 md:inline">
                นัดถัดไป MD{nextHuman.matchday} · {nextHuman.date}
              </span>
            ) : null}
            {!save.seasonComplete ? (
              <PrimaryButton
                className="px-2.5 py-1.5 text-xs"
                disabled={!canAdvanceDay(save)}
                title={dayAdvanceBlockMessage(save) ?? undefined}
                onClick={() => useGameStore.getState().advanceDay()}
              >
                เดิน 1 วัน
              </PrimaryButton>
            ) : null}
            <PrimaryButton
              className="px-2.5 py-1.5 text-xs"
              disabled={save.seasonComplete}
              onClick={() => navigate('/match')}
            >
              {save.seasonComplete ? 'จบฤดูกาล' : 'เตรียมนัด'}
            </PrimaryButton>
            {save.seasonComplete && !save.board?.sacked ? (
              <PrimaryButton
                className="px-2.5 py-1.5 text-xs"
                onClick={() => useGameStore.getState().startNewSeason()}
              >
                ฤดูกาลใหม่
              </PrimaryButton>
            ) : null}
            {!save.seasonComplete && !save.board?.sacked ? (
              <PrimaryButton
                className="px-2.5 py-1.5 text-xs"
                disabled={!canAdvanceDay(save)}
                title={dayAdvanceBlockMessage(save) ?? undefined}
                onClick={() => useGameStore.getState().takeManagerHoliday(3)}
              >
                พักร้อน
              </PrimaryButton>
            ) : null}
          </div>
        </div>

        {/* Navbar แนวนอนเต็มความกว้าง — เลื่อนได้บนจอแคบ */}
        <nav
          className="flex w-full items-stretch overflow-x-auto border-t border-slate-800 bg-slate-950"
          aria-label="เมนูหลัก"
        >
          {navGroups.map((group, gi) => (
            <div key={group.label} className="flex shrink-0 items-stretch">
              {gi > 0 ? (
                <div
                  className="w-px shrink-0 self-stretch bg-slate-700/80"
                  aria-hidden
                />
              ) : null}
              <span className="hidden items-center px-2 text-[9px] font-bold tracking-wider text-slate-600 uppercase xl:flex">
                {group.label}
              </span>
              {group.links.map((link) => (
                <NavLink
                  key={link.to}
                  to={link.to}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center px-2.5 py-2 text-xs font-semibold whitespace-nowrap transition md:px-3',
                      isActive
                        ? 'bg-lime-300/15 text-lime-300 shadow-[inset_0_-2px_0_0] shadow-lime-300'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
                    )
                  }
                >
                  {link.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
      </header>

      {status ? <StatusModal message={status} onClose={clearStatus} /> : null}

      <main className="w-full flex-1 px-3 py-4 pb-8 lg:px-4 xl:px-5">
        <Outlet />
      </main>
    </div>
  )
}
