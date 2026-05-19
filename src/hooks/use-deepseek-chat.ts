import { useCallback, useEffect, useRef, useState } from 'react'

import {
  createAssistantPlaceholder,
  deepseekModels,
  finishStreamingMessage,
  streamDeepSeekChat,
  toApiMessages,
  updateStreamingMessage,
  type ApiMessage,
  type ChatMessage,
} from '@/lib/deepseek'

type StreamOptions = {
  apiKey: string
  model: string
  thinkingMode: string
}

export function useDeepSeekChat() {
  const [apiKey, setApiKey] = useState('')
  const [draft, setDraft] = useState('')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [thinkingMode, setThinkingMode] = useState('off')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const abortControllerRef = useRef<AbortController | null>(null)
  const isMountedRef = useRef(true)
  const apiKeyRef = useRef(apiKey)
  const draftRef = useRef(draft)
  const isSendingRef = useRef(isSending)
  const messagesRef = useRef(messages)
  const modelRef = useRef(model)
  const thinkingModeRef = useRef(thinkingMode)

  const updateMessages = useCallback(
    (
      nextMessages: ChatMessage[] | ((current: ChatMessage[]) => ChatMessage[])
    ) => {
      setMessages((current) => {
        const next =
          typeof nextMessages === 'function'
            ? nextMessages(current)
            : nextMessages
        messagesRef.current = next
        return next
      })
    },
    []
  )

  const updateIsSending = useCallback((value: boolean) => {
    isSendingRef.current = value
    setIsSending(value)
  }, [])

  const updateApiKey = useCallback((value: string) => {
    apiKeyRef.current = value
    setApiKey(value)
  }, [])

  const updateDraft = useCallback((value: string) => {
    draftRef.current = value
    setDraft(value)
  }, [])

  const updateModel = useCallback((value: string) => {
    modelRef.current = value
    setModel(value)
  }, [])

  const updateThinkingMode = useCallback((value: string) => {
    thinkingModeRef.current = value
    setThinkingMode(value)
  }, [])

  useEffect(() => {
    return () => {
      isMountedRef.current = false
      abortControllerRef.current?.abort()
    }
  }, [])

  const streamAssistantResponse = useCallback(
    async (
      apiMessages: ApiMessage[],
      nextMessages: ChatMessage[],
      options: StreamOptions
    ) => {
      abortControllerRef.current?.abort()
      const abortController = new AbortController()
      abortControllerRef.current = abortController

      setError(null)
      updateIsSending(true)
      updateMessages(nextMessages)

      try {
        await streamDeepSeekChat({
          ...options,
          messages: apiMessages,
          signal: abortController.signal,
          onDelta: (delta) => {
            updateMessages((current) => updateStreamingMessage(current, delta))
          },
        })
        updateMessages((current) => finishStreamingMessage(current))
      } catch (cause) {
        if (cause instanceof DOMException && cause.name === 'AbortError') return
        setError(
          cause instanceof Error
            ? cause.message
            : 'Unable to contact DeepSeek. Please try again.'
        )
      } finally {
        if (
          isMountedRef.current &&
          abortControllerRef.current === abortController
        ) {
          abortControllerRef.current = null
          updateIsSending(false)
        }
      }
    },
    [updateIsSending, updateMessages]
  )

  const send = useCallback(async () => {
    const content = draftRef.current.trim()
    const options = getCurrentOptions({
      apiKey: apiKeyRef.current,
      model: modelRef.current,
      thinkingMode: thinkingModeRef.current,
    })

    if (!content) return
    if (!options) {
      setError('Please enter a DeepSeek API key first.')
      return
    }
    if (!deepseekModels.has(options.model)) {
      setError('Only DeepSeek models are connected right now.')
      return
    }

    const nextMessages = [
      ...messagesRef.current,
      { role: 'user' as const, content },
    ]

    updateDraft('')
    await streamAssistantResponse(
      toApiMessages(nextMessages),
      [...nextMessages, createAssistantPlaceholder(options.thinkingMode)],
      options
    )
  }, [streamAssistantResponse, updateDraft])

  const retryMessage = useCallback(
    async (index: number) => {
      const message = messagesRef.current[index]
      const options = getCurrentOptions({
        apiKey: apiKeyRef.current,
        model: modelRef.current,
        thinkingMode: thinkingModeRef.current,
      })

      if (!message || message.role !== 'assistant' || isSendingRef.current) {
        return
      }
      if (!options) {
        setError('Please enter a DeepSeek API key first.')
        return
      }
      if (!deepseekModels.has(options.model)) {
        setError('Only DeepSeek models are connected right now.')
        return
      }

      const previousMessages = messagesRef.current.slice(0, index)
      await streamAssistantResponse(
        toApiMessages(previousMessages),
        [...previousMessages, createAssistantPlaceholder(options.thinkingMode)],
        options
      )
    },
    [streamAssistantResponse]
  )

  const copyMessage = useCallback(async (message: ChatMessage) => {
    if (!message.content) return false

    try {
      await navigator.clipboard.writeText(message.content)
      return true
    } catch {
      setError('Unable to copy this message.')
      return false
    }
  }, [])

  const stopGeneration = useCallback(() => {
    abortControllerRef.current?.abort()
    updateMessages((current) => finishStreamingMessage(current))
    updateIsSending(false)
  }, [updateIsSending, updateMessages])

  const changeReasoningOpen = useCallback(
    (index: number, open: boolean) => {
      updateMessages((current) =>
        current.map((message, messageIndex) =>
          messageIndex === index ? { ...message, reasoningOpen: open } : message
        )
      )
    },
    [updateMessages]
  )

  return {
    apiKey,
    draft,
    error,
    isSending,
    messages,
    model,
    thinkingMode,
    changeReasoningOpen,
    copyMessage,
    retryMessage,
    send,
    stopGeneration,
    updateApiKey,
    updateDraft,
    updateModel,
    updateThinkingMode,
  }
}

function getCurrentOptions({
  apiKey,
  model,
  thinkingMode,
}: StreamOptions): StreamOptions | null {
  const trimmedApiKey = apiKey.trim()
  if (!trimmedApiKey) return null

  return {
    apiKey: trimmedApiKey,
    model,
    thinkingMode,
  }
}
