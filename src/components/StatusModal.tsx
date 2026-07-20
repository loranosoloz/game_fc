import { useEffect, useRef } from 'react'
export function StatusModal({
  message,
  onClose,
}: {
  message: string
  onClose: () => void
}) {
  const okRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    okRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[2px]"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="alertdialog"
        aria-labelledby="status-modal-title"
        aria-describedby="status-modal-body"
        className="w-full max-w-md rounded-xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-100 px-5 py-4">
          <p id="status-modal-title" className="text-sm font-bold text-slate-900">
            แจ้งเตือน
          </p>
        </div>
        <p id="status-modal-body" className="px-5 py-4 text-sm leading-relaxed text-slate-700">
          {message}
        </p>
        <div className="flex justify-end border-t border-slate-100 px-5 py-3">
          <button
            ref={okRef}
            type="button"
            onClick={onClose}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-lime-300 hover:bg-slate-800"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  )
}
