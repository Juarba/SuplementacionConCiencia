'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react'
import { borrarMovimiento, eliminarCliente, registrarMovimiento } from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { ClienteDialog } from '@/components/cliente-dialog'
import { Campo, Kpi, NativeSelect, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ahoraLocal, fechaCorta, money } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Cliente, Movimiento, Venta } from '@/lib/types'
import { NEGOCIO } from '@/negocio'

export function CuentaVista({ cliente: c, movimientos, ventas, medios }: { cliente: Cliente; movimientos: Movimiento[]; ventas: Venta[]; medios: string[] }) {
  const router = useRouter()
  const { run } = useAccion()
  const [editar, setEditar] = useState(false)
  const [mov, setMov] = useState<'pago' | 'cargo' | null>(null)
  const validas = ventas.filter(v => !v.anulada)
  return (
    <>
      <Link href="/clientes" className="mb-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" /> Clientes</Link>
      <PageHeader
        title={<span className="flex items-center gap-2">{c.nombre} {c.tipo === 'revendedor' && <Pill tono="ok">{NEGOCIO.textos.mayorista}</Pill>}</span>}
        description={[c.telefono, c.direccion, c.descuento != null ? `descuento especial ${c.descuento}%` : null].filter(Boolean).join(' · ')}
      >
        <Button variant="outline" onClick={() => setEditar(true)}><Pencil /> Editar</Button>
        <Button variant="outline" onClick={() => setMov('cargo')}><Plus /> Cargo manual</Button>
        <Button onClick={() => setMov('pago')}>Registrar pago</Button>
      </PageHeader>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Saldo" value={money(Math.abs(c.saldo))} hint={c.saldo > 0.5 ? 'te debe' : c.saldo < -0.5 ? 'a favor del cliente' : 'al día'}
          className={c.saldo > 0.5 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'} />
        <Kpi label="Compras" value={validas.length} hint={`total ${money(validas.reduce((a, v) => a + v.total, 0))}`} />
      </div>
      <div className="grid gap-4 lg:grid-cols-[3fr_2fr]">
        <Card>
          <CardHeader><CardTitle>Cuenta corriente</CardTitle></CardHeader>
          <CardContent>
            {movimientos.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Concepto</TableHead><TableHead className="text-right">Debe</TableHead><TableHead className="text-right">Haber</TableHead><TableHead className="text-right">Saldo</TableHead><TableHead /></TableRow></TableHeader>
                <TableBody>
                  {movimientos.map(m => (
                    <TableRow key={m.id}>
                      <TableCell>{fechaCorta(m.fecha)}</TableCell>
                      <TableCell className="whitespace-normal">{m.descripcion}{m.medio_pago && <span className="text-xs text-muted-foreground"> ({m.medio_pago})</span>}</TableCell>
                      <TableCell className="text-right tabular-nums">{m.tipo === 'cargo' ? money(m.monto) : ''}</TableCell>
                      <TableCell className="text-right text-emerald-600 tabular-nums">{m.tipo === 'pago' ? money(m.monto) : ''}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(m.saldo)}</TableCell>
                      <TableCell>
                        {!m.venta_id && (
                          <Confirmar titulo="¿Borrar movimiento?" accion="Borrar" onConfirm={() => run(() => borrarMovimiento(m.id))}>
                            <Button variant="ghost" size="icon-xs" aria-label="Borrar"><Trash2 /></Button>
                          </Confirmar>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Vacio>Sin movimientos. Las ventas con medio de pago &quot;Cuenta corriente&quot; aparecen acá.</Vacio>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Últimas compras</CardTitle></CardHeader>
          <CardContent>
            {ventas.length ? (
              <Table><TableBody>
                {ventas.map(v => (
                  <TableRow key={v.id} className={cn(v.anulada && 'line-through opacity-50')}>
                    <TableCell>{fechaCorta(v.fecha)}</TableCell><TableCell>#{v.id}</TableCell><TableCell>{v.medio_pago}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            ) : <Vacio>Sin compras</Vacio>}
          </CardContent>
        </Card>
      </div>
      {!movimientos.length && !ventas.length && (
        <div className="mt-6">
          <Confirmar titulo="¿Eliminar cliente?" accion="Eliminar" onConfirm={() => run(() => eliminarCliente(c.id), { ok: () => router.push('/clientes') })}>
            <Button variant="ghost" className="text-destructive"><Trash2 /> Eliminar cliente</Button>
          </Confirmar>
        </div>
      )}
      <ClienteDialog open={editar} onOpenChange={setEditar} cliente={c} />
      <MovimientoDialog tipo={mov} cliente={c} medios={medios} cerrar={() => setMov(null)} />
    </>
  )
}

function MovimientoDialog({ tipo, cliente, medios, cerrar }: { tipo: 'pago' | 'cargo' | null; cliente: Cliente; medios: string[]; cerrar: () => void }) {
  const { pending, run } = useAccion()
  const [f, setF] = useState({ monto: '', medio_pago: 'Efectivo', fecha: '', descripcion: '' })
  const abrir = (o: boolean) => !o && cerrar()
  return (
    <Dialog open={!!tipo} onOpenChange={abrir}>
      <DialogContent onOpenAutoFocus={() => setF({ monto: tipo === 'pago' && cliente.saldo > 0 ? String(Math.round(cliente.saldo)) : '', medio_pago: 'Efectivo', fecha: ahoraLocal().replace(' ', 'T'), descripcion: '' })}>
        <DialogHeader><DialogTitle>{tipo === 'pago' ? 'Registrar pago' : 'Cargo manual'}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); if (tipo) run(() => registrarMovimiento(cliente.id, { tipo, ...f }), { ok: cerrar }) }}>
          <div className="grid gap-3 sm:grid-cols-2">
            <Campo label="Monto"><Input type="number" step="any" required value={f.monto} onChange={e => setF({ ...f, monto: e.target.value })} /></Campo>
            {tipo === 'pago' && <Campo label="Medio"><NativeSelect value={f.medio_pago} onChange={e => setF({ ...f, medio_pago: e.target.value })}>{medios.map(m => <option key={m}>{m}</option>)}</NativeSelect></Campo>}
            <Campo label="Fecha"><Input type="datetime-local" value={f.fecha} onChange={e => setF({ ...f, fecha: e.target.value })} /></Campo>
            <Campo label="Detalle"><Input value={f.descripcion} onChange={e => setF({ ...f, descripcion: e.target.value })} placeholder={tipo === 'pago' ? 'Pago' : 'Saldo anterior, ajuste…'} /></Campo>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={pending}>Guardar</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
