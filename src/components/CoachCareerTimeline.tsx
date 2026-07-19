import type { CoachCareer, WorldCoach } from '@/game/worldCoaches'
import {
  careerRoleLabelTh,
  formatCareerYears,
  getCoachCareer,
} from '@/game/worldCoaches'
import { CoachFace } from '@/components/CoachFace'

export function CoachCareerTimeline({
  coach,
  compact = false,
}: {
  coach: WorldCoach
  compact?: boolean
}) {
  const career: CoachCareer | null = getCoachCareer(coach.id)
  if (!career) {
    return (
      <p className="text-xs text-slate-500">ยังไม่มีประวัติในฐานข้อมูล</p>
    )
  }

  const timeline = career.timeline.slice().sort((a, b) => a.from - b.from)

  return (
    <div className={compact ? 'mt-2' : 'mt-3'}>
      {!compact ? (
        <p className="text-sm font-semibold text-slate-900">ประวัติการคุมทีม</p>
      ) : null}
      <p className={`text-xs text-slate-600 ${compact ? '' : 'mt-1'}`}>{career.summaryTh}</p>
      <ol className={`relative mt-3 space-y-3 border-l border-indigo-200 pl-4 ${compact ? 'max-h-48 overflow-y-auto' : 'max-h-72 overflow-y-auto'}`}>
        {timeline.map((stint, i) => {
          const years = formatCareerYears(stint.from, stint.to)
          const team = stint.teamTh || stint.team
          const honours = stint.honours ?? []
          return (
            <li key={`${stint.team}-${stint.from}-${i}`} className="relative">
              <span className="absolute -left-[1.15rem] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-indigo-400 bg-white" />
              <p className="text-[11px] font-semibold tracking-wide text-indigo-700 uppercase">
                {years}
                <span className="ml-2 font-normal normal-case text-slate-400">
                  {careerRoleLabelTh(stint.role)}
                </span>
              </p>
              <p className="text-sm font-semibold text-slate-900">{team}</p>
              {honours.length > 0 ? (
                <p className="mt-0.5 text-xs text-emerald-800">
                  แชมป์: {honours.join(' · ')}
                </p>
              ) : (
                <p className="mt-0.5 text-xs text-slate-400">ไม่มีถ้วยใหญ่ในช่วงนี้ / ยังสะสม</p>
              )}
              {stint.noteTh ? (
                <p className="mt-0.5 text-xs text-slate-500">{stint.noteTh}</p>
              ) : null}
            </li>
          )
        })}
      </ol>
    </div>
  )
}

/** การ์ดประวัติแบบเต็มพร้อมใบหน้า — ใช้ตอนเลือกโค้ชจากตลาด */
export function CoachCareerCard({ coach }: { coach: WorldCoach }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-start gap-3">
        <CoachFace coachId={coach.id} name={coach.name} size="md" className="ring-1 ring-slate-200" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-slate-900">{coach.name}</p>
          <p className="text-xs text-slate-500">
            {coach.nationTh} · พลัง {coach.power} · {coach.styleLabelTh}
          </p>
        </div>
      </div>
      <CoachCareerTimeline coach={coach} />
    </div>
  )
}
