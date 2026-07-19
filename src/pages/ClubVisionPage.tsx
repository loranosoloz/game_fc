import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useGameStore } from '@/store/gameStore'
import { ensurePhase5 } from '@/game/save'
import { ensureBoard, boardLabel, refreshVisionKpis } from '@/game/board'
import {
  ensureOwner,
  OWNER_PERSONALITY_DESC,
  OWNER_PERSONALITY_LABEL,
} from '@/game/owner'
import { ensureFans, fanMoodLabel, fanTicketMultiplier } from '@/game/fans'
import { FAN_FACTION_LABEL, type FanFactionKey } from '@/game/clubAtmosphere'
import { ensureTakeover, verdictLabel, listInvestors } from '@/game/takeover'
import { ensureFacilities, FACILITY_LABEL, stadiumCapacityForTier } from '@/game/facilities'
import { ensureClubSocial, formatFollowers } from '@/game/social'
import { formatMoney } from '@/lib/format'
import { GhostButton, PageHeader, Panel, PrimaryButton, ProgressBar, StatTile } from '@/components/ui'

export function ClubVisionPage() {
  const saveRaw = useGameStore((s) => s.save)!
  const save = ensureFans(ensurePhase5(saveRaw))
  const requestBudget = useGameStore((s) => s.requestBoardBudget)
  const inviteOwner = useGameStore((s) => s.inviteOwnerStadium)
  const requestSupport = useGameStore((s) => s.requestPublicSupport)
  const callMeeting = useGameStore((s) => s.callBoardMeeting)
  const outreach = useGameStore((s) => s.outreachFans)
  const answerDemand = useGameStore((s) => s.answerOwnerDemand)
  const resolveFacility = useGameStore((s) => s.resolveFacilityProposal)
  const adviseTakeover = useGameStore((s) => s.adviseTakeover)
  const attemptTakeover = useGameStore((s) => s.attemptTakeover)
  const rejectTakeover = useGameStore((s) => s.rejectTakeover)
  const board = refreshVisionKpis({ ...save, board: ensureBoard(save) })
  const owner = ensureOwner(save)
  const facilities = ensureFacilities(save)
  const club = save.clubs.find((c) => c.id === save.humanClubId)
  const clubSocial = club ? ensureClubSocial(club).social : null
  const fans = save.fans
  const takeover = ensureTakeover(save)
  const [ask, setAsk] = useState(Math.round(owner.warChest * 0.15))
  const openOffers = takeover.offers.filter((o) => o.status === 'open')
  const investorCount = listInvestors().length
  const proposal = facilities.pendingProposal
  const canFundProposal = proposal ? (club?.balance ?? 0) >= proposal.cost : false

  if (board.sacked) {
    const career = save.career
    const openJobs = (career?.jobOffers ?? []).filter((o) => o.status === 'open')
    const acceptJob = useGameStore.getState().acceptJob
    const rejectJob = useGameStore.getState().rejectJob
    return (
      <div className="space-y-5">
        <PageHeader title="ว่างงาน" subtitle="คุณถูกปลด — เลือกงานใหม่จากตลาดผู้จัดการ" />
        <Panel tone="warn">
          <p className="font-semibold text-rose-900">{board.sackedNote}</p>
          <p className="mt-2 text-sm text-slate-700">
            ชื่อเสียงผู้จัดการ {save.managerReputation ?? 50}/100
            {career?.lastJobNote ? ` · ${career.lastJobNote}` : ''}
          </p>
        </Panel>
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">ข้อเสนองาน</h3>
          {openJobs.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              ยังไม่มีงานเปิด — รอการ์ดใหม่หลังเวลาผ่าน หรือเริ่มเกมใหม่จากหน้าแรก
            </p>
          ) : (
            <ul className="mt-3 space-y-3">
              {openJobs.map((j) => (
                <li key={j.id} className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3">
                  <p className="font-semibold">{j.clubName}</p>
                  <p className="text-xs text-slate-500">
                    ต้องการรีพ ≥ {j.reputationRequired} · ค่าเหนื่อย ~{formatMoney(j.wageWeekly)}
                    /สัปดาห์ · หมด MD{j.expiresMatchday}
                  </p>
                  <p className="mt-1 text-sm text-slate-600">{j.note}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <PrimaryButton onClick={() => acceptJob(j.id)}>รับงาน</PrimaryButton>
                    <GhostButton onClick={() => rejectJob(j.id)}>ปฏิเสธ</GhostButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/"
            className="mt-4 inline-block text-sm font-semibold underline underline-offset-2"
          >
            หรือเริ่มอาชีพใหม่จากหน้าแรก →
          </Link>
        </Panel>
      </div>
    )
  }

  const ticketPct = Math.round((fanTicketMultiplier(fans, save.matchday) - 1) * 100)
  const factions = Object.keys(FAN_FACTION_LABEL) as FanFactionKey[]
  const logs = fans.atmosphereLogs ?? []

  return (
    <div className="space-y-5">
      <PageHeader
        title="Club Vision"
        subtitle="เจ้าของมาสนาม · บอร์ด · กลุ่มแฟนหลายฝ่าย · ของบและคำสั่ง"
      />

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatTile
          label="บอร์ด"
          value={`${board.confidence}`}
          hint={boardLabel(board.confidence)}
          accent
        />
        <StatTile
          label="เจ้าของ"
          value={`${owner.relationship}`}
          hint={OWNER_PERSONALITY_LABEL[owner.personality]}
        />
        <StatTile
          label="แฟน"
          value={`${fans.mood}`}
          hint={fanMoodLabel(fans.mood)}
        />
        <StatTile
          label="War chest"
          value={formatMoney(owner.warChest)}
          hint={`เทคโอเวอร์ ${owner.takeoverHeat}/100`}
        />
        <StatTile
          label="โซเชียลคลับ"
          value={clubSocial ? formatFollowers(clubSocial.followers) : '—'}
          hint={clubSocial ? `${clubSocial.handle} · brand ${clubSocial.brand}` : undefined}
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">เจ้าของสโมสร</h3>
          <p className="mt-1 text-lg font-semibold">{owner.name}</p>
          <p className="text-xs text-slate-500">
            {OWNER_PERSONALITY_LABEL[owner.personality]} —{' '}
            {OWNER_PERSONALITY_DESC[owner.personality]}
          </p>
          <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ความสัมพันธ์</dt>
              <dd className="text-lg font-bold">{owner.relationship}</dd>
            </div>
            <div className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500">ความอดทน</dt>
              <dd className="text-lg font-bold">{owner.patience}</dd>
            </div>
          </dl>
          <ProgressBar value={owner.relationship} max={100} className="mt-3" />
          <p className="mt-2 text-sm text-slate-600">{owner.lastNote}</p>
          {owner.pendingDemand?.status === 'pending' ? (
            <div className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
              <p className="font-semibold">คำสั่งค้างจากเจ้าของ</p>
              <p className="mt-1">{owner.pendingDemand.note}</p>
              <p className="mt-1 text-xs">ครบ MD{owner.pendingDemand.dueMatchday}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PrimaryButton onClick={() => answerDemand(true)}>รับคำสั่ง</PrimaryButton>
                <GhostButton onClick={() => answerDemand(false)}>ปฏิเสธ</GhostButton>
              </div>
            </div>
          ) : null}
          {proposal ? (
            <div className="mt-3 rounded-md bg-violet-50 px-3 py-2 text-sm text-violet-950">
              <p className="font-semibold">ข้อเสนออัปเกรดจากผู้จัดการ</p>
              <p className="mt-1">{proposal.note}</p>
              <p className="mt-1 text-xs">
                {FACILITY_LABEL[proposal.kind]} · งบสโมสร{' '}
                {formatMoney(proposal.cost)}
                {proposal.targetCapacity
                  ? ` · เป้า ${proposal.targetCapacity.toLocaleString('th-TH')} ที่นั่ง`
                  : ''}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                บัญชีสโมสร {formatMoney(club?.balance ?? 0)}
                {canFundProposal ? ' · พอจ่าย' : ' · ไม่พอ — ต้องหาเงิน/ของบก่อน'}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <PrimaryButton
                  onClick={() => resolveFacility(true)}
                  disabled={!canFundProposal}
                >
                  อนุมัติ (หักเงินคลับ)
                </PrimaryButton>
                <GhostButton onClick={() => resolveFacility(false)}>ปฏิเสธ</GhostButton>
              </div>
            </div>
          ) : facilities.project ? (
            <p className="mt-3 text-xs text-amber-800">
              กำลังก่อสร้าง: {facilities.project.note} · เสร็จ MD{facilities.project.doneMatchday}
            </p>
          ) : (
            <p className="mt-3 text-xs text-slate-500">
              สนาม {facilities.stadiumTier}/{facilities.maxStadiumTier} (
              {stadiumCapacityForTier(facilities.stadiumTier).toLocaleString('th-TH')}/
              {stadiumCapacityForTier(facilities.maxStadiumTier).toLocaleString('th-TH')} ที่นั่ง)
              — เสนออัปเกรดที่หน้าการเงิน
            </p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <GhostButton onClick={() => inviteOwner()}>เชิญมาดูที่สนาม</GhostButton>
          </div>
          {(owner.stadiumLogs ?? []).length > 0 ? (
            <ul className="mt-3 max-h-28 space-y-1 overflow-y-auto text-xs text-slate-600">
              {owner.stadiumLogs.slice(0, 5).map((l) => (
                <li key={l.id}>
                  MD{l.matchday}: {l.note}
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        <Panel>
          <h3 className="text-sm font-bold text-slate-900">บอร์ด / Club Vision</h3>
          <p className="mt-1 text-sm text-slate-600">{board.lastNote}</p>
          <ProgressBar value={board.confidence} max={100} className="mt-3" />
          <p className="mt-1 text-xs text-slate-500">
            เป้าท็อป {board.targetMaxRank} · สไตล์ {board.preferredStyle} · streak ต่ำ{' '}
            {board.lowConfidenceStreak}
          </p>
          {board.publicSupport ? (
            <p className="mt-2 text-xs font-medium text-lime-800">✓ บอร์ดสนับสนุนสาธารณะอยู่</p>
          ) : null}
          {(board.transferFreezeUntil ?? -1) >= save.matchday ? (
            <p className="mt-2 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
              ตลาดถูกแช่แข็งถึง MD{board.transferFreezeUntil}
            </p>
          ) : null}
          {board.ultimatum ? (
            <p className="mt-3 rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-900">
              คำขาด: {board.ultimatum.note} · ชนะแล้ว {board.ultimatum.winsSoFar}/
              {board.ultimatum.winsNeeded} · ครบ MD{board.ultimatum.deadlineMatchday}
            </p>
          ) : null}
          <ul className="mt-3 space-y-1.5 text-sm">
            {board.kpis.map((k) => (
              <li key={k.id} className="flex justify-between gap-2">
                <span className={k.met ? 'text-lime-800' : 'text-slate-700'}>
                  {k.met ? '✓' : '○'} {k.label}
                </span>
                <span className="tabular-nums text-slate-500">
                  {typeof k.current === 'number' && k.current > 1000
                    ? formatMoney(k.current)
                    : k.current}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 flex flex-wrap gap-2">
            <GhostButton onClick={() => requestSupport()}>ขอแถลงสนับสนุน</GhostButton>
            <GhostButton onClick={() => callMeeting()}>ประชุมฉุกเฉิน</GhostButton>
          </div>
        </Panel>
      </div>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ตลาดเทคโอเวอร์</h3>
        <p className="mt-1 text-xs text-slate-500">
          กลุ่มทุน {investorCount} · ปีละไม่เกิน 1 รอบ · รอบถัดไปฤดูกาล{' '}
          {takeover.nextEligibleSeason}
          {takeover.approachedThisSeason ? ' · ปีนี้ผ่านรอบแล้ว' : ''} · ย่ำแย่ติดกัน{' '}
          {takeover.strugglingSeasons} ปี · ความสนใจ {takeover.marketInterest}/100 · ฮีท{' '}
          {owner.takeoverHeat}/100
        </p>
        <p className="mt-2 text-sm text-slate-600">
          กลุ่มทุนมาเป็นรอบปี (บางทีห่าง 2–3 ปี) — ถ้าทีมย่ำแย่/ติดหล่ม 2–3 ปีติด
          โอกาสมีคนเข้ามาซื้อสูงขึ้น แต่ยังต้องมีเหตุผลทั้งฝั่งขายและซื้อ
        </p>
        {takeover.lastDealNote ? (
          <p className="mt-2 text-xs text-slate-500">ล่าสุด: {takeover.lastDealNote}</p>
        ) : null}

        {openOffers.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">
            ยังไม่มีข้อเสนอเปิด — รอบปกติกลางฤดูกาล (ประมาณ MD12–16) หรือปลายปี ·
            ถ้าย่ำแย่หลายปีอาจดึงดูดทุนก่อนกำหนด
          </p>
        ) : (
          <ul className="mt-3 space-y-4">
            {openOffers.map((o) => (
              <li key={o.id} className="rounded-lg border border-slate-200 bg-slate-50/80 p-3">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <div>
                    <p className="font-semibold text-slate-900">{o.investorName}</p>
                    <p className="text-xs text-slate-500">
                      {o.investorOrigin} · หมดอายุ MD{o.expiresMatchday} ·{' '}
                      {verdictLabel(o.verdict)}
                    </p>
                  </div>
                  <p className="text-sm font-bold tabular-nums">รวม {o.overallScore}</p>
                </div>
                <p className="mt-1 text-xs text-slate-600">{o.conditions}</p>
                <p className="mt-1 text-xs text-slate-600">
                  บิด {formatMoney(o.bid)} · ฉีด {formatMoney(o.promisedInvestment)}
                </p>
                <dl className="mt-2 grid grid-cols-2 gap-1 text-center text-xs sm:grid-cols-4">
                  <div className="rounded bg-white px-1 py-1.5">
                    <dt className="text-slate-500">เจ้าของขาย</dt>
                    <dd className="font-bold">{o.sellerScore}</dd>
                  </div>
                  <div className="rounded bg-white px-1 py-1.5">
                    <dt className="text-slate-500">ทุนซื้อ</dt>
                    <dd className="font-bold">{o.buyerScore}</dd>
                  </div>
                  <div className="rounded bg-white px-1 py-1.5">
                    <dt className="text-slate-500">แฟน</dt>
                    <dd className="font-bold">{o.fanScore}</dd>
                  </div>
                  <div className="rounded bg-white px-1 py-1.5">
                    <dt className="text-slate-500">บอร์ด</dt>
                    <dd className="font-bold">{o.boardScore}</dd>
                  </div>
                </dl>
                <div className="mt-2 grid gap-2 text-xs text-slate-600 sm:grid-cols-2">
                  <div>
                    <p className="font-semibold text-slate-800">ทำไมเจ้าของจะขาย</p>
                    <ul className="list-disc pl-4">
                      {o.reasons.seller.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">ทำไมกลุ่มทุนจะซื้อ</p>
                    <ul className="list-disc pl-4">
                      {o.reasons.buyer.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">เสียงแฟน</p>
                    <ul className="list-disc pl-4">
                      {o.reasons.fans.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="font-semibold text-slate-800">มุมบอร์ด</p>
                    <ul className="list-disc pl-4">
                      {o.reasons.board.map((r) => (
                        <li key={r}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  คำแนะนำคุณ:{' '}
                  {o.managerAdvice === 'recommend'
                    ? 'แนะนำรับ'
                    : o.managerAdvice === 'caution'
                      ? 'ชั่งน้ำหนัก'
                      : o.managerAdvice === 'reject'
                        ? 'คัดค้าน'
                        : 'ยังไม่ออกความเห็น'}
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <GhostButton onClick={() => adviseTakeover(o.id, 'recommend')}>
                    แนะนำรับ
                  </GhostButton>
                  <GhostButton onClick={() => adviseTakeover(o.id, 'caution')}>
                    ชั่งน้ำหนัก
                  </GhostButton>
                  <GhostButton onClick={() => adviseTakeover(o.id, 'reject')}>คัดค้าน</GhostButton>
                  <PrimaryButton onClick={() => attemptTakeover(o.id)}>
                    ผลักดันให้เจ้าของพิจารณา
                  </PrimaryButton>
                  <GhostButton onClick={() => rejectTakeover(o.id)}>ปฏิเสธดีล</GhostButton>
                </div>
              </li>
            ))}
          </ul>
        )}
        {takeover.history.length > 0 ? (
          <ul className="mt-3 space-y-1 text-xs text-slate-500">
            {takeover.history.slice(0, 3).map((h, i) => (
              <li key={`${h.matchday}-${i}`}>
                MD{h.matchday}: {h.note}
              </li>
            ))}
          </ul>
        ) : null}
      </Panel>

      <Panel>
        <h3 className="text-sm font-bold text-slate-900">ขอฉีดเงินจากเจ้าของ</h3>
        <p className="mt-1 text-xs text-slate-500">
          โอกาสสำเร็จขึ้นกับความสัมพันธ์·ความมั่นใจบอร์ด·บุคลิกเจ้าของ · คูลดาวน์ 4 MD
        </p>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="grid gap-1 text-sm">
            <span>จำนวน (฿)</span>
            <input
              type="number"
              className="rounded-md border border-slate-300 px-3 py-2"
              value={ask}
              onChange={(e) => setAsk(Number(e.target.value))}
            />
          </label>
          <PrimaryButton onClick={() => requestBudget(ask)}>ส่งคำขอ</PrimaryButton>
          <GhostButton onClick={() => setAsk(Math.round(owner.warChest * 0.1))}>
            10% chest
          </GhostButton>
        </div>
      </Panel>

      <Panel tone={fans.protestActive ? 'warn' : 'default'}>
        <h3 className="text-sm font-bold text-slate-900">กลุ่มแฟนบอล</h3>
        <p className="mt-1 text-sm text-slate-600">{fans.lastVerdict}</p>
        <ProgressBar value={fans.mood} max={100} className="mt-3" />
        <dl className="mt-3 grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-5">
          {factions.map((key) => (
            <div key={key} className="rounded-md bg-slate-50 px-2 py-2">
              <dt className="text-slate-500 leading-tight">{FAN_FACTION_LABEL[key]}</dt>
              <dd className="text-lg font-bold">{fans.factions[key]}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-2 text-xs text-slate-500">
          ความคาดหวัง {fans.expectation} · ความจงรัก {fans.loyalty} · ตั๋วประมาณ{' '}
          {ticketPct >= 0 ? '+' : ''}
          {ticketPct}%
        </p>
        {fans.protestActive ? (
          <p className="mt-2 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-950">
            ⚠ ประท้วงกำลังเกิด — {fans.lastEvent}
            {fans.boycottUntilMatchday >= save.matchday
              ? ` · คว่ำบาตรตั๋วถึง MD${fans.boycottUntilMatchday}`
              : ''}
          </p>
        ) : (
          <p className="mt-2 text-xs text-slate-500">{fans.lastEvent}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {factions.map((key) => (
            <GhostButton key={key} onClick={() => outreach(key)}>
              เข้าหา {FAN_FACTION_LABEL[key].split(' / ')[0]}
            </GhostButton>
          ))}
        </div>
      </Panel>

      {logs.length > 0 ? (
        <Panel>
          <h3 className="text-sm font-bold text-slate-900">บันทึกบรรยากาศสนาม</h3>
          <ul className="mt-3 max-h-48 space-y-2 overflow-y-auto text-sm">
            {logs.slice(0, 12).map((l) => (
              <li key={l.id} className="rounded-md bg-slate-50 px-3 py-2">
                <span className="text-xs font-semibold uppercase text-slate-400">
                  {l.kind} · MD{l.matchday}
                </span>
                <p className="font-medium text-slate-900">{l.title}</p>
                <p className="text-slate-600">{l.body}</p>
              </li>
            ))}
          </ul>
        </Panel>
      ) : null}
    </div>
  )
}
