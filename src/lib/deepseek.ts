export type ChatMessage = {
  id?: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  updatedAt?: string
  reasoningContent?: string
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

type ChatCompletionsErrorResponse = {
  error?: {
    message?: string
  }
}

type ChatCompletionsStreamChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      reasoning_content?: string | null
    }
  }>
}

export type ChatProviderDefinition = {
  id: string
  label: string
  endpoint: string
  apiKeyRequired: boolean
  models: readonly ChatModelDefinition[]
}

export type ChatModelDefinition = {
  value: string
  label: string
}

export type ChatModelConfig = ChatModelDefinition & {
  providerId: string
  providerLabel: string
  endpoint: string
  apiKeyRequired: boolean
}

export const chatProviders = [
  {
    id: 'deepseek',
    label: 'Deepseek',
    endpoint: 'https://api.deepseek.com/chat/completions',
    apiKeyRequired: true,
    models: [
      { value: 'deepseek-v4-flash', label: 'Deepseek V4 Flash' },
      { value: 'deepseek-v4-pro', label: 'Deepseek V4 Pro' },
    ],
  },
] as const satisfies readonly ChatProviderDefinition[]

const chatModelConfigs = new Map<string, ChatModelConfig>()

for (const provider of chatProviders) {
  for (const model of provider.models) {
    chatModelConfigs.set(model.value, {
      ...model,
      providerId: provider.id,
      providerLabel: provider.label,
      endpoint: provider.endpoint,
      apiKeyRequired: provider.apiKeyRequired,
    })
  }
}

export const chatCompletionModels = new Set(chatModelConfigs.keys())
export const deepseekModels = chatCompletionModels

export function getChatModelConfig(model: string) {
  return chatModelConfigs.get(model)
}

export function createAssistantPlaceholder(thinkingMode: string): ChatMessage {
  const isThinking = thinkingMode !== 'off'
  const timestamp = new Date().toISOString()

  return {
    role: 'assistant',
    content: '',
    createdAt: timestamp,
    reasoningContent: '',
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
    thinkingEndedAt:
      message.isThinking && !message.thinkingEndedAt
        ? new Date().toISOString()
        : message.thinkingEndedAt,
  }

  return next
}

export async function streamChatCompletions({
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
const config = getChatModelConfig(model)
  if (!config) throw new Error(`Unknown chat model: ${model}`)

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  const trimmedApiKey = apiKey.trim()
  if (trimmedApiKey) headers.Authorization = `Bearer ${trimmedApiKey}`

  const response = await fetch(config.endpoint, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      ...getThinkingOptions(thinkingMode),
    }),
  })

  if (!response.ok) {
    const data = (await response.json()) as ChatCompletionsErrorResponse
    throw new Error(data.error?.message ?? response.statusText)
  }

  if (!response.body) {
    throw new Error(`${config.providerLabel} returned no response stream.`)
  }

  await readChatCompletionsStream(response.body, onDelta)
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

async function readChatCompletionsStream(
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

      const chunk = JSON.parse(payload) as ChatCompletionsStreamChunk
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
