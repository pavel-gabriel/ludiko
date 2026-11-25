import { useId } from 'react'
import { COLORS } from './palette'
import { clampCount, polar } from './geometry'

interface Props {
  numerator: number
  denominator: number
  shape?: 'circle' | 'bar'
  label: string
  showText: boolean
}

const MAX_WHOLES = 4
const R = 40

function slicePath(cx: number, cy: number, r: number, i: number, d: number): string {
  if (d === 1) return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${2 * r} 0 a ${r} ${r} 0 1 0 ${-2 * r} 0 Z`
  const a0 = (i * 360) / d
  const a1 = ((i + 1) * 360) / d
  const p0 = polar(cx, cy, r, a0)
  const p1 = polar(cx, cy, r, a1)
  const large = a1 - a0 > 180 ? 1 : 0
  return `M ${cx} ${cy} L ${p0.x} ${p0.y} A ${r} ${r} 0 ${large} 1 ${p1.x} ${p1.y} Z`
}

/** Pie or bar split into `denominator` equal parts, `numerator` parts shaded (colour + diagonal stripes). */
export default function FractionVisual({ numerator, denominator, shape = 'circle', label, showText }: Props) {
  const uid = useId().replace(/:/g, '')
  const d = Math.max(1, clampCount(denominator, 24))
  const n = clampCount(numerator, d * MAX_WHOLES)
  const wholes = Math.min(MAX_WHOLES, Math.max(1, Math.ceil(n / d)))
  const hatch = `url(#${uid}-hatch)`

  const defs = (
    <defs>
      <pattern id={`${uid}-hatch`} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="7" height="7" fill={COLORS.pink} />
        <line x1="0" y1="0" x2="0" y2="7" stroke={COLORS.pinkDark} strokeWidth="2.2" />
      </pattern>
    </defs>
  )
  const text = showText ? `${n}/${d}` : ''

  if (shape === 'bar') {
    const barW = 280
    const barH = 36
    const gap = 12
    const textH = showText ? 30 : 0
    const H = wholes * barH + (wholes - 1) * gap + 20 + textH
    return (
      <svg viewBox={`0 0 320 ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
        {defs}
        {Array.from({ length: wholes }, (_, w) => {
          const y = 10 + w * (barH + gap)
          return (
            <g key={w}>
              {Array.from({ length: d }, (_, i) => {
                const shaded = w * d + i < n
                return (
                  <rect key={i} x={20 + (i * barW) / d} y={y} width={barW / d} height={barH} fill={shaded ? hatch : COLORS.white} stroke={COLORS.line} strokeWidth={2} />
                )
              })}
              <rect x={20} y={y} width={barW} height={barH} rx={3} fill="none" stroke={COLORS.line} strokeWidth={3} />
            </g>
          )
        })}
        {showText && (
          <text x={160} y={H - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill={COLORS.text}>
            {text}
          </text>
        )}
      </svg>
    )
  }

  const cell = 2 * R + 24
  const W = Math.max(160, wholes * cell)
  const textH = showText ? 30 : 0
  const H = 2 * R + 24 + textH
  const startX = (W - wholes * cell) / 2 + cell / 2
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {defs}
      {Array.from({ length: wholes }, (_, w) => {
        const cx = startX + w * cell
        const cy = R + 12
        return (
          <g key={w}>
            {Array.from({ length: d }, (_, i) => {
              const shaded = w * d + i < n
              return <path key={i} d={slicePath(cx, cy, R, i, d)} fill={shaded ? hatch : COLORS.white} stroke={COLORS.line} strokeWidth={2} strokeLinejoin="round" />
            })}
            <circle cx={cx} cy={cy} r={R} fill="none" stroke={COLORS.line} strokeWidth={3} />
          </g>
        )
      })}
      {showText && (
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={22} fontWeight={800} fill={COLORS.text}>
          {text}
        </text>
      )}
    </svg>
  )
}
