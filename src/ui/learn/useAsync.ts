import { useCallback, useEffect, useState } from 'react'

export interface AsyncState<T> {
  data: T | undefined
  loading: boolean
  failed: boolean
  reload: () => void
}

/** Runs `load` on mount and whenever `key` changes; ignores results of stale runs. Errors never throw into render. */
export function useAsync<T>(load: () => Promise<T>, key: string): AsyncState<T> {
  const [state, setState] = useState<{ data: T | undefined; loading: boolean; failed: boolean }>({
    data: undefined,
    loading: true,
    failed: false,
  })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, failed: false }))
    load().then(
      (data) => {
        if (!cancelled) setState({ data, loading: false, failed: false })
      },
      () => {
        if (!cancelled) setState({ data: undefined, loading: false, failed: true })
      },
    )
    return () => {
      cancelled = true
    }
    // `load` is a fresh closure every render; `key` identifies what it loads
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, nonce])

  const reload = useCallback(() => setNonce((n) => n + 1), [])
  return { ...state, reload }
}
