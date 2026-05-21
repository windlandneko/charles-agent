import {
  type ChatMessage,
  type StreamDelta,
  chatCompletionModels,
  createAssistantPlaceholder,
  finishStreamingMessage,
  getChatModelConfig,
  streamChatCompletions,
  toApiMessages,
  updateStreamingMessage,
} from '@/lib/deepseek'
import { storage } from '@/lib/storage'
import type { ContentPart } from '@/lib/llm/types'
import type {
  MessageStatus,
  StoredMessage,
  StoredMessageContent,
} from '@/lib/storage/schema'

export type StreamOptions = {
  apiKey: string
  model: string
  thinkingMode: string
}

export type AgentSessionSnapshot = {
  draft: string
  error: string | null
  isLoadingThread: boolean
  isSending: boolean
  messages: ChatMessage[]
}

export const emptySnapshot: AgentSessionSnapshot = {
  draft: '',
  error: null,
  isLoadingThread: false,
  isSending: false,
  messages: [],
}

export const loadingSnapshot: AgentSessionSnapshot = {
  ...emptySnapshot,
  isLoadingThread: true,
}

export function getError(cause: unknown, defaultMessage: string) {
  if (cause instanceof Error) return cause.message
  return defaultMessage
}

export function getOptionsOrError({
  apiKey,
  model,
  thinkingMode,
}: StreamOptions) {
  const trimmedApiKey = apiKey.trim()
  const config = getChatModelConfig(model)

  if (!config || !chatCompletionModels.has(model)) {
    return 'Only configured chat completion models are connected right now.'
  }
  if (config.apiKeyRequired && !trimmedApiKey) {
    return `Please enter a ${config.providerLabel} API key first.`
  }

  return {
    apiKey: trimmedApiKey,
    model,
    thinkingMode,
  }
}

export function getThinkingEndedAt(message: StoredMessage) {
  const value = message.metadata?.thinkingEndedAt
  if (typeof value === 'string') return value

  return message.status === 'streaming' ? undefined : message.updatedAt
}

export function getMessageText(content: StoredMessageContent) {
  if (typeof content === 'string') return content

  return content
    .map((part: ContentPart) => {
      if (part.type === 'text' || part.type === 'reasoning') return part.text
      if (part.type === 'tool-result') return part.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

export function toChatMessage(message: StoredMessage): ChatMessage | null {
  if (message.role !== 'user' && message.role !== 'assistant') return null

  return {
    id: message.id,
    role: message.role,
    content: getMessageText(message.content),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
    reasoningContent: message.reasoningContent,
    reasoningOpen:
      message.status === 'streaming' && Boolean(message.reasoningContent),
    thinkingEndedAt: getThinkingEndedAt(message),
    thinkingStartedAt: message.createdAt,
    isThinking: message.status === 'streaming',
  }
}

export function getThreadTitle(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled chat'
}

export class AgentSession {
  private abortController: AbortController | null = null
  private assistant: ChatMessage | null = null
  private listeners = new Set<(snapshot: AgentSessionSnapshot) => void>()
  private loadPromise: Promise<void> | null = null
  private loaded = false
  public snapshot = emptySnapshot

  private readonly threadId: string

  constructor(threadId: string) {
    this.threadId = threadId
  }

  get loadedSnapshot() {
    return this.loaded ? this.snapshot : loadingSnapshot
  }

  subscribe(listener: (snapshot: AgentSessionSnapshot) => void) {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  hydrate(messages: ChatMessage[]) {
    this.loaded = true
    this.patch({ error: null, isLoadingThread: false, messages })
  }

  async load() {
    if (this.loaded) return
    if (this.loadPromise) return this.loadPromise

    this.patch({ error: null, isLoadingThread: true, messages: [] })

    this.loadPromise = this.loadMessages()
    return this.loadPromise
  }

  private async loadMessages() {
    try {
      const messages = (await storage.chats.listMessages(this.threadId))
        .map(toChatMessage)
        .filter((message): message is ChatMessage => Boolean(message))
      this.loaded = true
      this.patch({ isLoadingThread: false, messages })
    } catch (cause) {
      this.patch({
        error: getError(cause, 'Unable to load this chat.'),
        isLoadingThread: false,
      })
    } finally {
      this.loadPromise = null
    }
  }

  async send(content: string, options: StreamOptions) {
    if (this.snapshot.isSending) return

    try {
      const user = await this.appendUser(content, options)
      if (!user) return

      const assistant = await this.appendAssistant(options)
      const previous = [...this.snapshot.messages, user]
      this.prepareRun(previous, assistant, { draft: '' })
      await this.run(previous, assistant, options)
    } catch (cause) {
      this.patch({ error: getError(cause, 'Unable to save this chat.') })
    }
  }

  async retry(index: number, options: StreamOptions) {
    const message = this.snapshot.messages[index]
    if (
      !message?.id ||
      message.role !== 'assistant' ||
      this.snapshot.isSending
    ) {
      return
    }

    const previous = this.snapshot.messages.slice(0, index)
    const trailing = this.snapshot.messages.slice(index + 1)
    const assistant = {
      ...createAssistantPlaceholder(options.thinkingMode),
      id: message.id,
    }

    try {
      await Promise.all(
        trailing.map(msg =>
          msg.id ? storage.chats.deleteMessage(msg.id) : undefined
        )
      )
      await this.resetAssistant(message.id, options)
      this.prepareRun(previous, assistant)
      await this.run(previous, assistant, options)
    } catch (cause) {
      this.patch({ error: getError(cause, 'Unable to retry this message.') })
    }
  }

  stop() {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }

    void this.finish('done').finally(() => {
      this.patch({ isSending: false })
    })
  }

  changeReasoningOpen(index: number, open: boolean) {
    this.patch({
      messages: this.snapshot.messages.map((message, messageIndex) =>
        messageIndex === index ? { ...message, reasoningOpen: open } : message
      ),
    })
  }

  dispose() {
    this.abortController?.abort()
    this.listeners.clear()
  }

  patch(patch: Partial<AgentSessionSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  private async run(
    previous: ChatMessage[],
    assistant: ChatMessage,
    options: StreamOptions
  ) {
    this.abortController?.abort()
    const abortController = new AbortController()
    this.abortController = abortController
    this.assistant = assistant

    this.patch({
      error: null,
      isSending: true,
      messages: [...previous, assistant],
    })

    try {
      await streamChatCompletions({
        ...options,
        messages: toApiMessages(previous),
        signal: abortController.signal,
        onDelta: (delta: StreamDelta) => {
          if (!this.assistant) return
          this.assistant = updateStreamingMessage(
            [this.assistant],
            delta
          )[0] as ChatMessage
          this.replace(this.assistant)
        },
      })
      await this.finish('done')
    } catch (cause) {
      const isAbort =
        cause instanceof DOMException && cause.name === 'AbortError'
      if (!isAbort) {
        this.patch({
          error: getError(
            cause,
            `Unable to contact ${getProviderLabel(options.model)}. Please try again.`
          ),
        })
      }
      await this.finish(isAbort ? 'done' : 'error')
    } finally {
      if (this.abortController === abortController) {
        this.abortController = null
        this.assistant = null
        this.patch({ isSending: false })
      }
    }
  }

  private prepareRun(
    previous: ChatMessage[],
    assistant: ChatMessage,
    patch: Partial<AgentSessionSnapshot> = {}
  ) {
    this.loaded = true
    this.patch({
      ...patch,
      error: null,
      messages: [...previous, assistant],
    })
  }

  private async finish(status: MessageStatus) {
    if (!this.assistant?.id) return

    const [assistant] = finishStreamingMessage([this.assistant])
    if (!assistant.id) return

    this.assistant = assistant
    this.replace(assistant)
    const patch = {
      content: assistant.content,
      reasoningContent: assistant.reasoningContent,
      status,
      ...(assistant.thinkingEndedAt
        ? { metadata: { thinkingEndedAt: assistant.thinkingEndedAt } }
        : {}),
    }

    try {
      await storage.chats.updateMessage(assistant.id, patch)
    } catch (error) {
      console.error('Failed to update finished message', error)
      this.patch({ error: getError(error, 'Unable to save final message.') })
    }
  }

  private replace(message: ChatMessage) {
    if (!message.id) return

    let replaced = false
    const messages = this.snapshot.messages.map(item => {
      if (item.id !== message.id) return item
      replaced = true
      return message
    })
    this.patch({ messages: replaced ? messages : [...messages, message] })
  }

  private async appendAssistant(options: StreamOptions) {
    const message = await storage.chats.appendMessage({
      threadId: this.threadId,
      role: 'assistant',
      content: '',
      reasoningContent: '',
      providerId: getProviderId(options.model),
      modelId: options.model,
      status: 'streaming',
    })

    return {
      ...createAssistantPlaceholder(options.thinkingMode),
      id: message.id,
      createdAt: message.createdAt,
      thinkingStartedAt: message.createdAt,
      updatedAt: message.updatedAt,
    }
  }

  private async appendUser(content: string, options: StreamOptions) {
    const message = await storage.chats.appendMessage({
      threadId: this.threadId,
      role: 'user',
      content,
      providerId: getProviderId(options.model),
      modelId: options.model,
      status: 'done',
    })
    return toChatMessage(message)
  }

  private resetAssistant(messageId: string, options: StreamOptions) {
    return storage.chats.updateMessage(messageId, {
      content: '',
      reasoningContent: '',
      providerId: getProviderId(options.model),
      modelId: options.model,
      status: 'streaming',
    })
  }
}

function getProviderId(model: string) {
  return getChatModelConfig(model)?.providerId ?? 'unknown'
}

function getProviderLabel(model: string) {
  return getChatModelConfig(model)?.providerLabel ?? 'the provider'
}
