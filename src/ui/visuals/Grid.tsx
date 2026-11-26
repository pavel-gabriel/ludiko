import { COLORS, EMOJI_FONT } from './palette'

interface Props {
  rows: number
  cols: number
  /** Row-major; null = empty cell (dashed "?") */
  cells: (string | null)[]
  /** Index of the cell being asked about (gold) */
  highlight?: number
  label: string
}

const CELL = 44
const GAP = 4
const PAD = 5

/** Characters in a cell string (emoji count as one) */
const glyphCount = (s: string): number => [...s].length

/**
 * A rows x cols grid of symbols (emoji / digit / letter) with empty and highlighted cells.
 * A 4x4 grid also gets thicker 2x2 box borders (mini-sudoku).
 */
export default function Grid({ rows, cols, cells, highlight, label }: Props) {
  const R = Math.max(1, Math.min(rows, 10))
  const C = Math.max(1, Math.min(cols, 10))
  const W = C * CELL + (C - 1) * GAP + PAD * 2
  const H = R * CELL + (R - 1) * GAP + PAD * 2
  const sudoku = R === 4 && C === 4

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label}
      style={{ display: 'block', margin: '0 auto', maxWidth: W * 1.25 }}>
      {Array.from({ length: R * C }, (_, i) => {
        const r = Math.floor(i / C)
        const c = i % C
        const x = PAD + c * (CELL + GAP)
        const y = PAD + r * (CELL + GAP)
        const value = cells[i] ?? null
        const hl = i === highlight
        const empty = value === null
        const isEmoji = value !== null && !/^[\p{L}\p{N}]+$/u.test(value)
        const size = value === null ? 22 : isEmoji ? 26 : glyphCount(value) <= 2 ? 24 : glyphCount(value) === 3 ? 19 : 15
        return (
          <g key={i}>
            <rect x={x} y={y} width={CELL} height={CELL} rx={9}
              fill={hl ? COLORS.gold : empty ? COLORS.white : COLORS.yellow}
              stroke={hl ? COLORS.goldDark : COLORS.line}
              strokeWidth={hl ? 3 : 2}
              strokeDasharray={empty && !hl ? '5 3' : undefined} />
            <text x={x + CELL / 2} y={y + CELL / 2} textAnchor="middle" dy="0.35em" fontSize={size}
              fontFamily={isEmoji ? EMOJI_FONT : undefined} fontWeight={isEmoji ? undefined : 700}
              fill={empty ? COLORS.goldDark : COLORS.text}>
              {empty ? '?' : value}
            </text>
          </g>
        )
      })}
      {sudoku && (
        <g stroke={COLORS.purpleDark} strokeWidth={3} strokeLinecap="round">
          <line x1={W / 2} y1={PAD - 1} x2={W / 2} y2={H - PAD + 1} />
          <line x1={PAD - 1} y1={H / 2} x2={W - PAD + 1} y2={H / 2} />
          <rect x={PAD - 2} y={PAD - 2} width={W - 2 * PAD + 4} height={H - 2 * PAD + 4} rx={11} fill="none" />
        </g>
      )}
    </svg>
  )
}
