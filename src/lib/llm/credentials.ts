import type { AuthType, ProviderProfile } from '@/lib/llm/profile'

export type Credential = {
  id: string
  providerId: string
  type: AuthType
  value?: string
  headers?: Record<string, string>
  expiresAt?: number
}

export type CredentialRegistration = Omit<Credential, 'id'> & {
  id?: string
  disabled?: boolean
}

export type CredentialCandidate = Credential & {
  disabled?: boolean
  cooldownUntil?: number
  failureCount: number
  lastUsedAt?: number
}

export type ResolveCredentialInput = {
  profile: ProviderProfile
  apiKey?: string
  apiKeys?: Record<string, string>
}

export type CredentialResult = {
  ok: boolean
  error?: Error
}

export interface CredentialManager {
  resolve(input: ResolveCredentialInput): Credential
  reportResult(credential: Credential, result: CredentialResult): void
}

export class InMemoryCredentialManager implements CredentialManager {
  private readonly credentials = new Map<string, CredentialCandidate[]>()
  private readonly cursors = new Map<string, number>()

  constructor(credentials: CredentialRegistration[] = []) {
    for (const credential of credentials) {
      this.register(credential)
    }
  }

  register(registration: CredentialRegistration) {
    const credential: CredentialCandidate = {
      id: registration.id ?? createCredentialId(registration),
      providerId: registration.providerId,
      type: registration.type,
      value: registration.value,
      headers: registration.headers,
      expiresAt: registration.expiresAt,
      disabled: registration.disabled,
      failureCount: 0,
    }
    const providerCredentials =
      this.credentials.get(credential.providerId) ?? []

    providerCredentials.push(credential)
    this.credentials.set(credential.providerId, providerCredentials)

    return credential
  }

  list(providerId?: string) {
    if (providerId) {
      return [...(this.credentials.get(providerId) ?? [])]
    }

    return Array.from(this.credentials.values()).flat()
  }

  resolve({ profile, apiKey, apiKeys }: ResolveCredentialInput): Credential {
    if (profile.authType === 'none') {
      return { id: `${profile.id}:none`, providerId: profile.id, type: 'none' }
    }

    const trimmedApiKey = (apiKeys?.[profile.id] ?? apiKey)?.trim()
    if (trimmedApiKey) {
      return {
        id: `${profile.id}:runtime`,
        providerId: profile.id,
        type: profile.authType,
        value: trimmedApiKey,
      }
    }

    const candidates = this.activeCandidates(profile)
    if (candidates.length === 0) {
      throw new Error(`No active credential for provider: ${profile.id}`)
    }

    const cursor = this.cursors.get(profile.id) ?? 0
    const credential = candidates[cursor % candidates.length]
    this.cursors.set(profile.id, cursor + 1)
    credential.lastUsedAt = Date.now()

    return toCredential(credential)
  }

  reportResult(credential: Credential, result: CredentialResult) {
    const providerCredentials =
      this.credentials.get(credential.providerId) ?? []
    const candidate = providerCredentials.find(({ id }) => id === credential.id)
    if (!candidate) return

    if (result.ok) {
      candidate.failureCount = 0
      candidate.cooldownUntil = undefined
      return
    }

    if (shouldCooldown(result.error)) {
      candidate.failureCount += 1
      candidate.cooldownUntil =
        Date.now() + getCooldownMs(candidate.failureCount)
    }
  }

  private activeCandidates(profile: ProviderProfile) {
    const now = Date.now()
    return (this.credentials.get(profile.id) ?? []).filter(
      credential =>
        !credential.disabled &&
        credential.type === profile.authType &&
        (!credential.expiresAt || credential.expiresAt > now) &&
        (!credential.cooldownUntil || credential.cooldownUntil <= now)
    )
  }
}

function toCredential(candidate: CredentialCandidate): Credential {
  return {
    id: candidate.id,
    providerId: candidate.providerId,
    type: candidate.type,
    value: candidate.value,
    headers: candidate.headers,
    expiresAt: candidate.expiresAt,
  }
}

function createCredentialId(credential: CredentialRegistration) {
  return `${credential.providerId}:${credential.type}:${hashValue(
    credential.value ?? ''
  )}`
}

function getCooldownMs(failureCount: number) {
  const seconds = Math.min(60, 2 ** Math.min(failureCount, 5))
  return seconds * 1000
}

function hashValue(value: string) {
  let hash = 0
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index)
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

function shouldCooldown(error?: Error) {
  const status =
    error && 'status' in error
      ? Number((error as { status?: unknown }).status)
      : undefined
  return (
    status === undefined ||
    status === 401 ||
    status === 403 ||
    status === 429 ||
    status >= 500
  )
}
