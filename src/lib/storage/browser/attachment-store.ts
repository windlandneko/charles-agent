import { createStorageId, nowIso } from '@/lib/storage/utils'
import type { AttachmentStore } from '@/lib/storage/ports'
import type {
  PutAttachmentOptions,
  StoredAttachment,
} from '@/lib/storage/schema'

import { db } from './indexed-db'

export class IndexedDbAttachmentStore implements AttachmentStore {
  async put(blob: Blob, options: PutAttachmentOptions = {}) {
    const timestamp = nowIso()
    const id = options.id ?? createStorageId('attachment')
    const attachment: StoredAttachment = {
      id,
      blob,
      name: options.name ?? getBlobName(blob),
      mimeType: (options.mimeType ?? blob.type) || 'application/octet-stream',
      size: blob.size,
      storageKey: id,
      createdAt: timestamp,
      updatedAt: timestamp,
      threadId: options.threadId,
      messageId: options.messageId,
      sha256: options.sha256,
      metadata: options.metadata,
    }

    await db.attachments.put(attachment)
    return toMetadata(attachment)
  }

  async get(id: string) {
    const attachment = await db.attachments.get(id)

    return attachment ? toMetadata(attachment) : undefined
  }

  async getBlob(id: string) {
    const attachment = await db.attachments.get(id)

    return attachment?.blob
  }

  async listByThread(threadId: string) {
    const attachments = await db.attachments
      .where('threadId')
      .equals(threadId)
      .toArray()

    return attachments.map(toMetadata)
  }

  async listByMessage(messageId: string) {
    const attachments = await db.attachments
      .where('messageId')
      .equals(messageId)
      .toArray()

    return attachments.map(toMetadata)
  }

  remove(id: string) {
    return db.attachments.delete(id)
  }

  clear() {
    return db.attachments.clear()
  }
}

function getBlobName(blob: Blob) {
  if (typeof File !== 'undefined' && blob instanceof File) return blob.name
  return 'attachment'
}

function toMetadata({ blob: _, ...metadata }: StoredAttachment) {
  return metadata
}
