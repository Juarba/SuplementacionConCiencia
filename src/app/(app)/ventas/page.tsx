import type { Metadata } from 'next'
import Link from 'next/link'
import { FileText, Plus } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { arcaLista } from '@/lib/arca'
import { getConfig, getVentas } from '@/lib/queries'
import { NEGOCIO } from '@/negocio'
import { hoyLocal, mesLocal, money } from '@/lib/format'
import { VentasTabla } from './ventas-tabla'

export const metadata: Metadata = { title: 'Ventas' }

export default async function Ventas({ searchParams }: PageProps<'/ventas'>) {
  const q = await searchParams
  const desde = typeof q.desde === 'string' ? q.desde : mesLocal() + '-01'
  const hasta = typeof q.hasta === 'string' ? q.hasta : hoyLocal()
  const [ventas, cfg] = await Promise.all([getVentas(desde, hasta), getConfig()])
  const validas = ventas.filter(v => !v.anulada)
  const total = validas.reduce((a, v) => a + v.total, 0)
  const gan = validas.reduce((a, v) => a + v.total - v.costo - v.recargo, 0)
  return (
    <>
      <PageHeader title="Ventas" description={`${validas.length} ventas · ${money(total)} · ganancia ${money(gan)}`}>
        {NEGOCIO.modulos.facturacion && <Button variant="outline" asChild><Link href="/ventas/arca"><FileText /> Facturar ARCA</Link></Button>}
        <Button asChild><Link href="/venta"><Plus /> Nueva venta</Link></Button>
      </PageHeader>
      <VentasTabla ventas={ventas} desde={desde} hasta={hasta} arca={NEGOCIO.modulos.facturacion && arcaLista(cfg)} produccion={cfg.arca_produccion === '1'} />
    </>
  )
}
