import { useGameStore } from '@/store/gameStore'

export function FinancePage() {
  const save = useGameStore((s) => s.save)!
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const weeklyWages = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .reduce((s, p) => s + p.wage, 0)

  return (
    <section className="max-w-xl rounded-xl border border-slate-200 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">Finances</h2>
      <p className="text-sm text-slate-500">Your club only — AI clubs track balance silently</p>
      <dl className="mt-4 grid gap-3 text-sm">
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">Bank balance</dt>
          <dd className="text-lg font-bold">£{club.balance.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">Weekly wages</dt>
          <dd className="font-semibold">£{weeklyWages.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between border-b border-slate-100 py-2">
          <dt className="text-slate-500">Stadium capacity</dt>
          <dd className="font-semibold">{club.stadiumCapacity.toLocaleString()}</dd>
        </div>
        <div className="flex justify-between py-2">
          <dt className="text-slate-500">Income model (MVP)</dt>
          <dd className="text-right text-slate-700">Home tickets each matchday</dd>
        </div>
      </dl>
    </section>
  )
}
