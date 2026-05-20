import { Composer } from '@/components/composer'
import { MessageItem } from '@/components/message-item'
import { ConversationSkeleton } from '@/components/skeleton'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useAgentWorker } from '@/hooks/use-agent-worker'
import { cn } from '@/lib/utils'
import type { ChatThreadsController } from '@/hooks/use-chat-threads'

type AppMainProps = {
  chatThreads: ChatThreadsController
}

export function AppMain({ chatThreads }: AppMainProps) {
  const chat = useAgentWorker({
    chatThreads,
  })
  const messages = chat.messages
  const isLoading =
    Boolean(chatThreads.activeThreadId) &&
    chat.isLoadingThread &&
    messages.length === 0
  const showConversation = messages.length > 0 || isLoading
  const showWelcome = !showConversation

  return (
    <SidebarInset>
      <div className="fixed top-2 left-2 z-20 lg:hidden">
        <SidebarTrigger />
      </div>

      <div
        className={cn(
          'h-svh w-full overflow-y-auto pt-16 pb-64',
          !showConversation && 'hidden'
        )}
      >
        <div className="mx-auto max-w-3xl px-8">
          {isLoading ? (
            <ConversationSkeleton />
          ) : (
            messages.map((message, index) => (
              <MessageItem
                key={message.id ?? index}
                index={index}
                message={message}
                onCopy={chat.copyMessage}
                onReasoningOpenChange={chat.changeReasoningOpen}
                onRetry={chat.retryMessage}
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
        {showWelcome && (
          <h1 className="pb-12 text-center font-heading text-[clamp(1.875rem,1.2rem+2vw,2.5rem)] select-none">
            Good evening, Charlie
          </h1>
        )}
        <Composer
          apiKey={chat.apiKey}
          disabled={chat.isLoadingThread}
          isSending={chat.isSending}
          model={chat.model}
          placeholder={
            showConversation
              ? 'Write a message...'
              : 'How can I help you today?'
          }
          thinkingMode={chat.thinkingMode}
          value={chat.draft}
          onApiKeyChange={chat.updateApiKey}
          onChange={chat.updateDraft}
          onModelChange={chat.updateModel}
          onSubmit={chat.send}
          onStop={chat.stopGeneration}
          onThinkingModeChange={chat.updateThinkingMode}
        />
        {chat.error && (
          <p className="mt-2 px-2 text-sm text-destructive" role="alert">
            {chat.error}
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
