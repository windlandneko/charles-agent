export type ChatRole = 'system' | 'user' | 'assistant' | 'tool'

export type TextContentPart = {
  type: 'text'
  text: string
}

export type ImageContentPart = {
  type: 'image'
  url: string
  mediaType?: string
}

export type ReasoningContentPart = {
  type: 'reasoning'
  text: string
  providerMetadata?: Record<string, unknown>
}

export type ToolCall = {
  id: string
  name: string
  argumentsText: string
  providerMetadata?: Record<string, unknown>
}

export type ToolCallContentPart = {
  type: 'tool-call'
  toolCall: ToolCall
}

export type ToolResultContentPart = {
  type: 'tool-result'
  toolCallId: string
  name?: string
  content: string
  isError?: boolean
}

export type ContentPart =
  | TextContentPart
  | ImageContentPart
  | ReasoningContentPart
  | ToolCallContentPart
  | ToolResultContentPart

export type LLMMessage =
  | {
      role: Exclude<ChatRole, 'tool'>
      content: ContentPart[]
      name?: string
      providerMetadata?: Record<string, unknown>
    }
  | {
      role: 'tool'
      toolCallId: string
      content: ContentPart[]
      name?: string
      providerMetadata?: Record<string, unknown>
    }

export type ToolSpec = {
  name: string
  description?: string
  parameters: Record<string, unknown>
}

export type ReasoningEffort = 'off' | 'low' | 'medium' | 'high' | 'xhigh'

export type ToolChoice = 'auto' | 'none' | 'required' | { name: string }

export type ModelReference =
  | string
  | {
      providerId: string
      modelId: string
    }

export type ResponseFormat =
  | {
      type: 'text'
    }
  | {
      type: 'json'
      schema?: Record<string, unknown>
    }

export type ChatRequest = {
  model: ModelReference
  messages: LLMMessage[]
  tools?: ToolSpec[]
  toolChoice?: ToolChoice
  temperature?: number
  maxTokens?: number
  reasoningEffort?: ReasoningEffort
  responseFormat?: ResponseFormat
}

export type Usage = {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedInputTokens?: number
  cacheCreationInputTokens?: number
  reasoningOutputTokens?: number
  toolUseTokens?: number
}

export type FinishReason =
  | 'stop'
  | 'length'
  | 'tool-calls'
  | 'content-filter'
  | 'error'
  | 'unknown'

export type ChatResponse = {
  content: string
  reasoningContent?: string
  toolCalls?: ToolCall[]
  usage?: Usage
  finishReason?: FinishReason
  route?: {
    providerId: string
    modelId: string
    upstreamId?: string
    protocol: string
  }
  providerMetadata?: Record<string, unknown>
}

export type StreamEvent =
  | {
      type: 'text-delta'
      text: string
    }
  | {
      type: 'reasoning-delta'
      text: string
    }
  | {
      type: 'tool-call-start'
      toolCall: ToolCall
    }
  | {
      type: 'tool-call-delta'
      toolCallId: string
      argumentsText: string
    }
  | {
      type: 'tool-call-done'
      toolCall: ToolCall
    }
  | {
      type: 'usage'
      usage: Usage
    }
  | {
      type: 'finish'
      finishReason?: FinishReason
    }
  | {
      type: 'error'
      error: Error
    }

export type ModelCapability =
  | 'text'
  | 'vision'
  | 'tool-use'
  | 'reasoning'
  | 'prompt-cache'
  | 'structured-output'
  | 'embedding'
  | 'image-generation'
