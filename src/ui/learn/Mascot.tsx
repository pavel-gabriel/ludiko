import type { ReactNode } from 'react'
import { MascotSvg, type MascotMood } from '@/ui/mascot/Mascot'

interface MascotProps {
  children: ReactNode
  /** Kept for compatibility with the old emoji placeholder; Ludi is drawn now, so it is ignored */
  emoji?: string
  mood?: MascotMood
}

/** Ludi with a speech bubble: the one place where the mascot "talks" on the learner screens */
export default function Mascot({ children, mood = 'wave' }: MascotProps) {
  return (
    <div className="flex items-end gap-2">
      <MascotSvg mood={mood} size={88} className="shrink-0" decorative />
      <div className="relative mb-2 min-w-0 flex-1 rounded-3xl rounded-bl-md bg-white p-4 shadow-md">{children}</div>
    </div>
  )
}
