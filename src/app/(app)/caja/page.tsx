import type { Metadata } from 'next'
import Link from 'next/link'
import { Kpi, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getCierres, resumenCaja } from '@/lib/queries'
import { fechaCorta, fechaLarga, hoyLocal, money, pct, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ArqueoForm, FechaCaja } from './caja-form'

export const metadata: Metadata = { title: 'Cierre de caja' }

export default async function Caja({ searchParams }: PageProps<'/caja'>) {
  const q = await searchParams
  const fecha = typeof q.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q.fecha) ? q.fecha : hoyLocal()
  const [c, cierres] = await Promise.all([resumenCaja(fecha), getCierres()])
  const titulo = fechaLarga(new Date(fecha + 'T12:00'), { year: 'numeric', timeZone: undefined })
  return (
    <>
      <PageHeader title="Cierre de caja"
        description={<span className="flex items-center gap-2"><span className="first-letter:uppercase">{titulo}</span>{c.cierre ? <Pill tono="ok">Cerrada</Pill> : <Pill tono="warn">Abierta</Pill>}</span>}>
        <FechaCaja fecha={fecha} />
        <Button variant="outline" asChild><Link href="/reportes">Cierre mensual →</Link></Button>
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Ventas del día" value={money(c.ventas.total)} hint={`${c.ventas.cantidad} ventas`} />
        <Kpi label="Costo mercadería" value={money(c.ventas.costo)} />
        <Kpi label="Ganancia bruta" value={money(c.ganancia_bruta)} hint={`margen ${pct(c.margen)}`} className={signo(c.ganancia_bruta)} />
        <Kpi label="Gastos del día" value={money(c.gastos)} />
        <Kpi label="Resultado del día" value={money(c.resultado)} className={signo(c.resultado)} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ingresos por medio de pago</CardTitle></CardHeader>
          <CardContent>
            {c.porMedio.length || c.cobros.length ? (
              <Table><TableBody>
                {c.porMedio.map(m => <TableRow key={m.medio_pago}><TableCell>{m.medio_pago}</TableCell><TableCell className="text-right text-muted-foreground">{m.cantidad}</TableCell><TableCell className="text-right tabular-nums">{money(m.total)}</TableCell></TableRow>)}
                {c.cobros.map(m => <TableRow key={'c' + m.medio_pago}><TableCell>Cobro cta. cte. ({m.medio_pago})</TableCell><TableCell /><TableCell className="text-right tabular-nums">{money(m.total)}</TableCell></TableRow>)}
              </TableBody></Table>
            ) : <Vacio>Sin ventas</Vacio>}
            <p className="mt-3 text-xs text-muted-foreground">Las ventas en &quot;Cuenta corriente&quot; no entran plata hoy: se cobran cuando registrás el pago del cliente.</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Arqueo de efectivo</CardTitle></CardHeader>
          <CardContent><ArqueoForm key={fecha} fecha={fecha} efectivo={c.efectivo} cierre={c.cierre} /></CardContent>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Ventas del día</CardTitle></CardHeader>
          <CardContent>
            {c.ventasDia.length ? (
              <Table><TableBody>
                {c.ventasDia.map(v => (
                  <TableRow key={v.id} className={cn(v.anulada && 'line-through opacity-50')}>
                    <TableCell>{v.fecha.slice(11, 16)}</TableCell><TableCell>#{v.id} {v.cliente_nombre}</TableCell>
                    <TableCell className="text-xs">{v.medio_pago}</TableCell><TableCell className="text-right tabular-nums">{money(v.total)}</TableCell>
                  </TableRow>
                ))}
              </TableBody></Table>
            ) : <Vacio>—</Vacio>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Gastos del día</CardTitle>
            <CardAction><Button variant="outline" size="sm" asChild><Link href="/gastos">+ Cargar gasto</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {c.gastosDia.length ? (
              <Table><TableBody>
                {c.gastosDia.map(g => (
                  <TableRow key={g.id}><TableCell>{g.categoria}</TableCell><TableCell className="whitespace-normal">{g.descripcion}</TableCell>
                    <TableCell className="text-xs">{g.medio_pago}</TableCell><TableCell className="text-right tabular-nums">{money(g.monto)}</TableCell></TableRow>
                ))}
              </TableBody></Table>
            ) : <Vacio>—</Vacio>}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Últimos cierres</CardTitle></CardHeader>
        <CardContent>
          {cierres.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead className="text-right">Ventas</TableHead><TableHead className="text-right">Ganancia</TableHead><TableHead className="text-right">Ef. esperado</TableHead><TableHead className="text-right">Ef. contado</TableHead><TableHead className="text-right">Diferencia</TableHead></TableRow></TableHeader>
              <TableBody>
                {cierres.map(x => (
                  <TableRow key={x.id}>
                    <TableCell><Link className="hover:underline" href={`/caja?fecha=${x.fecha}`}>{fechaCorta(x.fecha)}</Link></TableCell>
                    <TableCell className="text-right tabular-nums">{money(x.resumen?.ventas?.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(x.resumen?.ganancia_bruta)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(x.efectivo_esperado)}</TableCell>
                    <TableCell className="text-right tabular-nums">{x.efectivo_contado != null ? money(x.efectivo_contado) : '—'}</TableCell>
                    <TableCell className={cn('text-right tabular-nums', signo(x.diferencia ?? 0))}>{x.diferencia != null ? money(x.diferencia) : '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : <Vacio>Todavía no cerraste ninguna caja</Vacio>}
        </CardContent>
      </Card>
    </>
  )
}
