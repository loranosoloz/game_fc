import { useEffect, useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { roleLabel, roleShort, squadRoleLabel } from '@/game/positions'
import {
  brandDealsLabelTh,
  ensurePlayerFame,
  fameLabelTh,
} from '@/game/playerFame'
import {
  ensurePlayerTacticalRoles,
  formatStyleLevelStars,
  type PlayerTacticalStyle,
  type StyleTrainOrder,
} from '@/game/playerTacticalRoles'
import {
  styleTrainOrderLabel,
  trainableStylesForPlayer,
} from '@/game/styleTraining'
import { tacticalRoleLabel, tacticalRoleShort } from '@/game/tacticalRoles'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'
import type {
  GameSave,
  InjuryRecord,
  LifestyleOrder,
  Player,
  PlayerCareerProfile,
  PlayerCareerSeason,
  SquadRole,
} from '@/game/types'
import { knowledgeOf, revealPa, revealGrowth, revealHidden, visibleAttrsDetailed } from '@/game/scouting'
import { agentLabelTh, AGENT_KIND_LABEL } from '@/game/agents'
import { personalitiesDb } from '@/game/attributes'
import {
  formatInjuryStatus,
  INJURY_TYPE_LABEL,
  TREATMENT_LABEL,
} from '@/game/medical'
import { BODY_PART_LABEL } from '@/game/bodyMap'
import { formatIllnessStatus, ILLNESS_TYPE_LABEL } from '@/game/illness'
import { BodyMapFigure } from '@/components/BodyMapFigure'
import { getActivity, recentLogsForPlayer } from '@/game/dailyLife'
import { formatBanStatus } from '@/game/discipline'
import { ensurePlayerSkills, skillDescription, skillLabel } from '@/game/playerSkills'
import { wantAwayLabel } from '@/game/wantAway'
import { affinityHintsTh } from '@/game/playerAmbition'
import { loyaltyHintsTh, loyaltyLabelTh } from '@/game/playerLoyalty'
import { ensurePlayerSocial, formatFollowers } from '@/game/social'
import {
  recentSocialForPlayer,
  socialDramaSummaryTh,
  SOCIAL_MOOD_LABEL,
} from '@/game/socialDrama'
import { PlayerFace } from '@/components/PlayerFace'
import { bioForPlayerName } from '@/data/world/playerBios'
import { formatGbp } from '@/game/playerBio'
import { fmInsideForPlayerName } from '@/data/world/fmInsidePlayers'
import { formatEur } from '@/game/fmInside'
import { formatLanguagesTh, playerLanguages } from '@/game/languages'
import { playerNationality } from '@/game/nationalTeams'
import { canRecallLoanDeal, ensureLoans } from '@/game/loans'
import { careerSeasonTotals } from '@/game/playerCareerSeed'
import { getCareerByName, realCareerToView } from '@/game/careerDb'

const ROLES: SquadRole[] = ['key', 'regular', 'squad', 'prospect']

const LIFESTYLE_OPTS: { id: LifestyleOrder; label: string }[] = [
  { id: 'none', label: 'ปล่อยอิสระ' },
  { id: 'curfew', label: 'เคอร์ฟิว' },
  { id: 'extra_gym', label: 'ยิมเพิ่ม' },
  { id: 'rest', label: 'พักฟื้น' },
  { id: 'media_quiet', label: 'เงียบสื่อ' },
]

export function SquadPage() {
  const save = useGameStore((s) => s.save)!
  const setSquadRole = useGameStore((s) => s.setSquadRole)
  const setCaptains = useGameStore((s) => s.setCaptains)
  const setLifestyleOrder = useGameStore((s) => s.setLifestyleOrder)
  const setStyleTrainOrder = useGameStore((s) => s.setStyleTrainOrder)
  const recallLoanDeal = useGameStore((s) => s.recallLoanDeal)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const squad = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => b.overall - a.overall)
  const ownedAway = save.players
    .filter(
      (p) =>
        p.loanParentClubId === save.humanClubId && p.clubId !== save.humanClubId,
    )
    .sort((a, b) => b.overall - a.overall)
  const selected = squad.find((p) => p.id === selectedId) ?? null
  const tactics = save.tacticsByClub[save.humanClubId]
  const xiSet = new Set(tactics?.startingXi ?? [])
  const captain = squad.find((p) => p.id === tactics?.captainId)
  const vice = squad.find((p) => p.id === tactics?.viceCaptainId)

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">สควอด</h2>
        <p className="text-sm text-slate-500">
          {squad.length} คน · CA/PA · คลิกดู status / แอตทริบิวต์
          {ownedAway.length > 0 ? ` · นอกทีม (ยืม/ยืมกลับ) ${ownedAway.length} คน` : ''}
        </p>

        <div
          className={cn(
            'mt-3 rounded-lg border px-3 py-3',
            captain && xiSet.has(captain.id)
              ? 'border-lime-300 bg-lime-50/80'
              : 'border-amber-300 bg-amber-50/90',
          )}
        >
          <p className="text-sm font-semibold text-slate-900">กัปตันทีม</p>
          <p className="mt-0.5 text-xs text-slate-600">
            ต้องเลือกก่อนเตะ · กัปตันต้องอยู่ใน XI
            {!captain
              ? ' — ยังไม่เลือก'
              : !xiSet.has(captain.id)
                ? ` — ${captain.name} ยังไม่อยู่ใน XI`
                : ''}
          </p>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1 text-xs">
              <span className="font-medium text-slate-600">กัปตัน</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={tactics?.captainId ?? ''}
                onChange={(e) => setCaptains(e.target.value || null, tactics?.viceCaptainId)}
              >
                <option value="">— เลือกกัปตัน —</option>
                {squad.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {roleShort(p.role)} · {p.overall}
                    {xiSet.has(p.id) ? ' · XI' : ''}
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1 text-xs">
              <span className="font-medium text-slate-600">รองกัปตัน</span>
              <select
                className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm"
                value={tactics?.viceCaptainId ?? ''}
                onChange={(e) =>
                  setCaptains(tactics?.captainId ?? null, e.target.value || null)
                }
              >
                <option value="">— ไม่บังคับ —</option>
                {squad
                  .filter((p) => p.id !== tactics?.captainId)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {roleShort(p.role)} · {p.overall}
                      {xiSet.has(p.id) ? ' · XI' : ''}
                    </option>
                  ))}
              </select>
            </label>
          </div>
          {captain ? (
            <p className="mt-2 text-xs text-slate-700">
              ตอนนี้: <strong>{captain.name}</strong>
              {vice ? ` · รอง ${vice.name}` : ''}
            </p>
          ) : null}
        </div>
        {ownedAway.length > 0 ? (
          <div className="mt-3 rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs text-teal-950">
            <p className="font-semibold">นักเตะของคุณที่อยู่นอกทีม</p>
            <ul className="mt-1.5 space-y-1.5">
              {ownedAway.map((p) => {
                const host = save.clubs.find((c) => c.id === p.clubId)
                const deal = ensureLoans(save).find(
                  (d) => d.status === 'active' && d.playerId === p.id,
                )
                const recallCheck = deal ? canRecallLoanDeal(save, deal) : null
                const isBuyLoanBack = deal?.kind === 'buy_loan_back'
                return (
                  <li
                    key={p.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded border border-teal-200/70 bg-white/70 px-2 py-1.5"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <PlayerFace name={p.name} size="xs" />
                      <span>
                        {p.name} · {roleShort(p.role)} · CA {p.overall} · ที่{' '}
                        {host?.shortName ?? p.clubId}
                        {isBuyLoanBack
                          ? ' · ซื้อ+ยืมกลับ (ฤดูกาลหน้าเข้าทีม)'
                          : deal
                            ? ` · ยืมถึง MD${deal.endMatchday}`
                            : ''}
                      </span>
                    </span>
                    {deal && !isBuyLoanBack ? (
                      <button
                        type="button"
                        className="rounded border border-rose-300 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-950 hover:bg-rose-100 disabled:opacity-50"
                        disabled={!recallCheck?.ok}
                        title={
                          recallCheck?.ok
                            ? 'เรียกกลับทีมคุณ'
                            : recallCheck && 'reason' in recallCheck
                              ? recallCheck.reason
                              : undefined
                        }
                        onClick={() => recallLoanDeal(deal.id)}
                      >
                        {recallCheck?.ok
                          ? 'เรียกกลับ'
                          : `ยังเรียกไม่ได้${
                              recallCheck && 'reason' in recallCheck
                                ? ` (${recallCheck.reason})`
                                : ''
                            }`}
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-2 font-medium">Pos</th>
                <th className="py-2 pr-2 font-medium" />
                <th className="py-2 pr-2 font-medium">ชื่อ</th>
                <th className="py-2 pr-2 font-medium">อายุ</th>
                <th className="py-2 pr-2 font-medium">OVR</th>
                <th className="py-2 pr-2 font-medium">CA</th>
                <th className="py-2 pr-2 font-medium">Learn</th>
                <th className="py-2 pr-2 font-medium">บทบาท</th>
                <th className="py-2 font-medium">Medical</th>
              </tr>
            </thead>
            <tbody>
              {squad.map((p) => (
                <tr
                  key={p.id}
                  className={cn(
                    'cursor-pointer border-b border-slate-100 hover:bg-slate-50',
                    selectedId === p.id && 'bg-sky-50',
                  )}
                  onClick={() => setSelectedId(p.id)}
                >
                  <td className="py-2 pr-2 font-semibold" title={roleLabel(p.role)}>
                    {roleShort(p.role)}
                  </td>
                  <td className="py-2 pr-2">
                    <PlayerFace name={p.name} size="xs" />
                  </td>
                  <td className="py-2 pr-2">
                    {p.name}
                    {p.isYouth ? <span className="ml-1 text-xs text-emerald-700">Yth</span> : null}
                  </td>
                  <td className="py-2 pr-2">{p.age}</td>
                  <td className="py-2 pr-2 font-semibold">{p.overall}</td>
                  <td className="py-2 pr-2">{p.ca}</td>
                  <td className="py-2 pr-2">{p.growth.learningRate}</td>
                  <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                    <select
                      className="rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
                      value={p.squadRole}
                      onChange={(e) => setSquadRole(p.id, e.target.value as SquadRole)}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {squadRoleLabel(r)}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2">
                    {p.injuryDays > 0 ? (
                      <span className="text-rose-600">{formatInjuryStatus(p)}</span>
                    ) : (p.illnessDays ?? 0) > 0 ? (
                      <span className="text-violet-700">{formatIllnessStatus(p)}</span>
                    ) : (
                      <span className="text-emerald-700">{p.condition}% sta</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PlayerDetailPanel
        save={save}
        player={selected}
        knowledge={selected ? knowledgeOf(save.scouting, selected.id) : 100}
        mentorName={
          selected?.mentorId
            ? (squad.find((p) => p.id === selected.mentorId)?.name ?? null)
            : null
        }
        diary={selected ? recentLogsForPlayer(save, selected.id, 10) : []}
        onLifestyleOrder={setLifestyleOrder}
        onStyleTrainOrder={setStyleTrainOrder}
      />
    </div>
  )
}

function StatusBar({ label, value, max = 20 }: { label: string; value: number; max?: number }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100))
  return (
    <li className="flex items-center gap-2 text-xs">
      <span className="w-20 shrink-0 text-slate-500">{label}</span>
      <span className="h-1.5 flex-1 overflow-hidden rounded bg-slate-100">
        <span className="block h-full rounded bg-slate-700" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-10 text-right font-medium">
        {max === 100 ? `${value}%` : `${value}/${max}`}
      </span>
    </li>
  )
}

function PlayerDetailPanel({
  save,
  player,
  knowledge,
  mentorName,
  diary,
  onLifestyleOrder,
  onStyleTrainOrder,
}: {
  save: GameSave
  player: Player | null
  knowledge: number
  mentorName: string | null
  diary: { date: string; labelTh: string; category: string; missTraining: boolean }[]
  onLifestyleOrder: (playerId: string, order: LifestyleOrder) => void
  onStyleTrainOrder: (playerId: string, order: StyleTrainOrder) => void
}) {
  const [careerSeasons, setCareerSeasons] = useState<PlayerCareerSeason[]>([])
  const [careerProfile, setCareerProfile] = useState<PlayerCareerProfile | null>(null)
  const [careerInjuries, setCareerInjuries] = useState<InjuryRecord[]>([])
  const [careerLoading, setCareerLoading] = useState(false)

  useEffect(() => {
    if (!player) {
      setCareerSeasons([])
      setCareerProfile(null)
      setCareerInjuries([])
      setCareerLoading(false)
      return
    }
    let cancelled = false
    setCareerLoading(true)
    void getCareerByName(player.name)
      .then((real) => {
        if (cancelled) return
        if (!real) {
          setCareerSeasons([])
          setCareerProfile(null)
          setCareerInjuries([])
          setCareerLoading(false)
          return
        }
        const view = realCareerToView(real, player.name, player.age)
        setCareerSeasons(view.careerSeasons)
        setCareerProfile(view.careerProfile)
        setCareerInjuries(view.injuryHistory)
        setCareerLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCareerSeasons([])
        setCareerProfile(null)
        setCareerInjuries([])
        setCareerLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [player?.id, player?.name, player?.age])

  if (!player) {
    return (
      <aside className="rounded-xl border border-slate-200 bg-white/80 p-5 text-sm text-slate-500">
        เลือกนักเตะเพื่อดู status · แอตทริบิวต์ · พลังแฝง
      </aside>
    )
  }
  const persona =
    personalitiesDb.archetypes.find((a) => a.id === player.personalityId)?.label ??
    player.personalityId
  const attrs = visibleAttrsDetailed(player.attrs, knowledge)
  const growth = revealGrowth(player.growth, knowledge)
  const hidden = revealHidden(player.hidden, knowledge)
  const history = [
    ...careerInjuries,
    ...(player.injuryHistory ?? []).filter((r) => r.source !== 'history'),
  ].slice(0, 16)
  const lastAct = player.lastActivityId ? getActivity(player.lastActivityId) : null
  const ban = formatBanStatus(player)
  const lifeOrder = (player.lifestyleOrder ?? 'none') as LifestyleOrder
  const bio = player.bio ?? bioForPlayerName(player.name)
  const fm = player.fmInside ?? fmInsideForPlayerName(player.name)
  const langs = playerLanguages(player, save)
  const nat = playerNationality(player, save)

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
      <div className="flex items-start gap-3">
        <PlayerFace name={player.name} size="lg" className="ring-2 ring-slate-200" />
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold">
            {player.name}{' '}
            <span className="text-sm font-normal text-slate-500">{roleShort(player.role)}</span>
          </h3>
          <p className="text-sm text-slate-600">
            OVR {player.overall} · CA {player.ca} · PA {revealPa(player.pa, knowledge)} · {persona}
          </p>
          <p className="text-xs text-slate-500">
            {nat} · ภาษา: {formatLanguagesTh(langs)}
          </p>
          <p className="text-xs text-slate-500">
            Scout {knowledge}% · {mentorName ? `mentor ${mentorName}` : 'no mentor'} ·{' '}
            {formatMoney(player.wage)}/สัปดาห์ · กระเป๋า {formatMoney(player.cash ?? 0)}
          </p>
          <p className="text-xs text-slate-600">
            เอเยนต์: {agentLabelTh(player)}
            {player.agentKind ? ` · ${AGENT_KIND_LABEL[player.agentKind]}` : ''}
          </p>
          <p className="text-xs text-slate-600">
            ภักดีต่อสโมสร: {player.clubLoyalty ?? '—'}
            /20 ({loyaltyLabelTh(player.clubLoyalty ?? 10)})
          </p>
          <p className="text-xs text-slate-600">
            สไตล์ถนัด:{' '}
            {(
              (ensurePlayerTacticalRoles(player).preferredTacticalRoles ??
                []) as PlayerTacticalStyle[]
            )
              .map((s) => {
                const xp = s.xp ?? 0
                return `${tacticalRoleShort(s.id)} ${formatStyleLevelStars(s.level)}${
                  s.level < 3 ? ` (${xp}%)` : ''
                }`
              })
              .join(' · ') || '—'}
          </p>
          {(() => {
            const st = ensurePlayerTacticalRoles(player)
            const target = st.styleTrainTarget
            const prog = st.styleTrainProgress ?? 0
            if (!target) return null
            const inSet = (st.preferredTacticalRoles ?? []).some((s) => s.id === target)
            return (
              <p className="text-xs text-indigo-800">
                กำลังฝึก: {tacticalRoleShort(target)}
                {!inSet ? ` · ปลดล็อก ${prog}%` : ''}
                {st.styleMismatchStreak && st.styleMismatchStreak >= 2
                  ? ` · ไม่ชอบบทบาทช่อง ${st.styleMismatchStreak} นัด`
                  : ''}
              </p>
            )
          })()}
          <div className="mt-1">
            <label className="text-[11px] text-slate-500">คำสั่งฝึกสไตล์</label>
            <select
              className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs"
              value={
                typeof player.styleTrainOrder === 'string' &&
                player.styleTrainOrder !== 'ai' &&
                player.styleTrainOrder !== 'lock'
                  ? player.styleTrainOrder
                  : (player.styleTrainOrder ?? 'ai')
              }
              onChange={(e) =>
                onStyleTrainOrder(player.id, e.target.value as StyleTrainOrder)
              }
            >
              <option value="ai">AI เลือกเป้า</option>
              <option value="lock">ล็อกเป้าปัจจุบัน</option>
              {trainableStylesForPlayer(player).map((id) => (
                <option key={id} value={id}>
                  บังคับ: {tacticalRoleLabel(id)}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {styleTrainOrderLabel(player.styleTrainOrder ?? 'ai')} · ★★★=เก่งมาก · ★=เล่นได้
            </p>
          </div>
          {loyaltyHintsTh(player)
            .slice(1)
            .map((h) => (
              <p key={h} className="text-[11px] text-emerald-800">
                {h}
              </p>
            ))}
          {fm?.heightCm ? (
            <p className="mt-1 text-xs text-slate-500">
              {fm.heightCm} cm
              {fm.positions ? ` · ${fm.positions}` : ''}
              {fm.caps != null ? ` · แคป ${fm.caps}/${fm.goalsIntl ?? 0}` : ''}
            </p>
          ) : null}
          {lastAct ? (
            <p className="mt-2 rounded-md border border-slate-100 bg-slate-50 px-2 py-1.5 text-xs text-slate-700">
              วันนี้: <strong>{lastAct.labelTh}</strong>
              <span className="text-slate-400"> · {lastAct.category}</span>
              {lastAct.missTraining ? (
                <span className="ml-1 font-semibold text-rose-700">· มาซ้อมไม่ทัน</span>
              ) : null}
            </p>
          ) : null}
          {ban ? (
            <p className="mt-1 rounded bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-900">
              {ban} · เหลืองฤดูกาล {player.seasonYellows ?? 0}
            </p>
          ) : null}
          {wantAwayLabel(player) ? (
            <p className="mt-1 rounded bg-rose-50 px-2 py-1 text-xs font-semibold text-rose-900">
              {wantAwayLabel(player)}
              {player.wantAway?.publicNews ? ' · สื่อรู้แล้ว' : ' · ยังเป็นเรื่องภายใน'}
              {player.wantAway?.intensity
                ? ` · กดดัน ${player.wantAway.intensity}/20`
                : ''}
              {player.wantAway?.reasonTh ? ` · ${player.wantAway.reasonTh}` : ''}
            </p>
          ) : null}
          {affinityHintsTh(player, save.clubs, knowledge).map((h) => (
            <p
              key={h}
              className="mt-1 rounded bg-indigo-50 px-2 py-1 text-xs text-indigo-950"
            >
              {h}
            </p>
          ))}
          {player.secretHandshake && knowledge >= 50 ? (
            <p className="mt-1 rounded bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-950">
              {player.secretHandshake.exposed
                ? 'สื่อ: มีสัญญาใจกับสโมสรอื่น'
                : 'วงใน: อาจไม่ต่อสัญญา (สัญญาใจ?)'}
            </p>
          ) : null}
          {player.refuseContractRenewal ? (
            <p className="mt-1 rounded bg-orange-50 px-2 py-1 text-xs font-semibold text-orange-950">
              ไม่ยอมต่อสัญญา — เสี่ยงย้ายฟรี · แฟนเกลียด
            </p>
          ) : null}
        </div>
      </div>

      {(player.careerHonours?.length ?? 0) > 0 ? (
        <div>
          <h4 className="text-sm font-semibold">รางวัลติดตัว</h4>
          <p className="mt-0.5 text-xs text-slate-500">สะสมถาวรในเซฟ · ไม่หายเมื่อเปลี่ยนฤดูกาล</p>
          <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs">
            {[...(player.careerHonours ?? [])].reverse().map((h) => (
              <li
                key={h.id}
                className={cn(
                  'rounded border px-2 py-1.5',
                  h.kind === 'ballon_dor'
                    ? 'border-amber-300 bg-amber-50 text-amber-950'
                    : h.kind === 'golden_boot' || h.kind === 'golden_glove'
                      ? 'border-sky-200 bg-sky-50 text-sky-950'
                      : 'border-slate-100 bg-slate-50 text-slate-800',
                )}
              >
                <p className="font-semibold">{h.label}</p>
                <p className="text-[11px] opacity-80">
                  ฤดูกาล {h.season}
                  {h.clubShort ? ` · ${h.clubShort}` : ''}
                  {h.detail ? ` · ${h.detail}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {careerLoading ? (
        <p className="text-xs text-slate-500">กำลังโหลดประวัติอาชีพ…</p>
      ) : null}

      {(careerSeasons.length > 0 || careerProfile) && !careerLoading ? (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold">ประวัติอาชีพ</h4>
          {careerProfile?.source === 'transfermarkt' ? (
            <p className="text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
              แหล่งข้อมูล Transfermarkt (จริง)
            </p>
          ) : null}
          {careerProfile?.summaryTh ? (
            <p className="text-[11px] leading-relaxed text-slate-600">
              {careerProfile.summaryTh}
            </p>
          ) : null}

          {careerProfile?.clubs && careerProfile.clubs.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                สโมสร
              </p>
              <ul className="mt-1 space-y-0.5 text-xs text-slate-800">
                {careerProfile.clubs.map((c) => (
                  <li key={`${c.clubName}-${c.fromYear}`}>
                    <span className="font-semibold">{c.clubName}</span>
                    <span className="text-slate-500">
                      {' '}
                      · {c.fromYear}–{c.toYear}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {careerProfile?.transfers && careerProfile.transfers.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                ประวัติย้าย
              </p>
              <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-700">
                {[...careerProfile.transfers].reverse().map((t, i) => (
                  <li key={`${t.year}-${t.toClub}-${i}`} className="rounded bg-slate-50 px-1.5 py-1">
                    <span className="font-semibold tabular-nums">{t.year}</span>
                    {' · '}
                    {t.fromClub} → {t.toClub}
                    {t.feeEur != null && t.kind === 'transfer'
                      ? ` · €${(t.feeEur / 1_000_000).toFixed(1)}ม.`
                      : t.kind === 'free'
                        ? ' · ฟรี'
                        : t.kind === 'loan'
                          ? ' · ยืม'
                          : t.kind === 'youth'
                            ? ' · เยาวชน'
                            : ''}
                    {t.noteTh ? ` — ${t.noteTh}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          {careerProfile?.titles && careerProfile.titles.length > 0 ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                แชมป์ / ถ้วย
              </p>
              <ul className="mt-1 flex flex-wrap gap-1">
                {careerProfile.titles.slice(0, 16).map((t, i) => (
                  <span
                    key={`${t.year}-${t.label}-${i}`}
                    className="rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950"
                    title={t.clubName ?? t.nation}
                  >
                    {t.year} · {t.labelTh}
                    {t.clubName ? ` (${t.clubName})` : ''}
                  </span>
                ))}
              </ul>
            </div>
          ) : null}

          {careerProfile?.intl ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                ทีมชาติ · ฟุตบอลโลก
              </p>
              <p className="mt-0.5 text-xs text-slate-700">
                {careerProfile.intl.nationTh} · แคป {careerProfile.intl.caps} · ประตูชาติ{' '}
                {careerProfile.intl.goals}
              </p>
              {careerProfile.intl.worldCups.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-700">
                  {careerProfile.intl.worldCups.map((w) => (
                    <li key={w.year}>
                      บอลโลก {w.year}: {w.apps} นัด · {w.goals} ประตู · {w.assists} แอส ·{' '}
                      <span className={w.champion ? 'font-bold text-amber-800' : ''}>
                        {w.bestStageTh}
                        {w.champion ? ' 🏆' : ''}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-0.5 text-[11px] text-slate-500">ยังไม่เคยเข้าฟุตบอลโลก</p>
              )}
              {careerProfile.intl.majorTournaments.length > 0 ? (
                <ul className="mt-1 space-y-0.5 text-[11px] text-slate-600">
                  {careerProfile.intl.majorTournaments.map((t) => (
                    <li key={`${t.year}-${t.name}`}>
                      {t.nameTh} {t.year}: {t.apps} นัด · {t.goals} ประตู · {t.bestStageTh}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {(careerSeasons?.length ?? 0) > 0 ? (
            <div>
              <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
                สถิติรายฤดูกาล / รวมต่อสโมสร
              </p>
              {(() => {
                const tot = careerSeasonTotals(careerSeasons)
                return (
                  <p className="mt-0.5 text-xs text-slate-500">
                    รวม {tot.seasons} ฤดูกาล · {tot.apps} นัด · {tot.goals} ประตู · {tot.assists}{' '}
                    แอสซิสต์
                  </p>
                )
              })()}
              <div className="mt-1 max-h-40 overflow-auto">
                <table className="w-full text-left text-[11px]">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-1 pr-1 font-semibold">ฤดูกาล</th>
                      <th className="py-1 pr-1 font-semibold">ทีม</th>
                      <th className="py-1 pr-1 font-semibold">นัด</th>
                      <th className="py-1 pr-1 font-semibold">ยิง</th>
                      <th className="py-1 font-semibold">แอส</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...careerSeasons].reverse().map((s, i) => (
                      <tr
                        key={`${s.label}-${s.clubName}-${i}`}
                        className="border-b border-slate-50 text-slate-800"
                      >
                        <td className="py-1 pr-1 tabular-nums">{s.label}</td>
                        <td className="max-w-[6rem] truncate py-1 pr-1" title={s.clubName}>
                          {s.clubName}
                        </td>
                        <td className="py-1 pr-1 tabular-nums">{s.apps}</td>
                        <td className="py-1 pr-1 tabular-nums font-semibold">{s.goals}</td>
                        <td className="py-1 tabular-nums">{s.assists}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold">คำสั่งไลฟ์สไตล์</h4>
        <select
          className="mt-1 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm"
          value={lifeOrder}
          onChange={(e) => onLifestyleOrder(player.id, e.target.value as LifestyleOrder)}
        >
          {LIFESTYLE_OPTS.map((o) => (
            <option key={o.id} value={o.id}>
              {o.label}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-slate-500">
          เคอร์ฟิวลดผับ · ยิมเพิ่มซ้อม · พักฟื้นเน้นฟื้น · เงียบสื่อลดดราม่า
        </p>
      </div>

      {diary.length > 0 ? (
        <div>
          <h4 className="text-sm font-semibold">ไดอารี่ล่าสุด</h4>
          <ul className="mt-2 max-h-36 space-y-1 overflow-y-auto text-xs text-slate-700">
            {diary.map((row) => (
              <li key={`${row.date}-${row.labelTh}`} className="flex gap-2 border-b border-slate-50 pb-1">
                <span className="shrink-0 text-slate-400">{row.date.slice(5)}</span>
                <span className="min-w-0 flex-1">
                  {row.labelTh}
                  {row.missTraining ? <span className="ml-1 text-rose-600">· ขาดซ้อม</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold">Status</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Stamina" value={player.condition} max={100} />
          <StatusBar label="Sharpness" value={player.sharpness} max={100} />
          <StatusBar label="Form" value={player.form} />
          <StatusBar label="Morale" value={player.morale} />
          <StatusBar label="Happiness" value={player.happiness ?? player.morale} />
          <StatusBar label="Media" value={player.mediaHandling ?? 10} />
        </ul>
        {(() => {
          const social = ensurePlayerSocial(player).social
          const posts = recentSocialForPlayer(player, 5)
          const moodLine = socialDramaSummaryTh(player)
          return (
            <div className="mt-2 space-y-1.5">
              <p className="rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-950">
                {social.verified ? '✓ ' : ''}
                <span className="font-semibold">{social.handle}</span>
                {' · '}
                {formatFollowers(social.followers)} ผู้ติดตาม · heat {social.heat} · โพสต์/
                สัปดาห์ ~{social.postsWeek}
                {social.mood && social.mood !== 'chill'
                  ? ` · ${SOCIAL_MOOD_LABEL[social.mood]}`
                  : ''}
              </p>
              {(() => {
                const famed = ensurePlayerFame(player)
                return (
                  <p className="rounded-md bg-amber-50 px-2 py-1.5 text-xs text-amber-950">
                    ความดัง {famed.fame ?? 0}/100 ({fameLabelTh(famed.fame ?? 0)})
                    {' · '}
                    แฟนคลับ {formatFollowers(famed.fanClubSize ?? 0)}
                    {' · '}
                    แอนตี้ {formatFollowers(famed.antiFanSize ?? 0)}
                    <br />
                    <span className="text-[11px] text-amber-900/80">
                      พรีเซ็นเตอร์: {brandDealsLabelTh(famed.brandDeals)}
                      {(famed.brandDeals?.length ?? 0) > 0
                        ? ` · รวม ~${formatMoney(
                            (famed.brandDeals ?? []).reduce((s, d) => s + d.weeklyPay, 0),
                          )}/สัปดาห์`
                        : ''}
                    </span>
                  </p>
                )
              })()}
              {moodLine ? (
                <p className="text-[11px] font-medium text-violet-900">{moodLine}</p>
              ) : null}
              {posts.length > 0 ? (
                <ul className="space-y-1 rounded-md border border-slate-100 bg-white/80 px-2 py-1.5">
                  {posts.map((post) => (
                    <li key={post.id} className="text-[11px] leading-snug text-slate-700">
                      <span className="font-semibold text-slate-500">{post.fromHandle}</span>
                      {' · '}
                      {post.text}
                      <span className="text-slate-400"> · ♥{post.likes}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          )
        })()}
        {player.injuryDays > 0 ? (
          <p className="mt-2 rounded bg-rose-50 px-2 py-1.5 text-xs text-rose-900">
            เจ็บ: {player.injuryType ? INJURY_TYPE_LABEL[player.injuryType] : '—'}
            {player.injuryBodyPart ? ` · ${BODY_PART_LABEL[player.injuryBodyPart]}` : ''} ·{' '}
            {player.injuryDays} วัน · รักษา{' '}
            {player.treatment ? TREATMENT_LABEL[player.treatment] : '—'}
          </p>
        ) : (player.illnessDays ?? 0) > 0 ? (
          <p className="mt-2 rounded bg-violet-50 px-2 py-1.5 text-xs text-violet-900">
            ป่วย: {player.illnessType ? ILLNESS_TYPE_LABEL[player.illnessType] : '—'} ·{' '}
            {player.illnessDays} วัน · ไม่พร้อมลงแข่ง
          </p>
        ) : (
          <p className="mt-2 text-xs text-emerald-700">พร้อมลงแข่ง · stamina {player.condition}%</p>
        )}
        {history.length > 0 ? (
          <div className="mt-2">
            <p className="text-xs font-semibold text-slate-700">
              ประวัติเจ็บ {history.length} ครั้ง
              {history.some((h) => h.chronic) ? (
                <span className="ml-1 text-rose-700">(มีเรื้อรัง)</span>
              ) : null}
            </p>
            <ul className="mt-1 max-h-28 space-y-1 overflow-y-auto text-[11px] text-slate-600">
              {history.slice(0, 8).map((h, i) => (
                <li
                  key={`${h.date ?? i}-${h.type}-${h.bodyPart ?? ''}`}
                  className={cn(
                    'rounded px-1.5 py-1',
                    h.chronic ? 'bg-rose-50 text-rose-900' : 'bg-slate-50',
                  )}
                >
                  {h.date ? `${h.date} · ` : ''}
                  {INJURY_TYPE_LABEL[h.type]}
                  {h.bodyPart ? ` / ${BODY_PART_LABEL[h.bodyPart]}` : ''}
                  {` · ${h.days} วัน`}
                  {h.chronic ? ' · เรื้อรัง' : ''}
                  {h.noteTh ? ` — ${h.noteTh}` : ''}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div>
        <h4 className="text-sm font-semibold">แผนที่ร่างกาย</h4>
        <div className="mt-2">
          <BodyMapFigure player={player} compact />
        </div>
      </div>

      <div>
        <h4 className="text-sm font-semibold">
          พลังแฝง ({ensurePlayerSkills(player).length}/10 สล็อต)
        </h4>
        <ul className="mt-2 flex flex-col gap-1.5">
          {ensurePlayerSkills(player).map((id) => (
            <li
              key={id}
              className="rounded border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-xs text-emerald-900"
              title={skillDescription(id)}
            >
              <span className="font-medium">{skillLabel(id)}</span>
              <span className="mt-0.5 block text-[11px] font-normal text-emerald-800/80">
                {skillDescription(id)}
              </span>
            </li>
          ))}
          {Array.from({ length: Math.max(0, 10 - ensurePlayerSkills(player).length) }).map((_, i) => (
            <li
              key={`empty-${i}`}
              className="rounded border border-dashed border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-400"
            >
              ว่าง — ซ้อม/ลงเล่นเพื่อปลดล็อก
            </li>
          ))}
        </ul>
        <p className="mt-1.5 text-[11px] text-slate-500">
          ซ้อม / ลงเล่น / อายุน้อย → มีโอกาสปลดล็อกสล็อตว่าง
        </p>
      </div>

      {fm ? (
        <div>
          <h4 className="text-sm font-semibold">FMInside Status</h4>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {fm.wageEurPw != null ? (
              <>
                <dt className="text-slate-500">ค่าเหนื่อย</dt>
                <dd>{formatEur(fm.wageEurPw)}/สัปดาห์</dd>
              </>
            ) : null}
            {fm.sellValueEur != null ? (
              <>
                <dt className="text-slate-500">มูลค่าขาย</dt>
                <dd>{formatEur(fm.sellValueEur)}</dd>
              </>
            ) : null}
            {fm.contractEnd ? (
              <>
                <dt className="text-slate-500">สัญญาหมด</dt>
                <dd>{fm.contractEnd}</dd>
              </>
            ) : null}
            {fm.leftFoot != null || fm.rightFoot != null ? (
              <>
                <dt className="text-slate-500">เท้า</dt>
                <dd>
                  L {fm.leftFoot ?? '—'} · R {fm.rightFoot ?? '—'}
                </dd>
              </>
            ) : null}
          </dl>
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
              <div key={title} className="mt-3">
                <h5 className="text-xs font-semibold text-slate-600">{title}</h5>
                <ul className="mt-1 grid max-h-36 grid-cols-2 gap-x-2 gap-y-0.5 overflow-y-auto text-xs">
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
          {fm.bestRolesIn && fm.bestRolesIn.length > 0 ? (
            <p className="mt-2 text-xs text-slate-600">
              Best in: {fm.bestRolesIn.slice(0, 3).map((r) => `${r.name} ${r.score}`).join(' · ')}
            </p>
          ) : null}
        </div>
      ) : null}

      {bio ? (
        <div>
          <h4 className="text-sm font-semibold">ประวัติ (FM26)</h4>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
            {bio.nationality ? (
              <>
                <dt className="text-slate-500">สัญชาติ</dt>
                <dd>{bio.nationality}</dd>
              </>
            ) : null}
            {bio.dob ? (
              <>
                <dt className="text-slate-500">วันเกิด</dt>
                <dd>{bio.dob}</dd>
              </>
            ) : null}
            {bio.valueGbp != null ? (
              <>
                <dt className="text-slate-500">มูลค่า £</dt>
                <dd>{formatGbp(bio.valueGbp)}</dd>
              </>
            ) : null}
            {bio.peaked || bio.developNote ? (
              <>
                <dt className="text-slate-500">พัฒนา</dt>
                <dd>
                  {bio.peaked ? 'พีคแล้ว · ' : ''}
                  {bio.developNote ?? '—'}
                </dd>
              </>
            ) : null}
          </dl>
        </div>
      ) : null}

      <div>
        <h4 className="text-sm font-semibold">Growth</h4>
        <ul className="mt-1 grid grid-cols-2 gap-1 text-xs">
          {(Object.keys(growth) as (keyof typeof growth)[]).map((k) => (
            <li key={k}>
              {k} {growth[k] ?? '???'}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold">Hidden</h4>
        <ul className="mt-1 grid grid-cols-2 gap-1 text-xs text-slate-600">
          {(Object.keys(hidden) as (keyof typeof hidden)[]).map((k) => (
            <li key={k}>
              {k} {hidden[k] ?? '???'}
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h4 className="text-sm font-semibold">Attributes (1–99)</h4>
        <ul className="mt-1 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto text-xs">
          {attrs.map((row) => (
            <li key={row.key} className="flex items-center justify-between gap-2">
              <span className="text-slate-500">{row.key}</span>
              <span className={cn('tabular-nums', row.known ? 'font-medium' : 'text-slate-400')}>
                {row.display}
                {row.known ? <span className="text-slate-400">/99</span> : null}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
