import { ModelCatalog } from '@/lib/llm/model-catalog'
import {
  fetchModelsDevCatalog,
  type ModelsDevCatalog,
} from '@/lib/llm/models-dev'
import {
  createProviderRegistryFromModelsDev,
  defaultProviderOverlays,
  type ProviderProfileOverlay,
  type ProviderProfileRegistry,
} from '@/lib/llm/profile'
import type { FetchLike } from '@/lib/llm/transport'
import type { AppStorage, SettingsStore } from '@/lib/storage/ports'
import type { JsonValue } from '@/lib/storage/schema'

export const MODELS_DEV_CACHE_KEY = 'llm.modelsDev.cache'
export const MODELS_DEV_CACHE_TTL_MS = 24 * 60 * 60 * 1000

export type ModelsDevCacheStorage =
  | Pick<AppStorage, 'settings'>
  | {
      settings: SettingsStore
    }

export type CachedModelsDevCatalog = {
  fetchedAt: string
  catalog: ModelsDevCatalog
}

export type LoadModelsDevCatalogOptions = {
  storage: ModelsDevCacheStorage
  fetch?: FetchLike
  forceRefresh?: boolean
  ttlMs?: number
}

export type LoadModelsDevCatalogResult = {
  cache: CachedModelsDevCatalog
  source: 'cache' | 'remote'
  refreshError?: Error
}

export type CreateCachedModelCatalogOptions = LoadModelsDevCatalogOptions & {
  overlays?: Record<string, ProviderProfileOverlay>
}

export type CreateCachedModelCatalogResult = LoadModelsDevCatalogResult & {
  providerRegistry: ProviderProfileRegistry
  modelCatalog: ModelCatalog
}

export async function loadModelsDevCatalog({
  storage,
  fetch,
  forceRefresh = false,
  ttlMs = MODELS_DEV_CACHE_TTL_MS,
}: LoadModelsDevCatalogOptions): Promise<LoadModelsDevCatalogResult> {
  const cached = await readCachedModelsDevCatalog(storage.settings)

  if (cached && !forceRefresh && !isCacheExpired(cached, ttlMs)) {
    return {
      cache: cached,
      source: 'cache',
    }
  }

  try {
    const catalog = await fetchModelsDevCatalog(fetch)
    const cache = await writeCachedModelsDevCatalog(storage.settings, catalog)
    return {
      cache,
      source: 'remote',
    }
  } catch (cause) {
    if (cached) {
      return {
        cache: cached,
        source: 'cache',
        refreshError: toError(cause),
      }
    }
    throw cause
  }
}

export async function createCachedModelCatalog({
  overlays = defaultProviderOverlays,
  ...options
}: CreateCachedModelCatalogOptions): Promise<CreateCachedModelCatalogResult> {
  const loaded = await loadModelsDevCatalog(options)
  const created = createModelCatalogFromModelsDev(
    loaded.cache.catalog,
    overlays
  )

  return {
    ...loaded,
    ...created,
  }
}

export function createModelCatalogFromModelsDev(
  catalog: ModelsDevCatalog,
  overlays: Record<string, ProviderProfileOverlay> = defaultProviderOverlays
) {
  const providerRegistry = createProviderRegistryFromModelsDev(
    catalog,
    overlays
  )
  return {
    providerRegistry,
    modelCatalog: new ModelCatalog(providerRegistry),
  }
}

export async function readCachedModelsDevCatalog(settings: SettingsStore) {
  const value = await settings.get(MODELS_DEV_CACHE_KEY)
  return value as unknown as CachedModelsDevCatalog | undefined
}

export async function writeCachedModelsDevCatalog(
  settings: SettingsStore,
  catalog: ModelsDevCatalog
) {
  const cache = {
    fetchedAt: new Date().toISOString(),
    catalog,
  } satisfies CachedModelsDevCatalog

  await settings.set(MODELS_DEV_CACHE_KEY, cache as unknown as JsonValue)
  return cache
}

function isCacheExpired(cache: CachedModelsDevCatalog, ttlMs: number) {
  const fetchedAt = Date.parse(cache.fetchedAt)
  if (Number.isNaN(fetchedAt)) return true
  return Date.now() - fetchedAt > ttlMs
}

function toError(cause: unknown) {
  return cause instanceof Error ? cause : new Error(String(cause))
}
