import { useMemo } from 'react'
import { useGameStore } from '@/store/gameStore'
import type {
  FormationId,
  Mentality,
  PlayStyle,
  Pressing,
  SetPiecePlan,
  Tempo,
  Width,
} from '@/game/types'
import { FORMATION_SLOTS } from '@/game/types'
import { roleLabel, roleShort } from '@/game/positions'
import { isUnavailable } from '@/game/discipline'
import { cn } from '@/lib/cn'

const FORMATIONS: FormationId[] = ['4-3-3', '4-4-2', '4-2-3-1']

const MENTALITY: Mentality[] = ['defensive', 'balanced', 'attacking']
const PRESSING: Pressing[] = ['low', 'medium', 'high']
const TEMPO: Tempo[] = ['slow', 'normal', 'fast']
const WIDTH: Width[] = ['narrow', 'normal', 'wide']
const STYLE: PlayStyle[] = ['possession', 'balanced', 'counter']
const SET_PIECES: SetPiecePlan[] = ['mixed', 'near_post', 'far_post', 'short', 'direct']

function ChipGroup<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: T[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-slate-500">{label}</p>
      <div className="flex flex-wrap gap-1">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => onChange(opt)}
            className={cn(
              'rounded border px-2 py-1 text-xs font-medium capitalize',
              value === opt
                ? 'border-slate-900 bg-slate-900 text-lime-300'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}

export function TacticsPage() {
  const save = useGameStore((s) => s.save)!
  const setFormation = useGameStore((s) => s.setFormation)
  const setInstructions = useGameStore((s) => s.setInstructions)
  const setSetPieces = useGameStore((s) => s.setSetPieces)
  const setOpposition = useGameStore((s) => s.setOpposition)
  const setStartingXi = useGameStore((s) => s.setStartingXi)
  const autoPickHumanXi = useGameStore((s) => s.autoPickHumanXi)

  const tactics = save.tacticsByClub[save.humanClubId]
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const oppId = nextFx
    ? nextFx.homeClubId === save.humanClubId
      ? nextFx.awayClubId
      : nextFx.homeClubId
    : null
  const oppThreats = useMemo(() => {
    if (!oppId) return []
    return save.players
      .filter((p) => p.clubId === oppId && p.injuryDays <= 0)
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 8)
  }, [save.players, oppId])

  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save.players, save.humanClubId],
  )

  const slots = FORMATION_SLOTS[tactics.formation]

  const togglePlayer = (playerId: string) => {
    const set = new Set(tactics.startingXi)
    if (set.has(playerId)) {
      set.delete(playerId)
    } else if (set.size < slots.length) {
      set.add(playerId)
    }
    setStartingXi([...set])
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr]">
      <section className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">แผนการเล่น</h2>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">In Possession (IP)</p>
          <div className="flex flex-wrap gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={`ip-${f}`}
                type="button"
                onClick={() => setFormation(f, 'ip')}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium',
                  tactics.formation === f
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-1 text-xs font-medium text-slate-500">Out of Possession (OOP)</p>
          <div className="flex flex-wrap gap-2">
            {FORMATIONS.map((f) => (
              <button
                key={`oop-${f}`}
                type="button"
                onClick={() => setFormation(f, 'oop')}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium',
                  tactics.formationOop === f
                    ? 'border-slate-900 bg-slate-900 text-lime-300'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-1 flex justify-between text-xs text-slate-500">
            <span>ความคุ้นเคยแผน (Familiarity)</span>
            <span>{tactics.familiarity}/100</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${tactics.familiarity}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">เปลี่ยนแผนจะลดค่า · แข่งแล้วค่อยๆ ขึ้น</p>
        </div>

        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-sm font-semibold">Team Instructions</p>
          <ChipGroup
            label="Mentality"
            options={MENTALITY}
            value={tactics.instructions.mentality}
            onChange={(mentality) => setInstructions({ mentality })}
          />
          <ChipGroup
            label="Pressing"
            options={PRESSING}
            value={tactics.instructions.pressing}
            onChange={(pressing) => setInstructions({ pressing })}
          />
          <ChipGroup
            label="Tempo"
            options={TEMPO}
            value={tactics.instructions.tempo}
            onChange={(tempo) => setInstructions({ tempo })}
          />
          <ChipGroup
            label="Width"
            options={WIDTH}
            value={tactics.instructions.width}
            onChange={(width) => setInstructions({ width })}
          />
          <ChipGroup
            label="Style"
            options={STYLE}
            value={tactics.instructions.style}
            onChange={(style) => setInstructions({ style })}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-sm font-semibold">Set pieces</p>
          <ChipGroup
            label="Corners"
            options={SET_PIECES}
            value={tactics.setPieces?.corners ?? 'mixed'}
            onChange={(corners) => setSetPieces(corners)}
          />
          <ChipGroup
            label="Free kicks"
            options={SET_PIECES}
            value={tactics.setPieces?.freeKicks ?? 'direct'}
            onChange={(freeKicks) => setSetPieces(undefined, freeKicks)}
          />
        </div>

        <div className="space-y-3 rounded-lg border border-slate-100 bg-slate-50/80 p-3">
          <p className="text-sm font-semibold">Opposition instructions</p>
          <p className="text-xs text-slate-500">
            กด/มาร์กดาวคู่แข่งนัดหน้า · OOP มีผลตอนรับในเอนจิน
          </p>
          <label className="grid gap-1 text-xs">
            <span>กดสูงใส่</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={tactics.opposition?.pressPlayerId ?? ''}
              onChange={(e) => setOpposition({ pressPlayerId: e.target.value || null })}
            >
              <option value="">— ไม่ระบุ —</option>
              {oppThreats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.overall})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span>มาร์กตัวแน่น</span>
            <select
              className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
              value={tactics.opposition?.markPlayerId ?? ''}
              onChange={(e) => setOpposition({ markPlayerId: e.target.value || null })}
            >
              <option value="">— ไม่ระบุ —</option>
              {oppThreats.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.overall})
                </option>
              ))}
            </select>
          </label>
          <ChipGroup
            label="Show onto"
            options={['none', 'weaker_foot', 'tight']}
            value={tactics.opposition?.showOnto ?? 'none'}
            onChange={(showOnto) => setOpposition({ showOnto })}
          />
        </div>

        <button
          type="button"
          onClick={autoPickHumanXi}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          เลือก XI อัตโนมัติ
        </button>
        <p className="text-xs text-slate-500">
          เลือกแล้ว {tactics.startingXi.length}/{slots.length} · ทีม AI เลือก XI เองก่อนทุกแมตช์เดย์
        </p>
        <ol className="space-y-1 text-sm">
          {tactics.startingXi.map((id, i) => {
            const p = save.players.find((x) => x.id === id)
            return (
              <li key={id} className="flex justify-between rounded bg-slate-50 px-2 py-1">
                <span>
                  <span className="font-semibold text-slate-800">{roleShort(slots[i])}</span> ·{' '}
                  {p?.name}
                </span>
                <span className="text-slate-500">{p?.overall}</span>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">เลือกตัวจริง</h2>
        <ul className="mt-3 grid gap-1 sm:grid-cols-2">
          {squad.map((p) => {
            const selected = tactics.startingXi.includes(p.id)
            const unavailable = isUnavailable(p)
            return (
              <li key={p.id}>
                <button
                  type="button"
                  disabled={unavailable && !selected}
                  onClick={() => togglePlayer(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm',
                    selected
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-200 bg-white hover:bg-slate-50',
                    unavailable && 'opacity-50',
                  )}
                >
                  <span>
                    <span className="font-semibold" title={roleLabel(p.role)}>
                      {roleShort(p.role)}
                    </span>{' '}
                    {p.name}
                    {p.injuryDays > 0 ? (
                      <span className="ml-1 text-xs text-rose-600">เจ็บ {p.injuryDays}ว</span>
                    ) : (p.illnessDays ?? 0) > 0 ? (
                      <span className="ml-1 text-xs text-violet-700">ป่วย {p.illnessDays}ว</span>
                    ) : null}
                  </span>
                  <span className="text-slate-500">{p.overall}</span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
