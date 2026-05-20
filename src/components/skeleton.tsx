import { Skeleton } from '@/components/ui/skeleton'

function UserBubbleSkeleton() {
  return (
    <div className="flex justify-end">
      <Skeleton className="h-11 w-[min(70%,24rem)] rounded-xl bg-muted-foreground/10" />
    </div>
  )
}

function AgentMessageSkeleton() {
  return (
    <div className="ml-1 flex flex-col gap-3 py-2">
      <Skeleton className="h-5 w-full rounded-full bg-muted-foreground/10" />
      <Skeleton className="h-5 w-full rounded-full bg-muted-foreground/10" />
      <Skeleton className="h-5 w-full rounded-full bg-muted-foreground/10" />
      <Skeleton className="h-5 w-2/3 rounded-full bg-muted-foreground/10" />
    </div>
  )
}

export function ConversationSkeleton() {
  return (
    <div
      className="flex animate-in flex-col gap-8 py-4 duration-200 fade-in-0 motion-reduce:animate-none"
      aria-hidden="true"
    >
      <UserBubbleSkeleton />
      <AgentMessageSkeleton />
      <UserBubbleSkeleton />
      <AgentMessageSkeleton />
    </div>
  )
}
