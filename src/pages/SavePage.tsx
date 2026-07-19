import { useNavigate } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'

export function SavePage() {
  const save = useGameStore((s) => s.save)!
  const persist = useGameStore((s) => s.persist)
  const resetSave = useGameStore((s) => s.resetSave)
  const navigate = useNavigate()

  return (
    <section className="max-w-xl space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">Save / Load</h2>
      <p className="text-sm text-slate-600">
        Autosaves to browser localStorage after each matchday. Slot: <code>fc-manager-save-v1</code>
      </p>
      <dl className="text-sm">
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">Manager</dt>
          <dd className="font-medium">{save.managerName}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">Club</dt>
          <dd className="font-medium">
            {save.clubs.find((c) => c.id === save.humanClubId)?.name}
          </dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Created</dt>
          <dd className="font-medium">{new Date(save.createdAt).toLocaleString()}</dd>
        </div>
      </dl>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => {
            persist()
          }}
          className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-300 hover:bg-slate-800"
        >
          Save now
        </button>
        <button
          type="button"
          onClick={() => {
            if (window.confirm('Delete save and return to home?')) {
              resetSave()
              navigate('/')
            }
          }}
          className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800 hover:bg-red-100"
        >
          Delete save
        </button>
      </div>
    </section>
  )
}
