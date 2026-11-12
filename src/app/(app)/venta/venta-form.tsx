'use client'

import { useMemo, useRef, useState } from 'react'
import { Check, ChevronsUpDown, Plus, Search, X } from 'lucide-react'
import { toast } from 'sonner'
import { registrarVenta } from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo, NativeSelect, Pill, tonoStock } from '@/components/common'
import { ClienteDialog } from '@/components/cliente-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { CUENTA_CORRIENTE, ahoraLocal, money, norm, numf, pct, signo, type MedioPago } from '@/lib/format'
import { NEGOCIO } from '@/negocio'
import { cn } from '@/lib/utils'
import type { Cliente, Producto } from '@/lib/types'

type Item = { key: number; producto_id: number | null; descripcion: string; cantidad: number; precio: number; costo: number }

const T = NEGOCIO.textos

export function VentaForm({ productos, clientes, medios }: { productos: Producto[]; clientes: Cliente[]; medios: MedioPago[] }) {
  const { pending, run } = useAccion()
  const [items, setItems] = useState<Item[]>([])
  const [clienteId, setClienteId] = useState<number | null>(null)
  const [tipoPrecio, setTipoPrecio] = useState<'publico' | 'revendedor'>('publico')
  const [medio, setMedio] = useState('Efectivo')
  const [descPct, setDescPct] = useState('')
  const [descMonto, setDescMonto] = useState('')
  const [recargoManual, setRecargoManual] = useState<string | null>(null)
  const [envio, setEnvio] = useState('')
  const [entrega, setEntrega] = useState('')
  const [fecha, setFecha] = useState(() => ahoraLocal().replace(' ', 'T'))
  const [notas, setNotas] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [abrirCliente, setAbrirCliente] = useState(false)
  const [nuevoCliente, setNuevoCliente] = useState(false)
  const keyRef = useRef(1)
  const buscarRef = useRef<HTMLInputElement>(null)

  const cliente = clientes.find(c => c.id === clienteId) ?? null
  const precioPara = (p: Producto, tipo = tipoPrecio, c = cliente) =>
    tipo === 'revendedor' ? (c?.descuento != null ? Math.round(p.precio * (1 - c.descuento / 100)) : p.precio_revendedor_calc) : p.precio

  const encontrados = useMemo(() => {
    const palabras = norm(busqueda).split(/\s+/).filter(Boolean)
    if (!palabras.length) return []
    return productos.filter(p => { const t = norm(`${p.marca} ${p.nombre} ${p.sku || ''}`); return palabras.every(w => t.includes(w)) }).slice(0, 12)
  }, [busqueda, productos])

  function agregar(p: Producto) {
    setItems(prev => {
      const ex = prev.find(i => i.producto_id === p.id)
      if (ex) return prev.map(i => (i === ex ? { ...i, cantidad: i.cantidad + 1 } : i))
      return [...prev, { key: keyRef.current++, producto_id: p.id, descripcion: `${p.marca} ${p.nombre}`.trim(), cantidad: 1, precio: precioPara(p), costo: p.costo }]
    })
    setBusqueda('')
    buscarRef.current?.focus()
  }
  const cambiar = (key: number, campo: 'cantidad' | 'precio' | 'descripcion', valor: string) =>
    setItems(prev => prev.map(i => (i.key === key ? { ...i, [campo]: campo === 'descripcion' ? valor : Number(valor) || 0 } : i)))
  const repreciar = (tipo: 'publico' | 'revendedor', c: Cliente | null) =>
    setItems(prev => prev.map(i => { const p = productos.find(p => p.id === i.producto_id); return p ? { ...i, precio: precioPara(p, tipo, c) } : i }))

  function elegirCliente(id: number | null) {
    setClienteId(id)
    const c = clientes.find(x => x.id === id) ?? null
    const tipo = c?.tipo === 'revendedor' ? 'revendedor' : 'publico'
    setTipoPrecio(tipo)
    repreciar(tipo, c)
    setAbrirCliente(false)
  }

  // Totales
  const subtotal = items.reduce((a, i) => a + i.cantidad * i.precio, 0)
  const costo = items.reduce((a, i) => a + i.cantidad * i.costo, 0)
  const descuento = descPct ? Math.round(subtotal * Number(descPct) / 100) : Number(descMonto) || 0
  const porcTarjeta = medios.find(m => m.nombre === medio)?.recargo ?? 0
  const recargoAuto = porcTarjeta ? Math.round((subtotal - descuento) / (1 - porcTarjeta / 100) - (subtotal - descuento)) : 0
  const recargo = recargoManual != null ? Number(recargoManual) || 0 : recargoAuto
  const envioN = Number(envio) || 0
  const total = subtotal - descuento + recargo + envioN
  const ganancia = total - costo - recargo

  function guardar() {
    if (!items.length) return toast.error('Agregá al menos un producto')
    run(() => registrarVenta({
      items: items.map(({ producto_id, descripcion, cantidad, precio, costo }) => ({ producto_id, descripcion, cantidad, precio, costo })),
      cliente_id: clienteId, tipo_precio: tipoPrecio, medio_pago: medio, descuento, recargo, envio: envioN,
      entrega, notas, fecha: fecha.replace('T', ' '),
    }), {
      ok: r => {
        toast.success(`Venta #${r?.id} registrada: ${money(r?.total)}`)
        setItems([]); setClienteId(null); setTipoPrecio('publico'); setMedio('Efectivo'); setDescPct(''); setDescMonto('')
        setRecargoManual(null); setEnvio(''); setEntrega(''); setNotas(''); setFecha(ahoraLocal().replace(' ', 'T'))
      },
    })
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[1fr_360px]">
      <div className="grid gap-4">
        <Card>
          <CardContent className="grid gap-4">
            <div className={cn('grid gap-3', NEGOCIO.modulos.mayoristas ? 'sm:grid-cols-[1fr_auto_160px]' : 'sm:grid-cols-[1fr_auto]')}>
              <Campo label="Cliente">
                <Popover open={abrirCliente} onOpenChange={setAbrirCliente}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" role="combobox" className="justify-between font-normal">
                      <span className="truncate">{cliente ? cliente.nombre : 'Consumidor final'}</span>
                      <ChevronsUpDown className="opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-(--radix-popover-trigger-width) p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Buscar cliente…" />
                      <CommandList>
                        <CommandEmpty>No hay clientes con ese nombre.</CommandEmpty>
                        <CommandGroup>
                          <CommandItem value="consumidor final" onSelect={() => elegirCliente(null)}>
                            <Check className={cn(clienteId == null ? 'opacity-100' : 'opacity-0')} /> Consumidor final
                          </CommandItem>
                          {clientes.map(c => (
                            <CommandItem key={c.id} value={`${c.nombre} ${c.id}`} onSelect={() => elegirCliente(c.id)}>
                              <Check className={cn(clienteId === c.id ? 'opacity-100' : 'opacity-0')} />
                              <span className="truncate">{c.nombre}</span>
                              {c.tipo === 'revendedor' && <Pill>{T.mayorista.toLowerCase()}</Pill>}
                              {c.saldo > 0.5 && <span className="ml-auto text-xs text-red-600">debe {money(c.saldo)}</span>}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </Campo>
              <div className="flex items-end"><Button variant="outline" onClick={() => setNuevoCliente(true)}><Plus /> Cliente nuevo</Button></div>
              {NEGOCIO.modulos.mayoristas && <Campo label="Lista de precios">
                <NativeSelect value={tipoPrecio} onChange={e => { const t = e.target.value as 'publico' | 'revendedor'; setTipoPrecio(t); repreciar(t, cliente) }}>
                  <option value="publico">Público</option>
                  <option value="revendedor">{T.mayorista}</option>
                </NativeSelect>
              </Campo>}
            </div>

            <Campo label="Agregar producto">
              <Command shouldFilter={false} className="rounded-lg border">
                <div className="relative">
                  <CommandInput ref={buscarRef} value={busqueda} onValueChange={setBusqueda} placeholder={`Escribí para buscar (${T.ejemploBusqueda})…`} autoFocus />
                </div>
                {busqueda && (
                  <CommandList className="max-h-72">
                    <CommandEmpty>Sin resultados</CommandEmpty>
                    {encontrados.map(p => (
                      <CommandItem key={p.id} value={String(p.id)} onSelect={() => agregar(p)} className="justify-between gap-3">
                        <span className="truncate"><span className="text-xs text-muted-foreground">{p.marca}</span> {p.nombre}</span>
                        <span className="flex shrink-0 items-center gap-2">
                          <Pill tono={tonoStock(p.stock, p.stock_minimo)}>{numf(p.stock)}</Pill>
                          <span className="tabular-nums">{money(precioPara(p))}</span>
                        </span>
                      </CommandItem>
                    ))}
                  </CommandList>
                )}
              </Command>
            </Campo>
          </CardContent>
        </Card>

        <Card className="py-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead className="w-24 text-right">Cant.</TableHead>
                <TableHead className="w-32 text-right">Precio u.</TableHead>
                <TableHead className="text-right">Subtotal</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length ? items.map(it => {
                const p = productos.find(p => p.id === it.producto_id)
                return (
                  <TableRow key={it.key}>
                    <TableCell className="whitespace-normal">
                      {it.producto_id ? it.descripcion : <Input value={it.descripcion} onChange={e => cambiar(it.key, 'descripcion', e.target.value)} />}
                      {p && p.stock < it.cantidad && <div className="mt-1"><Pill tono="warn">stock: {numf(p.stock)}</Pill></div>}
                    </TableCell>
                    <TableCell><Input type="number" min={0} step="any" className="text-right" value={it.cantidad} onChange={e => cambiar(it.key, 'cantidad', e.target.value)} /></TableCell>
                    <TableCell><Input type="number" step="any" className="text-right" value={it.precio} onChange={e => cambiar(it.key, 'precio', e.target.value)} /></TableCell>
                    <TableCell className="text-right tabular-nums">{money(it.cantidad * it.precio)}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon-xs" aria-label="Quitar" onClick={() => setItems(prev => prev.filter(i => i.key !== it.key))}><X /></Button>
                    </TableCell>
                  </TableRow>
                )
              }) : (
                <TableRow><TableCell colSpan={5} className="py-10 text-center text-muted-foreground"><Search className="mx-auto mb-2 size-5 opacity-50" />Todavía no agregaste productos</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
          <div className="border-t p-3">
            <Button variant="ghost" size="sm" onClick={() => setItems(prev => [...prev, { key: keyRef.current++, producto_id: null, descripcion: 'Ítem', cantidad: 1, precio: 0, costo: 0 }])}>
              <Plus /> Ítem sin producto (combo, servicio…)
            </Button>
          </div>
        </Card>
      </div>

      <Card className="lg:sticky lg:top-16">
        <CardHeader><CardTitle>Cobro</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <Campo label="Medio de pago">
            <NativeSelect value={medio} onChange={e => { setMedio(e.target.value); setRecargoManual(null) }}>
              {medios.map(m => <option key={m.nombre}>{m.nombre}</option>)}
              <option>{CUENTA_CORRIENTE}</option>
            </NativeSelect>
          </Campo>
          <div className="grid grid-cols-2 gap-3">
            <Campo label="Descuento %"><Input type="number" step="any" value={descPct} onChange={e => { setDescPct(e.target.value); setDescMonto('') }} placeholder="0" /></Campo>
            <Campo label={`Descuento ${NEGOCIO.moneda}`}><Input type="number" step="any" value={descPct ? descuento : descMonto} onChange={e => { setDescMonto(e.target.value); setDescPct('') }} placeholder="0" /></Campo>
            <Campo label={porcTarjeta ? `Recargo ${NEGOCIO.moneda} (${porcTarjeta}%)` : `Recargo ${NEGOCIO.moneda}`}>
              <Input type="number" step="any" value={recargoManual ?? recargoAuto} onChange={e => setRecargoManual(e.target.value)} />
            </Campo>
            <Campo label={`Envío cobrado ${NEGOCIO.moneda}`}><Input type="number" step="any" value={envio} onChange={e => setEnvio(e.target.value)} placeholder="0" /></Campo>
            <Campo label="Entrega">
              <Input list="entregas" value={entrega} onChange={e => setEntrega(e.target.value)} placeholder="Retira, Envío…" />
              <datalist id="entregas">{NEGOCIO.entregas.map(e => <option key={e}>{e}</option>)}</datalist>
            </Campo>
            <Campo label="Fecha"><Input type="datetime-local" value={fecha} onChange={e => setFecha(e.target.value)} /></Campo>
          </div>
          <Campo label="Notas"><Input value={notas} onChange={e => setNotas(e.target.value)} placeholder={T.ejemploNotas} /></Campo>

          <Separator className="my-1" />
          <div className="grid gap-1.5 text-sm">
            <Fila label="Subtotal" valor={money(subtotal)} />
            {!!descuento && <Fila label="Descuento" valor={`− ${money(descuento)}`} />}
            {!!recargo && <Fila label="Recargo" valor={`+ ${money(recargo)}`} />}
            {!!envioN && <Fila label="Envío" valor={`+ ${money(envioN)}`} />}
            <div className="mt-1 flex items-baseline justify-between border-t pt-2">
              <span className="font-medium">Total</span>
              <span className="text-2xl font-semibold tabular-nums">{money(total)}</span>
            </div>
            <Fila label="Ganancia estimada" valor={<span className={signo(ganancia)}>{money(ganancia)} {total > 0 && `(${pct(ganancia / total)})`}</span>} muted />
          </div>
          <Button size="lg" className="mt-2 h-10" disabled={pending} onClick={guardar}>{pending ? 'Guardando…' : 'Registrar venta'}</Button>
        </CardContent>
      </Card>

      <ClienteDialog open={nuevoCliente} onOpenChange={setNuevoCliente} onGuardado={id => { if (id) setTimeout(() => setClienteId(id), 300) }} />
    </div>
  )
}

function Fila({ label, valor, muted }: { label: string; valor: React.ReactNode; muted?: boolean }) {
  return (
    <div className={cn('flex justify-between', muted && 'text-xs text-muted-foreground')}>
      <span>{label}</span><span className="tabular-nums">{valor}</span>
    </div>
  )
}
