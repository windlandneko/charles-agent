import { useSyncExternalStore } from 'react'

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    onStoreChange => {
      const mediaQuery = window.matchMedia(query)

      mediaQuery.addEventListener('change', onStoreChange)

      return () => mediaQuery.removeEventListener('change', onStoreChange)
    },
    () => getMediaQuerySnapshot(query),
    () => false
  )
}

export function useMaxWidth(width: number) {
  return useMediaQuery(`(max-width: ${width - 1}px)`)
}

function getMediaQuerySnapshot(query: string) {
  if (typeof window === 'undefined') return false

  return window.matchMedia(query).matches
}
