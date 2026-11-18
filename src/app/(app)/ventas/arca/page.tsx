import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { arcaLista } from '@/lib/arca'
import { getComprobantes, getConfig, getVentasSinFacturar } from '@/lib/queries'
import { hoyLocal } from '@/lib/format'
import { NEGOCIO } from '@/negocio'
import { FacturarVista } from './facturar-vista'

export const metadata: Metadata = { title: 'Facturar ARCA' }

// Pantalla para el día a día: solo facturar y ver comprobantes.
// La configuración técnica (certificado, clave, punto de venta) está aparte en /ventas/arca/configurar.
export default async function FacturarArca({ searchParams }: PageProps<'/ventas/arca'>) {
  if (!NEGOCIO.modulos.facturacion) notFound()
  const q = await searchParams
  const hace30 = new Date(Date.parse(hoyLocal() + 'T12:00:00Z') - 30 * 86400e3).toISOString().slice(0, 10)
  const desde = typeof q.desde === 'string' ? q.desde : hace30
  const cfg = await getConfig()
  const produccion = cfg.arca_produccion === '1'
  const [ventas, comprobantes] = await Promise.all([getVentasSinFacturar(desde, produccion), getComprobantes(50)])
  return <FacturarVista lista={arcaLista(cfg)} produccion={produccion} desde={desde} ventas={ventas} comprobantes={comprobantes} />
}
