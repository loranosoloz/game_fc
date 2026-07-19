import { useMemo, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import {
  continentOfLeague,
  ensureAwards,
  type ManagerAward,
  type SeasonIndividualAward,
  type TeamOfPeriod,
} from '@/game/awards'
import { buildAwardsPitchPlayers } from '@/game/pitchLayout'
import { formationLabel } from '@/game/types'
import { MatchPitch } from '@/components/MatchPitch'
import { PageHeader, Panel, SectionLabel } from '@/components/ui'
import { cn } from '@/lib/cn'

type TabId = 'week' | 'month' | 'managers' | 'season'

export function AwardsPage() {
  const save = useGameStore((s) => s.save)!
  const awards = ensureAwards(save)
  const humanClub = save.clubs.find((c) => c.id === save.humanClubId)
  const continent = continentOfLeague(save.leagueId || 'eng')
  const [tab, setTab] = useState<TabId>(save.seasonComplete ? 'season' : 'week')
  const [divFilter, setDivFilter] = useState<1 | 2 | 'all'>(
    (humanClub?.division as 1 | 2) ?? 1,
  )

  const totw = useMemo(() => {
    const list = awards.teamOfWeek ?? []
    return divFilter === 'all' ? list : list.filter((t) => t.division === divFilter)
  }, [awards.teamOfWeek, divFilter])

  const totm = useMemo(() => {
    const list = awards.teamOfMonth ?? []
    return divFilter === 'all' ? list : list.filter((t) => t.division === divFilter)
  }, [awards.teamOfMonth, divFilter])

  const mow = useMemo(() => {
    const list = awards.managerOfWeek ?? []
    return divFilter === 'all' ? list : list.filter((m) => m.division === divFilter)
  }, [awards.managerOfWeek, divFilter])

  const mom = useMemo(() => {
    const list = awards.managerOfMonth ?? []
    return divFilter === 'all' ? list : list.filter((m) => m.division === divFilter)
  }, [awards.managerOfMonth, divFilter])

  const seasonAwards = awards.seasonAwards ?? []
  const ballon = seasonAwards.filter((a) => a.kind === 'ballon_dor')
  const boots = seasonAwards.filter((a) => a.kind === 'golden_boot')
  const gloves = seasonAwards.filter((a) => a.kind === 'golden_glove')

  const continentHint =
    continent === 'europe'
      ? 'ยุโรป'
      : continent === 'asia'
        ? 'เอเชีย'
        : continent === 'americas'
          ? 'อเมริกาใต้'
          : 'ทวีป'

  return (
    <div className="space-y-4">
      <PageHeader
        title="รางวัลลีก"
        subtitle={`${save.leagueName} · TOTW/TOTM · MoW/MoM · Ballon d'Or ${continentHint} · ดาวซัลโว · ถุงมือทองคำ`}
      />

      <div className="flex flex-wrap gap-2">
        {(
          [
            { id: 'week' as const, label: 'ทีมสัปดาห์' },
            { id: 'month' as const, label: 'ทีมเดือน' },
            { id: 'managers' as const, label: 'ผู้จัดการ' },
            { id: 'season' as const, label: 'รางวัลฤดูกาล' },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md border px-3 py-1.5 text-sm font-semibold',
              tab === t.id
                ? 'border-slate-900 bg-slate-900 text-lime-300'
                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50',
            )}
          >
            {t.label}
          </button>
        ))}
        {tab !== 'season' ? (
          <>
            <span className="mx-1 hidden h-8 w-px bg-slate-200 sm:block" />
            {(
              [
                { id: 1 as const, label: 'ดิวิชัน 1' },
                { id: 2 as const, label: 'ดิวิชัน 2' },
                { id: 'all' as const, label: 'ทั้งหมด' },
              ] as const
            ).map((d) => (
              <button
                key={String(d.id)}
                type="button"
                onClick={() => setDivFilter(d.id)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium',
                  divFilter === d.id
                    ? 'border-emerald-700 bg-emerald-50 text-emerald-900'
                    : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50',
                )}
              >
                {d.label}
              </button>
            ))}
          </>
        ) : null}
      </div>

      {tab === 'week' ? (
        totw.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {totw.map((team) => (
              <TeamAwardCard
                key={`w-${team.division}-${team.matchday}`}
                team={team}
                clubColor={humanClub?.color ?? '#0f172a'}
              />
            ))}
          </div>
        ) : (
          <EmptyHint text="เล่นแมตช์เดย์ลีกให้จบอย่างน้อย 1 รอบ — ระบบจะเลือก 11 ตัวจริงจากเรตติ้งแมตช์" />
        )
      ) : null}

      {tab === 'month' ? (
        totm.length ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {totm.map((team) => (
              <TeamAwardCard
                key={`m-${team.division}-${team.monthKey}`}
                team={team}
                clubColor={humanClub?.color ?? '#0f172a'}
              />
            ))}
          </div>
        ) : (
          <EmptyHint text="ทีมเดือนจะประกาศเมื่อข้ามเดือนในปฏิทินเกม (สะสมเรตติ้งตลอดเดือน)" />
        )
      ) : null}

      {tab === 'managers' ? (
        <div className="grid gap-4 md:grid-cols-2">
          <Panel className="!p-4">
            <SectionLabel>ผู้จัดการยอดเยี่ยมประจำสัปดาห์ (MoW)</SectionLabel>
            {mow.length ? (
              <ul className="mt-3 space-y-2">
                {mow.map((m) => (
                  <ManagerRow key={`mow-${m.division}-${m.matchday}`} m={m} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลสัปดาห์นี้</p>
            )}
          </Panel>
          <Panel className="!p-4">
            <SectionLabel>ผู้จัดการยอดเยี่ยมประจำเดือน (MoM)</SectionLabel>
            {mom.length ? (
              <ul className="mt-3 space-y-2">
                {mom.map((m) => (
                  <ManagerRow key={`mom-${m.division}-${m.monthKey}`} m={m} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                รอปิดเดือน — คะแนนสะสมจากผล + GD + เรตติ้งทีม
              </p>
            )}
          </Panel>
        </div>
      ) : null}

      {tab === 'season' ? (
        seasonAwards.length ? (
          <div className="space-y-4">
            {ballon.length ? (
              <Panel className="!p-4">
                <SectionLabel>Ballon d&apos;Or · ปีละครั้ง</SectionLabel>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {ballon.map((a) => (
                    <SeasonAwardCard key={`${a.kind}-${a.region}-${a.season}`} a={a} />
                  ))}
                </div>
              </Panel>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2">
              <Panel className="!p-4">
                <SectionLabel>ดาวซัลโว / Golden Shoe</SectionLabel>
                <p className="mt-1 text-xs text-slate-500">
                  แต้ม = ประตูลีก × ตัวคูณความยาก (Tier 1 ×2.0 · Tier 2 ×1.5 · Tier 3 ×1.0 ·
                  ดิวิชัน 2 ลดน้ำหนัก) · เสมอกันดูนาทีต่อประตู → แอสซิสต์ → ประตูไม่นับจุดโทษ
                </p>
                <ul className="mt-3 space-y-2">
                  {boots.map((a) => (
                    <SeasonAwardCard key={`${a.label}-${a.playerId}`} a={a} compact />
                  ))}
                </ul>
              </Panel>
              <Panel className="!p-4">
                <SectionLabel>ถุงมือทองคำ (Golden Glove)</SectionLabel>
                <p className="mt-1 text-xs text-slate-500">
                  คลีนชีต + เซฟ · แยกลีกและทวีป
                </p>
                <ul className="mt-3 space-y-2">
                  {gloves.map((a) => (
                    <SeasonAwardCard key={`${a.label}-${a.playerId}`} a={a} compact />
                  ))}
                </ul>
              </Panel>
            </div>
          </div>
        ) : (
          <EmptyHint
            text={`จบลีกฤดูกาลนี้ก่อน — จะประกาศ Ballon d'Or ${continentHint} · ดาวซัลโว/ถุงมือทองคำของลีกและทวีป`}
          />
        )
      ) : null}

      {awards.history.length > 0 ? (
        <Panel className="!p-4">
          <SectionLabel>ประวัติล่าสุด</SectionLabel>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs text-slate-700">
            {awards.history.slice(0, 24).map((h, i) => {
              if (h.type === 'totw' || h.type === 'totm') {
                const humanN = h.team.xi.filter((x) => x.isHumanClub).length
                return (
                  <li key={`h-${i}`} className="border-b border-slate-100 py-1.5 last:border-0">
                    <span className="font-semibold">
                      {h.type === 'totw' ? 'TOTW' : 'TOTM'}
                    </span>{' '}
                    · {h.team.leagueLabel} · {h.team.formation}
                    {humanN > 0 ? (
                      <span className="ml-1 font-semibold text-lime-800">· ทีมคุณ {humanN}</span>
                    ) : null}
                  </li>
                )
              }
              if (h.type === 'season') {
                return (
                  <li key={`h-${i}`} className="border-b border-slate-100 py-1.5 last:border-0">
                    <span className="font-semibold">{h.award.label}</span> · {h.award.name}
                    {h.award.isHumanClub ? (
                      <span className="ml-1 font-semibold text-lime-800">· ทีมคุณ</span>
                    ) : null}
                  </li>
                )
              }
              return (
                <li key={`h-${i}`} className="border-b border-slate-100 py-1.5 last:border-0">
                  <span className="font-semibold">{h.type === 'mow' ? 'MoW' : 'MoM'}</span>{' '}
                  · {h.manager.leagueLabel} · {h.manager.managerName} ({h.manager.clubShort})
                  {h.manager.isHuman ? (
                    <span className="ml-1 font-semibold text-lime-800">· คุณ</span>
                  ) : null}
                </li>
              )
            })}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}

function EmptyHint({ text }: { text: string }) {
  return (
    <Panel className="!p-6">
      <p className="text-sm text-slate-600">{text}</p>
    </Panel>
  )
}

function SeasonAwardCard({
  a,
  compact,
}: {
  a: SeasonIndividualAward
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-md border px-3 py-2',
        a.isHumanClub
          ? 'border-lime-400 bg-lime-50 text-lime-950'
          : 'border-slate-200 bg-white text-slate-800',
        !compact && 'p-4',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className={cn('font-bold', compact ? 'text-sm' : 'text-base')}>{a.name}</p>
        <p className="text-xs font-semibold tabular-nums text-slate-500">
          {a.kind === 'ballon_dor'
            ? `คะแนน ${a.value}`
            : a.kind === 'golden_boot'
              ? `${a.value} แต้ม`
              : `${a.value} CS`}
        </p>
      </div>
      <p className="mt-0.5 text-xs font-semibold text-slate-600">{a.label}</p>
      <p className="mt-0.5 text-xs text-slate-500">
        {a.clubShort}
        {a.isHumanClub ? ' · ทีมคุณ' : ''} · {a.detail}
      </p>
    </div>
  )
}

function TeamAwardCard({ team, clubColor }: { team: TeamOfPeriod; clubColor: string }) {
  const pitchPlayers = buildAwardsPitchPlayers(team.formation, team.xi).map((p) => ({
    id: p.id,
    label: p.label,
    name: p.name,
    side: p.side,
    spot: p.base,
    highlight: p.highlight,
  }))
  const humanCount = team.xi.filter((x) => x.isHumanClub).length

  return (
    <Panel className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-500 uppercase">
            {team.kind === 'week' ? 'Team of the Week' : 'Team of the Month'}
          </p>
          <h2 className="text-base font-bold text-slate-900">{team.leagueLabel}</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            MD{team.matchday} · {team.date} · {formationLabel(team.formation, true)} · เฉลี่ย{' '}
            {team.avgRating.toFixed(1)}
          </p>
        </div>
        {humanCount > 0 ? (
          <span className="rounded-md bg-lime-100 px-2 py-1 text-xs font-bold text-lime-900">
            ทีมคุณ {humanCount} คน
          </span>
        ) : null}
      </div>

      <MatchPitch
        spot={{ x: 50, y: 32 }}
        players={pitchPlayers}
        homeColor={clubColor}
        awayColor="#64748b"
        homeShort="XI"
        awayShort=""
        hideBall
        awardsMode
        className="mt-3 aspect-[100/72] w-full"
      />

      <ul className="mt-3 space-y-1 text-xs">
        {team.xi.map((p) => (
          <li
            key={p.playerId}
            className={cn(
              'grid grid-cols-[2.5rem_1fr_auto_auto] items-center gap-2 border-b border-slate-50 py-1 last:border-0',
              p.isHumanClub && 'bg-lime-50/80 font-semibold text-lime-950',
            )}
          >
            <span className="font-mono text-slate-500">{p.role}</span>
            <span className="truncate">{p.name}</span>
            <span className="text-slate-500">{p.clubShort}</span>
            <span className="tabular-nums">{p.rating.toFixed(1)}</span>
          </li>
        ))}
      </ul>
    </Panel>
  )
}

function ManagerRow({ m }: { m: ManagerAward }) {
  return (
    <li
      className={cn(
        'rounded-md border px-3 py-2 text-sm',
        m.isHuman
          ? 'border-lime-400 bg-lime-50 text-lime-950'
          : 'border-slate-200 bg-white text-slate-800',
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-bold">
          {m.managerName}
          {m.isHuman ? ' · คุณ' : ''}
        </p>
        <p className="text-xs font-semibold text-slate-500">{m.leagueLabel}</p>
      </div>
      <p className="mt-0.5 text-xs text-slate-600">
        {m.clubName} · {m.wins}W {m.draws}D {m.losses}L · GD {m.gd >= 0 ? '+' : ''}
        {m.gd} · คะแนน {m.score}
      </p>
    </li>
  )
}
