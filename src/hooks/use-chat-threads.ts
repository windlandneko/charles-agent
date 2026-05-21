import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'

import { storage } from '@/lib/storage'
import type { ChatThread } from '@/lib/storage/schema'

const EMPTY_THREADS: ChatThread[] = []

type ThreadPatch = Partial<Omit<ChatThread, 'id' | 'createdAt'>>

function splitThreads(threads: ChatThread[]) {
  const visibleThreads: ChatThread[] = []
  const archivedThreads: ChatThread[] = []

  for (const thread of threads) {
    if (thread.archived) archivedThreads.push(thread)
    else visibleThreads.push(thread)
  }

  return { archivedThreads, visibleThreads }
}

export function useChatThreads() {
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null)

  const threadsResult = useLiveQuery(() => storage.chats.listThreads())
  const threads = threadsResult ?? EMPTY_THREADS
  const isLoadingThreads = threadsResult === undefined

  const { archivedThreads, visibleThreads } = splitThreads(threads)

  return {
    activeThreadId,
    archivedThreads,
    isLoadingThreads,
    visibleThreads,
    activateThread: (threadId: string) => setActiveThreadId(threadId),
    deleteThread: (thread: ChatThread) => storage.chats.deleteThread(thread.id),
    startNewChat: () => setActiveThreadId(null),
    updateThread: (thread: ChatThread, patch: ThreadPatch) =>
      storage.chats.updateThread(thread.id, patch),
  }
}

export type ChatThreadsController = ReturnType<typeof useChatThreads>
