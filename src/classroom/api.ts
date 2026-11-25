/**
 * Lazy access to the classroom service. Screens call `getClassroomApi()` instead of importing
 * `classroomService` so Firebase stays out of the initial bundle; tests and the /dev/classroom fixture
 * install an in-memory implementation with `setClassroomApi`.
 */
import type { ClassroomApi } from './types'

let override: ClassroomApi | null = null

export function setClassroomApi(api: ClassroomApi | null): void {
  override = api
}

export async function getClassroomApi(): Promise<ClassroomApi> {
  if (override) return override
  return (await import('./classroomService')).classroomApi
}
