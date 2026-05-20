'use client'

import {
  BoxIcon,
  Code2Icon,
  GitForkIcon,
  MoreVertical,
  PencilIcon,
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
  recents: [
    { title: 'Planning educational pursuits' },
    { title: 'Custom API integration with Claude' },
    { title: 'Introducing Claude' },
    { title: 'Brainfuck interpreter for ASCII output' },
    { title: 'Brainfuck interpreter for ASCII art output' },
    { title: 'Brainfuck interpreter for ASCII very very long art output' },
    { title: '设计模式练习与实现' },
    { title: '设计模式学习与实现' },
    { title: 'Creative projects' },
  ],
}

const fadeLabelClass =
  'opacity-100 transition-opacity duration-200 ease-out group-data-[collapsible=icon]:opacity-0'

export function AppSidebar({
  onNewChat,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  onNewChat: () => void
}) {
  const { isMobile } = useSidebar()
  const [isContentScrolled, setIsContentScrolled] = React.useState(false)

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
                onClick={item.title === 'New chat' ? onNewChat : undefined}
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
            <SidebarGroupLabel>Recents</SidebarGroupLabel>
            <SidebarMenu>
              {data.recents.map(item => (
                <DropdownMenu key={item.title}>
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <a href="#">
                        <span>{item.title}</span>
                      </a>
                    </SidebarMenuButton>
                    <DropdownMenuTrigger asChild>
                      <SidebarMenuAction showOnHover>
                        <MoreVertical />
                        <span className="sr-only">Open recent chat menu</span>
                      </SidebarMenuAction>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      side={isMobile ? 'bottom' : 'right'}
                      align={isMobile ? 'end' : 'start'}
                      className="min-w-56 rounded-lg"
                    >
                      <DropdownMenuGroup>
                        <DropdownMenuItem>
                          <GitForkIcon />
                          Fork
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <PencilIcon />
                          Rename
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                      <DropdownMenuSeparator />
                      <DropdownMenuGroup>
                        <DropdownMenuItem variant="destructive">
                          <TrashIcon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuGroup>
                    </DropdownMenuContent>
                  </SidebarMenuItem>
                </DropdownMenu>
              ))}
            </SidebarMenu>
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
