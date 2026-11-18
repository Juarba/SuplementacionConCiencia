'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ExternalLink, FileText, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
import { arcaFacturar, arcaVerificarPendientes } from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { nombreCbte, numeroCbte } from '@/lib/arca-datos'
import { fechaCorta, money } from '@/lib/format'
import type { Comprobante, Venta } from '@/lib/types'

type VentaSinFactura = Pick<Venta, 'id' | 'fecha' | 'cliente_nombre' | 'medio_pago' | 'total'>

export function FacturarVista({ lista, produccion, desde, ventas, comprobantes }: {
  lista: boolean; produccion: boolean; desde: string; ventas: VentaSinFactura[]; comprobantes: Comprobante[]
}) {
  const router = useRouter()
  const { pending, run } = useAccion()
  const [enCurso, setEnCurso] = useState<number | null>(null)
  const pendientes = comprobantes.some(c => c.estado === 'pendiente')

  return (
    <>
      <PageHeader title="Facturar ARCA" description={
        lista ? (produccion ? <Pill tono="ok">Facturación activa</Pill> : <Pill tono="warn">Modo prueba: las facturas no tienen validez fiscal</Pill>)
          : <Pill tono="warn">Facturación no disponible</Pill>
      }>
        <Button variant="outline" asChild><Link href="/ventas"><ArrowLeft /> Volver a ventas</Link></Button>
      </PageHeader>

      {!lista ? (
        <Card><CardContent><Vacio>La facturación electrónica todavía no está configurada. Consultá con quien te instaló el sistema.</Vacio></CardContent></Card>
      ) : <>
        <Card className="mb-4">
          <CardHeader>
            <CardTitle>Ventas sin facturar</CardTitle>
            <CardDescription>Se factura a nombre del cliente de la venta (con su CUIT/DNI si lo tiene cargado) o a consumidor final. Para otros datos, abrí la venta en Ventas.</CardDescription>
            <CardAction><Campo label="Desde"><Input type="date" value={desde} onChange={e => router.push(`/ventas/arca?desde=${e.target.value}`)} /></Campo></CardAction>
          </CardHeader>
          <CardContent>
            {!ventas.length ? <Vacio>No hay ventas sin facturar en este período 🎉</Vacio> : (
              <Table>
                <TableHeader><TableRow><TableHead>#</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Pago</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {ventas.map(v => (
                    <TableRow key={v.id}>
                      <TableCell className="text-muted-foreground">{v.id}</TableCell>
                      <TableCell>{fechaCorta(v.fecha)}</TableCell>
                      <TableCell>{v.cliente_nombre || 'Consumidor final'}</TableCell>
                      <TableCell>{v.medio_pago}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(v.total)}</TableCell>
                      <TableCell className="text-right">
                        <Button size="sm" disabled={pending} onClick={() => {
                          setEnCurso(v.id)
                          run(() => arcaFacturar(v.id), { ok: c => { setEnCurso(null); if (c) toast.success(`${nombreCbte(c.tipo)} ${numeroCbte(c.punto_venta, c.numero)} emitida`, { action: { label: 'Ver', onClick: () => window.open(`/comprobante/${c.id}`, '_blank') } }) } })
                        }}><FileText /> {pending && enCurso === v.id ? 'Pidiendo CAE…' : 'Facturar'}</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Comprobantes emitidos</CardTitle>
            {pendientes && (
              <CardAction>
                <Button variant="outline" disabled={pending} onClick={() => run(arcaVerificarPendientes, { ok: r => r && toast.success(`${r.autorizados} de ${r.revisados} pendientes estaban autorizados`) })}><RefreshCw /> Verificar pendientes</Button>
              </CardAction>
            )}
          </CardHeader>
          <CardContent>
            {!comprobantes.length ? <Vacio>Todavía no se emitió ningún comprobante.</Vacio> : (
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Comprobante</TableHead><TableHead>Cliente</TableHead><TableHead>Venta</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {comprobantes.map(c => (
                    <TableRow key={c.id}>
                      <TableCell>{fechaCorta(c.fecha)}</TableCell>
                      <TableCell>
                        {nombreCbte(c.tipo)} {numeroCbte(c.punto_venta, c.numero)}{' '}
                        {!c.produccion && <Pill>prueba</Pill>} {c.estado === 'pendiente' && <Pill tono="warn">pendiente</Pill>}
                      </TableCell>
                      <TableCell className="whitespace-normal">{c.receptor_nombre || 'Consumidor final'}</TableCell>
                      <TableCell>{c.venta_id ? `#${c.venta_id}` : '—'}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(c.total)}</TableCell>
                      <TableCell className="text-right">{c.estado === 'autorizado' && <Button size="sm" variant="ghost" asChild><a href={`/comprobante/${c.id}`} target="_blank" rel="noreferrer"><ExternalLink /> Ver / imprimir</a></Button>}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </>}
    </>
  )
}
