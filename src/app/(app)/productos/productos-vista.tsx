'use client'

import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Copy, History, Pencil, Plus, TrendingUp } from 'lucide-react'
import { toast } from 'sonner'
import {
  actualizarPrecios, eliminarProducto, guardarProducto, movimientoStock, verMovimientosStock, type ProductoForm,
} from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { Campo, NativeSelect, PageHeader, Pill, tonoStock, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaCorta, money, norm, numf, pct, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Producto, StockMov } from '@/lib/types'
import { NEGOCIO } from '@/negocio'

const T = NEGOCIO.textos, M = NEGOCIO.modulos

type Modal = { tipo: 'editar'; p: Producto | null } | { tipo: 'ingreso' | 'ajuste' | 'movs'; p: Producto } | { tipo: 'aumento' | 'pedido' } | null

export function ProductosVista({ productos, descuentoRev, medios, abrirPedido }: { productos: Producto[]; descuentoRev: string; medios: string[]; abrirPedido: boolean }) {
  const [texto, setTexto] = useState('')
  const [marca, setMarca] = useState('')
  const [bajo, setBajo] = useState(false)
  const [inactivos, setInactivos] = useState(false)
  const [modal, setModal] = useState<Modal>(abrirPedido ? { tipo: 'pedido' } : null)
  const marcas = useMemo(() => [...new Set(productos.map(p => p.marca).filter(Boolean))].sort(), [productos])

  const palabras = norm(texto).split(/\s+/).filter(Boolean)
  const lista = productos.filter(p => (inactivos || p.activo) && (!marca || p.marca === marca) &&
    (!bajo || (p.stock_minimo > 0 && p.stock <= p.stock_minimo)) && palabras.every(w => norm(`${p.marca} ${p.nombre} ${p.sku || ''}`).includes(w)))
  const bajos = productos.filter(p => p.activo && p.stock_minimo > 0 && p.stock <= p.stock_minimo).length
  const st = (p: Producto) => Math.max(0, p.stock)
  const vc = lista.reduce((a, p) => a + st(p) * p.costo, 0), vv = lista.reduce((a, p) => a + st(p) * p.precio, 0)

  return (
    <>
      <PageHeader title="Productos y stock" description={<>{productos.filter(p => p.activo).length} productos activos · <span className={cn(bajos && 'text-red-600 dark:text-red-400')}>{bajos} con stock bajo</span></>}>
        <Button variant="outline" onClick={() => setModal({ tipo: 'pedido' })}><ClipboardList /> Pedido sugerido</Button>
        <Button variant="outline" onClick={() => setModal({ tipo: 'aumento' })}><TrendingUp /> Actualizar precios</Button>
        <Button onClick={() => setModal({ tipo: 'editar', p: null })}><Plus /> Producto</Button>
      </PageHeader>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Input className="max-w-xs" placeholder="Buscar producto…" value={texto} onChange={e => setTexto(e.target.value)} />
        <NativeSelect className="w-auto" value={marca} onChange={e => setMarca(e.target.value)}>
          <option value="">Todas las {T.marcas}</option>{marcas.map(m => <option key={m}>{m}</option>)}
        </NativeSelect>
        <Label className="flex items-center gap-2 font-normal"><Checkbox checked={bajo} onCheckedChange={v => setBajo(!!v)} /> Solo stock bajo</Label>
        <Label className="flex items-center gap-2 font-normal"><Checkbox checked={inactivos} onCheckedChange={v => setInactivos(!!v)} /> Ver inactivos</Label>
      </div>

      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{T.marca}</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mín.</TableHead>
              <TableHead className="text-right">Costo</TableHead><TableHead className="text-right">Precio</TableHead><TableHead className="text-right">Ganancia</TableHead>
              <TableHead className="text-right">Margen</TableHead>{M.mayoristas && <TableHead className="text-right">{T.mayorista}</TableHead>}{M.tiendanube && <TableHead>TN</TableHead>}<TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {lista.length ? lista.map(p => {
              const g = p.precio - p.costo, m = p.precio ? g / p.precio : 0
              return (
                <TableRow key={p.id} className={cn(!p.activo && 'opacity-50')}>
                  <TableCell className="text-xs text-muted-foreground">{p.marca}</TableCell>
                  <TableCell className="max-w-72 whitespace-normal">{p.nombre}{p.sku && <span className="ml-1 text-xs text-muted-foreground">{p.sku}</span>}</TableCell>
                  <TableCell className="text-right">
                    <button title="Ajustar stock" onClick={() => setModal({ tipo: 'ajuste', p })}><Pill tono={tonoStock(p.stock, p.stock_minimo)} className="cursor-pointer">{numf(p.stock)}</Pill></button>
                  </TableCell>
                  <TableCell className="text-right text-muted-foreground">{numf(p.stock_minimo)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.costo)}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{money(p.precio)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', signo(g))}>{money(g)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', m < 0.2 && 'text-red-600 dark:text-red-400')}>{pct(m)}</TableCell>
                  {M.mayoristas && <TableCell className="text-right tabular-nums">{money(p.precio_revendedor_calc)}{p.precio_revendedor == null && <span className="text-muted-foreground">*</span>}</TableCell>}
                  {M.tiendanube && <TableCell>{p.tn_variant_id && <Pill tono="ok">✓</Pill>}</TableCell>}
                  <TableCell className="text-right whitespace-nowrap">
                    <Button variant="outline" size="xs" onClick={() => setModal({ tipo: 'ingreso', p })}><Plus /> Ingreso</Button>{' '}
                    <Button variant="ghost" size="icon-xs" title="Movimientos" onClick={() => setModal({ tipo: 'movs', p })}><History /></Button>
                    <Button variant="ghost" size="icon-xs" title="Editar" onClick={() => setModal({ tipo: 'editar', p })}><Pencil /></Button>
                  </TableCell>
                </TableRow>
              )
            }) : <TableRow><TableCell colSpan={11}><Vacio>Sin productos</Vacio></TableCell></TableRow>}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={2}>{lista.length} productos</TableCell>
              <TableCell className="text-right">{numf(lista.reduce((a, p) => a + st(p), 0))}</TableCell><TableCell />
              <TableCell className="text-right" title="Stock × costo">{money(vc)}</TableCell>
              <TableCell className="text-right" title="Stock × precio">{money(vv)}</TableCell>
              <TableCell className="text-right">{money(vv - vc)}</TableCell>
              <TableCell colSpan={4} className="text-xs font-normal text-muted-foreground">valor del stock a costo / venta</TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </Card>
      {M.mayoristas && <p className="mt-2 text-xs text-muted-foreground">* precio de {T.mayorista.toLowerCase()} calculado con el {descuentoRev}% de descuento (configurable)</p>}

      <EditarProducto modal={modal} marcas={marcas} cerrar={() => setModal(null)} />
      <StockDialog modal={modal} medios={medios} cerrar={() => setModal(null)} />
      <MovimientosDialog modal={modal} cerrar={() => setModal(null)} />
      <AumentoDialog abierto={modal?.tipo === 'aumento'} marcas={marcas} cerrar={() => setModal(null)} />
      <PedidoDialog abierto={modal?.tipo === 'pedido'} productos={productos} cerrar={() => setModal(null)} />
    </>
  )
}

// Los formularios viven dentro de DialogContent: se montan al abrir y arrancan con los datos del producto.
function EditarProducto({ modal, marcas, cerrar }: { modal: Modal; marcas: string[]; cerrar: () => void }) {
  const abierto = modal?.tipo === 'editar'
  return (
    <Dialog open={abierto} onOpenChange={o => !o && cerrar()}>
      <DialogContent className="sm:max-w-xl">
        {abierto && <EditarProductoForm p={modal.p} marcas={marcas} cerrar={cerrar} />}
      </DialogContent>
    </Dialog>
  )
}

function EditarProductoForm({ p, marcas, cerrar }: { p: Producto | null; marcas: string[]; cerrar: () => void }) {
  const { pending, run } = useAccion()
  const [f, setF] = useState<ProductoForm>(() => p ? { ...p, sku: p.sku ?? '', precio_revendedor: p.precio_revendedor ?? '' }
    : { marca: '', nombre: '', sku: '', costo: 0, precio: 0, precio_revendedor: '', stock: 0, stock_minimo: 1, stock_ideal: 0, activo: true })
  const [margen, setMargen] = useState('')
  const set = (k: keyof ProductoForm) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  const c = Number(f.costo) || 0, pr = Number(f.precio) || 0

  return (
    <>
        <DialogHeader><DialogTitle>{p ? 'Editar producto' : 'Nuevo producto'}</DialogTitle></DialogHeader>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); run(() => guardarProducto({ ...f, id: p?.id }), { ok: cerrar }) }}>
          <div className="grid gap-3 sm:grid-cols-[1fr_2fr]">
            <Campo label={T.marca}><Input list="dl-marcas" value={f.marca} onChange={set('marca')} /><datalist id="dl-marcas">{marcas.map(m => <option key={m}>{m}</option>)}</datalist></Campo>
            <Campo label="Nombre"><Input required value={f.nombre} onChange={set('nombre')} /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Costo (reposición)"><Input type="number" step="any" value={f.costo} onChange={set('costo')} /></Campo>
            <Campo label="Margen deseado %">
              <Input type="number" step="any" placeholder="ej: 30" value={margen} onChange={e => {
                setMargen(e.target.value)
                const m = Number(e.target.value)
                if (m > 0 && m < 100) setF({ ...f, precio: Math.round(c / (1 - m / 100) / 100) * 100 })
              }} />
            </Campo>
            <Campo label="Precio de venta"><Input type="number" step="any" value={f.precio} onChange={set('precio')} /></Campo>
          </div>
          {pr > 0 && <p className="text-xs text-muted-foreground">Ganancia {money(pr - c)} por unidad · margen {pct((pr - c) / pr)} · markup {pct(c ? (pr - c) / c : 0)}</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            {M.mayoristas && <Campo label={`Precio ${T.mayorista.toLowerCase()} (vacío = descuento general)`}><Input type="number" step="any" value={f.precio_revendedor ?? ''} onChange={set('precio_revendedor')} /></Campo>}
            <Campo label="SKU / código"><Input value={f.sku ?? ''} onChange={set('sku')} /></Campo>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            {!p && <Campo label="Stock inicial"><Input type="number" step="any" value={f.stock ?? 0} onChange={set('stock')} /></Campo>}
            <Campo label="Stock mínimo (alerta)"><Input type="number" step="any" value={f.stock_minimo} onChange={set('stock_minimo')} /></Campo>
            <Campo label="Stock ideal (para pedir)"><Input type="number" step="any" value={f.stock_ideal} onChange={set('stock_ideal')} /></Campo>
          </div>
          {p && <Label className="flex items-center gap-2 font-normal"><Checkbox checked={f.activo !== false} onCheckedChange={v => setF({ ...f, activo: !!v })} /> Producto activo</Label>}
          <DialogFooter className="sm:justify-between">
            {p ? (
              <Confirmar titulo="¿Eliminar este producto?" descripcion="Si tiene ventas registradas, queda desactivado en lugar de borrarse." accion="Eliminar"
                onConfirm={() => run(() => eliminarProducto(p.id), { ok: msg => { toast.success(String(msg)); cerrar() } })}>
                <Button type="button" variant="destructive">Eliminar</Button>
              </Confirmar>
            ) : <span />}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
              <Button type="submit" disabled={pending}>Guardar</Button>
            </div>
          </DialogFooter>
        </form>
    </>
  )
}

function StockDialog({ modal, medios, cerrar }: { modal: Modal; medios: string[]; cerrar: () => void }) {
  const abierto = modal?.tipo === 'ingreso' || modal?.tipo === 'ajuste'
  return (
    <Dialog open={abierto} onOpenChange={o => !o && cerrar()}>
      <DialogContent>{abierto && <StockForm p={modal.p} ingreso={modal.tipo === 'ingreso'} medios={medios} cerrar={cerrar} />}</DialogContent>
    </Dialog>
  )
}

function StockForm({ p, ingreso, medios, cerrar }: { p: Producto; ingreso: boolean; medios: string[]; cerrar: () => void }) {
  const { pending, run } = useAccion()
  const [cantidad, setCantidad] = useState(ingreso ? '' : String(p.stock))
  const [costo, setCosto] = useState(String(p.costo))
  const [nota, setNota] = useState('')
  const [gasto, setGasto] = useState(false)
  const [medio, setMedio] = useState(medios.includes('Transferencia') ? 'Transferencia' : medios[0])
  return (
    <>
        <DialogHeader>
          <DialogTitle>{ingreso ? 'Ingreso de mercadería' : 'Ajustar stock (conteo)'}</DialogTitle>
          <DialogDescription>{p.marca} {p.nombre} — stock actual {numf(p.stock)}</DialogDescription>
        </DialogHeader>
        <form className="grid gap-3" onSubmit={e => {
          e.preventDefault()
          run(() => movimientoStock(p.id, { tipo: ingreso ? 'ingreso' : 'ajuste', cantidad, costo, nota, registrar_gasto: gasto, medio_pago: medio }), { ok: cerrar })
        }}>
          {ingreso ? <>
            <div className="grid gap-3 sm:grid-cols-2">
              <Campo label="Cantidad que entra"><Input type="number" step="any" required autoFocus value={cantidad} onChange={e => setCantidad(e.target.value)} /></Campo>
              <Campo label="Costo unitario nuevo"><Input type="number" step="any" value={costo} onChange={e => setCosto(e.target.value)} /></Campo>
            </div>
            <Label className="flex items-center gap-2 font-normal"><Checkbox checked={gasto} onCheckedChange={v => setGasto(!!v)} /> Registrar la compra como gasto (Mercadería)</Label>
            {gasto && <Campo label="Pagado con"><NativeSelect value={medio} onChange={e => setMedio(e.target.value)}>{medios.map(m => <option key={m}>{m}</option>)}</NativeSelect></Campo>}
            <Campo label="Nota (proveedor, factura…)"><Input value={nota} onChange={e => setNota(e.target.value)} /></Campo>
          </> : <>
            <Campo label="Stock real contado"><Input type="number" step="any" required autoFocus value={cantidad} onChange={e => setCantidad(e.target.value)} /></Campo>
            <Campo label="Motivo"><Input value={nota} onChange={e => setNota(e.target.value)} placeholder="Conteo, rotura, vencido, regalo, sorteo…" /></Campo>
          </>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={cerrar}>Cancelar</Button>
            <Button type="submit" disabled={pending}>{ingreso ? 'Sumar al stock' : 'Guardar'}</Button>
          </DialogFooter>
        </form>
    </>
  )
}

function MovimientosDialog({ modal, cerrar }: { modal: Modal; cerrar: () => void }) {
  const p = modal?.tipo === 'movs' ? modal.p : null
  return (
    <Dialog open={!!p} onOpenChange={o => !o && cerrar()}>
      <DialogContent className="sm:max-w-xl">{p && <Movimientos p={p} />}</DialogContent>
    </Dialog>
  )
}

function Movimientos({ p }: { p: Producto }) {
  const [movs, setMovs] = useState<StockMov[] | null>(null)
  useEffect(() => { verMovimientosStock(p.id).then(setMovs) }, [p.id])
  return (
    <>
        <DialogHeader><DialogTitle>Movimientos de stock</DialogTitle><DialogDescription>{p?.marca} {p?.nombre} — stock actual {numf(p?.stock)}</DialogDescription></DialogHeader>
        <div className="max-h-96 overflow-auto">
          {!movs ? <Vacio>Cargando…</Vacio> : movs.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Motivo</TableHead><TableHead className="text-right">Cantidad</TableHead><TableHead>Ref.</TableHead></TableRow></TableHeader>
              <TableBody>{movs.map(m => (
                <TableRow key={m.id}><TableCell>{fechaCorta(m.fecha)}</TableCell><TableCell>{m.motivo}</TableCell>
                  <TableCell className={cn('text-right', signo(m.cantidad))}>{m.cantidad > 0 ? '+' : ''}{numf(m.cantidad)}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{m.ref}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          ) : <Vacio>Sin movimientos registrados (el stock inicial se cargó con la base)</Vacio>}
        </div>
    </>
  )
}

function AumentoDialog({ abierto, marcas, cerrar }: { abierto: boolean; marcas: string[]; cerrar: () => void }) {
  const { pending, run } = useAccion()
  const [d, setD] = useState({ marca: '', porc_costo: '0', porc_precio: '0', porc_revendedor: '0', redondeo: '100' })
  const set = (k: keyof typeof d) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setD({ ...d, [k]: e.target.value })
  return (
    <Dialog open={abierto} onOpenChange={o => !o && cerrar()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Actualizar precios en bloque</DialogTitle>
          <DialogDescription>Para cuando un proveedor te pasa lista nueva. Se aplica a todos los productos de la {T.marca.toLowerCase()} elegida.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <Campo label={T.marca}><NativeSelect value={d.marca} onChange={set('marca')}><option value="">Todas las {T.marcas}</option>{marcas.map(m => <option key={m}>{m}</option>)}</NativeSelect></Campo>
          <div className="grid gap-3 sm:grid-cols-3">
            <Campo label="Aumento costo %"><Input type="number" step="any" value={d.porc_costo} onChange={set('porc_costo')} /></Campo>
            <Campo label="Aumento precio %"><Input type="number" step="any" value={d.porc_precio} onChange={set('porc_precio')} /></Campo>
            <Campo label={`Aumento ${T.mayorista.toLowerCase()} %`}><Input type="number" step="any" value={d.porc_revendedor} onChange={set('porc_revendedor')} /></Campo>
          </div>
          <Campo label="Redondear precios a múltiplos de">
            <NativeSelect value={d.redondeo} onChange={set('redondeo')}>{[100, 500, 1000].map(v => <option key={v} value={v}>{money(v)}</option>)}<option value="1">Sin redondeo</option></NativeSelect>
          </Campo>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={cerrar}>Cancelar</Button>
          <Confirmar destructivo={false} titulo={`¿Aplicar a ${d.marca || 'TODAS las ' + T.marcas}?`} accion="Aplicar"
            descripcion={`Costo +${d.porc_costo}%, precio +${d.porc_precio}%, ${T.mayorista.toLowerCase()} +${d.porc_revendedor}%`}
            onConfirm={() => run(() => actualizarPrecios(d), { ok: n => { toast.success(`${n} productos actualizados`); cerrar() } })}>
            <Button disabled={pending}>Aplicar</Button>
          </Confirmar>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function PedidoDialog({ abierto, productos, cerrar }: { abierto: boolean; productos: Producto[]; cerrar: () => void }) {
  const lista = productos.filter(p => p.activo && p.stock_ideal > 0 && p.stock < p.stock_ideal).map(p => ({ ...p, pedir: Math.ceil(p.stock_ideal - Math.max(0, p.stock)) }))
  const porMarca: Record<string, typeof lista> = {}
  for (const p of lista) (porMarca[p.marca || `Sin ${T.marca.toLowerCase()}`] ||= []).push(p)
  const total = lista.reduce((a, p) => a + p.pedir * p.costo, 0)
  const copiar = (m: string) => {
    navigator.clipboard.writeText('Hola! Te hago el pedido:\n' + porMarca[m].map(p => `• ${p.pedir} x ${p.nombre}`).join('\n'))
    toast.success('Pedido copiado')
  }
  return (
    <Dialog open={abierto} onOpenChange={o => !o && cerrar()}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Pedido sugerido</DialogTitle>
          <DialogDescription>Productos debajo del stock ideal. Cantidad = ideal − stock actual. Total estimado: <b>{money(total)}</b></DialogDescription>
        </DialogHeader>
        <div className="grid max-h-[65vh] gap-6 overflow-auto">
          {Object.entries(porMarca).map(([m, ps]) => (
            <div key={m}>
              <div className="mb-1 flex items-center justify-between">
                <h3 className="font-medium">{m} <span className="text-sm font-normal text-muted-foreground">{money(ps.reduce((a, p) => a + p.pedir * p.costo, 0))}</span></h3>
                <Button variant="outline" size="xs" onClick={() => copiar(m)}><Copy /> Copiar para WhatsApp</Button>
              </div>
              <Table>
                <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Ideal</TableHead><TableHead className="text-right">Pedir</TableHead><TableHead className="text-right">Costo</TableHead></TableRow></TableHeader>
                <TableBody>{ps.map(p => (
                  <TableRow key={p.id}><TableCell className="whitespace-normal">{p.nombre}</TableCell><TableCell className="text-right">{numf(p.stock)}</TableCell>
                    <TableCell className="text-right">{numf(p.stock_ideal)}</TableCell><TableCell className="text-right font-semibold">{p.pedir}</TableCell>
                    <TableCell className="text-right">{money(p.pedir * p.costo)}</TableCell></TableRow>
                ))}</TableBody>
              </Table>
            </div>
          ))}
          {!lista.length && <Vacio>No hay nada para pedir 🎉</Vacio>}
        </div>
      </DialogContent>
    </Dialog>
  )
}
