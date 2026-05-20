import {
  getModelReasoningField,
  getProviderBaseUrl,
  type MaxTokensParameter,
  type ReasoningField,
} from '@/lib/llm/profile'
import {
  createHeaders,
  createProviderError,
  getFetch,
  joinUrl,
  readServerSentEvents,
} from '@/lib/llm/transports/http'
import type { RuntimeContext, TransportAdapter } from '@/lib/llm/transport'
import type {
  ChatRequest,
  ContentPart,
  FinishReason,
  LLMMessage,
  ReasoningEffort,
  StreamEvent,
  ToolCall,
  ToolChoice,
  ToolSpec,
} from '@/lib/llm/types'

type OpenAiMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content?: string | OpenAiContentPart[] | null
  tool_call_id?: string
  tool_calls?: OpenAiToolCall[]
  reasoning_content?: string
}

type OpenAiContentPart = Record<string, unknown>

type OpenAiToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

type OpenAiUsage = {
  prompt_tokens?: number
  completion_tokens?: number
  total_tokens?: number
  prompt_tokens_details?: {
    cached_tokens?: number
  }
  completion_tokens_details?: {
    reasoning_tokens?: number
  }
}

type OpenAiResponse = {
  choices?: Array<{
    finish_reason?: string | null
    message?: {
      content?: string | null
      reasoning_content?: string | null
      reasoning_details?: unknown
      tool_calls?: OpenAiToolCall[]
    }
  }>
  usage?: OpenAiUsage
}

type OpenAiStreamChunk = {
  choices?: Array<{
    finish_reason?: string | null
    delta?: {
      content?: string | null
      reasoning_content?: string | null
      reasoning_details?: unknown
      tool_calls?: Array<{
        index: number
        id?: string
        type?: 'function'
        function?: {
          name?: string
          arguments?: string
        }
      }>
    }
  }>
  usage?: OpenAiUsage
}

type VisibleContentPart = Extract<
  ContentPart,
  { type: 'text' | 'image' | 'tool-result' }
>

type OpenAiStreamToolCallDelta = NonNullable<
  NonNullable<
    NonNullable<OpenAiStreamChunk['choices']>[number]['delta']
  >['tool_calls']
>[number]

type ToolCallState = {
  id?: string
  name?: string
  argumentsText: string
  started: boolean
}

type ReasoningOptions = Record<string, unknown>

export const openAiChatAdapter: TransportAdapter = {
  protocol: 'openai-chat',
  async call(request, runtime) {
    const response = await sendOpenAiRequest({
      request,
      runtime,
      stream: false,
    })
    const data = (await response.json()) as OpenAiResponse
    const choice = data.choices?.[0]
    const message = choice?.message

    return {
      content: message?.content ?? '',
      reasoningContent: message?.reasoning_content ?? undefined,
      toolCalls: message?.tool_calls?.map(fromOpenAiToolCall),
      usage: fromOpenAiUsage(data.usage),
      finishReason: fromOpenAiFinishReason(choice?.finish_reason),
    }
  },
  async *stream(request, runtime) {
    const response = await sendOpenAiRequest({
      request,
      runtime,
      stream: true,
    })

    if (!response.body) {
      throw new Error('Provider returned no response stream.')
    }

    const toolCallAccumulator = new Map<number, ToolCallState>()
    let finishReason: FinishReason | undefined

    for await (const payload of readServerSentEvents(response.body)) {
      if (payload === '[DONE]') break

      const chunk = JSON.parse(payload) as OpenAiStreamChunk

      if (chunk.usage) {
        const usage = fromOpenAiUsage(chunk.usage)
        if (usage) yield { type: 'usage', usage }
      }

      for (const choice of chunk.choices ?? []) {
        const delta = choice.delta

        const reasoningDelta = delta
          ? getReasoningDelta(delta, runtime)
          : undefined
        if (reasoningDelta) {
          yield {
            type: 'reasoning-delta',
            text: reasoningDelta,
          }
        }

        if (delta?.content) {
          yield {
            type: 'text-delta',
            text: delta.content,
          }
        }

        for (const toolCall of delta?.tool_calls ?? []) {
          yield* updateToolCallAccumulator(toolCallAccumulator, toolCall)
        }

        if (choice.finish_reason) {
          finishReason = fromOpenAiFinishReason(choice.finish_reason)
        }
      }
    }

    yield* finishToolCallAccumulator(toolCallAccumulator)
    if (finishReason) yield { type: 'finish', finishReason }
  },
}

async function sendOpenAiRequest({
  request,
  runtime,
  stream,
}: {
  request: ChatRequest
  runtime: RuntimeContext
  stream: boolean
}) {
  const fetchLike = getFetch(runtime.fetch)
  const response = await fetchLike(
    joinUrl(getProviderBaseUrl(runtime.profile), getRequestPath(runtime)),
    {
      method: 'POST',
      signal: runtime.signal,
      headers: createHeaders({
        credential: runtime.credential,
        profile: runtime.profile,
        extraHeaders: runtime.credential.value
          ? {
              ...runtime.model.provider?.headers,
              ...runtime.profile.behavior?.request?.headers,
              Authorization: `Bearer ${runtime.credential.value}`,
            }
          : {
              ...runtime.model.provider?.headers,
              ...runtime.profile.behavior?.request?.headers,
            },
      }),
      body: JSON.stringify(createOpenAiRequestBody(request, runtime, stream)),
    }
  )

  if (!response.ok) {
    throw await createProviderError(response)
  }

  return response
}

function createOpenAiRequestBody(
  request: ChatRequest,
  runtime: RuntimeContext,
  stream: boolean
) {
  const tools = request.tools?.map(toOpenAiTool)

  return {
    model: runtime.model.upstreamId ?? runtime.model.id,
    messages: request.messages.map(message =>
      toOpenAiMessage(message, runtime)
    ),
    stream,
    ...getStreamOptions(stream, runtime),
    ...(tools?.length ? { tools } : {}),
    ...withOptionalValue('tool_choice', toOpenAiToolChoice(request.toolChoice)),
    ...withOptionalValue('temperature', getTemperature(request, runtime)),
    ...withOptionalValue(getMaxTokensKey(runtime), request.maxTokens),
    ...withOptionalValue('response_format', toOpenAiResponseFormat(request)),
    ...getReasoningOptions(request.reasoningEffort, runtime),
    ...runtime.model.provider?.body,
    ...runtime.profile.behavior?.request?.body,
  }
}

function toOpenAiMessage(
  message: LLMMessage,
  runtime: RuntimeContext
): OpenAiMessage {
  if (message.role === 'tool') {
    return {
      role: 'tool',
      tool_call_id: message.toolCallId,
      content: stringifyContent(message.content),
    }
  }

  const toolCalls =
    message.role === 'assistant'
      ? message.content
          .filter(part => part.type === 'tool-call')
          .map(part => toOpenAiToolCall(part.toolCall))
      : []
  const content = toOpenAiContent(
    message.content,
    message.role === 'assistant' && toolCalls.length > 0
  )

  return {
    role: message.role,
    ...withOptionalValue('content', content),
    ...withOptionalValue(
      'reasoning_content',
      getReasoningContent(message, runtime)
    ),
    ...(toolCalls.length > 0 ? { tool_calls: toolCalls } : {}),
  }
}

function toOpenAiContent(
  content: ContentPart[],
  omitEmpty = false
): OpenAiMessage['content'] | undefined {
  const visibleContent = content.filter(isVisibleContentPart)

  if (omitEmpty && visibleContent.length === 0) return undefined

  if (visibleContent.every(part => part.type === 'text')) {
    return stringifyContent(visibleContent)
  }

  return visibleContent.map(toOpenAiContentPart)
}

function toOpenAiContentPart(part: VisibleContentPart): OpenAiContentPart {
  if (part.type === 'text') {
    return {
      type: 'text',
      text: part.text,
    }
  }

  if (part.type === 'image') {
    return {
      type: 'image_url',
      image_url: {
        url: part.url,
      },
    }
  }

  return {
    type: 'text',
    text: part.content,
  }
}

function isVisibleContentPart(part: ContentPart): part is VisibleContentPart {
  return part.type !== 'tool-call' && part.type !== 'reasoning'
}

function stringifyContent(content: ContentPart[]) {
  return content
    .map(part => {
      if (part.type === 'text' || part.type === 'reasoning') return part.text
      if (part.type === 'tool-result') return part.content
      return ''
    })
    .join('')
}

function toOpenAiTool(tool: ToolSpec) {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    },
  }
}

function toOpenAiToolChoice(toolChoice?: ToolChoice) {
  if (!toolChoice) return undefined
  if (typeof toolChoice === 'string') return toolChoice

  return {
    type: 'function',
    function: {
      name: toolChoice.name,
    },
  }
}

function toOpenAiToolCall(toolCall: ToolCall): OpenAiToolCall {
  return {
    id: toolCall.id,
    type: 'function',
    function: {
      name: toolCall.name,
      arguments: toolCall.argumentsText,
    },
  }
}

function fromOpenAiToolCall(toolCall: OpenAiToolCall): ToolCall {
  return {
    id: toolCall.id,
    name: toolCall.function.name,
    argumentsText: toolCall.function.arguments,
  }
}

function toOpenAiResponseFormat(request: ChatRequest) {
  if (!request.responseFormat || request.responseFormat.type === 'text') {
    return undefined
  }

  if (!request.responseFormat.schema) {
    return {
      type: 'json_object',
    }
  }

  return {
    type: 'json_schema',
    json_schema: {
      name: 'response',
      schema: request.responseFormat.schema,
    },
  }
}

function getTemperature(request: ChatRequest, runtime: RuntimeContext) {
  const behavior = runtime.profile.behavior?.parameters?.temperature
  if (behavior === 'omit') return undefined
  if (behavior !== 'always' && runtime.model.temperature === false) {
    return undefined
  }
  return request.temperature
}

function getReasoningOptions(
  reasoningEffort: ReasoningEffort | undefined,
  runtime: RuntimeContext
): ReasoningOptions {
  const reasoning = runtime.profile.behavior?.reasoning
  if (!reasoning || !reasoningEffort) return {}

  if (reasoningEffort === 'off') {
    return reasoning.thinking?.disabled ?? {}
  }

  const options: ReasoningOptions = {
    ...reasoning.thinking?.enabled,
  }

  if (reasoning.effort) {
    const effort = reasoning.effort.map[reasoningEffort]
    if (!effort) {
      throw new Error(
        `Provider ${runtime.profile.id} does not support reasoning effort: ${reasoningEffort}`
      )
    }
    options[reasoning.effort.field] = effort
  }

  return options
}

function getMaxTokensKey(runtime: RuntimeContext): MaxTokensParameter {
  return (
    runtime.model.maxTokensParameter ??
    runtime.profile.behavior?.parameters?.maxTokensKey ??
    'max_tokens'
  )
}

function getReasoningContent(message: LLMMessage, runtime: RuntimeContext) {
  if (!shouldReplayReasoningContent(runtime)) return undefined
  if (message.role !== 'assistant') return undefined
  const text = message.content
    .filter(part => part.type === 'reasoning')
    .map(part => part.text)
    .join('')
  return text || undefined
}

function getRequestPath(runtime: RuntimeContext) {
  return runtime.profile.behavior?.request?.path ?? 'chat/completions'
}

function getStreamOptions(stream: boolean, runtime: RuntimeContext) {
  if (!stream) return {}

  const streamOptions = runtime.profile.behavior?.request?.streamOptions
  if (streamOptions === false) return {}

  return {
    stream_options: streamOptions ?? { include_usage: true },
  }
}

function getReasoningDelta(
  delta: NonNullable<
    NonNullable<OpenAiStreamChunk['choices']>[number]['delta']
  >,
  runtime: RuntimeContext
) {
  const field = getRuntimeReasoningField(runtime)
  const value =
    field === 'reasoning_details'
      ? delta.reasoning_details
      : delta.reasoning_content

  if (typeof value === 'string') return value
  if (value === undefined || value === null) return undefined
  return JSON.stringify(value)
}

function getRuntimeReasoningField(runtime: RuntimeContext): ReasoningField {
  return (
    runtime.profile.behavior?.reasoning?.interleaved?.field ??
    getModelReasoningField(runtime.model) ??
    'reasoning_content'
  )
}

function shouldReplayReasoningContent(runtime: RuntimeContext) {
  return Boolean(
    runtime.profile.behavior?.reasoning?.interleaved?.replay &&
    getRuntimeReasoningField(runtime) === 'reasoning_content'
  )
}

function fromOpenAiUsage(usage?: OpenAiUsage) {
  if (!usage) return undefined

  return {
    inputTokens: usage.prompt_tokens,
    outputTokens: usage.completion_tokens,
    totalTokens: usage.total_tokens,
    cachedInputTokens: usage.prompt_tokens_details?.cached_tokens,
    reasoningOutputTokens: usage.completion_tokens_details?.reasoning_tokens,
  }
}

function fromOpenAiFinishReason(
  finishReason: string | null | undefined
): FinishReason {
  if (finishReason === 'stop') return 'stop'
  if (finishReason === 'length') return 'length'
  if (finishReason === 'tool_calls') return 'tool-calls'
  if (finishReason === 'function_call') return 'tool-calls'
  if (finishReason === 'content_filter') return 'content-filter'
  return 'unknown'
}

function* updateToolCallAccumulator(
  accumulator: Map<number, ToolCallState>,
  delta: OpenAiStreamToolCallDelta
): Generator<StreamEvent> {
  const state =
    accumulator.get(delta.index) ??
    ({
      argumentsText: '',
      started: false,
    } satisfies ToolCallState)
  const argumentsDelta = delta.function?.arguments

  if (delta.id) state.id = delta.id
  if (delta.function?.name) state.name = delta.function.name
  if (argumentsDelta) state.argumentsText += argumentsDelta

  accumulator.set(delta.index, state)

  if (!state.started && state.id && state.name) {
    state.started = true
    yield {
      type: 'tool-call-start',
      toolCall: toToolCall(state),
    }
    return
  }

  if (state.started && state.id && argumentsDelta) {
    yield {
      type: 'tool-call-delta',
      toolCallId: state.id,
      argumentsText: argumentsDelta,
    }
  }
}

function* finishToolCallAccumulator(
  accumulator: Map<number, ToolCallState>
): Generator<StreamEvent> {
  for (const [index, state] of accumulator) {
    if (!state.started) {
      throw new Error(`Incomplete streamed tool call at index ${index}.`)
    }
    yield {
      type: 'tool-call-done',
      toolCall: toToolCall(state),
    }
  }
}

function toToolCall(state: ToolCallState): ToolCall {
  if (!state.id || !state.name) {
    throw new Error('Cannot create a tool call without id and name.')
  }

  return {
    id: state.id,
    name: state.name,
    argumentsText: state.argumentsText,
  }
}

function withOptionalValue<T>(key: string, value: T | undefined) {
  return value === undefined ? {} : { [key]: value }
}
