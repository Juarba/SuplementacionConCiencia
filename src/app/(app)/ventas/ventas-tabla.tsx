'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ExternalLink, FileText } from 'lucide-react'
import { anular, arcaFacturar, arcaReceptor } from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { Campo, NativeSelect, Pill } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaCorta, money, norm, numf, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { CONDICIONES_IVA, DOC_TIPOS, TIPOS_CBTE, TIPOS_FACTURA, nombreCbte, numeroCbte, type Receptor } from '@/lib/arca-datos'
import type { ComprobanteResumen, Venta } from '@/lib/types'

/** Factura vigente de la venta en el entorno actual (la última que no fue anulada con nota de crédito) */
function facturaVigente(cs: ComprobanteResumen[], produccion: boolean) {
  const del = cs.filter(c => c.estado === 'autorizado' && c.produccion === produccion)
  const facturas = del.filter(c => TIPOS_FACTURA.includes(c.tipo)), ncs = del.filter(c => TIPOS_CBTE[c.tipo]?.nc)
  return facturas.length > ncs.length ? facturas[facturas.length - 1] : null
}

export function VentasTabla({ ventas, desde, hasta, arca, produccion }: { ventas: Venta[]; desde: string; hasta: string; arca: boolean; produccion: boolean }) {
  const router = useRouter()
  const [buscar, setBuscar] = useState('')
  const [abiertaId, setAbiertaId] = useState<number | null>(null)
  const abierta = ventas.find(v => v.id === abiertaId) ?? null // se recalcula al refrescar (ej. después de facturar)
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
              <TableRow key={v.id} className={cn('cursor-pointer', v.anulada && 'line-through opacity-50')} onClick={() => setAbiertaId(v.id)}>
                <TableCell className="text-muted-foreground">{v.id}</TableCell>
                <TableCell>{fechaCorta(v.fecha)}</TableCell>
                <TableCell>{v.cliente_nombre || '—'}</TableCell>
                <TableCell className="text-xs whitespace-normal">{v.items.map(i => <div key={i.id}>{numf(i.cantidad)}× {i.descripcion}</div>)}</TableCell>
                <TableCell>{v.medio_pago}</TableCell>
                <TableCell className="space-x-1">
                  {v.origen === 'tiendanube' ? <Pill tono="ok">Tienda Nube</Pill> : <Pill>Local</Pill>}
                  {(() => { const f = facturaVigente(v.comprobantes, produccion); return f && <Pill tono="ok" title={numeroCbte(f.punto_venta, f.numero)}>Fact. {TIPOS_CBTE[f.tipo].letra}</Pill> })()}
                </TableCell>
                <TableCell className="text-right tabular-nums">{money(v.total)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', signo(v.total - v.costo - v.recargo))}>{money(v.total - v.costo - v.recargo)}</TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={8} className="py-10 text-center text-muted-foreground">No hay ventas en este período</TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <DetalleVenta venta={abierta} onClose={() => setAbiertaId(null)} arca={arca} produccion={produccion} />
    </>
  )
}

function DetalleVenta({ venta: v, onClose, arca, produccion }: { venta: Venta | null; onClose: () => void; arca: boolean; produccion: boolean }) {
  const { pending, run } = useAccion()
  const factura = v ? facturaVigente(v.comprobantes, produccion) : null
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
          {(arca || v.comprobantes.length > 0) && <Facturacion key={v.id} venta={v} arca={arca} factura={factura} />}
          <DialogFooter>
            {!v.anulada && (
              <Confirmar titulo="¿Anular la venta?" accion="Anular"
                descripcion={(factura ? `Se emite en ARCA una nota de crédito que anula la ${nombreCbte(factura.tipo)} ${numeroCbte(factura.punto_venta, factura.numero)}. ` : '') + 'Se devuelve el stock y se quita de la cuenta corriente.'}
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

function Facturacion({ venta: v, arca, factura }: { venta: Venta; arca: boolean; factura: ComprobanteResumen | null }) {
  const { pending, run } = useAccion()
  const [rec, setRec] = useState<Receptor | null>(null)
  const set = (k: keyof Receptor) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    rec && setRec({ ...rec, [k]: ['doc_tipo', 'condicion_iva'].includes(k) ? Number(e.target.value) : e.target.value })
  const autorizados = v.comprobantes.filter(c => c.estado === 'autorizado')
  return (
    <div className="grid gap-2 rounded-lg border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2 font-medium"><FileText className="size-4" /> Factura electrónica</div>
      {autorizados.map(c => (
        <div key={c.id} className="flex flex-wrap items-center gap-2">
          <span>{nombreCbte(c.tipo)} {numeroCbte(c.punto_venta, c.numero)}</span>
          <span className="font-mono text-xs text-muted-foreground">CAE {c.cae}</span>
          {!c.produccion && <Pill>prueba</Pill>}
          <Button size="sm" variant="ghost" asChild><a href={`/comprobante/${c.id}`} target="_blank" rel="noreferrer"><ExternalLink /> Ver / imprimir</a></Button>
        </div>
      ))}
      {v.comprobantes.some(c => c.estado === 'pendiente') && <div className="text-amber-700 dark:text-amber-400">Hay un comprobante pendiente de confirmar con ARCA: se verifica solo al volver a facturar.</div>}
      {arca && !factura && !v.anulada && (!rec ? (
        <Button className="justify-self-start" disabled={pending} onClick={async () => setRec(await arcaReceptor(v.id))}>Facturar en ARCA</Button>
      ) : (
        <form className="grid gap-2" onSubmit={e => { e.preventDefault(); run(() => arcaFacturar(v.id, rec), { ok: () => setRec(null) }) }}>
          <div className="grid gap-2 sm:grid-cols-2">
            <Campo label="Condición frente al IVA">
              <NativeSelect value={rec.condicion_iva} onChange={set('condicion_iva')}>{CONDICIONES_IVA.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}</NativeSelect>
            </Campo>
            <div className="grid grid-cols-[auto_1fr] gap-2">
              <Campo label="Documento">
                <NativeSelect value={rec.doc_tipo} onChange={set('doc_tipo')}>{DOC_TIPOS.map(d => <option key={d.id} value={d.id}>{d.nombre}</option>)}</NativeSelect>
              </Campo>
              <Campo label="Número"><Input inputMode="numeric" disabled={rec.doc_tipo === 99} value={rec.doc_tipo === 99 ? '' : rec.doc_nro} onChange={set('doc_nro')} /></Campo>
            </div>
            <Campo label="Nombre / razón social"><Input value={rec.nombre ?? ''} onChange={set('nombre')} placeholder="Consumidor final" /></Campo>
            <Campo label="Domicilio"><Input value={rec.domicilio ?? ''} onChange={set('domicilio')} /></Campo>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={pending}>{pending ? 'Pidiendo CAE…' : `Emitir por ${money(v.total)}`}</Button>
            <Button type="button" variant="ghost" onClick={() => setRec(null)}>Cancelar</Button>
          </div>
        </form>
      ))}
    </div>
  )
}
