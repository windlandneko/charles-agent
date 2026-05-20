'use client'

import {
  ArchiveIcon,
  BoxIcon,
  Code2Icon,
  MoreVertical,
  PencilIcon,
  PinIcon,
  PlusIcon,
  SearchIcon,
  TrashIcon,
} from 'lucide-react'
import * as React from 'react'

import { NavUser } from '@/components/nav-user'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar,
} from '@/components/ui/sidebar'
import type { ChatThreadsController } from '@/hooks/use-chat-threads'
import type { ChatThread } from '@/lib/storage/schema'

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

const data = {
  user: {
    name: 'Charlie',
    email: 'Free plan',
    avatar: '',
  },
  topNav: [
    {
      title: 'New chat',
      url: '#',
      icon: <PlusIcon />,
    },
    {
      title: 'Search',
      url: '#',
      icon: <SearchIcon />,
      shortcut: 'Ctrl+K',
    },
  ],
  mainNav: [
    {
      title: 'Code',
      url: '#',
      icon: <Code2Icon />,
      disabled: true,
      badge: 'todo',
    },
    {
      title: 'Customize',
      url: '#',
      icon: <BoxIcon />,
    },
  ],
}

const fadeLabelClass =
  'opacity-100 transition-opacity duration-200 ease-out group-data-[collapsible=icon]:opacity-0'

export function AppSidebar({
  chatThreads,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  chatThreads: ChatThreadsController
}) {
  const { isMobile } = useSidebar()
  const [isContentScrolled, setIsContentScrolled] = React.useState(false)
  const {
    archivedThreads,
    isLoadingThreads,
    pinnedThreads,
    recentThreads,
    startNewChat,
  } = chatThreads

  const handleContentScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setIsContentScrolled(event.currentTarget.scrollTop > 0)
    },
    []
  )

  return (
    <Sidebar collapsible="icon" className="select-none" {...props}>
      <SidebarHeader>
        <div className="px-2">
          <div
            className={`font-heading text-xl font-semibold text-sidebar-accent-foreground ${fadeLabelClass} whitespace-nowrap`}
          >
            Charle's Agent
          </div>
        </div>
        <SidebarMenu>
          {data.topNav.map(item => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton
                asChild={item.title !== 'New chat'}
                tooltip={
                  item.shortcut
                    ? {
                        children: (
                          <>
                            <span>{item.title}</span>
                            <span
                              data-slot="kbd"
                              className="text-background/70"
                            >
                              {item.shortcut}
                            </span>
                          </>
                        ),
                      }
                    : item.title
                }
                onClick={item.title === 'New chat' ? startNewChat : undefined}
              >
                {item.title === 'New chat' ? (
                  <>
                    {item.icon}
                    <span>{item.title}</span>
                  </>
                ) : (
                  <a href={item.url}>
                    {item.icon}
                    <span>{item.title}</span>
                    {item.shortcut ? (
                      <kbd className="ml-auto hidden shrink-0 text-xs text-sidebar-foreground/70 group-hover/menu-button:inline group-focus-visible/menu-button:inline group-data-[collapsible=icon]:hidden">
                        {item.shortcut}
                      </kbd>
                    ) : null}
                  </a>
                )}
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarHeader>

      <div className="relative flex min-h-0 flex-1 flex-col">
        <div
          className={`pointer-events-none absolute inset-x-0 top-0 z-10 h-px bg-sidebar-border transition-opacity duration-150 ease-out ${
            isContentScrolled ? 'opacity-100' : 'opacity-0'
          }`}
        />
        <SidebarContent onScroll={handleContentScroll}>
          <SidebarGroup>
            <SidebarMenu>
              {data.mainNav.map(item => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild={!item.disabled}
                    tooltip={item.title}
                    aria-disabled={item.disabled}
                  >
                    {item.disabled ? (
                      <>
                        {item.icon}
                        <span>{item.title}</span>
                      </>
                    ) : (
                      <a href={item.url}>
                        {item.icon}
                        <span>{item.title}</span>
                      </a>
                    )}
                  </SidebarMenuButton>
                  {item.badge ? (
                    <SidebarMenuBadge className="rounded-full border bg-sidebar px-2 text-sidebar-primary">
                      {item.badge}
                    </SidebarMenuBadge>
                  ) : null}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>

          <SidebarGroup
            className={`group-data-[collapsible=icon]:pointer-events-none ${fadeLabelClass}`}
          >
            <ThreadGroup
              chatThreads={chatThreads}
              emptyLabel={isLoadingThreads ? 'Loading...' : 'No pinned chats'}
              isMobile={isMobile}
              label="Pinned"
              threads={pinnedThreads}
            />
            <ThreadGroup
              chatThreads={chatThreads}
              emptyLabel={isLoadingThreads ? 'Loading...' : 'No recent chats'}
              isMobile={isMobile}
              label="Recents"
              threads={recentThreads}
            />
            {archivedThreads.length > 0 ? (
              <ThreadGroup
                chatThreads={chatThreads}
                emptyLabel=""
                isMobile={isMobile}
                label="Archived"
                threads={archivedThreads}
              />
            ) : null}
          </SidebarGroup>
        </SidebarContent>
      </div>

      <SidebarFooter className="border-t border-sidebar-border p-0 group-data-[collapsible=icon]:border-t-0">
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
      <SidebarTrigger className="absolute top-2 right-2" />
    </Sidebar>
  )
}

function ThreadGroup({
  chatThreads,
  emptyLabel,
  isMobile,
  label,
  threads,
}: {
  chatThreads: ChatThreadsController
  emptyLabel: string
  isMobile: boolean
  label: string
  threads: ChatThread[]
}) {
  return (
    <>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {threads.length > 0 ? (
          threads.map(thread => (
            <ThreadItem
              chatThreads={chatThreads}
              isMobile={isMobile}
              key={thread.id}
              thread={thread}
            />
          ))
        ) : emptyLabel ? (
          <SidebarMenuItem>
            <div className="px-2 py-1.5 text-xs text-sidebar-foreground/50">
              {emptyLabel}
            </div>
          </SidebarMenuItem>
        ) : null}
      </SidebarMenu>
    </>
  )
}

function ThreadItem({
  chatThreads,
  isMobile,
  thread,
}: {
  chatThreads: ChatThreadsController
  isMobile: boolean
  thread: ChatThread
}) {
  const renameThread = React.useCallback(async () => {
    const title = window.prompt('Rename chat', thread.title)?.trim()
    if (!title || title === thread.title) return

    await chatThreads.renameThread(thread, title)
  }, [chatThreads, thread])

  const deleteThread = React.useCallback(async () => {
    const confirmed = window.confirm(`Delete "${thread.title}"?`)
    if (!confirmed) return

    await chatThreads.deleteThread(thread)
  }, [chatThreads, thread])

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={thread.id === chatThreads.activeThreadId}
          title={thread.title}
          tooltip={thread.title}
          type="button"
          onClick={() => chatThreads.selectThread(thread.id)}
        >
          <span>{thread.title}</span>
        </SidebarMenuButton>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction showOnHover>
            <MoreVertical />
            <span className="sr-only">Open chat menu</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side={isMobile ? 'bottom' : 'right'}
          align={isMobile ? 'end' : 'start'}
          className="min-w-44 rounded-lg"
        >
          <DropdownMenuGroup>
            <DropdownMenuItem onSelect={() => chatThreads.togglePin(thread)}>
              <PinIcon />
              {thread.pinned ? 'Unpin' : 'Pin'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={renameThread}>
              <PencilIcon />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => chatThreads.toggleArchive(thread)}
            >
              <ArchiveIcon />
              {thread.archived ? 'Unarchive' : 'Archive'}
            </DropdownMenuItem>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuItem variant="destructive" onSelect={deleteThread}>
              <TrashIcon />
              Delete
            </DropdownMenuItem>
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </SidebarMenuItem>
    </DropdownMenu>
  )
}
