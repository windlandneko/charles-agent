import Dexie from 'dexie'

import { createStorageId, nowIso } from '@/lib/storage/utils'
import type {
  AppendMessageInput,
  ChatThread,
  SaveChatThreadInput,
  StoredChatThreadRecord,
  StoredMessage,
  StoredMessageContent,
  UpdateMessageInput,
} from '@/lib/storage/schema'

import { db } from './indexed-db'
import type { ChatRepository } from '../ports'

export class IndexedDbChatRepository implements ChatRepository {
  async listThreads() {
    return db.threads.orderBy('[pinnedRank+updatedAt]').reverse().toArray()
  }

  getThread(threadId: string) {
    return db.threads.get(threadId)
  }

  async saveThread(input: SaveChatThreadInput = {}) {
    const timestamp = nowIso()
    const existing = input.id ? await this.getThread(input.id) : undefined
    const thread = toThreadRecord({
      id: input.id ?? createStorageId('thread'),
      title: input.title ?? existing?.title ?? 'Untitled chat',
      createdAt: input.createdAt ?? existing?.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp,
      pinned: input.pinned ?? existing?.pinned ?? false,
      archived: input.archived ?? existing?.archived ?? false,
      metadata: input.metadata ?? existing?.metadata,
    })

    await db.threads.put(thread)
    return thread
  }

  async updateThread(
    threadId: string,
    patch: Partial<Omit<ChatThread, 'id' | 'createdAt'>>
  ) {
    const existing = await this.requireThread(threadId)
    const thread = toThreadRecord({
      ...existing,
      ...patch,
      id: existing.id,
      createdAt: existing.createdAt,
      updatedAt: patch.updatedAt ?? nowIso(),
      pinned: 'pinned' in patch ? patch.pinned : existing.pinned,
      archived: 'archived' in patch ? patch.archived : existing.archived,
    })

    await db.threads.put(thread)
    return thread
  }

  async deleteThread(threadId: string) {
    await db.transaction(
      'rw',
      db.threads,
      db.messages,
      db.attachments,
      async () => {
        const [messageIds, threadAttachmentIds] = await Promise.all([
          db.messages.where('threadId').equals(threadId).primaryKeys(),
          db.attachments.where('threadId').equals(threadId).primaryKeys(),
        ])
        const messageAttachmentIds =
          messageIds.length > 0
            ? await db.attachments
                .where('messageId')
                .anyOf(messageIds)
                .primaryKeys()
            : []

        await Promise.all([
          db.attachments.bulkDelete([
            ...new Set([...threadAttachmentIds, ...messageAttachmentIds]),
          ]),
          db.messages.bulkDelete(messageIds),
          db.threads.delete(threadId),
        ])
      }
    )
  }

  async listMessages(threadId: string) {
    return db.messages
      .where('[threadId+createdAt]')
      .between([threadId, Dexie.minKey], [threadId, Dexie.maxKey], true, true)
      .toArray()
  }

  async appendMessage(input: AppendMessageInput) {
    const timestamp = nowIso()
    const message: StoredMessage = {
      ...input,
      id: input.id ?? createStorageId('message'),
      createdAt: input.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp,
    }

    await db.transaction('rw', db.threads, db.messages, async () => {
      const createdThread = await this.ensureThread(
        message.threadId,
        message.content,
        timestamp,
        message.updatedAt
      )
      await db.messages.put(message)
      if (!createdThread) {
        await this.touchThread(message.threadId, message.updatedAt)
      }
    })

    return message
  }

  async updateMessage(messageId: string, patch: UpdateMessageInput) {
    return db.transaction('rw', db.threads, db.messages, async () => {
      const existing = await this.requireMessage(messageId)
      const message: StoredMessage = {
        ...existing,
        ...patch,
        id: existing.id,
        threadId: existing.threadId,
        createdAt: existing.createdAt,
        updatedAt: patch.updatedAt ?? nowIso(),
      }

      await db.messages.put(message)
      await this.touchThread(message.threadId, message.updatedAt)

      return message
    })
  }

  async deleteMessage(messageId: string) {
    await db.transaction(
      'rw',
      db.threads,
      db.messages,
      db.attachments,
      async () => {
        const message = await this.requireMessage(messageId)

        await db.attachments.where('messageId').equals(messageId).delete()
        await db.messages.delete(messageId)
        await this.touchThread(message.threadId)
      }
    )
  }

  async clear() {
    await db.transaction(
      'rw',
      db.messages,
      db.threads,
      db.attachments,
      async () => {
        const [threadAttachmentIds, messageAttachmentIds] = await Promise.all([
          db.attachments.where('threadId').above('').primaryKeys(),
          db.attachments.where('messageId').above('').primaryKeys(),
        ])
        const attachmentIds = [
          ...new Set([...threadAttachmentIds, ...messageAttachmentIds]),
        ]

        await Promise.all([
          db.attachments.bulkDelete(attachmentIds),
          db.messages.clear(),
          db.threads.clear(),
        ])
      }
    )
  }

  private async ensureThread(
    threadId: string,
    firstContent: StoredMessageContent,
    createdAt: string,
    updatedAt: string
  ) {
    const thread = await this.getThread(threadId)
    if (thread) return false

    await db.threads.put(
      toThreadRecord({
        id: threadId,
        title: getThreadTitle(firstContent),
        createdAt,
        updatedAt,
      })
    )
    return true
  }

  private async requireThread(threadId: string) {
    const thread = await this.getThread(threadId)
    if (!thread) throw new Error(`Chat thread not found: ${threadId}`)
    return thread
  }

  private async requireMessage(messageId: string) {
    const message = await db.messages.get(messageId)
    if (!message) throw new Error(`Chat message not found: ${messageId}`)
    return message
  }

  private async touchThread(threadId: string, updatedAt = nowIso()) {
    const updated = await db.threads.update(threadId, { updatedAt })
    if (updated === 0) throw new Error(`Chat thread not found: ${threadId}`)
  }
}

function getThreadTitle(content: StoredMessageContent) {
  const text =
    typeof content === 'string'
      ? content
      : content.find(part => part.type === 'text')?.text

  return text?.trim().slice(0, 60) || 'Untitled chat'
}

function toThreadRecord(thread: ChatThread): StoredChatThreadRecord {
  const pinned = thread.pinned ?? false

  return {
    ...thread,
    pinned,
    archived: thread.archived ?? false,
    pinnedRank: Number(pinned),
  }
}
