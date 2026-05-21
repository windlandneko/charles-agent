import { AppMain } from '@/components/app-main.tsx'
import { AppSidebar } from '@/components/app-sidebar.tsx'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { SidebarProvider } from '@/components/ui/sidebar.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'
import { useChatThreads } from '@/hooks/use-chat-threads.ts'

export function App() {
  const controller = useChatThreads()

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar controller={controller} />
          <AppMain controller={controller} />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
