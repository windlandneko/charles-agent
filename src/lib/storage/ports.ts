import type {
  AppendMessageInput,
  ChatThread,
  JsonValue,
  PutAttachmentOptions,
  SaveChatThreadInput,
  StoredAttachmentMetadata,
  StoredMessage,
  StoredModel,
  UpdateMessageInput,
  UpsertModelInput,
} from '@/lib/storage/schema'

export type ModelListFilter = {
  providerId?: string
  enabled?: boolean
}

export interface ChatRepository {
  listThreads(): Promise<ChatThread[]>
  getThread(threadId: string): Promise<ChatThread | undefined>
  saveThread(input?: SaveChatThreadInput): Promise<ChatThread>
  updateThread(
    threadId: string,
    patch: Partial<Omit<ChatThread, 'id' | 'createdAt'>>
  ): Promise<ChatThread>
  deleteThread(threadId: string): Promise<void>
  listMessages(threadId: string): Promise<StoredMessage[]>
  appendMessage(input: AppendMessageInput): Promise<StoredMessage>
  updateMessage(
    messageId: string,
    patch: UpdateMessageInput
  ): Promise<StoredMessage>
  deleteMessage(messageId: string): Promise<void>
  clear(): Promise<void>
}

export interface ModelRepository {
  list(filter?: ModelListFilter): Promise<StoredModel[]>
  get(providerId: string, modelId: string): Promise<StoredModel | undefined>
  upsert(input: UpsertModelInput): Promise<StoredModel>
  remove(providerId: string, modelId: string): Promise<void>
  clear(): Promise<void>
}

export interface SettingsStore {
  get<T extends JsonValue = JsonValue>(key: string): Promise<T | undefined>
  set<T extends JsonValue>(key: string, value: T): Promise<void>
  remove(key: string): Promise<void>
  all(): Promise<Record<string, JsonValue>>
  clear(): Promise<void>
}

export interface AttachmentStore {
  put(
    blob: Blob,
    options?: PutAttachmentOptions
  ): Promise<StoredAttachmentMetadata>
  get(id: string): Promise<StoredAttachmentMetadata | undefined>
  getBlob(id: string): Promise<Blob | undefined>
  listByThread(threadId: string): Promise<StoredAttachmentMetadata[]>
  listByMessage(messageId: string): Promise<StoredAttachmentMetadata[]>
  remove(id: string): Promise<void>
  clear(): Promise<void>
}

export type AppStorage = {
  chats: ChatRepository
  models: ModelRepository
  settings: SettingsStore
  attachments: AttachmentStore
}
