import { AppMain } from '@/components/app-main.tsx'
import { AppSidebar } from '@/components/app-sidebar.tsx'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { SidebarProvider } from '@/components/ui/sidebar.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'

export function App() {
  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar />
          <AppMain />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
