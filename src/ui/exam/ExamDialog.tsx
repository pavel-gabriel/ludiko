import { useEffect, useId, useRef, type ReactNode } from 'react'

interface ExamDialogProps {
  icon: string
  title: string
  body: string
  /** First action is the calm default (focused, big); the optional second one is quieter */
  primary: { label: string; onClick: () => void }
  secondary?: { label: string; onClick: () => void }
  children?: ReactNode
}

/** Small modal used by the exam runner for pause, time-up and leave confirmation. Esc triggers the primary action. */
export default function ExamDialog({ icon, title, body, primary, secondary }: ExamDialogProps) {
  const titleId = useId()
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={(e) => e.key === 'Escape' && primary.onClick()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"
      >
        <div className="text-5xl" aria-hidden="true">{icon}</div>
        <h2 id={titleId} className="mt-2 text-2xl font-extrabold text-ludiko-text">{title}</h2>
        <p className="mt-2 text-base font-semibold text-ludiko-text/80">{body}</p>
        <div className="mt-5 flex flex-col gap-3">
          <button
            ref={ref}
            type="button"
            onClick={primary.onClick}
            className="min-h-[52px] rounded-2xl bg-ludiko-green text-lg font-extrabold text-ludiko-text shadow-md active:scale-95"
          >
            {primary.label}
          </button>
          {secondary && (
            <button
              type="button"
              onClick={secondary.onClick}
              className="min-h-[48px] rounded-2xl bg-ludiko-blue text-base font-extrabold text-ludiko-text shadow-sm active:scale-95"
            >
              {secondary.label}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
