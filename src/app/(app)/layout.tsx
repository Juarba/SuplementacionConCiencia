export const dynamic = 'force-dynamic'

import { cookies } from 'next/headers'
import { AppSidebar } from '@/components/app-sidebar'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { requireSession } from '@/lib/auth'
import { getConfig } from '@/lib/queries'
import { NEGOCIO } from '@/negocio'

export default async function AppLayout({ children }: LayoutProps<'/'>) {
  await requireSession()
  const [cfg, c] = await Promise.all([getConfig(), cookies()])
  return (
    <SidebarProvider defaultOpen={c.get('sidebar_state')?.value !== 'false'}>
      <AppSidebar negocio={cfg.negocio || NEGOCIO.nombre} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-12 shrink-0 items-center gap-2 border-b bg-background/95 px-4 backdrop-blur print:hidden">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <span className="text-sm text-muted-foreground">{cfg.negocio || NEGOCIO.nombre}</span>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
