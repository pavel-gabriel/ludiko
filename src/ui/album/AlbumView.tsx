import { useEffect, useMemo, useRef, useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { MascotSvg } from '@/ui/mascot/Mascot'
import ProgressBar from '@/ui/learn/ProgressBar'
import { knownStickers, setProgress } from './earning'
import { ALL_STICKERS, FIXED_SPECIAL_IDS, STICKER_SETS, findSticker, parseSpecial, stickerEmoji } from './stickerSets'

export interface AlbumViewProps {
  /** Owned sticker ids in the order they were earned */
  owned: readonly string[]
  /** Ids to flag with a "new!" badge */
  newIds?: readonly string[]
  /** Title of a skill, for the island stickers */
  skillTitle?: (skillId: string) => string | undefined
}

/** The sticker's name in the current language */
export function stickerName(t: TFunction, id: string, skillTitle?: (skillId: string) => string | undefined): string {
  const regular = findSticker(id)
  if (regular) return t(`album.names.${regular.sticker.key}`)
  const special = parseSpecial(id)
  if (!special) return id
  if (special.kind === 'streak') return t('album.special.streak', { n: special.ref })
  if (special.kind === 'extra') return t(`family.extras.sticker.${special.ref.startsWith('island:') ? 'island' : special.ref}`, { subject: t(`learn.subject.${special.ref.slice(7)}`) })
  if (special.kind === 'set') return t('album.special.set', { set: t(`album.sets.${special.ref}`) })
  const title = skillTitle?.(special.ref)
  return title ? t('album.special.skill', { title }) : t('album.special.skillUnknown')
}

const grid = 'grid grid-cols-5 gap-2 pt-2'

function EarnedTile({ id, name, isNew, onOpen }: { id: string; name: string; isNew: boolean; onOpen: () => void }) {
  const { t } = useTranslation()
  return (
    <li className="list-none">
      <button
        type="button"
        onClick={onOpen}
        aria-label={t('album.open', { name })}
        data-testid="sticker-earned"
        data-sticker={id}
        className="relative flex aspect-square min-h-[56px] w-full items-center justify-center rounded-2xl bg-white text-4xl shadow-sm transition-transform active:scale-95"
      >
        <span aria-hidden="true">{stickerEmoji(id)}</span>
        {isNew && (
          <span
            data-testid="sticker-new"
            className="absolute -right-1 -top-2 rounded-full bg-ludiko-pink px-1.5 py-0.5 text-xs font-extrabold leading-none text-ludiko-text shadow"
          >
            {t('album.newBadge')}
          </span>
        )}
      </button>
    </li>
  )
}

function LockedTile({ special = false }: { special?: boolean }) {
  const { t } = useTranslation()
  return (
    <li className="list-none">
      <span className="sr-only">{special ? t('album.lockedSpecial') : t('album.locked')}</span>
      <div
        data-testid="sticker-locked"
        aria-hidden="true"
        className="flex aspect-square min-h-[56px] w-full items-center justify-center rounded-2xl border-2 border-dashed border-ludiko-text/20 bg-ludiko-text/5 text-2xl font-extrabold text-ludiko-text/30"
      >
        ?
      </div>
    </li>
  )
}

function StickerDialog({ id, name, onClose }: { id: string; name: string; onClose: () => void }) {
  const { t } = useTranslation()
  const closeRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ludiko-text/40 px-4"
      onClick={onClose}
      data-testid="sticker-dialog-backdrop"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="sticker-dialog-title"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-sm rounded-3xl bg-white p-6 text-center shadow-xl"
      >
        <div className="flex items-end justify-center gap-1">
          <div className="text-[7.5rem] leading-none" aria-hidden="true" data-testid="sticker-big">
            {stickerEmoji(id)}
          </div>
          <MascotSvg mood="cheer" size={96} className="-ml-2 shrink-0" />
        </div>
        <h2 id="sticker-dialog-title" className="mt-3 text-2xl font-extrabold text-ludiko-text">
          {t('album.found', { name })}
        </h2>
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          className="mt-5 min-h-[56px] w-full rounded-2xl bg-ludiko-green text-xl font-extrabold text-ludiko-text shadow-md active:scale-95"
        >
          {t('album.close')}
        </button>
      </div>
    </div>
  )
}

/** The sticker album: one grid per set, earned stickers in colour, the rest as "?" */
export default function AlbumView({ owned, newIds = [], skillTitle }: AlbumViewProps) {
  const { t } = useTranslation()
  const [selected, setSelected] = useState<string | null>(null)
  const have = useMemo(() => new Set(knownStickers(owned)), [owned])
  const fresh = useMemo(() => new Set(newIds), [newIds])
  const progress = useMemo(() => setProgress([...have]), [have])

  const regularOwned = ALL_STICKERS.filter((x) => have.has(x.id)).length
  const specialOwned = [...have].filter((id) => parseSpecial(id)).sort((a, b) => owned.indexOf(a) - owned.indexOf(b))
  const lockedSpecial = FIXED_SPECIAL_IDS.filter((id) => !have.has(id))

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-3 rounded-3xl bg-white p-4 shadow-md">
        <MascotSvg mood="cheer" size={84} className="shrink-0" decorative />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-extrabold leading-tight text-ludiko-text">{t('album.title')}</h1>
          <p className="text-sm font-bold text-ludiko-text/80" data-testid="album-count">
            {t('album.count', { owned: regularOwned, total: ALL_STICKERS.length })}
          </p>
          <ProgressBar
            thin
            className="mt-2 !bg-ludiko-text/10"
            value={regularOwned / ALL_STICKERS.length}
            label={t('album.count', { owned: regularOwned, total: ALL_STICKERS.length })}
          />
        </div>
      </header>

      {have.size === 0 && (
        <section className="rounded-3xl bg-ludiko-yellow p-4 text-center shadow-md" data-testid="album-empty">
          <h2 className="text-lg font-extrabold text-ludiko-text">{t('album.emptyTitle')}</h2>
          <p className="mt-1 text-sm font-semibold text-ludiko-text/80">{t('album.emptyBody')}</p>
        </section>
      )}

      {STICKER_SETS.map((set, i) => {
        const p = progress[i]
        return (
          <section
            key={set.id}
            aria-labelledby={`album-set-${set.id}`}
            className="rounded-3xl bg-white/70 p-3 shadow-sm"
            data-testid={`album-set-${set.id}`}
          >
            <div className="mb-2 flex items-baseline justify-between gap-2 px-1">
              <h2 id={`album-set-${set.id}`} className="text-lg font-extrabold text-ludiko-text">
                <span aria-hidden="true">{set.icon} </span>
                {t(`album.sets.${set.id}`)}
              </h2>
              <span className="text-sm font-bold text-ludiko-text/70">
                {p.complete ? t('album.setDone') : t('album.setCount', { owned: p.owned, total: p.total })}
              </span>
            </div>
            <ul className={grid}>
              {set.stickers.map((x) =>
                have.has(x.id) ? (
                  <EarnedTile
                    key={x.id}
                    id={x.id}
                    name={t(`album.names.${x.key}`)}
                    isNew={fresh.has(x.id)}
                    onOpen={() => setSelected(x.id)}
                  />
                ) : (
                  <LockedTile key={x.id} />
                ),
              )}
            </ul>
          </section>
        )
      })}

      <section
        aria-labelledby="album-set-special"
        className="rounded-3xl bg-ludiko-purple/30 p-3 shadow-sm"
        data-testid="album-set-special"
      >
        <div className="mb-1 flex items-baseline justify-between gap-2 px-1">
          <h2 id="album-set-special" className="text-lg font-extrabold text-ludiko-text">
            <span aria-hidden="true">✨ </span>
            {t('album.sets.special')}
          </h2>
          <span className="text-sm font-bold text-ludiko-text/70">{specialOwned.length}</span>
        </div>
        <p className="mb-2 px-1 text-sm font-semibold text-ludiko-text/70">{t('album.specialHint')}</p>
        <ul className={grid}>
          {specialOwned.map((id) => (
            <EarnedTile
              key={id}
              id={id}
              name={stickerName(t, id, skillTitle)}
              isNew={fresh.has(id)}
              onOpen={() => setSelected(id)}
            />
          ))}
          {lockedSpecial.map((id) => (
            <LockedTile key={id} special />
          ))}
        </ul>
      </section>

      <details className="rounded-3xl bg-white p-4 shadow-sm">
        <summary className="min-h-[44px] cursor-pointer text-base font-extrabold text-ludiko-text">
          {t('album.howTitle')}
        </summary>
        <ul className="mt-2 flex flex-col gap-2 text-sm font-semibold text-ludiko-text/80">
          {(['session', 'mission', 'island', 'set', 'days', 'kind'] as const).map((k) => (
            <li key={k}>{t(`album.rules.${k}`)}</li>
          ))}
        </ul>
      </details>

      {selected && (
        <StickerDialog id={selected} name={stickerName(t, selected, skillTitle)} onClose={() => setSelected(null)} />
      )}
    </div>
  )
}
