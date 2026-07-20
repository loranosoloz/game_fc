import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import {
  ensureScouting,
  formWatchCost,
  knowledgeOf,
  recentFormForPlayer,
  revealOverall,
  revealPa,
} from '@/game/scouting'
import { formatMoney } from '@/lib/format'
import { GhostButton, PageHeader, Panel, PrimaryButton, StatTile } from '@/components/ui'
import { PlayerFace } from '@/components/PlayerFace'

const PURPOSE_TH: Record<string, string> = {
  watch_team: 'ดูทีม',
  check_form: 'เช็คฟอร์ม',
  scout_player: 'ส่องนักเตะ',
}

const KIND_TH: Record<string, string> = {
  player: 'นักเตะ',
  coach: 'โค้ช',
  celebrity: 'คนดัง',
}

export function ScoutingPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const assignScoutWatch = useGameStore((s) => s.assignScoutWatch)
  const runScout = useGameStore((s) => s.runScout)
  const scouting = ensureScouting(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const cost = formWatchCost(save)

  const [watchFx, setWatchFx] = useState('')
  const [targetId, setTargetId] = useState('')

  const upcoming = useMemo(
    () =>
      save.fixtures
        .filter((f) => !f.played)
        .sort((a, b) => a.matchday - b.matchday || a.date.localeCompare(b.date))
        .slice(0, 24),
    [save.fixtures],
  )

  const selectedFx = upcoming.find((f) => f.id === watchFx)
  const watchTargets = useMemo(() => {
    if (!selectedFx) return []
    return save.players
      .filter(
        (p) =>
          (p.clubId === selectedFx.homeClubId || p.clubId === selectedFx.awayClubId) &&
          p.clubId !== save.humanClubId,
      )
      .sort((a, b) => b.overall - a.overall)
      .slice(0, 30)
  }, [selectedFx, save])

  const pending = scouting.pendingWatches.filter((w) => w.status === 'pending')
  const recentVisits = scouting.visits.slice(0, 12)
  const recentForms = scouting.formSightings.slice(0, 16)
  const alumniCount = scouting.alumniIds.length

  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.shortName ?? id
  const playerName = (id: string) => save.players.find((p) => p.id === id)?.name ?? id

  return (
    <div className="space-y-5">
      <PageHeader
        title="สเกาต์ & แขกสนาม"
        subtitle="ความรู้เริ่ม 0% · อดีตลูกทีม 50% · ดูฟอร์มได้ทีละนัด · แขกที่ไม่มีแข่งวันนั้นมาได้"
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="งบสโมสร" value={formatMoney(club.balance)} accent />
        <StatTile label="ดูฟอร์ม / นัด" value={formatMoney(cost)} hint="จ้างสตาฟไปดู" />
        <StatTile label="รอรายงาน" value={pending.length} />
        <StatTile label="อดีตลูกทีม" value={alumniCount} hint="พื้นความรู้ 50%" />
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">จ้างสเกาต์ดูฟอร์มนัดถัดไป</h3>
        <p className="mt-1 text-xs text-slate-500">
          เห็นความเก่งแค่นัดนั้น (1–10) ไม่ใช่ OVR ทั้งฤดูกาล · ความรู้เพิ่มขึ้นเล็กน้อย
        </p>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={watchFx}
            onChange={(e) => {
              setWatchFx(e.target.value)
              setTargetId('')
            }}
          >
            <option value="">— เลือกนัด —</option>
            {upcoming.map((f) => (
              <option key={f.id} value={f.id}>
                MD{f.matchday} · {nameOf(f.homeClubId)} vs {nameOf(f.awayClubId)} · {f.date}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={targetId}
            onChange={(e) => setTargetId(e.target.value)}
            disabled={!selectedFx}
          >
            <option value="">— โฟกัสดาว (ว่าง = ดูท็อป 3) —</option>
            {watchTargets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {nameOf(p.clubId)} · รู้ {knowledgeOf(scouting, p.id)}% · OVR{' '}
                {revealOverall(p.overall, knowledgeOf(scouting, p.id))}
              </option>
            ))}
          </select>
        </div>
        <PrimaryButton
          className="mt-3"
          disabled={!watchFx}
          onClick={() => {
            if (assignScoutWatch(watchFx, targetId ? [targetId] : [])) {
              setWatchFx('')
              setTargetId('')
            }
          }}
        >
          ส่งสเกาต์ดูนัด · {formatMoney(cost)}
        </PrimaryButton>
        {pending.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-600">
            {pending.map((w) => {
              const f = save.fixtures.find((x) => x.id === w.fixtureId)
              return (
                <li key={w.id}>
                  รอ MD{f?.matchday}: {f ? `${nameOf(f.homeClubId)} vs ${nameOf(f.awayClubId)}` : w.fixtureId}
                </li>
              )
            })}
          </ul>
        ) : null}
      </Panel>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel tone="warn">
          <h3 className="text-sm font-bold text-slate-900">แขกเข้าสนามล่าสุด</h3>
          <p className="mt-1 text-xs text-amber-900/80">
            นักเตะ/โค้ชที่มีแข่งวันนั้นมาไม่ได้ · คนเจ็บ/แบน หรือสโมสรที่ไม่มีนัด + คนดัง มาได้
          </p>
          {recentVisits.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มี — เล่นนัดเหย้าเพื่อรับแขก</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {recentVisits.map((v) => (
                <li key={v.id} className="rounded-lg border border-amber-100 bg-white/80 px-3 py-2">
                  <p className="font-semibold text-slate-900">
                    {v.name}{' '}
                    <span className="text-[10px] font-bold tracking-wide text-amber-700 uppercase">
                      {KIND_TH[v.kind]} · {PURPOSE_TH[v.purpose]}
                    </span>
                  </p>
                  <p className="mt-1 text-xs text-slate-600">{v.report}</p>
                  <p className="mt-1 text-[10px] text-slate-400">
                    MD{v.matchday} · {v.date}
                    {v.targetPlayerId ? ` · เป้า ${playerName(v.targetPlayerId)}` : ''}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ฟอร์มที่เห็น (นัดต่อนัด)</h3>
          <p className="mt-1 text-xs text-slate-500">ไม่ใช่คะแนนภาพรวม — ใช้ประกอบการซื้อ</p>
          {recentForms.length === 0 ? (
            <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายงาน — สั่งดูนัดหรือรอแขกส่อง</p>
          ) : (
            <ul className="mt-3 max-h-80 space-y-2 overflow-y-auto text-sm">
              {recentForms.map((s) => (
                <li
                  key={s.id}
                  className="flex items-start justify-between gap-2 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2"
                >
                  <div>
                    <p className="flex items-center gap-2 font-semibold">
                      <PlayerFace name={playerName(s.playerId)} size="xs" />
                      {playerName(s.playerId)}
                    </p>
                    <p className="text-xs text-slate-600">{s.note}</p>
                    <p className="mt-0.5 text-[10px] text-slate-400">
                      MD{s.matchday} · {s.source === 'staff_watch' ? 'สตาฟ' : 'แขก'} · รู้{' '}
                      {knowledgeOf(scouting, s.playerId)}%
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold tabular-nums text-slate-900">{s.form}</p>
                    <p className="text-[10px] text-slate-400">/10 นัดนี้</p>
                    <GhostButton
                      className="mt-1 !px-2 !py-1 text-[10px]"
                      onClick={() => runScout(s.playerId)}
                    >
                      ส่งสเกาต์
                    </GhostButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ตัวอย่างหมอกความรู้</h3>
        <ul className="mt-2 grid gap-2 sm:grid-cols-2 text-xs text-slate-600">
          {save.players
            .filter((p) => p.clubId !== save.humanClubId)
            .sort((a, b) => b.overall - a.overall)
            .slice(0, 6)
            .map((p) => {
              const k = knowledgeOf(scouting, p.id)
              const forms = recentFormForPlayer(scouting, p.id, 2)
              return (
                <li key={p.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                  <span className="flex items-center gap-2">
                    <PlayerFace name={p.name} size="xs" />
                    <span className="font-semibold text-slate-900">{p.name}</span>
                  </span>
                  <span className="mt-0.5 block">
                    OVR {revealOverall(p.overall, k)} · PA {revealPa(p.pa, k)} · รู้ {k}%
                    {scouting.alumniIds.includes(p.id) ? ' · อดีตทีม' : ''}
                  </span>
                  {forms[0] ? (
                    <span className="block text-amber-800">
                      ฟอร์มล่าสุด {forms.map((f) => f.form).join(', ')}/10
                    </span>
                  ) : null}
                </li>
              )
            })}
        </ul>
      </Panel>
    </div>
  )
}
