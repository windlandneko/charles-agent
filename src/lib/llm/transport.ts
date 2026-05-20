import type { Credential } from '@/lib/llm/credentials'
import type { ResolvedModel } from '@/lib/llm/model-catalog'
import type {
  Protocol,
  ProviderModelMetadata,
  ProviderProfile,
} from '@/lib/llm/profile'
import type { ChatRequest, ChatResponse, StreamEvent } from '@/lib/llm/types'

export type FetchLike = typeof fetch

export type RuntimeContext = {
  profile: ProviderProfile
  model: ProviderModelMetadata
  protocol: Protocol
  credential: Credential
  signal: AbortSignal
  fetch?: FetchLike
}

export type TransportAdapter = {
  protocol: Protocol
  call(request: ChatRequest, runtime: RuntimeContext): Promise<ChatResponse>
  stream(
    request: ChatRequest,
    runtime: RuntimeContext
  ): AsyncIterable<StreamEvent>
}

export type ResolvedRoute = ResolvedModel & {
  credential: Credential
  adapter: TransportAdapter
}

export type RouteResult = {
  ok: boolean
  error?: Error
}

export class TransportRegistry {
  private readonly adapters = new Map<Protocol, TransportAdapter>()

  constructor(adapters: readonly TransportAdapter[] = []) {
    for (const adapter of adapters) {
      this.register(adapter)
    }
  }

  register(adapter: TransportAdapter, { override = false } = {}) {
    if (!override && this.adapters.has(adapter.protocol)) {
      throw new Error(
        `Transport adapter already registered for ${adapter.protocol}`
      )
    }
    this.adapters.set(adapter.protocol, adapter)
  }

  get(protocol: Protocol) {
    return this.adapters.get(protocol)
  }

  require(protocol: Protocol) {
    const adapter = this.get(protocol)
    if (!adapter) {
      throw new Error(`No transport adapter registered for ${protocol}`)
    }
    return adapter
  }
}
