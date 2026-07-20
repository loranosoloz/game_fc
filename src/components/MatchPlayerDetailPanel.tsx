import type { BodyPartId, Player } from '@/game/types'
import { BodyMapFigure } from '@/components/BodyMapFigure'
import { StatusBar } from '@/components/StatusBar'
import { BODY_PART_LABEL } from '@/game/bodyMap'
import {
  heartRateLabelTh,
  playerForBodyDisplay,
  staminaLabelTh,
  type MatchPlayerFitness,
} from '@/game/matchFitness'
import { roleGroup } from '@/game/positions'
import { cn } from '@/lib/cn'

export function MatchPlayerDetailPanel({
  player,
  fitness,
  injuryPart,
  minute,
  onClose,
  className,
}: {
  player: Player
  fitness: MatchPlayerFitness
  injuryPart?: BodyPartId | null
  minute: number
  onClose?: () => void
  className?: string
}) {
  const displayPlayer = playerForBodyDisplay(player, fitness, injuryPart)

  return (
    <section
      className={cn(
        'rounded-xl bg-white shadow-none',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">
            รายละเอียดนักเตะ · นาที {minute}&apos;
          </p>
          <h3 className="truncate text-sm font-bold text-slate-900">{player.name}</h3>
          <p className="text-xs text-slate-600">
            {roleGroup(player.role)} · OVR {player.overall} · อายุ {player.age} · STA{' '}
            {player.attrs.stamina}
          </p>
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded border border-slate-200 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
          >
            ปิด
          </button>
        ) : null}
      </div>

      <div className="space-y-3 p-3">
        <div>
          <p className="mb-1.5 text-xs font-semibold text-slate-700">สภาพกลางเกม</p>
          <ul className="space-y-1">
            <StatusBar label="พลังรวม" value={fitness.effective} max={100} compact />
            <StatusBar label="Condition" value={fitness.condition} max={100} compact />
            <StatusBar label="Stamina" value={fitness.matchStamina} max={100} compact />
            <StatusBar
              label="ชีพจร"
              value={fitness.heartRate}
              max={100}
              colorClass={
                fitness.heartRate >= 88
                  ? 'bg-rose-500'
                  : fitness.heartRate >= 72
                    ? 'bg-amber-500'
                    : 'bg-sky-400'
              }
              compact
            />
          </ul>
          <p className="mt-1.5 text-[11px] text-slate-600">
            {staminaLabelTh(fitness.effective)} · {heartRateLabelTh(fitness.heartRate)}
          </p>
          {injuryPart ? (
            <p className="mt-1 rounded-md bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900">
              {'บาดเจ็บกลางแมตช์ · '}{BODY_PART_LABEL[injuryPart]}
            </p>
          ) : null}
        </div>

        <div>
          <p className="mb-1 text-xs font-semibold text-slate-700">แผนที่ร่างกาย (สด)</p>
          <p className="mb-2 text-[10px] text-slate-500">
            สีแดง/เหลือง = บอบชำจากวิ่ง · เขียว = ยังแข็งแรง · ชี้ส่วนร่างกายดู %
          </p>
          <BodyMapFigure player={displayPlayer} compact />
        </div>
      </div>
    </section>
  )
}
