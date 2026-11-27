import { useCallback, useState } from 'react'

/**
 * Small per-device UI preferences in localStorage (docs/PRIVACY_DATA_MAP.md D17): filter toggles, which
 * first-run guides were seen, how often an item type's how-to line was shown. Device conveniences only, never
 * learning evidence. Every access is wrapped in try/catch; when storage is unavailable (private window,
 * blocked site data) a memory copy keeps the session consistent and the UI still works.
 */
const memory = new Map<string, string>()

export const PREF_PREFIX = 'ludiko.ui.'

export function readPref(key: string): string | null {
  try {
    const v = localStorage.getItem(PREF_PREFIX + key)
    if (v !== null) return v
  } catch {
    /* storage unavailable: fall back to memory */
  }
  return memory.get(key) ?? null
}

export function writePref(key: string, value: string | null): void {
  if (value === null) memory.delete(key)
  else memory.set(key, value)
  try {
    if (value === null) localStorage.removeItem(PREF_PREFIX + key)
    else localStorage.setItem(PREF_PREFIX + key, value)
  } catch {
    /* memory copy stays */
  }
}

export function readBoolPref(key: string, fallback: boolean): boolean {
  const v = readPref(key)
  return v === null ? fallback : v === '1'
}

/** A boolean preference remembered on this device */
export function useBoolPref(key: string, fallback: boolean): [boolean, (v: boolean) => void] {
  const [value, setValue] = useState(() => readBoolPref(key, fallback))
  const set = useCallback(
    (v: boolean) => {
      writePref(key, v ? '1' : '0')
      setValue(v)
    },
    [key],
  )
  return [value, set]
}

/** Test helper: forget the memory copies (localStorage is cleared by the test itself) */
export function resetPrefMemory(): void {
  memory.clear()
}
