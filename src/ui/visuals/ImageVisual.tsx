import { useState } from 'react'
import { COLORS } from './palette'

interface Props {
  src: string
  alt: string
  label: string
}

/** Resolve a content path against the app base URL. Remote URLs are refused (no external fetch). */
export function resolveMediaSrc(src: string, base: string = import.meta.env.BASE_URL ?? '/'): string | null {
  if (/^(https?:)?\/\//i.test(src) || /^javascript:/i.test(src)) return null
  if (src.startsWith('data:image/') || src.startsWith('blob:')) return src
  if (src.startsWith('/')) return base.replace(/\/$/, '') + src
  return base.replace(/\/?$/, '/') + src
}

/** Bundled image shown inside an SVG frame, with a friendly placeholder behind it. */
export default function ImageVisual({ src, alt, label }: Props) {
  const href = resolveMediaSrc(src)
  const [failed, setFailed] = useState(false)
  return (
    <svg viewBox="0 0 320 200" width="100%" role="img" aria-label={label} style={{ display: 'block' }}>
      <rect x={2} y={2} width={316} height={196} rx={14} fill={COLORS.yellow} stroke={COLORS.faint} strokeWidth={2} strokeDasharray="6 5" />
      <circle cx={110} cy={70} r={14} fill={COLORS.orange} />
      <path d="M 40 160 L 120 95 L 170 135 L 215 100 L 280 160 Z" fill={COLORS.green} stroke={COLORS.greenDark} strokeWidth={2} strokeLinejoin="round" />
      <text x={160} y={186} textAnchor="middle" fontSize={11} fill={COLORS.text}>
        {alt.length > 46 ? alt.slice(0, 45) + '…' : alt}
      </text>
      {href && !failed && (
        <image href={href} x={0} y={0} width={320} height={200} preserveAspectRatio="xMidYMid meet" onError={() => setFailed(true)} />
      )}
    </svg>
  )
}
