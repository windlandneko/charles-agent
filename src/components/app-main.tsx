import { Composer } from '@/components/composer'
import { MessageItem } from '@/components/message-item'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useDeepSeekChat } from '@/hooks/use-deepseek-chat'
import { cn } from '@/lib/utils'

export function AppMain() {
  const chat = useDeepSeekChat()
  const hasMessages = chat.messages.length > 0

  return (
    <SidebarInset>
      <div className="fixed top-2 left-2 z-20 lg:hidden">
        <SidebarTrigger />
      </div>

      <div
        className={cn(
          'h-svh w-full overflow-y-auto pt-16 pb-64',
          !hasMessages && 'hidden'
        )}
      >
        <div className="mx-auto max-w-3xl px-8">
          {chat.messages.map((message, index) => (
            <MessageItem
              key={index}
              index={index}
              message={message}
              onCopy={chat.copyMessage}
              onReasoningOpenChange={chat.changeReasoningOpen}
              onRetry={chat.retryMessage}
            />
          ))}
        </div>
      </div>

      <div
        className={cn(
          'absolute inset-x-0 mx-auto pb-4',
          hasMessages
            ? 'bottom-0 max-w-3xl bg-background px-2 pb-8'
            : 'top-1/4 max-w-2xl px-4'
        )}
      >
        {!hasMessages && (
          <h1 className="pb-12 text-center font-heading text-[clamp(1.875rem,1.2rem+2vw,2.5rem)] select-none">
            Good evening, Charlie
          </h1>
        )}
        <Composer
          apiKey={chat.apiKey}
          disabled={false}
          isSending={chat.isSending}
          model={chat.model}
          placeholder={
            hasMessages ? 'Write a message...' : 'How can I help you today?'
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
          hasMessages
            ? 'ease opacity-100 transition-opacity duration-500'
            : 'opacity-0'
        )}
      >
        AI can make mistakes. Please double-check responses.
      </p>
    </SidebarInset>
  )
}
