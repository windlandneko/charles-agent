import {
  type Dispatch,
  type SetStateAction,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import {
  type ChatMessage,
  createAssistantPlaceholder,
  deepseekModels,
  finishStreamingMessage,
  streamDeepSeekChat,
  toApiMessages,
  updateStreamingMessage,
} from '@/lib/deepseek'
import { storage } from '@/lib/storage'
import type {
  MessageStatus,
  StoredMessage,
  StoredMessageContent,
} from '@/lib/storage/schema'

import type { ChatThreadsController } from './use-chat-threads'

type StreamOptions = {
  apiKey: string
  model: string
  thinkingMode: string
}

type AgentWorkerSnapshot = {
  draft: string
  error: string | null
  isLoadingThread: boolean
  isSending: boolean
  messages: ChatMessage[]
}

const providerId = 'deepseek'
const emptySnapshot: AgentWorkerSnapshot = {
  draft: '',
  error: null,
  isLoadingThread: false,
  isSending: false,
  messages: [],
}
const loadingSnapshot: AgentWorkerSnapshot = {
  ...emptySnapshot,
  isLoadingThread: true,
}

export function useAgentWorker({
  chatThreads,
}: {
  chatThreads: ChatThreadsController
}) {
  const { activeThreadId, activateThread, refreshThreads } = chatThreads
  const workersRef = useRef(new Map<string, AgentWorker>())
  const activeWorkerRef = useRef<AgentWorker | null>(null)
  const newDraftRef = useRef('')

  const [apiKey, setApiKey] = useRefState('')
  const [model, setModel] = useRefState('deepseek-v4-flash')
  const [newDraft, setNewDraft] = useState('')
  const [thinkingMode, setThinkingMode] = useRefState('xhigh')
  const [snapshot, setSnapshot] = useState(emptySnapshot)

  const getWorker = useCallback((threadId: string) => {
    let worker = workersRef.current.get(threadId)
    if (!worker) {
      worker = new AgentWorker(threadId)
      workersRef.current.set(threadId, worker)
    }
    return worker
  }, [])

  useEffect(() => {
    if (!activeThreadId) {
      activeWorkerRef.current = null
      setSnapshot({ ...emptySnapshot, draft: newDraftRef.current })
      return
    }

    const worker = getWorker(activeThreadId)
    activeWorkerRef.current = worker
    const unsubscribe = worker.subscribe(setSnapshot)
    setSnapshot(worker.loadedSnapshot)
    void worker.load()
    return unsubscribe
  }, [activeThreadId, getWorker])

  useEffect(() => {
    const workers = workersRef.current
    return () => {
      for (const worker of workers.values()) worker.dispose()
    }
  }, [])

  const updateDraft = useCallback((value: string) => {
    const worker = activeWorkerRef.current
    if (worker) {
      worker.patch({ draft: value })
      return
    }

    newDraftRef.current = value
    setNewDraft(value)
    setSnapshot(current => ({ ...current, draft: value }))
  }, [])

  const getOptions = useCallback(() => {
    return getOptionsOrError({
      apiKey: apiKey.current,
      model: model.current,
      thinkingMode: thinkingMode.current,
    })
  }, [apiKey, model, thinkingMode])

  const send = useCallback(async () => {
    const worker = activeWorkerRef.current
    const content = (worker?.snapshot.draft ?? newDraftRef.current).trim()
    if (!content) return

    const options = getOptions()
    if (typeof options === 'string') {
      setActiveError(worker, setSnapshot, options)
      return
    }

    let target = worker
    if (!target) {
      try {
        const thread = await storage.chats.saveThread({
          title: getThreadTitle(content),
        })
        target = getWorker(thread.id)
        target.hydrate([])
        newDraftRef.current = ''
        setNewDraft('')
        activateThread(thread.id)
      } catch (cause) {
        setActiveError(
          null,
          setSnapshot,
          getError(cause, 'Unable to create this chat.')
        )
        return
      }
    }

    await target.send(content, options, refreshThreads)
  }, [activateThread, getOptions, getWorker, refreshThreads])

  const retryMessage = useCallback(
    async (index: number) => {
      const worker = activeWorkerRef.current
      const options = getOptions()
      if (!worker) return
      if (typeof options === 'string') {
        worker.patch({ error: options })
        return
      }

      await worker.retry(index, options, refreshThreads)
    },
    [getOptions, refreshThreads]
  )

  const copyMessage = useCallback(async (message: ChatMessage) => {
    if (!message.content) return false

    try {
      await navigator.clipboard.writeText(message.content)
      return true
    } catch {
      setActiveError(
        activeWorkerRef.current,
        setSnapshot,
        'Unable to copy this message.'
      )
      return false
    }
  }, [])

  return {
    apiKey: apiKey.current,
    draft: activeWorkerRef.current ? snapshot.draft : newDraft,
    error: snapshot.error,
    isLoadingThread: snapshot.isLoadingThread,
    isSending: snapshot.isSending,
    messages: snapshot.messages,
    model: model.current,
    thinkingMode: thinkingMode.current,
    changeReasoningOpen: (index: number, open: boolean) =>
      activeWorkerRef.current?.changeReasoningOpen(index, open),
    copyMessage,
    retryMessage,
    send,
    stopGeneration: () => activeWorkerRef.current?.stop(refreshThreads),
    updateApiKey: setApiKey,
    updateDraft,
    updateModel: setModel,
    updateThinkingMode: setThinkingMode,
  }
}

class AgentWorker {
  private abortController: AbortController | null = null
  private assistant: ChatMessage | null = null
  private listeners = new Set<(snapshot: AgentWorkerSnapshot) => void>()
  private loadPromise: Promise<void> | null = null
  private loaded = false
  snapshot = emptySnapshot

  private readonly threadId: string

  constructor(threadId: string) {
    this.threadId = threadId
  }

  get loadedSnapshot() {
    return this.loaded ? this.snapshot : loadingSnapshot
  }

  subscribe(listener: (snapshot: AgentWorkerSnapshot) => void) {
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

  async send(
    content: string,
    options: StreamOptions,
    onStorageChanged: () => void
  ) {
    if (this.snapshot.isSending) return

    try {
      const user = await appendUser(this.threadId, content, options)
      if (!user) return

      const assistant = await appendAssistant(this.threadId, options)
      const previous = [...this.snapshot.messages, user]
      this.prepareRun(previous, assistant, onStorageChanged, { draft: '' })
      await this.run(previous, assistant, options, onStorageChanged)
    } catch (cause) {
      this.patch({ error: getError(cause, 'Unable to save this chat.') })
    }
  }

  async retry(
    index: number,
    options: StreamOptions,
    onStorageChanged: () => void
  ) {
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
      await Promise.all(trailing.map(deleteIfStored))
      await resetAssistant(message.id, options)
      this.prepareRun(previous, assistant, onStorageChanged)
      await this.run(previous, assistant, options, onStorageChanged)
    } catch (cause) {
      this.patch({ error: getError(cause, 'Unable to retry this message.') })
    }
  }

  stop(onStorageChanged: () => void) {
    this.abortController?.abort()
    this.patch({ isSending: false })
    void this.finish('done', onStorageChanged)
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

  patch(patch: Partial<AgentWorkerSnapshot>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners) listener(this.snapshot)
  }

  private async run(
    previous: ChatMessage[],
    assistant: ChatMessage,
    options: StreamOptions,
    onStorageChanged: () => void
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
      await streamDeepSeekChat({
        ...options,
        messages: toApiMessages(previous),
        signal: abortController.signal,
        onDelta: delta => {
          if (!this.assistant) return
          this.assistant = updateStreamingMessage([this.assistant], delta)[0]
          this.replace(this.assistant)
        },
      })
      await this.finish('done', onStorageChanged)
    } catch (cause) {
      if (!(cause instanceof DOMException && cause.name === 'AbortError')) {
        this.patch({
          error: getError(
            cause,
            'Unable to contact DeepSeek. Please try again.'
          ),
        })
      }
      await this.finish(
        cause instanceof DOMException && cause.name === 'AbortError'
          ? 'done'
          : 'error',
        onStorageChanged
      )
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
    onStorageChanged: () => void,
    patch: Partial<AgentWorkerSnapshot> = {}
  ) {
    this.loaded = true
    this.patch({
      ...patch,
      error: null,
      messages: [...previous, assistant],
    })
    onStorageChanged()
  }

  private async finish(status: MessageStatus, onStorageChanged: () => void) {
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

    await storage.chats.updateMessage(assistant.id, patch)
    onStorageChanged()
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
}

function useRefState<T>(initialValue: T) {
  const [value, setValue] = useState(initialValue)
  const ref = useRef(value)

  const update = useCallback((nextValue: T) => {
    ref.current = nextValue
    setValue(nextValue)
  }, [])

  return [ref, update] as const
}

async function appendAssistant(threadId: string, options: StreamOptions) {
  const message = await storage.chats.appendMessage({
    threadId,
    role: 'assistant',
    content: '',
    reasoningContent: '',
    providerId,
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

async function appendUser(
  threadId: string,
  content: string,
  options: StreamOptions
) {
  return toChatMessage(
    await storage.chats.appendMessage({
      threadId,
      role: 'user',
      content,
      providerId,
      modelId: options.model,
      status: 'done',
    })
  )
}

function deleteIfStored(message: ChatMessage) {
  return message.id ? storage.chats.deleteMessage(message.id) : undefined
}

function resetAssistant(messageId: string, options: StreamOptions) {
  return storage.chats.updateMessage(messageId, {
    content: '',
    reasoningContent: '',
    providerId,
    modelId: options.model,
    status: 'streaming',
  })
}

function setActiveError(
  worker: AgentWorker | null,
  setSnapshot: Dispatch<SetStateAction<AgentWorkerSnapshot>>,
  error: string
) {
  if (worker) {
    worker.patch({ error })
    return
  }
  setSnapshot(current => ({ ...current, error }))
}

function toChatMessage(message: StoredMessage): ChatMessage | null {
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

function getThinkingEndedAt(message: StoredMessage) {
  const value = message.metadata?.thinkingEndedAt
  if (typeof value === 'string') return value

  return message.status === 'streaming' ? undefined : message.updatedAt
}

function getMessageText(content: StoredMessageContent) {
  if (typeof content === 'string') return content

  return content
    .map(part => {
      if (part.type === 'text' || part.type === 'reasoning') return part.text
      if (part.type === 'tool-result') return part.content
      return ''
    })
    .filter(Boolean)
    .join('\n')
}

function getThreadTitle(content: string) {
  return content.replace(/\s+/g, ' ').trim().slice(0, 60) || 'Untitled chat'
}

function getError(cause: unknown, fallback: string) {
  return cause instanceof Error ? cause.message : fallback
}

function getOptionsOrError({ apiKey, model, thinkingMode }: StreamOptions) {
  const trimmedApiKey = apiKey.trim()
  if (!trimmedApiKey) return 'Please enter a DeepSeek API key first.'
  if (!deepseekModels.has(model)) {
    return 'Only DeepSeek models are connected right now.'
  }

  return {
    apiKey: trimmedApiKey,
    model,
    thinkingMode,
  }
}
