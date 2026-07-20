import { useEffect, useMemo, useState } from 'react'
import type { FormationId, Player, RoleCode } from '@/game/types'
import { FORMATION_SLOTS, formationLabel } from '@/game/types'
import { FORMATION_ANCHORS } from '@/game/match/formationAnchors'
import { roleShort } from '@/game/positions'
import {
  dutyLabelTh,
  ensureSlotRoles,
  rolesForSlot,
  tacticalRoleShort,
  type TacticalRoleId,
} from '@/game/tacticalRoles'
import { ensurePlayerTacticalRoles } from '@/game/playerTacticalRoles'
import type { PlayerTacticalStyle } from '@/game/playerTacticalRoles'
import { cn } from '@/lib/cn'

export type LineupState = {
  formation: FormationId
  startingXi: string[]
  slotRoles: TacticalRoleId[]
}

export function FormationLineupBoard({
  formation,
  startingXi,
  slotRoles,
  players,
  benchIds = [],
  kitColor = '#ffffff',
  forcedOutId,
  onChangeXi,
  onChangeSlotRole,
  className,
}: {
  formation: FormationId
  startingXi: string[]
  slotRoles: TacticalRoleId[]
  players: Player[]
  benchIds?: string[]
  kitColor?: string
  /** บาดเจ็บ — ล็อคช่องนี้ต้องเปลี่ยนตัวจากม้านั่ง */
  forcedOutId?: string | null
  onChangeXi: (xi: string[]) => void
  onChangeSlotRole: (slotIndex: number, roleId: TacticalRoleId) => void
  className?: string
}) {
  const forcedSlot = forcedOutId
    ? startingXi.findIndex((id) => id === forcedOutId)
    : -1
  const [selectedSlot, setSelectedSlot] = useState<number | null>(
    forcedSlot >= 0 ? forcedSlot : 0,
  )
  const slots = FORMATION_SLOTS[formation]
  const anchors = FORMATION_ANCHORS[formation]
  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players])
  const roles = ensureSlotRoles(slots, slotRoles)

  useEffect(() => {
    if (forcedSlot >= 0) setSelectedSlot(forcedSlot)
  }, [forcedSlot])

  const selectedRoleCode: RoleCode | null =
    selectedSlot != null ? (slots[selectedSlot] ?? null) : null
  const selectedPlayer =
    selectedSlot != null && startingXi[selectedSlot]
      ? byId.get(startingXi[selectedSlot]!)
      : null
  const roleOptions = selectedRoleCode ? rolesForSlot(selectedRoleCode) : []
  const preferredStyles = (
    selectedPlayer
      ? ((ensurePlayerTacticalRoles(selectedPlayer).preferredTacticalRoles ??
          []) as PlayerTacticalStyle[])
      : []
  )
  const preferredSet = new Set(preferredStyles.map((s) => s.id))
  const preferredLevel = (id: string) => preferredStyles.find((s) => s.id === id)?.level

  const used = new Set(startingXi.filter(Boolean))
  const pool = (
    forcedOutId
      ? benchIds.filter((id) => !used.has(id) || id === forcedOutId)
      : [
          ...benchIds.filter((id) => !used.has(id)),
          ...players
            .map((p) => p.id)
            .filter((id) => !used.has(id) && !benchIds.includes(id)),
        ]
  ).filter((id) => id !== forcedOutId)

  const swapIntoSlot = (slotIndex: number, playerId: string) => {
    if (forcedOutId && forcedSlot >= 0 && slotIndex !== forcedSlot) return
    const next = Array.from({ length: slots.length }, (_, i) => startingXi[i] || '')
    const prevAtSlot = next[slotIndex]
    const fromIdx = next.indexOf(playerId)
    if (fromIdx >= 0) {
      next[fromIdx] = prevAtSlot || ''
    }
    next[slotIndex] = playerId
    onChangeXi(next)
    setSelectedSlot(slotIndex)
  }

  const injuredStillOnPitch = Boolean(
    forcedOutId && startingXi.includes(forcedOutId),
  )

  return (
    <div className={cn('space-y-3', className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-slate-700">
          {forcedOutId ? 'เปลี่ยนตัวบังคับ' : 'จัดตัว'} · {formationLabel(formation, true)}
        </p>
        <p className="text-[10px] text-slate-500">
          {forcedOutId
            ? injuredStillOnPitch
              ? 'เลือกตัวจากม้านั่งแทนผู้เจ็บ'
              : 'เปลี่ยนแล้ว — กดยืนยันได้'
            : 'กดจุดบนสนาม → เลือกคน / บทบาท'}
        </p>
      </div>

      <div
        className="relative aspect-[100/64] w-full overflow-hidden rounded-lg border border-emerald-900/40"
        style={{
          background:
            'repeating-linear-gradient(90deg, #1f6b3a 0 12.5%, #1a5c32 12.5% 25%)',
        }}
      >
        <div className="pointer-events-none absolute inset-0 border border-white/40 m-1 rounded-sm" />
        <div className="pointer-events-none absolute left-1/2 top-1 bottom-1 w-px -translate-x-1/2 bg-white/40" />
        {anchors.map((a, i) => {
          const pid = startingXi[i]
          const p = pid ? byId.get(pid) : undefined
          const roleId = roles[i]
          const selected = selectedSlot === i
          const isForced = forcedSlot === i
          // anchors: y จากประตูตัวเอง → UI แสดงแนวตั้งเหมือน demo (ซ้าย=เหย้า)
          const left = a.y
          const top = a.x
          return (
            <button
              key={`slot-${i}`}
              type="button"
              title={`${roleShort(a.role)} · ${p?.name ?? 'ว่าง'} · ${roleId ? tacticalRoleShort(roleId) : ''}`}
              onClick={() => {
                if (forcedOutId && forcedSlot >= 0 && i !== forcedSlot) return
                setSelectedSlot(i)
              }}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center',
                (selected || isForced) && 'z-20',
                forcedOutId && forcedSlot >= 0 && i !== forcedSlot && 'opacity-40',
              )}
              style={{ left: `${left}%`, top: `${top}%` }}
            >
              <span
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full text-[10px] font-bold shadow ring-2',
                  selected || isForced ? 'ring-lime-300 scale-110' : 'ring-black/25',
                  isForced && injuredStillOnPitch && 'ring-rose-400',
                  !p && 'border border-dashed border-white/70 bg-slate-800/50 text-white',
                )}
                style={p ? { backgroundColor: kitColor, color: '#0f172a' } : undefined}
              >
                {p ? p.overall : roleShort(a.role)}
              </span>
              <span className="mt-0.5 max-w-[72px] truncate rounded bg-slate-950/75 px-1 text-[9px] font-semibold text-white">
                {p?.name.split(' ').pop() ?? roleShort(a.role)}
              </span>
              <span
                className={cn(
                  'rounded px-1 text-[8px] font-bold',
                  isForced && injuredStillOnPitch
                    ? 'bg-rose-500 text-white'
                    : 'bg-lime-300/90 text-slate-900',
                )}
              >
                {isForced && injuredStillOnPitch
                  ? 'เจ็บ'
                  : roleId
                    ? tacticalRoleShort(roleId)
                    : roleShort(a.role)}
              </span>
            </button>
          )
        })}
      </div>

      {selectedSlot != null && selectedRoleCode ? (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="text-xs font-bold text-slate-800">
            ช่อง {selectedSlot + 1} · {roleShort(selectedRoleCode)}
            {selectedPlayer ? ` · ${selectedPlayer.name}` : ' · ว่าง'}
          </p>
          {selectedPlayer && preferredStyles.length > 0 ? (
            <p className="mt-0.5 text-[11px] text-slate-600">
              สไตล์ถนัด:{' '}
              {preferredStyles
                .map(
                  (s) =>
                    `${tacticalRoleShort(s.id)} ${'★'.repeat(s.level)}`,
                )
                .join(' · ')}
            </p>
          ) : null}

          <div className="mt-2">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              {forcedOutId ? 'เลือกตัวเข้าแทน (ม้านั่ง)' : 'ใครอยู่ช่องนี้'}
            </p>
            <div className="flex max-h-28 flex-wrap gap-1 overflow-y-auto">
              {selectedPlayer ? (
                <span className="rounded border border-slate-900 bg-slate-900 px-2 py-1 text-[11px] font-semibold text-lime-300">
                  {selectedPlayer.name}
                </span>
              ) : null}
              {pool.slice(0, 16).map((id) => {
                const p = byId.get(id)
                if (!p) return null
                const styles = (
                  (ensurePlayerTacticalRoles(p).preferredTacticalRoles ??
                    []) as PlayerTacticalStyle[]
                )
                  .slice(0, 2)
                  .map((s) => `${tacticalRoleShort(s.id)}${'★'.repeat(s.level)}`)
                  .join(' ')
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => swapIntoSlot(selectedSlot, id)}
                    className="rounded border border-slate-300 bg-white px-2 py-1 text-[11px] hover:bg-lime-50"
                    title={styles ? `สไตล์: ${styles}` : undefined}
                  >
                    {p.name} · {p.overall}
                    {styles ? (
                      <span className="text-slate-400"> · {styles}</span>
                    ) : null}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-3">
            <p className="mb-1 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
              เล่นแบบไหน ({roleOptions.length} แบบ)
            </p>
            <div className="grid gap-1.5 sm:grid-cols-2">
              {roleOptions.map((r) => {
                const active = roles[selectedSlot] === r.id
                const natural = preferredSet.has(r.id)
                const lvl = preferredLevel(r.id)
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => onChangeSlotRole(selectedSlot, r.id)}
                    className={cn(
                      'rounded-lg border px-2.5 py-2 text-left',
                      active
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : natural
                          ? 'border-lime-500 bg-lime-50 hover:border-lime-600'
                          : 'border-slate-200 bg-white hover:border-lime-400',
                    )}
                  >
                    <span className="block text-xs font-bold">
                      {r.labelTh}{' '}
                      <span className={cn('font-medium', active ? 'text-lime-200/80' : 'text-slate-500')}>
                        · {dutyLabelTh(r.duty)}
                        {lvl ? ` · ${'★'.repeat(lvl)}` : ''}
                      </span>
                    </span>
                    <span
                      className={cn(
                        'mt-0.5 block text-[10px] leading-snug',
                        active ? 'text-lime-100/85' : 'text-slate-600',
                      )}
                    >
                      {r.descTh}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
