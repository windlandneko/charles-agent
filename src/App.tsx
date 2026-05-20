import { AppMain } from '@/components/app-main.tsx'
import { AppSidebar } from '@/components/app-sidebar.tsx'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { SidebarProvider } from '@/components/ui/sidebar.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { useChatThreads } from '@/hooks/use-chat-threads.ts'

export function App() {
  const chatThreads = useChatThreads()

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar chatThreads={chatThreads} />
          <AppMain chatThreads={chatThreads} />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
