import { nowIso } from '@/lib/storage/utils'
import type { ModelListFilter, ModelRepository } from '@/lib/storage/ports'
import type { StoredModelRecord, UpsertModelInput } from '@/lib/storage/schema'

import { db } from './indexed-db'

function generateModelKey(providerId: string, modelId: string) {
  return `${providerId}:${modelId}`
}

export class IndexedDbModelRepository implements ModelRepository {
  async list(filter: ModelListFilter = {}) {
    const { enabled, providerId } = filter
    let models

    if (providerId && enabled) {
      models = db.models
        .where('[providerId+enabledRank]')
        .equals([providerId, Number(enabled)])
    } else if (providerId) {
      models = db.models.where('providerId').equals(providerId)
    } else if (enabled !== undefined) {
      models = db.models.where('enabledRank').equals(Number(enabled))
    } else {
      models = db.models
    }

    return models.toArray().then(arr => {
      return arr.sort(
        (a, b) =>
          a.providerId.localeCompare(b.providerId) ||
          a.name.localeCompare(b.name)
      )
    })
  }

  get(providerId: string, modelId: string) {
    return db.models.get(generateModelKey(providerId, modelId))
  }

  async upsert(input: UpsertModelInput) {
    const timestamp = nowIso()
    const key = generateModelKey(input.providerId, input.id)
    const existing = await db.models.get(key)
    const enabled = input.enabled ?? existing?.enabled ?? true
    const model: StoredModelRecord = {
      ...input,
      key,
      createdAt: input.createdAt ?? existing?.createdAt ?? timestamp,
      updatedAt: input.updatedAt ?? timestamp,
      enabled,
      enabledRank: Number(enabled),
      metadata: input.metadata ?? existing?.metadata,
    }

    await db.models.put(model)
    return model
  }

  remove(providerId: string, modelId: string) {
    return db.models.delete(generateModelKey(providerId, modelId))
  }

  clear() {
    return db.models.clear()
  }
}
