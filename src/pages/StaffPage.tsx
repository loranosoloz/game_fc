import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { effectiveStaffLevel, listFreeAgents, staffUpgradeCost } from '@/game/staff'
import {
  clubHireCost,
  coachBlurb,
  freeWorldCoaches,
  getWorldCoach,
  ntCoachesAvailableToPoach,
  solveLabelTh,
  styleLabelTh,
} from '@/game/worldCoaches'
import { associationBlurb, fifaTierForRank } from '@/game/associations'
import { attrsByGroup, MANAGER_ATTR_META } from '@/game/managerProfile'
import { ensureManagerProgress, xpToNextLevel } from '@/game/managerProgress'
import { getActivity } from '@/game/dailyLife'
import { formatMoney } from '@/lib/format'
import type { StaffRole } from '@/game/types'
import { formationLabel } from '@/game/types'
import { cn } from '@/lib/cn'
import { CoachFace } from '@/components/CoachFace'
import { CoachCareerTimeline } from '@/components/CoachCareerTimeline'
import ntDb from '@/data/nationalTeams.json'
import {
  GhostButton,
  PageHeader,
  Panel,
  PrimaryButton,
  ProgressBar,
  StatTile,
} from '@/components/ui'

const LEAGUE_NATION = ntDb.leagueDomestic as Record<string, string>

const ROLE_TH: Record<StaffRole, { title: string; desc: string }> = {
  coach: { title: 'โค้ชหลัก', desc: 'มีได้คนเดียว · คุณภาพซ้อม · ความคม' },
  scout: { title: 'สเกาต์', desc: 'ความรู้ตลาด · PA' },
  physio: { title: 'แพทย์', desc: 'ฟื้นจากบาดเจ็บ' },
}

export function StaffPage() {
  const save = useGameStore((s) => s.save)!
  const upgradeStaffRole = useGameStore((s) => s.upgradeStaffRole)
  const hireStaffMember = useGameStore((s) => s.hireStaffMember)
  const hireWorldCoach = useGameStore((s) => s.hireWorldCoach)
  const promoteToCoach = useGameStore((s) => s.promoteToCoach)
  const retirePlayerToStaff = useGameStore((s) => s.retirePlayerToStaff)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const [marketRole, setMarketRole] = useState<StaffRole | 'ALL'>('ALL')
  const [hireAs, setHireAs] = useState<StaffRole>('coach')
  const [careerCoachId, setCareerCoachId] = useState<string | null>(null)

  const headCoach = getWorldCoach(club.coachId)
  const managerProfile = save.managerProfile
  const managerProgress = ensureManagerProgress(save)
  const worldFree = useMemo(
    () => freeWorldCoaches(save.clubs, save.associations).slice(0, 20),
    [save.clubs, save.associations],
  )
  const ntPoach = useMemo(
    () => ntCoachesAvailableToPoach(save.clubs, save.associations).slice(0, 12),
    [save.clubs, save.associations],
  )
  const domesticNation = LEAGUE_NATION[save.leagueId] ?? 'England'
  const homeAssoc = save.associations?.[domesticNation] ?? null
  const homeNtCoach = homeAssoc?.coachId ? getWorldCoach(homeAssoc.coachId) : null
  const topAssocs = useMemo(() => {
    const list = Object.values(save.associations ?? {})
    return list.sort((a, b) => a.fifaRank - b.fifaRank).slice(0, 12)
  }, [save.associations])

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
        title="สตาฟ · ทีมงาน"
        subtitle="คุณคือผู้จัดการที่ถูกจ้าง · จ้างที่ปรึกษาแผน/สตาฟหลังบ้านใต้บังคับบัญชาคุณ"
        actions={
          <span className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold">
            งบ {formatMoney(club.balance)}
          </span>
        }
      />

      {homeAssoc ? (
        <Panel className="border-amber-200 bg-amber-50/60">
          <p className="text-[11px] font-bold tracking-wider text-amber-800 uppercase">
            สมาคมฟุตบอลประเทศคุณ · FIFA ranking
          </p>
          <h3 className="mt-1 text-lg font-bold text-slate-900">
            {homeAssoc.nameTh}{' '}
            <span className="text-sm font-semibold text-amber-900">
              · FIFA #{homeAssoc.fifaRank} · {fifaTierForRank(homeAssoc.fifaRank).labelTh}
            </span>
          </h3>
          <p className="mt-1 text-sm text-slate-700">
            {associationBlurb(homeAssoc, save.managerName)}
          </p>
          {save.career?.nationalNation === domesticNation ||
          homeAssoc.coachId === '__human__' ? (
            <p className="mt-2 text-xs font-semibold text-indigo-900">
              คุณคือโค้ชทีมชาตินี้ (สมาคมจ้าง) · ฟอร์ม {homeAssoc.form ?? 12}/20 · คุมมา{' '}
              {homeAssoc.windowsInCharge ?? 0} หน้าต่าง
            </p>
          ) : homeNtCoach ? (
            <p className="mt-2 text-xs text-slate-700">
              โค้ชทีมชาติ: <span className="font-semibold">{homeNtCoach.name}</span> · พลัง{' '}
              {homeNtCoach.power} · ฟอร์ม {homeAssoc.form ?? 12}/20 · คุมมา{' '}
              {homeAssoc.windowsInCharge ?? 0} หน้าต่าง · {homeNtCoach.styleLabelTh}
            </p>
          ) : (
            <p className="mt-2 text-xs text-rose-800">ยังไม่มีโค้ชทีมชาติ — สมาคมจะจัดจ้างเมื่อถึงหน้าต่าง FIFA</p>
          )}
          <p className="mt-1 text-xs text-slate-500">
            ไล่/ลาออกต้องมีเหตุจากสภาพแวดล้อม (ฟอร์ม·งบ·กดดัน FIFA) · คุ้มกันอย่างน้อย 3 หน้าต่างหลังจ้าง ·
            ดึงจากชาติได้เมื่อโค้ชอยู่ครบระยะ / ฟอร์มแย่
          </p>
        </Panel>
      ) : null}

      {managerProfile ? (
        <Panel className="border-lime-200 bg-lime-50/40">
          <p className="text-[11px] font-bold tracking-wider text-lime-800 uppercase">
            คุณ — ผู้จัดการที่ถูกจ้าง
          </p>
          <h3 className="mt-1 text-xl font-bold text-slate-900">
            {save.managerName}{' '}
            <span className="text-sm font-semibold text-lime-900">
              · Lv.{managerProgress.level} · {managerProfile.nationTh} ·{' '}
              {managerProfile.styleLabelTh} · พลัง ~{managerProfile.power}
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
                <div key={group}>
                  <p className="text-[10px] font-bold tracking-wide text-slate-500 uppercase">
                    {title}
                  </p>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-700">
                    {attrsByGroup(group)
                      .slice()
                      .sort(
                        (a, b) =>
                          (managerProfile.attrs?.[b] ?? 0) - (managerProfile.attrs?.[a] ?? 0),
                      )
                      .map((k) => (
                        <li key={k} className="flex justify-between gap-2">
                          <span>{MANAGER_ATTR_META[k].labelTh}</span>
                          <span className="font-semibold tabular-nums">
                            {managerProfile.attrs[k]}
                          </span>
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-1 text-sm text-slate-700">
              โจมตี {managerProfile.attackingIQ} · รับ {managerProfile.defendingIQ} · คน{' '}
              {managerProfile.manManagement} · ปรับ {managerProfile.adaptability}
            </p>
          )}
          <p className="mt-2 text-xs text-slate-600">
            ถนัดชนะ: {managerProfile.strongVs.join(', ') || '—'} · ไม่ถนัด:{' '}
            {managerProfile.weakVs.join(', ') || '—'}
          </p>
        </Panel>
      ) : null}

      <Panel className="border-slate-200">
        <h3 className="text-sm font-bold text-slate-900">สมาคมทั่วโลก (ท็อป FIFA)</h3>
        <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-slate-700">
          {topAssocs.map((a) => {
            const humanSeat = a.coachId === '__human__'
            const c = a.coachId && !humanSeat ? getWorldCoach(a.coachId) : null
            return (
              <li key={a.nation} className="flex flex-wrap justify-between gap-2 border-b border-slate-100 py-1">
                <span>
                  #{a.fifaRank} {a.nameTh}{' '}
                  <span className="text-slate-500">({a.name})</span>
                </span>
                <span className="font-semibold">
                  {humanSeat
                    ? `${save.managerName} (คุณ)`
                    : c
                      ? `${c.name} · ${c.power}`
                      : 'ว่าง'}{' '}
                  · งบ {formatMoney(a.budget)}
                </span>
              </li>
            )
          })}
        </ul>
      </Panel>

      <Panel className="border-indigo-200 bg-indigo-50/50">
        <p className="text-[11px] font-bold tracking-wider text-indigo-700 uppercase">
          ที่ปรึกษาแผน / โค้ชเทคนิค
        </p>
        <p className="mt-1 text-xs text-slate-600">
          คุณคือหัวหน้าผู้จัดการ — คนด้านล่างเป็นทีมงานที่ช่วยวางแผนและแก้เกม (ไม่ใช่การจ้างคนมาแทนคุณ)
        </p>
        {headCoach ? (
          <div className="mt-2 space-y-2">
            <div className="flex items-start gap-3">
              <CoachFace
                coachId={headCoach.id}
                name={headCoach.name}
                size="lg"
                className="ring-2 ring-indigo-200"
              />
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-slate-900">
                  {headCoach.name}{' '}
                  <span className="text-sm font-semibold text-indigo-800">
                    · พลัง {headCoach.power} · {headCoach.nationTh}
                  </span>
                </h3>
                <p className="mt-1 text-sm text-slate-700">{coachBlurb(headCoach)}</p>
              </div>
            </div>
            <div className="grid gap-2 text-xs text-slate-700 sm:grid-cols-2 lg:grid-cols-4">
              <p>
                โจมตี IQ <span className="font-semibold">{headCoach.attackingIQ}</span>
              </p>
              <p>
                รับ IQ <span className="font-semibold">{headCoach.defendingIQ}</span>
              </p>
              <p>
                จัดการคน <span className="font-semibold">{headCoach.manManagement}</span>
              </p>
              <p>
                ปรับแผน <span className="font-semibold">{headCoach.adaptability}</span>
              </p>
            </div>
            <p className="text-xs text-slate-600">
              แผนถนัด {formationLabel(headCoach.preferredFormation, true)} / OOP{' '}
              {formationLabel(headCoach.formationOop, true)} · กด{' '}
              {headCoach.pressing} · {headCoach.styleLabelTh}
            </p>
            <p className="text-xs text-slate-600">
              แก้เกม: {headCoach.solveGame.map(solveLabelTh).join(' · ')}
            </p>
            <p className="text-xs text-emerald-800">
              ถนัดชนะ: {headCoach.strongVs.map(styleLabelTh).join(', ')}
            </p>
            <p className="text-xs text-rose-800">
              ไม่ถนัด: {headCoach.weakVs.map(styleLabelTh).join(', ')}
            </p>
            <CoachCareerTimeline coach={headCoach} />
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            ยังไม่มีที่ปรึกษาแผนจากพูลโลก — จ้างจากตลาดด้านล่างเพื่อเสริมสไตล์ทีม
          </p>
        )}
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ตลาดที่ปรึกษาแผนว่าง</h3>
        <p className="mt-1 text-xs text-slate-500">
          รวมอดีตโค้ชทีมชาติที่ว่างแล้ว · จ้างแล้วช่วยตั้งแผนตามสไตล์ภายใต้คุณ
        </p>
        <ul className="mt-3 max-h-72 space-y-1.5 overflow-y-auto text-sm">
          {worldFree.map((c) => {
            const cost = clubHireCost(c)
            const selected = careerCoachId === c.id
            return (
              <li
                key={c.id}
                className={cn(
                  'rounded-lg border bg-white px-3 py-2',
                  selected ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-slate-100',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setCareerCoachId(selected ? null : c.id)}
                  >
                    <CoachFace coachId={c.id} name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {c.name}{' '}
                        <span className="text-xs font-normal text-slate-500">
                          · พลัง {c.power} · {c.nationTh} · {c.tier}
                        </span>
                      </p>
                      <p className="text-xs text-slate-600">
                        {c.styleLabelTh} · ถนัด {formationLabel(c.preferredFormation)}
                      </p>
                      <p className="text-xs text-slate-500">{formatMoney(cost)} รวม</p>
                    </div>
                  </button>
                  <GhostButton disabled={club.balance < cost} onClick={() => hireWorldCoach(c.id)}>
                    จ้าง
                  </GhostButton>
                </div>
                {selected ? (
                  <div className="mt-2 border-t border-slate-100 pt-2">
                    <CoachCareerTimeline coach={c} compact />
                  </div>
                ) : null}
              </li>
            )
          })}
          {worldFree.length === 0 ? (
            <li className="text-slate-500">ไม่มีโค้ชว่างในตลาด</li>
          ) : null}
        </ul>
      </Panel>

      <Panel className="border-amber-100 bg-amber-50/40">
        <h3 className="text-sm font-bold text-slate-900">ดึงจากทีมชาติ</h3>
        <p className="mt-1 text-xs text-slate-500">
          โค้ชที่ยอมลาออกจากสมาคมมาคุมคลับคุณได้ — มีค่าฉีกสัญญาชาติเพิ่ม
        </p>
        <ul className="mt-3 max-h-64 space-y-1.5 overflow-y-auto text-sm">
          {ntPoach.map(({ coach: c, nation }) => {
            const ntComp = Math.round(c.power * 80_000)
            const cost = clubHireCost(c) + ntComp
            const selected = careerCoachId === c.id
            return (
              <li
                key={c.id}
                className={cn(
                  'rounded-lg border bg-white px-3 py-2',
                  selected ? 'border-amber-300 ring-1 ring-amber-200' : 'border-amber-100',
                )}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                    onClick={() => setCareerCoachId(selected ? null : c.id)}
                  >
                    <CoachFace coachId={c.id} name={c.name} size="sm" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {c.name}{' '}
                        <span className="text-xs font-normal text-amber-800">· คุม {nation} อยู่</span>
                      </p>
                      <p className="text-xs text-slate-600">
                        พลัง {c.power} · {c.styleLabelTh} · ค่าฉีกชาติ ~{formatMoney(ntComp)}
                      </p>
                      <p className="text-xs text-slate-500">{formatMoney(cost)} รวม</p>
                    </div>
                  </button>
                  <GhostButton disabled={club.balance < cost} onClick={() => hireWorldCoach(c.id)}>
                    ดึงมาคุม
                  </GhostButton>
                </div>
                {selected ? (
                  <div className="mt-2 border-t border-amber-100 pt-2">
                    <CoachCareerTimeline coach={c} compact />
                  </div>
                ) : null}
              </li>
            )
          })}
          {ntPoach.length === 0 ? (
            <li className="text-slate-500">ไม่มีโค้ชชาติให้ดึงตอนนี้</li>
          ) : null}
        </ul>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="ในพูลสตาฟ" value={pool.length} accent />
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
          สตาฟหลังบ้าน (ซ้อม/สเกาต์/แพทย์) แยกจากที่ปรึกษาแผนด้านบน
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
          {free.length === 0 ? <li className="text-slate-500">ไม่มีสตาฟว่าง</li> : null}
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
