import { useState } from 'react'
import { useGameStore } from '@/store/gameStore'
import { roleLabel, roleShort, squadRoleLabel } from '@/game/positions'
import { formatMoney } from '@/lib/format'
import { cn } from '@/lib/cn'
import type { Player, SquadRole } from '@/game/types'
import { knowledgeOf, revealPa, revealGrowth, revealHidden, visibleAttrsDetailed } from '@/game/scouting'
import { personalitiesDb } from '@/game/attributes'
import {
  formatInjuryStatus,
  INJURY_TYPE_LABEL,
  TREATMENT_LABEL,
} from '@/game/medical'
import { BODY_PART_LABEL } from '@/game/bodyMap'
import { formatIllnessStatus, ILLNESS_TYPE_LABEL } from '@/game/illness'
import { BodyMapFigure } from '@/components/BodyMapFigure'
import { getActivity } from '@/game/dailyLife'
import { formatBanStatus } from '@/game/discipline'
import { ensurePlayerSkills, skillLabel } from '@/game/playerSkills'
import { ensurePlayerSocial, formatFollowers } from '@/game/social'

const ROLES: SquadRole[] = ['key', 'regular', 'squad', 'prospect']

export function SquadPage() {
  const save = useGameStore((s) => s.save)!
  const setSquadRole = useGameStore((s) => s.setSquadRole)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const squad = save.players
    .filter((p) => p.clubId === save.humanClubId)
    .sort((a, b) => b.overall - a.overall)
  const selected = squad.find((p) => p.id === selectedId) ?? null

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">สควอด</h2>
        <p className="text-sm text-slate-500">
          {squad.length} คน · CA/PA · คลิกดู status / แอตทริบิวต์
        </p>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-xs tracking-wide text-slate-500 uppercase">
                <th className="py-2 pr-2 font-medium">Pos</th>
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
                      <span className="text-emerald-700">{p.condition}%</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <PlayerDetailPanel
        player={selected}
        knowledge={selected ? knowledgeOf(save.scouting, selected.id) : 100}
        mentorName={
          selected?.mentorId
            ? (squad.find((p) => p.id === selected.mentorId)?.name ?? null)
            : null
        }
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
  player,
  knowledge,
  mentorName,
}: {
  player: Player | null
  knowledge: number
  mentorName: string | null
}) {
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
  const history = player.injuryHistory ?? []
  const lastAct = player.lastActivityId ? getActivity(player.lastActivityId) : null
  const ban = formatBanStatus(player)

  return (
    <aside className="space-y-4 rounded-xl border border-slate-200 bg-white/80 p-5">
      <div>
        <h3 className="text-lg font-semibold">
          {player.name}{' '}
          <span className="text-sm font-normal text-slate-500">{roleShort(player.role)}</span>
        </h3>
        <p className="text-sm text-slate-600">
          OVR {player.overall} · CA {player.ca} · PA {revealPa(player.pa, knowledge)} · {persona}
        </p>
        <p className="text-xs text-slate-500">
          Scout {knowledge}% · {mentorName ? `mentor ${mentorName}` : 'no mentor'} ·{' '}
          {formatMoney(player.wage)}/สัปดาห์ · กระเป๋า {formatMoney(player.cash ?? 0)}
        </p>
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
      </div>

      <div>
        <h4 className="text-sm font-semibold">Status</h4>
        <ul className="mt-2 space-y-1.5">
          <StatusBar label="Condition" value={player.condition} max={100} />
          <StatusBar label="Sharpness" value={player.sharpness} max={100} />
          <StatusBar label="Form" value={player.form} />
          <StatusBar label="Morale" value={player.morale} />
          <StatusBar label="Happiness" value={player.happiness ?? player.morale} />
          <StatusBar label="Media" value={player.mediaHandling ?? 10} />
        </ul>
        {(() => {
          const social = ensurePlayerSocial(player).social
          return (
            <p className="mt-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-950">
              {social.verified ? '✓ ' : ''}
              <span className="font-semibold">{social.handle}</span>
              {' · '}
              {formatFollowers(social.followers)} ผู้ติดตาม · heat {social.heat} · โพสต์/
              สัปดาห์ ~{social.postsWeek}
            </p>
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
          <p className="mt-2 text-xs text-emerald-700">พร้อมลงแข่ง · condition {player.condition}%</p>
        )}
        {history.length > 0 ? (
          <p className="mt-1 text-xs text-slate-500">
            ประวัติเจ็บ {history.length} ครั้งล่าสุด:{' '}
            {history
              .slice(0, 3)
              .map((h) =>
                h.bodyPart
                  ? `${INJURY_TYPE_LABEL[h.type]}/${BODY_PART_LABEL[h.bodyPart]}`
                  : INJURY_TYPE_LABEL[h.type],
              )
              .join(', ')}
          </p>
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
          สกิลพิเศษ ({ensurePlayerSkills(player).length}/10)
        </h4>
        <ul className="mt-2 flex flex-wrap gap-1.5">
          {ensurePlayerSkills(player).map((id) => (
            <li
              key={id}
              className="rounded border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs text-slate-700"
            >
              {skillLabel(id)}
            </li>
          ))}
        </ul>
      </div>

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
        <h4 className="text-sm font-semibold">Attributes</h4>
        <ul className="mt-1 grid max-h-48 grid-cols-2 gap-1 overflow-y-auto text-xs">
          {attrs.map((row) => (
            <li key={row.key} className="flex justify-between gap-2">
              <span className="text-slate-500">{row.key}</span>
              <span className={row.known ? 'font-medium' : 'text-slate-400'}>{row.display}</span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
