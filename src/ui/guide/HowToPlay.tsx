import { useId, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useProfileStore } from '@/store/profileStore'
import ReadAloudButton from '@/ui/speech/ReadAloudButton'
import { ageBand, bandText } from './guideStore'

export type HowToPlayTopic = 'race' | 'sprint' | 'memory' | 'friends'

/**
 * "Cum se joacă?": a short, skippable explanation of a game mode, in the child's tone. Open by default for
 * the youngest band (they cannot guess from a title), a tap away for everyone else.
 */
export default function HowToPlay({ topic, duel = false, className = '' }: { topic: HowToPlayTopic; duel?: boolean; className?: string }) {
  const { t } = useTranslation()
  const grade = useProfileStore((s) => s.activeProfile?.grade)
  const band = ageBand(grade)
  const [open, setOpen] = useState(band === 'small')
  const bodyId = useId()
  const lines = [bandText(t, `guide.modes.${topic}`, band), ...(duel ? [bandText(t, 'guide.modes.duel', band)] : [])]

  return (
    <section className={`rounded-2xl bg-white/80 shadow-sm ${className}`} data-testid="how-to-play" data-topic={topic}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={bodyId}
        data-testid="how-to-play-toggle"
        className="flex min-h-[48px] w-full items-center gap-2 px-4 text-left text-base font-extrabold text-ludiko-text active:scale-[0.98]"
      >
        <span aria-hidden="true" className="flex h-7 w-7 items-center justify-center rounded-full bg-ludiko-yellow text-sm">?</span>
        <span className="flex-1">{t('guide.modes.title')}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id={bodyId} className="flex flex-col gap-2 px-4 pb-3" data-testid="how-to-play-body">
          {lines.map((line) => (
            <p key={line} className="text-sm font-semibold leading-snug text-ludiko-text/90">
              {line}
            </p>
          ))}
          {band !== 'big' && <ReadAloudButton band={band} text={lines.join(' ')} label={t('guide.readHint')} className="self-start" />}
        </div>
      )}
    </section>
  )
}
