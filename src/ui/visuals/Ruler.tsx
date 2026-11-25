import { COLORS } from './palette'
import { formatNumber } from './labels'
import { rulerLabelStride } from './shapeGeometry'

interface Props {
  to: number
  unit: 'cm' | 'm'
  from?: number
  objectEnd?: number
  objectLabel?: string
  label: string
  lang: string
}

const W = 360
const PAD = 20
const OBJ_H = 24
const RULER_H = 54

/** A ruler 0..to with unit ticks (mm-like minor ticks for short cm rulers) and an object bar lying on it. */
export default function Ruler({ to, unit, from = 0, objectEnd, objectLabel, label, lang }: Props) {
  const end = Math.max(1, to)
  const track = W - 2 * PAD
  const pxPerUnit = track / end
  const xOf = (v: number) => PAD + v * pxPerUnit
  const hasObject = objectEnd !== undefined && objectEnd > from
  const objTop = objectLabel ? 24 : 8
  const rulerTop = hasObject ? objTop + OBJ_H + 8 : 8
  const H = rulerTop + RULER_H + 6

  const showMinor = unit === 'cm' && end <= 20
  const stride = rulerLabelStride(end, pxPerUnit)
  const unitTickEvery = pxPerUnit >= 5 ? 1 : stride
  const ticks: { v: number; h: number; w: number }[] = []
  for (let u = 0; u <= end; u += unitTickEvery) ticks.push({ v: u, h: u % stride === 0 ? 17 : 12, w: 2 })
  if (showMinor) {
    for (let u = 0; u < end; u++) {
      for (let m = 1; m < 10; m++) ticks.push({ v: u + m / 10, h: m === 5 ? 11 : 6, w: 1 })
    }
  }
  const labels: number[] = []
  for (let u = 0; u <= end; u += stride) labels.push(u)
  if (labels[labels.length - 1] !== end && (end - labels[labels.length - 1]) * pxPerUnit >= 20) labels.push(end)

  const x1 = hasObject ? xOf(from) : 0
  const x2 = hasObject ? xOf(objectEnd as number) : 0
  const labelW = (objectLabel?.length ?? 0) * 8.5
  const labelX = Math.min(W - 4 - labelW / 2, Math.max(4 + labelW / 2, (x1 + x2) / 2))

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {/* the object */}
      {hasObject && (
        <g>
          <rect x={x1} y={objTop} width={x2 - x1} height={OBJ_H} rx={6} fill={COLORS.blue} stroke={COLORS.blueDark} strokeWidth={3} />
          <line x1={x1} y1={objTop + OBJ_H} x2={x1} y2={rulerTop} stroke={COLORS.blueDark} strokeWidth={1.5} strokeDasharray="3 3" />
          <line x1={x2} y1={objTop + OBJ_H} x2={x2} y2={rulerTop} stroke={COLORS.blueDark} strokeWidth={1.5} strokeDasharray="3 3" />
          {objectLabel && (
            <text x={labelX} y={objTop - 6} textAnchor="middle" fontSize={14} fontWeight={800} fill={COLORS.blueDark} stroke={COLORS.white} strokeWidth={3.5} paintOrder="stroke">
              {objectLabel}
            </text>
          )}
        </g>
      )}

      {/* the ruler body */}
      <rect x={PAD - 12} y={rulerTop} width={track + 24} height={RULER_H} rx={8} fill={COLORS.gold} stroke={COLORS.goldDark} strokeWidth={2.5} />
      {ticks.map((t, i) => (
        <line key={i} x1={xOf(t.v)} y1={rulerTop} x2={xOf(t.v)} y2={rulerTop + t.h} stroke={COLORS.line} strokeWidth={t.w} />
      ))}
      {labels.map((v) => (
        <text key={v} x={xOf(v)} y={rulerTop + 36} textAnchor="middle" fontSize={stride === 1 && end > 15 ? 11 : 13} fontWeight={700} fill={COLORS.text}>
          {formatNumber(v, lang)}
        </text>
      ))}
      <text x={W - PAD + 8} y={rulerTop + RULER_H - 5} textAnchor="end" fontSize={11} fontWeight={800} fill={COLORS.goldDark}>
        {unit}
      </text>
    </svg>
  )
}
