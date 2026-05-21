import {
  ArchiveIcon,
  BoxIcon,
  Code2Icon,
  MoreVertical,
  PencilIcon,
  PinIcon,
  PinOffIcon,
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
    email: 'neko@windland',
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
      title: 'Provider',
      url: '#',
      icon: <BoxIcon />,
      disabled: true,
      badge: 'todo',
    },
  ],
}

const fadeLabelClass =
  'opacity-100 transition-opacity duration-200 ease-out group-data-[collapsible=icon]:opacity-0'

export function AppSidebar({
  controller,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  controller: ChatThreadsController
}) {
  const { isMobile, open, openMobile, setOpenMobile } = useSidebar()
  const [isContentScrolled, setIsContentScrolled] = React.useState(false)
  const { archivedThreads, isLoadingThreads, visibleThreads, startNewChat } =
    controller

  const contentRef = React.useRef<HTMLDivElement>(null)
  const wasOpenRef = React.useRef(open)

  React.useEffect(() => {
    if (wasOpenRef.current && !open)
      contentRef.current?.scrollTo({ top: 0, behavior: 'smooth' })

    wasOpenRef.current = open
  }, [open])

  const handleContentScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement>) => {
      setIsContentScrolled(event.currentTarget.scrollTop > 0)
    },
    []
  )

  const handleStartNewChat = React.useCallback(() => {
    startNewChat()
    if (isMobile) setOpenMobile(false)
  }, [isMobile, setOpenMobile, startNewChat])

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
                onClick={
                  item.title === 'New chat' ? handleStartNewChat : undefined
                }
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
            isContentScrolled && (open || openMobile)
              ? 'opacity-100'
              : 'opacity-0'
          }`}
        />
        <SidebarContent
          ref={contentRef}
          onScroll={handleContentScroll}
          className="overflow-x-hidden"
        >
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
              controller={controller}
              emptyLabel={isLoadingThreads ? 'Loading...' : 'No recent chats'}
              isMobile={isMobile}
              label="Recents"
              setOpenMobile={setOpenMobile}
              threads={visibleThreads}
            />
            {archivedThreads.length > 0 ? (
              <ThreadGroup
                controller={controller}
                emptyLabel=""
                isMobile={isMobile}
                label="Archived"
                setOpenMobile={setOpenMobile}
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
      {!isMobile && <SidebarTrigger className="absolute top-2 right-2" />}
    </Sidebar>
  )
}

function ThreadGroup({
  controller,
  emptyLabel,
  isMobile,
  label,
  setOpenMobile,
  threads,
}: {
  controller: ChatThreadsController
  emptyLabel: string
  isMobile: boolean
  label: string
  setOpenMobile: (open: boolean) => void
  threads: ChatThread[]
}) {
  return (
    <>
      <SidebarGroupLabel>{label}</SidebarGroupLabel>
      <SidebarMenu>
        {threads.length > 0 ? (
          threads.map(thread => (
            <ThreadItem
              controller={controller}
              isMobile={isMobile}
              key={thread.id}
              setOpenMobile={setOpenMobile}
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
  controller,
  isMobile,
  setOpenMobile,
  thread,
}: {
  controller: ChatThreadsController
  isMobile: boolean
  setOpenMobile: (open: boolean) => void
  thread: ChatThread
}) {
  const selectThread = React.useCallback(() => {
    controller.activateThread(thread.id)
    if (isMobile) setOpenMobile(false)
  }, [controller, isMobile, setOpenMobile, thread.id])

  const renameThread = React.useCallback(async () => {
    const title = window.prompt('Rename chat', thread.title)?.trim()
    if (!title || title === thread.title) return

    await controller.updateThread(thread, { title })
  }, [controller, thread])

  const deleteThread = React.useCallback(async () => {
    const confirmed = window.confirm(`Delete "${thread.title}"?`)
    if (!confirmed) return

    await controller.deleteThread(thread)
  }, [controller, thread])

  const menuTrigger = thread.pinned ? (
    <SidebarMenuAction
      aria-label="Unpin"
      className="group/unpin-action"
      title="Unpin"
      onClick={() =>
        controller.updateThread(thread, { pinned: !thread.pinned })
      }
    >
      <span className="relative size-4">
        <PinIcon className="absolute inset-0 size-4 opacity-100 transition-opacity group-hover/unpin-action:opacity-0 group-focus-visible/unpin-action:opacity-0" />
        <PinOffIcon className="absolute inset-0 size-4 opacity-0 transition-opacity group-hover/unpin-action:opacity-100 group-focus-visible/unpin-action:opacity-100" />
      </span>
      <span className="sr-only">Unpin</span>
    </SidebarMenuAction>
  ) : (
    <>
      <DropdownMenuTrigger asChild>
        <SidebarMenuAction showOnHover>
          <MoreVertical />
          <span className="sr-only">Open menu</span>
        </SidebarMenuAction>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        side={isMobile ? 'bottom' : 'right'}
        align={isMobile ? 'end' : 'start'}
        className="min-w-44 rounded-lg"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            onSelect={() =>
              controller.updateThread(thread, { pinned: !thread.pinned })
            }
          >
            <PinIcon />
            Pin
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={renameThread}>
            <PencilIcon />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onSelect={() =>
              controller.updateThread(thread, { archived: !thread.archived })
            }
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
    </>
  )

  return (
    <DropdownMenu>
      <SidebarMenuItem>
        <SidebarMenuButton
          isActive={thread.id === controller.activeThreadId}
          title={thread.title}
          tooltip={thread.title}
          type="button"
          onClick={selectThread}
        >
          <span>{thread.title}</span>
        </SidebarMenuButton>
        {menuTrigger}
      </SidebarMenuItem>
    </DropdownMenu>
  )
}
