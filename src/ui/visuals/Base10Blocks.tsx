import type { TFunction } from 'i18next'
import { COLORS } from './palette'
import { clampCount, flowLayout } from './geometry'

interface Props {
  hundreds?: number
  tens?: number
  ones?: number
  label: string
  t: TFunction
  /** Show "3 sute" captions under each group */
  showCounts: boolean
}

const W = 360
const FLAT = 50 // 10x10 flat: 5px cells
const ROD_W = 10
const ROD_H = 50
const CUBE = 10
const CAPTION_H = 22

interface Section {
  key: 'hundreds' | 'tens' | 'ones'
  count: number
  perRow: number
  itemW: number
  itemH: number
}

function Flat({ x, y }: { x: number; y: number }) {
  const lines: number[] = []
  for (let i = 1; i < 10; i++) lines.push(i * 5)
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={FLAT} height={FLAT} rx={3} fill={COLORS.blue} stroke={COLORS.blueDark} strokeWidth={1.5} />
      {lines.map((p) => (
        <g key={p}>
          <line x1={p} y1={0} x2={p} y2={FLAT} stroke={COLORS.blueDark} strokeWidth={0.7} opacity={0.6} />
          <line x1={0} y1={p} x2={FLAT} y2={p} stroke={COLORS.blueDark} strokeWidth={0.7} opacity={0.6} />
        </g>
      ))}
    </g>
  )
}

function Rod({ x, y }: { x: number; y: number }) {
  const lines: number[] = []
  for (let i = 1; i < 10; i++) lines.push(i * 5)
  return (
    <g transform={`translate(${x} ${y})`}>
      <rect width={ROD_W} height={ROD_H} rx={2} fill={COLORS.green} stroke={COLORS.greenDark} strokeWidth={1.5} />
      {lines.map((p) => (
        <line key={p} x1={0} y1={p} x2={ROD_W} y2={p} stroke={COLORS.greenDark} strokeWidth={0.8} opacity={0.7} />
      ))}
    </g>
  )
}

function Cube({ x, y }: { x: number; y: number }) {
  return <rect x={x} y={y} width={CUBE} height={CUBE} rx={2} fill={COLORS.orange} stroke={COLORS.orangeDark} strokeWidth={1.5} />
}

/** Hundreds as 10×10 flats, tens as rods, ones as cubes — wrapped neatly, with readable counts. */
export default function Base10Blocks({ hundreds, tens, ones, label, t, showCounts }: Props) {
  const specs: Section[] = [
    { key: 'hundreds', count: clampCount(hundreds, 20), perRow: 3, itemW: FLAT, itemH: FLAT },
    { key: 'tens', count: clampCount(tens, 20), perRow: 10, itemW: ROD_W, itemH: ROD_H },
    { key: 'ones', count: clampCount(ones, 30), perRow: 5, itemW: CUBE, itemH: CUBE },
  ]
  const sections = specs.filter((s) => s.count > 0)

  const sized = sections.map((s) => {
    const cols = Math.min(s.count, s.perRow)
    const rows = Math.ceil(s.count / s.perRow)
    const gap = s.key === 'hundreds' ? 8 : s.key === 'tens' ? 5 : 5
    const w = cols * s.itemW + (cols - 1) * gap
    const h = rows * s.itemH + (rows - 1) * gap
    return { ...s, cols, rows, gap, w, h }
  })
  const captionW = 74
  const boxes = sized.map((s) => ({
    w: Math.max(s.w, showCounts ? captionW : 0),
    h: s.h + (showCounts ? CAPTION_H : 0),
  }))
  const layout = flowLayout(boxes, W - 16, 22, 16)
  const H = Math.max(layout.height, 20) + 16
  const offsetX = (W - layout.width) / 2

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      {sized.map((s, k) => {
        const pos = layout.positions[k]
        const bw = boxes[k].w
        const ox = offsetX + pos.x + (bw - s.w) / 2
        const oy = 8 + pos.y + (pos.rowH - boxes[k].h)
        const items = Array.from({ length: s.count }, (_, i) => {
          const c = i % s.perRow
          const r = Math.floor(i / s.perRow)
          const x = ox + c * (s.itemW + s.gap)
          const y = oy + r * (s.itemH + s.gap)
          if (s.key === 'hundreds') return <Flat key={i} x={x} y={y} />
          if (s.key === 'tens') return <Rod key={i} x={x} y={y} />
          return <Cube key={i} x={x} y={y} />
        })
        return (
          <g key={s.key}>
            {items}
            {showCounts && (
              <text x={offsetX + pos.x + bw / 2} y={oy + s.h + 17} textAnchor="middle" fontSize={14} fontWeight={800} fill={COLORS.text}>
                {t(`frames.visual.${s.key}`, { count: s.count })}
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
