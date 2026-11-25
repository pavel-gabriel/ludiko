import { useId } from 'react'
import { COLORS } from './palette'
import { labelIndexes, numberLineTicks, tickIndexOf } from './geometry'
import { formatNumber } from './labels'

interface Props {
  from: number
  to: number
  step?: number
  marks?: number[]
  jumps?: { from: number; to: number }[]
  label: string
  lang: string
}

const W = 360
const PAD = 22
const JUMP_COLORS = [COLORS.purpleDark, COLORS.blueDark]

/** Number line with ticks, highlighted marks and curved jump arrows. */
export default function NumberLine({ from, to, step = 1, marks = [], jumps = [], label, lang }: Props) {
  const uid = useId().replace(/:/g, '')
  const ticks = numberLineTicks(from, to, step)
  const count = ticks.length
  const realStep = count > 1 ? ticks[1] - ticks[0] : step
  const hasJumps = jumps.length > 0
  const lineY = hasJumps ? 88 : 34
  const H = lineY + 42
  const pxPerTick = count > 1 ? (W - 2 * PAD) / (count - 1) : 0
  const xOf = (i: number) => (count > 1 ? PAD + i * pxPerTick : W / 2)

  const markIdx = marks.map((m) => tickIndexOf(ticks, m)).filter((i) => i >= 0)
  const jumpEnds = jumps.flatMap((j) => [tickIndexOf(ticks, j.from), tickIndexOf(ticks, j.to)]).filter((i) => i >= 0)
  const longest = Math.max(...ticks.map((t) => formatNumber(t, lang).length), 1)
  const labelPx = longest * 9 + 10
  const labelled = labelIndexes(ticks, pxPerTick || W, labelPx, realStep, [...markIdx, ...jumpEnds])
  const markSet = new Set(markIdx)
  const fmt = (n: number) => formatNumber(n, lang)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      <defs>
        {JUMP_COLORS.map((c, k) => (
          <marker key={k} id={`${uid}-arrow${k}`} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="5" markerHeight="5" orient="auto">
            <path d="M1 0.5 L9.5 5 L1 9.5 z" fill={c} />
          </marker>
        ))}
      </defs>

      {/* the line itself */}
      <line x1={PAD - 10} y1={lineY} x2={W - PAD + 10} y2={lineY} stroke={COLORS.line} strokeWidth={3} strokeLinecap="round" />

      {/* ticks */}
      {ticks.map((v, i) => {
        const x = xOf(i)
        const major = Math.round(v) % 10 === 0 && Number.isInteger(v)
        const h = major ? 14 : labelled.has(i) ? 11 : 7
        return <line key={i} x1={x} y1={lineY - h / 2} x2={x} y2={lineY + h / 2} stroke={COLORS.line} strokeWidth={major ? 3 : 2} strokeLinecap="round" />
      })}

      {/* jumps */}
      {jumps.map((j, k) => {
        const a = tickIndexOf(ticks, j.from)
        const b = tickIndexOf(ticks, j.to)
        if (a < 0 || b < 0 || a === b) return null
        const x1 = xOf(a)
        const x2 = xOf(b)
        const y = lineY - 15
        const span = Math.abs(x2 - x1)
        const h = Math.min(44, 16 + span * 0.28)
        const color = JUMP_COLORS[k % JUMP_COLORS.length]
        const delta = j.to - j.from
        const text = `${delta >= 0 ? '+' : '−'}${fmt(Math.abs(delta))}`
        const midX = (x1 + x2) / 2
        const peak = y - 0.75 * h
        return (
          <g key={k}>
            <path
              d={`M ${x1} ${y} C ${x1} ${y - h}, ${x2} ${y - h}, ${x2} ${y}`}
              fill="none"
              stroke={color}
              strokeWidth={3}
              strokeLinecap="round"
              markerEnd={`url(#${uid}-arrow${k % JUMP_COLORS.length})`}
            />
            <text x={midX} y={peak - 6} textAnchor="middle" fontSize={15} fontWeight={800} fill={color} stroke={COLORS.white} strokeWidth={3.5} paintOrder="stroke">
              {text}
            </text>
          </g>
        )
      })}

      {/* highlighted marks: ring + bold label (not colour-only) */}
      {markIdx.map((i) => (
        <g key={`m${i}`}>
          <circle cx={xOf(i)} cy={lineY} r={10} fill={COLORS.pink} stroke={COLORS.pinkDark} strokeWidth={3} />
          <circle cx={xOf(i)} cy={lineY} r={3} fill={COLORS.pinkDark} />
        </g>
      ))}

      {/* labels */}
      {[...labelled].map((i) => (
        <text
          key={`l${i}`}
          x={xOf(i)}
          y={lineY + 30}
          textAnchor="middle"
          fontSize={markSet.has(i) ? 17 : 13}
          fontWeight={markSet.has(i) ? 800 : 600}
          fill={markSet.has(i) ? COLORS.pinkDark : COLORS.text}
        >
          {fmt(ticks[i])}
        </text>
      ))}
    </svg>
  )
}
