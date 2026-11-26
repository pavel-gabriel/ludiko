import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { BitKind, PlanBit } from '@/learner'
import { MascotSvg } from '@/ui/mascot/Mascot'
import { planBitPath } from './planRoutes'
import { subjectEmoji } from './subjects'

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

/**
 * "Biții de azi": the day's plan across subjects, 1–3 tiles of about 3 minutes each (Matematică, Limba română,
 * a rotating subject). A tick on the finished ones; a small celebration when all of them are done.
 */
export default function BitTiles({ bits }: { bits: PlanBit[] }) {
  const { t } = useTranslation()
  const allDone = bits.length > 0 && bits.every((b) => b.done)
  const next = bits.find((b) => !b.done)?.index

  return (
    <div className="rounded-3xl bg-ludiko-green p-4 shadow-md" data-testid="card-plan" data-all-done={allDone}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-extrabold text-ludiko-text">
            <span aria-hidden="true">✨ </span>
            {t('bits.title')}
          </h2>
          <p className="text-sm font-semibold text-ludiko-text/80" data-testid="plan-status">
            {allDone ? t('bits.allDone') : t('bits.subtitle')}
          </p>
        </div>
        {allDone && <MascotSvg mood="cheer" size={64} className="-my-2 shrink-0" decorative />}
      </div>

      <ul className={`mt-3 grid gap-2 ${COLS[Math.min(3, Math.max(1, bits.length))]}`}>
        {bits.map((bit) => {
          const subject = t(`learn.subject.${bit.subject}`)
          const what = bit.source === 'placement' ? t('bits.plan.check') : t(`bits.kinds.${bit.kind}`)
          return (
            <li key={bit.index} className="min-w-0">
              <Link
                to={planBitPath(bit)}
                data-testid={`plan-bit-${bit.index}`}
                data-subject={bit.subject}
                data-source={bit.source}
                data-done={bit.done}
                aria-label={t('bits.tile', { kind: `${subject}, ${what}`, state: t(bit.done ? 'bits.state.done' : 'bits.state.todo') })}
                className={`relative flex min-h-[136px] flex-col items-center justify-center gap-1 rounded-2xl px-1 py-3 text-center shadow-sm transition-transform active:scale-95 ${
                  bit.done ? 'bg-white/80' : bit.source === 'placement' ? 'bg-ludiko-yellow' : TONE[bit.kind]
                } ${bit.index === next ? 'ring-4 ring-white' : ''}`}
              >
                {bit.done && (
                  <span
                    className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-ludiko-green text-base font-extrabold text-ludiko-text shadow-sm"
                    data-testid={`plan-bit-${bit.index}-tick`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                )}
                <span className="text-4xl" aria-hidden="true">{subjectEmoji(bit.subject)}</span>
                <span className="block w-full break-words text-sm font-extrabold leading-tight text-ludiko-text">{subject}</span>
                <span className="block w-full break-words text-xs font-bold leading-tight text-ludiko-text/80">{what}</span>
                <span className="block text-xs font-bold text-ludiko-text/70">{t('bits.minutes')}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
