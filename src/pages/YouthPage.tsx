import { useGameStore } from '@/store/gameStore'
import { upgradeAcademy } from '@/game/youth'
import { roleShort } from '@/game/positions'
import { formatMoney } from '@/lib/format'
import { PageHeader, Panel, PrimaryButton, ProgressBar, StatTile } from '@/components/ui'

export function YouthPage() {
  const save = useGameStore((s) => s.save)!
  const upgradeYouthAcademy = useGameStore((s) => s.upgradeYouthAcademy)
  const cost = 250_000 + save.youth.academyLevel * 120_000
  const youth = save.players
    .filter((p) => p.clubId === save.humanClubId && p.isYouth)
    .sort((a, b) => b.pa - a.pa)
  const canUpgrade = upgradeAcademy(save).ok

  return (
    <div className="space-y-5">
      <PageHeader
        title="อะคาเดมี่เยาวชน"
        subtitle="ผลิตนักเตะรุ่นใหม่เข้าชุดใหญ่ตามรอบ intake"
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="ระดับอะคาเดมี่" value={`${save.youth.academyLevel}/20`} accent />
        <StatTile label="Intake ถัดไป" value={`MD ${save.youth.nextIntakeMatchday}`} />
        <StatTile label="ในชุดใหญ่" value={youth.length} hint="คน" />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">สถานะอะคาเดมี่</h3>
          <ProgressBar value={save.youth.academyLevel} max={20} className="mt-3" />
          <p className="mt-3 text-sm text-slate-600">{save.youth.lastIntakeNote}</p>
          <PrimaryButton className="mt-4" onClick={upgradeYouthAcademy}>
            อัปเกรด · {formatMoney(cost)}
          </PrimaryButton>
          <p className="mt-2 text-xs text-slate-500">
            {canUpgrade ? 'งบพร้อมอัปเกรด' : 'งบอาจไม่พอ — ตรวจการเงิน'}
          </p>
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">นักเตะเยาวชนในชุดใหญ่</h3>
          {youth.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มี — รอ intake</p>
          ) : (
            <table className="data mt-3">
              <thead>
                <tr>
                  <th>ชื่อ</th>
                  <th>อายุ</th>
                  <th>OVR</th>
                  <th>PA</th>
                </tr>
              </thead>
              <tbody>
                {youth.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <span className="text-slate-400">{roleShort(p.role)}</span> {p.name}
                    </td>
                    <td>{p.age}</td>
                    <td className="font-semibold">{p.overall}</td>
                    <td>{p.pa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Panel>
      </div>
    </div>
  )
}
