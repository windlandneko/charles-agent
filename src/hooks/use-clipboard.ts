import { useEffect, useRef, useState } from 'react'

export function useCopyToClipboard(timeout = 2000) {
  const [copied, setCopied] = useState(false)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
    }
  }, [])

  const copy = async (text: string) => {
    if (!text) return false
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      if (timerRef.current !== null) {
        window.clearTimeout(timerRef.current)
      }
      timerRef.current = window.setTimeout(() => setCopied(false), timeout)
      return true
    } catch (err) {
      console.error('Failed to copy text', err)
      return false
    }
  }

  return { copied, copy }
}
