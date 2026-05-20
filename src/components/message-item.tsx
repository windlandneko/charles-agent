import { Check, ChevronRight, Copy, Pencil, RefreshCcw } from 'lucide-react'
import {
  type CSSProperties,
  memo,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react'

import { MessageMarkdown } from '@/components/message-markdown'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/lib/deepseek'

type MessageItemProps = {
  enterDelayMs?: number
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
  enterDelayMs,
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
        enterDelayMs={enterDelayMs}
        isCopied={isCopied}
        message={message}
        onCopy={copy}
        onReasoningOpenChange={onReasoningOpenChange}
        onRetry={onRetry}
      />
    )
  }

  return (
    <UserMessage
      enterDelayMs={enterDelayMs}
      isCopied={isCopied}
      message={message}
      onCopy={copy}
    />
  )
})

function AssistantMessage({
  index,
  enterDelayMs,
  isCopied,
  message,
  onCopy,
  onReasoningOpenChange,
  onRetry,
}: {
  index: number
  enterDelayMs?: number
  isCopied: boolean
  message: ChatMessage
  onCopy: () => void
  onReasoningOpenChange: (index: number, open: boolean) => void
  onRetry: (index: number) => void
}) {
  const hasReasoning = Boolean(message.reasoningContent)
  const enterAnimation = getEnterAnimationProps(enterDelayMs)

  return (
    <article
      className={cn('group mt-6 mb-1 flex flex-col', enterAnimation.className)}
      style={enterAnimation.style}
    >
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
        actions={assistantActions}
        isCopied={isCopied}
        onCopy={onCopy}
        onRetry={() => onRetry(index)}
      />
    </article>
  )
}

function UserMessage({
  enterDelayMs,
  isCopied,
  message,
  onCopy,
}: {
  enterDelayMs?: number
  isCopied: boolean
  message: ChatMessage
  onCopy: () => void
}) {
  const enterAnimation = getEnterAnimationProps(enterDelayMs)

  return (
    <article
      className={cn(
        'group mt-6 mb-1 flex flex-col items-end',
        enterAnimation.className
      )}
      style={enterAnimation.style}
    >
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

function getMessageAnimationStyle(delayMs: number) {
  return {
    '--message-enter-delay': `${delayMs}ms`,
  } as CSSProperties
}

function getEnterAnimationProps(delayMs: number | undefined) {
  if (delayMs === undefined) {
    return {
      className: undefined,
      style: undefined,
    }
  }

  return {
    className: 'message-enter',
    style: getMessageAnimationStyle(delayMs),
  }
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
