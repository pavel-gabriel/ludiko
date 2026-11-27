import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { LookId } from '@/learner/extrasUnlocks'
import { COLORS } from '@/ui/visuals/palette'
import { LookAccessory, lookColors } from './looks'
import { useActiveLook } from './lookStore'
import './mascot.css'

/**
 * Ludi, the Ludiko mascot: a small round owl drawn only from our own SVG shapes (docs/LEGAL_CONTENT_POLICY.md:
 * no third-party characters). Pastel lilac body, cream belly, big friendly eyes.
 *
 * Moods are poses, not emotions the child must read:
 *  - wave       greeting
 *  - think      explanations ("let's look at it together")
 *  - cheer      correct answers / celebrations
 *  - encourage  after a slip: warm and calm, never sad or disappointed
 *  - sleep      break offer
 */
export type MascotMood = 'wave' | 'think' | 'cheer' | 'encourage' | 'sleep'

export const MASCOT_MOODS: readonly MascotMood[] = ['wave', 'think', 'cheer', 'encourage', 'sleep']

const LINE = COLORS.line
const BELLY = '#FFF6D6'
const BEAK = '#F6B26B'
const INK = '#4A4A4A'
const GOLD = '#F7D154'
const HEART = '#E8708F'
const SW = 3

export interface MascotSvgProps {
  mood?: MascotMood
  /** Rendered width/height in px (square). Readable from 48 to 160 */
  size?: number
  className?: string
  /** Idle animation (still skipped when the child prefers reduced motion) */
  animated?: boolean
  /** Override the accessible label (default: the mood's `mascot.label.*` string) */
  label?: string
  /** Pure decoration next to text that already says everything: hidden from screen readers */
  decorative?: boolean
  /** Colour variant / accessory; default = the child's chosen look on this device (see lookStore) */
  look?: LookId
}

const BODY_ANIM: Record<MascotMood, string> = {
  wave: 'ludi-body-bob',
  think: 'ludi-body-sway',
  cheer: 'ludi-body-hop',
  encourage: 'ludi-body-sway',
  sleep: 'ludi-body-breathe',
}

/** A wing hangs from its shoulder; `angle` swings it (left wing: + lifts it outward, right wing: - lifts it) */
function Wing({ side, angle, animClass, fill }: { side: 'l' | 'r'; angle: number; animClass?: string; fill: string }) {
  const px = side === 'l' ? 30 : 90
  const cx = side === 'l' ? 26 : 94
  return (
    <g transform={`rotate(${angle} ${px} 66)`}>
      <g className={`ludi-part ${animClass ?? ''}`}>
        <ellipse cx={cx} cy={83} rx={9} ry={18} fill={fill} stroke={LINE} strokeWidth={SW} />
      </g>
    </g>
  )
}

function Sparkle({ x, y, s = 1, delay = false }: { x: number; y: number; s?: number; delay?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className={`ludi-part ludi-twinkle ${delay ? 'ludi-twinkle-b' : ''}`}
        d="M0 -7 L2 -2 L7 0 L2 2 L0 7 L-2 2 L-7 0 L-2 -2 Z"
        fill={GOLD}
        stroke={COLORS.goldDark}
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </g>
  )
}

function Heart({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className="ludi-part ludi-pulse"
        d="M0 6 C-9 -1 -6 -8 0 -4 C6 -8 9 -1 0 6 Z"
        fill={HEART}
        stroke="#B84A68"
        strokeWidth={1.4}
        strokeLinejoin="round"
      />
    </g>
  )
}

function SleepZ({ x, y, s, floatClass }: { x: number; y: number; s: number; floatClass: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <path
        className={`ludi-part ${floatClass}`}
        d="M0 0 H8 L0 9 H8"
        fill="none"
        stroke={COLORS.blueDark}
        strokeWidth={2.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

/** Eyes: white discs on every mood so Ludi always looks like Ludi; only the inside changes */
function Eyes({ mood }: { mood: MascotMood }) {
  const eyeCx = [46, 74]
  const discs = eyeCx.map((cx) => (
    <circle key={cx} cx={cx} cy={56} r={11.5} fill="#fff" stroke={LINE} strokeWidth={2.6} />
  ))

  if (mood === 'cheer') {
    // happy arcs
    return (
      <g>
        {discs}
        {eyeCx.map((cx) => (
          <path
            key={cx}
            d={`M${cx - 7} 60 Q${cx} 49 ${cx + 7} 60`}
            fill="none"
            stroke={INK}
            strokeWidth={3.6}
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }
  if (mood === 'sleep') {
    return (
      <g>
        {discs}
        {eyeCx.map((cx) => (
          <path
            key={cx}
            d={`M${cx - 7} 54 Q${cx} 63 ${cx + 7} 54`}
            fill="none"
            stroke={INK}
            strokeWidth={3.2}
            strokeLinecap="round"
          />
        ))}
      </g>
    )
  }

  const look = mood === 'think' ? { dx: 3, dy: -3 } : mood === 'encourage' ? { dx: 0, dy: 0.5 } : { dx: 0, dy: 1 }
  const r = mood === 'encourage' ? 6.2 : 5.6
  return (
    <g>
      {discs}
      {eyeCx.map((cx) => (
        <g key={cx}>
          <circle cx={cx + look.dx} cy={57 + look.dy} r={r} fill={INK} />
          <circle cx={cx + look.dx + 2} cy={55 + look.dy} r={2} fill="#fff" />
        </g>
      ))}
      {mood === 'think' && (
        <path d="M63 41 Q73 35 84 40" fill="none" stroke={LINE} strokeWidth={3} strokeLinecap="round" />
      )}
      {mood === 'encourage' && (
        <g fill="none" stroke={LINE} strokeWidth={2.8} strokeLinecap="round">
          <path d="M36 41.5 Q46 37 54 41" />
          <path d="M66 41 Q74 37 84 41.5" />
        </g>
      )}
    </g>
  )
}

function Beak({ mood }: { mood: MascotMood }) {
  if (mood === 'cheer') {
    return (
      <g stroke={LINE} strokeWidth={2.6} strokeLinejoin="round">
        <path d="M53 65 Q60 61 67 65 L60 71 Z" fill={BEAK} />
        <path d="M54.5 72 Q60 68 65.5 72 Q60 80 54.5 72 Z" fill="#F08A8A" />
      </g>
    )
  }
  return <path d="M54 65 Q60 61 66 65 L60 76 Z" fill={BEAK} stroke={LINE} strokeWidth={2.6} strokeLinejoin="round" />
}

/** The mascot drawing itself (inline SVG, no external files) */
export function MascotSvg({
  mood = 'wave',
  size = 96,
  className = '',
  animated = true,
  label,
  decorative = false,
  look,
}: MascotSvgProps) {
  const { t } = useTranslation()
  const active = useActiveLook()
  const chosen = look ?? active
  const { body: BODY, wing: WING } = lookColors(chosen)
  const accessible = decorative
    ? { 'aria-hidden': true as const }
    : { role: 'img' as const, 'aria-label': label ?? t(`mascot.label.${mood}`) }

  // wings per mood
  let left = <Wing side="l" angle={8} fill={WING} />
  let right = <Wing side="r" angle={-8} fill={WING} />
  if (mood === 'wave') right = <Wing side="r" angle={-122} animClass="ludi-wing-wave" fill={WING} />
  if (mood === 'cheer') {
    left = <Wing side="l" angle={128} fill={WING} />
    right = <Wing side="r" angle={-128} fill={WING} />
  }
  if (mood === 'think') left = <Wing side="l" angle={-64} fill={WING} />
  if (mood === 'encourage') right = <Wing side="r" angle={52} fill={WING} />

  let extras: ReactNode = null
  if (mood === 'wave') {
    extras = (
      <g fill="none" stroke={COLORS.blueDark} strokeWidth={2.4} strokeLinecap="round">
        <path className="ludi-part ludi-dot" d="M108 22 Q114 27 111 34" />
        <path className="ludi-part ludi-dot ludi-dot-b" d="M101 15 Q110 18 113 25" />
      </g>
    )
  } else if (mood === 'think') {
    extras = (
      <g fill="#fff" stroke={LINE} strokeWidth={2}>
        <circle className="ludi-part ludi-dot" cx={95} cy={25} r={2.6} />
        <circle className="ludi-part ludi-dot ludi-dot-b" cx={102} cy={16} r={3.6} />
        <circle className="ludi-part ludi-dot ludi-dot-c" cx={110} cy={6} r={4.8} />
      </g>
    )
  } else if (mood === 'cheer') {
    extras = (
      <g>
        <Sparkle x={12} y={26} s={1.1} />
        <Sparkle x={109} y={22} s={1} delay />
        <Sparkle x={8} y={62} s={0.7} delay />
        <Sparkle x={113} y={64} s={0.75} />
      </g>
    )
  } else if (mood === 'encourage') {
    extras = <Heart x={102} y={28} s={1.3} />
  } else {
    extras = (
      <g>
        <SleepZ x={100} y={26} s={0.9} floatClass="ludi-float" />
        <SleepZ x={110} y={12} s={0.65} floatClass="ludi-float ludi-float-b" />
      </g>
    )
  }

  return (
    <svg
      viewBox="0 0 120 120"
      width={size}
      height={size}
      className={`ludi-svg ${animated ? 'ludi-anim' : ''} ${className}`}
      data-mood={mood}
      data-look={chosen}
      focusable="false"
      {...accessible}
    >
      <ellipse cx={60} cy={113} rx={29} ry={4.5} fill={LINE} opacity={0.14} />
      <g className={`ludi-part ${BODY_ANIM[mood]}`}>
        <g transform={mood === 'encourage' ? 'rotate(-4 60 108)' : undefined}>
          {/* feet, peeking out below the belly */}
          <g fill={BEAK} stroke={LINE} strokeWidth={2.6}>
            <ellipse cx={49} cy={108} rx={8.5} ry={4.5} />
            <ellipse cx={71} cy={108} rx={8.5} ry={4.5} />
          </g>
          {/* ear tufts */}
          <g fill={BODY} stroke={LINE} strokeWidth={SW} strokeLinejoin="round">
            <path d="M28 46 L25 19 L52 33 Z" />
            <path d="M92 46 L95 19 L68 33 Z" />
          </g>
          {/* body and belly */}
          <ellipse cx={60} cy={68} rx={38} ry={40} fill={BODY} stroke={LINE} strokeWidth={SW} />
          <ellipse cx={60} cy={89} rx={23} ry={18} fill={BELLY} stroke="#F2E3B0" strokeWidth={2} />
          {/* cheeks */}
          <g fill={COLORS.pink} opacity={0.85}>
            <circle cx={32} cy={71} r={5.2} />
            <circle cx={88} cy={71} r={5.2} />
          </g>
          <Eyes mood={mood} />
          <Beak mood={mood} />
          {left}
          {right}
          <LookAccessory look={chosen} />
        </g>
      </g>
      {extras}
    </svg>
  )
}

export default MascotSvg
