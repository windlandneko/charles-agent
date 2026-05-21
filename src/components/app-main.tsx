import { Composer } from '@/components/composer'
import { MessageItem } from '@/components/message-item'
import { ConversationSkeleton } from '@/components/skeleton'
import { SidebarInset, SidebarTrigger } from '@/components/ui/sidebar'
import { useAgent } from '@/hooks/use-agent'
import type { ChatThreadsController } from '@/hooks/use-chat-threads'

export function AppMain({ controller }: { controller: ChatThreadsController }) {
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

      <div className="relative h-svh overflow-hidden">
        {showConversation ? (
          <>
            <div className="h-full scrollbar-gutter-stable overflow-y-auto pb-52">
              <div className="mx-auto w-full max-w-3xl px-8 pt-16">
                {isLoading ? (
                  <ConversationSkeleton />
                ) : (
                  messages.map((message, index) => (
                    <MessageItem
                      key={message.id}
                      index={index}
                      message={message}
                      onRetry={agent.retryMessage}
                    />
                  ))
                )}
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 mx-auto max-w-3xl">
              <div className="w-full bg-background px-2 pb-2">
                {agent.error && (
                  <p
                    className="mb-1 px-2 text-sm text-destructive"
                    role="alert"
                  >
                    {agent.error}
                  </p>
                )}
                <Composer agent={agent} placeholder="Write a message..." />
              </div>
              <p className="bg-background pb-2 text-center text-xs text-muted-foreground select-none">
                AI can make mistakes. Please double-check responses.
              </p>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center pt-[25vh]">
            <h1 className="pb-12 text-center font-heading text-[clamp(1.875rem,1.2rem+2vw,2.5rem)] select-none">
              Good evening, Charlie
            </h1>
            <div className="mx-auto w-full max-w-2xl px-4 pb-4">
              <Composer agent={agent} placeholder="How can I help you today?" />
              {agent.error && (
                <p className="mt-2 px-2 text-sm text-destructive" role="alert">
                  {agent.error}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </SidebarInset>
  )
}
