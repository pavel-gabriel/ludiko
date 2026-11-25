import { useEffect, type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { ChildProfile } from '@/profiles/types'
import { useProfileStore } from '@/store/profileStore'
import { LearnLoading } from './LearnShell'

/** The learner area needs an active child profile; otherwise go pick one. */
export default function RequireProfile({ children }: { children: (profile: ChildProfile) => ReactNode }) {
  const activeProfile = useProfileStore((s) => s.activeProfile)
  const loaded = useProfileStore((s) => s.loaded)
  const load = useProfileStore((s) => s.load)

  useEffect(() => {
    if (!loaded) void load().catch(() => {})
  }, [loaded, load])

  if (!loaded) return <LearnLoading />
  if (!activeProfile) return <Navigate to="/profiles" replace />
  return <>{children(activeProfile)}</>
}
