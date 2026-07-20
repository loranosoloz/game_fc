import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import type { IndividualFocus, TrainingFocus } from '@/game/types'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import { formatInjuryStatus, INJURY_TYPE_LABEL } from '@/game/medical'
import { individualFocusOptions, resolveTrainingFocus } from '@/game/training'
import { listSquadSeniors } from '@/game/squadSeniors'
import {
  ensurePlayerTacticalRoles,
  formatStyleLevelStars,
  type PlayerTacticalStyle,
} from '@/game/playerTacticalRoles'
import { styleTrainOrderLabel } from '@/game/styleTraining'
import { tacticalRoleShort } from '@/game/tacticalRoles'
import { PlayerFace } from '@/components/PlayerFace'

const FOCUSES: { id: TrainingFocus; label: string }[] = [
  { id: 'tactics', label: 'แท็กติก' },
  { id: 'fitness', label: 'ฟิตเนส' },
  { id: 'attacking', label: 'เกมรุก' },
  { id: 'defending', label: 'เกมรับ' },
  { id: 'setpieces', label: 'ลูกตั้งเตะ' },
  { id: 'rest', label: 'พักฟื้น' },
]

const DAYS = ['จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส', 'อา']
const INTENSITY: Array<'low' | 'medium' | 'high'> = ['low', 'medium', 'high']

export function TrainingPage() {
  const save = useGameStore((s) => s.save)!
  const setTraining = useGameStore((s) => s.setTraining)
  const setIndividualFocus = useGameStore((s) => s.setIndividualFocus)
  const runTrainingNow = useGameStore((s) => s.runTrainingNow)

  const weekPlan =
    save.training.weekPlan ??
    (['tactics', 'fitness', 'attacking', 'defending', 'tactics', 'setpieces', 'rest'] as TrainingFocus[])
  const todayFocus = resolveTrainingFocus(
    { ...save.training, weekPlan },
    save.matchday,
  )

  const injured = save.players
    .filter((p) => p.clubId === save.humanClubId && p.injuryDays > 0)
    .sort((a, b) => b.injuryDays - a.injuryDays)

  const lowCond = save.players
    .filter((p) => p.clubId === save.humanClubId && p.injuryDays <= 0 && p.condition < 70)
    .sort((a, b) => a.condition - b.condition)
    .slice(0, 8)

  const squad = save.players
    .filter((p) => p.clubId === save.humanClubId && !p.isYouth)
    .sort((a, b) => b.overall - a.overall)
    .slice(0, 18)

  const indOpts = individualFocusOptions() as Array<{ id: IndividualFocus; label: string }>

  const setDay = (dayIdx: number, focus: TrainingFocus) => {
    const next = [...weekPlan]
    next[dayIdx] = focus
    setTraining({ weekPlan: next })
  }

  const avgCond =
    save.players
      .filter((p) => p.clubId === save.humanClubId && p.injuryDays <= 0)
      .reduce((s, p) => s + p.condition, 0) /
    Math.max(
      1,
      save.players.filter((p) => p.clubId === save.humanClubId && p.injuryDays <= 0).length,
    )

  const seniors = listSquadSeniors(
    save.players.filter((p) => p.clubId === save.humanClubId),
    save.tacticsByClub[save.humanClubId],
    5,
  )

  return (
    <div className="space-y-5">
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">การซ้อม</h2>
          <p className="text-sm text-slate-600">
            ตารางรายสัปดาห์หมุนตามแมตช์เดย์ · วันนี้ใช้「
            {FOCUSES.find((f) => f.id === todayFocus)?.label ?? todayFocus}」
            · ซ้อมหนักเสี่ยงเจ็บ/ทะเลาะ · ซีเนียร์ช่วยคุมห้องซ้อม
          </p>

          {save.dynamics?.lastNote ? (
            <p className="rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
              ห้องแต่งตัว: {save.dynamics.lastNote}
              {save.dynamics.cohesion != null
                ? ` · สามัคคี ${save.dynamics.cohesion} · ลำดับชั้น ${save.dynamics.hierarchyStability}`
                : ''}
            </p>
          ) : null}

          {seniors.length > 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50/80 px-3 py-2">
              <p className="text-xs font-semibold text-emerald-900">แกนซีเนียร์</p>
              <ul className="mt-1 space-y-0.5 text-xs text-emerald-950">
                {seniors.map((s) => (
                  <li key={s.player.id}>
                    {s.player.name}
                    <span className="text-emerald-700">
                      {' '}
                      · {s.reasons.slice(0, 2).join(' · ')} · score {Math.round(s.score)}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {avgCond < 68 ? (
            <button
              type="button"
              className="w-full rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-left text-sm text-amber-950"
              onClick={() => setTraining({ focus: 'rest', intensity: 'low' })}
            >
              สควอดเหนื่อย (สภาพ {avgCond.toFixed(0)}) — กดเพื่อตั้งพักฟื้นทั้งทีม
            </button>
          ) : null}

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">โฟกัสหลัก (fallback)</p>
            <div className="flex flex-wrap gap-2">
              {FOCUSES.map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setTraining({ focus: f.id })}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium',
                    save.training.focus === f.id
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300 bg-white hover:bg-slate-50',
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">ตารางสัปดาห์ (จ–อา)</p>
            <div className="grid grid-cols-7 gap-1">
              {DAYS.map((d, i) => (
                <div key={d} className="text-center">
                  <p className="mb-1 text-[10px] font-bold text-slate-500">{d}</p>
                  <select
                    className="w-full rounded border border-slate-300 bg-white px-0.5 py-1 text-[10px]"
                    value={weekPlan[i] ?? 'tactics'}
                    onChange={(e) => setDay(i, e.target.value as TrainingFocus)}
                  >
                    {FOCUSES.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">ความเข้ม</p>
            <div className="flex flex-wrap gap-2">
              {INTENSITY.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => setTraining({ intensity: level })}
                  className={cn(
                    'rounded-md border px-3 py-1.5 text-sm font-medium capitalize',
                    save.training.intensity === level
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300 bg-white hover:bg-slate-50',
                  )}
                >
                  {level}
                </button>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={runTrainingNow}
            className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
          >
            ซ้อมพิเศษตอนนี้
          </button>
        </section>

        <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
          <div className="flex items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold">Medical (สรุป)</h2>
            <Link
              to="/medical"
              className="text-xs font-medium text-slate-700 underline underline-offset-2"
            >
              เปิด Medical Centre →
            </Link>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-700">บาดเจ็บ ({injured.length})</h3>
            {injured.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ไม่มีนักเตะเจ็บ</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {injured.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-2 rounded bg-rose-50 px-2 py-1.5 text-rose-900"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span className="truncate">
                        <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                        {p.injuryType ? (
                          <span className="ml-1 text-xs text-rose-700">
                            ({INJURY_TYPE_LABEL[p.injuryType]})
                          </span>
                        ) : null}
                      </span>
                    </span>
                    <span className="shrink-0">{p.injuryDays} วัน</span>
                  </li>
                ))}
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
                  <li key={p.id} className="flex items-center justify-between gap-2 rounded bg-amber-50 px-2 py-1.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span className="truncate">
                        <span className="font-semibold">{roleShort(p.role)}</span> {p.name}
                      </span>
                    </span>
                    <span className="shrink-0">{formatInjuryStatus(p)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">ฝึกสไตล์เล่น</h2>
        <p className="mt-1 text-xs text-slate-500">
          AI เลือกเป้าเป็นหลัก · สั่งบังคับได้ที่หน้า Squad · ซ้อมแต่ละแมตช์เดย์สะสม XP (★★★)
        </p>
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm">
          {squad.map((raw) => {
            const p = ensurePlayerTacticalRoles(raw)
            const styles = (p.preferredTacticalRoles ?? []) as PlayerTacticalStyle[]
            const target = p.styleTrainTarget
            const prog = p.styleTrainProgress ?? 0
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerFace name={p.name} size="xs" />
                  <span className="truncate">
                    <span className="font-semibold text-slate-500">{roleShort(p.role)}</span>{' '}
                    {p.name}
                    <span className="ml-2 text-[11px] text-slate-500">
                      {styles
                        .map((s) => `${tacticalRoleShort(s.id)}${formatStyleLevelStars(s.level)}`)
                        .join(' ')}
                    </span>
                  </span>
                </span>
                <span className="shrink-0 text-xs text-indigo-800">
                  {target
                    ? `ฝึก ${tacticalRoleShort(target)}${
                        styles.some((s) => s.id === target)
                          ? ` · XP ${styles.find((s) => s.id === target)?.xp ?? 0}%`
                          : ` · ปลดล็อก ${prog}%`
                      }`
                    : 'รอตั้งเป้า'}
                  <span className="ml-1 text-slate-400">
                    · {styleTrainOrderLabel(p.styleTrainOrder)}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">โฟกัสรายบุคคล</h2>
        <p className="mt-1 text-xs text-slate-500">
          เลือกจุดโฟกัสแอตทริบิวต์ต่อคน — มีผลตอนซ้อมอัตโนมัติหลังแมตช์เดย์
        </p>
        <ul className="mt-3 max-h-72 space-y-1 overflow-y-auto text-sm">
          {squad.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-50 py-1.5"
            >
              <span className="flex min-w-0 items-center gap-2">
                <PlayerFace name={p.name} size="xs" />
                <span className="truncate">
                  <span className="font-semibold text-slate-500">{roleShort(p.role)}</span> {p.name}
                  <span className="ml-2 text-xs text-slate-400">OVR {p.overall}</span>
                </span>
              </span>
              <select
                className="rounded border border-slate-300 px-2 py-1 text-xs"
                value={save.training.individual?.[p.id] ?? 'none'}
                onChange={(e) =>
                  setIndividualFocus(p.id, e.target.value as IndividualFocus)
                }
              >
                <option value="none">— ไม่ระบุ —</option>
                {indOpts.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.label}
                  </option>
                ))}
              </select>
            </li>
          ))}
        </ul>
      </section>
    </div>
  )
}
