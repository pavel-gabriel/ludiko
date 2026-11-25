interface ProgressBarProps {
  /** 0..1 */
  value: number
  label: string
  className?: string
  thin?: boolean
}

/** Chunky progress bar with an accessible label */
export default function ProgressBar({ value, label, className = '', thin = false }: ProgressBarProps) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100)
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      aria-label={label}
      className={`${thin ? 'h-2' : 'h-4'} w-full overflow-hidden rounded-full bg-white shadow-inner ${className}`}
    >
      <div className="h-full rounded-full bg-ludiko-green transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  )
}
