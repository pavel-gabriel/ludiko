import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { getSkill } from '@/engine/content/registry'
import { localize } from '@/engine/types'
import type { ChildProfile } from '@/profiles/types'
import { getProgress } from '@/profiles/profileService'
import LearnShell, { LearnError, LearnLoading } from '@/ui/learn/LearnShell'
import RequireProfile from '@/ui/learn/RequireProfile'
import { useAsync } from '@/ui/learn/useAsync'
import AlbumView from './AlbumView'
import { awardSpecials, loadSeenCount, saveSeenCount } from './albumService'
import { knownStickers, newStickerIds } from './earning'

interface AlbumData {
  owned: string[]
  newIds: string[]
}

async function loadAlbum(profileId: string): Promise<AlbumData> {
  // catch up on special stickers that are due (islands conquered, play days) before drawing the album
  await awardSpecials(profileId).catch(() => [])
  const owned = knownStickers((await getProgress(profileId)).stickers)
  const newIds = newStickerIds(owned, loadSeenCount(profileId))
  return { owned, newIds }
}

function Album({ profile }: { profile: ChildProfile }) {
  const { t, i18n } = useTranslation()
  const { data, failed, reload } = useAsync(() => loadAlbum(profile.id), profile.id)

  // remember what the child has now seen, only once it is on screen (so a double load never loses the badges)
  const seenCount = data?.owned.length
  useEffect(() => {
    if (seenCount !== undefined) saveSeenCount(profile.id, seenCount)
  }, [profile.id, seenCount])

  if (failed) return <LearnError onRetry={reload} backTo="/learn" />
  if (!data) return <LearnLoading />

  const skillTitle = (skillId: string) => {
    const skill = getSkill(skillId)
    return skill ? localize(skill.title, i18n.language) : undefined
  }

  return (
    <LearnShell backTo="/learn" backLabel={t('album.back')}>
      <AlbumView owned={data.owned} newIds={data.newIds} skillTitle={skillTitle} />
    </LearnShell>
  )
}

/** /learn/album — the child's sticker album */
export default function AlbumPage() {
  return <RequireProfile>{(profile) => <Album profile={profile} />}</RequireProfile>
}
