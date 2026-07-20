import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import { ensureMediaFeed } from '@/game/media'
import {
  canPlantRomano,
  ROMANO_PLANT_COOLDOWN_DAYS,
  ROMANO_PLANT_KINDS,
  romanoPlantCost,
  romanoPlantCooldownRemaining,
  type RomanoPlantKind,
} from '@/game/romanoPlant'
import type { MediaChannel, MediaItem, MediaTone } from '@/game/types'
import {
  ensureAllSocial,
  formatFollowers,
  topClubSocial,
  topPlayerSocial,
} from '@/game/social'
import { allMediaPersonalities, personalitiesForClub, personalitiesForLeague } from '@/game/mediaPersonalities'
import { leagueIdOfSave } from '@/game/mediaOutlets'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'
import { GhostButton, PageHeader, Panel, PrimaryButton } from '@/components/ui'
import { PlayerFace } from '@/components/PlayerFace'

const TABS: { id: MediaChannel; label: string; hint: string }[] = [
  { id: 'news', label: 'ข่าว', hint: 'สำนักข่าวประเทศละ 2 ช่อง · ผลแข่ง · ดีล' },
  { id: 'social', label: 'โซเชียล', hint: 'แฟน · สตอรี่นักเตะ · ทอล์คโชว์ท้องถิ่น' },
  { id: 'romano', label: 'Romano', hint: 'ข่าวหลังบ้าน · ความเชื่อมั่น %' },
]

function toneClass(tone: MediaTone): string {
  if (tone === 'positive') return 'border-l-lime-500'
  if (tone === 'negative') return 'border-l-rose-500'
  if (tone === 'rumor') return 'border-l-amber-500'
  return 'border-l-slate-300'
}

function MediaCard({ item, showReliability }: { item: MediaItem; showReliability?: boolean }) {
  const planted = item.tags?.includes('planted')
  const exposed = item.tags?.includes('exposed')
  return (
    <article
      className={cn(
        'rounded-lg border border-slate-200/90 border-l-4 bg-white/90 px-4 py-3 shadow-sm',
        toneClass(item.tone),
      )}
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-bold text-slate-900">{item.headline}</h3>
        <time className="shrink-0 text-[11px] font-medium text-slate-400">{item.date}</time>
      </div>
      {item.outlet ? (
        <p className="mt-0.5 text-[10px] font-semibold tracking-wide text-slate-500 uppercase">
          {item.outlet}
        </p>
      ) : null}
      {item.punditName ? (
        <p className="mt-1 text-[11px] text-slate-500">
          <span className="font-semibold text-slate-700">
            {item.punditName}
            {item.punditRole ? ` · ${item.punditRole}` : ''}
          </span>
          {item.punditBio ? ` — ${item.punditBio}` : ''}
        </p>
      ) : null}
      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{item.body}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {showReliability && item.reliability != null ? (
          <span className="text-[11px] font-semibold tracking-wide text-amber-800 uppercase">
            ความเชื่อมั่น {item.reliability}%
            {item.reliability >= 85 ? ' · Here we go' : item.reliability >= 70 ? ' · ใกล้ปิด' : ' · ข่าวลือ'}
          </span>
        ) : null}
        {planted ? (
          <span
            className={cn(
              'rounded px-1.5 py-0.5 text-[10px] font-bold uppercase',
              exposed ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-900',
            )}
          >
            {exposed ? 'เปิดโปง' : 'แคมเปญ'}
          </span>
        ) : null}
      </div>
    </article>
  )
}

export function MediaPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureAllSocial(ensurePhase5(saveRaw))
  const plantRomano = useGameStore((s) => s.plantRomano)
  const media = ensureMediaFeed(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)!
  const [tab, setTab] = useState<MediaChannel>('news')
  const [kind, setKind] = useState<RomanoPlantKind>('hype_club')
  const [playerId, setPlayerId] = useState('')
  const [rivalClubId, setRivalClubId] = useState('')
  const clubLeaders = useMemo(() => topClubSocial(save, 6), [save])
  const squadSocial = useMemo(() => topPlayerSocial(save, save.humanClubId, 6), [save])
  const worldStars = useMemo(() => topPlayerSocial(save, undefined, 6), [save])

  const list = useMemo(() => {
    if (tab === 'news') return media.news
    if (tab === 'social') return media.social
    return media.romano
  }, [media, tab])

  const meta = TABS.find((t) => t.id === tab)!
  const cost = romanoPlantCost(club)
  const cooldown = romanoPlantCooldownRemaining(save, club.id)
  const gate = canPlantRomano(save, club.id)

  const ownSquad = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId === save.humanClubId)
        .sort((a, b) => b.overall - a.overall),
    [save],
  )
  const marketStars = useMemo(
    () =>
      save.players
        .filter((p) => p.clubId !== save.humanClubId && p.overall >= 74)
        .sort((a, b) => b.overall - a.overall)
        .slice(0, 40),
    [save],
  )
  const rivals = useMemo(
    () => save.clubs.filter((c) => c.id !== save.humanClubId).sort((a, b) => b.reputation - a.reputation),
    [save],
  )

  const clubKey = club.crestKey ?? null
  const clubLegends = useMemo(() => personalitiesForClub(clubKey), [clubKey])
  const leagueLegends = useMemo(
    () => personalitiesForLeague(leagueIdOfSave(save)),
    [save],
  )
  const [legendScope, setLegendScope] = useState<'club' | 'league'>('club')
  const shownLegends = legendScope === 'club' && clubLegends.length ? clubLegends : leagueLegends

  const selectedKind = ROMANO_PLANT_KINDS.find((k) => k.id === kind)!

  const canSubmit =
    gate.ok &&
    (kind === 'hype_club' ||
      (kind === 'hype_star' && !!playerId) ||
      (kind === 'smear_rival' && !!rivalClubId) ||
      (kind === 'poach_bait' && !!playerId))

  return (
    <div className="space-y-5">
      <PageHeader
        title="สื่อ & ข่าวหลังบ้าน"
        subtitle="ข่าวหลัก · โซเชียล · Romano · ตำนานเลิกเล่นในบทบาทนักวิเคราะห์"
      />

      <Panel>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              ตำนานในสตูดิโอ
            </p>
            <p className="mt-1 text-sm text-slate-600">
              ไม่ใช่นักเตะในสกวด — เป็นผู้บรรยาย / นักวิเคราะห์ / พิธีกร (อย่างน้อย 6 คนต่อสโมสรชั้นนำ)
            </p>
          </div>
          <div className="flex gap-2">
            <GhostButton
              type="button"
              className={legendScope === 'club' ? 'bg-slate-900 text-white' : ''}
              onClick={() => setLegendScope('club')}
            >
              สโมสรคุณ ({clubLegends.length})
            </GhostButton>
            <GhostButton
              type="button"
              className={legendScope === 'league' ? 'bg-slate-900 text-white' : ''}
              onClick={() => setLegendScope('league')}
            >
              ทั้งลีก ({leagueLegends.length})
            </GhostButton>
          </div>
        </div>
        <ul className="mt-3 grid max-h-72 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
          {shownLegends.map((p) => (
            <li
              key={p.id}
              className="flex gap-2.5 rounded-md border border-slate-200/80 bg-slate-50/80 px-3 py-2"
            >
              <PlayerFace name={p.name} size="sm" className="mt-0.5" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                <p className="text-[11px] font-medium text-slate-500">
                  {p.roleTh} · ตำนาน {p.legendClubName}
                </p>
                <p className="mt-1 text-xs leading-snug text-slate-600">{p.bioTh}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-[11px] text-slate-400">
          พูลรวม {allMediaPersonalities().length.toLocaleString('th-TH')} คน · ทุกสโมสรชั้นนำ ≥6 คน
        </p>
      </Panel>

      <div className="grid gap-3 sm:grid-cols-3">
        <Panel>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
            บัญชีสโมสร
          </p>
          <p className="mt-1 text-lg font-bold text-slate-900">{club.social.handle}</p>
          <p className="text-sm text-slate-600">
            {formatFollowers(club.social.followers)} ผู้ติดตาม · engagement {club.social.engagement}
          </p>
          <p className="mt-1 text-xs text-slate-500">{club.social.lastPostNote}</p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">แบรนด์ออนไลน์</p>
          <p className="mt-1 text-lg font-bold text-slate-900">{club.social.brand}/100</p>
          <p className="text-xs text-slate-500">โตตามชื่อเสียง + ผลแข่ง · กระทบยอดติดตาม</p>
        </Panel>
        <Panel>
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">ดาวโซเชียลในทีม</p>
          <p className="mt-1 text-lg font-bold text-slate-900">
            {squadSocial[0] ? `${squadSocial[0].social.handle}` : '—'}
          </p>
          <p className="text-sm text-slate-600">
            {squadSocial[0] ? `${formatFollowers(squadSocial[0].social.followers)} · heat ${squadSocial[0].social.heat}` : ''}
          </p>
        </Panel>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-md px-3 py-1.5 text-sm font-semibold transition',
              tab === t.id
                ? 'bg-slate-900 text-lime-300'
                : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:text-slate-900',
            )}
          >
            {t.label}
            <span className="ml-1.5 text-[10px] font-bold text-slate-400 tabular-nums">
              {t.id === 'news' ? media.news.length : t.id === 'social' ? media.social.length : media.romano.length}
            </span>
          </button>
        ))}
      </div>

      <Panel tone="warn">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">จ้าง Romano · ข่าวปลอม / แคมเปญ</h3>
            <p className="mt-1 text-xs text-amber-950/80">
              คูลดาวน์ {ROMANO_PLANT_COOLDOWN_DAYS} วัน (~3 เดือน) · ค่าจ้าง {formatMoney(cost)} ·
              โอกาสเปิดโปง ~18% · AI สโมสรอื่นก็ทำได้
            </p>
            <p className="mt-1 text-xs text-slate-600">
              งบคุณ {formatMoney(club.balance)}
              {cooldown > 0 ? ` · เหลือคูลดาวน์ ~${cooldown} วัน` : ' · พร้อมจ้าง'}
            </p>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {ROMANO_PLANT_KINDS.map((k) => (
            <button
              key={k.id}
              type="button"
              onClick={() => {
                setKind(k.id)
                setPlayerId('')
                setRivalClubId('')
              }}
              className={cn(
                'rounded-lg border px-3 py-2 text-left transition',
                kind === k.id
                  ? 'border-amber-500 bg-amber-50'
                  : 'border-slate-200 bg-white hover:border-slate-300',
              )}
            >
              <p className="text-sm font-semibold text-slate-900">{k.title}</p>
              <p className="mt-0.5 text-[11px] text-slate-500">{k.desc}</p>
            </button>
          ))}
        </div>

        <p className="mt-3 text-xs text-slate-600">{selectedKind.desc}</p>

        {kind === 'hype_star' ? (
          <select
            className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">— เลือกนักเตะในทีม —</option>
            {ownSquad.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} · OVR {p.overall}
              </option>
            ))}
          </select>
        ) : null}

        {kind === 'poach_bait' ? (
          <select
            className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={playerId}
            onChange={(e) => setPlayerId(e.target.value)}
          >
            <option value="">— เลือกเป้าหมายจากตลาด —</option>
            {marketStars.map((p) => {
              const c = save.clubs.find((x) => x.id === p.clubId)
              return (
                <option key={p.id} value={p.id}>
                  {p.name} · {c?.shortName} · OVR {p.overall}
                </option>
              )
            })}
          </select>
        ) : null}

        {kind === 'smear_rival' ? (
          <select
            className="mt-3 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm"
            value={rivalClubId}
            onChange={(e) => setRivalClubId(e.target.value)}
          >
            <option value="">— เลือกคู่แข่ง —</option>
            {rivals.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · ชื่อเสียง {c.reputation}
              </option>
            ))}
          </select>
        ) : null}

        {!gate.ok ? (
          <p className="mt-3 text-xs font-medium text-rose-700">{gate.reason}</p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          <PrimaryButton
            disabled={!canSubmit}
            onClick={() =>
              plantRomano(kind, {
                playerId: playerId || undefined,
                rivalClubId: rivalClubId || undefined,
              })
            }
          >
            จ้าง Romano · {formatMoney(cost)}
          </PrimaryButton>
          <GhostButton
            onClick={() => setTab('romano')}
            className="!border-amber-300 !bg-amber-50/50"
          >
            ดูฟีด Romano
          </GhostButton>
        </div>
      </Panel>

      <Panel tone={tab === 'romano' ? 'warn' : 'default'}>
        <p className="text-sm text-slate-600">{meta.hint}</p>
        {tab === 'romano' ? (
          <p className="mt-1 text-xs text-amber-900/80">
            ไม่ใช่ข่าวทางการ — ความเชื่อมั่นสูง (≥85%) ≈ “Here we go” · สรุปบน{' '}
            <Link to="/portal" className="font-semibold underline underline-offset-2">
              พอร์ทัล
            </Link>
          </p>
        ) : null}
      </Panel>

      {tab === 'social' ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <Panel>
            <h3 className="text-sm font-bold text-slate-900">สโมสรติดตามเยอะสุด</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {clubLeaders.map((c) => (
                <li key={c.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    <span className="font-medium text-sky-800">{c.social.handle}</span>
                    <span className="text-slate-500"> · {c.shortName}</span>
                  </span>
                  <span className="shrink-0 tabular-nums font-semibold">
                    {formatFollowers(c.social.followers)}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h3 className="text-sm font-bold text-slate-900">นักเตะในทีมคุณ</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {squadSocial.map((p) => (
                <li key={p.id} className="flex justify-between gap-2">
                  <span className="truncate">
                    {p.social.verified ? '✓ ' : ''}
                    <span className="font-medium text-sky-800">{p.social.handle}</span>
                  </span>
                  <span className="shrink-0 tabular-nums">
                    {formatFollowers(p.social.followers)}
                    <span className="ml-1 text-[10px] text-rose-600">h{p.social.heat}</span>
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel>
            <h3 className="text-sm font-bold text-slate-900">ดาวโซเชียลลีก</h3>
            <ul className="mt-2 space-y-1.5 text-sm">
              {worldStars.map((p) => {
                const c = save.clubs.find((x) => x.id === p.clubId)
                return (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">
                      {p.social.verified ? '✓ ' : ''}
                      {p.social.handle}
                      <span className="text-slate-400"> · {c?.shortName}</span>
                    </span>
                    <span className="shrink-0 tabular-nums font-semibold">
                      {formatFollowers(p.social.followers)}
                    </span>
                  </li>
                )
              })}
            </ul>
          </Panel>
        </div>
      ) : null}

      {list.length === 0 ? (
        <Panel>
          <p className="text-sm text-slate-500">
            ยังว่าง — เล่นแมตช์เดย์ ทำดีล หรือจ้าง Romano เพื่อสร้างฟีด
          </p>
        </Panel>
      ) : (
        <ul className="space-y-3">
          {list.map((item) => (
            <li key={item.id}>
              <MediaCard item={item} showReliability={tab === 'romano'} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
