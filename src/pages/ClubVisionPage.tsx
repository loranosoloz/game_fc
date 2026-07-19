import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import { ensureBoard, boardLabel, refreshVisionKpis } from '@/game/board'
import {
  ensureOwner,
  OWNER_PERSONALITY_DESC,
  OWNER_PERSONALITY_LABEL,
} from '@/game/owner'
import { ensureFans, fanMoodLabel, fanTicketMultiplier } from '@/game/fans'
import { formatMoney } from '@/lib/format'
import { GhostButton, PageHeader, Panel, PrimaryButton, ProgressBar, StatTile } from '@/components/ui'

export function ClubVisionPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureFans(ensurePhase5(saveRaw))
  const requestBudget = useGameStore((s) => s.requestBoardBudget)
  const board = refreshVisionKpis({ ...save, board: ensureBoard(save) })
  const owner = ensureOwner(save)
  const fans = save.fans
  const [ask, setAsk] = useState(Math.round(owner.warChest * 0.15))

  if (board.sacked) {
    return (
      <div className="space-y-5">
        <PageHeader title="Club Vision" subtitle="คุณถูกปลดจากตำแหน่งผู้จัดการ" />
        <Panel tone="warn">
          <p className="font-semibold text-rose-900">{board.sackedNote}</p>
          <p className="mt-2 text-sm text-slate-700">
            เริ่มเกมใหม่จากหน้าแรกเพื่อรับงานคลับอื่น
          </p>
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-2"
          >
            กลับหน้าแรก →
          </Link>
        </Panel>
      </div>
    )
  }

  const ticketPct = Math.round((fanTicketMultiplier(fans, save.matchday) - 1) * 100)

  return (
    <div className="space-y-5">
      <PageHeader
        title="Club Vision"
        subtitle="เจ้าของ · บอร์ด · แฟนบอล — ความมั่นใจ คำขาด KPI และการของบ"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="บอร์ด"
          value={`${board.confidence}`}
          hint={boardLabel(board.confidence)}
          accent
        />
        <StatTile
          label="เจ้าของ"
          value={`${owner.relationship}`}
          hint={OWNER_PERSONALITY_LABEL[owner.personality]}
        />
        <StatTile
          label="แฟน"
          value={`${fans.mood}`}
          hint={fanMoodLabel(fans.mood)}
        />
        <StatTile
          label="War chest"
          value={formatMoney(owner.warChest)}
          hint={`เทคโอเวอร์ ${owner.takeoverHeat}/100`}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">เจ้าของสโมสร</h3>
          <p className="mt-1 text-lg font-semibold">{owner.name}</p>
          <p className="text-xs text-slate-500">
            {OWNER_PERSONALITY_LABEL[owner.personality]} —{' '}
            {OWNER_PERSONALITY_DESC[owner.personality]}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ความสัมพันธ์</dt>
              <dd className="text-lg font-bold">{owner.relationship}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ความอดทน</dt>
              <dd className="text-lg font-bold">{owner.patience}</dd>
            </div>
          </dl>
          <ProgressBar value={owner.relationship} max={100} className="mt-3" />
          <p className="mt-2 text-sm text-slate-600">{owner.lastNote}</p>
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">บอร์ด / Club Vision</h3>
          <p className="mt-1 text-sm text-slate-600">{board.lastNote}</p>
          <ProgressBar value={board.confidence} max={100} className="mt-3" />
          <p className="mt-1 text-xs text-slate-500">
            เป้าท็อป {board.targetMaxRank} · สไตล์ {board.preferredStyle} · streak ต่ำ{' '}
            {board.lowConfidenceStreak}
          </p>
          {board.ultimatum ? (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
              คำขาด: {board.ultimatum.note} · ชนะแล้ว {board.ultimatum.winsSoFar}/
              {board.ultimatum.winsNeeded} · ครบ MD{board.ultimatum.deadlineMatchday}
            </p>
          ) : null}
          <ul className="mt-3 space-y-1.5 text-sm">
            {board.kpis.map((k) => (
              <li key={k.id} className="flex justify-between gap-2">
                <span className={k.met ? 'text-lime-800' : 'text-slate-700'}>
                  {k.met ? '✓' : '○'} {k.label}
                </span>
                <span className="tabular-nums text-slate-500">
                  {typeof k.current === 'number' && k.current > 1000
                    ? formatMoney(k.current)
                    : k.current}
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ขอฉีดเงินจากเจ้าของ</h3>
        <p className="mt-1 text-xs text-slate-500">
          โอกาสสำเร็จขึ้นกับความสัมพันธ์·ความมั่นใจบอร์ด·บุคลิกเจ้าของ · คูลดาวน์ 4 MD
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span>จำนวน (฿)</span>
            <input
              type="number"
              className="rounded-md border border-slate-300 px-3 py-2"
              value={ask}
              onChange={(e) => setAsk(Number(e.target.value))}
            />
          </label>
          <PrimaryButton onClick={() => requestBudget(ask)}>ส่งคำขอ</PrimaryButton>
          <GhostButton onClick={() => setAsk(Math.round(owner.warChest * 0.1))}>
            10% chest
          </GhostButton>
        </div>
      </Panel>

      <Panel tone={fans.protestActive ? 'warn' : 'default'}>
        <h3 className="text-sm font-bold text-slate-900">แฟนบอล</h3>
        <p className="mt-1 text-sm text-slate-600">{fans.lastVerdict}</p>
        <ProgressBar value={fans.mood} max={100} className="mt-3" />
        <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <dt className="text-slate-500">Ultras</dt>
            <dd className="text-lg font-bold">{fans.factions.ultras}</dd>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <dt className="text-slate-500">Casual</dt>
            <dd className="text-lg font-bold">{fans.factions.casual}</dd>
          </div>
          <div className="rounded-md bg-slate-50 px-2 py-2">
            <dt className="text-slate-500">Corporate</dt>
            <dd className="text-lg font-bold">{fans.factions.corporate}</dd>
          </div>
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          ความคาดหวัง {fans.expectation} · ความจงรัก {fans.loyalty} · ตั๋วประมาณ{' '}
          {ticketPct >= 0 ? '+' : ''}
          {ticketPct}%
        </p>
        {fans.protestActive ? (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            ⚠ ประท้วงกำลังเกิด — {fans.lastEvent}
            {fans.boycottUntilMatchday >= save.matchday
              ? ` · คว่ำบาตรตั๋วถึง MD${fans.boycottUntilMatchday}`
              : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{fans.lastEvent}</p>
        )}
      </Panel>
    </div>
  )
}
