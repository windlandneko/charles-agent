import type { SettingsStore } from '@/lib/storage/ports'
import type { JsonValue } from '@/lib/storage/schema'

const defaultPrefix = 'agent.settings.'

export class LocalStorageSettingsStore implements SettingsStore {
  private readonly prefix: string

  constructor(prefix = defaultPrefix) {
    this.prefix = prefix
  }

  async get<T extends JsonValue = JsonValue>(key: string) {
    const storage = getLocalStorage()
    const storageKey = this.storageKey(key)
    const raw = storage.getItem(storageKey)
    if (raw === null) return undefined

    const value = parseJsonValue<T>(raw)
    if (value === undefined) {
      storage.removeItem(storageKey)
      return undefined
    }

    return value
  }

  async set<T extends JsonValue>(key: string, value: T) {
    getLocalStorage().setItem(this.storageKey(key), JSON.stringify(value))
  }

  async remove(key: string) {
    getLocalStorage().removeItem(this.storageKey(key))
  }

  async all() {
    const storage = getLocalStorage()
    const values: Record<string, JsonValue> = {}
    const keys = getPrefixedKeys(storage, this.prefix)

    for (const storageKey of keys) {
      const raw = storage.getItem(storageKey)
      if (raw === null) continue

      const value = parseJsonValue(raw)
      if (value === undefined) {
        storage.removeItem(storageKey)
        continue
      }

      values[storageKey.slice(this.prefix.length)] = value
    }

    return values
  }

  async clear() {
    const storage = getLocalStorage()
    const keys = getPrefixedKeys(storage, this.prefix)

    for (const key of keys) {
      storage.removeItem(key)
    }
  }

  private storageKey(key: string) {
    return `${this.prefix}${key}`
  }
}

function getLocalStorage() {
  if (typeof localStorage === 'undefined') {
    throw new Error('localStorage is not available in this environment.')
  }

  return localStorage
}

function parseJsonValue<T extends JsonValue = JsonValue>(raw: string) {
  try {
    return JSON.parse(raw) as T
  } catch {
    return undefined
  }
}

function getPrefixedKeys(storage: Storage, prefix: string) {
  return Array.from({ length: storage.length }, (_, index) =>
    storage.key(index)
  ).filter((key): key is string => Boolean(key?.startsWith(prefix)))
}
