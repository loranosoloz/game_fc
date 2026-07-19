import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  listAllPackPlayers,
  packDbStats,
  packLeagueOptions,
  type PackLeagueId,
  type PackPlayerRow,
} from '@/data/world/playerPackBrowser'
import { bioForPlayerName } from '@/data/world/playerBios'
import { fmInsideForPlayerName } from '@/data/world/fmInsidePlayers'
import { formatGbp } from '@/game/playerBio'
import { formatEur } from '@/game/fmInside'
import { formatMoney } from '@/lib/format'
import { roleLabel, roleShort } from '@/game/positions'
import { cn } from '@/lib/cn'
import { PlayerFace } from '@/components/PlayerFace'
import { PageHeader, Panel, StatTile } from '@/components/ui'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import {
  clubLabel,
  filterLivePlayers,
  listLivePlayers,
  liveDbStats,
  MOVE_KIND_LABEL,
  movesForPlayer,
  type LivePlayerRow,
  type LiveStatusFilter,
} from '@/game/playerWorldDb'

type EnrichFilter = 'all' | 'bio' | 'fm' | 'photo' | 'missing'
type DbMode = 'live' | 'pack'

export function PlayerDatabasePage() {
  const saveRaw = useGameStore((s) => s.save)
  const hasSave = Boolean(saveRaw)
  const save = saveRaw ? ensurePhase5(saveRaw) : null

  const [mode, setMode] = useState<DbMode>(hasSave ? 'live' : 'pack')

  return (
    <div className={cn('space-y-5', !hasSave && 'mx-auto max-w-6xl px-4 py-8')}>
      {!hasSave ? (
        <div className="mb-2 flex items-center justify-between gap-3">
          <Link to="/" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← กลับหน้าแรก
          </Link>
        </div>
      ) : (
        <div className="mb-2">
          <Link to="/portal" className="text-sm font-medium text-slate-600 hover:text-slate-900">
            ← กลับพอร์ทัล
          </Link>
        </div>
      )}

      <PageHeader
        title="ฐานข้อมูลนักเตะ"
        subtitle={
          mode === 'live'
            ? 'Live DB จากเซฟอาชีพ (IndexedDB) — สถานะ·คลับ·ประวัติย้ายอัปเดตตามเกม'
            : 'Pack JSON แม่แบบ — ใช้ตอนเริ่มอาชีพใหม่ · ไม่ตามย้ายในเซฟเก่า'
        }
      />

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!hasSave}
          onClick={() => setMode('live')}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-semibold',
            mode === 'live'
              ? 'border-slate-900 bg-slate-900 text-lime-300'
              : 'border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-40',
          )}
        >
          Live (อาชีพนี้)
        </button>
        <button
          type="button"
          onClick={() => setMode('pack')}
          className={cn(
            'rounded-md border px-3 py-1.5 text-sm font-semibold',
            mode === 'pack'
              ? 'border-slate-900 bg-slate-900 text-lime-300'
              : 'border-slate-300 bg-white hover:bg-slate-50',
          )}
        >
          Pack (แม่แบบ)
        </button>
      </div>

      {!hasSave && mode === 'live' ? (
        <Panel tone="warn">
          <p className="text-sm text-slate-700">
            ยังไม่มีเซฟอาชีพ — เปิดโหมด Pack หรือเริ่มอาชีพใหม่เพื่อใช้ Live DB
          </p>
        </Panel>
      ) : null}

      {mode === 'live' && save ? <LiveDbView /> : <PackDbView />}
    </div>
  )
}

function LiveDbView() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensurePhase5(saveRaw)
  const all = useMemo(() => listLivePlayers(save), [save])
  const stats = useMemo(() => liveDbStats(all), [all])

  const [clubId, setClubId] = useState('all')
  const [status, setStatus] = useState<LiveStatusFilter>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clubs = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of all) {
      if (!map.has(r.clubId)) map.set(r.clubId, r.clubName)
    }
    return [...map.entries()]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [all])

  const filtered = useMemo(
    () => filterLivePlayers(all, { q, clubId, status }),
    [all, q, clubId, status],
  )

  const selected: LivePlayerRow | null =
    filtered.find((r) => r.id === selectedId) ??
    all.find((r) => r.id === selectedId) ??
    null

  const moveLog = selected ? movesForPlayer(save, selected.id) : []

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile label="ในอาชีพนี้" value={stats.total.toLocaleString('th-TH')} accent />
        <StatTile label="พร้อม" value={String(stats.total - stats.injured - stats.banned - stats.free)} />
        <StatTile label="เจ็บ/ป่วย" value={String(stats.injured)} />
        <StatTile label="แบน" value={String(stats.banned)} />
        <StatTile label="ยืมตัว" value={String(stats.loan)} />
        <StatTile label="ขึ้นขาย/อยากย้าย" value={String(stats.listed)} hint={`ฟรีเอเยนต์ ${stats.free}`} />
      </div>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-600">สโมสร</span>
            <select
              className="min-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={clubId}
              onChange={(e) => setClubId(e.target.value)}
            >
              <option value="all">ทุกสโมสร</option>
              {clubs.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-600">สถานะ</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={status}
              onChange={(e) => setStatus(e.target.value as LiveStatusFilter)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="available">พร้อม</option>
              <option value="injured">เจ็บ/ป่วย</option>
              <option value="banned">แบน</option>
              <option value="loan">ยืมตัว</option>
              <option value="listed">ขึ้นขาย/อยากย้าย</option>
              <option value="free_agent">ฟรีเอเยนต์</option>
            </select>
          </label>
          <label className="min-w-[14rem] flex-1 grid gap-1 text-xs">
            <span className="font-medium text-slate-600">ค้นหา</span>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none ring-lime-400 focus:ring-2"
              placeholder="ชื่อ · สโมสร · สัญชาติ"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อ Live</h3>
            <p className="text-xs text-slate-500">
              อัปเดตตามย้าย/เจ็บ/แบนในเซฟ · บันทึกใน IndexedDB
            </p>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="py-2 pr-2 font-medium" />
                  <th className="py-2 pr-2 font-medium">ชื่อ</th>
                  <th className="py-2 pr-2 font-medium">อายุ</th>
                  <th className="py-2 pr-2 font-medium">OVR</th>
                  <th className="py-2 pr-2 font-medium">สโมสร</th>
                  <th className="px-3 py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 hover:bg-slate-50',
                      selectedId === r.id && 'bg-sky-50',
                    )}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-3 py-2 font-semibold" title={roleLabel(r.role)}>
                      {roleShort(r.role)}
                    </td>
                    <td className="py-2 pr-2">
                      <PlayerFace name={r.name} size="xs" />
                    </td>
                    <td className="py-2 pr-2 font-medium text-slate-900">{r.name}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.age}</td>
                    <td className="py-2 pr-2 font-semibold tabular-nums">{r.overall}</td>
                    <td className="py-2 pr-2 text-slate-700">{r.clubShort}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-xs font-medium',
                        r.statusKind === 'ok' && 'text-slate-600',
                        (r.statusKind === 'injured' || r.statusKind === 'ill') && 'text-rose-700',
                        r.statusKind === 'banned' && 'text-amber-800',
                        r.statusKind === 'loan' && 'text-sky-800',
                        (r.statusKind === 'listed' || r.statusKind === 'free') && 'text-violet-800',
                      )}
                    >
                      {r.statusLabel}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-sm text-slate-500">
                      ไม่พบนักเตะตามตัวกรอง
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          {!selected ? (
            <p className="text-sm text-slate-500">เลือกนักเตะเพื่อดูสถานะสด + ประวัติย้าย</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <PlayerFace name={selected.name} size="md" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-sm text-slate-600">
                    {roleLabel(selected.role)} · อายุ {selected.age} · OVR {selected.overall} · CA{' '}
                    {selected.ca}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selected.clubName} · {selected.nationality}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">สถานะ</dt>
                  <dd className="font-semibold">{selected.statusLabel}</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">สัญญา</dt>
                  <dd className="font-semibold">
                    {selected.contractYears} ปี · {formatMoney(selected.wage)}/wk
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">สภาพ</dt>
                  <dd className="font-semibold">
                    Cond {selected.player.condition} · Form {selected.player.form}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">มู้ด</dt>
                  <dd className="font-semibold">
                    {selected.player.morale}/20 · Happy {selected.player.happiness}/20
                  </dd>
                </div>
              </dl>

              <div>
                <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
                  ประวัติย้ายในอาชีพนี้
                </h4>
                {moveLog.length === 0 ? (
                  <p className="mt-1 text-sm text-slate-500">
                    ยังไม่มีบันทึกย้ายหลังเปิดระบบนี้ (ย้ายใหม่จะโชว์ที่นี่)
                  </p>
                ) : (
                  <ul className="mt-2 max-h-48 space-y-1.5 overflow-y-auto text-xs text-slate-700">
                    {moveLog.map((m) => {
                      const from = clubLabel(save.clubs, m.fromClubId).short
                      const to = clubLabel(save.clubs, m.toClubId).short
                      return (
                        <li key={m.id} className="rounded-md bg-slate-50 px-2 py-1.5">
                          <span className="font-semibold">
                            S{m.season} MD{m.matchday}
                          </span>{' '}
                          · {MOVE_KIND_LABEL[m.kind]} · {from} → {to}
                          {m.fee != null && m.fee > 0 ? ` · ${formatMoney(m.fee)}` : ''}
                          {m.note ? ` · ${m.note}` : ''}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}

function PackDbView() {
  const all = useMemo(() => listAllPackPlayers(), [])
  const stats = useMemo(() => packDbStats(all), [all])
  const leagues = packLeagueOptions()

  const [league, setLeague] = useState<PackLeagueId | 'all'>('all')
  const [clubKey, setClubKey] = useState<string>('all')
  const [q, setQ] = useState('')
  const [enrich, setEnrich] = useState<EnrichFilter>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clubsInLeague = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of all) {
      if (league !== 'all' && r.leagueId !== league) continue
      if (!map.has(r.clubKey)) map.set(r.clubKey, r.clubName)
    }
    return [...map.entries()]
      .map(([key, name]) => ({ key, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [all, league])

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((r) => {
      if (league !== 'all' && r.leagueId !== league) return false
      if (clubKey !== 'all' && r.clubKey !== clubKey) return false
      if (enrich === 'bio' && !r.hasBio) return false
      if (enrich === 'fm' && !r.hasFmInside) return false
      if (enrich === 'photo' && !r.hasPhoto) return false
      if (enrich === 'missing' && r.hasBio && r.hasFmInside && r.hasPhoto) return false
      if (!needle) return true
      return (
        r.name.toLowerCase().includes(needle) ||
        r.clubName.toLowerCase().includes(needle) ||
        r.clubShort.toLowerCase().includes(needle) ||
        (r.nationality ?? '').toLowerCase().includes(needle) ||
        (r.fmPos ?? '').toLowerCase().includes(needle)
      )
    })
  }, [all, league, clubKey, q, enrich])

  const selected: PackPlayerRow | null =
    filtered.find((r) => r.id === selectedId) ??
    all.find((r) => r.id === selectedId) ??
    null
  const bio = selected ? bioForPlayerName(selected.name) : null
  const fm = selected ? fmInsideForPlayerName(selected.name) : null

  const leagueStatusHint = (id: PackLeagueId) => {
    const s = stats.byLeague[id]
    if (!s?.players) return '—'
    return `รูป ${s.withPhoto}/${s.players} · FM ${s.withFm}/${s.players}`
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <StatTile label="ทั้งหมดใน pack" value={stats.total.toLocaleString('th-TH')} accent />
        <StatTile label="มีรูป" value={`${stats.withPhoto}`} hint={`${Math.round((stats.withPhoto / Math.max(1, stats.total)) * 100)}%`} />
        <StatTile label="มี FM" value={`${stats.withFm}`} />
        <StatTile label="มี Bio" value={`${stats.withBio}`} />
        {(
          [
            ['eng', 'Premier League'],
            ['eng2', 'Championship'],
            ['esp', 'La Liga'],
            ['esp2', 'LaLiga2'],
            ['ger', 'Bundesliga'],
            ['ger2', '2. Bundesliga'],
            ['fra', 'Ligue 1'],
            ['fra2', 'Ligue 2'],
            ['ita', 'Serie A'],
            ['ita2', 'Serie B'],
            ['tha', 'ไทยลีก 1'],
            ['tha2', 'ไทยลีก 2'],
          ] as const
        ).map(([id, label]) => (
          <StatTile
            key={id}
            label={label}
            value={stats.byLeague[id]?.players ?? 0}
            hint={leagueStatusHint(id)}
          />
        ))}
      </div>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-600">ลีก</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={league}
              onChange={(e) => {
                setLeague(e.target.value as PackLeagueId | 'all')
                setClubKey('all')
              }}
            >
              <option value="all">ทุกลีกที่มี pack</option>
              {leagues.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-600">สโมสร</span>
            <select
              className="min-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={clubKey}
              onChange={(e) => setClubKey(e.target.value)}
            >
              <option value="all">ทุกสโมสร</option>
              {clubsInLeague.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1 text-xs">
            <span className="font-medium text-slate-600">ข้อมูลเสริม</span>
            <select
              className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
              value={enrich}
              onChange={(e) => setEnrich(e.target.value as EnrichFilter)}
            >
              <option value="all">ทั้งหมด</option>
              <option value="photo">มีรูป</option>
              <option value="bio">มี Bio</option>
              <option value="fm">มี FMInside</option>
              <option value="missing">ยังขาดรูป / Bio / FM</option>
            </select>
          </label>
          <label className="min-w-[14rem] flex-1 grid gap-1 text-xs">
            <span className="font-medium text-slate-600">ค้นหา</span>
            <input
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm outline-none ring-lime-400 focus:ring-2"
              placeholder="ชื่อ · สโมสร · สัญชาติ · ตำแหน่ง"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </label>
        </div>
      </Panel>

      <div className="grid gap-5 lg:grid-cols-[1.45fr_1fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อใน pack</h3>
            <p className="text-xs text-slate-500">คลิกแถวเพื่อดู Bio / FMInside</p>
          </div>
          <div className="max-h-[70vh] overflow-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2 font-medium">Pos</th>
                  <th className="py-2 pr-2 font-medium" />
                  <th className="py-2 pr-2 font-medium">ชื่อ</th>
                  <th className="py-2 pr-2 font-medium">อายุ</th>
                  <th className="py-2 pr-2 font-medium">OVR</th>
                  <th className="py-2 pr-2 font-medium">สโมสร</th>
                  <th className="py-2 pr-2 font-medium">ลีก</th>
                  <th className="px-3 py-2 font-medium">แพ็ก</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.id}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 hover:bg-slate-50',
                      selectedId === r.id && 'bg-sky-50',
                    )}
                    onClick={() => setSelectedId(r.id)}
                  >
                    <td className="px-3 py-2 font-semibold" title={roleLabel(r.role)}>
                      {roleShort(r.role)}
                    </td>
                    <td className="py-2 pr-2">
                      <PlayerFace name={r.name} size="xs" />
                    </td>
                    <td className="py-2 pr-2 font-medium text-slate-900">{r.name}</td>
                    <td className="py-2 pr-2 tabular-nums">{r.age}</td>
                    <td className="py-2 pr-2 font-semibold tabular-nums">{r.ovr}</td>
                    <td className="py-2 pr-2 text-slate-700">{r.clubShort}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{r.leagueId.toUpperCase()}</td>
                    <td className="px-3 py-2 text-[10px] font-semibold tracking-wide">
                      <span className={r.hasPhoto ? 'text-violet-800' : 'text-slate-300'}>PIC</span>
                      <span className="mx-1 text-slate-200">·</span>
                      <span className={r.hasBio ? 'text-lime-800' : 'text-slate-300'}>BIO</span>
                      <span className="mx-1 text-slate-200">·</span>
                      <span className={r.hasFmInside ? 'text-sky-800' : 'text-slate-300'}>FM</span>
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-500">
                      ไม่พบนักเตะตามตัวกรอง
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          {!selected ? (
            <p className="text-sm text-slate-500">เลือกนักเตะจากตารางเพื่อดูรายละเอียด pack</p>
          ) : (
            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <PlayerFace name={selected.name} size="md" />
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selected.name}</h3>
                  <p className="text-sm text-slate-600">
                    {roleLabel(selected.role)} · อายุ {selected.age} · OVR {selected.ovr}
                  </p>
                  <p className="text-xs text-slate-500">
                    {selected.clubName} · {selected.leagueLabel}
                  </p>
                </div>
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">รูป</dt>
                  <dd className={selected.hasPhoto ? 'font-medium text-violet-800' : 'font-medium text-amber-800'}>
                    {selected.hasPhoto ? 'มี' : 'ยังไม่มี'}
                  </dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">FM Pos</dt>
                  <dd className="font-medium">{selected.fmPos ?? '—'}</dd>
                </div>
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">สัญชาติ</dt>
                  <dd className="font-medium">{selected.nationality ?? '—'}</dd>
                </div>
              </dl>

              <div>
                <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Bio pack</h4>
                {!bio ? (
                  <p className="mt-1 text-sm text-amber-800">ยังไม่มีใน playerBiosEng.json</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    <li>ค่าตัว {formatGbp(bio.valueGbp)} · ค่าเหนื่อย {formatGbp(bio.wageWeeklyGbp)}/wk</li>
                    <li>สัญญาถึง {bio.contractExpires ?? '—'}</li>
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">FMInside</h4>
                {!fm ? (
                  <p className="mt-1 text-sm text-amber-800">ยังไม่มีใน fmInsideAttrs.json</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-sm text-slate-700">
                    <li>
                      Rating {fm.rating ?? '—'} · Potential {fm.potential ?? '—'}
                    </li>
                    <li>
                      มูลค่า {formatEur(fm.sellValueEur)} · ค่าเหนื่อย {formatEur(fm.wageEurPw)}/wk
                    </li>
                  </ul>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
