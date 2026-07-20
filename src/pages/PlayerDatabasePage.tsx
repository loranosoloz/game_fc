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
import { formatMoney, formatCoachStat, coachStatTo20 } from '@/lib/format'
import { roleLabel, roleShort } from '@/game/positions'
import { attributesDb, personalitiesDb } from '@/game/attributes'
import { BODY_PART_LABEL } from '@/game/bodyMap'
import { formatBanStatus } from '@/game/discipline'
import { formatIllnessStatus, ILLNESS_TYPE_LABEL } from '@/game/illness'
import { INJURY_TYPE_LABEL, TREATMENT_LABEL } from '@/game/medical'
import { ensurePlayerSkills, skillDescription, skillLabel } from '@/game/playerSkills'
import {
  allWorldCoaches,
  coachBlurb,
  getCoachCareer,
  solveLabelTh,
  styleLabelTh,
  type WorldCoach,
} from '@/game/worldCoaches'
import { skillForRole } from '@/game/staff'
import { formationLabel, type GameSave, type Player, type StaffPerson, type StaffRole } from '@/game/types'
import { cn } from '@/lib/cn'
import { PlayerFace } from '@/components/PlayerFace'
import { CoachFace } from '@/components/CoachFace'
import { CoachCareerTimeline } from '@/components/CoachCareerTimeline'
import { ClubCrest } from '@/components/ClubCrest'
import { PlayerCareerHistory } from '@/components/PlayerCareerHistory'
import { Panel, StatTile } from '@/components/ui'
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
import {
  FilterSelect,
  IconBriefcase,
  IconBuilding,
  IconDatabase,
  IconLayers,
  IconLive,
  IconPackage,
  IconStatus,
  IconUsers,
  IconWhistle,
  SearchField,
} from '@/components/browse/BrowseUi'

type EnrichFilter = 'all' | 'bio' | 'fm' | 'photo' | 'missing'
type PlayerDbMode = 'live' | 'pack'
type EntityTab = 'players' | 'coaches' | 'staff'

const ROLE_TH: Record<StaffRole, string> = {
  coach: 'ผู้ช่วยผู้จัดการ',
  attacking: 'โค้ชฝึกกองหน้า',
  defending: 'โค้ชฝึกกองหลัง',
  fitness: 'โค้ชฟิตเนส',
  scout: 'สเกาต์',
  physio: 'แพทย์',
}

const ATTR_META = attributesDb.attributes as { key: keyof Player['attrs']; group: string }[]
const ATTR_GROUPS = attributesDb.groups as { id: string; labelTh: string }[]
const GROWTH_KEYS = (attributesDb.growth as { key: keyof Player['growth'] }[]).map((g) => g.key)
const HIDDEN_KEYS = (attributesDb.hidden as { key: keyof Player['hidden'] }[]).map((h) => h.key)

function StatusBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
        <span className="block h-full rounded bg-slate-700" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-10 text-right font-medium tabular-nums">
        {max === 100 ? String(value) : `${value}/${max}`}
      </span>
    </li>
  )
}

function coachPosting(
  save: GameSave | null,
  coachId: string,
): { kind: 'club' | 'nt' | 'free'; label: string } {
  if (!save) return { kind: 'free', label: '—' }
  const club = save.clubs.find((c) => c.coachId === coachId)
  if (club) {
    return { kind: 'club', label: club.shortName || club.name }
  }
  const assoc = Object.values(save.associations ?? {}).find((a) => a.coachId === coachId)
  if (assoc) {
    return { kind: 'nt', label: `ทีมชาติ ${assoc.nameTh}` }
  }
  return { kind: 'free', label: 'ว่างงาน' }
}

function crestClubFromLive(save: GameSave, clubId: string) {
  if (clubId === '__free__') {
    return { name: 'ฟรีเอเยนต์', shortName: 'FREE', color: '#64748b', crestKey: null }
  }
  const c = save.clubs.find((x) => x.id === clubId)
  if (!c) return { name: clubId, shortName: '?', color: '#64748b', crestKey: null }
  return {
    name: c.name,
    shortName: c.shortName,
    color: c.color,
    crestKey: c.crestKey ?? null,
  }
}

function crestClubFromPack(row: Pick<PackPlayerRow, 'clubName' | 'clubShort' | 'clubKey'>) {
  return {
    name: row.clubName,
    shortName: row.clubShort,
    color: '#1e293b',
    crestKey: row.clubKey,
  }
}

export function PlayerDatabasePage() {
  const saveRaw = useGameStore((s) => s.save)
  const hasSave = Boolean(saveRaw)
  const save = saveRaw ? ensurePhase5(saveRaw) : null

  const [entity, setEntity] = useState<EntityTab>('players')
  const [mode, setMode] = useState<PlayerDbMode>(hasSave ? 'live' : 'pack')

  const subtitle =
    entity === 'coaches'
      ? 'โค้ชโลก — พลัง · สไตล์ · ตำแหน่งงานในอาชีพ'
      : entity === 'staff'
        ? 'สตาฟในพูลอาชีพ — โค้ช / สเกาต์ / แพทย์'
        : mode === 'live'
          ? 'Live DB จากเซฟอาชีพ — สถานะ · ค่าพลัง · ประวัติอาชีพจริง'
          : 'Pack JSON แม่แบบ — Bio / FM / ประวัติอาชีพจริง'

  return (
    <div className="flex min-h-dvh w-full flex-col bg-slate-100">
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-900 text-slate-100 shadow-md">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 lg:px-6">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-md bg-lime-400/15 text-lime-300">
              <IconDatabase className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <h1 className="text-sm font-bold tracking-tight text-balance md:text-base">
                  ฐานข้อมูล
                </h1>
                <span className="text-[10px] font-bold tracking-[0.14em] text-lime-300/90 uppercase">
                  FC Manager
                </span>
              </div>
              <p className="truncate text-[11px] text-slate-400">{subtitle}</p>
            </div>
          </div>

          <nav className="flex flex-1 flex-wrap items-center gap-1" aria-label="หมวดฐานข้อมูล">
            {(
              [
                ['players', 'นักเตะ', IconUsers],
                ['coaches', 'โค้ชโลก', IconWhistle],
                ['staff', 'สตาฟ', IconBriefcase],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setEntity(id)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
                  entity === id
                    ? 'bg-lime-400 text-slate-950'
                    : 'text-slate-300 hover:bg-slate-800 hover:text-white',
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </nav>

          <Link
            to={hasSave ? '/portal' : '/'}
            className="rounded-md border border-slate-600 px-2.5 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            {hasSave ? '← กลับเกม' : '← หน้าแรก'}
          </Link>
        </div>

        {entity === 'players' ? (
          <div className="flex flex-wrap items-center gap-1 border-t border-slate-800 bg-slate-950/50 px-4 py-1.5 lg:px-6">
            <button
              type="button"
              disabled={!hasSave}
              onClick={() => setMode('live')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold',
                mode === 'live'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100 disabled:opacity-40',
              )}
            >
              <IconLive className="size-3.5" />
              Live (อาชีพนี้)
            </button>
            <button
              type="button"
              onClick={() => setMode('pack')}
              className={cn(
                'inline-flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-semibold',
                mode === 'pack'
                  ? 'bg-slate-100 text-slate-900'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100',
              )}
            >
              <IconPackage className="size-3.5" />
              Pack (แม่แบบ)
            </button>
          </div>
        ) : null}
      </header>

      <div className="mx-auto w-full max-w-[1800px] flex-1 space-y-4 px-4 py-4 lg:px-6 lg:py-5">
        {entity === 'players' ? (
          <>
            {!hasSave && mode === 'live' ? (
              <Panel tone="warn">
                <p className="text-sm text-slate-700">
                  ยังไม่มีเซฟอาชีพ — เปิดโหมด Pack หรือเริ่มอาชีพใหม่เพื่อใช้ Live DB
                </p>
              </Panel>
            ) : null}

            {mode === 'live' && save ? <LiveDbView /> : <PackDbView />}
          </>
        ) : null}

        {entity === 'coaches' ? <CoachesDbView save={save} /> : null}
        {entity === 'staff' ? <StaffDbView save={save} /> : null}
      </div>
    </div>
  )
}

function LivePlayerDetail({
  selected,
  save,
}: {
  selected: LivePlayerRow
  save: GameSave
}) {
  const p = selected.player
  const persona =
    personalitiesDb.archetypes.find((a) => a.id === p.personalityId)?.label ?? p.personalityId
  const ban = formatBanStatus(p)
  const skills = ensurePlayerSkills(p)
  const moveLog = movesForPlayer(save, selected.id)
  const fm = p.fmInside ?? fmInsideForPlayerName(p.name)
  const club = crestClubFromLive(save, selected.clubId)

  return (
    <div className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <div className="flex items-start gap-3">
        <PlayerFace name={selected.name} size="md" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-bold text-balance text-slate-900">{selected.name}</h3>
          <p className="text-sm text-slate-600">
            {roleLabel(selected.role)} · อายุ {selected.age} · OVR {selected.overall} · CA{' '}
            {selected.ca} · PA {p.pa}
          </p>
          <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <ClubCrest club={club} size="xs" />
            <span>
              {selected.clubName} · {selected.nationality} · {persona}
            </span>
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-3">
        <PlayerCareerHistory playerName={selected.name} playerAge={selected.age} />
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
      </dl>

      {ban ? (
        <p className="rounded bg-amber-50 px-2 py-1.5 text-xs font-semibold text-amber-900">{ban}</p>
      ) : null}

      <div>
        <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Status</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Condition" value={p.condition} max={100} />
          <StatusBar label="Sharpness" value={p.sharpness} max={100} />
          <StatusBar label="Form" value={p.form} />
          <StatusBar label="Morale" value={p.morale} />
          <StatusBar label="Happiness" value={p.happiness ?? p.morale} />
          <StatusBar label="Media" value={p.mediaHandling ?? 10} />
        </ul>
        {p.injuryDays > 0 ? (
          <p className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
            เจ็บ: {p.injuryType ? INJURY_TYPE_LABEL[p.injuryType] : '—'}
            {p.injuryBodyPart ? ` · ${BODY_PART_LABEL[p.injuryBodyPart]}` : ''} · {p.injuryDays} วัน ·
            รักษา {p.treatment ? TREATMENT_LABEL[p.treatment] : '—'}
          </p>
        ) : (p.illnessDays ?? 0) > 0 ? (
          <p className="mt-2 rounded bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
            ป่วย: {p.illnessType ? ILLNESS_TYPE_LABEL[p.illnessType] : '—'} · {p.illnessDays} วัน
            {formatIllnessStatus(p) ? ` · ${formatIllnessStatus(p)}` : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs text-emerald-700">พร้อมลงแข่ง · condition {p.condition}%</p>
        )}
      </div>

      {ATTR_GROUPS.map((group) => {
        const rows = ATTR_META.filter((a) => a.group === group.id)
        if (rows.length === 0) return null
        if (group.id === 'goalkeeping' && p.role !== 'GK') return null
        return (
          <div key={group.id}>
            <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
              {group.labelTh} (1–99)
            </h4>
            <ul className="mt-1.5 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs sm:grid-cols-3">
              {rows.map((row) => (
                <li key={row.key} className="flex justify-between gap-2">
                  <span className="truncate text-slate-500">{row.key}</span>
                  <span className="font-semibold tabular-nums">{p.attrs[row.key]}</span>
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      <div className="grid grid-cols-2 gap-3">
        <div>
          <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Growth</h4>
          <ul className="mt-1 space-y-0.5 text-xs">
            {GROWTH_KEYS.map((k) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold tabular-nums">{p.growth[k]}/20</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Hidden</h4>
          <ul className="mt-1 space-y-0.5 text-xs">
            {HIDDEN_KEYS.map((k) => (
              <li key={k} className="flex justify-between gap-2">
                <span className="text-slate-500">{k}</span>
                <span className="font-semibold tabular-nums">{p.hidden[k]}/20</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {skills.length > 0 ? (
        <div>
          <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            พลังแฝง ({skills.length}/10)
          </h4>
          <ul className="mt-1.5 flex flex-wrap gap-1">
            {skills.map((id) => (
              <li
                key={id}
                className="rounded border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-900"
                title={skillDescription(id)}
              >
                {skillLabel(id)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {fm ? (
        <div>
          <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">FMInside</h4>
          <p className="mt-1 text-xs text-slate-700">
            Rating {fm.rating ?? '—'} · Potential {fm.potential ?? '—'}
            {fm.sellValueEur != null ? ` · ${formatEur(fm.sellValueEur)}` : ''}
          </p>
        </div>
      ) : null}

      <div>
        <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">
          ประวัติย้ายในอาชีพนี้
        </h4>
        {moveLog.length === 0 ? (
          <p className="mt-1 text-sm text-slate-500">ยังไม่มีบันทึกย้ายหลังเปิดระบบนี้</p>
        ) : (
          <ul className="mt-2 max-h-36 space-y-1.5 overflow-y-auto text-xs text-slate-700">
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
          <FilterSelect
            label="สโมสร"
            icon={<IconBuilding />}
            className="min-w-[14rem]"
            value={clubId}
            onChange={(e) => setClubId(e.target.value)}
          >
            <option value="all">ทุกสโมสร</option>
            {clubs.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="สถานะ"
            icon={<IconStatus />}
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
          </FilterSelect>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="ชื่อ · สโมสร · สัญชาติ"
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อ Live</h3>
            <p className="text-xs text-slate-500">คลิกเพื่อดูประวัติอาชีพ + สถานะ + ค่าพลัง</p>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
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
                {filtered.map((r) => {
                  const club = crestClubFromLive(save, r.clubId)
                  return (
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
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <ClubCrest club={club} size="xs" />
                          <span className="truncate">{r.clubShort}</span>
                        </span>
                      </td>
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
                  )
                })}
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
            <p className="text-sm text-slate-500">เลือกนักเตะเพื่อดูประวัติอาชีพ + สถานะ + ค่าพลัง</p>
          ) : (
            <LivePlayerDetail selected={selected} save={save} />
          )}
        </Panel>
      </div>
    </>
  )
}

function CoachDetail({ coach, save }: { coach: WorldCoach; save: GameSave | null }) {
  const posting = coachPosting(save, coach.id)
  const career = getCoachCareer(coach.id)

  return (
    <div className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <div className="flex items-start gap-3">
        <CoachFace coachId={coach.id} name={coach.name} size="lg" className="ring-2 ring-slate-200" />
        <div>
          <h3 className="text-lg font-bold text-slate-900">{coach.name}</h3>
          <p className="text-sm text-slate-600">
            พลัง {formatCoachStat(coach.power)} · {coach.nationTh} · {coach.tier}
          </p>
          <p className="text-xs text-slate-500">
            {posting.label}
            {posting.kind === 'free' && save ? ' · ว่างงาน' : ''}
          </p>
        </div>
      </div>

      <p className="text-sm text-slate-700">{coachBlurb(coach)}</p>

      <div>
        <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">ค่าพลังโค้ช</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Power" value={coachStatTo20(coach.power)} max={20} />
          <StatusBar label="Attack IQ" value={coachStatTo20(coach.attackingIQ)} max={20} />
          <StatusBar label="Defend IQ" value={coachStatTo20(coach.defendingIQ)} max={20} />
          <StatusBar label="Man Mgmt" value={coachStatTo20(coach.manManagement)} max={20} />
          <StatusBar label="Adapt" value={coachStatTo20(coach.adaptability)} max={20} />
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">สไตล์</dt>
          <dd className="font-semibold">{coach.styleLabelTh}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">แผนถนัด</dt>
          <dd className="font-semibold">{formationLabel(coach.preferredFormation, true)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">OOP</dt>
          <dd className="font-semibold">{formationLabel(coach.formationOop, true)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">กดดัน</dt>
          <dd className="font-semibold">{coach.pressing}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ค่าเหนื่อย</dt>
          <dd className="font-semibold">{formatMoney(coach.wageWeekly)}/wk</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ค่าจ้าง</dt>
          <dd className="font-semibold">{formatMoney(coach.hireFee)}</dd>
        </div>
      </dl>

      <p className="text-xs text-slate-600">
        แก้เกม: {coach.solveGame.map(solveLabelTh).join(' · ') || '—'}
      </p>
      <p className="text-xs text-emerald-800">
        ถนัดชนะ: {coach.strongVs.map(styleLabelTh).join(', ') || '—'}
      </p>
      <p className="text-xs text-rose-800">
        ไม่ถนัด: {coach.weakVs.map(styleLabelTh).join(', ') || '—'}
      </p>

      {career ? <CoachCareerTimeline coach={coach} compact /> : null}
    </div>
  )
}

function CoachesDbView({ save }: { save: GameSave | null }) {
  const all = useMemo(() => allWorldCoaches().slice().sort((a, b) => b.power - a.power), [])
  const [q, setQ] = useState('')
  const [posting, setPosting] = useState<'all' | 'club' | 'nt' | 'free'>('all')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all
      .map((c) => ({ coach: c, post: coachPosting(save, c.id) }))
      .filter(({ coach: c, post }) => {
        if (posting !== 'all' && post.kind !== posting) return false
        if (!needle) return true
        return (
          c.name.toLowerCase().includes(needle) ||
          c.nationTh.toLowerCase().includes(needle) ||
          c.nation.toLowerCase().includes(needle) ||
          c.styleLabelTh.toLowerCase().includes(needle) ||
          post.label.toLowerCase().includes(needle) ||
          c.tier.toLowerCase().includes(needle)
        )
      })
  }, [all, q, posting, save])

  const selected = rows.find((r) => r.coach.id === selectedId)?.coach ??
    all.find((c) => c.id === selectedId) ??
    null

  const stats = useMemo(() => {
    let club = 0
    let nt = 0
    let free = 0
    for (const c of all) {
      const p = coachPosting(save, c.id)
      if (p.kind === 'club') club++
      else if (p.kind === 'nt') nt++
      else free++
    }
    return { total: all.length, club, nt, free }
  }, [all, save])

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="โค้ชทั้งหมด" value={String(stats.total)} accent />
        <StatTile label="คุมคลับ" value={String(stats.club)} />
        <StatTile label="ทีมชาติ" value={String(stats.nt)} />
        <StatTile label="ว่างงาน" value={String(stats.free)} />
      </div>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="ตำแหน่งงาน"
            icon={<IconBriefcase />}
            value={posting}
            onChange={(e) => setPosting(e.target.value as typeof posting)}
            disabled={!save}
          >
            <option value="all">ทั้งหมด</option>
            <option value="club">คุมคลับ</option>
            <option value="nt">ทีมชาติ</option>
            <option value="free">ว่างงาน</option>
          </FilterSelect>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="ชื่อ · สัญชาติ · สไตล์ · คลับ"
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อโค้ชโลก</h3>
            <p className="text-xs text-slate-500">คลิกเพื่อดูค่าพลัง · สไตล์ · ประวัติงาน</p>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <th className="py-2 pr-2 pl-3 font-medium" />
                  <th className="py-2 pr-2 font-medium">ชื่อ</th>
                  <th className="py-2 pr-2 font-medium">พลัง</th>
                  <th className="py-2 pr-2 font-medium">สไตล์</th>
                  <th className="py-2 pr-2 font-medium">ชาติ</th>
                  <th className="px-3 py-2 font-medium">งาน</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ coach: c, post }) => (
                  <tr
                    key={c.id}
                    className={cn(
                      'cursor-pointer border-b border-slate-100 hover:bg-slate-50',
                      selectedId === c.id && 'bg-sky-50',
                    )}
                    onClick={() => setSelectedId(c.id)}
                  >
                    <td className="py-2 pr-2 pl-3">
                      <CoachFace coachId={c.id} name={c.name} size="xs" />
                    </td>
                    <td className="py-2 pr-2 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2 pr-2 font-semibold tabular-nums">{formatCoachStat(c.power)}</td>
                    <td className="py-2 pr-2 text-slate-700">{c.styleLabelTh}</td>
                    <td className="py-2 pr-2 text-xs text-slate-500">{c.nationTh}</td>
                    <td
                      className={cn(
                        'px-3 py-2 text-xs font-medium',
                        post.kind === 'free' && 'text-violet-800',
                        post.kind === 'nt' && 'text-amber-800',
                        post.kind === 'club' && 'text-sky-800',
                      )}
                    >
                      {post.label}
                    </td>
                  </tr>
                ))}
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      ไม่พบโค้ชตามตัวกรอง
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          {!selected ? (
            <p className="text-sm text-slate-500">เลือกโค้ชเพื่อดูค่าพลังและสไตล์</p>
          ) : (
            <CoachDetail coach={selected} save={save} />
          )}
        </Panel>
      </div>
    </>
  )
}

function StaffDetail({
  person,
  clubName,
}: {
  person: StaffPerson
  clubName: string
}) {
  const skill = skillForRole(person, person.role)

  return (
    <div className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
      <div>
        <h3 className="text-lg font-bold text-slate-900">{person.name}</h3>
        <p className="text-sm text-slate-600">
          {ROLE_TH[person.role]} · อายุ {person.age} · ทักษะหลัก {skill}/20 · ชื่อเสียง{' '}
          {person.reputation}
        </p>
        <p className="text-xs text-slate-500">
          {clubName}
          {person.origin === 'ex_player' && person.formerPlayerName
            ? ` · อดีตนักเตะ ${person.formerPlayerName}`
            : ''}
        </p>
      </div>

      <div>
        <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">Status</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Energy" value={person.energy} max={100} />
          <StatusBar label="Morale" value={person.morale} />
          <StatusBar label="Pro" value={person.professionalism} />
          <StatusBar label="Ambition" value={person.ambition} />
          <StatusBar label="Det" value={person.determination} />
        </ul>
      </div>

      <div>
        <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">ทักษะสายงาน</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Coach" value={person.coachSkill} />
          <StatusBar label="Attack" value={person.attackSkill ?? person.coachSkill} />
          <StatusBar label="Defend" value={person.defendSkill ?? person.coachSkill} />
          <StatusBar label="Fitness" value={person.fitnessSkill ?? person.coachSkill} />
          <StatusBar label="Scout" value={person.scoutSkill} />
          <StatusBar label="Physio" value={person.physioSkill} />
        </ul>
      </div>

      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ค่าเหนื่อย</dt>
          <dd className="font-semibold">{formatMoney(person.wageWeekly)}/wk</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ค่าจ้าง</dt>
          <dd className="font-semibold">{formatMoney(person.hireFee)}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ปีในบทบาท</dt>
          <dd className="font-semibold">{person.yearsInRole}</dd>
        </div>
        <div className="rounded-md bg-slate-50 px-2 py-1.5">
          <dt className="text-slate-500">ที่มา</dt>
          <dd className="font-semibold">
            {person.origin === 'ex_player' ? 'อดีตนักเตะ' : 'สายอาชีพ'}
          </dd>
        </div>
      </dl>
    </div>
  )
}

function StaffDbView({ save }: { save: GameSave | null }) {
  const pool = save?.staff?.pool ?? []
  const [role, setRole] = useState<StaffRole | 'all'>('all')
  const [clubFilter, setClubFilter] = useState<'all' | 'free' | 'employed'>('all')
  const [q, setQ] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const clubNameOf = (clubId: string | null) => {
    if (!clubId || !save) return 'ว่างงาน'
    const c = save.clubs.find((x) => x.id === clubId)
    return c ? c.shortName || c.name : clubId
  }

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return pool.filter((p) => {
      if (role !== 'all' && p.role !== role) return false
      if (clubFilter === 'free' && p.clubId) return false
      if (clubFilter === 'employed' && !p.clubId) return false
      if (!needle) return true
      const club = clubNameOf(p.clubId).toLowerCase()
      return (
        p.name.toLowerCase().includes(needle) ||
        club.includes(needle) ||
        ROLE_TH[p.role].includes(needle) ||
        (p.formerPlayerName ?? '').toLowerCase().includes(needle)
      )
    })
  }, [pool, role, clubFilter, q, save])

  const selected = filtered.find((p) => p.id === selectedId) ?? pool.find((p) => p.id === selectedId) ?? null

  const stats = useMemo(() => {
    const byRole: Record<StaffRole, number> = {
      coach: 0,
      attacking: 0,
      defending: 0,
      fitness: 0,
      scout: 0,
      physio: 0,
    }
    let free = 0
    for (const p of pool) {
      byRole[p.role]++
      if (!p.clubId) free++
    }
    return {
      total: pool.length,
      ...byRole,
      free,
      employed: pool.length - free,
      coaches: byRole.coach + byRole.attacking + byRole.defending + byRole.fitness,
    }
  }, [pool])

  if (!save) {
    return (
      <Panel tone="warn">
        <p className="text-sm text-slate-700">
          สตาฟอยู่ในเซฟอาชีพ — เริ่มอาชีพใหม่หรือโหลดเซฟเพื่อดูพูลทีมงาน
        </p>
      </Panel>
    )
  }

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatTile label="ในพูล" value={String(stats.total)} accent />
        <StatTile label="โค้ชซ้อม" value={String(stats.coaches)} />
        <StatTile label="สเกาต์" value={String(stats.scout)} />
        <StatTile label="แพทย์" value={String(stats.physio)} />
        <StatTile label="ว่างงาน" value={String(stats.free)} hint={`มีงาน ${stats.employed}`} />
      </div>

      <Panel>
        <div className="flex flex-wrap gap-3">
          <FilterSelect
            label="บทบาท"
            icon={<IconWhistle />}
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="coach">ผู้ช่วยผู้จัดการ</option>
            <option value="attacking">โค้ชฝึกกองหน้า</option>
            <option value="defending">โค้ชฝึกกองหลัง</option>
            <option value="fitness">โค้ชฟิตเนส</option>
            <option value="scout">สเกาต์</option>
            <option value="physio">แพทย์</option>
          </FilterSelect>
          <FilterSelect
            label="งาน"
            icon={<IconBuilding />}
            value={clubFilter}
            onChange={(e) => setClubFilter(e.target.value as typeof clubFilter)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="employed">มีสโมสร</option>
            <option value="free">ว่างงาน</option>
          </FilterSelect>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="ชื่อ · สโมสร · บทบาท"
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อสตาฟ</h3>
            <p className="text-xs text-slate-500">คลิกเพื่อดูสถานะและทักษะ</p>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            <table className="w-full min-w-[720px] border-collapse text-left text-sm">
              <thead className="sticky top-0 bg-white shadow-sm">
                <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                  <th className="px-3 py-2 font-medium">บทบาท</th>
                  <th className="py-2 pr-2 font-medium">ชื่อ</th>
                  <th className="py-2 pr-2 font-medium">อายุ</th>
                  <th className="py-2 pr-2 font-medium">สกิล</th>
                  <th className="py-2 pr-2 font-medium">สโมสร</th>
                  <th className="px-3 py-2 font-medium">มู้ด</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => {
                  const skill = skillForRole(p, p.role)
                  const club =
                    p.clubId && save
                      ? crestClubFromLive(save, p.clubId)
                      : { name: 'ว่างงาน', shortName: 'FREE', color: '#64748b', crestKey: null }
                  return (
                    <tr
                      key={p.id}
                      className={cn(
                        'cursor-pointer border-b border-slate-100 hover:bg-slate-50',
                        selectedId === p.id && 'bg-sky-50',
                      )}
                      onClick={() => setSelectedId(p.id)}
                    >
                      <td className="px-3 py-2 text-xs font-semibold text-slate-700">
                        {ROLE_TH[p.role]}
                      </td>
                      <td className="py-2 pr-2 font-medium text-slate-900">{p.name}</td>
                      <td className="py-2 pr-2 tabular-nums">{p.age}</td>
                      <td className="py-2 pr-2 font-semibold tabular-nums">{skill}</td>
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          {p.clubId ? <ClubCrest club={club} size="xs" /> : null}
                          <span>{clubNameOf(p.clubId)}</span>
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs tabular-nums text-slate-600">
                        {p.morale}/20 · E{p.energy}
                      </td>
                    </tr>
                  )
                })}
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-sm text-slate-500">
                      ไม่พบสตาฟตามตัวกรอง
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel>
          {!selected ? (
            <p className="text-sm text-slate-500">เลือกสตาฟเพื่อดูสถานะและทักษะ</p>
          ) : (
            <StaffDetail person={selected} clubName={clubNameOf(selected.clubId)} />
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
        <StatTile
          label="มีรูป"
          value={`${stats.withPhoto}`}
          hint={`${Math.round((stats.withPhoto / Math.max(1, stats.total)) * 100)}%`}
        />
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
          <FilterSelect
            label="ลีก"
            icon={<IconLayers />}
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
          </FilterSelect>
          <FilterSelect
            label="สโมสร"
            icon={<IconBuilding />}
            className="min-w-[14rem]"
            value={clubKey}
            onChange={(e) => setClubKey(e.target.value)}
          >
            <option value="all">ทุกสโมสร</option>
            {clubsInLeague.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            label="ข้อมูลเสริม"
            icon={<IconPackage />}
            value={enrich}
            onChange={(e) => setEnrich(e.target.value as EnrichFilter)}
          >
            <option value="all">ทั้งหมด</option>
            <option value="photo">มีรูป</option>
            <option value="bio">มี Bio</option>
            <option value="fm">มี FMInside</option>
            <option value="missing">ยังขาดรูป / Bio / FM</option>
          </FilterSelect>
          <SearchField
            value={q}
            onChange={setQ}
            placeholder="ชื่อ · สโมสร · สัญชาติ · ตำแหน่ง"
          />
        </div>
      </Panel>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,1fr)]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-slate-200 px-4 py-3">
            <h3 className="text-sm font-bold text-slate-900">รายชื่อใน pack</h3>
            <p className="text-xs text-slate-500">คลิกแถวเพื่อดูประวัติอาชีพ · Bio · FM</p>
          </div>
          <div className="max-h-[calc(100dvh-14rem)] overflow-auto">
            <table className="w-full min-w-[880px] border-collapse text-left text-sm">
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
                {filtered.map((r) => {
                  const club = crestClubFromPack(r)
                  return (
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
                      <td className="py-2 pr-2">
                        <span className="inline-flex items-center gap-1.5 text-slate-700">
                          <ClubCrest club={club} size="xs" />
                          <span className="truncate">{r.clubShort}</span>
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs text-slate-500">{r.leagueId.toUpperCase()}</td>
                      <td className="px-3 py-2 text-[10px] font-semibold tracking-wide">
                        <span className={r.hasPhoto ? 'text-violet-800' : 'text-slate-300'}>PIC</span>
                        <span className="mx-1 text-slate-200">·</span>
                        <span className={r.hasBio ? 'text-lime-800' : 'text-slate-300'}>BIO</span>
                        <span className="mx-1 text-slate-200">·</span>
                        <span className={r.hasFmInside ? 'text-sky-800' : 'text-slate-300'}>FM</span>
                      </td>
                    </tr>
                  )
                })}
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
            <div className="max-h-[calc(100dvh-10rem)] space-y-4 overflow-y-auto pr-1">
              <div className="flex items-start gap-3">
                <PlayerFace name={selected.name} size="md" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-balance text-slate-900">{selected.name}</h3>
                  <p className="text-sm text-slate-600">
                    {roleLabel(selected.role)} · อายุ {selected.age} · OVR {selected.ovr}
                  </p>
                  <p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                    <ClubCrest club={crestClubFromPack(selected)} size="xs" />
                    <span>
                      {selected.clubName} · {selected.leagueLabel}
                    </span>
                  </p>
                </div>
              </div>

              <div className="rounded-lg border border-slate-200 bg-white p-3">
                <PlayerCareerHistory playerName={selected.name} playerAge={selected.age} />
              </div>

              <dl className="grid grid-cols-3 gap-2 text-xs">
                <div className="rounded-md bg-slate-50 px-2 py-1.5">
                  <dt className="text-slate-500">รูป</dt>
                  <dd
                    className={
                      selected.hasPhoto ? 'font-medium text-violet-800' : 'font-medium text-amber-800'
                    }
                  >
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
                    <li>
                      ค่าตัว {formatGbp(bio.valueGbp)} · ค่าเหนื่อย {formatGbp(bio.wageWeeklyGbp)}/wk
                    </li>
                    <li>สัญญาถึง {bio.contractExpires ?? '—'}</li>
                  </ul>
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold tracking-wide text-slate-500 uppercase">FMInside</h4>
                {!fm ? (
                  <p className="mt-1 text-sm text-amber-800">ยังไม่มีใน fmInsideAttrs.json</p>
                ) : (
                  <div className="mt-1 space-y-3">
                    <ul className="space-y-1 text-sm text-slate-700">
                      <li>
                        Rating {fm.rating ?? '—'} · Potential {fm.potential ?? '—'}
                      </li>
                      <li>
                        มูลค่า {formatEur(fm.sellValueEur)} · ค่าเหนื่อย {formatEur(fm.wageEurPw)}/wk
                      </li>
                    </ul>
                    {(
                      [
                        ['Goalkeeping', fm.attrs.goalkeeping ?? {}],
                        ['Technical', fm.attrs.technical],
                        ['Mental', fm.attrs.mental],
                        ['Physical', fm.attrs.physical],
                        ['Set Pieces', fm.attrs.setPieces],
                      ] as const
                    ).map(([title, group]) =>
                      Object.keys(group).length > 0 ? (
                        <div key={title}>
                          <h5 className="text-xs font-semibold text-slate-600">{title}</h5>
                          <ul className="mt-1 grid max-h-32 grid-cols-2 gap-x-2 gap-y-0.5 overflow-y-auto text-xs sm:grid-cols-3">
                            {Object.entries(group).map(([k, v]) => (
                              <li key={k} className="flex justify-between gap-2">
                                <span className="truncate text-slate-500">{k}</span>
                                <span className="font-medium tabular-nums">{v}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </Panel>
      </div>
    </>
  )
}
