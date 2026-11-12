'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { anular } from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { Campo, Pill } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaCorta, money, norm, numf, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Venta } from '@/lib/types'

export function VentasTabla({ ventas, desde, hasta }: { ventas: Venta[]; desde: string; hasta: string }) {
  const router = useRouter()
  const [buscar, setBuscar] = useState('')
  const [abierta, setAbierta] = useState<Venta | null>(null)
  const ir = (d: string, h: string) => router.push(`/ventas?desde=${d}&hasta=${h}`)
  const t = norm(buscar)
  const lista = t ? ventas.filter(v => norm(`${v.cliente_nombre} ${v.items.map(i => i.descripcion).join(' ')} ${v.notas} ${v.id}`).includes(t)) : ventas

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <Campo label="Desde"><Input type="date" value={desde} onChange={e => ir(e.target.value, hasta)} /></Campo>
        <Campo label="Hasta"><Input type="date" value={hasta} onChange={e => ir(desde, e.target.value)} /></Campo>
        <Campo label="Buscar" className="min-w-56 flex-1"><Input value={buscar} onChange={e => setBuscar(e.target.value)} placeholder="Cliente, producto, nº…" /></Campo>
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead><TableHead>Fecha</TableHead><TableHead>Cliente</TableHead><TableHead>Productos</TableHead>
              <TableHead>Pago</TableHead><TableHead>Origen</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Ganancia</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length ? lista.map(v => (
              <TableRow key={v.id} className={cn('cursor-pointer', v.anulada && 'line-through opacity-50')} onClick={() => setAbierta(v)}>
                <TableCell className="text-muted-foreground">{v.id}</TableCell>
                <TableCell>{fechaCorta(v.fecha)}</TableCell>
                <TableCell>{v.cliente_nombre || '—'}</TableCell>
                <TableCell className="text-xs whitespace-normal">{v.items.map(i => <div key={i.id}>{numf(i.cantidad)}× {i.descripcion}</div>)}</TableCell>
                <TableCell>{v.medio_pago}</TableCell>
                <TableCell>{v.origen === 'tiendanube' ? <Pill tono="ok">Tienda Nube</Pill> : <Pill>Local</Pill>}</TableCell>
                <TableCell className="text-right tabular-nums">{money(v.total)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', signo(v.total - v.costo - v.recargo))}>{money(v.total - v.costo - v.recargo)}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No hay ventas en este período</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <DetalleVenta venta={abierta} onClose={() => setAbierta(null)} />
    </>
  )
}

function DetalleVenta({ venta: v, onClose }: { venta: Venta | null; onClose: () => void }) {
  const { pending, run } = useAccion()
  return (
    <Dialog open={!!v} onOpenChange={o => !o && onClose()}>
      <DialogContent className="sm:max-w-2xl">
        {v && <>
          <DialogHeader>
            <DialogTitle>Venta #{v.id} {v.anulada && <Pill tono="bad">ANULADA</Pill>}</DialogTitle>
            <DialogDescription>{fechaCorta(v.fecha)} · {v.cliente_nombre || 'Consumidor final'} · {v.medio_pago}{v.entrega ? ` · ${v.entrega}` : ''}</DialogDescription>
          </DialogHeader>
          <Table>
            <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Cant.</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
            <TableBody>
              {v.items.map(i => (
                <TableRow key={i.id}>
                  <TableCell className="whitespace-normal">{i.descripcion}</TableCell><TableCell className="text-right">{numf(i.cantidad)}</TableCell>
                  <TableCell className="text-right">{money(i.precio)}</TableCell><TableCell className="text-right text-muted-foreground">{money(i.costo)}</TableCell>
                  <TableCell className="text-right">{money(i.cantidad * i.precio)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <div className="ml-auto grid w-64 gap-1 text-sm">
            {!!v.descuento && <div className="flex justify-between"><span>Descuento</span><span>− {money(v.descuento)}</span></div>}
            {!!v.recargo && <div className="flex justify-between"><span>Recargo</span><span>{money(v.recargo)}</span></div>}
            {!!v.envio && <div className="flex justify-between"><span>Envío</span><span>{money(v.envio)}</span></div>}
            <div className="flex justify-between border-t pt-1 text-base font-semibold"><span>Total</span><span>{money(v.total)}</span></div>
            <div className="flex justify-between text-muted-foreground"><span>Ganancia</span><span>{money(v.total - v.costo - v.recargo)}</span></div>
          </div>
          {v.notas && <p className="text-sm text-muted-foreground">📝 {v.notas}</p>}
          <DialogFooter>
            {!v.anulada && (
              <Confirmar titulo="¿Anular la venta?" descripcion="Se devuelve el stock y se quita de la cuenta corriente." accion="Anular"
                onConfirm={() => run(() => anular(v.id), { ok: onClose })}>
                <Button variant="destructive" disabled={pending}>Anular venta</Button>
              </Confirmar>
            )}
            <Button variant="outline" onClick={onClose}>Cerrar</Button>
          </DialogFooter>
        </>}
      </DialogContent>
    </Dialog>
  )
}
