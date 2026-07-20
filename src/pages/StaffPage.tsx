import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  effectiveStaffLevel,
  listFreeAgents,
  skillForRole,
  staffRoleLabelTh,
  STAFF_ROLES,
} from '@/game/staff'
import { attrsByGroup, MANAGER_ATTR_META } from '@/game/managerProfile'
import { ensureManagerProgress, xpToNextLevel } from '@/game/managerProgress'
import { getActivity } from '@/game/dailyLife'
import { formatMoney, formatCoachStat } from '@/lib/format'
import { PlayerFace } from '@/components/PlayerFace'
import type { StaffRole } from '@/game/types'
import { formationLabel } from '@/game/types'
import { cn } from '@/lib/cn'
import {
  GhostButton,
  PageHeader,
  Panel,
  ProgressBar,
  StatTile,
} from '@/components/ui'

const ROLE_META: Record<StaffRole, { title: string; desc: string }> = {
  coach: {
    title: 'ผู้ช่วยผู้จัดการ',
    desc: 'คุณภาพซ้อมทั่วไป · แท็กติก · ความคม',
  },
  attacking: {
    title: 'โค้ชฝึกกองหน้า',
    desc: 'โฟกัสเกมรุก · ยิง · สร้างโอกาส',
  },
  defending: {
    title: 'โค้ชฝึกกองหลัง',
    desc: 'โฟกัสเกมรับ · โครงสร้างแนวรับ',
  },
  fitness: {
    title: 'โค้ชฟิตเนส',
    desc: 'สภาพร่างกาย · ความอดทน · ฟื้นฟูระหว่างซ้อม',
  },
  scout: {
    title: 'สเกาต์',
    desc: 'ความรู้ตลาด · มองเห็น PA / ฟอร์ม',
  },
  physio: {
    title: 'แพทย์ / ฟิสิโอ',
    desc: 'ฟื้นจากบาดเจ็บ · ลดเวลาพัก',
  },
}

export function StaffPage() {
  const save = useGameStore((s) => s.save)!
  const hireStaffMember = useGameStore((s) => s.hireStaffMember)
  const promoteToCoach = useGameStore((s) => s.promoteToCoach)
  const retirePlayerToStaff = useGameStore((s) => s.retirePlayerToStaff)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const [marketRole, setMarketRole] = useState<StaffRole | 'ALL'>('ALL')
  const [hireAs, setHireAs] = useState<StaffRole>('attacking')

  const managerProfile = save.managerProfile
  const managerProgress = ensureManagerProgress(save)

  const pool = save.staff.pool ?? []
  const free = useMemo(
    () => listFreeAgents(save.staff, marketRole === 'ALL' ? undefined : marketRole),
    [save.staff, marketRole],
  )
  const employed = pool.filter((p) => p.clubId).length
  const myStaff = pool.filter((p) => p.clubId === save.humanClubId)
  const vacantSlots = save.staff.members.filter((m) => !m.staffId).length
  const retirees = save.players
    .filter((p) => p.clubId === save.humanClubId && p.age >= 32)
    .sort((a, b) => b.age - a.age)
    .slice(0, 8)

  return (
    <div className="space-y-5">
      <PageHeader
        title="สตาฟ · ทีมงาน"
        subtitle="เชิญคนเข้าทีมงานคลับคุณ — ฝึกกองหน้า / กองหลัง / ฟิตเนส / สเกาต์ / แพทย์"
        actions={
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">
            งบ {formatMoney(club.balance)}
          </span>
        }
      />

      {managerProfile ? (
        <Panel className="border-lime-200 bg-lime-50/40">
          <p className="text-[11px] font-bold tracking-wider text-lime-800 uppercase">
            คุณ — ผู้จัดการคลับ
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            {save.managerName}{' '}
            <span className="text-sm font-semibold text-lime-900">
              · Lv.{managerProgress.level} · {managerProfile.nationTh} ·{' '}
              {managerProfile.styleLabelTh} · พลัง ~{formatCoachStat(managerProfile.power)}
            </span>
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            แผน {formationLabel(managerProfile.preferredFormation)} · XP {managerProgress.xp}/
            {xpToNextLevel(managerProgress.level)}
            {managerProgress.lastNote ? ` · ${managerProgress.lastNote}` : ''}
          </p>
          <ProgressBar
            value={managerProgress.xp}
            max={xpToNextLevel(managerProgress.level)}
            className="mt-2"
          />
          {managerProfile.attrs ? (
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              {(
                [
                  ['coaching', 'โค้ชชิ่ง'],
                  ['mental', 'เมนทัล'],
                  ['judging', 'ประเมิน'],
                ] as const
              ).map(([group, title]) => (
                <div key={group} className="rounded-lg border border-lime-100 bg-white/70 px-3 py-2">
                  <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                    {title}
                  </p>
                  <ul className="mt-1.5 space-y-1.5">
                    {attrsByGroup(group)
                      .slice()
                      .sort(
                        (a, b) =>
                          (managerProfile.attrs?.[b] ?? 0) - (managerProfile.attrs?.[a] ?? 0),
                      )
                      .map((k) => {
                        const v = managerProfile.attrs[k] ?? 0
                        return (
                          <li key={k}>
                            <div className="mb-0.5 flex justify-between gap-2 text-xs text-slate-700">
                              <span>{MANAGER_ATTR_META[k].labelTh}</span>
                              <span className="font-semibold tabular-nums">{v}/20</span>
                            </div>
                            <ProgressBar value={v} max={20} />
                          </li>
                        )
                      })}
                  </ul>
                </div>
              ))}
            </div>
          ) : null}
        </Panel>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="ทีมงานคลับคุณ" value={myStaff.length} accent />
        <StatTile label="ตำแหน่งว่าง" value={vacantSlots} />
        <StatTile label="ในพูลตลาด" value={pool.length} />
        <StatTile label="ว่างงาน" value={pool.length - employed} />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-slate-900">ตำแหน่งในคลับ — เชิญคนเข้าทีมงาน</h3>
        <p className="mb-3 text-xs text-slate-500">
          แต่ละตำแหน่งมีได้ 1 คน · ว่างแล้วเชิญจากตลาดด้านล่าง · ไม่ใช่การดึงโค้ชทีมชาติ
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {save.staff.members.map((m) => {
            const meta = ROLE_META[m.role]
            const person = pool.find((p) => p.id === m.staffId)
            const lastAct = person?.lastActivityId ? getActivity(person.lastActivityId) : null
            const vacant = !person
            return (
              <Panel
                key={m.role}
                className={cn('flex flex-col', vacant && 'border-dashed border-amber-300 bg-amber-50/40')}
              >
                <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">
                  {m.role}
                </p>
                <h3 className="mt-1 text-lg font-bold text-slate-900">{meta.title}</h3>
                <p className="text-xs text-slate-500">{meta.desc}</p>
                {vacant ? (
                  <div className="mt-4 flex-1">
                    <p className="text-sm font-semibold text-amber-900">ว่าง — ยังไม่มีคน</p>
                    <p className="mt-1 text-xs text-amber-800/80">
                      เลือกตำแหน่งนี้ในตลาดด้านล่างแล้วกด「เชิญเข้าทีมงาน」
                    </p>
                    <GhostButton
                      className="mt-3 w-full"
                      onClick={() => {
                        setHireAs(m.role)
                        setMarketRole(m.role)
                      }}
                    >
                      หาคนตำแหน่งนี้
                    </GhostButton>
                  </div>
                ) : (
                  <>
                    <p className="mt-3 text-base font-semibold text-slate-900">{person.name}</p>
                    <div className="mt-2 space-y-1 text-xs text-slate-600">
                      <p>
                        อายุ {person.age} · พลังงาน {Math.round(person.energy)}% · ขวัญ{' '}
                        {person.morale}/20
                      </p>
                      <p>
                        สกิลตำแหน่ง {skillForRole(person, m.role)}/20 · ระดับงาน{' '}
                        {effectiveStaffLevel(person, m.role)}/20
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
                    <ProgressBar value={m.level} max={20} className="mt-3" />
                    <p className="mt-1 text-xs text-slate-500">
                      {formatMoney(person.wageWeekly)}/สัปดาห์
                    </p>
                    {person.role !== 'coach' ? (
                      <GhostButton className="mt-3 w-full" onClick={() => promoteToCoach(person.id)}>
                        เลื่อนเป็นผู้ช่วยผู้จัดการ
                      </GhostButton>
                    ) : null}
                  </>
                )}
              </Panel>
            )
          })}
        </div>
      </div>

      <Panel>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="mr-auto text-sm font-bold text-slate-900">ตลาด · เชิญเข้าทีมงาน</h3>
          <select
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-semibold"
            value={hireAs}
            onChange={(e) => setHireAs(e.target.value as StaffRole)}
          >
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                เชิญเป็น{staffRoleLabelTh(r)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setMarketRole('ALL')}
            className={cn(
              'rounded-md border px-2.5 py-1 text-xs font-semibold',
              marketRole === 'ALL'
                ? 'border-slate-900 bg-slate-900 text-lime-300'
                : 'border-slate-300 bg-white',
            )}
          >
            ทั้งหมด
          </button>
          {STAFF_ROLES.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setMarketRole(r)
                setHireAs(r)
              }}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-semibold',
                marketRole === r
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white',
              )}
            >
              {ROLE_META[r].title}
            </button>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">
          คนว่างงานในตลาด · เชิญเข้าตำแหน่ง「{ROLE_META[hireAs].title}」ของคลับคุณ
        </p>
        <ul className="mt-3 max-h-96 space-y-1.5 overflow-y-auto text-sm">
          {free.slice(0, 50).map((p) => {
            const fit = skillForRole(p, hireAs)
            return (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-slate-900">
                    {p.name}{' '}
                    <span className="text-xs font-normal text-slate-500">
                      · ถนัด {staffRoleLabelTh(p.role)} · อายุ {p.age}
                    </span>
                  </p>
                  <p className="text-xs text-slate-500">
                    สกิล{ROLE_META[hireAs].title} {fit}/20 · โค้ช {p.coachSkill} · รุก{' '}
                    {p.attackSkill ?? '—'} · รับ {p.defendSkill ?? '—'} · ฟิต{' '}
                    {p.fitnessSkill ?? '—'} · สเกาต์ {p.scoutSkill} · แพทย์ {p.physioSkill}
                  </p>
                  <p className="text-xs text-slate-500">
                    ค่าเซ็น {formatMoney(p.hireFee)} · {formatMoney(p.wageWeekly)}/สัปดาห์
                    {p.origin === 'ex_player' ? ' · อดีตนักเตะ' : ''}
                    {fit < 6 ? ' · ยังไม่พร้อมตำแหน่งนี้ (สกิลต่ำกว่า 6)' : ''}
                  </p>
                </div>
                <GhostButton
                  disabled={fit < 6 || club.balance < p.hireFee + p.wageWeekly * 4}
                  onClick={() => hireStaffMember(p.id, hireAs)}
                >
                  เชิญเข้าทีมงาน
                </GhostButton>
              </li>
            )
          })}
          {free.length === 0 ? (
            <li className="text-slate-500">ไม่มีสตาฟว่างในตัวกรองนี้</li>
          ) : null}
        </ul>
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">แขวนสตั๊ด → สตาฟมีชีวิต</h3>
        <p className="mt-1 text-sm text-slate-600">
          นักเตะอายุ ≥ 32 กลายเป็นคนในพูลตลาด แล้วเชิญเข้าตำแหน่งทีมงานได้
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
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerFace name={p.name} size="xs" />
                  <span>
                    {p.name} · {p.age}ย · OVR {p.overall}
                  </span>
                </span>
                <div className="flex flex-wrap gap-1">
                  {STAFF_ROLES.map((r) => (
                    <GhostButton
                      key={r}
                      className="!px-2 !py-1 text-xs"
                      onClick={() => retirePlayerToStaff(p.id, r)}
                    >
                      → {ROLE_META[r].title}
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
