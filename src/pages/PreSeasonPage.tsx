import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import {
  CLIMATE_LABEL,
  PITCH_LABEL,
  acceptedPreSeasonOffer,
  estimateTourDateRange,
  isPreSeasonBlocking,
  leagueSeasonStart,
} from '@/game/preSeason'
import { formatMoney } from '@/lib/format'
import { PageHeader, Panel, PrimaryButton, GhostButton } from '@/components/ui'
import { cn } from '@/lib/cn'

export function PreSeasonPage() {
  const save = useGameStore((s) => s.save)!
  const acceptOffer = useGameStore((s) => s.acceptPreSeasonOffer)
  const skipTour = useGameStore((s) => s.skipPreSeason)
  const playMatch = useGameStore((s) => s.playNextPreSeasonMatch)
  const ps = save.preSeason
  const offer = acceptedPreSeasonOffer(save)
  const blocking = isPreSeasonBlocking(save)
  const seasonStart = ps?.seasonStart ?? leagueSeasonStart(save.season)

  if (!ps) {
    return (
      <div className="space-y-4">
        <PageHeader title="ปรีซีซั่น" subtitle="ยังไม่มีช่วงปรีซีซั่นในเซฟนี้" />
        <p className="text-sm text-slate-600">ขึ้นฤดูกาลใหม่หรือเริ่มอาชีพใหม่เพื่อเปิดทัวร์</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="ปรีซีซั่น / ทัวร์อุ่นเครื่อง"
        subtitle="เจ้าภาพเชิญหลายสโมสร — รวมทีมดังจากทั่วโลก · ทัวร์จบก่อน Community Shield / เปิดลีก · สนาม/อากาศส่งผลต่อล้า/เจ็บ"
      />

      <p className="rounded-lg border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
        {ps.note}
        {blocking ? (
          <span className="mt-1 block text-amber-800">
            บังคับเลือกทัวร์หรือข้าม · จบนัดอุ่นก่อน — ไม่งั้นเดินวัน / พักร้อน / เล่นลีกไม่ได้
          </span>
        ) : (
          <span className="mt-1 block text-emerald-800">
            พร้อมเปิดฤดูกาล —{' '}
            <Link to="/match" className="underline">
              ไปหน้าแมตช์
            </Link>
          </span>
        )}
      </p>

      {ps.phase === 'choosing' ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">ข้อเสนอจากเจ้าภาพ</h2>
            <GhostButton onClick={() => skipTour()}>ข้ามทัวร์ · ซ้อมบ้าน</GhostButton>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {ps.offers.map((o) => {
              const range = estimateTourDateRange(seasonStart, o.matches)
              return (
                <article
                  key={o.id}
                  className={cn(
                    'rounded-xl border p-4',
                    o.pitchQuality === 'terrible' || o.pitchQuality === 'poor'
                      ? 'border-rose-200 bg-rose-50/70'
                      : 'border-slate-200 bg-white/90',
                  )}
                >
                  <h3 className="font-bold text-slate-900">{o.hostNameTh}</h3>
                  <p className="text-xs text-slate-500">{o.hostName}</p>
                  <dl className="mt-3 space-y-1 text-sm text-slate-700">
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">ภูมิภาค</dt>
                      <dd>{o.regionTh}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">สนาม</dt>
                      <dd className="text-right">{o.venueTh}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">ช่วงทัวร์</dt>
                      <dd className="text-right text-xs">
                        {range.first} → {range.last}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">สภาพสนาม</dt>
                      <dd>{PITCH_LABEL[o.pitchQuality]}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">อากาศ</dt>
                      <dd>{CLIMATE_LABEL[o.climate]}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">นัด</dt>
                      <dd>{o.matches} นัด</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt className="text-slate-500">ผู้ชมประมาณ</dt>
                      <dd>{o.crowdEst.toLocaleString('th-TH')}</dd>
                    </div>
                    <div className="flex justify-between gap-2 font-semibold text-emerald-900">
                      <dt>ค่าปรากฏตัวรวม</dt>
                      <dd>{formatMoney(o.feeTotal)}</dd>
                    </div>
                  </dl>
                  <p className="mt-2 text-xs text-amber-900">{o.riskNoteTh}</p>
                  <p className="mt-2 text-xs font-medium text-slate-800">
                    คู่แข่งที่คุณเจอ:{' '}
                    {o.opponents
                      .map((op) => {
                        if (typeof op === 'string') return op
                        return op.famous ? `${op.name} ★` : op.name
                      })
                      .join(' · ')}
                  </p>
                  {o.coInvitees && o.coInvitees.length > 0 ? (
                    <p className="mt-1 text-[11px] text-indigo-800">
                      ทีมดังที่เจ้าภาพเชิญร่วมทัวร์ (ไม่ใช่แค่ทีมคุณ):{' '}
                      {o.coInvitees.join(' · ')}
                    </p>
                  ) : null}
                  <PrimaryButton className="mt-3 w-full" onClick={() => acceptOffer(o.id)}>
                    รับทัวร์นี้
                  </PrimaryButton>
                </article>
              )
            })}
          </div>
        </div>
      ) : null}

      {ps.phase === 'active' && offer ? (
        <Panel>
          <h2 className="text-lg font-semibold">{offer.hostNameTh}</h2>
          <p className="mt-1 text-sm text-slate-600">
            {offer.venueTh} · {PITCH_LABEL[offer.pitchQuality]} · {CLIMATE_LABEL[offer.climate]}
          </p>
          {offer.coInvitees?.length ? (
            <p className="mt-1 text-xs text-indigo-800">
              ร่วมทัวร์กับ: {offer.coInvitees.join(' · ')}
            </p>
          ) : null}
          <p className="mt-2 text-sm font-medium">
            นัดที่ {ps.matchesPlayed + 1}/{ps.matchesTotal} · ได้ไปแล้ว{' '}
            {formatMoney(ps.totalFees)}
          </p>
          {(() => {
            const nextOpp = offer.opponents[ps.matchesPlayed]
            const nextDate = ps.matchDates?.[ps.matchesPlayed]
            if (!nextOpp) return null
            const name = typeof nextOpp === 'string' ? nextOpp : nextOpp.name
            const famous = typeof nextOpp !== 'string' && nextOpp.famous
            return (
              <p className="mt-1 text-sm text-slate-800">
                คู่แข่งถัดไป: <span className="font-semibold">{name}</span>
                {famous ? ' ★ ทีมดัง' : ''}
                {nextDate ? (
                  <span className="mt-0.5 block text-xs text-slate-500">วันที่ {nextDate}</span>
                ) : null}
              </p>
            )
          })()}
          <p className="mt-1 text-xs text-amber-900">{offer.riskNoteTh}</p>
          <PrimaryButton className="mt-4" onClick={() => playMatch()}>
            เล่นนัดอุ่นถัดไป
          </PrimaryButton>
          {ps.results.length > 0 ? (
            <ul className="mt-4 space-y-2 text-sm">
              {ps.results.map((r, i) => (
                <li key={i} className="rounded bg-slate-50 px-3 py-2">
                  <span className="font-semibold">vs {r.opponent}</span> {r.gf}–{r.ga} · +
                  {formatMoney(r.fee)}
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {r.date ? `${r.date} · ` : ''}
                    {r.fatigueNote}
                    {r.injuredNames.length ? ` · เจ็บ: ${r.injuredNames.join(', ')}` : ''}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>
      ) : null}

      {(ps.phase === 'done' || ps.phase === 'skipped') && ps.results.length > 0 ? (
        <Panel>
          <h2 className="text-lg font-semibold">สรุปปรีซีซั่น</h2>
          <p className="mt-1 text-sm">รายได้รวม {formatMoney(ps.totalFees)}</p>
          <ul className="mt-3 space-y-1 text-sm">
            {ps.results.map((r, i) => (
              <li key={i}>
                {r.date ? `${r.date} · ` : ''}vs {r.opponent}: {r.gf}–{r.ga} · {formatMoney(r.fee)}
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
