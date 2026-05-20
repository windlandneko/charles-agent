import { useCallback, useEffect, useMemo, useState } from 'react'

import { storage } from '@/lib/storage'
import type { ChatThread } from '@/lib/storage/schema'

export function useChatThreads() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)
  const [threads, setThreads] = useState<ChatThread[]>([])
  const [isLoadingThreads, setIsLoadingThreads] = useState(true)

  const visibleThreads = useMemo(
    () => threads.filter(thread => !thread.archived),
    [threads]
  )
  const pinnedThreads = useMemo(
    () => visibleThreads.filter(thread => thread.pinned),
    [visibleThreads]
  )
  const recentThreads = useMemo(
    () => visibleThreads.filter(thread => !thread.pinned),
    [visibleThreads]
  )
  const archivedThreads = useMemo(
    () => threads.filter(thread => thread.archived),
    [threads]
  )

  const refreshThreads = useCallback(async () => {
    setIsLoadingThreads(true)
    try {
      setThreads(await storage.chats.listThreads())
    } finally {
      setIsLoadingThreads(false)
    }
  }, [])

  useEffect(() => {
    void refreshThreads()
  }, [refreshThreads])

  const startNewChat = useCallback(() => {
    setActiveThreadId(null)
  }, [])

  const selectThread = useCallback((threadId: string) => {
    setActiveThreadId(threadId)
  }, [])

  const activateThread = useCallback(
    (threadId: string) => {
      setActiveThreadId(threadId)
      void refreshThreads()
    },
    [refreshThreads]
  )

  const updateThread = useCallback(
    async (
      thread: ChatThread,
      patch: Partial<Omit<ChatThread, 'id' | 'createdAt'>>
    ) => {
      await storage.chats.updateThread(thread.id, patch)
      await refreshThreads()
    },
    [refreshThreads]
  )

  const renameThread = useCallback(
    async (thread: ChatThread, title: string) => {
      await updateThread(thread, { title })
    },
    [updateThread]
  )

  const togglePin = useCallback(
    async (thread: ChatThread) => {
      await updateThread(thread, { pinned: !thread.pinned })
    },
    [updateThread]
  )

  const toggleArchive = useCallback(
    async (thread: ChatThread) => {
      const archived = !thread.archived
      await updateThread(thread, { archived })
      if (archived && thread.id === activeThreadId) {
        setActiveThreadId(null)
      }
    },
    [activeThreadId, updateThread]
  )

  const deleteThread = useCallback(
    async (thread: ChatThread) => {
      await storage.chats.deleteThread(thread.id)
      if (thread.id === activeThreadId) {
        setActiveThreadId(null)
      }
      await refreshThreads()
    },
    [activeThreadId, refreshThreads]
  )

  return {
    activeThreadId,
    archivedThreads,
    isLoadingThreads,
    pinnedThreads,
    recentThreads,
    activateThread,
    deleteThread,
    refreshThreads,
    renameThread,
    selectThread,
    startNewChat,
    toggleArchive,
    togglePin,
  }
}

export type ChatThreadsController = ReturnType<typeof useChatThreads>
