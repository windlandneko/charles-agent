export type ChatMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  updatedAt?: string
  reasoningContent?: string
  reasoningOpen?: boolean
  thinkingEndedAt?: string
  thinkingStartedAt?: string
  isThinking?: boolean
}

export type ApiMessage = {
  role: ChatMessage['role']
  content: string
  reasoning_content?: string
}

export type StreamDelta = {
  content?: string
  reasoningContent?: string
}

type DeepSeekErrorResponse = {
  error?: {
    message?: string
  }
}

type DeepSeekStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
    }
  }>
}

export const deepseekModels = new Set(['deepseek-v4-flash', 'deepseek-v4-pro'])

export function createAssistantPlaceholder(thinkingMode: string): ChatMessage {
  const isThinking = thinkingMode !== 'off'
  const timestamp = new Date().toISOString()

  return {
    role: 'assistant',
    content: '',
    createdAt: timestamp,
    reasoningContent: '',
    reasoningOpen: isThinking,
    thinkingStartedAt: isThinking ? timestamp : undefined,
    isThinking,
  }
}

export function toApiMessages(messages: ChatMessage[]): ApiMessage[] {
  return messages
    .filter(message => message.content.trim().length > 0)
    .map(({ role, content, reasoningContent }) => ({
      role,
      content,
      ...(reasoningContent !== undefined
        ? { reasoning_content: reasoningContent }
        : {}),
    }))
}

export function updateStreamingMessage(
  messages: ChatMessage[],
  delta: StreamDelta
) {
  const next = [...messages]
  const message = next[next.length - 1]
  if (!message || message.role !== 'assistant') return messages

  const hasContent = delta.content !== undefined
  const thinkingEndedAt =
    hasContent && message.isThinking
      ? (message.thinkingEndedAt ?? new Date().toISOString())
      : message.thinkingEndedAt

  next[next.length - 1] = {
    ...message,
    content: hasContent ? message.content + delta.content : message.content,
    reasoningContent:
      delta.reasoningContent !== undefined
        ? `${message.reasoningContent ?? ''}${delta.reasoningContent}`
        : message.reasoningContent,
    thinkingEndedAt,
    isThinking: hasContent ? false : message.isThinking,
  }

  return next
}

export function finishStreamingMessage(messages: ChatMessage[]) {
  const next = [...messages]
  const message = next[next.length - 1]
  if (!message || message.role !== 'assistant') return messages

  next[next.length - 1] = {
    ...message,
    isThinking: false,
    reasoningOpen: false,
    thinkingEndedAt:
      message.isThinking && !message.thinkingEndedAt
        ? new Date().toISOString()
        : message.thinkingEndedAt,
  }

  return next
}

export async function streamDeepSeekChat({
  apiKey,
  model,
  thinkingMode,
  messages,
  signal,
  onDelta,
}: {
  apiKey: string
  model: string
  thinkingMode: string
  messages: ApiMessage[]
  signal: AbortSignal
  onDelta: (delta: StreamDelta) => void
}) {
  const response = await fetch('https://api.deepseek.com/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...getThinkingOptions(thinkingMode),
    }),
  })

  if (!response.ok) {
    const data = (await response.json()) as DeepSeekErrorResponse
    throw new Error(data.error?.message ?? response.statusText)
  }

  if (!response.body) {
    throw new Error('DeepSeek returned no response stream.')
  }

  await readDeepSeekStream(response.body, onDelta)
}

function getThinkingOptions(mode: string) {
  if (mode === 'off') {
    return {
      thinking: {
        type: 'disabled',
      },
    }
  }

  return {
    reasoning_effort: mode,
    thinking: {
      type: 'enabled',
    },
  }
}

async function readDeepSeekStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (delta: StreamDelta) => void
) {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue

      const payload = trimmed.slice(5).trim()
      if (payload === '[DONE]') return

      const chunk = JSON.parse(payload) as DeepSeekStreamChunk
      const delta = chunk.choices?.[0]?.delta

      if (delta?.reasoning_content !== undefined) {
        onDelta({ reasoningContent: delta.reasoning_content ?? '' })
      }
      if (delta?.content !== undefined) {
        onDelta({ content: delta.content ?? '' })
      }
    }
  }
}
