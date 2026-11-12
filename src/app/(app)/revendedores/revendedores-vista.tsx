'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Plus, Printer } from 'lucide-react'
import { toast } from 'sonner'
import { ClienteDialog } from '@/components/cliente-dialog'
import { NativeSelect, PageHeader, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { money, numf, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Cliente, Producto } from '@/lib/types'
import { NEGOCIO } from '@/negocio'

const T = NEGOCIO.textos

export function RevendedoresVista({ productos, revendedores }: { productos: Producto[]; revendedores: Cliente[] }) {
  const router = useRouter()
  const [revId, setRevId] = useState('')
  const [marca, setMarca] = useState('')
  const [conStock, setConStock] = useState(false)
  const [nuevo, setNuevo] = useState(false)
  const rev = revendedores.find(r => String(r.id) === revId)
  const marcas = useMemo(() => [...new Set(productos.map(p => p.marca).filter(Boolean))].sort(), [productos])
  const precioRev = (p: Producto) => (rev?.descuento != null ? Math.round(p.precio * (1 - rev.descuento / 100)) : p.precio_revendedor_calc)
  const lista = productos.filter(p => (!marca || p.marca === marca) && (!conStock || p.stock > 0))
  const fecha = new Date().toLocaleDateString(NEGOCIO.locale)

  function copiar() {
    let txt = `*LISTA DE PRECIOS ${T.mayoristas.toUpperCase()}*${rev ? ' — ' + rev.nombre : ''}\n${fecha}\n`
    let ult: string | null = null
    for (const p of lista) {
      if (p.marca !== ult) { txt += `\n*${p.marca || 'Otros'}*\n`; ult = p.marca }
      txt += `• ${p.nombre}: ${money(precioRev(p))}\n`
    }
    navigator.clipboard.writeText(txt)
    toast.success('Lista copiada')
  }

  return (
    <>
      <div className="print:hidden">
        <PageHeader title={T.mayoristas} description={`${revendedores.length} ${T.mayoristas.toLowerCase()} · deuda total ${money(revendedores.reduce((a, r) => a + Math.max(0, r.saldo), 0))}`}>
          <Button onClick={() => setNuevo(true)}><Plus /> {T.mayorista}</Button>
        </PageHeader>
        <Card className="mb-6 py-0">
          <Table>
            <TableHeader><TableRow><TableHead>{T.mayorista}</TableHead><TableHead>Teléfono</TableHead><TableHead className="text-right">Descuento</TableHead><TableHead className="text-right">Total comprado</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow></TableHeader>
            <TableBody>
              {revendedores.length ? revendedores.map(r => (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => router.push(`/clientes/${r.id}`)}>
                  <TableCell className="font-medium">{r.nombre}</TableCell><TableCell>{r.telefono}</TableCell>
                  <TableCell className="text-right">{r.descuento != null ? `${r.descuento}%` : 'lista'}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(r.total_comprado)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', r.saldo > 0.5 && 'text-red-600 dark:text-red-400')}>{money(r.saldo)}</TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={5}><Vacio>Cargá tus {T.mayoristas.toLowerCase()} con el botón &quot;{T.mayorista}&quot;</Vacio></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
      </div>

      <Card className="print:border-0 print:shadow-none">
        <CardHeader>
          <CardTitle>Lista de precios para {T.mayoristas.toLowerCase()}</CardTitle>
          <CardDescription>{rev ? `Personalizada para ${rev.nombre}` : 'Lista general'} · {lista.length} productos · {fecha}</CardDescription>
          <CardAction className="flex flex-wrap items-center gap-2 print:hidden">
            <NativeSelect className="w-auto" value={revId} onChange={e => setRevId(e.target.value)}>
              <option value="">Lista general</option>{revendedores.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
            </NativeSelect>
            <NativeSelect className="w-auto" value={marca} onChange={e => setMarca(e.target.value)}>
              <option value="">Todas las {T.marcas}</option>{marcas.map(m => <option key={m}>{m}</option>)}
            </NativeSelect>
            <Label className="flex items-center gap-2 font-normal"><Checkbox checked={conStock} onCheckedChange={v => setConStock(!!v)} /> Solo con stock</Label>
            <Button variant="outline" onClick={copiar}><Copy /> WhatsApp</Button>
            <Button variant="outline" onClick={() => print()}><Printer /> Imprimir / PDF</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow><TableHead>{T.marca}</TableHead><TableHead>Producto</TableHead><TableHead className="text-right">Precio público</TableHead><TableHead className="text-right">Precio {T.mayorista.toLowerCase()}</TableHead>
                <TableHead className="text-right print:hidden">Tu ganancia</TableHead><TableHead className="text-right print:hidden">Stock</TableHead></TableRow>
            </TableHeader>
            <TableBody>
              {lista.map(p => (
                <TableRow key={p.id}>
                  <TableCell className="text-xs text-muted-foreground">{p.marca}</TableCell>
                  <TableCell className="whitespace-normal">{p.nombre}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.precio)}</TableCell>
                  <TableCell className="text-right font-semibold tabular-nums">{money(precioRev(p))}</TableCell>
                  <TableCell className={cn('text-right tabular-nums print:hidden', signo(precioRev(p) - p.costo))}>{money(precioRev(p) - p.costo)}</TableCell>
                  <TableCell className="text-right print:hidden">{numf(p.stock)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <ClienteDialog open={nuevo} onOpenChange={setNuevo} tipo="revendedor" />
    </>
  )
}
