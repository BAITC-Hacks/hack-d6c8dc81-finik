import { useEffect, useState } from 'react'

// A keyed result cannot render for another employee. Cleanup also guards against
// stale responses even when a transport finishes after its signal was aborted.
export function useApiResource(load, key) {
  const [attempt, setAttempt] = useState(0)
  const [result, setResult] = useState(null)
  useEffect(() => {
    if (key === null) return
    const controller = new AbortController()
    load(key, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) setResult({ key, attempt, data })
      },
      (error) => {
        if (!controller.signal.aborted) setResult({ key, attempt, error: error.message })
      },
    )
    return () => controller.abort()
  }, [load, key, attempt])
  const current = result?.key === key && result?.attempt === attempt ? result : null
  return {
    data: current?.data,
    error: current?.error,
    loading: key !== null && !current,
    retry: () => setAttempt((value) => value + 1),
    replace: (data) => setResult({ key, attempt, data }),
  }
}
