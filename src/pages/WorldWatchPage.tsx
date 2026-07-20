import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  ACTIVITY_KIND_LABEL,
  clubSnapshot,
  ensureWorldWatch,
  setPrimaryRival,
  toggleWatchClub,
} from '@/game/worldWatch'
import { getRivalClubIds } from '@/game/rivalries'
import { PageHeader, Panel, ProgressBar, StatTile } from '@/components/ui'
import { ClubCrest } from '@/components/ClubCrest'
import { PlayerFace } from '@/components/PlayerFace'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'
import { saveToStorage } from '@/game/save'

type Tab = 'feed' | 'watch' | 'club' | 'nt'

function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const items: { id: Tab; label: string }[] = [
    { id: 'feed', label: 'ฟีดโลก' },
    { id: 'watch', label: 'ติดตาม' },
    { id: 'club', label: 'ดูคลับ' },
    { id: 'nt', label: 'ทีมชาติ' },
  ]
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setTab(t.id)}
          className={cn(
            'rounded-lg px-3 py-1.5 text-xs font-bold',
            tab === t.id ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

export function WorldWatchPage() {
  const save = useGameStore((s) => s.save)!
  const setSave = useGameStore.setState
  const [tab, setTab] = useState<Tab>('feed')
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)

  const ww = useMemo(() => ensureWorldWatch(save), [save])
  const rivalIds = useMemo(() => getRivalClubIds(save, save.humanClubId), [save])

  const clubName = (id: string) => save.clubs.find((c) => c.id === id)?.shortName ?? id
  const playerName = (id: string) => save.players.find((p) => p.id === id)?.name ?? id

  const persist = (next: typeof save, status: string) => {
    saveToStorage(next)
    setSave({ save: next, status })
  }

  const openClub = (clubId: string) => {
    setSelectedClubId(clubId)
    setTab('club')
  }

  const snap = selectedClubId ? clubSnapshot(save, selectedClubId) : null

  const divisionClubs = useMemo(
    () =>
      save.clubs
        .filter((c) => c.id !== save.humanClubId && (c.division ?? 1) === 1)
        .sort((a, b) => b.reputation - a.reputation),
    [save],
  )

  const ntSorted = useMemo(
    () => [...ww.ntInterest].sort((a, b) => b.level - a.level).slice(0, 24),
    [ww.ntInterest],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="โลก · ติดตามคู่แข่ง"
        subtitle="ดูว่าคลับ AI ทำอะไร · ทีมชาติสังเกตใคร · คู่แข่งเคลื่อนไหวตลอด"
      />

      <div className="grid gap-3 sm:grid-cols-4">
        <StatTile label="ติดตาม" value={`${ww.watchedClubIds.length}`} hint="/8" accent />
        <StatTile
          label="คู่แข่งหลัก"
          value={ww.primaryRivalId ? clubName(ww.primaryRivalId) : '—'}
        />
        <StatTile label="ฟีด" value={`${ww.feed.length}`} hint="เหตุการณ์" />
        <StatTile label="NT สังเกต" value={`${ww.ntInterest.length}`} hint="รายการ" />
      </div>

      <Tabs tab={tab} setTab={setTab} />

      {tab === 'feed' ? (
        <Panel title="ฟีดกิจกรรมโลก">
          {ww.feed.length === 0 ? (
            <p className="text-sm text-pretty text-slate-600">
              ยังไม่มีข่าว — เดินแมตช์เดย์แล้วโลกจะขยับ (ย้ายตัว AI · ซ้อม · บอร์ด · ผลแข่งคู่แข่ง)
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {ww.feed.map((ev) => (
                <li key={ev.id} className="flex gap-3 py-3">
                  <span
                    className={cn(
                      'mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
                      ev.importance >= 3
                        ? 'bg-amber-100 text-amber-900'
                        : ev.importance >= 2
                          ? 'bg-sky-100 text-sky-900'
                          : 'bg-slate-100 text-slate-600',
                    )}
                  >
                    {ACTIVITY_KIND_LABEL[ev.kind]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <button
                      type="button"
                      onClick={() => openClub(ev.clubId)}
                      className="text-left text-sm font-semibold text-slate-900 hover:underline"
                    >
                      {ev.headlineTh}
                    </button>
                    <p className="mt-0.5 text-xs text-pretty text-slate-600">{ev.bodyTh}</p>
                    <p className="mt-1 text-[11px] tabular-nums text-slate-400">
                      {ev.date} · MD{ev.matchday} · {clubName(ev.clubId)}
                      {ev.playerId ? ` · ${playerName(ev.playerId)}` : ''}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {tab === 'watch' ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="คลับที่ติดตาม">
            {ww.watchedClubIds.length === 0 ? (
              <p className="text-sm text-slate-600">ยังไม่ได้ติดตาม — เลือกจากรายชื่อขวา หรือแท็บดูคลับ</p>
            ) : (
              <ul className="space-y-2">
                {ww.watchedClubIds.map((id) => {
                  const c = save.clubs.find((x) => x.id === id)
                  if (!c) return null
                  const isRival = ww.primaryRivalId === id
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
                    >
                      <ClubCrest club={c} size="sm" />
                      <button
                        type="button"
                        className="min-w-0 flex-1 text-left"
                        onClick={() => openClub(id)}
                      >
                        <div className="truncate text-sm font-semibold text-slate-900">{c.name}</div>
                        <div className="text-[11px] text-slate-500">
                          {c.shortName}
                          {isRival ? ' · คู่แข่งหลัก' : ''}
                          {rivalIds.includes(id) ? ' · คู่อริลีก' : ''}
                        </div>
                      </button>
                      <div className="flex shrink-0 flex-col gap-1">
                        <button
                          type="button"
                          className="rounded border border-slate-300 px-2 py-1 text-[10px] font-bold text-slate-700 hover:bg-slate-50"
                          onClick={() =>
                            persist(setPrimaryRival(save, id), `ตั้ง ${c.shortName} เป็นคู่แข่งหลัก`)
                          }
                        >
                          คู่แข่ง
                        </button>
                        <button
                          type="button"
                          className="rounded border border-rose-200 px-2 py-1 text-[10px] font-bold text-rose-800 hover:bg-rose-50"
                          onClick={() =>
                            persist(toggleWatchClub(save, id), `เลิกติดตาม ${c.shortName}`)
                          }
                        >
                          เลิก
                        </button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Panel>

          <Panel title="คลับลีก 1 · เพิ่มติดตาม">
            <ul className="max-h-[28rem] space-y-1 overflow-y-auto">
              {divisionClubs.map((c) => {
                const watched = ww.watchedClubIds.includes(c.id)
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-slate-50"
                  >
                    <ClubCrest club={c} size="sm" />
                    <button
                      type="button"
                      className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800"
                      onClick={() => openClub(c.id)}
                    >
                      {c.shortName}
                      <span className="ml-2 text-[11px] tabular-nums text-slate-400">
                        rep {c.reputation}
                      </span>
                    </button>
                    <button
                      type="button"
                      className={cn(
                        'shrink-0 rounded px-2 py-1 text-[10px] font-bold',
                        watched
                          ? 'bg-slate-900 text-white'
                          : 'border border-slate-300 text-slate-700 hover:bg-slate-100',
                      )}
                      onClick={() =>
                        persist(
                          toggleWatchClub(save, c.id),
                          watched ? `เลิกติดตาม ${c.shortName}` : `ติดตาม ${c.shortName}`,
                        )
                      }
                    >
                      {watched ? 'ติดตามอยู่' : 'ติดตาม'}
                    </button>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>
      ) : null}

      {tab === 'club' ? (
        <div className="space-y-4">
          <Panel title="เลือกคลับ">
            <div className="flex flex-wrap gap-2">
              {[...new Set([...ww.watchedClubIds, ...rivalIds, ...divisionClubs.slice(0, 12).map((c) => c.id)])].map(
                (id) => {
                  const c = save.clubs.find((x) => x.id === id)
                  if (!c) return null
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setSelectedClubId(id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold',
                        selectedClubId === id
                          ? 'border-slate-900 bg-slate-900 text-white'
                          : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50',
                      )}
                    >
                      <ClubCrest club={c} size="xs" />
                      {c.shortName}
                    </button>
                  )
                },
              )}
            </div>
          </Panel>

          {snap ? (
            <>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <ClubCrest club={snap.club} size="lg" />
                  <div>
                    <h2 className="text-balance text-lg font-bold text-slate-900">{snap.club.name}</h2>
                    <p className="text-xs text-slate-500">
                      {snap.rank ? `อันดับ ${snap.rank}` : 'นอกตาราง'}
                      {snap.table
                        ? ` · ${snap.table.points} แต้ม · ${snap.table.played} นัด`
                        : ''}
                      {' · '}
                      ฟอร์ม {snap.form.length ? snap.form.join(' ') : '—'}
                    </p>
                    <p className="mt-1 text-xs tabular-nums text-slate-600">
                      งบ {formatMoney(snap.balance)} · rep {snap.club.reputation}
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-50"
                    onClick={() =>
                      persist(
                        toggleWatchClub(save, snap.club.id),
                        snap.watched
                          ? `เลิกติดตาม ${snap.club.shortName}`
                          : `ติดตาม ${snap.club.shortName}`,
                      )
                    }
                  >
                    {snap.watched ? 'เลิกติดตาม' : 'ติดตาม'}
                  </button>
                  <button
                    type="button"
                    className="rounded-md bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800"
                    onClick={() =>
                      persist(
                        setPrimaryRival(save, snap.club.id),
                        `คู่แข่งหลัก → ${snap.club.shortName}`,
                      )
                    }
                  >
                    {snap.isPrimaryRival ? 'คู่แข่งหลักอยู่แล้ว' : 'ตั้งเป็นคู่แข่งหลัก'}
                  </button>
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Panel title="สควอด (โอเวอร์ออล)">
                  <ul className="space-y-1.5">
                    {snap.squad.map((p) => (
                      <li key={p.id} className="flex items-center gap-2 text-sm">
                        <PlayerFace name={p.name} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium">{p.name}</span>
                        <span className="text-[11px] text-slate-500">{p.position}</span>
                        <span className="tabular-nums text-xs font-bold text-slate-800">{p.overall}</span>
                      </li>
                    ))}
                  </ul>
                </Panel>
                <Panel title="กิจกรรมล่าสุด">
                  {snap.activity.length === 0 ? (
                    <p className="text-sm text-slate-600">ยังไม่มีในฟีด — ติดตามแล้วเดินเวลา</p>
                  ) : (
                    <ul className="space-y-2">
                      {snap.activity.map((ev) => (
                        <li key={ev.id} className="border-b border-slate-100 pb-2 last:border-0">
                          <div className="text-sm font-semibold text-slate-900">{ev.headlineTh}</div>
                          <div className="text-xs text-pretty text-slate-600">{ev.bodyTh}</div>
                          <div className="mt-0.5 text-[11px] text-slate-400">
                            {ACTIVITY_KIND_LABEL[ev.kind]} · {ev.date}
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-600">เลือกคลับด้านบนเพื่อดูสควอด · ฟอร์ม · กิจกรรม</p>
          )}
        </div>
      ) : null}

      {tab === 'nt' ? (
        <Panel title="ทีมชาติสังเกตนักเตะ">
          {ntSorted.length === 0 ? (
            <p className="text-sm text-pretty text-slate-600">
              ยังไม่มีรายการ — หลังแมตช์เดย์ ทีมชาติจะอัปเดตความสนใจต่อดาวอายุ ≤28 OVR≥74
            </p>
          ) : (
            <ul className="space-y-3">
              {ntSorted.map((n) => {
                const p = save.players.find((x) => x.id === n.playerId)
                if (!p) return null
                const club = save.clubs.find((c) => c.id === p.clubId)
                const human = p.clubId === save.humanClubId
                return (
                  <li
                    key={`${n.playerId}-${n.nation}`}
                    className={cn(
                      'rounded-lg border px-3 py-2.5',
                      human ? 'border-sky-200 bg-sky-50/60' : 'border-slate-200 bg-white',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <PlayerFace name={p.name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-slate-900">
                          {p.name}
                          {human ? ' · ทีมคุณ' : ''}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {n.nation} · {club?.shortName ?? '—'} · OVR {p.overall}
                        </div>
                        <p className="mt-1 text-xs text-pretty text-slate-700">{n.noteTh}</p>
                      </div>
                      <div className="w-24 shrink-0">
                        <div className="mb-1 text-right text-[10px] font-bold tabular-nums text-slate-700">
                          {n.level}
                        </div>
                        <ProgressBar value={n.level} max={100} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </Panel>
      ) : null}
    </div>
  )
}
