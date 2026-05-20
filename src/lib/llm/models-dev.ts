import type { ModelCapability } from '@/lib/llm/types'
import type { JsonValue } from '@/lib/storage/schema'

export const MODELS_DEV_API_URL = 'https://models.dev/api.json'

export type { JsonValue } from '@/lib/storage/schema'

export type ModelsDevCost = {
  input: number
  output: number
  reasoning?: number
  cache_read?: number
  cache_write?: number
  input_audio?: number
  output_audio?: number
}

export type ModelsDevCostTier = ModelsDevCost & {
  tier: {
    type: 'context'
    size: number
  }
}

export type ModelsDevOutputCost = ModelsDevCost & {
  context_over_200k?: ModelsDevCost
  tiers?: ModelsDevCostTier[]
}

export type ModelsDevModelProvider = {
  npm?: string
  api?: string
  shape?: 'responses' | 'completions'
  body?: Record<string, JsonValue>
  headers?: Record<string, string>
}

export type ModelsDevExperimentalMode = {
  cost?: ModelsDevCost
  provider?: {
    body?: Record<string, JsonValue>
    headers?: Record<string, string>
  }
}

export type ModelsDevModel = {
  id: string
  name: string
  family?: string
  attachment: boolean
  reasoning: boolean
  tool_call: boolean
  interleaved?:
    | true
    | {
        field: 'reasoning_content' | 'reasoning_details'
      }
  structured_output?: boolean
  temperature?: boolean
  knowledge?: string
  release_date: string
  last_updated: string
  modalities: {
    input: ModelsDevModality[]
    output: ModelsDevModality[]
  }
  open_weights: boolean
  limit: {
    context: number
    input?: number
    output: number
  }
  cost?: ModelsDevOutputCost
  status?: 'alpha' | 'beta' | 'deprecated'
  experimental?: {
    modes?: Record<string, ModelsDevExperimentalMode>
  }
  provider?: ModelsDevModelProvider
}

export type ModelsDevProvider = {
  id: string
  env: string[]
  npm: string
  api?: string
  name: string
  doc: string
  models: Record<string, ModelsDevModel>
}

export type ModelsDevCatalog = Record<string, ModelsDevProvider>

export type ModelsDevModality = 'text' | 'audio' | 'image' | 'video' | 'pdf'

export async function fetchModelsDevCatalog(fetchLike: typeof fetch = fetch) {
  const response = await fetchLike(MODELS_DEV_API_URL)
  if (!response.ok) {
    throw new Error(`Unable to fetch models.dev catalog: ${response.status}`)
  }
  return (await response.json()) as ModelsDevCatalog
}

export function getModelsDevModelCapabilities(
  model: Pick<
    ModelsDevModel,
    'modalities' | 'reasoning' | 'structured_output' | 'tool_call'
  >
): ModelCapability[] {
  const capabilities = new Set<ModelCapability>(['text'])

  if (model.modalities.input.includes('image')) {
    capabilities.add('vision')
  }
  if (model.tool_call) {
    capabilities.add('tool-use')
  }
  if (model.reasoning) {
    capabilities.add('reasoning')
  }
  if (model.structured_output) {
    capabilities.add('structured-output')
  }

  return [...capabilities]
}
