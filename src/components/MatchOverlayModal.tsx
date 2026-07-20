import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** Modal เต็มจอ — ลอยเหนือสนาม/นักเตะทุกอย่าง (z-300) */
export function MatchOverlayModal({
  open,
  title,
  children,
  onClose,
  dismissOnBackdrop = false,
  className,
}: {
  open: boolean
  title?: string
  children: ReactNode
  onClose?: () => void
  dismissOnBackdrop?: boolean
  className?: string
}) {
  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {dismissOnBackdrop && onClose ? (
        <button
          type="button"
          className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]"
          aria-label="ปิด"
          onClick={onClose}
        />
      ) : (
        <div className="absolute inset-0 bg-slate-950/80 backdrop-blur-[2px]" aria-hidden />
      )}
      <div
        className={cn(
          'relative z-[301] max-h-[min(92dvh,820px)] w-full max-w-lg overflow-y-auto rounded-xl border-2 border-slate-200 bg-white p-4 shadow-2xl sm:p-5',
          className,
        )}
      >
        {title ? (
          <p className="text-[10px] font-bold tracking-wider text-slate-500 uppercase">{title}</p>
        ) : null}
        {children}
      </div>
    </div>
  )
}
