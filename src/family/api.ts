/**
 * Lazy access to the family service. Screens call `getFamilyApi()` instead of importing `familyService`
 * so Firebase stays out of the initial bundle; tests and the /dev/family fixture install an in-memory
 * implementation with `setFamilyApi`.
 */
import { familyConfigured } from './familyState'
import type { FamilyApi } from './types'

let override: FamilyApi | null = null

export function setFamilyApi(api: FamilyApi | null): void {
  override = api
}

/** Accounts can work: Firebase is configured (or a stand-in API is installed) */
export function familyAvailable(): boolean {
  return override !== null || familyConfigured()
}

export async function getFamilyApi(): Promise<FamilyApi> {
  if (override) return override
  return (await import('./familyService')).familyApi
}
