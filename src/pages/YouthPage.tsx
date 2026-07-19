import { useGameStore } from '@/store/gameStore'
import {
  ensureFacilities,
  facilityUpgradeCost,
  facilityCurrentTier,
  facilityMaxTier,
  FACILITY_LABEL,
  proposeFacilityUpgrade,
} from '@/game/facilities'
import { ensureAffiliates, affiliateBoostCost } from '@/game/affiliates'
import { roleShort } from '@/game/positions'
import { formatMoney } from '@/lib/format'
import {
  GhostButton,
  PageHeader,
  Panel,
  PrimaryButton,
  ProgressBar,
  StatTile,
} from '@/components/ui'

function youthReady(p: { age: number; minutesPlayed: number; overall: number }) {
  return p.age >= 17 && (p.minutesPlayed >= 180 || p.age >= 19 || p.overall >= 68)
}

export function YouthPage() {
  const save = useGameStore((s) => s.save)!
  const proposeFacilityUpgradeStore = useGameStore((s) => s.proposeFacilityUpgrade)
  const boostAffiliates = useGameStore((s) => s.boostAffiliateRelations)
  const graduateYouth = useGameStore((s) => s.graduateYouthPlayer)
  const fac = ensureFacilities(save)
  const affiliates = ensureAffiliates(save)
  const youthTier = facilityCurrentTier(fac, 'youth')
  const youthMax = facilityMaxTier(fac, 'youth')
  const cost = facilityUpgradeCost('youth', youthTier)
  const affCost = affiliateBoostCost(save)
  const youth = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .sort((a, b) => b.pa - a.pa)
  const canPropose = proposeFacilityUpgrade(save, 'youth').ok
  const atCap = youthTier >= youthMax

  return (
    <div className="space-y-5">
      <PageHeader
        title="อะคาเดมี่เยาวชน"
        subtitle="เด็กจาก FMTU Wonderkids (U16/U18/U21/U23) ในลีกชั้นนำ + intake สุ่มตามรอบ · อัปเกรดผ่านข้อเสนอเจ้าของ"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="ระดับอะคาเดมี่" value={`${save.youth.academyLevel}/20`} accent />
        <StatTile
          label={FACILITY_LABEL.youth}
          value={`${youthTier}/${youthMax}`}
          hint="สิ่งอำนวย"
        />
        <StatTile label="Intake ถัดไป" value={`MD ${save.youth.nextIntakeMatchday}`} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">สถานะอะคาเดมี่</h3>
          <ProgressBar value={save.youth.academyLevel} max={20} className="mt-3" />
          <p className="mt-3 text-sm text-slate-600">{save.youth.lastIntakeNote}</p>
          <PrimaryButton
            className="mt-4"
            onClick={() => proposeFacilityUpgradeStore('youth')}
            disabled={atCap || !!fac.project || !!fac.pendingProposal}
          >
            เสนอเจ้าของ · อัปเกรด · {formatMoney(cost)}
          </PrimaryButton>
          <p className="mt-2 text-xs text-slate-500">
            {atCap
              ? 'เพดานสิ่งอำนวยเยาวชนของคลับนี้แล้ว'
              : canPropose
                ? 'ส่งข้อเสนอถึงเจ้าของ — อนุมัติที่หน้าบอร์ด/แฟน'
                : fac.pendingProposal
                  ? `รอเจ้าของ: ${fac.pendingProposal.note}`
                  : fac.project
                    ? `กำลังก่อสร้าง: ${fac.project.note}`
                    : 'ยังเสนออัปเกรดไม่ได้ตอนนี้'}
          </p>
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">นักเตะเยาวชนในคลับ</h3>
          {youth.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มี — รอ intake หรือเริ่มอาชีพใหม่หลังอัปเดต pack</p>
          ) : (
            <>
              <table className="data mt-3">
                <thead>
                  <tr>
                    <th>ชื่อ</th>
                    <th>กลุ่ม</th>
                    <th>อายุ</th>
                    <th>OVR</th>
                    <th>PA</th>
                    <th>นาที</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {youth.map((p) => {
                    const ready = youthReady(p)
                    return (
                      <tr key={p.id}>
                        <td>
                          <span className="text-slate-400">{roleShort(p.role)}</span> {p.name}
                        </td>
                        <td className="text-xs text-slate-500">
                          {p.age <= 16 ? 'U16' : p.age <= 18 ? 'U18' : p.age <= 21 ? 'U21' : 'U23'}
                        </td>
                        <td>{p.age}</td>
                        <td className="font-semibold">{p.overall}</td>
                        <td>{p.pa}</td>
                        <td className="tabular-nums text-xs">{p.minutesPlayed}</td>
                        <td>
                          <button
                            type="button"
                            disabled={!ready}
                            onClick={() => graduateYouth(p.id)}
                            className={
                              ready
                                ? 'rounded bg-slate-900 px-2 py-1 text-[10px] font-semibold text-lime-300'
                                : 'cursor-not-allowed rounded bg-slate-100 px-2 py-1 text-[10px] text-slate-400'
                            }
                            title={
                              ready
                                ? 'ขึ้นชุดใหญ่'
                                : 'ต้องการอายุ≥17 และ (นาที≥180 หรือ อายุ≥19 หรือ OVR≥68)'
                            }
                          >
                            {ready ? 'ขึ้นชุดใหญ่' : 'ยังไม่พร้อม'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              <p className="mt-2 text-[11px] text-slate-500">
                ขึ้นชุดใหญ่: อายุ ≥ 17 และ (นาที ≥ 180 หรือ อายุ ≥ 19 หรือ OVR ≥ 68)
              </p>
            </>
          )}
        </Panel>
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">สโมสรพันธมิตร (Affiliates)</h3>
        <p className="mt-1 text-xs text-slate-500">
          ระดับ feeder รวมมีผลต่อคุณภาพ youth intake (OVR/PA) · {affiliates.lastNote}
        </p>
        {affiliates.feeders.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีพันธมิตร</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {affiliates.feeders.map((f) => (
              <li
                key={f.id}
                className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm"
              >
                <span>
                  <span className="font-medium text-slate-800">{f.name}</span>
                  <span className="ml-2 text-xs text-slate-500">{f.nation}</span>
                </span>
                <span className="font-semibold tabular-nums">Lv.{f.level}/5</span>
              </li>
            ))}
          </ul>
        )}
        <GhostButton className="mt-3" onClick={() => boostAffiliates()}>
          เสริมความสัมพันธ์พันธมิตร · {formatMoney(affCost)}
        </GhostButton>
      </Panel>
    </div>
  )
}
