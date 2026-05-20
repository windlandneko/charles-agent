import { useState } from 'react'

import { AppMain } from '@/components/app-main.tsx'
import { AppSidebar } from '@/components/app-sidebar.tsx'
import { ThemeProvider } from '@/components/theme-provider.tsx'
import { SidebarProvider } from '@/components/ui/sidebar.tsx'
import { TooltipProvider } from '@/components/ui/tooltip.tsx'

export function App() {
  const [chatResetKey, setChatResetKey] = useState(0)

  return (
    <ThemeProvider>
      <TooltipProvider>
        <SidebarProvider>
          <AppSidebar onNewChat={() => setChatResetKey(key => key + 1)} />
          <AppMain key={chatResetKey} />
        </SidebarProvider>
      </TooltipProvider>
    </ThemeProvider>
  )
}

export default App
