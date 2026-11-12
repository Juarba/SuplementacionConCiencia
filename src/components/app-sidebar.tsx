'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useTema } from '@/components/tema'
import {
  Calculator, ChartColumn, House, LogOut, Moon, Package, Plug, Plus, Receipt, Settings, Store, Sun, Users, Wallet,
} from 'lucide-react'
import { logout } from '@/app/actions'
import { NEGOCIO } from '@/negocio'
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarRail, useSidebar,
} from '@/components/ui/sidebar'

const grupos = [
  { label: 'Operación', items: [
    { href: '/', label: 'Inicio', icon: House },
    { href: '/venta', label: 'Nueva venta', icon: Plus },
    { href: '/ventas', label: 'Ventas', icon: Receipt },
    { href: '/caja', label: 'Cierre de caja', icon: Calculator, activo: NEGOCIO.modulos.caja },
  ] },
  { label: 'Gestión', items: [
    { href: '/productos', label: 'Productos y stock', icon: Package },
    { href: '/clientes', label: 'Clientes / Cta. cte.', icon: Users },
    { href: '/revendedores', label: NEGOCIO.textos.mayoristas, icon: Store, activo: NEGOCIO.modulos.mayoristas },
    { href: '/gastos', label: 'Gastos', icon: Wallet },
    { href: '/reportes', label: 'Reportes y ganancias', icon: ChartColumn },
  ] },
  { label: 'Ajustes', items: [
    { href: '/tiendanube', label: 'Tienda Nube', icon: Plug, activo: NEGOCIO.modulos.tiendanube },
    { href: '/config', label: 'Configuración', icon: Settings },
  ] },
]

export function AppSidebar({ negocio }: { negocio: string }) {
  const path = usePathname()
  const { oscuro, alternar } = useTema()
  const { setOpenMobile } = useSidebar()
  const activo = (href: string) => (href === '/' ? path === '/' : path === href || path.startsWith(href + '/'))
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link href="/" onClick={() => setOpenMobile(false)}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary font-bold text-sidebar-primary-foreground">{negocio.charAt(0).toUpperCase()}</div>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-semibold">{negocio}</span>
                  <span className="truncate text-xs text-muted-foreground">Gestión</span>
                </div>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {grupos.map(g => (
          <SidebarGroup key={g.label}>
            <SidebarGroupLabel>{g.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {g.items.filter(it => it.activo !== false).map(it => (
                  <SidebarMenuItem key={it.href}>
                    <SidebarMenuButton asChild isActive={activo(it.href)} tooltip={it.label}>
                      <Link href={it.href} onClick={() => setOpenMobile(false)}>
                        <it.icon />
                        <span>{it.label}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Cambiar tema" onClick={alternar}>
              {oscuro ? <Sun /> : <Moon />}
              <span>{oscuro ? 'Modo claro' : 'Modo oscuro'}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton tooltip="Salir" onClick={() => logout()}>
              <LogOut />
              <span>Salir</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
