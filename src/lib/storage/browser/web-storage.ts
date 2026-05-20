import type { AppStorage } from '@/lib/storage/ports'

import { IndexedDbAttachmentStore } from './attachment-store'
import { IndexedDbChatRepository } from './chat-repository'
import { IndexedDbModelRepository } from './model-repository'
import { LocalStorageSettingsStore } from './settings-store'

export function createStorage(): AppStorage {
  return {
    chats: new IndexedDbChatRepository(),
    models: new IndexedDbModelRepository(),
    settings: new LocalStorageSettingsStore(),
    attachments: new IndexedDbAttachmentStore(),
  }
}

export const storage = createStorage()
