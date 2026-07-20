import { useMemo, useState } from 'react'
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
import { medicalStaminaProfile } from '@/game/medicalStamina'
import { BODY_PART_LABEL, bodyMapSummary } from '@/game/bodyMap'
import { ILLNESS_TYPE_LABEL, isIll } from '@/game/illness'
import { staffLevel } from '@/game/staff'
import { formatBanStatus } from '@/game/discipline'
import { BodyMapFigure } from '@/components/BodyMapFigure'
import { PlayerFace } from '@/components/PlayerFace'
import { GhostButton, PageHeader, Panel, StatTile } from '@/components/ui'

const TREATMENTS: InjuryTreatment[] = ['rest', 'physio', 'injection']

export function MedicalPage() {
  const save = useGameStore((s) => s.save)!
  const setInjuryTreatment = useGameStore((s) => s.setInjuryTreatment)
  const physio = staffLevel(save.staff, 'physio')

  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save.players, save.humanClubId],
  )
  const injured = squad
    .filter((p) => p.injuryDays > 0)
    .sort((a, b) => b.injuryDays - a.injuryDays)
  const sick = squad.filter((p) => isIll(p)).sort((a, b) => b.illnessDays - a.illnessDays)
  const banned = squad.filter((p) => (p.banMatches ?? 0) > 0)
  const lowCond = squad
    .filter((p) => p.injuryDays <= 0 && p.condition < 70)
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 10)
  const atRisk = squad
    .filter((p) => {
      const s = bodyMapSummary(p)
      return s.red > 0 || s.yellow >= 4
    })
    .slice(0, 8)
  const historyHits = squad
    .flatMap((p) =>
      (p.injuryHistory ?? []).slice(0, 3).map((h) => ({
        player: p,
        ...h,
      })),
    )
    .slice(0, 12)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected =
    squad.find((p) => p.id === selectedId) ??
    injured[0] ??
    atRisk[0] ??
    squad[0] ??
    null

  return (
    <div className="space-y-5">
      <PageHeader
        title="ศูนย์แพทย์"
        subtitle={`แผนที่ร่างกาย · แผนรักษา · Physio Lv.${physio}`}
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile label="บาดเจ็บ" value={injured.length} hint="คนในสควอด" accent={injured.length > 0} />
        <StatTile label="ป่วย" value={sick.length} hint="หวัด / ไข้ / ไวรัส" accent={sick.length > 0} />
        <StatTile label="เสี่ยง (แดง/เหลือง)" value={atRisk.length} hint="body map" />
        <StatTile label="โดนแบน" value={banned.length} hint="ใบแดง / สะสมเหลือง" />
        <StatTile label="สภาพต่ำ" value={lowCond.length} hint="condition &lt; 70%" />
      </div>

      <Panel className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-slate-900">แผนที่ร่างกายรายคน</h3>
            <p className="text-xs text-slate-500">
              เขียว / เหลือง / แดง ตามส่วน — ใช้กับทุกนักเตะในโลกเกม (รวม AI) · แสดงสควอดคุณที่นี่
            </p>
          </div>
          <select
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
            value={selected?.id ?? ''}
            onChange={(e) => setSelectedId(e.target.value)}
          >
            {squad.map((p) => {
              const s = bodyMapSummary(p)
              return (
                <option key={p.id} value={p.id}>
                  {roleShort(p.role)} {p.name}
                  {p.injuryDays > 0
                    ? ' · เจ็บ'
                    : isIll(p)
                      ? ' · ป่วย'
                      : s.red > 0
                        ? ' · แดง'
                        : s.yellow > 3
                          ? ' · อ่อน'
                          : ''}
                </option>
              )
            })}
          </select>
        </div>
        {selected ? <BodyMapFigure player={selected} /> : null}
      </Panel>

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
                      className={cn(
                        'cursor-pointer rounded-xl border border-rose-200/80 bg-gradient-to-br from-rose-50 to-white px-4 py-3',
                        selected?.id === p.id && 'ring-2 ring-slate-900/20',
                      )}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 font-bold text-rose-950">
                          <PlayerFace name={p.name} size="sm" />
                          <span>
                            <span className="text-slate-500">{roleShort(p.role)}</span> {p.name}
                            <span className="ml-2 text-xs font-normal text-slate-500">{p.age}ย</span>
                          </span>
                        </span>
                        <span className="text-sm font-semibold text-rose-800">
                          {p.injuryType ? INJURY_TYPE_LABEL[p.injuryType] : 'เจ็บ'}
                          {p.injuryBodyPart ? ` · ${BODY_PART_LABEL[p.injuryBodyPart]}` : ''} ·{' '}
                          {p.injuryDays} วัน · ≈{estimatedReturnMatchdays(p)} นัด
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        Stamina {p.condition}%
                        {(() => {
                          const med = medicalStaminaProfile(p)
                          return (
                            <>
                              {' '}
                              · {med.status === 'out' ? 'ห้ามลง' : 'ลงได้แบบประคอง'} · เพดาน ~
                              {med.staminaCap}% · ฟื้น×{med.recoveryMul.toFixed(2)} · ฟื้น −{tick}{' '}
                              วัน/tick
                            </>
                          )
                        })()}
                      </p>
                      <p className="mt-0.5 text-[11px] text-slate-500">
                        {medicalStaminaProfile(p).detailTh}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {TREATMENTS.map((t) => (
                          <button
                            key={t}
                            type="button"
                            title={TREATMENT_HINT[t]}
                            onClick={(e) => {
                              e.stopPropagation()
                              setInjuryTreatment(p.id, t)
                            }}
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
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div>
            <h3 className="text-sm font-bold text-slate-900">รายการป่วย</h3>
            {sick.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ไม่มีนักเตะป่วย</p>
            ) : (
              <ul className="mt-3 space-y-2">
                {sick.map((p) => (
                  <li
                    key={p.id}
                    className={cn(
                      'cursor-pointer rounded-xl border border-violet-200/80 bg-gradient-to-br from-violet-50 to-white px-4 py-3',
                      selected?.id === p.id && 'ring-2 ring-slate-900/20',
                    )}
                    onClick={() => setSelectedId(p.id)}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-2 font-bold text-violet-950">
                        <PlayerFace name={p.name} size="sm" />
                        <span>
                          <span className="text-slate-500">{roleShort(p.role)}</span> {p.name}
                        </span>
                      </span>
                      <span className="text-sm font-semibold text-violet-800">
                        {p.illnessType ? ILLNESS_TYPE_LABEL[p.illnessType] : 'ป่วย'} ·{' '}
                        {p.illnessDays} วัน
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-600">
                      Stamina {p.condition}% · {medicalStaminaProfile(p).detailTh}
                    </p>
                  </li>
                ))}
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
                    className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span className="truncate">
                        {roleShort(p.role)} {p.name} · เหลืองฤดูกาล {p.seasonYellows ?? 0}
                      </span>
                    </span>
                    <span className="shrink-0 font-semibold text-amber-900">{formatBanStatus(p)}</span>
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
                  <li
                    key={p.id}
                    className="flex cursor-pointer items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 hover:bg-slate-100"
                    onClick={() => setSelectedId(p.id)}
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span className="truncate">
                        {roleShort(p.role)} {p.name}
                      </span>
                    </span>
                    <span className="shrink-0">{formatInjuryStatus(p)}</span>
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
                  className="flex items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerFace name={h.player.name} size="xs" />
                    <span className="truncate">
                      <span className="font-medium">{h.player.name}</span>
                      <span className="text-slate-500">
                        {' '}
                        · {INJURY_TYPE_LABEL[h.type]}
                        {h.bodyPart ? ` · ${BODY_PART_LABEL[h.bodyPart]}` : ''} (
                        {h.source === 'match' ? 'แข่ง' : 'ซ้อม'})
                      </span>
                    </span>
                  </span>
                  <span className="shrink-0 tabular-nums text-slate-600">{h.days}ว</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>
    </div>
  )
}
