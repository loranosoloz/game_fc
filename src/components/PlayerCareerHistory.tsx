import { useEffect, useState } from 'react'
import { getCareerByName, realCareerToView } from '@/game/careerDb'
import { careerSeasonTotals } from '@/game/playerCareerSeed'
import type { PlayerCareerProfile, PlayerCareerSeason } from '@/game/types'

/**
 * โหลดประวัติอาชีพจริง (Transfermarkt) จาก IndexedDB ตามชื่อ
 */
export function PlayerCareerHistory({
  playerName,
  playerAge = 25,
  compact = false,
}: {
  playerName: string
  playerAge?: number
  compact?: boolean
}) {
  const [careerSeasons, setCareerSeasons] = useState<PlayerCareerSeason[]>([])
  const [careerProfile, setCareerProfile] = useState<PlayerCareerProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    void getCareerByName(playerName)
      .then((real) => {
        if (cancelled) return
        if (!real) {
          setCareerSeasons([])
          setCareerProfile(null)
          setLoading(false)
          return
        }
        const view = realCareerToView(real, playerName, playerAge)
        setCareerSeasons(view.careerSeasons)
        setCareerProfile(view.careerProfile)
        setLoading(false)
      })
      .catch(() => {
        if (cancelled) return
        setCareerSeasons([])
        setCareerProfile(null)
        setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [playerName, playerAge])

  if (loading) {
    return <p className="text-xs text-slate-500">กำลังโหลดประวัติอาชีพ…</p>
  }

  if (careerSeasons.length === 0 && !careerProfile) {
    return (
      <p className="text-xs text-slate-500">
        ไม่พบประวัติอาชีพจริงสำหรับชื่อนี้ในฐานข้อมูล
      </p>
    )
  }

  const tot = careerSeasonTotals(careerSeasons)
  const seasonMaxH = compact ? 'max-h-40' : 'max-h-72'

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h4 className="text-sm font-semibold text-slate-900">ประวัติอาชีพ</h4>
        {careerProfile?.source === 'transfermarkt' ? (
          <span className="text-[10px] font-semibold tracking-wide text-emerald-700 uppercase">
            Transfermarkt
          </span>
        ) : null}
      </div>

      {careerProfile?.summaryTh ? (
        <p className="text-[11px] leading-relaxed text-pretty text-slate-600">
          {careerProfile.summaryTh}
        </p>
      ) : null}

      {careerProfile?.clubs && careerProfile.clubs.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">สโมสร</p>
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
          <ul className="mt-1 max-h-36 space-y-1 overflow-y-auto text-[11px] text-slate-700">
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
            {careerProfile.titles.slice(0, 20).map((t, i) => (
              <span
                key={`${t.year}-${t.label}-${i}`}
                className="rounded border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-950"
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
                    {w.champion ? ' ★' : ''}
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

      {careerSeasons.length > 0 ? (
        <div>
          <p className="text-[11px] font-bold tracking-wide text-slate-500 uppercase">
            สถิติรายฤดูกาล
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            รวม {tot.seasons} ฤดูกาล · {tot.apps} นัด · {tot.goals} ประตู · {tot.assists} แอสซิสต์
          </p>
          <div className={cnScroll(seasonMaxH)}>
            <table className="w-full text-left text-[11px]">
              <thead className="sticky top-0 bg-white">
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="py-1 pr-2 font-semibold">ฤดูกาล</th>
                  <th className="py-1 pr-2 font-semibold">ทีม</th>
                  <th className="py-1 pr-2 font-semibold">ลีก</th>
                  <th className="py-1 pr-2 font-semibold">นัด</th>
                  <th className="py-1 pr-2 font-semibold">ยิง</th>
                  <th className="py-1 font-semibold">แอส</th>
                </tr>
              </thead>
              <tbody>
                {[...careerSeasons].reverse().map((s, i) => (
                  <tr
                    key={`${s.label}-${s.clubName}-${i}`}
                    className="border-b border-slate-50 text-slate-800"
                  >
                    <td className="py-1 pr-2 tabular-nums whitespace-nowrap">{s.label}</td>
                    <td className="max-w-[9rem] truncate py-1 pr-2" title={s.clubName}>
                      {s.clubName}
                    </td>
                    <td
                      className="max-w-[7rem] truncate py-1 pr-2 text-slate-500 uppercase"
                      title={s.leagueId}
                    >
                      {s.leagueId ?? '—'}
                    </td>
                    <td className="py-1 pr-2 tabular-nums">{s.apps}</td>
                    <td className="py-1 pr-2 font-semibold tabular-nums">{s.goals}</td>
                    <td className="py-1 tabular-nums">{s.assists}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function cnScroll(maxH: string) {
  return `mt-1 overflow-auto ${maxH}`
}
