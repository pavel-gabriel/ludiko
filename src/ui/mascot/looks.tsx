import { DEFAULT_LOOK, type LookId } from '@/learner/extrasUnlocks'
import { COLORS } from '@/ui/visuals/palette'

/** Body and wing colours per look (own palette; the owl shape itself never changes) */
export const LOOK_COLORS: Record<LookId, { body: string; wing: string }> = {
  classic: { body: '#DDA0DD', wing: '#C98BCB' },
  mint: { body: '#9FDDB8', wing: '#7CC79B' },
  sky: { body: '#9CD3F2', wing: '#78BBE0' },
  sunny: { body: '#F8D56B', wing: '#E7BC45' },
  scarf: { body: '#DDA0DD', wing: '#C98BCB' },
  cap: { body: '#DDA0DD', wing: '#C98BCB' },
  glasses: { body: '#DDA0DD', wing: '#C98BCB' },
  crown: { body: '#DDA0DD', wing: '#C98BCB' },
}

export function lookColors(look: LookId = DEFAULT_LOOK) {
  return LOOK_COLORS[look] ?? LOOK_COLORS.classic
}

const LINE = COLORS.line

/** Accessory drawn over the finished owl (all shapes are ours: simple paths, no third-party art) */
export function LookAccessory({ look }: { look: LookId }) {
  switch (look) {
    case 'scarf':
      return (
        <g data-look-part="scarf" stroke={LINE} strokeWidth={2.6} strokeLinejoin="round">
          <path d="M26 93 Q60 112 94 93 L92 103 Q60 122 28 103 Z" fill={COLORS.pinkDark} />
          <path d="M78 107 L86 124 L96 120 L90 103 Z" fill={COLORS.pinkDark} />
          <path d="M40 101 L42 109 M52 105 L54 113 M64 106 L66 114" stroke={COLORS.pink} strokeWidth={2} fill="none" strokeLinecap="round" />
        </g>
      )
    case 'cap':
      return (
        <g data-look-part="cap" stroke={LINE} strokeWidth={2.6} strokeLinejoin="round">
          <path d="M34 38 Q60 6 86 38 Z" fill={COLORS.blueDark} />
          <path d="M30 38 Q60 46 90 38 Q60 32 30 38 Z" fill={COLORS.blue} />
          <circle cx={60} cy={13} r={3.4} fill={COLORS.gold} />
        </g>
      )
    case 'glasses':
      return (
        <g data-look-part="glasses" fill="none" stroke={COLORS.text} strokeWidth={3} strokeLinecap="round">
          <circle cx={46} cy={56} r={14} fill="#fff" fillOpacity={0.18} />
          <circle cx={74} cy={56} r={14} fill="#fff" fillOpacity={0.18} />
          <path d="M58 54 Q60 51 62 54" />
          <path d="M32 54 L26 50 M88 54 L94 50" />
        </g>
      )
    case 'crown':
      return (
        <g data-look-part="crown" stroke={COLORS.goldDark} strokeWidth={2.4} strokeLinejoin="round">
          <path d="M42 34 L45 15 L53 26 L60 11 L67 26 L75 15 L78 34 Z" fill={COLORS.gold} />
          <circle cx={60} cy={21} r={2.6} fill={COLORS.pinkDark} stroke="none" />
          <circle cx={47} cy={27} r={2} fill={COLORS.blueDark} stroke="none" />
          <circle cx={73} cy={27} r={2} fill={COLORS.greenDark} stroke="none" />
        </g>
      )
    default:
      return null
  }
}
