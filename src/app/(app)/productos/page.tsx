import type { Metadata } from 'next'
import { parseMedios } from '@/lib/format'
import { getConfig, getProductos } from '@/lib/queries'
import { ProductosVista } from './productos-vista'

export const metadata: Metadata = { title: 'Productos y stock' }

export default async function Productos({ searchParams }: PageProps<'/productos'>) {
  const [q, productos, cfg] = await Promise.all([searchParams, getProductos(), getConfig()])
  return <ProductosVista productos={productos} descuentoRev={cfg.descuento_revendedor} medios={parseMedios(cfg.medios_pago).map(m => m.nombre)} abrirPedido={q.pedido === '1'} />
}
