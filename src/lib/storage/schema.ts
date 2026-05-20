import type { ChatRole, ContentPart, ModelCapability } from '@/lib/llm/types'

export type JsonPrimitive = string | number | boolean | null

export type JsonValue =
  | JsonPrimitive
  | JsonValue[]
  | {
      [key: string]: JsonValue
    }

export type JsonObject = {
  [key: string]: JsonValue
}

export type StoredMessageContent = string | ContentPart[]

export type ChatThread = {
  id: string
  title: string
  createdAt: string
  updatedAt: string
  pinned?: boolean
  archived?: boolean
  metadata?: JsonObject
}

export type StoredChatThreadRecord = ChatThread & {
  pinnedRank: number
}

export type SaveChatThreadInput = Partial<ChatThread>

export type MessageStatus = 'pending' | 'streaming' | 'done' | 'error'

export type StoredMessage = {
  id: string
  threadId: string
  role: ChatRole
  content: StoredMessageContent
  createdAt: string
  updatedAt: string
  modelId?: string
  providerId?: string
  parentId?: string
  reasoningContent?: string
  status?: MessageStatus
  metadata?: JsonObject
}

export type AppendMessageInput = Omit<
  StoredMessage,
  'id' | 'createdAt' | 'updatedAt'
> &
  Partial<Pick<StoredMessage, 'id' | 'createdAt' | 'updatedAt'>>

export type UpdateMessageInput = Partial<
  Omit<StoredMessage, 'id' | 'threadId' | 'createdAt'>
>

export type StoredModel = {
  key: string
  id: string
  providerId: string
  name: string
  createdAt: string
  updatedAt: string
  enabled?: boolean
  capabilities?: ModelCapability[]
  contextWindow?: number
  metadata?: JsonObject
}

export type StoredModelRecord = StoredModel & {
  enabledRank: number
}

export type UpsertModelInput = Omit<
  StoredModel,
  'key' | 'createdAt' | 'updatedAt'
> &
  Partial<Pick<StoredModel, 'createdAt' | 'updatedAt'>>

export type StoredAttachmentMetadata = {
  id: string
  name: string
  mimeType: string
  size: number
  storageKey: string
  createdAt: string
  updatedAt: string
  threadId?: string
  messageId?: string
  sha256?: string
  metadata?: JsonObject
}

export type StoredAttachment = StoredAttachmentMetadata & {
  blob: Blob
}

export type PutAttachmentOptions = {
  id?: string
  name?: string
  mimeType?: string
  threadId?: string
  messageId?: string
  sha256?: string
  metadata?: JsonObject
}
