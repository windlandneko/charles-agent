import type {
  JsonValue,
  ModelsDevCatalog,
  ModelsDevModel,
  ModelsDevProvider,
} from '@/lib/llm/models-dev'
import type { ReasoningEffort } from '@/lib/llm/types'

export type Protocol = 'openai-chat' | (string & {})

export type AuthType = 'api-key' | 'none'

export type MaxTokensParameter = 'max_tokens' | 'max_completion_tokens'

export type ReasoningField = 'reasoning_content' | 'reasoning_details'

export type ProviderBehavior = {
  request?: {
    path?: string
    body?: Record<string, JsonValue>
    headers?: Record<string, string>
    streamOptions?: false | Record<string, JsonValue>
  }
  parameters?: {
    maxTokensKey?: MaxTokensParameter
    temperature?: 'auto' | 'omit' | 'always'
  }
  reasoning?: {
    effort?: {
      field: 'reasoning_effort'
      map: Partial<Record<ReasoningEffort, string>>
    }
    thinking?: {
      enabled: Record<string, JsonValue>
      disabled?: Record<string, JsonValue>
    }
    interleaved?: {
      field: ReasoningField
      replay?: boolean
    }
  }
}

type ProviderModelRuntimeOptions = {
  upstreamId?: string
  supportedProtocols?: Protocol[]
  defaultProtocol?: Protocol
  maxTokensParameter?: MaxTokensParameter
}

export type ProviderModelDefinition = ModelsDevModel &
  ProviderModelRuntimeOptions & {
    providerId?: string
  }

export type ProviderModelMetadata = ProviderModelDefinition & {
  providerId: string
}

export type ProviderProfile = Omit<ModelsDevProvider, 'models'> & {
  aliases?: string[]
  authType: AuthType
  baseUrl?: string
  protocols: Protocol[]
  defaultProtocol: Protocol
  headers?: Record<string, string>
  behavior?: ProviderBehavior
  models: Record<string, ProviderModelDefinition>
}

export type ProviderProfileOverlay = Partial<
  Omit<ProviderProfile, 'models'>
> & {
  models?: Record<string, ProviderModelDefinition>
}

export class ProviderProfileRegistry {
  private readonly profiles = new Map<string, ProviderProfile>()
  private readonly aliases = new Map<string, string>()

  constructor(profiles: ProviderProfile[] = []) {
    for (const profile of profiles) {
      this.register(profile)
    }
  }

  register(profile: ProviderProfile) {
    const normalizedId = normalizeProviderId(profile.id)
    const previous = this.profiles.get(normalizedId)
    for (const alias of previous?.aliases ?? []) {
      this.aliases.delete(normalizeProviderId(alias))
    }
    this.aliases.delete(normalizedId)
    this.profiles.set(normalizedId, profile)

    for (const alias of profile.aliases ?? []) {
      const normalizedAlias = normalizeProviderId(alias)
      if (normalizedAlias === normalizedId) continue
      if (this.profiles.has(normalizedAlias)) {
        throw new Error(`Provider alias conflicts with id: ${alias}`)
      }
      const existingAliasOwner = this.aliases.get(normalizedAlias)
      if (existingAliasOwner && existingAliasOwner !== normalizedId) {
        throw new Error(`Provider alias already registered: ${alias}`)
      }
      this.aliases.set(normalizedAlias, normalizedId)
    }
  }

  get(providerId: string) {
    const normalizedId = normalizeProviderId(providerId)
    if (this.profiles.has(normalizedId)) {
      return this.profiles.get(normalizedId)
    }
    const canonicalId = this.aliases.get(normalizedId) ?? normalizedId
    return this.profiles.get(canonicalId)
  }

  canonicalId(providerId: string) {
    const normalizedId = normalizeProviderId(providerId)
    if (this.profiles.has(normalizedId)) return normalizedId
    return this.aliases.get(normalizedId)
  }

  list() {
    return Array.from(this.profiles.values())
  }

  require(providerId: string) {
    const profile = this.get(providerId)
    if (!profile) {
      throw new Error(`Unknown provider: ${providerId}`)
    }
    return profile
  }
}

export const defaultProviderOverlays: Record<string, ProviderProfileOverlay> = {
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    behavior: {
      parameters: {
        maxTokensKey: 'max_completion_tokens',
      },
      reasoning: {
        effort: {
          field: 'reasoning_effort',
          map: {
            low: 'low',
            medium: 'medium',
            high: 'high',
          },
        },
      },
    },
  },
  deepseek: {
    baseUrl: 'https://api.deepseek.com/v1',
    behavior: {
      reasoning: {
        effort: {
          field: 'reasoning_effort',
          map: {
            low: 'low',
            medium: 'medium',
            high: 'high',
            xhigh: 'max',
          },
        },
        thinking: {
          enabled: {
            thinking: {
              type: 'enabled',
            },
          },
          disabled: {
            thinking: {
              type: 'disabled',
            },
          },
        },
        interleaved: {
          field: 'reasoning_content',
          replay: true,
        },
      },
    },
  },
  lmstudio: {
    aliases: ['lm-studio'],
    authType: 'none',
  },
}

export const defaultProviderProfiles: ProviderProfile[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    npm: '@ai-sdk/openai',
    env: ['OPENAI_API_KEY'],
    doc: 'https://platform.openai.com/docs/models',
    authType: 'api-key',
    protocols: ['openai-chat'],
    defaultProtocol: 'openai-chat',
    models: {},
    ...defaultProviderOverlays.openai,
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    npm: '@ai-sdk/openai-compatible',
    env: ['DEEPSEEK_API_KEY'],
    api: 'https://api.deepseek.com',
    doc: 'https://api-docs.deepseek.com/quick_start/pricing',
    authType: 'api-key',
    protocols: ['openai-chat'],
    defaultProtocol: 'openai-chat',
    models: {},
    ...defaultProviderOverlays.deepseek,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    npm: '@openrouter/ai-sdk-provider',
    env: ['OPENROUTER_API_KEY'],
    api: 'https://openrouter.ai/api/v1',
    doc: 'https://openrouter.ai/models',
    authType: 'api-key',
    protocols: ['openai-chat'],
    defaultProtocol: 'openai-chat',
    models: {},
  },
  {
    id: 'ollama',
    name: 'Ollama',
    npm: '@ai-sdk/openai-compatible',
    env: ['OLLAMA_API_KEY'],
    api: 'http://localhost:11434/v1',
    doc: 'https://ollama.com/library',
    authType: 'none',
    protocols: ['openai-chat'],
    defaultProtocol: 'openai-chat',
    models: {},
  },
  {
    id: 'lmstudio',
    name: 'LMStudio',
    npm: '@ai-sdk/openai-compatible',
    env: ['LMSTUDIO_API_KEY'],
    api: 'http://127.0.0.1:1234/v1',
    doc: 'https://lmstudio.ai/models',
    authType: 'none',
    protocols: ['openai-chat'],
    defaultProtocol: 'openai-chat',
    models: {},
    ...defaultProviderOverlays.lmstudio,
  },
]

export function createDefaultProviderRegistry() {
  return new ProviderProfileRegistry(defaultProviderProfiles)
}

export function createProviderProfilesFromModelsDev(
  catalog: ModelsDevCatalog,
  overlays: Record<string, ProviderProfileOverlay> = defaultProviderOverlays
) {
  return Object.entries(catalog)
    .filter(([, provider]) => isOpenAiChatProvider(provider))
    .map(([providerId, provider]) => {
      const overlay = overlays[providerId] ?? {}
      return {
        ...provider,
        authType: 'api-key',
        protocols: ['openai-chat'],
        defaultProtocol: 'openai-chat',
        ...overlay,
        id: provider.id || providerId,
        models: {
          ...provider.models,
          ...overlay.models,
        },
      } satisfies ProviderProfile
    })
}

export function createProviderRegistryFromModelsDev(
  catalog: ModelsDevCatalog,
  overlays?: Record<string, ProviderProfileOverlay>
) {
  const registry = new ProviderProfileRegistry([
    ...createProviderProfilesFromModelsDev(catalog, overlays),
    ...getMissingDefaultProfiles(catalog),
  ])
  return registry
}

export function getProviderBaseUrl(profile: ProviderProfile) {
  return profile.baseUrl ?? profile.api ?? getDefaultProviderBaseUrl(profile.id)
}

export function getModelReasoningField(
  model: Pick<ModelsDevModel, 'interleaved'>
) {
  if (model.interleaved === true) return undefined
  return model.interleaved?.field
}

function getMissingDefaultProfiles(catalog: ModelsDevCatalog) {
  return defaultProviderProfiles.filter(profile => !(profile.id in catalog))
}

function isOpenAiChatProvider(provider: ModelsDevProvider) {
  return (
    provider.npm === '@ai-sdk/openai' ||
    provider.npm === '@ai-sdk/openai-compatible' ||
    provider.npm === '@openrouter/ai-sdk-provider'
  )
}

function getDefaultProviderBaseUrl(providerId: string) {
  if (providerId === 'openai') return 'https://api.openai.com/v1'
  throw new Error(`Provider ${providerId} does not declare an API endpoint.`)
}

function normalizeProviderId(providerId: string) {
  return providerId.trim().toLowerCase()
}
