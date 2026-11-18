import type { Metadata } from 'next'
import { PageHeader } from '@/components/common'
import { parseMedios } from '@/lib/format'
import { arcaLista } from '@/lib/arca'
import { getClientes, getConfig, getProductos } from '@/lib/queries'
import { NEGOCIO } from '@/negocio'
import { VentaForm } from './venta-form'

export const metadata: Metadata = { title: 'Nueva venta' }

export default async function NuevaVenta() {
  const [productos, clientes, cfg] = await Promise.all([getProductos(), getClientes(), getConfig()])
  return (
    <>
      <PageHeader title="Nueva venta" description="Buscá productos, elegí cliente y medio de pago." />
      <VentaForm
        productos={productos.filter(p => p.activo)}
        clientes={clientes}
        medios={parseMedios(cfg.medios_pago)}
        arca={NEGOCIO.modulos.facturacion && arcaLista(cfg)}
      />
    </>
  )
}
