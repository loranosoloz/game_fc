import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { effectiveStaffLevel, listFreeAgents, staffUpgradeCost } from '@/game/staff'
import { getActivity } from '@/game/dailyLife'
import { formatMoney } from '@/lib/format'
import type { StaffRole } from '@/game/types'
import { cn } from '@/lib/cn'
import {
  GhostButton,
  PageHeader,
  Panel,
  PrimaryButton,
  ProgressBar,
  StatTile,
} from '@/components/ui'

const ROLE_TH: Record<StaffRole, { title: string; desc: string }> = {
  coach: { title: 'โค้ชหลัก', desc: 'มีได้คนเดียว · คุณภาพซ้อม · ความคม' },
  scout: { title: 'สเกาต์', desc: 'ความรู้ตลาด · PA' },
  physio: { title: 'แพทย์', desc: 'ฟื้นจากบาดเจ็บ' },
}

export function StaffPage() {
  const save = useGameStore((s) => s.save)!
  const upgradeStaffRole = useGameStore((s) => s.upgradeStaffRole)
  const hireStaffMember = useGameStore((s) => s.hireStaffMember)
  const promoteToCoach = useGameStore((s) => s.promoteToCoach)
  const retirePlayerToStaff = useGameStore((s) => s.retirePlayerToStaff)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const [marketRole, setMarketRole] = useState<StaffRole | 'ALL'>('ALL')
  const [hireAs, setHireAs] = useState<StaffRole>('coach')

  const pool = save.staff.pool ?? []
  const free = useMemo(
    () => listFreeAgents(save.staff, marketRole === 'ALL' ? undefined : marketRole),
    [save.staff, marketRole],
  )
  const employed = pool.filter((p) => p.clubId).length
  const myStaff = pool.filter((p) => p.clubId === save.humanClubId)
  const retirees = save.players
    .filter((p) => p.clubId === save.humanClubId && p.age >= 32)
    .sort((a, b) => b.age - a.age)
    .slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader
        title="สตาฟมีชีวิต"
        subtitle="โค้ชหลักได้เพียง 1 คนต่อสโมสร · JSON เก็บแค่ชื่อ — สถานะสุ่มตอนสร้างโลก · มีไดอารี่ · เลื่อนเป็นโค้ชหลักได้"
        actions={
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">
            งบ {formatMoney(club.balance)}
          </span>
        }
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="ในพูล" value={pool.length} accent />
        <StatTile label="มีสัญญา" value={employed} />
        <StatTile label="ว่างงาน" value={pool.length - employed} />
        <StatTile label="ทีมคุณ" value={myStaff.length} />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {save.staff.members.map((m) => {
          const meta = ROLE_TH[m.role]
          const cost = staffUpgradeCost(m.level)
          const person = pool.find((p) => p.id === m.staffId)
          const lastAct = person?.lastActivityId ? getActivity(person.lastActivityId) : null
          return (
            <Panel key={m.role} className="flex flex-col">
              <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                สล็อต · {m.role}
              </p>
              <h3 className="mt-1 text-lg font-bold text-slate-900">{meta.title}</h3>
              <p className="mt-3 text-base font-semibold text-slate-900">{m.name}</p>
              {person ? (
                <div className="mt-2 space-y-1 text-xs text-slate-600">
                  <p>
                    อายุ {person.age} · {person.personalityId} · พลังงาน {Math.round(person.energy)}%
                    · ขวัญ {person.morale}/20
                  </p>
                  <p>
                    โค้ช {person.coachSkill} · สเกาต์ {person.scoutSkill} · แพทย์{' '}
                    {person.physioSkill} · วินัย {person.professionalism}
                  </p>
                  {lastAct ? (
                    <p className="rounded bg-slate-50 px-2 py-1 text-slate-700">
                      วันนี้: {lastAct.labelTh}
                    </p>
                  ) : null}
                  {person.origin === 'ex_player' ? (
                    <p className="text-amber-700">อดีตนักเตะ</p>
                  ) : null}
                </div>
              ) : null}
              <ProgressBar value={m.level} max={20} className="mt-3" />
              <p className="mt-1 text-xs text-slate-500">
                ระดับงาน {m.level}/20
                {person ? ` · ${formatMoney(person.wageWeekly)}/สัปดาห์` : ''}
              </p>
              <PrimaryButton
                className="mt-4 w-full"
                disabled={m.level >= 20 || club.balance < cost}
                onClick={() => upgradeStaffRole(m.role)}
              >
                อัปสกิลตำแหน่ง · {formatMoney(cost)}
              </PrimaryButton>
              {person && person.role !== 'coach' ? (
                <GhostButton className="mt-2 w-full" onClick={() => promoteToCoach(person.id)}>
                  เลื่อนเป็นโค้ชหลัก (สกิลโค้ช ≥ 8 · ปล่อยคนเดิม)
                </GhostButton>
              ) : null}
            </Panel>
          )
        })}
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-bold text-slate-900">ตลาดว่าง · จ้างเข้าตำแหน่ง</h3>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
            value={hireAs}
            onChange={(e) => setHireAs(e.target.value as StaffRole)}
          >
            <option value="coach">จ้างเป็นโค้ชหลัก</option>
            <option value="scout">จ้างเป็นสเกาต์</option>
            <option value="physio">จ้างเป็นแพทย์</option>
          </select>
          {(['ALL', 'coach', 'scout', 'physio'] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setMarketRole(r)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-semibold',
                marketRole === r
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white',
              )}
            >
              {r === 'ALL' ? 'ทั้งหมด' : ROLE_TH[r].title}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          โค้ชหลักมีได้คนเดียว — จ้างคนใหม่จะปล่อยคนเดิม · จ้างสเกาต์มาเป็นโค้ชหลักได้ถ้า coachSkill พอ
        </p>
        <ul className="mt-3 max-h-80 space-y-1.5 overflow-y-auto text-sm">
          {free.slice(0, 40).map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
            >
              <div>
                <p className="font-semibold text-slate-900">
                  {p.name}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    · งานล่าสุด {ROLE_TH[p.role].title} · อายุ {p.age}
                  </span>
                </p>
                <p className="text-xs text-slate-500">
                  โค้ช {p.coachSkill} · สเกาต์ {p.scoutSkill} · แพทย์ {p.physioSkill} · วินัย{' '}
                  {p.professionalism} · พลังงาน {Math.round(p.energy)}% · เหมาะ{hireAs}{' '}
                  Lv.{effectiveStaffLevel(p, hireAs)}
                </p>
                <p className="text-xs text-slate-500">
                  {formatMoney(p.hireFee)} · {formatMoney(p.wageWeekly)}/สัปดาห์
                  {p.origin === 'ex_player' ? ' · อดีตนักเตะ' : ''}
                </p>
              </div>
              <GhostButton onClick={() => hireStaffMember(p.id, hireAs)}>
                ว่าจ้างเป็น{ROLE_TH[hireAs].title}
              </GhostButton>
            </li>
          ))}
          {free.length === 0 ? (
            <li className="text-slate-500">ไม่มีสตาฟว่าง</li>
          ) : null}
        </ul>
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">แขวนสตั๊ด → สตาฟมีชีวิต</h3>
        <p className="mt-1 text-sm text-slate-600">
          นักเตะอายุ ≥ 32 กลายเป็นคนในพูล (มีสกิล/บุคลิก) แล้วเลื่อนเป็นโค้ชหลักทีหลังได้
        </p>
        <ul className="mt-3 space-y-1.5 text-sm">
          {retirees.length === 0 ? (
            <li className="text-slate-500">ยังไม่มีผู้เล่นอายุถึงเกณฑ์</li>
          ) : (
            retirees.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2"
              >
                <span>
                  {p.name} · {p.age}ย · OVR {p.overall}
                </span>
                <div className="flex gap-1">
                  {(['coach', 'scout', 'physio'] as StaffRole[]).map((r) => (
                    <GhostButton
                      key={r}
                      className="!px-2 !py-1 text-xs"
                      onClick={() => retirePlayerToStaff(p.id, r)}
                    >
                      → {ROLE_TH[r].title}
                    </GhostButton>
                  ))}
                </div>
              </li>
            ))
          )}
        </ul>
      </Panel>
    </div>
  )
}
