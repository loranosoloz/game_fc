import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import { roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import {
  ensureSquadRegistration,
  getClubRegistration,
  listIsLocked,
  registrationStatusSummary,
  validateRegList,
  type SquadRegListKind,
} from '@/game/squadRegistration'
import { GhostButton, PageHeader, Panel, PrimaryButton } from '@/components/ui'
import { PlayerFace } from '@/components/PlayerFace'

export function RegistrationPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureSquadRegistration(ensurePhase5(saveRaw))
  const toggleRegPlayer = useGameStore((s) => s.toggleRegPlayer)
  const setRegNumber = useGameStore((s) => s.setRegNumber)
  const submitRegistration = useGameStore((s) => s.submitRegistration)
  const autoFillRegistration = useGameStore((s) => s.autoFillRegistration)

  const clubReg = getClubRegistration(save)!
  const tabs = useMemo(() => {
    const t: { id: SquadRegListKind; label: string }[] = [{ id: 'league', label: 'ลีก' }]
    if (clubReg.ucl) t.push({ id: 'ucl', label: 'UCL' })
    return t
  }, [clubReg.ucl])

  const [tab, setTab] = useState<SquadRegListKind>('league')
  const list = tab === 'league' ? clubReg.league : clubReg.ucl
  const locked = list ? listIsLocked(list, save.currentDate) : true
  const validation = list ? validateRegList(list) : { ok: false, reason: '—' }

  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId && !p.isYouth)
        .sort((a, b) => b.overall - a.overall),
    [save.players, save.humanClubId],
  )

  if (!list) {
    return (
      <div className="space-y-4">
        <PageHeader title="ลงทะเบียนนักเตะ" subtitle="ไม่มีลิสต์นี้" />
        <Panel>
          <p className="text-sm text-slate-600">ทีมนี้ไม่ได้เล่น UCL ฤดูกาลนี้</p>
          <button
            type="button"
            className="mt-2 text-xs font-semibold text-sky-800 underline"
            onClick={() => setTab('league')}
          >
            กลับไปทะเบียนลีก
          </button>
        </Panel>
      </div>
    )
  }

  const onList = squad.filter((p) => list.numbers[p.id] != null)
  const offList = squad.filter((p) => list.numbers[p.id] == null)
  const daysLeft = Math.ceil(
    (new Date(`${list.deadlineDate}T12:00:00`).getTime() -
      new Date(`${save.currentDate}T12:00:00`).getTime()) /
      86400000,
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="ลงทะเบียนนักเตะ"
        subtitle={`${registrationStatusSummary(save)} · วันนี้ ${save.currentDate}`}
        actions={
          <Link
            to="/calendar"
            className="text-xs font-semibold text-sky-800 underline underline-offset-2"
          >
            ดูหมุดปฏิทิน →
          </Link>
        }
      />

      <Panel>
        <p className="text-sm text-slate-700">
          ทุกทีมต้องส่งโผลีก{clubReg.ucl ? 'และ UCL' : ''} พร้อมเบอร์เสื้อ 1–99 · ไม่มีโควตาสัญชาติ /
          home-grown · สูงสุด {list.maxPlayers} คน · ไม่ส่งตามกำหนด = เดินวัน/เล่นนัดไม่ได้
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-lg px-3 py-1.5 text-xs font-bold',
                tab === t.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
            กำหนดส่ง
          </p>
          <p className="text-sm font-bold text-slate-900">{list.deadlineDate}</p>
          <p className="text-xs text-slate-600">
            {daysLeft < 0
              ? list.submitted
                ? 'ส่งแล้ว'
                : 'เลยกำหนด — ส่งทันที'
              : `เหลือ ~${daysLeft} วัน`}
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">สถานะ</p>
          <p
            className={cn(
              'text-sm font-bold',
              list.submitted ? 'text-emerald-700' : 'text-amber-800',
            )}
          >
            {list.submitted ? 'ส่งแล้ว' : 'ยังไม่ส่ง'}
          </p>
          <p className="text-xs text-slate-600">
            {Object.keys(list.numbers).length}/{list.maxPlayers} คน
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
          <p className="text-[10px] font-semibold tracking-wide text-slate-500 uppercase">ตรวจโผ</p>
          <p className={cn('text-sm font-bold', validation.ok ? 'text-slate-900' : 'text-rose-700')}>
            {validation.reason}
          </p>
          {locked ? (
            <p className="text-xs text-slate-500">ล็อกหลังกำหนด — แก้ไม่ได้</p>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <GhostButton
          type="button"
          disabled={locked}
          onClick={() => autoFillRegistration(tab)}
        >
          จัดโผอัตโนมัติ
        </GhostButton>
        <PrimaryButton
          type="button"
          disabled={locked && list.submitted}
          onClick={() => submitRegistration(tab)}
        >
          ส่งทะเบียน{tab === 'league' ? 'ลีก' : ' UCL'}
        </PrimaryButton>
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">
          ในลิสต์ ({onList.length})
        </h3>
        <ul className="mt-2 divide-y divide-slate-100">
          {onList.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <PlayerFace name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-[10px] text-slate-500">
                  {roleShort(p.role)} · OVR {p.overall}
                </p>
              </div>
              <label className="flex items-center gap-1 text-xs text-slate-600">
                เบอร์
                <input
                  type="number"
                  min={1}
                  max={99}
                  disabled={locked}
                  value={list.numbers[p.id] ?? ''}
                  onChange={(e) => {
                    const n = Number(e.target.value)
                    if (Number.isFinite(n)) setRegNumber(tab, p.id, n)
                  }}
                  className="w-14 rounded border border-slate-200 px-1.5 py-1 text-center text-sm font-bold"
                />
              </label>
              <GhostButton
                type="button"
                disabled={locked}
                onClick={() => toggleRegPlayer(tab, p.id, false)}
              >
                ถอด
              </GhostButton>
            </li>
          ))}
          {onList.length === 0 ? (
            <li className="py-3 text-sm text-slate-500">ยังไม่มีใครในลิสต์ — กดจัดโผอัตโนมัติ</li>
          ) : null}
        </ul>
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">นอกลิสต์ ({offList.length})</h3>
        <ul className="mt-2 max-h-80 divide-y divide-slate-100 overflow-y-auto">
          {offList.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-2 py-2">
              <PlayerFace name={p.name} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-[10px] text-slate-500">
                  {roleShort(p.role)} · OVR {p.overall}
                </p>
              </div>
              <GhostButton
                type="button"
                disabled={locked || Object.keys(list.numbers).length >= list.maxPlayers}
                onClick={() => toggleRegPlayer(tab, p.id, true)}
              >
                เพิ่ม
              </GhostButton>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  )
}
