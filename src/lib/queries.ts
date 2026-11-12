import 'server-only'
import { sql } from './db'
import { hoyLocal, ultimoDia } from './format'
import type { Cierre, Cliente, Config, Gasto, Movimiento, Producto, Resumen, StockMov, Venta, VentaItem } from './types'

export async function getConfig(): Promise<Config> {
  const rows = await sql<{ clave: string; valor: string }[]>`select clave, valor from config`
  return Object.fromEntries(rows.map(r => [r.clave, r.valor ?? '']))
}

/** Config para mostrar en pantalla, con los secretos tapados */
export async function getConfigPublica(): Promise<Config> {
  const c = await getConfig()
  for (const k of ['tn_token', 'tn_client_secret']) c[k] = c[k] ? '••••••' + c[k].slice(-4) : ''
  return c
}

export function precioRevendedor(p: { precio: number; precio_revendedor: number | null }, cfg: Config, descuentoCliente?: number | null) {
  if (descuentoCliente != null) return Math.round(p.precio * (1 - descuentoCliente / 100))
  if (p.precio_revendedor != null) return p.precio_revendedor
  return Math.round(p.precio * (1 - Number(cfg.descuento_revendedor || 0) / 100))
}

export async function getProductos(): Promise<Producto[]> {
  const [rows, cfg] = await Promise.all([sql<Producto[]>`select * from productos order by marca, nombre`, getConfig()])
  return rows.map(p => ({ ...p, precio_revendedor_calc: precioRevendedor(p, cfg) }))
}

export const getMovimientosStock = (id: number) =>
  sql<StockMov[]>`select * from stock_movs where producto_id = ${id} order by id desc limit 100`

const saldo = sql`coalesce((select sum(case when m.tipo = 'cargo' then m.monto else -m.monto end) from cc_movimientos m where m.cliente_id = c.id), 0)`

export const getClientes = () => sql<Cliente[]>`
  select c.*, ${saldo} saldo,
    (select max(fecha) from ventas v where v.cliente_id = c.id and not v.anulada) ultima_compra,
    (select coalesce(sum(total), 0) from ventas v where v.cliente_id = c.id and not v.anulada) total_comprado
  from clientes c order by c.nombre`

export async function getCuenta(id: number) {
  const [cliente] = await sql<Cliente[]>`select c.*, ${saldo} saldo, null ultima_compra, 0 total_comprado from clientes c where id = ${id}`
  if (!cliente) return null
  const movimientos = await sql<Movimiento[]>`select * from cc_movimientos where cliente_id = ${id} order by fecha, id`
  let s = 0
  for (const m of movimientos) { s += m.tipo === 'cargo' ? m.monto : -m.monto; m.saldo = s }
  const ventas = await sql<Venta[]>`select * from ventas where cliente_id = ${id} order by fecha desc limit 50`
  return { cliente, movimientos: [...movimientos].reverse(), ventas }
}

export async function getVentas(desde: string, hasta: string): Promise<Venta[]> {
  const ventas = await sql<Venta[]>`select * from ventas where fecha >= ${desde}::date and fecha < ${hasta}::date + 1 order by fecha desc, id desc`
  if (!ventas.length) return []
  const items = await sql<VentaItem[]>`select * from venta_items where venta_id in ${sql(ventas.map(v => v.id))} order by id`
  const por: Record<number, VentaItem[]> = {}
  for (const it of items) (por[it.venta_id] ||= []).push(it)
  return ventas.map(v => ({ ...v, items: por[v.id] || [] }))
}

export const getGastos = (desde: string, hasta: string) =>
  sql<Gasto[]>`select * from gastos where fecha between ${desde} and ${hasta} order by fecha desc, id desc`

export async function resumenPeriodo(desde: string, hasta: string): Promise<Resumen> {
  const enRango = sql`fecha >= ${desde}::date and fecha < ${hasta}::date + 1`
  const vRango = sql`v.fecha >= ${desde}::date and v.fecha < ${hasta}::date + 1`
  const gRango = sql`fecha between ${desde} and ${hasta}`
  const [[ventas], porMedio, porOrigen, cobros, [g], gastosPorCategoria, gastosPorMedio, topProductos, porDia, gastosDia] = await Promise.all([
    sql<Resumen['ventas'][]>`select count(*)::int cantidad, coalesce(sum(total),0) total, coalesce(sum(costo),0) costo,
      coalesce(sum(envio),0) envio, coalesce(sum(descuento),0) descuento, coalesce(sum(recargo),0) recargo
      from ventas where not anulada and ${enRango}`,
    sql<Resumen['porMedio']>`select medio_pago, count(*)::int cantidad, sum(total) total from ventas
      where not anulada and ${enRango} group by medio_pago order by total desc`,
    sql<Resumen['porOrigen']>`select origen, count(*)::int cantidad, sum(total) total, sum(total - costo - recargo) ganancia
      from ventas where not anulada and ${enRango} group by origen`,
    sql<Resumen['cobros']>`select medio_pago, sum(monto) total from cc_movimientos where tipo = 'pago' and ${enRango} group by medio_pago`,
    sql<{ total: number }[]>`select coalesce(sum(monto),0) total from gastos where ${gRango}`,
    sql<Resumen['gastosPorCategoria']>`select categoria, sum(monto) total from gastos where ${gRango} group by categoria order by total desc`,
    sql<Resumen['gastosPorMedio']>`select medio_pago, sum(monto) total from gastos where ${gRango} group by medio_pago`,
    sql<Resumen['topProductos']>`select min(vi.descripcion) descripcion, sum(vi.cantidad) unidades, sum(vi.cantidad * vi.precio) vendido,
        sum(vi.cantidad * (vi.precio - vi.costo)) ganancia
      from venta_items vi join ventas v on v.id = vi.venta_id
      where not v.anulada and ${vRango} group by coalesce(vi.producto_id::text, vi.descripcion) order by ganancia desc limit 15`,
    sql<{ dia: string; cantidad: number; total: number; ganancia: number }[]>`select to_char(fecha, 'YYYY-MM-DD') dia, count(*)::int cantidad,
      sum(total) total, sum(total - costo - recargo) ganancia from ventas where not anulada and ${enRango} group by 1 order by 1`,
    sql<{ dia: string; total: number }[]>`select to_char(fecha, 'YYYY-MM-DD') dia, sum(monto) total from gastos where ${gRango} group by 1`,
  ])
  // el recargo de tarjeta se lo queda la procesadora: no es ganancia
  const ganancia_bruta = ventas.total - ventas.costo - ventas.recargo
  const dias: Record<string, Resumen['porDia'][number]> = {}
  for (const d of porDia) dias[d.dia] = { ...d, gastos: 0 }
  for (const d of gastosDia) (dias[d.dia] ||= { dia: d.dia, cantidad: 0, total: 0, ganancia: 0, gastos: 0 }).gastos = d.total
  return {
    desde, hasta, ventas, porMedio, porOrigen, cobros, gastos: g.total, gastosPorCategoria, gastosPorMedio, topProductos,
    porDia: Object.values(dias).sort((a, b) => a.dia.localeCompare(b.dia)),
    ganancia_bruta, resultado: ganancia_bruta - g.total, margen: ventas.total ? ganancia_bruta / ventas.total : 0,
  }
}

export async function resumenCaja(fecha: string) {
  const [r, [cierre], [anterior], ventasDia, gastosDia] = await Promise.all([
    resumenPeriodo(fecha, fecha),
    sql<Cierre[]>`select * from cierres where fecha = ${fecha}`,
    sql<Cierre[]>`select * from cierres where fecha < ${fecha} order by fecha desc limit 1`,
    sql<Venta[]>`select * from ventas where fecha >= ${fecha}::date and fecha < ${fecha}::date + 1 order by fecha`,
    sql<Gasto[]>`select * from gastos where fecha = ${fecha} order by id`,
  ])
  const suma = (l: { medio_pago: string; total: number }[]) => l.filter(m => m.medio_pago === 'Efectivo').reduce((a, m) => a + m.total, 0)
  const inicial = cierre ? cierre.efectivo_inicial : anterior?.efectivo_contado ?? 0
  const efectivo = { inicial, ventas: suma(r.porMedio), cobros: suma(r.cobros), gastos: suma(r.gastosPorMedio), esperado: 0 }
  efectivo.esperado = inicial + efectivo.ventas + efectivo.cobros - efectivo.gastos
  return { ...r, efectivo, cierre: cierre ?? null, ventasDia, gastosDia }
}

export const getCierres = () => sql<Cierre[]>`select * from cierres order by fecha desc limit 90`

export async function reporteAnual(anio: string) {
  const desde = `${anio}-01-01`, hasta = ultimoDia(`${anio}-12`)
  const [ventas, gastos] = await Promise.all([
    sql<{ mes: string; cantidad: number; total: number; ganancia: number }[]>`
      select to_char(fecha, 'YYYY-MM') mes, count(*)::int cantidad, sum(total) total, sum(total - costo - recargo) ganancia
      from ventas where not anulada and fecha >= ${desde}::date and fecha < ${hasta}::date + 1 group by 1`,
    sql<{ mes: string; total: number }[]>`select to_char(fecha, 'YYYY-MM') mes, sum(monto) total from gastos where fecha between ${desde} and ${hasta} group by 1`,
  ])
  return Array.from({ length: 12 }, (_, i) => {
    const mes = `${anio}-${String(i + 1).padStart(2, '0')}`
    const v = ventas.find(x => x.mes === mes), g = gastos.find(x => x.mes === mes)?.total ?? 0
    const gb = v?.ganancia ?? 0
    return { mes, ventas: v?.total ?? 0, cantidad: v?.cantidad ?? 0, ganancia_bruta: gb, gastos: g, resultado: gb - g }
  })
}

export async function getDashboard() {
  const d = hoyLocal()
  const [hoy, mes, stockBajo, [valorStock], deudores, [cerrada], cfg] = await Promise.all([
    resumenPeriodo(d, d),
    resumenPeriodo(d.slice(0, 8) + '01', d),
    sql<Producto[]>`select * from productos where activo and stock_minimo > 0 and stock <= stock_minimo order by stock - stock_minimo, marca, nombre`,
    sql<{ costo: number; venta: number }[]>`select coalesce(sum(stock * costo),0) costo, coalesce(sum(stock * precio),0) venta from productos where activo and stock > 0`,
    sql<{ id: number; nombre: string; tipo: string; saldo: number }[]>`select * from (select c.id, c.nombre, c.tipo, ${saldo} saldo from clientes c) x where saldo > 0.5 order by saldo desc limit 10`,
    sql`select 1 from cierres where fecha = ${d}`,
    getConfig(),
  ])
  return { hoy, mes, stockBajo, valorStock, deudores, cajaHoyCerrada: !!cerrada, tnConfigurada: !!(cfg.tn_store_id && cfg.tn_token) }
}
