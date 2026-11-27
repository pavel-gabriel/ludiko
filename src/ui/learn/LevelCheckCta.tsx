import { useEffect, useState } from 'react'
import { checkStateOf, checkSubjects } from '@/learner/checkSubjects'
import { ageBand } from '@/older/ageBand'
import { getProgress } from '@/profiles/profileService'
import type { ChildProfile } from '@/profiles/types'
import CheckProgressCard, { type CheckStatus } from './CheckProgressCard'
import { LEARN_SUBJECTS } from './subjects'

/** The child's check progress across subjects, from local progress only (offline, no learner service) */
export async function loadCheckStatuses(profile: ChildProfile, now = Date.now()): Promise<CheckStatus[]> {
  const progress = await getProgress(profile.id)
  return checkSubjects(profile, LEARN_SUBJECTS, now).map((subject) => ({ subject, placement: checkStateOf(progress, subject) }))
}

/**
 * Landing-page call to action (lazy: keeps the content registry out of the initial bundle): while some
 * subject's level check is not finished, "Hai să vedem ce știi!" with progress per subject, right under the
 * profile. Nothing once everything is checked (the "Învață cu Ludiko" door leads to the daily plan then).
 */
export default function LevelCheckCta({ profile }: { profile: ChildProfile }) {
  const [checks, setChecks] = useState<CheckStatus[] | null>(null)
  useEffect(() => {
    let live = true
    loadCheckStatuses(profile).then(
      (c) => live && setChecks(c),
      () => live && setChecks([]),
    )
    return () => {
      live = false
    }
  }, [profile])
  if (!checks || checks.length === 0) return null
  return (
    <div className="mb-4 w-full">
      <CheckProgressCard checks={checks} band={ageBand(profile.grade)} testId="landing-check" />
    </div>
  )
}
