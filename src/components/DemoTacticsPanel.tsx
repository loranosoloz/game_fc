import { useEffect, useMemo, useState } from 'react'
import type { FormationId, Mentality, Player, Pressing } from '@/game/types'
import { ALL_FORMATIONS, FORMATION_LABEL_TH, FORMATION_SLOTS, formationLabel } from '@/game/types'
import {
  ensureSlotRoles,
  tacticalRoleShort,
  type TacticalRoleId,
} from '@/game/tacticalRoles'
import { pickSlotRoleForPlayer } from '@/game/playerTacticalRoles'
import { FormationLineupBoard } from '@/components/FormationLineupBoard'
import { cn } from '@/lib/cn'

export type DemoTacticsState = {
  formation: FormationId
  formationOop: FormationId
  mentality: Mentality
  pressing: Pressing
  startingXi: string[]
  slotRoles: TacticalRoleId[]
}

export function demoTacticsSummary(t: DemoTacticsState): string {
  const m =
    t.mentality === 'defensive' ? 'รับ' : t.mentality === 'attacking' ? 'บุก' : 'สมดุล'
  const p = t.pressing === 'low' ? 'เพรสต่ำ' : t.pressing === 'high' ? 'เพรสสูง' : 'เพรสกลาง'
  const stSlot = FORMATION_SLOTS[t.formation].findIndex((r) => r === 'ST')
  const stRole =
    stSlot >= 0 && t.slotRoles[stSlot] ? tacticalRoleShort(t.slotRoles[stSlot]!) : null
  return `${formationLabel(t.formation, true)} · ${m} · ${p}${stRole ? ` · ST:${stRole}` : ''}`
}

export function buildDemoTacticsState(
  formation: FormationId,
  xi: string[],
  patch?: Partial<DemoTacticsState>,
  players?: Player[],
): DemoTacticsState {
  const slots = FORMATION_SLOTS[formation]
  const startingXi = Array.from({ length: slots.length }, (_, i) => xi[i] ?? '')
  const fromPlayers = players
    ? slots.map((slot, i) => {
        const p = players.find((x) => x.id === startingXi[i])
        return p ? pickSlotRoleForPlayer(p, slot) : ensureSlotRoles([slot])[0]!
      })
    : ensureSlotRoles(slots)
  return {
    formation,
    formationOop: formation,
    mentality: 'balanced',
    pressing: 'medium',
    startingXi,
    slotRoles: fromPlayers,
    ...patch,
    startingXi: patch?.startingXi
      ? Array.from({ length: slots.length }, (_, i) => patch.startingXi![i] ?? xi[i] ?? '')
      : startingXi,
    slotRoles: ensureSlotRoles(slots, patch?.slotRoles ?? fromPlayers),
  }
}

export function DemoTacticsPanel({
  initial,
  teamLabel,
  minute,
  players,
  benchIds = [],
  kitColor,
  stoppageMode,
  forcedOutId,
  stoppageText,
  onApply,
  onClose,
}: {
  initial: DemoTacticsState
  teamLabel: string
  minute: number
  players: Player[]
  benchIds?: string[]
  kitColor?: string
  /** เปิดจากหยุดเกม — บังคับจัดตัว/เปลี่ยนตัว */
  stoppageMode?: 'injury' | 'red_card' | null
  forcedOutId?: string | null
  stoppageText?: string
  onApply: (t: DemoTacticsState) => void
  onClose: () => void
}) {
  const [formation, setFormation] = useState(initial.formation)
  const [formationOop, setFormationOop] = useState(initial.formationOop)
  const [mentality, setMentality] = useState(initial.mentality)
  const [pressing, setPressing] = useState(initial.pressing)
  const [startingXi, setStartingXi] = useState(initial.startingXi)
  const [slotRoles, setSlotRoles] = useState(initial.slotRoles)
  const [tab, setTab] = useState<'lineup' | 'team'>('lineup')

  useEffect(() => {
    setFormation(initial.formation)
    setFormationOop(initial.formationOop)
    setMentality(initial.mentality)
    setPressing(initial.pressing)
    setStartingXi(initial.startingXi)
    setSlotRoles(initial.slotRoles)
    setTab('lineup')
  }, [initial])

  const applyFormation = (f: FormationId) => {
    if (stoppageMode === 'injury') return
    const slots = FORMATION_SLOTS[f]
    setFormation(f)
    setStartingXi((prev) => Array.from({ length: slots.length }, (_, i) => prev[i] ?? ''))
    setSlotRoles((prev) => ensureSlotRoles(slots, prev))
  }

  const draft = useMemo(
    () => ({
      formation,
      formationOop,
      mentality,
      pressing,
      startingXi,
      slotRoles: ensureSlotRoles(FORMATION_SLOTS[formation], slotRoles),
    }),
    [formation, formationOop, mentality, pressing, startingXi, slotRoles],
  )

  const forcedName = forcedOutId
    ? players.find((p) => p.id === forcedOutId)?.name
    : null
  const needForcedSub =
    stoppageMode === 'injury' && forcedOutId && startingXi.includes(forcedOutId)

  const title =
    stoppageMode === 'injury'
      ? `เปลี่ยนตัวบังคับ · ${teamLabel}`
      : stoppageMode === 'red_card'
        ? `แก้เกม 10 คน · ${teamLabel}`
        : `ปรับแผน · ${teamLabel}`

  return (
    <div className="space-y-4">
      <div>
        <p className="text-[10px] font-bold tracking-wider text-orange-600 uppercase">
          {stoppageMode === 'injury'
            ? 'หยุดเกม · บาดเจ็บ'
            : stoppageMode === 'red_card'
              ? 'หยุดเกม · ใบแดง'
              : 'แผนการเล่น'}
        </p>
        <h2 className="text-lg font-bold text-slate-900">{title}</h2>
        <p className="mt-1 text-xs text-slate-600">
          {stoppageText ??
            (stoppageMode === 'injury'
              ? `${forcedName ?? 'ผู้เล่น'} บาดเจ็บ — เลือกตัวจากม้านั่งแทนบนสนาม`
              : `จัดตัวบนสนาม · เลือกบทบาท · นาที ${minute}'`)}
        </p>
        {needForcedSub ? (
          <p className="mt-2 rounded-md bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-900">
            ยังไม่ได้เปลี่ยนตัว — กดจุดแดงบนสนาม แล้วเลือกคนจากม้านั่ง
          </p>
        ) : null}
      </div>

      {!stoppageMode || stoppageMode === 'red_card' ? (
      <div className="flex gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
        <button
          type="button"
          onClick={() => setTab('lineup')}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-bold',
            tab === 'lineup' ? 'bg-slate-900 text-lime-300' : 'text-slate-600',
          )}
        >
          จัดตัว + บทบาท
        </button>
        <button
          type="button"
          onClick={() => setTab('team')}
          className={cn(
            'flex-1 rounded-md px-2 py-1.5 text-xs font-bold',
            tab === 'team' ? 'bg-slate-900 text-lime-300' : 'text-slate-600',
          )}
        >
          แผนทีม
        </button>
      </div>
      ) : null}

      {tab === 'lineup' || stoppageMode === 'injury' ? (
        <>
          {!stoppageMode ? (
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">ฟอร์เมชัน</p>
            <div className="flex flex-wrap gap-1">
              {ALL_FORMATIONS.map((f) => (
                <button
                  key={f}
                  type="button"
                  title={FORMATION_LABEL_TH[f]}
                  onClick={() => applyFormation(f)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs font-medium',
                    formation === f
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300 bg-white hover:bg-slate-50',
                  )}
                >
                  {formationLabel(f, true)}
                </button>
              ))}
            </div>
          </div>
          ) : null}

          <FormationLineupBoard
            formation={formation}
            startingXi={startingXi}
            slotRoles={slotRoles}
            players={players}
            benchIds={benchIds}
            kitColor={kitColor}
            forcedOutId={stoppageMode === 'injury' ? forcedOutId : null}
            onChangeXi={setStartingXi}
            onChangeSlotRole={(i, roleId) => {
              setSlotRoles((prev) => {
                const next = ensureSlotRoles(FORMATION_SLOTS[formation], prev)
                next[i] = roleId
                return next
              })
            }}
          />
        </>
      ) : (
        <>
          <div>
            <p className="mb-1 text-xs font-medium text-slate-500">แผน OOP (ไม่ครองบอล)</p>
            <div className="flex flex-wrap gap-1">
              {ALL_FORMATIONS.map((f) => (
                <button
                  key={`oop-${f}`}
                  type="button"
                  title={FORMATION_LABEL_TH[f]}
                  onClick={() => setFormationOop(f)}
                  className={cn(
                    'rounded border px-2 py-1 text-xs font-medium',
                    formationOop === f
                      ? 'border-slate-900 bg-slate-900 text-lime-300'
                      : 'border-slate-300 bg-white hover:bg-slate-50',
                  )}
                >
                  {formationLabel(f, true)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Mentality</p>
              <div className="flex gap-1">
                {(['defensive', 'balanced', 'attacking'] as Mentality[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMentality(m)}
                    className={cn(
                      'rounded border px-2.5 py-1 text-xs font-semibold',
                      mentality === m
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : 'border-slate-300 bg-white',
                    )}
                  >
                    {m === 'defensive' ? 'รับ' : m === 'attacking' ? 'บุก' : 'สมดุล'}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-500">Pressing</p>
              <div className="flex gap-1">
                {(['low', 'medium', 'high'] as Pressing[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPressing(p)}
                    className={cn(
                      'rounded border px-2.5 py-1 text-xs font-semibold',
                      pressing === p
                        ? 'border-slate-900 bg-slate-900 text-lime-300'
                        : 'border-slate-300 bg-white',
                    )}
                  >
                    {p === 'low' ? 'ต่ำ' : p === 'high' ? 'สูง' : 'กลาง'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      <div className="flex flex-wrap gap-2 border-t border-slate-100 pt-3">
        <button
          type="button"
          disabled={Boolean(needForcedSub)}
          className="flex-1 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-bold text-lime-300 hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-40"
          onClick={() => {
            if (needForcedSub) return
            onApply(draft)
            onClose()
          }}
        >
          {stoppageMode === 'injury'
            ? 'ยืนยันเปลี่ยนตัว · เล่นต่อ'
            : stoppageMode === 'red_card'
              ? 'ยืนยันแผน · เล่นต่อ'
              : 'ใช้แผนนี้'}
        </button>
        {!stoppageMode ? (
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            onClick={onClose}
          >
            ยกเลิก
          </button>
        ) : null}
      </div>
    </div>
  )
}
