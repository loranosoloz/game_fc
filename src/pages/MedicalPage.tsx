import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import type { InjuryTreatment } from '@/game/types'
import {
  INJURY_TYPE_LABEL,
  TREATMENT_LABEL,
  formatInjuryStatus,
  recoveryTickAmount,
} from '@/game/medical'
import { staffLevel } from '@/game/staff'

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
    <div className="grid gap-6 lg:grid-cols-[1.2fr_1fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Medical Centre</h2>
            <p className="text-sm text-slate-600">
              บาดเจ็บ · แผนรักษา · ประวัติ · Physio Lv.{physio}
            </p>
          </div>
          <button
            type="button"
            onClick={() => upgradeStaffRole('physio')}
            className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
          >
            อัปเกรด Physio
          </button>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">บาดเจ็บ ({injured.length})</h3>
          {injured.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">ไม่มีนักเตะเจ็บ</p>
          ) : (
            <ul className="mt-2 space-y-3">
              {injured.map((p) => {
                const tick = recoveryTickAmount(p, physio)
                return (
                  <li
                    key={p.id}
                    className="rounded-lg border border-rose-100 bg-rose-50/80 px-3 py-2.5 text-sm"
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <span className="font-semibold text-rose-950">
                        <span className="text-slate-500">{roleShort(p.role)}</span> {p.name}
                      </span>
                      <span className="text-rose-800">
                        {p.injuryType ? INJURY_TYPE_LABEL[p.injuryType] : 'เจ็บ'} · {p.injuryDays}{' '}
                        วัน · −{tick}/tick
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Condition {p.condition}% · แผนปัจจุบัน{' '}
                      {p.treatment ? TREATMENT_LABEL[p.treatment] : '—'}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {TREATMENTS.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setInjuryTreatment(p.id, t)}
                          className={cn(
                            'rounded border px-2 py-1 text-xs font-medium',
                            p.treatment === t
                              ? 'border-slate-900 bg-slate-900 text-lime-300'
                              : 'border-slate-300 bg-white hover:bg-white/90',
                          )}
                        >
                          {TREATMENT_LABEL[t]}
                        </button>
                      ))}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-700">สภาพต่ำ</h3>
          {lowCond.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">สควอดฟิตดี</p>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {lowCond.map((p) => (
                <li key={p.id} className="flex justify-between rounded bg-amber-50 px-2 py-1.5">
                  <span>
                    <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                  </span>
                  <span>{formatInjuryStatus(p)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">ประวัติบาดเจ็บ</h2>
        <p className="text-sm text-slate-600">
          ประวัติเจ็บล่าสุดกระทบมูลค่าตลาด · อัปเกรด physio ที่{' '}
          <Link to="/staff" className="underline underline-offset-2">
            สตาฟ
          </Link>
        </p>
        {historyHits.length === 0 ? (
          <p className="text-sm text-slate-500">ยังไม่มีประวัติในเซฟนี้</p>
        ) : (
          <ul className="space-y-1.5 text-sm">
            {historyHits.map((h, i) => (
              <li
                key={`${h.player.id}-${i}`}
                className="flex justify-between gap-2 rounded border border-slate-100 px-2 py-1.5"
              >
                <span>
                  <span className="font-medium">{h.player.name}</span>
                  <span className="text-slate-500">
                    {' '}
                    · {INJURY_TYPE_LABEL[h.type]} ({h.source === 'match' ? 'แข่ง' : 'ซ้อม'})
                  </span>
                </span>
                <span className="text-slate-600">{h.days}ว</span>
              </li>
            ))}
          </ul>
        )}
        <p className="text-xs text-slate-500">
          พัก = ฟื้นสภาพดี · Physio = ลดวันเร็วขึ้น (โดยเฉพาะกล้ามเนื้อ) · ฉีดยา = ลดวันเร็วสุด
          แต่กระดูกยังช้าถ้าไม่ฉีด
        </p>
      </section>
    </div>
  )
}
