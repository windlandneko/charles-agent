import { Composer } from '@/components/composer'
import { MessageItem } from '@/components/message-item'
import { ConversationSkeleton } from '@/components/skeleton'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useAgent } from '@/hooks/use-agent'
import { cn } from '@/lib/utils'
import type { ChatThreadsController } from '@/hooks/use-chat-threads'

type AppMainProps = {
  controller: ChatThreadsController
}

export function AppMain({ controller }: AppMainProps) {
  const agent = useAgent({ controller })
  const messages = agent.messages
  const isLoading =
    Boolean(controller.activeThreadId) &&
    agent.isLoadingThread &&
    messages.length === 0
  const showConversation = messages.length > 0 || isLoading

  return (
    <SidebarInset>
      <div className="fixed top-2 left-2 z-20 lg:hidden">
        <SidebarTrigger />
      </div>

      <div
        className={cn(
          'h-svh w-full scrollbar-gutter-stable overflow-y-auto pt-16 pb-64',
          !showConversation && 'hidden'
        )}
      >
        <div className="mx-auto max-w-3xl px-8">
          {isLoading ? (
            <ConversationSkeleton />
          ) : (
            messages.map((message, index) => (
              <MessageItem
                key={message.id}
                index={index}
                message={message}
                onReasoningOpenChange={agent.changeReasoningOpen}
                onRetry={agent.retryMessage}
              />
            ))
          )}
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-x-0 mx-auto pb-4',
          showConversation
            ? 'bottom-0 max-w-3xl bg-background px-2 pb-8'
            : 'top-1/4 max-w-2xl px-4'
        )}
      >
        {!showConversation && (
          <h1 className="pb-12 text-center font-heading text-[clamp(1.875rem,1.2rem+2vw,2.5rem)] select-none">
            Good evening, Charlie
          </h1>
        )}
        <Composer
          agent={agent}
          placeholder={
            showConversation
              ? 'Write a message...'
              : 'How can I help you today?'
          }
        />
        {agent.error && (
          <p className="mt-2 px-2 text-sm text-destructive" role="alert">
            {agent.error}
          </p>
        )}
      </div>

      <p
        className={cn(
          'absolute bottom-2 w-full text-center text-xs text-muted-foreground select-none',
          showConversation
            ? 'ease opacity-100 transition-opacity duration-500'
            : 'opacity-0'
        )}
      >
        AI can make mistakes. Please double-check responses.
      </p>
    </SidebarInset>
  )
}
