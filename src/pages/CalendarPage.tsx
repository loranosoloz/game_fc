import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import { SeasonCalendarView } from '@/components/SeasonCalendarView'
import { PageHeader, Panel } from '@/components/ui'
import { LANG_LABEL_TH, managerLanguages } from '@/game/languages'

export function CalendarPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const summerReports = save.lastIntlTournamentReports ?? []
  const mgrLangLabel = managerLanguages(save.managerProfile)
    .map((l) => LANG_LABEL_TH[l] ?? l)
    .join(' · ')

  return (
    <div className="space-y-5">
      <PageHeader
        title="ปฏิทินฤดูกาล"
        subtitle={`${save.leagueName} · S${save.season} · ${save.currentDate}`}
        actions={
          <Link
            to="/portal"
            className="text-xs font-semibold text-sky-800 underline underline-offset-2"
          >
            ← กลับพอร์ทัล
          </Link>
        }
      />

      {save.seasonCalendar ? (
        <Panel>
          <SeasonCalendarView
            calendar={save.seasonCalendar}
            currentDate={save.currentDate}
            matchday={save.matchday}
            summerReports={summerReports}
            fixtures={save.fixtures}
            clubs={save.clubs}
            humanClubId={save.humanClubId}
            competitionNames={{
              league: save.leagueName,
              cup: save.cup.name,
              league_cup: save.leagueCup.name,
              trophy: save.trophy.name,
              ucl: save.ucl.name,
              uel: save.uel.name,
              uecl: save.uecl.name,
              acl: save.acl.name,
              acl_two: save.aclTwo.name,
              asean_cup: save.aseanCup.name,
              cwc: save.cwc.name,
              super_cup: save.superCup.name,
            }}
          />
          {mgrLangLabel ? (
            <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
              ภาษาผู้จัดการ: {mgrLangLabel}
            </p>
          ) : null}
        </Panel>
      ) : (
        <Panel tone="warn">
          <p className="text-sm text-slate-700">ยังไม่มีปฏิทินฤดูกาลในเซฟนี้</p>
        </Panel>
      )}

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ลิงก์ที่เกี่ยวข้อง</h3>
        <ul className="mt-2 flex flex-wrap gap-3 text-sm">
          <li>
            <Link to="/match" className="font-semibold text-sky-800 underline">
              แมตช์
            </Link>
          </li>
          <li>
            <Link to="/table" className="font-semibold text-sky-800 underline">
              ตารางลีก
            </Link>
          </li>
          <li>
            <Link to="/competitions" className="font-semibold text-sky-800 underline">
              ถ้วย
            </Link>
          </li>
          <li>
            <Link to="/preseason" className="font-semibold text-sky-800 underline">
              ปรีซีซั่น
            </Link>
          </li>
        </ul>
      </Panel>
    </div>
  )
}
