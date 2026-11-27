import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { MASCOT_LOOKS, lookUnlocked, type LookId, type MilestoneId } from '@/learner/extrasUnlocks'
import { MascotSvg } from './Mascot'
import { getLook, setLook } from './lookStore'

function hintFor(t: ReturnType<typeof useTranslation>['t'], unlock: MilestoneId | undefined): string {
  if (!unlock) return ''
  if (unlock.startsWith('island:')) return t('family.extras.looks.hint.island', { subject: t(`learn.subject.${unlock.slice(7)}`) })
  return t(`family.extras.looks.hint.${unlock}`)
}

interface MascotLookPickerProps {
  profileId: string
  /** Milestones the child has reached (src/learner/extrasUnlocks.earnedMilestones) */
  earned: readonly MilestoneId[]
}

/** The child picks Ludi's look on /learn. Locked looks show how to earn them (by learning only). */
export default function MascotLookPicker({ profileId, earned }: MascotLookPickerProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const [current, setCurrent] = useState<LookId>(() => getLook(profileId))

  return (
    <section className="rounded-3xl bg-white p-3 shadow-sm" data-testid="look-picker">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls="look-grid"
        data-testid="toggle-looks"
        className="flex min-h-[52px] w-full items-center gap-3 rounded-2xl text-left text-lg font-extrabold text-ludiko-text active:scale-95"
      >
        <MascotSvg size={44} look={current} decorative animated={false} mood="wave" />
        <span className="flex-1">{open ? t('family.extras.looks.title') : t('family.extras.looks.open')}</span>
        <span aria-hidden="true">{open ? '▴' : '▾'}</span>
      </button>
      {open && (
        <div id="look-grid" className="mt-2">
          <ul role="radiogroup" aria-label={t('family.extras.looks.group')} className="grid grid-cols-2 gap-2">
            {MASCOT_LOOKS.map((l) => {
              const unlocked = lookUnlocked(l, earned)
              const checked = current === l.id
              const name = t(`family.extras.looks.names.${l.id}`)
              return (
                <li key={l.id}>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={checked}
                    aria-disabled={!unlocked}
                    data-testid={`look-${l.id}`}
                    onClick={() => {
                      if (!unlocked) return
                      setLook(profileId, l.id)
                      setCurrent(l.id)
                    }}
                    className={`flex min-h-[44px] w-full flex-col items-center gap-1 rounded-2xl p-2 text-center ${
                      checked ? 'bg-ludiko-green ring-4 ring-ludiko-purple' : unlocked ? 'bg-ludiko-bg' : 'bg-ludiko-bg opacity-70'
                    }`}
                  >
                    <span className={unlocked ? '' : 'grayscale'}>
                      <MascotSvg size={64} look={l.id} decorative animated={false} mood="wave" />
                    </span>
                    <span className="text-sm font-extrabold text-ludiko-text">
                      {unlocked ? '' : <span aria-hidden="true">🔒 </span>}
                      {name}
                    </span>
                    <span className="text-xs font-semibold text-ludiko-text/80">
                      {checked ? t('family.extras.looks.chosen') : unlocked ? '' : `${t('family.extras.looks.locked')}. ${hintFor(t, l.unlock)}`}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <p className="mt-2 text-center text-xs font-semibold text-ludiko-text/70">{t('family.extras.looks.note')}</p>
        </div>
      )}
    </section>
  )
}
