import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { SAVE_KEY } from '@/game/types'
import { GhostButton, PageHeader, Panel, PrimaryButton, StatTile } from '@/components/ui'

export function SavePage() {
  const save = useGameStore((s) => s.save)!
  const persist = useGameStore((s) => s.persist)
  const resetSave = useGameStore((s) => s.resetSave)
  const navigate = useNavigate()
  const club = save.clubs.find((c) => c.id === save.humanClubId)

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title="เซฟเกม" subtitle="บันทึกในเบราว์เซอร์ · สล็อตเดียว" />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="เวอร์ชัน" value={`v${save.version}`} />
        <StatTile label="แมตช์เดย์" value={save.matchday || 0} />
        <StatTile label="ฤดูกาล" value={save.season} />
      </div>

      <Panel>
        <dl className="space-y-0 text-sm">
          <div className="flex justify-between border-b border-slate-100 py-2.5">
            <dt className="text-slate-500">ผู้จัดการ</dt>
            <dd className="font-semibold">{save.managerName}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-2.5">
            <dt className="text-slate-500">สโมสร</dt>
            <dd className="font-semibold">{club?.name}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-2.5">
            <dt className="text-slate-500">ลีก</dt>
            <dd className="font-semibold">{save.leagueName}</dd>
          </div>
          <div className="flex justify-between border-b border-slate-100 py-2.5">
            <dt className="text-slate-500">สล็อต</dt>
            <dd>
              <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{SAVE_KEY}</code>
            </dd>
          </div>
          <div className="flex justify-between py-2.5">
            <dt className="text-slate-500">สร้างเมื่อ</dt>
            <dd className="font-medium">{new Date(save.createdAt).toLocaleString('th-TH')}</dd>
          </div>
        </dl>
        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton onClick={() => persist()}>เซฟตอนนี้</PrimaryButton>
          <GhostButton
            className="border-red-200 bg-red-50 text-red-800 hover:bg-red-100"
            onClick={() => {
              if (window.confirm('ลบเซฟแล้วกลับหน้าแรก?')) {
                resetSave()
                navigate('/')
              }
            }}
          >
            ลบเซฟ
          </GhostButton>
        </div>
      </Panel>
    </div>
  )
}
