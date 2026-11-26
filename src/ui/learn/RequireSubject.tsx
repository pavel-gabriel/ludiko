import type { ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import type { SubjectId } from '@/engine/types'
import { isSubjectAvailable } from '@/learner/availability'
import type { ChildProfile } from '@/profiles/types'
import RequireProfile from './RequireProfile'

/** Where a child lands when a subject has nothing for their grade yet: /learn with a friendly note */
export const lockedPath = (subject: SubjectId) => `/learn?locked=${subject}`

/**
 * Profile + subject gate for /learn/check|mission|map|bit: a subject whose content starts above the child's
 * grade redirects to /learn with a note, never to a screen that "finishes" instantly.
 */
export default function RequireSubject({
  subject,
  children,
}: {
  subject: SubjectId
  children: (profile: ChildProfile) => ReactNode
}) {
  return (
    <RequireProfile>
      {(profile) =>
        isSubjectAvailable(subject, profile.grade) ? <>{children(profile)}</> : <Navigate to={lockedPath(subject)} replace />
      }
    </RequireProfile>
  )
}
