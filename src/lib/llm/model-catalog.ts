import { getModelsDevModelCapabilities } from '@/lib/llm/models-dev'
import type {
  Protocol,
  ProviderModelMetadata,
  ProviderProfile,
  ProviderProfileRegistry,
} from '@/lib/llm/profile'
import type { ModelCapability, ModelReference } from '@/lib/llm/types'

export type ResolvedModel = {
  profile: ProviderProfile
  model: ProviderModelMetadata
  protocol: Protocol
  requestedProviderId?: string
}

export type ModelListFilter = {
  providerId?: string
  capabilities?: ModelCapability[]
}

export class ModelCatalogError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ModelCatalogError'
  }
}

export class UnknownModelError extends ModelCatalogError {
  constructor(message: string) {
    super(message)
    this.name = 'UnknownModelError'
  }
}

export class AmbiguousModelError extends ModelCatalogError {
  constructor(message: string) {
    super(message)
    this.name = 'AmbiguousModelError'
  }
}

export class ModelCatalog {
  private readonly models = new Map<
    string,
    Map<string, ProviderModelMetadata>
  >()
  private readonly aliases = new Map<
    string,
    ProviderModelMetadata | undefined
  >()
  private readonly providers: ProviderProfileRegistry

  constructor(
    providers: ProviderProfileRegistry,
    models: ProviderModelMetadata[] = []
  ) {
    this.providers = providers

    for (const profile of providers.list()) {
      for (const model of Object.values(profile.models)) {
        this.register({ ...model, providerId: model.providerId ?? profile.id })
      }
    }

    for (const model of models) {
      this.register(model)
    }
  }

  register(model: ProviderModelMetadata) {
    const providerId = this.providers.canonicalId(model.providerId)
    if (!providerId) {
      throw new UnknownModelError(`Unknown provider: ${model.providerId}`)
    }
    const normalizedModel = { ...model, providerId }
    const providerModels = this.models.get(providerId) ?? new Map()
    providerModels.set(normalizedModel.id, normalizedModel)
    this.models.set(providerId, providerModels)

    const existingAlias = this.aliases.get(model.id)
    if (!this.aliases.has(model.id)) {
      this.aliases.set(model.id, normalizedModel)
    } else if (
      existingAlias?.providerId === providerId &&
      existingAlias.id === normalizedModel.id
    ) {
      this.aliases.set(model.id, normalizedModel)
    } else {
      this.aliases.set(model.id, undefined)
    }
  }

  list(filter: ModelListFilter = {}) {
    const providerId = filter.providerId
      ? this.providers.canonicalId(filter.providerId)
      : undefined
    if (filter.providerId && !providerId) return []

    const models = providerId
      ? Array.from(this.models.get(providerId)?.values() ?? [])
      : Array.from(this.models.values()).flatMap(providerModels =>
          Array.from(providerModels.values())
        )

    return models.filter(
      model =>
        !filter.capabilities?.some(
          capability =>
            !getModelsDevModelCapabilities(model).includes(capability)
        )
    )
  }

  resolve(reference: ModelReference): ResolvedModel {
    if (typeof reference === 'string') {
      if (!this.aliases.has(reference)) {
        throw new UnknownModelError(
          `Unknown model: ${reference}. Register it first or pass { providerId, modelId }.`
        )
      }

      const model = this.aliases.get(reference)
      if (!model) throw new AmbiguousModelError(`Ambiguous model: ${reference}`)
      return this.resolveRegisteredModel(model)
    }

    const providerId = this.providers.canonicalId(reference.providerId)
    if (!providerId) {
      throw new UnknownModelError(`Unknown provider: ${reference.providerId}`)
    }

    const model = this.models.get(providerId)?.get(reference.modelId)
    if (!model) {
      throw new UnknownModelError(
        `Unknown model for provider ${providerId}: ${reference.modelId}`
      )
    }

    return this.resolveRegisteredModel(model, reference.providerId)
  }

  private resolveRegisteredModel(
    model: ProviderModelMetadata,
    requestedProviderId?: string
  ): ResolvedModel {
    const profile = this.providers.require(model.providerId)
    const supportedProtocols = model.supportedProtocols ?? profile.protocols
    const protocol = chooseProtocol({
      model,
      profile,
      supportedProtocols,
    })

    if (!protocol || !profile.protocols.includes(protocol)) {
      throw new Error(
        `Model ${model.id} is not compatible with provider ${profile.id}.`
      )
    }

    return {
      profile,
      model,
      protocol,
      requestedProviderId,
    }
  }
}

function chooseProtocol({
  model,
  profile,
  supportedProtocols,
}: {
  model: ProviderModelMetadata
  profile: ProviderProfile
  supportedProtocols: Protocol[]
}) {
  if (
    model.defaultProtocol &&
    supportedProtocols.includes(model.defaultProtocol)
  ) {
    return model.defaultProtocol
  }

  if (supportedProtocols.includes(profile.defaultProtocol)) {
    return profile.defaultProtocol
  }

  return supportedProtocols[0]
}
