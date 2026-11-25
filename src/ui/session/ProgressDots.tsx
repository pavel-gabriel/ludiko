interface ProgressDotsProps {
  total: number
  /** index of the item on screen */
  current: number
  /** per slot: true = right first try, false = missed, null/undefined = not answered yet */
  outcomes: (boolean | null | undefined)[]
  label: string
}

/**
 * Path of small stepping stones. Missed items are amber (gentle), never red, and the
 * count is also given in words so colour is never the only signal.
 */
export default function ProgressDots({ total, current, outcomes, label }: ProgressDotsProps) {
  return (
    <div className="mb-4 flex flex-col items-center gap-1" role="group" aria-label={label}>
      <ol className="flex w-full items-center justify-center gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const o = outcomes[i]
          const tone =
            o === true
              ? 'bg-green-400 border-green-500'
              : o === false
                ? 'bg-amber-300 border-amber-400'
                : i === current
                  ? 'bg-ludiko-pink border-ludiko-text/60'
                  : 'bg-white border-gray-300'
          return (
            <li
              key={i}
              aria-current={i === current ? 'step' : undefined}
              className={`h-3.5 min-w-0 flex-1 rounded-full border-2 transition-colors ${tone} ${i === current ? 'scale-y-125' : ''}`}
              style={{ maxWidth: '2rem' }}
            />
          )
        })}
      </ol>
      <span className="text-xs font-semibold text-ludiko-text/70" aria-hidden="true">
        {label}
      </span>
    </div>
  )
}
