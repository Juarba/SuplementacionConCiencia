import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { getConfigPublica, getProductos } from '@/lib/queries'
import { TiendaNubeVista } from './tiendanube-vista'

export const metadata: Metadata = { title: 'Tienda Nube' }

export default async function TiendaNube({ searchParams }: PageProps<'/tiendanube'>) {
  const [q, cfg, productos, h] = await Promise.all([searchParams, getConfigPublica(), getProductos(), headers()])
  const host = h.get('x-forwarded-host') || h.get('host') || 'localhost:3000'
  const proto = h.get('x-forwarded-proto') || (host.startsWith('localhost') ? 'http' : 'https')
  return (
    <TiendaNubeVista
      cfg={cfg}
      productos={productos.filter(p => p.activo)}
      callbackUrl={`${proto}://${host}/api/tn/callback`}
      conectado={q.conectado === '1'}
      error={typeof q.error === 'string' ? q.error : undefined}
    />
  )
}
