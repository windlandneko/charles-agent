import type { Credential } from '@/lib/llm/credentials'
import type { ProviderProfile } from '@/lib/llm/profile'
import type { FetchLike } from '@/lib/llm/transport'

export type ProviderErrorResponse = {
  error?: {
    message?: string
    code?: string
    type?: string
  }
}

export class ProviderHttpError extends Error {
  status: number
  code?: string
  retryAfterMs?: number

  constructor(response: Response, data: ProviderErrorResponse) {
    super(data.error?.message ?? response.statusText)
    this.name = 'ProviderHttpError'
    this.status = response.status
    this.code = data.error?.code ?? data.error?.type
    this.retryAfterMs = parseRetryAfter(response.headers.get('retry-after'))
  }
}

export function createHeaders({
  credential,
  profile,
  extraHeaders,
}: {
  credential: Credential
  profile: ProviderProfile
  extraHeaders?: Record<string, string>
}) {
  return {
    'Content-Type': 'application/json',
    ...profile.headers,
    ...credential.headers,
    ...extraHeaders,
  }
}

export function getFetch(fetchLike?: FetchLike) {
  return fetchLike ?? fetch
}

export function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`
}

export async function createProviderError(response: Response) {
  try {
    const data = (await response.json()) as ProviderErrorResponse
    return new ProviderHttpError(response, data)
  } catch {
    return new ProviderHttpError(response, {})
  }
}

export async function* readServerSentEvents(body: ReadableStream<Uint8Array>) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true }).replaceAll('\r\n', '\n')
      const events = buffer.split('\n\n')
      buffer = events.pop() ?? ''

      for (const event of events) {
        const data = parseSseEvent(event)
        if (data) yield data
      }
    }

    const finalData = parseSseEvent(buffer)
    if (finalData) yield finalData
  } finally {
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function parseSseEvent(event: string) {
  let eventName = 'message'
  const data = event
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith(':'))
    .flatMap(line => {
      if (line.startsWith('event:')) {
        eventName = line.slice(6).trim()
        return []
      }
      return line.startsWith('data:') ? [line.slice(5).trim()] : []
    })
    .join('\n')
  if (eventName === 'error') throw new Error(data || 'Provider stream error.')
  return data
}

function parseRetryAfter(value: string | null) {
  if (!value) return undefined
  const seconds = Number(value)
  if (Number.isFinite(seconds)) return seconds * 1000
  const date = Date.parse(value)
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now())
}
