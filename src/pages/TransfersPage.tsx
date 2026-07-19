import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { estimatedValue, listMarketPlayers, minAcceptableFee } from '@/game/transfer'
import { analyzeBuy, analyzeSell } from '@/game/transferIntel'
import { roleLabel, roleShort } from '@/game/positions'
import { formatMoney } from '@/lib/format'
import type { PositionGroup } from '@/game/types'
import { cn } from '@/lib/cn'
import { TransferIntelPanel } from '@/components/TransferIntelPanel'
import { ensureFans, fanMoodLabel } from '@/game/fans'
import { knowledgeOf, revealPa } from '@/game/scouting'

type Tab = 'buy' | 'sell'

export function TransfersPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureFans(saveRaw)
  const offerBuyPlayer = useGameStore((s) => s.offerBuyPlayer)
  const offerSellPlayer = useGameStore((s) => s.offerSellPlayer)
  const runScout = useGameStore((s) => s.runScout)

  const [tab, setTab] = useState<Tab>('buy')
  const [pos, setPos] = useState<PositionGroup | 'ALL'>('ALL')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const human = save.clubs.find((c) => c.id === save.humanClubId)!
  const market = useMemo(() => listMarketPlayers(save), [save])
  const mySquad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .map((p) => ({ ...p, value: estimatedValue(p) }))
        .sort((a, b) => b.overall - a.overall),
    [save],
  )

  const filteredBuy = market.filter((p) => {
    if (pos !== 'ALL' && p.position !== pos) return false
    if (q && !p.name.includes(q) && !p.clubName.includes(q)) return false
    return true
  })

  const selectedBuy = market.find((p) => p.id === selectedId)
  const selectedSell = mySquad.find((p) => p.id === selectedId)
  const sellerClub = selectedBuy
    ? save.clubs.find((c) => c.id === selectedBuy.clubId)
    : null

  const [fee, setFee] = useState(0)
  const [wage, setWage] = useState(0)

  const intel = useMemo(() => {
    if (tab === 'buy' && selectedBuy) return analyzeBuy(save, selectedBuy, save.fans)
    if (tab === 'sell' && selectedSell) return analyzeSell(save, selectedSell, save.fans)
    return null
  }, [tab, selectedBuy, selectedSell, save])

  const pickBuy = (id: string) => {
    const p = market.find((x) => x.id === id)!
    const report = analyzeBuy(save, p, save.fans)
    setSelectedId(id)
    setFee(report.suggestedFee)
    setWage(report.suggestedWage ?? Math.round(p.wage * 1.1))
  }

  const pickSell = (id: string) => {
    const p = mySquad.find((x) => x.id === id)!
    const report = analyzeSell(save, p, save.fans)
    setSelectedId(id)
    setFee(report.suggestedFee)
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_1.15fr]">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold">ตลาดซื้อขาย</h2>
          {(['buy', 'sell'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                setTab(t)
                setSelectedId(null)
              }}
              className={cn(
                'rounded-md border px-3 py-1.5 text-sm font-semibold',
                tab === t
                  ? 'border-slate-900 bg-slate-900 text-lime-300'
                  : 'border-slate-300 bg-white hover:bg-slate-50',
              )}
            >
              {t === 'buy' ? 'ซื้อจาก AI' : 'ขายให้ AI'}
            </button>
          ))}
        </div>
        <p className="mt-2 text-sm text-slate-600">
          งบคุณ: <strong>{formatMoney(human.balance)}</strong> · แฟน:{' '}
          <strong>
            {fanMoodLabel(save.fans.mood)} ({save.fans.mood}/100)
          </strong>
        </p>

        {tab === 'buy' ? (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                placeholder="ค้นชื่อ / สโมสร"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <select
                className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
                value={pos}
                onChange={(e) => setPos(e.target.value as PositionGroup | 'ALL')}
              >
                <option value="ALL">ทุกตำแหน่ง</option>
                <option value="GK">GK</option>
                <option value="DF">DF</option>
                <option value="MF">MF</option>
                <option value="FW">FW</option>
              </select>
            </div>
            <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto text-sm">
              {filteredBuy.slice(0, 80).map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => pickBuy(p.id)}
                    className={cn(
                      'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left',
                      selectedId === p.id
                        ? 'border-sky-300 bg-sky-50'
                        : 'border-slate-100 bg-slate-50 hover:bg-slate-100',
                    )}
                  >
                    <span>
<span className="font-semibold" title={roleLabel(p.role)}>
                        {roleShort(p.role)}
                      </span>{' '}
                      {p.name}
                      <span className="mt-0.5 block text-xs text-slate-500">
                        {p.clubName} · อายุ {p.age}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block font-bold">{p.overall}</span>
                      <span className="text-xs text-slate-500">{formatMoney(p.value)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <ul className="mt-3 max-h-[26rem] space-y-1 overflow-y-auto text-sm">
            {mySquad.map((p) => (
              <li key={p.id}>
                <button
                  type="button"
                  onClick={() => pickSell(p.id)}
                  className={cn(
                    'flex w-full items-center justify-between rounded-md border px-3 py-2 text-left',
                    selectedId === p.id
                      ? 'border-sky-300 bg-sky-50'
                      : 'border-slate-100 bg-slate-50 hover:bg-slate-100',
                  )}
                >
                  <span>
                    <span className="font-semibold" title={roleLabel(p.role)}>
                      {roleShort(p.role)}
                    </span>{' '}
                    {p.name}
                    <span className="mt-0.5 block text-xs text-slate-500">อายุ {p.age}</span>
                  </span>
                  <span className="text-right">
                    <span className="block font-bold">{p.overall}</span>
                    <span className="text-xs text-slate-500">{formatMoney(p.value)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <aside className="max-h-[42rem] overflow-y-auto rounded-xl border border-slate-200 bg-white/80 p-5">
        <h3 className="text-lg font-semibold">ต่อรอง + เหตุผล AI</h3>
        {tab === 'buy' && selectedBuy && sellerClub ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <strong>{selectedBuy.name}</strong> · {roleShort(selectedBuy.role)} · OVR{' '}
              {selectedBuy.overall}
            </p>
            <p className="text-slate-600">
              สังกัด: {selectedBuy.clubName} (AI)
              <br />
              Scout knowledge: {knowledgeOf(save.scouting, selectedBuy.id)}% · PA{' '}
              {revealPa(selectedBuy.pa, knowledgeOf(save.scouting, selectedBuy.id))}
              <br />
              มูลค่าประเมิน: {formatMoney(selectedBuy.value)}
              <br />
              ค่าตัวขั้นต่ำโดยประมาณ: {formatMoney(minAcceptableFee(selectedBuy, sellerClub))}
            </p>
            <button
              type="button"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-semibold hover:bg-slate-50"
              onClick={() => runScout(selectedBuy.id)}
            >
              ส่งสเกาต์ (+ความรู้)
            </button>
            <label className="grid gap-1">
              <span>เสนอค่าตัว</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span>ค่าเหนื่อย/สัปดาห์</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={wage}
                onChange={(e) => setWage(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-lime-300 hover:bg-slate-800"
              onClick={() => offerBuyPlayer(selectedBuy.id, fee, wage)}
            >
              ส่งข้อเสนอซื้อ
            </button>
          </div>
        ) : null}

        {tab === 'sell' && selectedSell ? (
          <div className="mt-3 space-y-3 text-sm">
            <p>
              <strong>{selectedSell.name}</strong> · {roleShort(selectedSell.role)} · OVR{' '}
              {selectedSell.overall}
            </p>
            <p className="text-slate-600">มูลค่าประเมิน: {formatMoney(selectedSell.value)}</p>
            <label className="grid gap-1">
              <span>ตั้งราคาขาย</span>
              <input
                type="number"
                className="rounded-md border border-slate-300 px-3 py-2"
                value={fee}
                onChange={(e) => setFee(Number(e.target.value))}
              />
            </label>
            <button
              type="button"
              className="w-full rounded-md bg-slate-900 px-4 py-2.5 font-semibold text-lime-300 hover:bg-slate-800"
              onClick={() => offerSellPlayer(selectedSell.id, fee)}
            >
              เสนอขายให้ AI
            </button>
          </div>
        ) : null}

        {!selectedId ? (
          <p className="mt-3 text-sm text-slate-500">
            เลือกนักเตะเพื่อดูว่าทำไมควรซื้อ/ขาย — AI จะแตกเหตุผลหลายมุมให้
          </p>
        ) : null}

        {intel ? (
          <TransferIntelPanel
            intel={intel}
            onApplySuggestion={() => {
              setFee(intel.suggestedFee)
              if (intel.suggestedWage) setWage(intel.suggestedWage)
            }}
          />
        ) : null}
      </aside>
    </div>
  )
}
