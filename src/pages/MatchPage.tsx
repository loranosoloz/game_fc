import { useNavigate, Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { buildOppositionReport } from '@/game/opposition'
import { getReferee, pickRefereeId, reputationLabel, strictnessLabel } from '@/game/referees'
import { MatchStatsPanel } from '@/components/MatchStatsPanel'
import { GhostButton, PageHeader, Panel, PrimaryButton, StatTile } from '@/components/ui'
import { ensureScouting, formWatchCost } from '@/game/scouting'
import { formatMoney } from '@/lib/format'

export function MatchPage() {
  const navigate = useNavigate()
  const save = useGameStore((s) => s.save)!
  const startLiveMatch = useGameStore((s) => s.startLiveMatch)
  const playNextMatchday = useGameStore((s) => s.playNextMatchday)
  const assignScoutWatch = useGameStore((s) => s.assignScoutWatch)

  const humanFixtures = save.fixtures.filter(
    (f) => f.homeClubId === save.humanClubId || f.awayClubId === save.humanClubId,
  )
  const next = humanFixtures.find((f) => !f.played)
  const recent = humanFixtures.filter((f) => f.played).slice(-8).reverse()
  const last = save.lastHumanResult
  const scouting = ensureScouting(save)
  const watchCost = formWatchCost(save)
  const alreadyWatchingNext =
    !!next && scouting.pendingWatches.some((w) => w.status === 'pending' && w.fixtureId === next.id)

  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id
  const tag = (id: string) => (id === save.humanClubId ? 'คุณ' : 'AI')

  const dayFixtures =
    next != null ? save.fixtures.filter((f) => f.matchday === next.matchday) : []

  const oppId = next
    ? next.homeClubId === save.humanClubId
      ? next.awayClubId
      : next.homeClubId
    : null
  const report = oppId ? buildOppositionReport(save, oppId) : null

  const nextRef = next
    ? getReferee(next.refereeId ?? pickRefereeId(next.id, next.competition ?? 'league'))
    : null

  const lastFx = last
    ? save.fixtures.find((f) => f.id === last.fixtureId)
    : null

  const enterLive = () => {
    if (startLiveMatch()) navigate('/match/live')
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ศูนย์แมตช์"
        subtitle="เตรียมนัด · ผู้ตัดสิน · สถิติหลังเกม"
      />

      <div className="grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <Panel tone="dark">
          <p className="text-[11px] font-bold tracking-[0.18em] text-lime-300/80 uppercase">
            นัดถัดไป
          </p>
          {next ? (
            <div className="mt-3 space-y-4">
              <p className="text-2xl font-bold tracking-tight md:text-3xl">
                {nameOf(next.homeClubId)}{' '}
                <span className="text-sm font-normal text-slate-400">({tag(next.homeClubId)})</span>
                <span className="mx-2 text-slate-500">พบ</span>
                {nameOf(next.awayClubId)}{' '}
                <span className="text-sm font-normal text-slate-400">({tag(next.awayClubId)})</span>
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                <StatTile label="แมตช์เดย์" value={next.matchday} />
                <StatTile label="วันที่" value={next.date} />
                <StatTile
                  label="รายการ"
                  value={
                    next.competition === 'ucl'
                      ? 'UCL'
                      : next.competition === 'cup'
                        ? 'ถ้วย'
                        : 'ลีก'
                  }
                />
              </div>
              {nextRef ? (
                <div className="rounded-lg border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm">
                  <span className="text-slate-400">ผู้ตัดสิน · </span>
                  <strong className="text-white">{nextRef.name}</strong>
                  <span className="text-slate-400">
                    {' '}
                    · {reputationLabel(nextRef.reputation)} ·{' '}
                    {strictnessLabel(nextRef.strictness)} ({nextRef.strictness}/20)
                  </span>
                </div>
              ) : null}
              <p className="text-sm text-slate-400">
                วันเดียวกัน {dayFixtures.length} นัด · นัดคุณบนสนาม + AI พื้นหลัง
              </p>
              <div className="flex flex-wrap gap-2">
                <PrimaryButton onClick={enterLive}>เข้าแมตช์สด</PrimaryButton>
                <GhostButton
                  className="border-slate-600 bg-slate-800 text-slate-100 hover:bg-slate-700"
                  onClick={playNextMatchday}
                >
                  ผลทันที
                </GhostButton>
                <GhostButton
                  className="border-amber-600/50 bg-amber-950/40 text-amber-100 hover:bg-amber-900/50"
                  disabled={alreadyWatchingNext}
                  onClick={() => {
                    if (!next || !oppId) return
                    const targets = save.players
                      .filter((p) => p.clubId === oppId)
                      .sort((a, b) => b.overall - a.overall)
                      .slice(0, 2)
                      .map((p) => p.id)
                    assignScoutWatch(next.id, targets)
                  }}
                >
                  {alreadyWatchingNext
                    ? 'สเกาต์ดูนัดนี้แล้ว'
                    : `ดูฟอร์มคู่แข่ง · ${formatMoney(watchCost)}`}
                </GhostButton>
                <Link
                  to="/scouting"
                  className="rounded-md border border-slate-600 px-3 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-800"
                >
                  ศูนย์สเกาต์
                </Link>
              </div>
            </div>
          ) : (
            <div className="mt-3 space-y-3">
              <p className="text-slate-300">ไม่มีนัดเหลือสำหรับทีมคุณ</p>
              {!save.seasonComplete ? (
                <PrimaryButton onClick={playNextMatchday}>จำลองแมตช์เดย์ AI</PrimaryButton>
              ) : !save.board?.sacked ? (
                <PrimaryButton onClick={() => useGameStore.getState().startNewSeason()}>
                  เริ่มฤดูกาล {save.season + 1}
                </PrimaryButton>
              ) : null}
            </div>
          )}

          {report ? (
            <div className="mt-6 border-t border-slate-700 pt-4">
              <h3 className="font-semibold text-lime-300">Opposition report</h3>
              <p className="mt-1 text-sm text-slate-300">
                รูป {report.formation} · ความแข็งแกร่ง XI ~{report.strength}
              </p>
              <p className="mt-2 text-sm text-slate-200">
                <span className="text-slate-400">จุดอ่อน:</span> {report.weakness}
              </p>
              <p className="mt-1 text-sm text-slate-200">
                <span className="text-slate-400">ภัยคุกคาม:</span>{' '}
                {report.threatPlayers.join(' · ')}
              </p>
              <p className="mt-2 text-sm text-lime-200/90">{report.advice}</p>
            </div>
          ) : null}
        </Panel>

        <div className="space-y-5">
          {last && lastFx ? (
            <MatchStatsPanel
              result={last}
              homeName={nameOf(lastFx.homeClubId)}
              awayName={nameOf(lastFx.awayClubId)}
            />
          ) : (
            <Panel>
              <p className="text-sm text-slate-500">ยังไม่มีสถิติแมตช์ล่าสุด</p>
            </Panel>
          )}

          <Panel>
            <h3 className="text-sm font-bold text-slate-900">ผลล่าสุด</h3>
            <ul className="mt-3 space-y-1.5 text-sm">
              {recent.length === 0 ? (
                <li className="text-slate-500">ยังไม่เคยลงแข่ง</li>
              ) : (
                recent.map((f) => (
                  <li
                    key={f.id}
                    className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2"
                  >
                    <span className="truncate pr-2">
                      {nameOf(f.homeClubId)} พบ {nameOf(f.awayClubId)}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {f.homeGoals}–{f.awayGoals}
                    </span>
                  </li>
                ))
              )}
            </ul>
          </Panel>
        </div>
      </div>
    </div>
  )
}
