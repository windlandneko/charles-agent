import {
  type CredentialManager,
  InMemoryCredentialManager,
} from '@/lib/llm/credentials'
import { createDefaultTransportRegistry } from '@/lib/llm/default-transports'
import {
  createCachedModelCatalog,
  type CreateCachedModelCatalogOptions,
} from '@/lib/llm/model-cache'
import { ModelCatalog, ModelCatalogError } from '@/lib/llm/model-catalog'
import {
  createDefaultProviderRegistry,
  type ProviderModelMetadata,
  type ProviderProfile,
  type ProviderProfileRegistry,
} from '@/lib/llm/profile'
import { ModelRouter } from '@/lib/llm/router'
import type {
  FetchLike,
  ResolvedRoute,
  RuntimeContext,
  TransportRegistry,
} from '@/lib/llm/transport'
import type {
  ChatRequest,
  ChatResponse,
  ModelCapability,
  ModelReference,
  StreamEvent,
} from '@/lib/llm/types'
import type { AppStorage } from '@/lib/storage/ports'

export type LLMClientOptions = {
  providers?: ProviderProfile[]
  providerRegistry?: ProviderProfileRegistry
  models?: ProviderModelMetadata[]
  modelCatalog?: ModelCatalog
  credentialManager?: CredentialManager
  transportRegistry?: TransportRegistry
  fetch?: FetchLike
}

export type RequestOptions = {
  apiKey?: string
  apiKeys?: Record<string, string>
  signal?: AbortSignal
  fallbackModels?: ModelReference[]
}

export type LLMClientCreateOptions = LLMClientOptions & {
  storage?: Pick<AppStorage, 'settings'>
  modelCache?: Omit<CreateCachedModelCatalogOptions, 'fetch' | 'storage'>
}

export class LLMClient {
  private readonly router: ModelRouter
  private readonly modelCatalog: ModelCatalog
  private readonly fetch?: FetchLike

  constructor(options: LLMClientOptions = {}) {
    const providerRegistry =
      options.providerRegistry ??
      createDefaultProviderRegistryWith(options.providers ?? [])
    const modelCatalog =
      options.modelCatalog ??
      new ModelCatalog(providerRegistry, options.models ?? [])
    const credentialManager =
      options.credentialManager ?? new InMemoryCredentialManager()
    const transportRegistry =
      options.transportRegistry ?? createDefaultTransportRegistry()

    this.router = new ModelRouter(
      modelCatalog,
      credentialManager,
      transportRegistry
    )
    this.modelCatalog = modelCatalog
    this.fetch = options.fetch
  }

  static async create(options: LLMClientCreateOptions = {}) {
    const { modelCache, storage, ...clientOptions } = options
    if (!storage) return new LLMClient(clientOptions)

    const { modelCatalog, providerRegistry } = await createCachedModelCatalog({
      ...modelCache,
      fetch: clientOptions.fetch,
      storage,
    })

    return new LLMClient({
      ...clientOptions,
      modelCatalog,
      providerRegistry,
    })
  }

  async call(
    request: ChatRequest,
    options: RequestOptions = {}
  ): Promise<ChatResponse> {
    const errors: Error[] = []
    const capabilities = getRequiredCapabilities(request)
    const primaryProviderId = this.modelCatalog.resolve(request.model).profile
      .id

    for (const [index, model] of getModelChain(request, options).entries()) {
      let route: ResolvedRoute | undefined
      try {
        const providerId =
          index === 0
            ? primaryProviderId
            : this.modelCatalog.resolve(model).profile.id
        route = this.router.resolve({
          model,
          capabilities,
          reasoningEffort: request.reasoningEffort,
          apiKey: providerId === primaryProviderId ? options.apiKey : undefined,
          apiKeys: options.apiKeys,
        })
        const runtime = createRuntime(route, options.signal, this.fetch)
        const response = await route.adapter.call(
          { ...request, model },
          runtime
        )

        this.router.reportResult(route, { ok: true })
        return { ...response, route: routeMetadata(route) }
      } catch (cause) {
        const error = toError(cause)

        if (isAbortError(error)) throw error
        if (error instanceof ModelCatalogError) throw error

        errors.push(error)
        if (route) this.router.reportResult(route, { ok: false, error })
      }
    }

    throw new AggregateError(errors, 'All model routes failed.')
  }

  async *stream(
    request: ChatRequest,
    options: RequestOptions = {}
  ): AsyncIterable<StreamEvent> {
    const errors: Error[] = []
    const capabilities = getRequiredCapabilities(request)
    const primaryProviderId = this.modelCatalog.resolve(request.model).profile
      .id

    for (const [index, modelReference] of getModelChain(
      request,
      options
    ).entries()) {
      let didEmit = false
      let route: ResolvedRoute | undefined

      try {
        const providerId =
          index === 0
            ? primaryProviderId
            : this.modelCatalog.resolve(modelReference).profile.id
        route = this.router.resolve({
          model: modelReference,
          capabilities,
          reasoningEffort: request.reasoningEffort,
          apiKey: providerId === primaryProviderId ? options.apiKey : undefined,
          apiKeys: options.apiKeys,
        })
        const runtime = createRuntime(route, options.signal, this.fetch)
        for await (const event of route.adapter.stream(
          {
            ...request,
            model: modelReference,
          },
          runtime
        )) {
          if (event.type === 'error') throw event.error
          didEmit = true
          yield event
        }
        this.router.reportResult(route, { ok: true })
        return
      } catch (cause) {
        const error = toError(cause)
        if (isAbortError(error)) {
          throw error
        }
        if (error instanceof ModelCatalogError) {
          throw error
        }
        errors.push(error)
        if (route) this.router.reportResult(route, { ok: false, error })
        if (didEmit) {
          throw error
        }
      }
    }

    throw new AggregateError(errors, 'All model routes failed.')
  }
}

function getRequiredCapabilities(request: ChatRequest): ModelCapability[] {
  const capabilities = new Set<ModelCapability>(['text'])
  if (
    request.tools?.length ||
    (request.toolChoice && request.toolChoice !== 'none')
  ) {
    capabilities.add('tool-use')
  }
  if (request.reasoningEffort && request.reasoningEffort !== 'off') {
    capabilities.add('reasoning')
  }
  if (request.responseFormat?.type === 'json') {
    capabilities.add('structured-output')
  }
  if (request.messages.some(m => m.content.some(p => p.type === 'image'))) {
    capabilities.add('vision')
  }
  return [...capabilities]
}

function routeMetadata(route: RuntimeContextSource) {
  return {
    providerId: route.profile.id,
    modelId: route.model.id,
    upstreamId: route.model.upstreamId,
    protocol: route.protocol,
  }
}

function createDefaultProviderRegistryWith(providers: ProviderProfile[]) {
  const registry = createDefaultProviderRegistry()
  for (const provider of providers) {
    registry.register(provider)
  }
  return registry
}

function getModelChain(
  request: ChatRequest,
  options: RequestOptions
): ModelReference[] {
  return [request.model, ...(options.fallbackModels ?? [])]
}

function createRuntime(
  route: RuntimeContextSource,
  signal = new AbortController().signal,
  fetchLike?: FetchLike
): RuntimeContext {
  return {
    profile: route.profile,
    model: route.model,
    protocol: route.protocol,
    credential: route.credential,
    signal,
    fetch: fetchLike,
  }
}

type RuntimeContextSource = Pick<
  RuntimeContext,
  'profile' | 'model' | 'protocol' | 'credential'
>

function toError(cause: unknown) {
  return cause instanceof Error ? cause : new Error(String(cause))
}

function isAbortError(error: Error) {
  return error.name === 'AbortError'
}
