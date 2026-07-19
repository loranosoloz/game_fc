import { useGameStore } from '@/store/gameStore'
import cupFormat from '@/data/cupFormat.json'
import leagueCupFormat from '@/data/leagueCupFormat.json'
import trophyFormat from '@/data/trophyFormat.json'
import uclFormat from '@/data/uclFormat.json'
import uelFormat from '@/data/uelFormat.json'
import ueclFormat from '@/data/ueclFormat.json'
import aclFormat from '@/data/aclFormat.json'
import aclTwoFormat from '@/data/aclTwoFormat.json'
import aseanCupFormat from '@/data/aseanCupFormat.json'
import cwcFormat from '@/data/cwcFormat.json'
import { ensurePhase5 } from '@/game/save'
import {
  CONFED_LABEL,
  WC_SLOTS,
  ensureWorldCup,
  sortWcRows,
  worldCupQualStandingPreview,
  type Confederation,
} from '@/game/worldCup'

function RoundBlock({
  title,
  rounds,
  fixtures,
  nameOf,
  tone = 'slate',
}: {
  title: string
  champion?: string | null
  subtitle?: string
  rounds: Array<{ id: string; label: string; matchdayOffset?: number }>
  fixtures: Array<{
    id: string
    cupRound?: string
    homeClubId: string
    awayClubId: string
    played: boolean
    homeGoals?: number
    awayGoals?: number
    date: string
    matchday: number
  }>
  nameOf: (id: string) => string
  tone?: 'slate' | 'amber' | 'violet' | 'emerald'
}) {
  const border =
    tone === 'amber'
      ? 'border-amber-100'
      : tone === 'violet'
        ? 'border-violet-100'
        : tone === 'emerald'
          ? 'border-emerald-100'
          : 'border-slate-200'
  const bg =
    tone === 'amber'
      ? 'bg-amber-50/80'
      : tone === 'violet'
        ? 'bg-violet-50/80'
        : tone === 'emerald'
          ? 'bg-emerald-50/80'
          : 'bg-slate-50'

  return (
    <section className="space-y-4">
      <div className={`rounded-xl border ${border} bg-white/80 p-5`}>
        <h2 className="text-lg font-semibold">{title}</h2>
      </div>
      {rounds.map((round) => {
        const list = fixtures.filter((f) => f.cupRound === round.id)
        const md =
          round.matchdayOffset ??
          (list[0]?.matchday != null ? list[0].matchday : '—')
        return (
          <section key={`${title}-${round.id}`} className={`rounded-xl border ${border} bg-white/80 p-5`}>
            <h3 className="font-semibold">
              {round.label}{' '}
              <span className="text-sm font-normal text-slate-500">· MD {md}</span>
            </h3>
            {list.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">ยังไม่จับสลาก / รอรอบก่อนหน้า</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {list.map((f) => (
                  <li key={f.id} className={`flex justify-between rounded ${bg} px-2 py-1.5`}>
                    <span>
                      {nameOf(f.homeClubId)} vs {nameOf(f.awayClubId)}
                    </span>
                    <span className="font-semibold">
                      {f.played ? `${f.homeGoals}–${f.awayGoals}` : f.date}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )
      })}
    </section>
  )
}

export function CompetitionsPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureWorldCup(ensurePhase5(saveRaw))
  const nameOf = (id: string) => save.clubs.find((c) => c.id === id)?.name ?? id
  const wc = save.worldCup

  const byComp = (comp: string) =>
    save.fixtures
      .filter((f) => f.competition === comp)
      .sort((a, b) => a.matchday - b.matchday)

  const uclFx = byComp('ucl')
  const uelFx = byComp('uel')
  const ueclFx = byComp('uecl')
  const aclFxList = byComp('acl')
  const aclTwoFxList = byComp('acl_two')
  const aseanFxList = byComp('asean_cup')
  const cwcFxList = byComp('cwc')
  const superCupFx = byComp('super_cup')
  const hasEurope = uclFx.length > 0 || uelFx.length > 0 || ueclFx.length > 0
  const hasAsia = aclFxList.length > 0 || aclTwoFxList.length > 0 || aseanFxList.length > 0
  const hasCwc = cwcFxList.length > 0
  const hasSuperCup = superCupFx.length > 0
  const preview = wc ? worldCupQualStandingPreview(wc) : []
  const confedOrder = Object.keys(CONFED_LABEL) as Confederation[]
  const recentQual = (wc?.qualFixtures ?? [])
    .filter((f) => f.played && f.matchday === wc?.qualMatchday)
    .slice(0, 12)

  return (
    <div className="space-y-8">
      {hasSuperCup ? (
        <section className="space-y-3 rounded-xl border border-emerald-200 bg-emerald-50/70 p-5">
          <h2 className="text-lg font-semibold text-emerald-950">
            {save.superCup?.name ?? 'Super Cup'}
          </h2>
          <p className="text-sm text-emerald-900">
            นัดเปิดฤดูกาล · แชมป์ลีก vs แชมป์ถ้วยชาติ (ถ้าซ้ำใช้รองแชมป์ถ้วย / อันดับ 2)
          </p>
          <ul className="mt-2 space-y-1 text-sm">
            {superCupFx.map((f) => (
              <li
                key={f.id}
                className="flex justify-between rounded bg-white/80 px-3 py-2"
              >
                <span>
                  {nameOf(f.homeClubId)} vs {nameOf(f.awayClubId)}
                </span>
                <span className="font-semibold">
                  {f.played ? `${f.homeGoals}–${f.awayGoals}` : f.date}
                </span>
              </li>
            ))}
          </ul>
          {save.superCup?.championClubId ? (
            <p className="text-sm font-semibold text-emerald-900">
              แชมป์: {nameOf(save.superCup.championClubId)}
            </p>
          ) : null}
        </section>
      ) : null}

      {wc ? (
        <section className="space-y-4 rounded-xl border border-sky-200 bg-sky-50/70 p-5">
          <div>
            <h2 className="text-lg font-semibold text-sky-950">ฟุตบอลโลก {wc.finalsYear}</h2>
            <p className="mt-1 text-sm text-sky-900">{wc.note}</p>
            <p className="mt-2 text-xs text-sky-800">
              โควต้า 32 ทีม: UEFA {WC_SLOTS.UEFA} · CAF {WC_SLOTS.CAF} · AFC {WC_SLOTS.AFC} ·
              CONMEBOL {WC_SLOTS.CONMEBOL} · CONCACAF {WC_SLOTS.CONCACAF} · OFC {WC_SLOTS.OFC}
              {' · '}
              สถานะ:{' '}
              {wc.phase === 'waiting'
                ? `รอเปิดคัด · เริ่มฤดูกาล ${wc.qualStartSeason} (คัด ~2 ปี ก่อนชิง ${wc.finalsYear})`
                : wc.phase === 'qualifying'
                  ? `กำลังคัดเลือก MD ${wc.qualMatchday}/${wc.qualMaxMatchday} · ฤดูกาล ${wc.qualStartSeason}→${wc.finalsYear}`
                  : wc.phase === 'qualified'
                    ? `ผ่านแล้ว ${wc.qualified.length} ชาติ — รอฤดูร้อน ${wc.finalsYear}`
                    : 'จบรอบชิง'}
            </p>
            <p className="mt-1 text-[11px] text-sky-700">
              ก่อนเข้า 32 ทีมต้องคัดเลือกก่อน: เปิดคัดปี {wc.qualStartSeason} → เก็บแต้มทุก FIFA
              window ~2 ปี → รอบชิงปี {wc.finalsYear}
            </p>
          </div>

          {wc.championTh ? (
            <p className="rounded-lg bg-white/80 px-3 py-2 text-sm font-semibold text-emerald-900">
              แชมป์รอบล่าสุด: {wc.championTh}
            </p>
          ) : null}

          {wc.phase !== 'qualifying' && wc.qualified.length > 0 ? (
            <div>
              <h3 className="text-sm font-bold text-sky-950">32 ชาติที่ผ่าน</h3>
              <p className="mt-1 text-xs leading-relaxed text-sky-900">
                {wc.qualified.map((n) => wc.qualGroups.flatMap((g) => g.rows).find((r) => r.nation === n)?.nationTh ?? n).join(' · ')}
              </p>
            </div>
          ) : null}

          {preview.length > 0 && wc.phase === 'qualifying' ? (
            <div>
              <h3 className="text-sm font-bold text-sky-950">โซนผ่านชั่วคราว (ถ้าจบวันนี้)</h3>
              <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {preview.map((p) => (
                  <div key={p.confederation} className="rounded-lg border border-sky-100 bg-white/80 p-2 text-xs">
                    <p className="font-semibold text-sky-950">
                      {p.label} · {p.slots} สล็อต
                    </p>
                    <ol className="mt-1 space-y-0.5 text-sky-900">
                      {p.provisional.map((r, i) => (
                        <li key={r.nation}>
                          {i + 1}. {r.nationTh}{' '}
                          <span className="tabular-nums text-slate-500">
                            {r.points}pts GD{r.gd >= 0 ? '+' : ''}
                            {r.gd}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {recentQual.length > 0 ? (
            <div>
              <h3 className="text-sm font-bold text-sky-950">ผลคัดเลือกรอบล่าสุด (MD {wc.qualMatchday})</h3>
              <ul className="mt-1 columns-1 gap-x-4 text-xs text-sky-900 sm:columns-2">
                {recentQual.map((f) => (
                  <li key={f.id} className="mb-0.5 break-inside-avoid">
                    {f.home} {f.hg}–{f.ag} {f.away}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="text-xs text-sky-800">
              ตารางจะอัปเดตทุกครั้งที่เปิด FIFA window (พักทีมชาติ)
            </p>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            {confedOrder.flatMap((confed) =>
              (wc.qualGroups ?? [])
                .filter((g) => g.confederation === confed)
                .map((g) => (
                  <article key={g.id} className="rounded-lg border border-sky-100 bg-white/90 p-3">
                    <h3 className="text-sm font-semibold text-sky-950">{g.label}</h3>
                    <table className="mt-2 w-full text-[11px]">
                      <thead>
                        <tr className="text-left text-slate-400">
                          <th className="py-0.5">#</th>
                          <th>ชาติ</th>
                          <th className="text-right">P</th>
                          <th className="text-right">W</th>
                          <th className="text-right">D</th>
                          <th className="text-right">L</th>
                          <th className="text-right">GD</th>
                          <th className="text-right">Pts</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sortWcRows(g.rows).map((r, i) => (
                          <tr key={r.nation} className="border-t border-slate-100">
                            <td className="py-0.5 text-slate-400">{i + 1}</td>
                            <td className="font-medium text-slate-800">
                              {r.nationTh}
                              {!r.real ? (
                                <span className="ml-1 text-[9px] text-slate-400">sim</span>
                              ) : null}
                            </td>
                            <td className="text-right tabular-nums">{r.played}</td>
                            <td className="text-right tabular-nums">{r.won}</td>
                            <td className="text-right tabular-nums">{r.drawn}</td>
                            <td className="text-right tabular-nums">{r.lost}</td>
                            <td className="text-right tabular-nums">
                              {r.gf - r.ga >= 0 ? '+' : ''}
                              {r.gf - r.ga}
                            </td>
                            <td className="text-right font-semibold tabular-nums">{r.points}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </article>
                )),
            )}
          </div>

          {wc.finalsGroups && wc.finalsGroups.length > 0 ? (
            <div className="space-y-3 border-t border-sky-200 pt-4">
              <h3 className="text-sm font-bold text-sky-950">รอบชิง · กลุ่ม 32 ทีม (ล่าสุด)</h3>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {wc.finalsGroups.map((g) => (
                  <article key={g.id} className="rounded-lg border border-sky-100 bg-white/90 p-2 text-[11px]">
                    <p className="font-semibold">{g.label}</p>
                    <ol className="mt-1 space-y-0.5">
                      {sortWcRows(g.rows).map((r, i) => (
                        <li key={r.nation}>
                          {i + 1}. {r.nationTh}{' '}
                          <span className="tabular-nums text-slate-500">{r.points}pts</span>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
              {(wc.finalsMatches ?? []).filter((m) =>
                ['R16', 'QF', 'SF', 'Final'].includes(m.stage),
              ).length > 0 ? (
                <ul className="text-xs text-sky-900">
                  {(wc.finalsMatches ?? [])
                    .filter((m) => ['R16', 'QF', 'SF', 'Final'].includes(m.stage))
                    .map((m, i) => (
                      <li key={`${m.stage}-${i}`}>
                        {m.stage}: {m.homeTh} {m.hg}–{m.ag} {m.awayTh}
                      </li>
                    ))}
                </ul>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}

      {hasEurope ? (
        <>
          <p className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
            โควตาตายตัว (ยังไม่ใช้สัมประสิทธิ์): อันดับจบลีกก่อนหน้า{' '}
            <strong>1–4 → UCL</strong> · <strong>5–6 → Europa</strong> ·{' '}
            <strong>7–8 → Conference</strong>
          </p>
          <RoundBlock
            title={save.ucl?.name ?? 'UEFA Champions League'}
            rounds={uclFormat.rounds.map((r) => ({
              id: r.id,
              label: r.label,
              matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
            }))}
            fixtures={uclFx}
            nameOf={nameOf}
            tone="amber"
          />
          {save.ucl?.championClubId ? (
            <p className="-mt-6 text-sm font-semibold text-emerald-800">
              แชมป์ UCL: {nameOf(save.ucl.championClubId)}
            </p>
          ) : (
            <p className="-mt-6 text-sm text-slate-600">
              League phase → Top 8 → QF/SF/Final
            </p>
          )}

          <RoundBlock
            title={save.uel?.name ?? 'UEFA Europa League'}
            rounds={uelFormat.rounds.map((r) => ({
              id: r.id,
              label: r.label,
              matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
            }))}
            fixtures={uelFx}
            nameOf={nameOf}
            tone="violet"
          />
          {save.uel?.championClubId ? (
            <p className="-mt-6 text-sm font-semibold text-emerald-800">
              แชมป์ Europa: {nameOf(save.uel.championClubId)}
            </p>
          ) : (
            <p className="-mt-6 text-sm text-slate-600">อันดับ 5–6 · Play-off → QF/SF/Final</p>
          )}

          <RoundBlock
            title={save.uecl?.name ?? 'UEFA Conference League'}
            rounds={ueclFormat.rounds.map((r) => ({
              id: r.id,
              label: r.label,
              matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
            }))}
            fixtures={ueclFx}
            nameOf={nameOf}
            tone="emerald"
          />
          {save.uecl?.championClubId ? (
            <p className="-mt-6 text-sm font-semibold text-emerald-800">
              แชมป์ Conference: {nameOf(save.uecl.championClubId)}
            </p>
          ) : (
            <p className="-mt-6 text-sm text-slate-600">อันดับ 7–8 · Play-off → QF/SF/Final</p>
          )}
        </>
      ) : null}

      {hasCwc ? (
        <section className="space-y-4">
          <p className="rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3 text-sm text-amber-950">
            <strong>FIFA Club World Cup</strong> (สโมสรโลก) · 8 ทีม · แชมป์ UEFA/AFC + แขก
            CONMEBOL/CAF/CONCACAF/OFC + เจ้าภาพ · น็อกเอาต์ช่วงกลางฤดูกาล
            {save.cwcAccess?.lastChampionName
              ? ` · แชมป์ล่าสุด ${save.cwcAccess.lastChampionName}`
              : ''}
          </p>
          <RoundBlock
            title={save.cwc?.name ?? 'FIFA Club World Cup'}
            rounds={cwcFormat.rounds.map((r) => ({
              id: r.id,
              label: r.label,
              matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
            }))}
            fixtures={cwcFxList}
            nameOf={nameOf}
            tone="amber"
          />
          <p className="-mt-2 text-sm text-slate-600">
            {save.cwc?.championClubId
              ? `แชมป์สโมสรโลก: ${nameOf(save.cwc.championClubId)}`
              : 'QF → SF → Final'}
          </p>
        </section>
      ) : null}

      {hasAsia ? (
        <>
          <p className="rounded-xl border border-slate-200 bg-white/80 px-4 py-3 text-sm text-slate-700">
            ถ้วยเอเชีย 2 ชั้น:{' '}
            <strong>ACL Elite</strong> (ซาอุ 3 · ญี่ปุ่น 3 · เกาหลี 2 · ไทย 1) ·{' '}
            <strong>ACL Two</strong> (ไทย 2 · อาเซียน · ทีมรองจากลีกใหญ่) ·{' '}
            <strong>ASEAN</strong> (ถ้วยภูมิภาค — ไม่รวมทีม Elite)
          </p>
          {aclFxList.length > 0 ? (
            <>
              <RoundBlock
                title={save.acl?.name ?? 'AFC Champions League Elite'}
                rounds={aclFormat.rounds.map((r) => ({
                  id: r.id,
                  label: r.label,
                  matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
                }))}
                fixtures={aclFxList}
                nameOf={nameOf}
                tone="amber"
              />
              <p className="-mt-6 text-sm text-slate-600">
                {save.acl?.championClubId
                  ? `แชมป์ ACL Elite: ${nameOf(save.acl.championClubId)}`
                  : 'ชั้น 1 · น็อกเอาต์ R16 → Final'}
              </p>
            </>
          ) : null}
          {aclTwoFxList.length > 0 ? (
            <>
              <RoundBlock
                title={save.aclTwo?.name ?? 'AFC Champions League Two'}
                rounds={aclTwoFormat.rounds.map((r) => ({
                  id: r.id,
                  label: r.label,
                  matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
                }))}
                fixtures={aclTwoFxList}
                nameOf={nameOf}
                tone="violet"
              />
              <p className="-mt-6 text-sm text-slate-600">
                {save.aclTwo?.championClubId
                  ? `แชมป์ ACL Two: ${nameOf(save.aclTwo.championClubId)}`
                  : 'ชั้น 2 · ไทย/อาเซียนเน้น · R16 → Final'}
              </p>
            </>
          ) : null}
          {aseanFxList.length > 0 ? (
            <>
              <RoundBlock
                title={save.aseanCup?.name ?? 'ASEAN Club Championship'}
                rounds={aseanCupFormat.rounds.map((r) => ({
                  id: r.id,
                  label: r.label,
                  matchdayOffset: (r as { matchdayOffset?: number }).matchdayOffset,
                }))}
                fixtures={aseanFxList}
                nameOf={nameOf}
                tone="emerald"
              />
              <p className="-mt-6 text-sm text-slate-600">
                {save.aseanCup?.championClubId
                  ? `แชมป์ ASEAN: ${nameOf(save.aseanCup.championClubId)}`
                  : 'ถ้วยอาเซียน · QF → SF → Final'}
              </p>
            </>
          ) : null}
        </>
      ) : null}

      {!hasEurope && !hasAsia && !hasCwc ? (
        <section className="rounded-xl border border-amber-100 bg-amber-50/60 p-5 text-sm text-amber-950">
          <h2 className="text-lg font-semibold">ถ้วยทวีป</h2>
          <p className="mt-1 text-slate-700">
            เซฟนี้ไม่อยู่ในโควตาถ้วยยุโรปหรือเอเชีย — มีเฉพาะถ้วยในประเทศ
          </p>
        </section>
      ) : null}

      <RoundBlock
        title={save.cup.name}
        rounds={cupFormat.rounds}
        fixtures={byComp('cup')}
        nameOf={nameOf}
      />
      {save.cup.championClubId ? (
        <p className="-mt-6 text-sm font-semibold text-emerald-800">
          แชมป์ถ้วยชาติ: {nameOf(save.cup.championClubId)}
        </p>
      ) : (
        <p className="-mt-6 text-sm text-slate-600">ถ้วยใหญ่ · รวมทีมจากทั้งสองดิวิชัน (top 16 ตามชื่อเสียง)</p>
      )}

      <RoundBlock
        title={save.leagueCup?.name ?? 'League Cup'}
        rounds={leagueCupFormat.rounds}
        fixtures={byComp('league_cup')}
        nameOf={nameOf}
        tone="violet"
      />
      <p className="-mt-6 text-sm text-slate-600">ลีกคัพ · 32 ทีมจากดิวิชัน 1+2</p>

      <RoundBlock
        title={save.trophy?.name ?? 'Trophy'}
        rounds={trophyFormat.rounds}
        fixtures={byComp('trophy')}
        nameOf={nameOf}
        tone="emerald"
      />
      <p className="-mt-6 text-sm text-slate-600">ถ้วยลีกล่าง · เฉพาะดิวิชัน 2 (16 ทีม)</p>

      <section className="rounded-xl border border-slate-200 bg-white/80 p-5">
        <h2 className="text-lg font-semibold">ลีกอื่นในโลก</h2>
        <p className="mt-1 text-xs text-slate-500">
          ซิมตารางจริงทุกแมตช์เดย์ (คะแนน/GD/ผลนัด) · ใช้ตัดโควตายุโรปตอนจบฤดูกาล
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          {(save.worldPulse?.leagues ?? []).map((l) => (
            <article key={l.leagueId} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h3 className="font-semibold text-slate-900">{l.nameTh}</h3>
                <span className="text-[11px] font-medium text-slate-500">MD{l.matchday}</span>
              </div>
              <p className="mt-1 text-xs text-slate-600">{l.note}</p>
              {l.euroNote ? (
                <p className="mt-1 text-[11px] font-medium text-indigo-800">{l.euroNote}</p>
              ) : null}
              {l.recentResults && l.recentResults.length > 0 ? (
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  ผลรอบนี้: {l.recentResults.slice(0, 4).join(' · ')}
                </p>
              ) : null}
              {l.table && l.table.length > 0 ? (
                <table className="mt-2 w-full text-[11px]">
                  <thead>
                    <tr className="text-left text-slate-400">
                      <th className="py-0.5">#</th>
                      <th>ทีม</th>
                      <th className="text-right">P</th>
                      <th className="text-right">GD</th>
                      <th className="text-right">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {l.table.slice(0, 8).map((r, i) => (
                      <tr key={r.key} className="border-t border-slate-200/80">
                        <td className="py-0.5 text-slate-400">{i + 1}</td>
                        <td className="font-medium text-slate-800">{r.shortName}</td>
                        <td className="text-right tabular-nums">{r.played}</td>
                        <td className="text-right tabular-nums">
                          {r.gf - r.ga >= 0 ? '+' : ''}
                          {r.gf - r.ga}
                        </td>
                        <td className="text-right font-semibold tabular-nums">{r.points}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="mt-2 text-xs text-slate-500">
                  นำ {l.leader} · ที่ 2 {l.second}
                </p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
