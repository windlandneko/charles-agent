import type { KeyboardEvent, SyntheticEvent } from 'react'

import { ArrowUp, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
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
  value: string
  placeholder?: string
  onChange: (value: string) => void
  onSubmit: () => void
}

export function Composer({
  className,
  value,
  placeholder,
  onChange,
  onSubmit,
}: ComposerProps) {
  const canSubmit = value.trim().length > 0

  const formSubmit = (event: SyntheticEvent) => {
    event.preventDefault()
    if (canSubmit) onSubmit()
  }
  const keySubmit = (event: KeyboardEvent) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (canSubmit) onSubmit()
    }
  }

  const providers = [
    {
      label: 'Deepseek',
      models: [
        { value: 'deepseek-v4-flash', label: 'Deepseek V4 Flash' },
        { value: 'deepseek-v4-pro', label: 'Deepseek V4 Pro' },
      ],
    },
    {
      label: 'OpenAI',
      models: [
        { value: 'gpt-5.5', label: 'GPT 5.5' },
        { value: 'gpt-5.4', label: 'GPT 5.4' },
        { value: 'gpt-5.4-mini', label: 'GPT 5.4 Mini' },
        { value: 'gpt-5.3-codex', label: 'GPT 5.3 Codex' },
        { value: 'gpt-5.3-codex-spark', label: 'GPT 5.3 Codex Spark' },
        { value: 'gpt-5.2', label: 'GPT 5.2' },
      ],
    },
    {
      label: 'Anthropic',
      models: [
        { value: 'claude-4.7-opus', label: 'Opus 4.7' },
        { value: 'claude-4.6-sonnet', label: 'Sonnet 4.6' },
        { value: 'claude-4.5-haiku', label: 'Haiku 4.5' },
      ],
    },
  ]

  const thinkingModes = ['low', 'medium', 'high', 'xhigh']

  return (
    <form className={cn('relative w-full', className)} onSubmit={formSubmit}>
      <Textarea
        aria-label="Message"
        className="min-h-24 rounded-2xl bg-card px-5 pt-4.5 pb-16 text-base! shadow-[0_0.25rem_1.25rem_hsl(0_0%_0%/3.5%),0_0_0_0.5px_hsla(0_0%_0%/0.15)] focus-within:shadow-[0_0.25rem_1.25rem_hsl(0_0%_0%/7.5%),0_0_0_0.5px_hsla(0_0%_0%/0.3)] hover:shadow-[0_0.25rem_1.25rem_hsl(0_0%_0%/3.5%),0_0_0_0.5px_hsla(0_0%_0%/0.3)] hover:focus-within:shadow-[0_0.25rem_1.25rem_hsl(0_0%_0%/7.5%),0_0_0_0.5px_hsla(0_0%_0%/0.3)] focus-visible:ring-0"
        onChange={({ target }) => onChange(target.value)}
        onKeyDown={keySubmit}
        placeholder={placeholder}
        value={value}
      />

      <div className="pointer-events-none absolute right-3 bottom-3 left-3 flex items-end justify-between">
        <div className="pointer-events-auto flex min-w-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-lg"
            aria-label="Add attachment"
          >
            <Plus />
          </Button>
          <Select defaultValue={providers[0].models[0].value}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {providers.map((provider) => (
                <SelectGroup key={provider.label}>
                  <SelectLabel>{provider.label}</SelectLabel>
                  {provider.models.map((model) => (
                    <SelectItem value={model.value}>{model.label}</SelectItem>
                  ))}
                </SelectGroup>
              ))}
            </SelectContent>
          </Select>
          <Select defaultValue="off">
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
                {thinkingModes.map((mode) => (
                  <SelectItem value={mode}>{mode}</SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <Button
          type="submit"
          size="icon-lg"
          aria-label="Send message"
          className="pointer-events-auto"
          disabled={!canSubmit}
        >
          <ArrowUp />
        </Button>
      </div>
    </form>
  )
}
