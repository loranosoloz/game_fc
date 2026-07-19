import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import type { InjuryTreatment } from '@/game/types'
import {
  INJURY_TYPE_LABEL,
  TREATMENT_HINT,
  TREATMENT_LABEL,
  estimatedReturnMatchdays,
  formatInjuryStatus,
  recoveryTickAmount,
} from '@/game/medical'
import { staffLevel } from '@/game/staff'
import { formatBanStatus } from '@/game/discipline'
import { GhostButton, PageHeader, Panel, StatTile } from '@/components/ui'

const TREATMENTS: InjuryTreatment[] = ['rest', 'physio', 'injection']

export function MedicalPage() {
  const save = useGameStore((s) => s.save)!
  const setInjuryTreatment = useGameStore((s) => s.setInjuryTreatment)
  const upgradeStaffRole = useGameStore((s) => s.upgradeStaffRole)
  const physio = staffLevel(save.staff, 'physio')

  const squad = save.players.filter((p) => p.clubId === save.humanClubId)
  const injured = squad
    .filter((p) => p.injuryDays > 0)
    .sort((a, b) => b.injuryDays - a.injuryDays)
  const banned = squad.filter((p) => (p.banMatches ?? 0) > 0)
  const lowCond = squad
    .filter((p) => p.injuryDays <= 0 && p.condition < 70)
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 10)
  const historyHits = squad
    .flatMap((p) =>
      (p.injuryHistory ?? []).slice(0, 3).map((h) => ({
        player: p,
        ...h,
      })),
    )
    .slice(0, 12)

  return (
    <div className="space-y-5">
      <PageHeader
        title="ศูนย์แพทย์"
        subtitle={`แผนรักษา · ประวัติ · วินัย · Physio Lv.${physio}`}
        actions={
          <GhostButton onClick={() => upgradeStaffRole('physio')}>อัปเกรด Physio</GhostButton>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="บาดเจ็บ" value={injured.length} hint="คนในสควอด" accent={injured.length > 0} />
        <StatTile label="โดนแบน" value={banned.length} hint="ใบแดง / สะสมเหลือง" />
        <StatTile label="สภาพต่ำ" value={lowCond.length} hint="condition &lt; 70%" />
      </div>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Panel className="space-y-5">
          <div>
            <h3 className="text-sm font-bold text-slate-900">รายการบาดเจ็บ</h3>
            {injured.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ไม่มีนักเตะเจ็บ — สควอดพร้อมลง</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {injured.map((p) => {
                  const tick = recoveryTickAmount(p, physio)
                  return (
                    <li
                      key={p.id}
                      className="rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white px-4 py-3"
                    >
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <span className="font-bold text-rose-950">
                          <span className="text-slate-500">{roleShort(p.role)}</span> {p.name}
                          <span className="ml-2 text-xs font-normal text-slate-500">{p.age}ย</span>
                        </span>
                        <span className="text-sm font-semibold text-rose-800">
                          {p.injuryType ? INJURY_TYPE_LABEL[p.injuryType] : 'เจ็บ'} · {p.injuryDays}{' '}
                          วัน · ≈{estimatedReturnMatchdays(p)} นัด
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Condition {p.condition}% · ฟื้น −{tick} วัน/tick · ประวัติ{' '}
                        {(p.injuryHistory ?? []).length} ครั้ง
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {TREATMENTS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            title={TREATMENT_HINT[t]}
                            onClick={() => setInjuryTreatment(p.id, t)}
                            className={cn(
                              'rounded-md border px-2.5 py-1 text-xs font-semibold',
                              p.treatment === t
                                ? 'border-slate-900 bg-slate-900 text-lime-300'
                                : 'border-slate-300 bg-white hover:bg-slate-50',
                            )}
                          >
                            {TREATMENT_LABEL[t]}
                          </button>
                        ))}
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-500">
                        {p.treatment ? TREATMENT_HINT[p.treatment] : ''}
                      </p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {banned.length > 0 ? (
            <div>
              <h3 className="text-sm font-bold text-slate-900">แบนแข่งขัน</h3>
              <ul className="mt-2 space-y-1 text-sm">
                {banned.map((p) => (
                  <li
                    key={p.id}
                    className="flex justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span>
                      {roleShort(p.role)} {p.name} · เหลืองฤดูกาล {p.seasonYellows ?? 0}
                    </span>
                    <span className="font-semibold text-amber-900">{formatBanStatus(p)}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div>
            <h3 className="text-sm font-bold text-slate-900">สภาพต่ำ</h3>
            {lowCond.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">สควอดฟิตดี</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {lowCond.map((p) => (
                  <li key={p.id} className="flex justify-between rounded-lg bg-slate-50 px-3 py-2">
                    <span>
                      {roleShort(p.role)} {p.name}
                    </span>
                    <span>{formatInjuryStatus(p)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ประวัติบาดเจ็บ</h3>
          <p className="mt-1 text-sm text-slate-600">
            ประวัติเจ็บล่าสุดกระทบมูลค่าตลาด · อัปเกรดที่{' '}
            <Link to="/staff" className="font-semibold underline underline-offset-2">
              สตาฟ
            </Link>
          </p>
          {historyHits.length === 0 ? (
            <p className="mt-4 text-sm text-slate-500">ยังไม่มีประวัติในเซฟนี้</p>
          ) : (
            <ul className="mt-4 space-y-1.5 text-sm">
              {historyHits.map((h, i) => (
                <li
                  key={`${h.player.id}-${i}`}
                  className="flex justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span>
                    <span className="font-medium">{h.player.name}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {INJURY_TYPE_LABEL[h.type]} ({h.source === 'match' ? 'แข่ง' : 'ซ้อม'})
                    </span>
                  </span>
                  <span className="tabular-nums text-slate-600">{h.days}ว</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
