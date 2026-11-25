import { useEffect, useState } from 'react'
import { readFamilyState, subscribeFamilyState } from './familyState'
import type { FamilySession } from './types'

/** The signed-in parent as this device remembers it (re-renders when it changes). Never loads Firebase. */
export function useFamilySession(): FamilySession | null {
  const [session, setSession] = useState<FamilySession | null>(() => readFamilyState())
  useEffect(() => {
    const update = () => setSession(readFamilyState())
    update()
    return subscribeFamilyState(update)
  }, [])
  return session
}
