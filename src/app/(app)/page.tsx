import Link from 'next/link'
import { Calculator, Plus, TriangleAlert } from 'lucide-react'
import { Kpi, PageHeader, Pill, tonoStock, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle, CardAction } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { getDashboard } from '@/lib/queries'
import { fechaLarga, money, numf, pct, signo } from '@/lib/format'
import { NEGOCIO } from '@/negocio'

export default async function Inicio() {
  const d = await getDashboard()
  const fecha = fechaLarga(new Date())
  return (
    <>
      <PageHeader title="Inicio" description={<span className="inline-block first-letter:uppercase">{fecha}</span>}>
        <Button asChild><Link href="/venta"><Plus /> Nueva venta</Link></Button>
        {NEGOCIO.modulos.caja && <Button variant="outline" asChild><Link href="/caja"><Calculator /> {d.cajaHoyCerrada ? 'Caja de hoy cerrada ✓' : 'Cerrar caja de hoy'}</Link></Button>}
      </PageHeader>

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Ventas hoy" value={money(d.hoy.ventas.total)} hint={`${d.hoy.ventas.cantidad} ventas`} />
        <Kpi label="Ganancia hoy" value={money(d.hoy.ganancia_bruta)} hint={`margen ${pct(d.hoy.margen)}`} className={signo(d.hoy.ganancia_bruta)} />
        <Kpi label="Ventas del mes" value={money(d.mes.ventas.total)} hint={`${d.mes.ventas.cantidad} ventas`} />
        <Kpi label="Ganancia bruta mes" value={money(d.mes.ganancia_bruta)} hint={`margen ${pct(d.mes.margen)}`} />
        <Kpi label="Resultado neto mes" value={money(d.mes.resultado)} hint={`gastos ${money(d.mes.gastos)}`} className={signo(d.mes.resultado)} />
        <Kpi label="Stock valorizado" value={money(d.valorStock.costo)} hint={`a precio de venta ${money(d.valorStock.venta)}`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><TriangleAlert className="size-4 text-amber-500" /> Stock bajo <Pill tono={d.stockBajo.length ? 'bad' : 'ok'}>{d.stockBajo.length}</Pill></CardTitle>
            <CardAction><Button variant="outline" size="sm" asChild><Link href="/productos?pedido=1">Pedido sugerido</Link></Button></CardAction>
          </CardHeader>
          <CardContent>
            {d.stockBajo.length ? (
              <div className="max-h-96 overflow-auto">
                <Table>
                  <TableHeader><TableRow><TableHead>Producto</TableHead><TableHead className="text-right">Stock</TableHead><TableHead className="text-right">Mínimo</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {d.stockBajo.map(p => (
                      <TableRow key={p.id}>
                        <TableCell className="whitespace-normal"><span className="text-xs text-muted-foreground">{p.marca}</span> {p.nombre}</TableCell>
                        <TableCell className="text-right"><Pill tono={tonoStock(p.stock, p.stock_minimo)}>{numf(p.stock)}</Pill></TableCell>
                        <TableCell className="text-right text-muted-foreground">{numf(p.stock_minimo)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : <Vacio>Todo el stock está por encima del mínimo.</Vacio>}
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader><CardTitle>Saldos a cobrar</CardTitle></CardHeader>
            <CardContent>
              {d.deudores.length ? (
                <Table><TableBody>
                  {d.deudores.map(c => (
                    <TableRow key={c.id}>
                      <TableCell><Link className="hover:underline" href={`/clientes/${c.id}`}>{c.nombre}</Link> {c.tipo === 'revendedor' && <Pill>{NEGOCIO.textos.mayorista.toLowerCase()}</Pill>}</TableCell>
                      <TableCell className="text-right font-medium text-red-600 dark:text-red-400">{money(c.saldo)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              ) : <Vacio>Nadie te debe plata.</Vacio>}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Lo más rentable del mes</CardTitle></CardHeader>
            <CardContent>
              {d.mes.topProductos.length ? (
                <Table><TableBody>
                  {d.mes.topProductos.slice(0, 6).map(p => (
                    <TableRow key={p.descripcion}>
                      <TableCell className="whitespace-normal">{p.descripcion}</TableCell>
                      <TableCell className="text-right text-muted-foreground">{numf(p.unidades)} u.</TableCell>
                      <TableCell className="text-right font-medium">{money(p.ganancia)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody></Table>
              ) : <Vacio>Todavía no hay ventas este mes.</Vacio>}
            </CardContent>
          </Card>
          {NEGOCIO.modulos.tiendanube && !d.tnConfigurada && (
            <Card className="py-4"><CardContent className="px-4 text-sm">Tienda Nube todavía no está conectada. <Link href="/tiendanube" className="font-medium underline">Configurarla</Link></CardContent></Card>
          )}
        </div>
      </div>
    </>
  )
}
