import { COLORS, EMOJI_FONT } from './palette'
import { clampCount, flowLayout, splitIntoGroups } from './geometry'

interface Props {
  icon: string
  count: number
  groups?: number
  label: string
  /** Upper bound on enlargement when there is spare room (default MAX_SCALE) */
  maxScale?: number
}

const CELL = 31
const PAD = 6
/** Never enlarge icons more than this when the drawing has spare room */
const MAX_SCALE = 1.6
const MAX_OBJECTS = 100

function gridCols(n: number): number {
  if (n <= 5) return Math.max(n, 1)
  if (n <= 10) return 5
  return 10
}

/** An emoji/icon repeated `count` times, optionally split into visible group boxes. */
export default function Objects({ icon, count, groups, label, maxScale = MAX_SCALE }: Props) {
  const total = clampCount(count, MAX_OBJECTS)
  const g = groups && groups > 1 ? Math.min(Math.floor(groups), 20) : 0

  const renderIcon = (cx: number, cy: number, key: string | number) => (
    <text key={key} x={cx} y={cy} textAnchor="middle" dy="0.35em" fontSize={24} fontFamily={EMOJI_FONT}>
      {icon}
    </text>
  )

  if (!g) {
    const cols = gridCols(total)
    const rows = Math.max(1, Math.ceil(total / cols))
    const gridW = cols * CELL
    const H = rows * CELL + 12
    /* Canvas fits the content, so the drawing stays legible inside small answer cards */
    const W = gridW + PAD * 2
    const ox = PAD
    return (
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
        style={{ display: 'block', maxWidth: W * maxScale, margin: '0 auto' }}>
        {Array.from({ length: total }, (_, i) =>
          renderIcon(ox + (i % cols) * CELL + CELL / 2, 6 + Math.floor(i / cols) * CELL + CELL / 2, i),
        )}
      </svg>
    )
  }

  const parts = splitIntoGroups(total, g)
  const boxes = parts.map((n) => {
    const rows = Math.max(1, Math.ceil(n / 5))
    const cols = Math.max(1, Math.ceil(n / rows))
    return { n, cols, rows, w: cols * CELL + 16, h: rows * CELL + 16 }
  })
  const layout = flowLayout(boxes, 356, 10, 12)
  const H = layout.height + 16
  const W = layout.width + PAD * 2
  const ox = PAD

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
      style={{ display: 'block', maxWidth: W * maxScale, margin: '0 auto' }}>
      {boxes.map((b, k) => {
        const pos = layout.positions[k]
        const x = ox + pos.x
        const y = 8 + pos.y
        return (
          <g key={k}>
            <rect x={x} y={y} width={b.w} height={b.h} rx={12} fill={COLORS.white} stroke={COLORS.purpleDark} strokeWidth={2.5} strokeDasharray="7 4" />
            {Array.from({ length: b.n }, (_, i) =>
              renderIcon(x + 8 + (i % b.cols) * CELL + CELL / 2, y + 8 + Math.floor(i / b.cols) * CELL + CELL / 2, i),
            )}
          </g>
        )
      })}
    </svg>
  )
}
