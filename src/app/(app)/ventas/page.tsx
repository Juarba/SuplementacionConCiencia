import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { getVentas } from '@/lib/queries'
import { hoyLocal, mesLocal, money } from '@/lib/format'
import { VentasTabla } from './ventas-tabla'

export const metadata: Metadata = { title: 'Ventas' }

export default async function Ventas({ searchParams }: PageProps<'/ventas'>) {
  const q = await searchParams
  const desde = typeof q.desde === 'string' ? q.desde : mesLocal() + '-01'
  const hasta = typeof q.hasta === 'string' ? q.hasta : hoyLocal()
  const ventas = await getVentas(desde, hasta)
  const validas = ventas.filter(v => !v.anulada)
  const total = validas.reduce((a, v) => a + v.total, 0)
  const gan = validas.reduce((a, v) => a + v.total - v.costo - v.recargo, 0)
  return (
    <>
      <PageHeader title="Ventas" description={`${validas.length} ventas · ${money(total)} · ganancia ${money(gan)}`}>
        <Button asChild><Link href="/venta"><Plus /> Nueva venta</Link></Button>
      </PageHeader>
      <VentasTabla ventas={ventas} desde={desde} hasta={hasta} />
    </>
  )
}
