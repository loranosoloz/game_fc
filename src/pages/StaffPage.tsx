import { useGameStore } from '@/store/gameStore'
import { staffUpgradeCost } from '@/game/staff'
import { formatMoney } from '@/lib/format'

const ROLE_TH: Record<string, string> = {
  coach: 'โค้ช (ซ้อม/คม)',
  scout: 'สเกาต์ (ความรู้ตลาด)',
  physio: 'แพทย์ (ฟื้นตัว)',
}

export function StaffPage() {
  const save = useGameStore((s) => s.save)!
  const upgradeStaffRole = useGameStore((s) => s.upgradeStaffRole)

  return (
    <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
      <h2 className="text-lg font-semibold">Staff</h2>
      <p className="mt-1 text-sm text-slate-600">ระดับสตาฟกระทบซ้อม · สเกาต์ · การฟื้นจากบาดเจ็บ</p>
      <ul className="mt-4 space-y-3">
        {save.staff.members.map((m) => {
          const cost = staffUpgradeCost(m.level)
          return (
            <li
              key={m.role}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50 px-4 py-3"
            >
              <div>
                <p className="font-semibold">{ROLE_TH[m.role]}</p>
                <p className="text-sm text-slate-600">
                  {m.name} · Lv {m.level}/20
                </p>
              </div>
              <button
                type="button"
                onClick={() => upgradeStaffRole(m.role)}
                className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
              >
                อัปเกรด {formatMoney(cost)}
              </button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
