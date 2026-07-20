import { useEffect, useMemo, useState, useTransition } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listClubOptionsForLeague, listLeagues, type LeagueId } from '@/data/world'
import { peekHasSaveAsync, peekHasSaveSync } from '@/game/peekSave'
import { ClubCrest } from '@/components/ClubCrest'
import { cn } from '@/lib/cn'
import {
  ATTR_MAX,
  ATTR_MIN,
  MANAGER_ATTR_META,
  MANAGER_BACKGROUNDS,
  MANAGER_STYLES,
  adjustManagerAttr,
  attrsByGroup,
  buildManagerProfile,
  defaultManagerBuild,
  listManagerNations,
  managerBlurb,
  remainingAttrPoints,
  setManagerBackground,
  type ManagerAttrKey,
  type ManagerBackground,
  type ManagerBuildInput,
} from '@/game/managerProfile'
import type { FormationId } from '@/game/types'
import { ALL_FORMATIONS, FORMATION_LABEL_TH } from '@/game/types'
import type { CoachStyleId } from '@/game/worldCoaches'

const FORMATION_OPTS = ALL_FORMATIONS
const STEPS = ['ตัวตน', 'สไตล์', 'แอตทริบิวต์', 'สโมสร'] as const

function AttrRow({
  attrKey,
  value,
  canInc,
  onAdj,
}: {
  attrKey: ManagerAttrKey
  value: number
  canInc: boolean
  onAdj: (delta: number) => void
}) {
  const meta = MANAGER_ATTR_META[attrKey]
  return (
    <div className="flex items-center gap-2 rounded-md border border-slate-100 bg-white px-2.5 py-1.5">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-slate-900">{meta.labelTh}</p>
        <p className="truncate text-[11px] text-slate-500">{meta.blurb}</p>
      </div>
      <div className="flex items-center gap-1">
        <button
          type="button"
          aria-label={`ลด ${meta.labelTh}`}
          disabled={value <= ATTR_MIN}
          onClick={() => onAdj(-1)}
          className="h-7 w-7 rounded border border-slate-300 text-sm font-bold disabled:opacity-30"
        >
          −
        </button>
        <span className="w-7 text-center text-sm font-bold tabular-nums">{value}</span>
        <button
          type="button"
          aria-label={`เพิ่ม ${meta.labelTh}`}
          disabled={!canInc || value >= ATTR_MAX}
          onClick={() => onAdj(1)}
          className="h-7 w-7 rounded border border-slate-300 text-sm font-bold disabled:opacity-30"
        >
          +
        </button>
      </div>
    </div>
  )
}

export function HomePage() {
  const navigate = useNavigate()
  const [isPending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [hasSave, setHasSave] = useState(() => peekHasSaveSync())

  useEffect(() => {
    if (hasSave) return
    void peekHasSaveAsync().then((ok) => {
      if (ok) setHasSave(true)
    })
  }, [hasSave])

  const leagues = useMemo(() => listLeagues(), [])
  const nations = useMemo(() => listManagerNations(), [])
  const [step, setStep] = useState(0)
  const [leagueId, setLeagueId] = useState<LeagueId>('eng')
  const clubs = useMemo(() => listClubOptionsForLeague(leagueId), [leagueId])
  const [managerName, setManagerName] = useState('Manager')
  const [clubId, setClubId] = useState(clubs[0]?.id ?? 'club-1')
  const [build, setBuild] = useState<ManagerBuildInput>(defaultManagerBuild())

  const profilePreview = useMemo(() => buildManagerProfile(build), [build])
  const pointsLeft = remainingAttrPoints(build.background, build.attrs)

  const onLeagueChange = (id: LeagueId) => {
    setLeagueId(id)
    const nextClubs = listClubOptionsForLeague(id)
    setClubId(nextClubs[0]?.id ?? 'club-1')
  }

  const pickStyle = (id: CoachStyleId) => {
    const preset = MANAGER_STYLES.find((s) => s.id === id)
    setBuild((prev) => ({
      ...prev,
      style: id,
      preferredFormation: preset?.formation ?? prev.preferredFormation,
    }))
  }

  const goStep = (n: number) => {
    startTransition(() => setStep(n))
  }

  const start = async () => {
    setBusy(true)
    try {
      const { useGameStore } = await import('@/store/gameStore')
      useGameStore.getState().newGame(managerName, clubId, leagueId, build)
      navigate('/portal')
    } finally {
      setBusy(false)
    }
  }

  const resume = async () => {
    setBusy(true)
    try {
      const { useGameStore } = await import('@/store/gameStore')
      const ok = await useGameStore.getState().continueGameAsync()
      if (ok) navigate('/portal')
    } finally {
      setBusy(false)
    }
  }

  const leagueMeta = leagues.find((l) => l.id === leagueId)
  const canNextIdentity = managerName.trim().length >= 1 && Boolean(build.nation)

  return (
    <div className="flex min-h-full w-full flex-col">
      <header className="w-full border-b border-slate-800 bg-slate-900 text-slate-100">
        <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
          <div>
            <p className="text-[10px] font-bold tracking-[0.22em] text-lime-300/90 uppercase">
              World leagues
            </p>
            <h1 className="text-xl font-bold tracking-tight md:text-2xl">FC Manager</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {hasSave ? (
              <button
                type="button"
                disabled={busy}
                onClick={() => void resume()}
                className="rounded-md bg-lime-300 px-3 py-1.5 text-xs font-bold text-slate-900 hover:bg-lime-200 disabled:opacity-50"
              >
                {busy ? 'กำลังโหลด…' : 'โหลดเกมที่เซฟไว้'}
              </button>
            ) : null}
            <Link
              to="/browse"
              className="rounded-md border border-slate-600 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              ฐานข้อมูล pack
            </Link>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto border-t border-slate-800 bg-slate-950 px-2 lg:px-4">
          {STEPS.map((label, i) => (
            <button
              key={label}
              type="button"
              onClick={() => {
                if (i < step) goStep(i)
              }}
              className={cn(
                'shrink-0 px-3 py-2 text-xs font-semibold whitespace-nowrap transition',
                step === i
                  ? 'bg-lime-300/15 text-lime-300 shadow-[inset_0_-2px_0_0] shadow-lime-300'
                  : step > i
                    ? 'text-slate-300 hover:bg-slate-900'
                    : 'text-slate-600',
              )}
            >
              {i + 1}. {label}
            </button>
          ))}
        </nav>
      </header>

      <main className="w-full flex-1 px-4 py-5 lg:px-6 xl:px-8">
        <div className="mb-5 max-w-3xl">
          <p className="text-sm leading-relaxed text-slate-600">
            สร้างตัวแบบ FM — แจกพอยต์แอตทริบิวต์ 1–20 · เลือกสัญชาติและสไตล์ · คุณเป็นโค้ชที่ถูกจ้าง
          </p>
        </div>

        <section
          className={cn(
            'w-full rounded-xl border border-slate-200 bg-white/90 p-5 shadow-sm lg:p-6',
            isPending && 'opacity-80',
          )}
        >
          {step === 0 ? (
            <div className="grid gap-5 lg:grid-cols-[1fr_1.1fr] lg:gap-8">
              <div className="grid gap-4 content-start">
                <h2 className="text-lg font-semibold text-slate-900">ตัวตนผู้จัดการ</h2>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">ชื่อ</span>
                  <input
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
                    value={managerName}
                    onChange={(e) => setManagerName(e.target.value)}
                  />
                </label>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">สัญชาติ</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-3 py-2"
                    value={build.nation}
                    onChange={(e) => setBuild((p) => ({ ...p, nation: e.target.value }))}
                  >
                    {nations.map((n) => (
                      <option key={n.id} value={n.id}>
                        {n.nameTh} ({n.name})
                      </option>
                    ))}
                  </select>
                  <span className="text-xs text-slate-500">
                    โค้ชทุกคนมีประเทศตัวเอง — ระบบภาษา/คุยกับนักเตะจะผูกกับสัญชาตินี้ทีหลัง
                  </span>
                </label>
              </div>
              <div>
                <p className="text-sm font-medium text-slate-700">เส้นทางอาชีพ</p>
                <p className="mt-0.5 text-xs text-slate-500">
                  เปลี่ยนเส้นทางจะรีเซ็ตแอตทริบิวต์และงบพอยต์
                </p>
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {(Object.keys(MANAGER_BACKGROUNDS) as ManagerBackground[]).map((bg) => {
                    const meta = MANAGER_BACKGROUNDS[bg]
                    const selected = build.background === bg
                    return (
                      <button
                        key={bg}
                        type="button"
                        onClick={() => setBuild((p) => setManagerBackground(p, bg))}
                        className={cn(
                          'rounded-md border px-3 py-2.5 text-left text-sm transition',
                          selected
                            ? 'border-slate-900 bg-slate-900 text-lime-300'
                            : 'border-slate-200 bg-white hover:border-slate-400',
                        )}
                      >
                        <span className="font-semibold">{meta.labelTh}</span>
                        <span
                          className={cn(
                            'mt-1 block text-xs',
                            selected ? 'text-lime-400/90' : 'text-slate-500',
                          )}
                        >
                          {meta.blurb} · พอยต์แจก +{meta.attrPoints}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
              <div className="lg:col-span-2">
                <button
                  type="button"
                  disabled={!canNextIdentity}
                  onClick={() => goStep(1)}
                  className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800 disabled:opacity-40"
                >
                  ต่อไป — สไตล์การเล่น
                </button>
              </div>
            </div>
          ) : null}

          {step === 1 ? (
            <div className="grid gap-4">
              <h2 className="text-lg font-semibold text-slate-900">สไตล์การเล่น</h2>
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {MANAGER_STYLES.map((s) => {
                  const selected = build.style === s.id
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => pickStyle(s.id)}
                      className={cn(
                        'rounded-md border px-3 py-2.5 text-left text-sm transition',
                        selected
                          ? 'border-slate-900 bg-slate-900 text-lime-300'
                          : 'border-slate-200 bg-white hover:border-slate-400',
                      )}
                    >
                      <span className="font-semibold">{s.labelTh}</span>
                      <span
                        className={cn(
                          'mt-1 block text-xs',
                          selected ? 'text-lime-400/90' : 'text-slate-500',
                        )}
                      >
                        {s.blurb}
                      </span>
                    </button>
                  )
                })}
              </div>
              <label className="grid max-w-md gap-1.5 text-sm">
                <span className="font-medium text-slate-700">แผนถนัด</span>
                <select
                  className="rounded-md border border-slate-300 bg-white px-3 py-2"
                  value={build.preferredFormation}
                  onChange={(e) =>
                    setBuild((p) => ({
                      ...p,
                      preferredFormation: e.target.value as FormationId,
                    }))
                  }
                >
                  {FORMATION_OPTS.map((f) => (
                    <option key={f} value={f}>
                      {FORMATION_LABEL_TH[f]}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => goStep(0)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={() => goStep(2)}
                  className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
                >
                  ต่อไป — แจกพอยต์
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">แอตทริบิวต์ (1–20)</h2>
                  <p className="text-xs text-slate-500">
                    แบบ Football Manager · กด +/− แจกพอยต์ให้ด้านที่ถนัด
                  </p>
                </div>
                <p
                  className={cn(
                    'rounded-md px-3 py-1.5 text-sm font-bold',
                    pointsLeft === 0
                      ? 'bg-lime-100 text-lime-900'
                      : pointsLeft < 0
                        ? 'bg-rose-100 text-rose-900'
                        : 'bg-amber-100 text-amber-950',
                  )}
                >
                  พอยต์เหลือ {pointsLeft}
                </p>
              </div>

              <div className="grid gap-4 xl:grid-cols-3">
                {(
                  [
                    ['coaching', 'โค้ชชิ่ง'],
                    ['mental', 'เมนทัล / คน'],
                    ['judging', 'ประเมินนักเตะ'],
                  ] as const
                ).map(([group, title]) => (
                  <div key={group}>
                    <p className="mb-1.5 text-xs font-bold tracking-wide text-slate-500 uppercase">
                      {title}
                    </p>
                    <div className="grid gap-1.5">
                      {attrsByGroup(group).map((key) => (
                        <AttrRow
                          key={key}
                          attrKey={key}
                          value={build.attrs[key]}
                          canInc={pointsLeft > 0}
                          onAdj={(d) => setBuild((p) => adjustManagerAttr(p, key, d))}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                พรีวิว: {managerBlurb(profilePreview)}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => goStep(1)}
                  className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
                >
                  ย้อนกลับ
                </button>
                <button
                  type="button"
                  onClick={() => goStep(3)}
                  className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
                >
                  ต่อไป — เลือกสโมสร
                </button>
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(16rem,22rem)_1fr] lg:gap-8">
              <div className="grid gap-4 content-start">
                <h2 className="text-lg font-semibold text-slate-900">รับงานสโมสร</h2>
                <p className="text-xs text-slate-500">
                  โค้ชเดิมของสโมสรจะว่างงาน และมีคลับอื่นจ้างต่อ — คุณคือผู้จัดการคนใหม่
                </p>
                <label className="grid gap-1.5 text-sm">
                  <span className="font-medium text-slate-700">ลีก</span>
                  <select
                    className="rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-lime-400 focus:ring-2"
                    value={leagueId}
                    onChange={(e) => onLeagueChange(e.target.value as LeagueId)}
                  >
                    {leagues.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.nameTh} — {l.name}
                      </option>
                    ))}
                  </select>
                  {leagueMeta ? (
                    <span className="text-xs text-slate-500">
                      {leagueMeta.nation} · ถ้วย {leagueMeta.cupName}
                      {'teams' in leagueMeta && leagueMeta.teams
                        ? ` · ${leagueMeta.teams} สโมสร`
                        : ''}
                    </span>
                  ) : null}
                </label>
                <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  {managerName} · {managerBlurb(profilePreview)}
                  {pointsLeft > 0 ? ` · ยังเหลือพอยต์ ${pointsLeft}` : ''}
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => goStep(2)}
                    className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
                  >
                    ย้อนกลับ
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void start()}
                    className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800 disabled:opacity-50"
                  >
                    {busy ? 'กำลังสร้างโลก…' : 'เริ่มฤดูกาล'}
                  </button>
                </div>
              </div>
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">เลือกสโมสรที่รับงานผู้จัดการ</p>
                <div className="grid max-h-[min(70vh,36rem)] grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                  {clubs.map((c) => {
                    const selected = clubId === c.id
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setClubId(c.id)}
                        className={cn(
                          'flex items-center gap-2 rounded-md border px-2.5 py-2 text-left text-sm transition',
                          selected
                            ? 'border-slate-900 bg-slate-900 text-lime-300'
                            : 'border-slate-200 bg-white text-slate-800 hover:border-slate-400',
                        )}
                      >
                        <ClubCrest club={c} size="sm" />
                        <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                        <span className={cn('text-xs', selected ? 'text-lime-400/80' : 'text-slate-400')}>
                          {c.reputation}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  )
}
