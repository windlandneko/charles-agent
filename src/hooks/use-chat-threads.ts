import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useMemo, useState } from 'react'

import { storage } from '@/lib/storage'
import type { ChatThread } from '@/lib/storage/schema'

export function useChatThreads() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const threadsResult = useLiveQuery(() => storage.chats.listThreads())
  const threads = threadsResult ?? []
  const isLoadingThreads = threadsResult === undefined

  const visibleThreads = useMemo(
    () => threads.filter(thread => !thread.archived),
    [threads]
  )
  const archivedThreads = useMemo(
    () => threads.filter(thread => thread.archived),
    [threads]
  )

  useEffect(() => {
    if (activeThreadId) {
      const activeThread = threads.find(t => t.id === activeThreadId)
      if (!activeThread || activeThread.archived) {
        setActiveThreadId(null)
      }
    }
  }, [threads, activeThreadId])

  return {
    activeThreadId,
    archivedThreads,
    isLoadingThreads,
    visibleThreads,
    activateThread: (threadId: string) => setActiveThreadId(threadId),
    deleteThread: (thread: ChatThread) => storage.chats.deleteThread(thread.id),
    startNewChat: () => setActiveThreadId(null),
    updateThread: (
      thread: ChatThread,
      patch: Partial<Omit<ChatThread, 'id' | 'createdAt'>>
    ) => storage.chats.updateThread(thread.id, patch),
  }
}

export type ChatThreadsController = ReturnType<typeof useChatThreads>
