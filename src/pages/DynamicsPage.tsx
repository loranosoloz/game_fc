import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import {
  ensureDynamics,
  HIERARCHY_TIER_LABEL,
  recomputeDynamics,
} from '@/game/dynamics'
import { PageHeader, Panel, ProgressBar, StatTile } from '@/components/ui'
import { PlayerFace } from '@/components/PlayerFace'
import { cn } from '@/lib/cn'
import { saveToStorage } from '@/game/save'

type Tab = 'overview' | 'hierarchy' | 'groups' | 'issues'

function Tabs({
  tab,
  setTab,
}: {
  tab: Tab
  setTab: (t: Tab) => void
}) {
  const items: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'ภาพรวม' },
    { id: 'hierarchy', label: 'ลำดับชั้น' },
    { id: 'groups', label: 'กลุ่มสังคม' },
    { id: 'issues', label: 'ความขัดแย้ง' },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold',
            tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function DynamicsPage() {
  const save = useGameStore((s) => s.save)!
  const setSave = useGameStore.setState
  const [tab, setTab] = useState<Tab>('overview')

  const dynamics = useMemo(() => {
    const d = ensureDynamics(save.dynamics)
    if ((d.hierarchy?.length ?? 0) === 0) return recomputeDynamics(save)
    return d
  }, [save])

  const nameOf = (id: string) => save.players.find((p) => p.id === id)?.name ?? id
  const playerOf = (id: string) => save.players.find((p) => p.id === id)

  const refresh = () => {
    const next = { ...save, dynamics: recomputeDynamics(save) }
    saveToStorage(next)
    setSave({ save: next, status: 'อัปเดตไดนามิกส์ห้องแต่งตัวแล้ว' })
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ห้องแต่งตัว · Dynamics"
        subtitle={dynamics.lastNote}
        actions={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={refresh}
              className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50"
            >
              คำนวณใหม่
            </button>
            <Link to="/meetings" className="text-xs font-semibold text-sky-800 underline underline-offset-2">
              ไปประชุม →
            </Link>
          </div>
        }
      />

      <Tabs tab={tab} setTab={setTab} />

      {tab === 'overview' ? (
        <>
          <div className="grid gap-3 sm:grid-cols-4">
            <StatTile label="สามัคคี" value={`${dynamics.cohesion}`} hint="/100" accent />
            <StatTile label="ลำดับชั้น" value={`${dynamics.hierarchyStability}`} hint="/100" />
            <StatTile label="บรรยากาศ" value={`${dynamics.dressingRoomMood}`} hint="/100" />
            <StatTile
              label="เชื่อมั่นผู้จัดการ"
              value={`${dynamics.managerTrust ?? 55}`}
              hint="/100"
            />
          </div>
          <Panel>
            <p className="text-sm text-slate-700">
              โบนัสแมตช์จากไดนามิกส์ใช้สามัคคี · บรรยากาศ · ลำดับชั้น · ความเชื่อมั่น
              {dynamics.rivalries && dynamics.rivalries.length > 0
                ? ` · มีความขัดแย้ง ${dynamics.rivalries.length} คู่ (ลดโบนัสเล็กน้อย)`
                : ''}
            </p>
            <div className="mt-3 space-y-2">
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">สามัคคี</p>
                <ProgressBar value={dynamics.cohesion} max={100} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">ลำดับชั้น</p>
                <ProgressBar value={dynamics.hierarchyStability} max={100} />
              </div>
              <div>
                <p className="text-[10px] font-semibold text-slate-500 uppercase">เชื่อมั่น</p>
                <ProgressBar value={dynamics.managerTrust ?? 55} max={100} />
              </div>
            </div>
          </Panel>
        </>
      ) : null}

      {tab === 'hierarchy' ? (
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ลำดับชั้นในห้องแต่งตัว</h3>
          <ul className="mt-3 divide-y divide-slate-100">
            {(dynamics.hierarchy ?? []).slice(0, 20).map((h) => {
              const p = playerOf(h.playerId)
              return (
                <li key={h.playerId} className="flex items-center gap-2 py-2">
                  <PlayerFace name={nameOf(h.playerId)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{nameOf(h.playerId)}</p>
                    <p className="text-[10px] text-slate-500">
                      {HIERARCHY_TIER_LABEL[h.tier]}
                      {p ? ` · OVR ${p.overall}` : ''}
                    </p>
                  </div>
                  <span className="text-xs font-bold text-slate-700">อิทธิพล {h.influence}</span>
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      {tab === 'groups' ? (
        <div className="grid gap-3 md:grid-cols-2">
          {(dynamics.groups ?? []).map((g) => (
            <Panel key={g.id}>
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-bold text-slate-900">{g.labelTh}</h3>
                <span className="text-xs font-semibold text-slate-600">มู้ด {g.mood}</span>
              </div>
              <ProgressBar value={g.mood} max={100} className="mt-2" />
              <ul className="mt-2 space-y-1">
                {g.memberIds.map((id) => (
                  <li key={id} className="flex items-center gap-2 text-xs text-slate-700">
                    <PlayerFace name={nameOf(id)} size="xs" />
                    {nameOf(id)}
                  </li>
                ))}
              </ul>
            </Panel>
          ))}
          {(dynamics.groups?.length ?? 0) === 0 ? (
            <Panel>
              <p className="text-sm text-slate-500">ยังไม่มีกลุ่ม — กดคำนวณใหม่</p>
            </Panel>
          ) : null}
        </div>
      ) : null}

      {tab === 'issues' ? (
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ความขัดแย้งในทีม</h3>
          {(dynamics.rivalries?.length ?? 0) === 0 ? (
            <p className="mt-2 text-sm text-slate-500">ไม่มีคู่ขัดแย้งรุนแรงตอนนี้</p>
          ) : (
            <ul className="mt-3 space-y-2">
              {dynamics.rivalries!.map((r, i) => (
                <li
                  key={`${r.aId}-${r.bId}-${i}`}
                  className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm"
                >
                  <p className="font-semibold text-rose-950">
                    {nameOf(r.aId)} ↔ {nameOf(r.bId)} · ระดับ {r.intensity}
                  </p>
                  <p className="text-xs text-rose-900/80">{r.reasonTh}</p>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 text-xs text-slate-500">
            เคลียร์ได้ด้วยจัด XI ให้ดาวสำคัญ · คุยที่หน้าประชุม · ลด want-away
          </p>
        </Panel>
      ) : null}
    </div>
  )
}
