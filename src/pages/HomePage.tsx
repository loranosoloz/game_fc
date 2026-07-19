import { useMemo, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { listClubOptionsForLeague } from '@/game/worldSeed'
import { listLeagues, type LeagueId } from '@/data/world'
import { useGameStore } from '@/store/gameStore'
import { loadFromStorage } from '@/game/save'
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
  const newGame = useGameStore((s) => s.newGame)
  const continueGame = useGameStore((s) => s.continueGame)
  const hasSave = useMemo(() => Boolean(loadFromStorage()), [])
  const leagues = listLeagues()
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

  const start = () => {
    newGame(managerName, clubId, leagueId, build)
    navigate('/portal')
  }

  const resume = () => {
    if (continueGame()) navigate('/portal')
  }

  const leagueMeta = leagues.find((l) => l.id === leagueId)
  const canNextIdentity = managerName.trim().length >= 1 && Boolean(build.nation)

  return (
    <div className="mx-auto flex min-h-full max-w-3xl flex-col justify-center gap-8 px-4 py-10">
      <div>
        <p className="text-xs font-semibold tracking-[0.25em] text-slate-500 uppercase">
          World leagues
        </p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-900 md:text-5xl">
          FC Manager
        </h1>
        <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-600">
          สร้างตัวแบบ FM — แจกพอยต์แอตทริบิวต์ 1–20 · เลือกสัญชาติและสไตล์ · คุณเป็นโค้ชที่ถูกจ้าง
          (รายละเอียดภาษา/สื่อสารจะใส่ทีหลัง)
        </p>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5 shadow-sm backdrop-blur">
        <div className="mb-4 flex flex-wrap gap-2 text-xs font-semibold">
          {STEPS.map((label, i) => (
            <span
              key={label}
              className={cn(
                'rounded-md px-2.5 py-1',
                step === i
                  ? 'bg-slate-900 text-lime-300'
                  : step > i
                    ? 'bg-lime-100 text-lime-900'
                    : 'bg-slate-100 text-slate-500',
              )}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {step === 0 ? (
          <div className="grid gap-4">
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
            <button
              type="button"
              disabled={!canNextIdentity}
              onClick={() => setStep(1)}
              className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800 disabled:opacity-40"
            >
              ต่อไป — สไตล์การเล่น
            </button>
          </div>
        ) : null}

        {step === 1 ? (
          <div className="grid gap-4">
            <h2 className="text-lg font-semibold text-slate-900">สไตล์การเล่น</h2>
            <div className="grid gap-2 sm:grid-cols-2">
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
            <label className="grid gap-1.5 text-sm">
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
                onClick={() => setStep(0)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={() => setStep(2)}
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
                <div className="grid gap-1.5 sm:grid-cols-2">
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

            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              พรีวิว: {managerBlurb(profilePreview)}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={() => setStep(3)}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
              >
                ต่อไป — เลือกสโมสร
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="grid gap-4">
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
            <label className="grid gap-1.5 text-sm">
              <span className="font-medium text-slate-700">เลือกสโมสรที่รับงานผู้จัดการ</span>
              <div className="grid max-h-64 grid-cols-1 gap-1.5 overflow-y-auto sm:grid-cols-2">
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
            </label>
            <p className="rounded-md bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {managerName} · {managerBlurb(profilePreview)}
              {pointsLeft > 0 ? ` · ยังเหลือพอยต์ ${pointsLeft} (แจกไม่หมดก็ได้)` : ''}
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold"
              >
                ย้อนกลับ
              </button>
              <button
                type="button"
                onClick={start}
                className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-semibold text-lime-300 hover:bg-slate-800"
              >
                เริ่มฤดูกาล
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {hasSave ? (
        <button
          type="button"
          onClick={resume}
          className="rounded-md border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          โหลดเกมที่เซฟไว้
        </button>
      ) : null}

      <Link
        to="/database"
        className="text-center text-sm font-medium text-slate-600 underline-offset-2 hover:text-slate-900 hover:underline"
      >
        ดูฐานข้อมูลนักเตะ (pack JSON) →
      </Link>
    </div>
  )
}
