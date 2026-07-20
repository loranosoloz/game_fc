import type { TransferIntel, AddonIntel } from '@/game/transferIntel'
import { toneClass } from '@/game/transferIntel'
import { cn } from '@/lib/cn'
import { formatMoney } from '@/lib/format'

export function TransferIntelPanel({
  intel,
  addonIntel,
  onApplySuggestion,
}: {
  intel: TransferIntel
  addonIntel?: AddonIntel | null
  onApplySuggestion?: () => void
}) {
  const verdictColor =
    intel.verdict === 'strongly_yes' || intel.verdict === 'yes'
      ? 'bg-lime-100 text-lime-950 border-lime-400'
      : intel.verdict === 'hold'
        ? 'bg-amber-50 text-amber-950 border-amber-300'
        : 'bg-red-50 text-red-950 border-red-300'

  return (
    <div className="mt-4 space-y-3 border-t border-slate-100 pt-4">
      <div className={cn('rounded-lg border px-3 py-2', verdictColor)}>
        <p className="text-xs font-semibold tracking-wide uppercase">AI วิเคราะห์ตลาด</p>
        <p className="mt-1 text-base font-bold">{intel.verdictLabel}</p>
        <p className="text-xs opacity-80">ความมั่นใจ {intel.confidence}%</p>
        <p className="mt-1 text-[11px] leading-snug opacity-75">
          คำแนะนำนี้กระทบราคาที่ยอมรับได้จริงตอนยื่นซื้อ (ร่วมกับความสนิทเอเยนต์)
        </p>
        <p className="mt-2 text-sm font-semibold">{intel.headline}</p>
        <p className="mt-1 text-xs leading-relaxed opacity-90">{intel.summary}</p>
      </div>

      <div className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-950">
        <p className="text-xs font-semibold uppercase">ถ้าไม่ทำตาม</p>
        <p className="mt-1 leading-relaxed">{intel.ifSkip}</p>
      </div>

      <ul className="space-y-2">
        {intel.points.map((p) => (
          <li key={`${p.lens}-${p.title}`} className={cn('rounded-md border px-3 py-2 text-sm', toneClass(p.tone))}>
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-semibold">
                [{p.lens}] {p.title}
              </span>
              <span className="text-xs opacity-70">{p.score}/100</span>
            </div>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{p.why}</p>
          </li>
        ))}
      </ul>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
          <p className="font-semibold text-slate-500">เสียงแฟน</p>
          <p className="mt-1 leading-relaxed text-slate-800">{intel.fanVoice}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
          <p className="font-semibold text-slate-500">เสียงโค้ช</p>
          <p className="mt-1 leading-relaxed text-slate-800">{intel.coachVoice}</p>
        </div>
        <div className="rounded-md border border-slate-200 bg-white px-2 py-2">
          <p className="font-semibold text-slate-500">เสียงการเงิน</p>
          <p className="mt-1 leading-relaxed text-slate-800">{intel.financeVoice}</p>
        </div>
      </div>

      {onApplySuggestion ? (
        <button
          type="button"
          onClick={onApplySuggestion}
          className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          ใช้ราคาที่ AI แนะนำ (
          {formatMoney(intel.suggestedFee)}
          {intel.suggestedWage ? ` · ค่าเหนื่อย ${formatMoney(intel.suggestedWage)}` : ''})
        </button>
      ) : null}

      {addonIntel ? (
        <div className="space-y-3 border-t border-slate-100 pt-4">
          <div
            className={cn(
              'rounded-lg border px-3 py-2',
              addonIntel.verdict === 'strongly_yes' || addonIntel.verdict === 'yes'
                ? 'border-lime-300 bg-lime-50 text-lime-950'
                : addonIntel.verdict === 'hold'
                  ? 'border-amber-300 bg-amber-50 text-amber-950'
                  : 'border-red-300 bg-red-50 text-red-950',
            )}
          >
            <p className="text-xs font-semibold tracking-wide uppercase">Add-on / เงื่อนไข</p>
            <p className="mt-1 text-base font-bold">{addonIntel.verdictLabel}</p>
            <p className="mt-2 text-sm font-semibold">{addonIntel.headline}</p>
            <p className="mt-1 text-xs leading-relaxed opacity-90">{addonIntel.summary}</p>
          </div>

          <ul className="space-y-2">
            {addonIntel.points.map((p) => (
              <li
                key={`addon-${p.lens}-${p.title}`}
                className={cn('rounded-md border px-3 py-2 text-sm', toneClass(p.tone))}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-semibold">
                    [{p.lens}] {p.title}
                  </span>
                  <span className="text-xs opacity-70">{p.score}/100</span>
                </div>
                <p className="mt-1 text-xs leading-relaxed opacity-90">{p.why}</p>
              </li>
            ))}
          </ul>

          <div className="rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700">
            <p className="font-semibold text-slate-500">เสียงการเงิน (add-on)</p>
            <p className="mt-1 leading-relaxed">{addonIntel.financeVoice}</p>
            <p className="mt-2 font-semibold text-indigo-900">{addonIntel.suggestedNote}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
