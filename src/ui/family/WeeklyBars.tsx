interface WeeklyBarsProps {
  values: number[]
  /** Accessible description of the whole chart (it lists the values) */
  label: string
  /** Fill colour as a CSS colour */
  color?: string
  height?: number
}

/** Plain SVG bar chart drawn by us: one bar per week, value above each bar, no library */
export default function WeeklyBars({ values, label, color = '#8E5AA0', height = 96 }: WeeklyBarsProps) {
  const n = Math.max(1, values.length)
  const slot = 300 / n
  const bar = Math.min(22, slot - 6)
  const max = Math.max(1, ...values)
  const plot = height - 24
  return (
    <svg viewBox={`0 0 300 ${height}`} role="img" aria-label={label} className="h-auto w-full" data-testid="weekly-bars">
      <line x1="0" x2="300" y1={height - 14} y2={height - 14} stroke="#C9BFCF" strokeWidth="1.5" />
      {values.map((v, i) => {
        const h = v === 0 ? 0 : Math.max(3, (v / max) * plot)
        const x = i * slot + (slot - bar) / 2
        return (
          <g key={i} data-value={v}>
            {v > 0 && <rect x={x} y={height - 14 - h} width={bar} height={h} rx={3} fill={color} />}
            {v > 0 && (
              <text x={x + bar / 2} y={height - 17 - h} textAnchor="middle" fontSize="10" fontWeight="700" fill="#4A4A4A">
                {v}
              </text>
            )}
            <circle cx={x + bar / 2} cy={height - 7} r={i === n - 1 ? 3 : 1.6} fill={i === n - 1 ? color : '#C9BFCF'} />
          </g>
        )
      })}
    </svg>
  )
}
