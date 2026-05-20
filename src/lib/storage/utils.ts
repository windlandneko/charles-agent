export function createStorageId(prefix: string) {
  const id =
    globalThis.crypto?.randomUUID?.() ??
    `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`

  return `${prefix}_${id}`
}

export function nowIso() {
  return new Date().toISOString()
}
