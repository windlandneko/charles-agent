import { Check, ChevronRight, Copy, Pencil, RefreshCcw } from 'lucide-react'
import { memo, useCallback, useEffect, useRef, useState } from 'react'

import { MessageMarkdown } from '@/components/message-markdown'
import { Button } from '@/components/ui/button'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/deepseek'

type MessageItemProps = {
  index: number
  message: ChatMessage
  onCopy: (message: ChatMessage) => Promise<boolean>
  onReasoningOpenChange: (index: number, open: boolean) => void
  onRetry: (index: number) => void
}

const assistantActions = [
  ['Retry', RefreshCcw],
  ['Edit', Pencil],
  ['Copy', Copy],
] as const
type MessageAction = (typeof assistantActions)[number]

const userActions = assistantActions.filter(([label]) => label !== 'Retry')

export const MessageItem = memo(function MessageItem({
  index,
  message,
  onCopy,
  onReasoningOpenChange,
  onRetry,
}: MessageItemProps) {
  const [isCopied, setIsCopied] = useState(false)
  const copyResetRef = useRef<number | null>(null)

  useEffect(() => {
    return () => {
      if (copyResetRef.current !== null) {
        window.clearTimeout(copyResetRef.current)
      }
    }
  }, [])

  const copy = useCallback(async () => {
    const didCopy = await onCopy(message)
    if (!didCopy) return

    if (copyResetRef.current !== null) {
      window.clearTimeout(copyResetRef.current)
    }
    setIsCopied(true)
    copyResetRef.current = window.setTimeout(() => {
      setIsCopied(false)
      copyResetRef.current = null
    }, 2000)
  }, [message, onCopy])

  if (message.role === 'assistant') {
    return (
      <AssistantMessage
        index={index}
        isCopied={isCopied}
        message={message}
        onCopy={copy}
        onReasoningOpenChange={onReasoningOpenChange}
        onRetry={onRetry}
      />
    )
  }

  return <UserMessage isCopied={isCopied} message={message} onCopy={copy} />
})

function AssistantMessage({
  index,
  isCopied,
  message,
  onCopy,
  onReasoningOpenChange,
  onRetry,
}: {
  index: number
  isCopied: boolean
  message: ChatMessage
  onCopy: () => void
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
              <span className="truncate">Thinking...</span>
              <ChevronRight
                className={cn(
                  'size-4 shrink-0 transition-transform',
                  message.reasoningOpen && 'rotate-90'
                )}
              />
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            {message.reasoningOpen && (
              <MessageMarkdown
                className="mb-4 border-l border-border pl-4 text-sm text-muted-foreground"
                content={message.reasoningContent ?? ''}
              />
            )}
          </CollapsibleContent>
        </Collapsible>
      )}
      <MessageMarkdown
        className="mb-1 ml-1 font-heading text-pretty"
        content={message.content || (message.isThinking ? '' : '...')}
      />
      <MessageActions
        actions={assistantActions}
        isCopied={isCopied}
        onCopy={onCopy}
        onRetry={() => onRetry(index)}
      />
    </article>
  )
}

function UserMessage({
  isCopied,
  message,
  onCopy,
}: {
  isCopied: boolean
  message: ChatMessage
  onCopy: () => void
}) {
  return (
    <article className="group mt-6 mb-1 flex flex-col items-end">
      <MessageMarkdown
        className="mr-1 mb-1 max-w-[85%] rounded-xl bg-accent px-4 py-2.5"
        content={message.content}
      />
      <MessageActions
        actions={userActions}
        isCopied={isCopied}
        onCopy={onCopy}
      />
    </article>
  )
}

function MessageActions({
  actions,
  isCopied,
  onCopy,
  onRetry,
}: {
  actions: readonly MessageAction[]
  isCopied: boolean
  onCopy: () => void
  onRetry?: () => void
}) {
  return (
    <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
      {actions.map(([label, Icon]) => {
        const copied = label === 'Copy' && isCopied

        return (
          <Tooltip key={label} delayDuration={300}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                aria-label={copied ? 'Copied' : label}
                size="icon-lg"
                onClick={
                  label === 'Retry'
                    ? onRetry
                    : label === 'Copy'
                      ? onCopy
                      : undefined
                }
              >
                {copied ? <Check /> : <Icon />}
              </Button>
            </TooltipTrigger>
            <TooltipContent>{copied ? 'Copied' : label}</TooltipContent>
          </Tooltip>
        )
      })}
    </div>
  )
}
