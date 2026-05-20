import { getModelsDevModelCapabilities } from '@/lib/llm/models-dev'
import type { CredentialManager } from '@/lib/llm/credentials'
import type { ModelCatalog, ResolvedModel } from '@/lib/llm/model-catalog'
import type {
  ResolvedRoute,
  RouteResult,
  TransportRegistry,
} from '@/lib/llm/transport'
import type {
  ModelCapability,
  ModelReference,
  ReasoningEffort,
} from '@/lib/llm/types'

export type ResolveRouteInput = {
  model: ModelReference
  apiKey?: string
  apiKeys?: Record<string, string>
  capabilities?: ModelCapability[]
  reasoningEffort?: ReasoningEffort
}

export class ModelRouter {
  private readonly catalog: ModelCatalog
  private readonly credentials: CredentialManager
  private readonly transports: TransportRegistry

  constructor(
    catalog: ModelCatalog,
    credentials: CredentialManager,
    transports: TransportRegistry
  ) {
    this.catalog = catalog
    this.credentials = credentials
    this.transports = transports
  }

  resolve(input: ResolveRouteInput): ResolvedRoute {
    const resolvedModel = this.catalog.resolve(input.model)
    const modelCapabilities = getModelsDevModelCapabilities(resolvedModel.model)
    const missing = input.capabilities?.filter(
      capability => !modelCapabilities.includes(capability)
    )
    if (missing?.length) {
      throw new Error(
        `Model ${formatModelReference(input.model)} lacks capabilities: ${missing.join(', ')}`
      )
    }
    validateReasoningEffort(input, resolvedModel)
    const credential = this.credentials.resolve({
      profile: resolvedModel.profile,
      apiKey: input.apiKey,
      apiKeys: normalizeApiKeys(input.apiKeys, resolvedModel),
    })
    const adapter = this.transports.require(resolvedModel.protocol)

    return {
      ...resolvedModel,
      credential,
      adapter,
    }
  }

  reportResult(route: ResolvedRoute, result: RouteResult) {
    this.credentials.reportResult(route.credential, result)
  }
}

function formatModelReference(reference: ModelReference) {
  return typeof reference === 'string'
    ? reference
    : `${reference.providerId}/${reference.modelId}`
}

function normalizeApiKeys(
  apiKeys: Record<string, string> | undefined,
  route: { profile: { id: string }; requestedProviderId?: string }
) {
  if (!apiKeys || !route.requestedProviderId) return apiKeys
  const value = apiKeys[route.requestedProviderId]
  return value && !apiKeys[route.profile.id]
    ? { ...apiKeys, [route.profile.id]: value }
    : apiKeys
}

function validateReasoningEffort(
  input: ResolveRouteInput,
  route: Pick<ResolvedModel, 'model'>
) {
  if (!input.reasoningEffort || input.reasoningEffort === 'off') return

  if (!route.model.reasoning) {
    throw new Error(
      `Model ${route.model.id} does not support reasoning effort: ${input.reasoningEffort}`
    )
  }
}
