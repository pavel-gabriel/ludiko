import { COLORS } from './palette'
import { formatNumber } from './labels'
import { drawnSideValues, fitRect, hiddenDrawnSides, rectRatio, trianglePoints } from './shapeGeometry'
import type { Pt } from './shapeGeometry'

interface Props {
  shape: 'triangle' | 'square' | 'rectangle' | 'circle'
  sides?: number[]
  unit?: string
  hideSide?: number
  label: string
  lang: string
}

const W = 360
const MAX_W = 200
const MAX_H = 120
const PAD_Y = 30

const FILL: Record<Props['shape'], string> = {
  triangle: COLORS.pink,
  square: COLORS.blue,
  rectangle: COLORS.green,
  circle: COLORS.yellow,
}

/** Triangle, square, rectangle or circle with the side lengths written next to each side. */
export default function Shape({ shape, sides, unit, hideSide, label, lang }: Props) {
  const H = MAX_H + 2 * PAD_Y
  let points: Pt[] = []
  let circle: { cx: number; cy: number; r: number } | null = null

  if (shape === 'circle') {
    circle = { cx: W / 2, cy: H / 2, r: 56 }
  } else if (shape === 'triangle') {
    const pts = trianglePoints(sides, MAX_W + 20, MAX_H)
    const ox = (W - (MAX_W + 20)) / 2
    points = pts.map((p) => ({ x: ox + p.x, y: PAD_Y + p.y }))
  } else {
    const { w, h } = fitRect(rectRatio(shape, sides), MAX_W, MAX_H)
    const x0 = (W - w) / 2
    const y0 = PAD_Y + (MAX_H - h) / 2
    points = [{ x: x0, y: y0 }, { x: x0 + w, y: y0 }, { x: x0 + w, y: y0 + h }, { x: x0, y: y0 + h }]
  }

  const values = shape === 'circle' ? null : drawnSideValues(shape, sides)
  const hidden = shape === 'circle' || !sides ? new Set<number>() : hiddenDrawnSides(shape, sides.length, hideSide)
  const cx = points.length ? points.reduce((s, p) => s + p.x, 0) / points.length : 0
  const cy = points.length ? points.reduce((s, p) => s + p.y, 0) / points.length : 0
  const fill = FILL[shape]
  const text = (v: number) => `${formatNumber(v, lang)}${unit ? ` ${unit}` : ''}`

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {circle ? (
        <circle cx={circle.cx} cy={circle.cy} r={circle.r} fill={fill} stroke={COLORS.line} strokeWidth={3.5} />
      ) : (
        <polygon points={points.map((p) => `${p.x},${p.y}`).join(' ')} fill={fill} stroke={COLORS.line} strokeWidth={3.5} strokeLinejoin="round" />
      )}

      {/* right-angle marks keep squares/rectangles recognisable */}
      {(shape === 'square' || shape === 'rectangle') &&
        points.map((p, i) => {
          const dx = cx > p.x ? 1 : -1
          const dy = cy > p.y ? 1 : -1
          const s = 9
          return (
            <path key={i} d={`M ${p.x + dx * s} ${p.y} L ${p.x + dx * s} ${p.y + dy * s} L ${p.x} ${p.y + dy * s}`} fill="none" stroke={COLORS.line} strokeWidth={1.6} opacity={0.7} />
          )
        })}

      {values &&
        points.map((p, i) => {
          const q = points[(i + 1) % points.length]
          const mx = (p.x + q.x) / 2
          const my = (p.y + q.y) / 2
          // outward unit normal: from the centroid through the side's midpoint
          let nx = mx - cx
          let ny = my - cy
          const len = Math.hypot(nx, ny) || 1
          nx /= len
          ny /= len
          const isHidden = hidden.has(i)
          const str = isHidden ? '?' : text(values[i])
          const half = isHidden ? 15 : str.length * 4.4
          // push the label out far enough that its box clears the side
          const dist = 12 + Math.abs(nx) * half + Math.abs(ny) * 6
          const x = mx + nx * dist
          const y = my + ny * dist
          return isHidden ? (
            <g key={i} data-testid="side-unknown">
              <rect x={x - 15} y={y - 13} width={30} height={26} rx={8} fill={COLORS.white} stroke={COLORS.pinkDark} strokeWidth={2.5} strokeDasharray="5 3" />
              <text x={x} y={y + 6.5} textAnchor="middle" fontSize={18} fontWeight={800} fill={COLORS.pinkDark}>?</text>
            </g>
          ) : (
            <text key={i} x={x} y={y + 5} textAnchor="middle" fontSize={15} fontWeight={800} fill={COLORS.text} stroke={COLORS.white} strokeWidth={4} paintOrder="stroke">
              {str}
            </text>
          )
        })}
    </svg>
  )
}

