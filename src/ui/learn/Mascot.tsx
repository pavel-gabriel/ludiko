import type { ReactNode } from 'react'

/** Placeholder mascot (a plain emoji until the real character is designed) with a speech bubble */
export default function Mascot({ children, emoji = '🐥' }: { children: ReactNode; emoji?: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-ludiko-yellow text-5xl shadow-md"
        aria-hidden="true"
      >
        {emoji}
      </span>
      <div className="relative min-w-0 flex-1 rounded-3xl rounded-tl-md bg-white p-4 shadow-md">{children}</div>
    </div>
  )
}
