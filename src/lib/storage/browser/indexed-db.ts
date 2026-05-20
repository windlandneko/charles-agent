import Dexie, { type Table } from 'dexie'

import type {
  StoredChatThreadRecord,
  StoredAttachment,
  StoredMessage,
  StoredModelRecord,
} from '@/lib/storage/schema'

export const webStorageDbName = 'charles-agent'

export class AgentDb extends Dexie {
  threads!: Table<StoredChatThreadRecord, string>
  messages!: Table<StoredMessage, string>
  models!: Table<StoredModelRecord, string>
  attachments!: Table<StoredAttachment, string>

  constructor() {
    super(webStorageDbName)

    this.version(1).stores({
      threads: '&id, updatedAt, [pinnedRank+updatedAt]',
      messages:
        '&id, threadId, createdAt, updatedAt, status, [threadId+createdAt]',
      models: '&key, providerId, enabledRank, [providerId+enabledRank]',
      attachments: '&id, threadId, messageId, sha256, storageKey',
    })
  }
}

export const db = new AgentDb()
