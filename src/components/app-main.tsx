import { useState } from 'react'

import { Copy, Pencil, RefreshCcw } from 'lucide-react'

import { Composer } from '@/components/composer'
import { Button } from '@/components/ui/button'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type Message = { role: 'user' | 'assistant'; content: string }

const actions = [
  ['Retry', RefreshCcw],
  ['Edit', Pencil],
  ['Copy', Copy],
] as const

export function AppMain() {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<Message[]>([])

  const send = () => {
    const content = draft.trim()
    if (!content) return
    setDraft('')
    setMessages((current) => [
      ...current,
      { role: 'user', content },
      {
        role: 'assistant',
        content:
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.'.repeat(Math.ceil(Math.random() * 5)),
      },
    ])
  }

  return (
    <SidebarInset>
      <div className="fixed top-2 left-2 z-20 lg:hidden">
        <SidebarTrigger />
      </div>

      <div
        className={cn(
          'h-svh w-full overflow-y-auto pb-64 pt-16',
          messages.length === 0 && 'hidden'
        )}
      >
        <div className="mx-auto max-w-3xl px-8">
          {messages.map((message, index) => (
            <MessageItem key={index} message={message} />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-x-0 mx-auto pb-4',
          messages.length === 0
            ? 'top-1/4 max-w-2xl px-4'
            : 'bottom-0 max-w-3xl bg-background px-2 pb-8'
        )}
      >
        {messages.length === 0 && (
          <h1 className="pb-12 text-center font-heading text-[clamp(1.875rem,1.2rem+2vw,2.5rem)] select-none">
            Good evening, Charlie
          </h1>
        )}
        <Composer
          placeholder={
            messages.length === 0
              ? 'How can I help you today?'
              : 'Write a message...'
          }
          value={draft}
          onChange={setDraft}
          onSubmit={send}
        />
      </div>

      <p
        className={cn(
          'absolute bottom-2 w-full text-center text-xs text-muted-foreground select-none',
          messages.length > 0
            ? 'ease opacity-100 transition-opacity duration-500'
            : 'opacity-0'
        )}
      >
        AI can make mistakes. Please double-check responses.
      </p>
    </SidebarInset>
  )
}

function MessageItem({ message }: { message: Message }) {
  if (message.role === 'assistant') {
    return (
      <article className="group mt-6 mb-1 flex flex-col">
        <div className="ml-1 mb-1 font-heading text-pretty whitespace-pre-wrap">
          {message.content}
        </div>
        <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
          {actions.map(([label, Icon]) => (
            <Tooltip key={label} delayDuration={300}>
              <TooltipTrigger asChild>
                <Button variant="ghost" aria-label={label} size="icon-lg">
                  <Icon />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </article>
    )
  }

  return (
    <article className="group mt-6 mb-1 flex flex-col items-end">
      <div className="mr-1 mb-1 max-w-[85%] rounded-xl bg-accent px-4 py-2.5 whitespace-pre-wrap">
        {message.content}
      </div>
      <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        {actions.map(([label, Icon]) => (
          <Tooltip key={label} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button variant="ghost" aria-label={label} size="icon-lg">
                <Icon />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{label}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </article>
  )
}
