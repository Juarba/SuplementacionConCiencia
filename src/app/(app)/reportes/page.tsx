import type { Metadata } from 'next'
import Link from 'next/link'
import { Kpi, PageHeader, Vacio } from '@/components/common'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { reporteAnual, resumenPeriodo } from '@/lib/queries'
import { MESES, fechaCorta, mesLocal, money, nombreMes, numf, pct, signo, ultimoDia } from '@/lib/format'
import { cn } from '@/lib/utils'
import { Imprimir, SelectorMes } from './controles'

export const metadata: Metadata = { title: 'Reportes' }

export default async function Reportes({ searchParams }: PageProps<'/reportes'>) {
  const q = await searchParams
  const mes = typeof q.mes === 'string' && /^\d{4}-\d{2}$/.test(q.mes) ? q.mes : mesLocal()
  const [r, anual] = await Promise.all([resumenPeriodo(`${mes}-01`, ultimoDia(mes)), reporteAnual(mes.slice(0, 4))])
  const maxA = Math.max(1, ...anual.map(m => m.ventas))
  const suma = (k: 'ventas' | 'ganancia_bruta' | 'gastos' | 'resultado') => anual.reduce((a, m) => a + m[k], 0)

  return (
    <>
      <PageHeader title={<>Cierre mensual — <span className="inline-block first-letter:uppercase">{nombreMes(mes)}</span></>} description="Ventas, costo de mercadería (CMV), gastos y ganancia">
        <SelectorMes mes={mes} />
        <Imprimir />
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Kpi label="Ventas" value={money(r.ventas.total)} hint={`${r.ventas.cantidad} ventas · ticket prom. ${money(r.ventas.cantidad ? r.ventas.total / r.ventas.cantidad : 0)}`} />
        <Kpi label="CMV (costo)" value={money(r.ventas.costo)} hint={r.ventas.recargo ? `+ ${money(r.ventas.recargo)} recargos` : undefined} />
        <Kpi label="Ganancia bruta" value={money(r.ganancia_bruta)} hint={`margen ${pct(r.margen)}`} className={signo(r.ganancia_bruta)} />
        <Kpi label="Gastos" value={money(r.gastos)} />
        <Kpi label="Resultado neto" value={money(r.resultado)} hint={r.ventas.total ? `rentabilidad ${pct(r.resultado / r.ventas.total)}` : undefined} className={signo(r.resultado)} />
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>Día por día</CardTitle></CardHeader>
          <CardContent className="max-h-[440px] overflow-auto">
            {r.porDia.length ? (
              <Table>
                <TableHeader><TableRow><TableHead>Día</TableHead><TableHead className="text-right">Ventas</TableHead><TableHead className="text-right">Total</TableHead><TableHead className="text-right">Ganancia</TableHead><TableHead className="text-right">Gastos</TableHead><TableHead className="text-right">Neto</TableHead></TableRow></TableHeader>
                <TableBody>
                  {r.porDia.map(d => (
                    <TableRow key={d.dia}>
                      <TableCell><Link className="hover:underline" href={`/caja?fecha=${d.dia}`}>{fechaCorta(d.dia)}</Link></TableCell>
                      <TableCell className="text-right text-muted-foreground">{d.cantidad}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.total)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.ganancia)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(d.gastos)}</TableCell>
                      <TableCell className={cn('text-right tabular-nums', signo(d.ganancia - d.gastos))}>{money(d.ganancia - d.gastos)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : <Vacio>Sin movimientos</Vacio>}
          </CardContent>
        </Card>
        <div className="grid content-start gap-4">
          <MiniTabla titulo="Gastos por categoría" filas={r.gastosPorCategoria.map(g => [g.categoria, money(g.total), pct(g.total / (r.gastos || 1))])} />
          <MiniTabla titulo="Por medio de pago" filas={r.porMedio.map(m => [m.medio_pago, String(m.cantidad), money(m.total)])} />
          <MiniTabla titulo="Por canal" filas={r.porOrigen.map(o => [o.origen === 'tiendanube' ? 'Tienda Nube' : 'Venta directa', String(o.cantidad), money(o.total), `gan. ${money(o.ganancia)}`])} />
        </div>
      </div>

      <Card className="mb-4">
        <CardHeader><CardTitle>Productos más rentables del mes</CardTitle></CardHeader>
        <CardContent>
          {r.topProductos.length ? (
            <Table>
              <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Unidades</TableHead><TableHead className="text-right">Vendido</TableHead><TableHead className="text-right">Ganancia</TableHead></TableRow></TableHeader>
              <TableBody>{r.topProductos.map(p => (
                <TableRow key={p.descripcion}><TableCell className="whitespace-normal">{p.descripcion}</TableCell><TableCell className="text-right">{numf(p.unidades)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(p.vendido)}</TableCell><TableCell className="text-right tabular-nums">{money(p.ganancia)}</TableCell></TableRow>
              ))}</TableBody>
            </Table>
          ) : <Vacio>—</Vacio>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Año {mes.slice(0, 4)}</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader><TableRow><TableHead>Mes</TableHead><TableHead className="w-1/3" /><TableHead className="text-right">Ventas</TableHead><TableHead className="text-right">Ganancia bruta</TableHead><TableHead className="text-right">Gastos</TableHead><TableHead className="text-right">Resultado</TableHead></TableRow></TableHeader>
            <TableBody>
              {anual.map(m => (
                <TableRow key={m.mes} className={cn(m.mes === mes && 'bg-muted/50')}>
                  <TableCell className="capitalize"><Link className="hover:underline" href={`/reportes?mes=${m.mes}`}>{MESES[+m.mes.slice(5) - 1]}</Link></TableCell>
                  <TableCell><div className="h-2 rounded-full bg-primary" style={{ width: `${(m.ventas / maxA) * 100}%`, minWidth: m.ventas ? 2 : 0 }} /></TableCell>
                  <TableCell className="text-right tabular-nums">{money(m.ventas)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(m.ganancia_bruta)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(m.gastos)}</TableCell>
                  <TableCell className={cn('text-right tabular-nums', signo(m.resultado))}>{money(m.resultado)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow><TableCell>Total</TableCell><TableCell /><TableCell className="text-right">{money(suma('ventas'))}</TableCell><TableCell className="text-right">{money(suma('ganancia_bruta'))}</TableCell>
                <TableCell className="text-right">{money(suma('gastos'))}</TableCell><TableCell className="text-right">{money(suma('resultado'))}</TableCell></TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>
    </>
  )
}

function MiniTabla({ titulo, filas }: { titulo: string; filas: string[][] }) {
  return (
    <Card>
      <CardHeader><CardTitle>{titulo}</CardTitle></CardHeader>
      <CardContent>
        {filas.length ? (
          <Table><TableBody>
            {filas.map((f, i) => <TableRow key={i}>{f.map((c, j) => <TableCell key={j} className={cn(j > 0 && 'text-right tabular-nums', j === 1 && f.length > 3 && 'text-muted-foreground')}>{c}</TableCell>)}</TableRow>)}
          </TableBody></Table>
        ) : <Vacio>—</Vacio>}
      </CardContent>
    </Card>
  )
}
