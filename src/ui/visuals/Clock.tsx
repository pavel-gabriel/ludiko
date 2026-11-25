import { COLORS } from './palette'
import { clockAngles, polar } from './geometry'

interface Props {
  hours: number
  minutes: number
  label: string
}

const C = 100

/** Analog clock face. Hour hand is short + thick, minute hand long + thin (not colour-only). */
export default function Clock({ hours, minutes, label }: Props) {
  const { hour, minute } = clockAngles(hours, minutes)
  const hourTip = polar(C, C, 38, hour)
  const minTip = polar(C, C, 55, minute)
  const hourTail = polar(C, C, -8, hour)
  const minTail = polar(C, C, -10, minute)

  return (
    <svg viewBox="0 0 200 200" width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      <circle cx={C} cy={C} r={95} fill={COLORS.blue} stroke={COLORS.line} strokeWidth={3} />
      <circle cx={C} cy={C} r={87} fill={COLORS.white} stroke={COLORS.line} strokeWidth={1.5} />

      {/* minute ticks (bold at the hours) */}
      {Array.from({ length: 60 }, (_, i) => {
        const big = i % 5 === 0
        const a = polar(C, C, big ? 77 : 81, i * 6)
        const b = polar(C, C, 86, i * 6)
        return <line key={i} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={big ? COLORS.line : COLORS.faint} strokeWidth={big ? 2.5 : 1.2} strokeLinecap="round" />
      })}

      {/* numbers 1–12 */}
      {Array.from({ length: 12 }, (_, k) => {
        const n = k + 1
        const p = polar(C, C, 67, n * 30)
        return (
          <text key={n} x={p.x} y={p.y} textAnchor="middle" dy="0.35em" fontSize={n >= 10 ? 14 : 16} fontWeight={800} fill={COLORS.text}>
            {n}
          </text>
        )
      })}

      {/* hands */}
      <line x1={hourTail.x} y1={hourTail.y} x2={hourTip.x} y2={hourTip.y} stroke={COLORS.pinkDark} strokeWidth={8} strokeLinecap="round" />
      <line x1={minTail.x} y1={minTail.y} x2={minTip.x} y2={minTip.y} stroke={COLORS.text} strokeWidth={4.5} strokeLinecap="round" />
      <circle cx={C} cy={C} r={6} fill={COLORS.white} stroke={COLORS.text} strokeWidth={2.5} />
    </svg>
  )
}
