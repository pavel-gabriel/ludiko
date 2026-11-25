import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { BitKind } from '@/learner'
import type { SubjectId } from '@/engine/types'

export interface HomeBit {
  index: number
  kind: BitKind
  done: boolean
}

export const BIT_ICON: Record<BitKind, string> = {
  warmup: '☀️',
  island: '🏝️',
  challenge: '🗝️',
}

const TONE: Record<BitKind, string> = {
  warmup: 'bg-ludiko-yellow',
  island: 'bg-ludiko-blue',
  challenge: 'bg-ludiko-pink',
}

const COLS: Record<number, string> = { 1: 'grid-cols-1', 2: 'grid-cols-2', 3: 'grid-cols-3' }

/** "Biții de azi": 1–3 tiles of about 3 minutes each, a tick on the finished ones, a way back to the full mission */
export default function BitTiles({ subject, bits }: { subject: SubjectId; bits: HomeBit[] }) {
  const { t } = useTranslation()
  const allDone = bits.every((b) => b.done)
  const next = bits.find((b) => !b.done)?.index

  return (
    <div className="rounded-3xl bg-ludiko-green p-4 shadow-md" data-testid="card-bits">
      <h2 className="text-xl font-extrabold text-ludiko-text">
        <span aria-hidden="true">✨ </span>
        {t('bits.title')}
      </h2>
      <p className="text-sm font-semibold text-ludiko-text/80">{allDone ? t('bits.allDone') : t('bits.subtitle')}</p>

      <ul className={`mt-3 grid gap-2 ${COLS[Math.min(3, Math.max(1, bits.length))]}`}>
        {bits.map((bit) => {
          const kind = t(`bits.kinds.${bit.kind}`)
          return (
            <li key={bit.index} className="min-w-0">
              <Link
                to={`/learn/bit/${subject}/${bit.index}`}
                data-testid={`bit-${bit.index}`}
                data-done={bit.done}
                aria-label={t('bits.tile', { kind, state: t(bit.done ? 'bits.state.done' : 'bits.state.todo') })}
                className={`relative flex min-h-[128px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3 text-center shadow-sm transition-transform active:scale-95 ${
                  bit.done ? 'bg-white/80' : TONE[bit.kind]
                } ${bit.index === next ? 'ring-4 ring-white' : ''}`}
              >
                {bit.done && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ludiko-green text-base font-extrabold text-ludiko-text shadow-sm"
                    data-testid={`bit-${bit.index}-tick`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
                <span className="text-4xl" aria-hidden="true">{BIT_ICON[bit.kind]}</span>
                <span className="block w-full break-words text-sm font-extrabold leading-tight text-ludiko-text">{kind}</span>
                <span className="block text-xs font-bold text-ludiko-text/70">{t('bits.minutes')}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      <Link
        to={`/learn/mission/${subject}`}
        data-testid="link-mission"
        className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-ludiko-text underline"
      >
        <span aria-hidden="true">🗺️ </span>
        {t('bits.fullMission')}
      </Link>
    </div>
  )
}
