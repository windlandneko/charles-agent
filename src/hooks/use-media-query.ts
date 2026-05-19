import { useCallback, useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (onStoreChange: () => void) => {
      const mediaQuery = window.matchMedia(query)

      mediaQuery.addEventListener('change', onStoreChange)

      return () => mediaQuery.removeEventListener('change', onStoreChange)
    },
    [query]
  )
  const getSnapshot = useCallback(() => getMediaQuerySnapshot(query), [query])

  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}

export function useMaxWidth(width: number) {
  return useMediaQuery(`(max-width: ${width - 1}px)`)
}

function getMediaQuerySnapshot(query: string) {
  if (typeof window === 'undefined') return false

  return window.matchMedia(query).matches
}
