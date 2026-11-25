import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import type { SessionReward } from '@/ui/session/types'
import { stickerName } from './AlbumView'
import { stickerEmoji } from './stickerSets'

/** Extra stickers earned on top of the session sticker (mission bonus, island, collection, play days) */
export function BonusStickers({ reward }: { reward: SessionReward | null }) {
  const { t } = useTranslation()
  const ids = reward?.bonus ?? []
  if (ids.length === 0) return null
  return (
    <ul className="flex flex-col gap-2" data-testid="sticker-bonus">
      {ids.map((id) => (
        <li key={id} className="flex items-center gap-4 rounded-3xl bg-ludiko-purple/40 p-3 shadow-md">
          <span className="text-5xl" aria-hidden="true">{stickerEmoji(id)}</span>
          <p className="text-base font-extrabold text-ludiko-text">{stickerName(t, id)}</p>
        </li>
      ))}
    </ul>
  )
}

/** Small "Vezi albumul" link */
export function AlbumLink({ className = '' }: { className?: string }) {
  const { t } = useTranslation()
  return (
    <Link
      to="/learn/album"
      data-testid="link-album"
      className={`inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 text-sm font-extrabold text-ludiko-text shadow-sm ${className}`}
    >
      <span aria-hidden="true">🎨 </span>
      {t('album.link')}
    </Link>
  )
}
