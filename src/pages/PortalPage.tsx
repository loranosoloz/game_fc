import { useGameStore } from '@/store/gameStore'
import { sortedTable } from '@/game/simulate'
import { formatMoney } from '@/lib/format'
import { ensureFans, fanMoodLabel, fanTicketMultiplier } from '@/game/fans'

export function PortalPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureFans(saveRaw)
  const markInboxRead = useGameStore((s) => s.markInboxRead)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const fans = save.fans
  const nextFx = save.fixtures.find(
    (f) =>
      !f.played &&
      (f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId),
  )
  const opp = nextFx
    ? save.clubs.find(
        (c) =>
          c.id ===
          (nextFx.homeClubId === save.humanClubId ? nextFx.awayClubId : nextFx.homeClubId),
      )
    : null
  const table = sortedTable(save.table)
  const top5 = table.slice(0, 5)
  const ticketBoost = Math.round((fanTicketMultiplier(fans) - 1) * 100)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="space-y-4">
        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">ชีพจรสโมสร</h2>
          <dl className="mt-3 grid grid-cols-2 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-slate-500">เงินในบัญชี</dt>
              <dd className="font-semibold">{formatMoney(club.balance)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">แมตช์เดย์</dt>
              <dd className="font-semibold">{save.matchday || 'พรีซีซัน'}</dd>
            </div>
            <div>
              <dt className="text-slate-500">นัดถัดไป</dt>
              <dd className="font-semibold">
                {opp ? (
                  <>
                    {opp.name}{' '}
                    <span className="text-xs font-normal text-slate-500">(AI)</span>
                  </>
                ) : (
                  '—'
                )}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">โลกเกม</dt>
              <dd className="font-semibold">คุณ 1 · AI 19</dd>
            </div>
          </dl>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">แฟนบอล</h2>
          <p className="mt-1 text-sm text-slate-600">{fans.lastVerdict}</p>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-slate-500">
              <span>
                ความพอใจ · {fanMoodLabel(fans.mood)} ({fans.mood}/100)
              </span>
              <span>
                ตั๋วเหย้า {ticketBoost >= 0 ? '+' : ''}
                {ticketBoost}%
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-sky-500 transition-all"
                style={{ width: `${fans.mood}%` }}
              />
            </div>
          </div>
          <dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">Ultras</dt>
              <dd className="text-lg font-bold">{fans.factions.ultras}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ทั่วไป</dt>
              <dd className="text-lg font-bold">{fans.factions.casual}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">องค์กร</dt>
              <dd className="text-lg font-bold">{fans.factions.corporate}</dd>
            </div>
          </dl>
          <p className="mt-3 text-xs text-slate-500">
            ความคาดหวัง {fans.expectation}/100 · ความจงรัก {fans.loyalty}/100 ·
            ขายดาวตอนแฟนโกรธอาจถูกบอร์ดบล็อก
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/80 p-5">
          <h2 className="text-lg font-semibold">กล่องข้อความ</h2>
          <ul className="mt-3 space-y-2">
            {save.inbox.length === 0 ? (
              <li className="text-sm text-slate-500">ยังไม่มีข้อความ</li>
            ) : (
              save.inbox.map((msg) => (
                <li key={msg.id}>
                  <button
                    type="button"
                    onClick={() => markInboxRead(msg.id)}
                    className="w-full rounded-md border border-slate-100 bg-slate-50 px-3 py-2 text-left hover:bg-slate-100"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`text-sm font-medium ${msg.read ? 'text-slate-500' : 'text-slate-900'}`}
                      >
                        {msg.title}
                      </span>
                      <span className="text-xs text-slate-400">{msg.date}</span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-slate-600">{msg.body}</p>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      </section>

      <aside className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">สรุปตารางลีก</h2>
        <p className="mt-1 text-xs text-slate-500">ตารางเดียวกัน — ผล AI นับด้วย</p>
        <ol className="mt-3 space-y-1.5 text-sm">
          {top5.map((row, i) => {
            const c = save.clubs.find((x) => x.id === row.clubId)!
            const you = c.id === save.humanClubId
            return (
              <li
                key={row.clubId}
                className={`flex items-center justify-between rounded-md px-2 py-1.5 ${you ? 'bg-sky-50 ring-1 ring-sky-200' : ''}`}
              >
                <span>
                  {i + 1}. {c.shortName}{' '}
                  {you ? (
                    <span className="text-xs text-sky-700">คุณ</span>
                  ) : (
                    <span className="text-xs text-slate-400">AI</span>
                  )}
                </span>
                <span className="font-semibold">{row.points} แต้ม</span>
              </li>
            )
          })}
        </ol>
      </aside>
    </div>
  )
}
