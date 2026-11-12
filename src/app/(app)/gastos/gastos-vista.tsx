'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
import { borrarGasto, guardarGasto } from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { Campo, NativeSelect, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaCorta, hoyLocal, mesLocal, money, nombreMes } from '@/lib/format'
import type { Gasto } from '@/lib/types'

export function GastosVista({ mes, gastos, categorias, medios }: { mes: string; gastos: Gasto[]; categorias: string[]; medios: string[] }) {
  const router = useRouter()
  const { pending, run } = useAccion()
  const nuevo = () => ({ fecha: mes === mesLocal() ? hoyLocal() : `${mes}-01`, categoria: categorias[0] || 'Otros', descripcion: '', monto: '', medio_pago: 'Efectivo' })
  const [f, setF] = useState(nuevo)
  const set = (k: keyof ReturnType<typeof nuevo>) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const total = gastos.reduce((a, g) => a + g.monto, 0)
  const porCat = Object.entries(gastos.reduce<Record<string, number>>((a, g) => ({ ...a, [g.categoria]: (a[g.categoria] || 0) + g.monto }), {})).sort((a, b) => b[1] - a[1])
  const max = Math.max(1, ...porCat.map(([, v]) => v))

  return (
    <>
      <PageHeader title="Gastos" description={<span className="first-letter:uppercase">{nombreMes(mes)} · total <b>{money(total)}</b></span>}>
        <Input type="month" className="w-auto" value={mes} onChange={e => e.target.value && router.push(`/gastos?mes=${e.target.value}`)} />
      </PageHeader>
      <Card className="mb-4">
        <CardContent>
          <form className="grid items-end gap-3 sm:grid-cols-2 lg:grid-cols-[140px_160px_1fr_130px_150px_auto]"
            onSubmit={e => { e.preventDefault(); run(() => guardarGasto(f), { ok: () => setF({ ...nuevo(), fecha: f.fecha }) }) }}>
            <Campo label="Fecha"><Input type="date" value={f.fecha} onChange={set('fecha')} /></Campo>
            <Campo label="Categoría"><NativeSelect value={f.categoria} onChange={set('categoria')}>{categorias.map(c => <option key={c}>{c}</option>)}</NativeSelect></Campo>
            <Campo label="Descripción"><Input value={f.descripcion} onChange={set('descripcion')} placeholder="Ej: publicidad Instagram" /></Campo>
            <Campo label="Monto"><Input type="number" step="any" required value={f.monto} onChange={set('monto')} /></Campo>
            <Campo label="Pagado con"><NativeSelect value={f.medio_pago} onChange={set('medio_pago')}>{medios.map(m => <option key={m}>{m}</option>)}</NativeSelect></Campo>
            <Button type="submit" disabled={pending}><Plus /> Agregar</Button>
          </form>
        </CardContent>
      </Card>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <Card className="py-0">
          <Table>
            <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Categoría</TableHead><TableHead>Descripción</TableHead><TableHead>Medio</TableHead><TableHead className="text-right">Monto</TableHead><TableHead /></TableRow></TableHeader>
            <TableBody>
              {gastos.length ? gastos.map(g => (
                <TableRow key={g.id}>
                  <TableCell>{fechaCorta(g.fecha)}</TableCell><TableCell><Pill>{g.categoria}</Pill></TableCell>
                  <TableCell className="whitespace-normal">{g.descripcion}</TableCell><TableCell className="text-xs">{g.medio_pago}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(g.monto)}</TableCell>
                  <TableCell>
                    <Confirmar titulo="¿Borrar gasto?" accion="Borrar" onConfirm={() => run(() => borrarGasto(g.id))}>
                      <Button variant="ghost" size="icon-xs" aria-label="Borrar"><Trash2 /></Button>
                    </Confirmar>
                  </TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={6}><Vacio>Sin gastos este mes</Vacio></TableCell></TableRow>}
            </TableBody>
          </Table>
        </Card>
        <Card>
          <CardHeader><CardTitle>Por categoría</CardTitle></CardHeader>
          <CardContent className="grid gap-3">
            {porCat.length ? porCat.map(([c, v]) => (
              <div key={c} className="grid gap-1">
                <div className="flex justify-between text-sm"><span>{c}</span><span className="font-medium tabular-nums">{money(v)}</span></div>
                <div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(v / max) * 100}%` }} /></div>
              </div>
            )) : <Vacio>—</Vacio>}
          </CardContent>
        </Card>
      </div>
    </>
  )
}
