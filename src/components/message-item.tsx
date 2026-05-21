import { Check, ChevronRight, Copy, Pencil, RefreshCcw } from 'lucide-react'
import { memo, type ReactNode } from 'react'

import { MessageMarkdown } from '@/components/message-markdown'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { useCopyToClipboard } from '@/hooks/use-clipboard'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/deepseek'

type MessageItemProps = {
  index: number
  message: ChatMessage
  onReasoningOpenChange: (index: number, open: boolean) => void
  onRetry: (index: number) => void
}

export const MessageItem = memo(function MessageItem({
  index,
  message,
  onReasoningOpenChange,
  onRetry,
}: MessageItemProps) {
  if (message.role === 'assistant') {
    return (
      <AssistantMessage
        index={index}
        message={message}
        onReasoningOpenChange={onReasoningOpenChange}
        onRetry={onRetry}
      />
    )
  }

  return <UserMessage message={message} />
})

function AssistantMessage({
  index,
  message,
  onReasoningOpenChange,
  onRetry,
}: {
  index: number
  message: ChatMessage
  onReasoningOpenChange: (index: number, open: boolean) => void
  onRetry: (index: number) => void
}) {
  const hasReasoning = Boolean(message.reasoningContent)

  return (
    <article className="group mt-6 mb-1 flex flex-col">
      {hasReasoning && (
        <Collapsible
          open={message.reasoningOpen}
          onOpenChange={open => onReasoningOpenChange(index, open)}
        >
          <CollapsibleTrigger asChild>
            <button
              className="mb-4 flex max-w-full items-center gap-1 text-left text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              type="button"
            >
              <ThinkingStatus message={message} />
              <ChevronRight
                className={cn(
                  'size-4 shrink-0 transition-transform',
                  message.reasoningOpen && 'rotate-90'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <ReasoningPanel open={Boolean(message.reasoningOpen)}>
            <MessageMarkdown
              className="mb-4 border-l border-border pl-4 text-sm text-muted-foreground"
              content={message.reasoningContent ?? ''}
              renderMath={false}
            />
          </ReasoningPanel>
        </Collapsible>
      )}
      <MessageMarkdown
        className="mb-1 ml-1 font-heading text-pretty"
        content={message.content || (message.isThinking ? '' : '...')}
      />
      <MessageActions
        content={message.content}
        onRetry={() => onRetry(index)}
      />
    </article>
  )
}

function UserMessage({ message }: { message: ChatMessage }) {
  return (
    <article className="group mt-6 mb-1 flex flex-col items-end">
      <MessageMarkdown
        className="mr-1 mb-1 max-w-[85%] rounded-xl bg-accent px-4 py-2.5"
        content={message.content}
      />
      <MessageActions content={message.content} />
    </article>
  )
}

function ThinkingStatus({ message }: { message: ChatMessage }) {
  if (message.isThinking) {
    return (
      <span className="truncate">
        Thinking
        <span className="inline-flex w-[1ch] justify-start" aria-hidden="true">
          <span className="animate-pulse motion-reduce:animate-none">.</span>
          <span className="animate-pulse [animation-delay:150ms] motion-reduce:animate-none">
            .
          </span>
          <span className="animate-pulse [animation-delay:300ms] motion-reduce:animate-none">
            .
          </span>
        </span>
      </span>
    )
  }

  return (
    <span className="truncate">Thought for {getThinkingDuration(message)}</span>
  )
}

function ReasoningPanel({
  children,
  open,
}: {
  children: ReactNode
  open: boolean
}) {
  return (
    <div
      aria-hidden={!open}
      className={cn(
        'grid overflow-hidden transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none',
        open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
      )}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  )
}

function getThinkingDuration(message: ChatMessage) {
  const start = Date.parse(message.thinkingStartedAt ?? message.createdAt ?? '')
  const end = Date.parse(
    message.thinkingEndedAt ?? message.updatedAt ?? new Date().toISOString()
  )

  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return '0s'

  return `${Math.round((end - start) / 1000)}s`
}

function MessageActions({
  content,
  onRetry,
}: {
  content: string
  onRetry?: () => void
}) {
  const { copied, copy } = useCopyToClipboard()

  return (
    <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {onRetry && (
        <Tooltip delayDuration={300}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              aria-label="Retry"
              size="icon-lg"
              onClick={onRetry}
            >
              <RefreshCcw />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Retry</TooltipContent>
        </Tooltip>
      )}

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button variant="ghost" aria-label="Edit" size="icon-lg">
            <Pencil />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Edit</TooltipContent>
      </Tooltip>

      <Tooltip delayDuration={300}>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            aria-label={copied ? 'Copied' : 'Copy'}
            size="icon-lg"
            onClick={() => copy(content)}
          >
            {copied ? <Check /> : <Copy />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{copied ? 'Copied' : 'Copy'}</TooltipContent>
      </Tooltip>
    </div>
  )
}
