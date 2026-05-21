import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'

import { storage } from '@/lib/storage'
import {
  AgentSession,
  emptySnapshot,
  getError,
  getOptionsOrError,
  getThreadTitle,
} from '@/services/agent-session'

import type { ChatThreadsController } from './use-chat-threads'

export function useAgent({
  controller,
}: {
  controller: ChatThreadsController
}) {
  const { activeThreadId, activateThread } = controller
  const sessionsRef = useRef(new Map<string, AgentSession>())
  const activeSessionRef = useRef<AgentSession | null>(null)

  const [apiKey, setApiKey] = useState('')
  const [model, setModel] = useState('deepseek-v4-flash')
  const [newDraft, setNewDraft] = useState('')
  const [newError, setNewError] = useState<string | null>(null)
  const [thinkingMode, setThinkingMode] = useState('max')

  const getSession = useCallback((threadId: string) => {
    let session = sessionsRef.current.get(threadId)
    if (!session) {
      session = new AgentSession(threadId)
      sessionsRef.current.set(threadId, session)
    }
    return session
  }, [])

  if (activeThreadId) {
    activeSessionRef.current = getSession(activeThreadId)
  } else {
    activeSessionRef.current = null
  }

  const snapshot = useSyncExternalStore(
    useCallback(
      onStoreChange => {
        const session = activeSessionRef.current
        if (!session) return () => {}
        return session.subscribe(onStoreChange)
      },
      [activeThreadId]
    ),
    useCallback(() => {
      const session = activeSessionRef.current
      return session ? session.loadedSnapshot : emptySnapshot
    }, [activeThreadId])
  )

  useEffect(() => {
    if (activeThreadId) {
      const session = getSession(activeThreadId)
      void session.load()
    }
  }, [activeThreadId, getSession])

  useEffect(() => {
    const sessions = sessionsRef.current
    return () => {
      for (const session of sessions.values()) session.dispose()
    }
  }, [])

  const updateDraft = useCallback((value: string) => {
    const session = activeSessionRef.current
    if (session) {
      session.patch({ draft: value })
      return
    }
    setNewDraft(value)
  }, [])

  const getOptions = useCallback(() => {
    return getOptionsOrError({
      apiKey,
      model,
      thinkingMode,
    })
  }, [apiKey, model, thinkingMode])

  const setActiveError = useCallback((error: string | null) => {
    if (activeSessionRef.current && error) {
      activeSessionRef.current.patch({ error })
    } else {
      setNewError(error)
    }
  }, [])

  const send = useCallback(async () => {
    const session = activeSessionRef.current
    const content = (session?.snapshot.draft ?? newDraft).trim()
    if (!content) return

    const options = getOptions()
    if (typeof options === 'string') {
      setActiveError(options)
      return
    }

    let target = session
    if (!target) {
      try {
        const thread = await storage.chats.saveThread({
          title: getThreadTitle(content),
        })
        target = getSession(thread.id)
        target.hydrate([])
        setNewDraft('')
        setActiveError(null)
        activateThread(thread.id)
      } catch (cause) {
        setActiveError(getError(cause, 'Unable to create this chat.'))
        return
      }
    }

    await target.send(content, options)
  }, [activateThread, getOptions, getSession, newDraft, setActiveError])

  const retryMessage = useCallback(
    async (index: number) => {
      const session = activeSessionRef.current
      const options = getOptions()
      if (!session) return
      if (typeof options === 'string') {
        session.patch({ error: options })
        return
      }

      await session.retry(index, options)
    },
    [getOptions]
  )

  const stopGeneration = useCallback(() => {
    activeSessionRef.current?.stop()
  }, [])

  return {
    apiKey,
    draft: activeSessionRef.current ? snapshot.draft : newDraft,
    error: activeSessionRef.current ? snapshot.error : newError,
    isLoadingThread: snapshot.isLoadingThread,
    isSending: snapshot.isSending,
    messages: snapshot.messages,
    model,
    thinkingMode,
    retryMessage,
    send,
    stopGeneration,
    updateApiKey: setApiKey,
    updateDraft,
    updateModel: setModel,
    updateThinkingMode: setThinkingMode,
  }
}

export type AgentHook = ReturnType<typeof useAgent>
