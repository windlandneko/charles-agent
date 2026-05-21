import { ArrowUp, Plus, StopCircle } from 'lucide-react'
import { type KeyboardEvent, type SyntheticEvent } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { chatProviders } from '@/lib/deepseek'
import { cn } from '@/lib/utils'
import type { AgentHook } from '@/hooks/use-agent'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from './ui/select'

type ComposerProps = {
  className?: string
  agent: AgentHook
  placeholder?: string
}

const thinkingModes = ['max'] as const

export function Composer({ className, agent, placeholder }: ComposerProps) {
  const controlsDisabled = agent.isLoadingThread || agent.isSending
  const canSubmit =
    agent.draft.trim().length > 0 && !agent.isLoadingThread && !agent.isSending

  const handleSend = () => {
    if (agent.isSending) {
      agent.stopGeneration?.()
      return
    }
    if (canSubmit) agent.send()
  }

  return (
    <form
      className={cn('relative z-10 w-full', className)}
      onSubmit={(event: SyntheticEvent) => {
        event.preventDefault()
        handleSend()
      }}
    >
      <Textarea
        aria-label="Message"
        className="shadow-composer max-h-96 min-h-24 rounded-2xl bg-card px-5 pt-4.5 pb-16 text-base!"
        disabled={controlsDisabled}
        onChange={({ target }) => agent.updateDraft(target.value)}
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key !== 'Enter') return
          if (event.shiftKey) return
          event.preventDefault()
          handleSend()
        }}
        placeholder={placeholder}
        value={agent.draft}
      />

      <div
        aria-hidden="true"
        className="pointer-events-none absolute right-2 bottom-0 left-0 z-10 h-18 rounded-b-2xl bg-linear-to-t from-card via-card via-70% to-card/0 dark:from-input dark:via-input dark:via-70% dark:to-input/0"
      />

      <div className="pointer-events-none absolute right-3 bottom-3 left-3 z-20 flex items-end justify-between">
        <div className="pointer-events-auto flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Add attachment"
            disabled={controlsDisabled}
          >
            <Plus />
          </Button>
          <Select
            value={agent.model}
            onValueChange={agent.updateModel}
            disabled={controlsDisabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {chatProviders.map(provider => (
                <SelectGroup key={provider.id}>
                  <SelectLabel>{provider.label}</SelectLabel>
                  {provider.models.map(model => (
                    <SelectItem key={model.value} value={model.value}>
                      {model.label}
                    </SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={agent.thinkingMode}
            onValueChange={agent.updateThinkingMode}
            disabled={controlsDisabled}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectItem value="off">off</SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>Thinking</SelectLabel>
                {thinkingModes.map(mode => (
                  <SelectItem key={mode} value={mode}>
                    {mode}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          <Input
            aria-label="API key"
            className="h-7 w-16 bg-input/20 px-2 py-1 text-xs md:w-24"
            disabled={controlsDisabled}
            onChange={({ target }) => agent.updateApiKey(target.value)}
            placeholder="API key"
            type="password"
            value={agent.apiKey}
          />
        </div>

        <Button
          type="submit"
          size="icon-lg"
          aria-label={agent.isSending ? 'Stop' : 'Send message'}
          className="pointer-events-auto"
          disabled={!canSubmit && !agent.isSending}
        >
          {agent.isSending ? <StopCircle /> : <ArrowUp />}
        </Button>
      </div>
    </form>
  )
}
