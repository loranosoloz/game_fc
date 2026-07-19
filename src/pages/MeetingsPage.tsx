import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import {
  ensureTalks,
  MANAGER_TOPICS,
  pendingTalkRequests,
  requestKindLabel,
  talkDialogCount,
  talkKindCount,
} from '@/game/playerTalks'
import type { ManagerTalkTopic, TalkResponse } from '@/game/types'
import { cn } from '@/lib/cn'
import { GhostButton, PageHeader, Panel, PrimaryButton, StatTile } from '@/components/ui'

export function MeetingsPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const startManagerTalk = useGameStore((s) => s.startManagerTalk)
  const answerPlayerRequest = useGameStore((s) => s.answerPlayerRequest)

  const talks = ensureTalks(save)
  const pending = pendingTalkRequests(save)
  const dialogPool = talkDialogCount()
  const kindPool = talkKindCount()
  const squad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save],
  )

  const [playerId, setPlayerId] = useState(squad[0]?.id ?? '')
  const [topic, setTopic] = useState<ManagerTalkTopic>('listen')

  const selected = squad.find((p) => p.id === playerId)

  return (
    <div className="space-y-5">
      <PageHeader
        title="คุยกับนักเตะ"
        subtitle={`คลัง ${kindPool} ประเภท · ${dialogPool} บทสนทนา · ทีม AI ก็คุย/ตอบอัตโนมัติเหมือนกัน`}
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="คำขอรอตอบ" value={pending.length} accent />
        <StatTile label="สัญญาที่ค้าง" value={talks.promises.length} />
        <StatTile
          label="ประชุมทีมล่าสุด"
          value={
            talks.lastTeamMeetingMatchday < 0 ? '—' : `MD${talks.lastTeamMeetingMatchday}`
          }
        />
      </div>

      <Panel tone="warn">
        <h3 className="text-sm font-bold text-slate-900">นักเตะเรียกคุย</h3>
        <p className="mt-1 text-xs text-amber-900/80">
          {kindPool} ประเภทคำขอ · {dialogPool} dialog — ทีมคุณตอบเอง · ทีม AI โค้ชตอบอัตโนมัติ (มีผล morale/ลา/เงินเหมือนกัน)
        </p>
        {pending.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">ยังไม่มีใครเคาะประตู — เล่นแมตช์เดย์ต่อไป</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {pending.map((r) => {
              const p = save.players.find((x) => x.id === r.playerId)
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-amber-200 bg-white/90 px-4 py-3"
                >
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="font-semibold text-slate-900">
                      {p?.name ?? r.playerId}{' '}
                      <span className="text-[10px] font-bold tracking-wide text-amber-800 uppercase">
                        {requestKindLabel(r.kind, r.labelTh)} · ด่วน {r.urgency}/10
                      </span>
                    </p>
                    <span className="text-[11px] text-slate-400">
                      MD{r.matchday} · {r.date}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{r.message}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {(
                      [
                        ['agree', 'รับปาก'],
                        ['promise', 'สัญญาไว้ก่อน'],
                        ['listen_only', 'รับฟัง'],
                        ['refuse', 'ปฏิเสธ'],
                      ] as [TalkResponse, string][]
                    ).map(([resp, label]) => (
                      <GhostButton
                        key={resp}
                        className={cn(
                          '!px-2.5 !py-1.5 text-xs',
                          resp === 'refuse' && '!border-rose-300 !text-rose-800',
                          resp === 'agree' && '!border-lime-400 !bg-lime-50',
                        )}
                        onClick={() => answerPlayerRequest(r.id, resp)}
                      >
                        {label}
                      </GhostButton>
                    ))}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ผู้จัดการเริ่มคุย</h3>
        <div className="mt-3 grid gap-2 md:grid-cols-2">
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
            disabled={topic === 'team_meeting'}
          >
            {squad.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · {p.squadRole} · ขวัญ {p.morale} · สุข {(p.happiness ?? p.morale)}
              </option>
            ))}
          </select>
          <select
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
            value={topic}
            onChange={(e) => setTopic(e.target.value as ManagerTalkTopic)}
          >
            {MANAGER_TOPICS.map((t) => (
              <option key={t.id} value={t.id}>
                {t.title}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {MANAGER_TOPICS.find((t) => t.id === topic)?.desc}
          {selected && topic !== 'team_meeting'
            ? ` · เป้า: ${selected.name}`
            : null}
        </p>
        <PrimaryButton
          className="mt-3"
          onClick={() =>
            startManagerTalk(topic, topic === 'team_meeting' ? undefined : playerId)
          }
        >
          {topic === 'team_meeting' ? 'เปิดประชุมทีม' : 'เริ่มคุยส่วนตัว'}
        </PrimaryButton>
        <p className="mt-2 text-xs text-slate-500">
          สัญญาเวลาลงเล่นแล้วไม่ทำตาม → โดนหักความเชื่อถืออัตโนมัติ · ต่อสัญญาจริงที่{' '}
          <Link to="/transfers" className="font-semibold underline underline-offset-2">
            ตลาด
          </Link>
        </p>
      </Panel>

      {talks.promises.length > 0 ? (
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">สัญญาที่ยังค้างตรวจ</h3>
          <ul className="mt-2 space-y-1 text-sm text-slate-700">
            {talks.promises.map((pr, i) => {
              const p = save.players.find((x) => x.id === pr.playerId)
              return (
                <li key={`${pr.playerId}-${pr.kind}-${i}`}>
                  {p?.name ?? pr.playerId}: {pr.note} · ครบ MD{pr.dueMatchday}
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">บันทึกการคุยล่าสุด</h3>
        {talks.logs.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">ยังว่าง</p>
        ) : (
          <ul className="mt-2 max-h-72 space-y-2 overflow-y-auto text-sm">
            {talks.logs.slice(0, 20).map((l) => (
              <li key={l.id} className="rounded-md border border-slate-100 bg-slate-50 px-3 py-2">
                <p className="font-semibold text-slate-900">
                  {l.playerName}{' '}
                  <span className="text-[10px] font-bold text-slate-400 uppercase">
                    {l.source} · {l.topic}
                  </span>
                </p>
                <p className="text-xs text-slate-600">{l.outcome}</p>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
