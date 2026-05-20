import { TransportRegistry } from '@/lib/llm/transport'
import { openAiChatAdapter } from '@/lib/llm/transports/openai-chat'

export const defaultTransportAdapters = [openAiChatAdapter] as const

export function createDefaultTransportRegistry() {
  return new TransportRegistry(defaultTransportAdapters)
}
