import { COLORS } from './palette'
import { flowLayout, groupMoney, isCoin, splitMoney } from './geometry'

interface Props {
  amounts: number[]
  label: string
}

const W = 360
const COIN_R = 26
const NOTE_W = 100
const NOTE_H = 56
const PIECE_GAP = 6
const BADGE_H = 24

/** Note colours: generic pastels chosen by order, NOT by real banknote colours. */
const NOTE_FILLS = [COLORS.yellow, COLORS.pink, COLORS.blue, COLORS.green, COLORS.purple, COLORS.orange]
const NOTE_STROKES = [COLORS.goldDark, COLORS.pinkDark, COLORS.blueDark, COLORS.greenDark, COLORS.purpleDark, COLORS.orangeDark]

function Coin({ cx, cy, value }: { cx: number; cy: number; value: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={COIN_R} fill={COLORS.gold} stroke={COLORS.goldDark} strokeWidth={2.5} />
      <circle cx={cx} cy={cy} r={COIN_R - 5} fill="none" stroke={COLORS.goldDark} strokeWidth={1.2} strokeDasharray="2.5 2.5" />
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={value >= 100 ? 14 : 18} fontWeight={800} fill={COLORS.text}>
        {value}
      </text>
      <text x={cx} y={cy + 12} textAnchor="middle" fontSize={10} fontWeight={700} fill={COLORS.text}>
        {value === 1 ? 'ban' : 'bani'}
      </text>
    </g>
  )
}

function Note({ x, y, value, tier }: { x: number; y: number; value: number; tier: number }) {
  const { lei, bani } = splitMoney(value)
  const fill = NOTE_FILLS[tier % NOTE_FILLS.length]
  const stroke = NOTE_STROKES[tier % NOTE_STROKES.length]
  const amount = bani === 0 ? String(lei) : `${lei},${String(bani).padStart(2, '0')}`
  const unit = bani === 0 && lei === 1 ? 'leu' : 'lei'
  return (
    <g>
      <rect x={x} y={y} width={NOTE_W} height={NOTE_H} rx={6} fill={fill} stroke={stroke} strokeWidth={2.5} />
      <rect x={x + 5} y={y + 5} width={NOTE_W - 10} height={NOTE_H - 10} rx={3} fill="none" stroke={stroke} strokeWidth={1.2} strokeDasharray="3 3" />
      {/* simple original motif: a little star in each corner */}
      {[
        [x + 14, y + 14],
        [x + NOTE_W - 14, y + NOTE_H - 14],
      ].map(([sx, sy], i) => (
        <path key={i} d={`M ${sx} ${sy - 5} L ${sx + 1.5} ${sy - 1.5} L ${sx + 5} ${sy} L ${sx + 1.5} ${sy + 1.5} L ${sx} ${sy + 5} L ${sx - 1.5} ${sy + 1.5} L ${sx - 5} ${sy} L ${sx - 1.5} ${sy - 1.5} Z`} fill={stroke} opacity={0.7} />
      ))}
      <text x={x + NOTE_W / 2} y={y + NOTE_H / 2 + 2} textAnchor="middle" fontSize={bani === 0 ? 26 : 22} fontWeight={800} fill={COLORS.text}>
        {amount}
      </text>
      <text x={x + NOTE_W / 2} y={y + NOTE_H / 2 + 19} textAnchor="middle" fontSize={12} fontWeight={700} fill={COLORS.text}>
        {unit}
      </text>
    </g>
  )
}

/** Generic coins (bani) and notes (lei) drawn by us, grouped by value. */
export default function Money({ amounts, label }: Props) {
  const groups = groupMoney(amounts)
  const noteTiers = [...new Set(groups.filter((g) => !isCoin(g.value)).map((g) => g.value))].sort((a, b) => a - b)

  const sized = groups.map((g) => {
    const coin = isCoin(g.value)
    const pw = coin ? COIN_R * 2 : NOTE_W
    const ph = coin ? COIN_R * 2 : NOTE_H
    // wrap pieces inside the group (balanced rows), never overlap them
    const maxPerRow = Math.max(1, Math.floor((W - 16 + PIECE_GAP) / (pw + PIECE_GAP)))
    const rows = Math.ceil(g.count / maxPerRow)
    const cols = Math.ceil(g.count / rows)
    const gw = cols * pw + (cols - 1) * PIECE_GAP
    const gh = rows * ph + (rows - 1) * PIECE_GAP
    return { ...g, coin, pw, ph, cols, gw, gh }
  })

  const boxes = sized.map((s) => ({ w: s.gw, h: s.gh + (s.count > 1 ? BADGE_H : 0) }))
  const layout = flowLayout(boxes, W - 16, 18, 10)
  const H = Math.max(layout.height, 20) + 14
  const offsetX = (W - layout.width) / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {sized.map((s, k) => {
        const pos = layout.positions[k]
        const ox = offsetX + pos.x
        const oy = 6 + pos.y
        return (
          <g key={s.value}>
            {Array.from({ length: s.count }, (_, i) => {
              const px = ox + (i % s.cols) * (s.pw + PIECE_GAP)
              const py = oy + Math.floor(i / s.cols) * (s.ph + PIECE_GAP)
              return s.coin ? (
                <Coin key={i} cx={px + COIN_R} cy={py + COIN_R} value={s.value} />
              ) : (
                <Note key={i} x={px} y={py} value={s.value} tier={noteTiers.indexOf(s.value)} />
              )
            })}
            {s.count > 1 && (
              <g>
                <rect x={ox + s.gw / 2 - 20} y={oy + s.gh + 5} width={40} height={19} rx={9.5} fill={COLORS.white} stroke={COLORS.line} strokeWidth={1.5} />
                <text x={ox + s.gw / 2} y={oy + s.gh + 19} textAnchor="middle" fontSize={13} fontWeight={800} fill={COLORS.text}>
                  ×{s.count}
                </text>
              </g>
            )}
          </g>
        )
      })}
    </svg>
  )
}
