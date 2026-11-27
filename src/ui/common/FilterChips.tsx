export interface FilterOption<V extends string> {
  value: V
  label: string
  /** Decorative icon before the label */
  icon?: string
  /** Shown as a small badge; part of the accessible name ("De făcut 4") */
  count?: number
}

interface FilterChipsProps<V extends string> {
  /** Accessible name of the group, e.g. "Arată insulele" */
  label: string
  options: FilterOption<V>[]
  value: V
  onChange: (value: V) => void
  /** data-testid of the group; each chip gets `${testId}-${value}` */
  testId?: string
  /** Show the group label above the chips (default: screen readers only) */
  showLabel?: boolean
  /** One swipeable row instead of wrapping (long option lists on a phone) */
  scroll?: boolean
  className?: string
}

/**
 * One row of single-choice filter chips, used everywhere a list is long (island map, /practice, "Alege-ți
 * singur", parent summary, skill picker). Toggle buttons with aria-pressed, ≥ 44px targets, wrap at 360px.
 */
export default function FilterChips<V extends string>({
  label,
  options,
  value,
  onChange,
  testId,
  showLabel = false,
  scroll = false,
  className = '',
}: FilterChipsProps<V>) {
  return (
    <div className={className}>
      {showLabel && <p className="mb-1 px-1 text-xs font-extrabold uppercase tracking-wide text-ludiko-text/60">{label}</p>}
      <div
        role="group"
        aria-label={label}
        className={scroll ? '-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]' : 'flex flex-wrap gap-2'}
        data-testid={testId}
      >
        {options.map((o) => {
          const on = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              data-testid={testId ? `${testId}-${o.value}` : undefined}
              className={`inline-flex min-h-[44px] shrink-0 items-center whitespace-nowrap gap-1.5 rounded-full px-3.5 text-sm font-extrabold text-ludiko-text shadow-sm transition-transform active:scale-95 ${
                on ? 'bg-ludiko-purple ring-2 ring-ludiko-text/40' : 'bg-white'
              } ${o.count === 0 && !on ? 'opacity-60' : ''}`}
            >
              {o.icon && <span aria-hidden="true">{o.icon}</span>}
              <span>{o.label}</span>
              {o.count !== undefined && (
                <span className={`min-w-[1.5rem] rounded-full px-1.5 text-center text-xs ${on ? 'bg-white/80' : 'bg-ludiko-bg'}`}>
                  {o.count}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
