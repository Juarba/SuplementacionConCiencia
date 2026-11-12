'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { sql } from '@/lib/db'
import { requireSession } from '@/lib/auth'
import { COOKIE, crearToken } from '@/lib/session'
import { ahoraLocal, hoyLocal } from '@/lib/format'
import { getConfig, getMovimientosStock, resumenCaja } from '@/lib/queries'
import { anularVenta, crearVenta, ErrorUsuario, moverStock, type NuevaVenta } from '@/lib/ventas'
import * as TN from '@/lib/tiendanube'
import type { Producto, Resultado } from '@/lib/types'

const n = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))
const nOrNull = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? null : Number(v))
const txt = (v: unknown) => (v == null || v === '' ? null : String(v))

/** Envuelve cada acción: exige sesión, captura errores y refresca los datos de la pantalla */
async function accion<T>(fn: () => Promise<T>, mensaje?: string): Promise<Resultado<T>> {
  await requireSession()
  try {
    const data = await fn()
    revalidatePath('/', 'layout')
    return { ok: true, data, mensaje }
  } catch (e) {
    if (!(e instanceof ErrorUsuario)) console.error(e)
    return { ok: false, error: e instanceof ErrorUsuario ? e.message : 'Error inesperado: ' + (e as Error).message }
  }
}

// ---------- sesión ----------
export async function login(_: unknown, form: FormData) {
  const pass = String(form.get('password') || '')
  const esperada = process.env.APP_PASSWORD
  if (!esperada) return { error: 'Falta configurar APP_PASSWORD en el servidor' }
  if (pass !== esperada) {
    await new Promise(r => setTimeout(r, 800)) // frena intentos por fuerza bruta
    return { error: 'Contraseña incorrecta' }
  }
  const { token, expira } = await crearToken()
  ;(await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', expires: expira, path: '/' })
  redirect('/')
}

export async function logout() {
  ;(await cookies()).delete(COOKIE)
  redirect('/login')
}

// ---------- ventas ----------
export async function registrarVenta(v: NuevaVenta) {
  return accion(async () => {
    const r = await crearVenta({ ...v, origen: 'local', tn_order_id: null })
    await TN.autoPublicar(r.productos)
    return r
  })
}

export async function anular(id: number) {
  return accion(async () => { const r = await anularVenta(id); await TN.autoPublicar(r.productos) }, 'Venta anulada')
}

// ---------- productos ----------
export type ProductoForm = {
  id?: number; marca: string; nombre: string; sku?: string; costo: number | string; precio: number | string
  precio_revendedor?: number | string | null; stock?: number | string; stock_minimo: number | string; stock_ideal: number | string; activo?: boolean
}

export async function guardarProducto(p: ProductoForm) {
  return accion(async () => {
    if (!p.nombre?.trim()) throw new ErrorUsuario('Falta el nombre')
    const datos = {
      marca: (p.marca || '').trim(), nombre: p.nombre.trim(), sku: txt(p.sku), costo: n(p.costo), precio: n(p.precio),
      precio_revendedor: nOrNull(p.precio_revendedor), stock_minimo: n(p.stock_minimo), stock_ideal: n(p.stock_ideal), activo: p.activo !== false,
    }
    if (p.id) {
      await sql`update productos set ${sql(datos)} where id = ${p.id}`
      return p.id
    }
    return sql.begin(async tx => {
      const [{ id }] = await tx<{ id: number }[]>`insert into productos ${sql(datos)} returning id`
      await moverStock(tx, id, n(p.stock), 'Stock inicial')
      return id
    })
  }, 'Producto guardado')
}

export async function eliminarProducto(id: number) {
  return accion(async () => {
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int c from venta_items where producto_id = ${id}`
    if (c) { await sql`update productos set activo = false where id = ${id}`; return 'Tiene ventas: quedó desactivado' }
    await sql`delete from productos where id = ${id}`
    return 'Producto eliminado'
  })
}

export async function movimientoStock(id: number, d: { tipo: 'ingreso' | 'ajuste'; cantidad: number | string; costo?: number | string; nota?: string; registrar_gasto?: boolean; medio_pago?: string }) {
  return accion(async () => {
    await sql.begin(async tx => {
      const [p] = await tx<Producto[]>`select * from productos where id = ${id} for update`
      if (!p) throw new ErrorUsuario('Producto no encontrado')
      if (d.tipo === 'ajuste') return moverStock(tx, id, n(d.cantidad) - p.stock, 'Ajuste de inventario', txt(d.nota))
      const cant = n(d.cantidad)
      if (!cant) throw new ErrorUsuario('Indicá la cantidad')
      await moverStock(tx, id, cant, 'Ingreso de mercadería', txt(d.nota))
      const costo = nOrNull(d.costo) ?? p.costo
      if (nOrNull(d.costo) != null) await tx`update productos set costo = ${costo} where id = ${id}`
      if (d.registrar_gasto && costo)
        await tx`insert into gastos (fecha, categoria, descripcion, monto, medio_pago)
          values (${hoyLocal()}, 'Mercadería', ${`${cant} × ${p.marca} ${p.nombre}`.trim()}, ${cant * costo}, ${d.medio_pago || 'Transferencia'})`
    })
    await TN.autoPublicar([id])
  }, 'Stock actualizado')
}

export async function verMovimientosStock(id: number) {
  await requireSession()
  return getMovimientosStock(id)
}

export async function actualizarPrecios(d: { marca: string; porc_costo: number | string; porc_precio: number | string; porc_revendedor: number | string; redondeo: number | string }) {
  return accion(async () => {
    const pc = 1 + n(d.porc_costo) / 100, pp = 1 + n(d.porc_precio) / 100, pr = 1 + n(d.porc_revendedor) / 100
    const red = n(d.redondeo) || 1
    const filtro = d.marca ? sql`where marca = ${d.marca}` : sql``
    const r = await sql`update productos set
        costo = round(costo * ${pc}),
        precio = round(precio * ${pp} / ${red}) * ${red},
        precio_revendedor = case when precio_revendedor is null then null else round(precio_revendedor * ${pr} / ${red}) * ${red} end
      ${filtro}`
    return r.count
  })
}

// ---------- clientes y cuenta corriente ----------
export type ClienteForm = { id?: number; nombre: string; telefono?: string; direccion?: string; tipo: string; descuento?: number | string | null; notas?: string }

export async function guardarCliente(c: ClienteForm) {
  return accion(async () => {
    if (!c.nombre?.trim()) throw new ErrorUsuario('Falta el nombre')
    const datos = {
      nombre: c.nombre.trim(), telefono: txt(c.telefono), direccion: txt(c.direccion),
      tipo: c.tipo === 'revendedor' ? 'revendedor' : 'cliente', descuento: nOrNull(c.descuento), notas: txt(c.notas),
    }
    if (c.id) { await sql`update clientes set ${sql(datos)} where id = ${c.id}`; return c.id }
    const [{ id }] = await sql<{ id: number }[]>`insert into clientes ${sql(datos)} returning id`
    return id
  }, 'Cliente guardado')
}

export async function eliminarCliente(id: number) {
  return accion(async () => {
    const [{ c }] = await sql<{ c: number }[]>`select (select count(*) from ventas where cliente_id = ${id}) + (select count(*) from cc_movimientos where cliente_id = ${id}) c`
    if (Number(c)) throw new ErrorUsuario('El cliente tiene ventas o movimientos; no se puede borrar')
    await sql`delete from clientes where id = ${id}`
  }, 'Cliente eliminado')
}

export async function registrarMovimiento(clienteId: number, d: { tipo: 'cargo' | 'pago'; monto: number | string; fecha?: string; descripcion?: string; medio_pago?: string }) {
  return accion(async () => {
    if (!['cargo', 'pago'].includes(d.tipo) || !n(d.monto)) throw new ErrorUsuario('Indicá el monto')
    await sql`insert into cc_movimientos (cliente_id, fecha, tipo, monto, descripcion, medio_pago)
      values (${clienteId}, ${d.fecha?.replace('T', ' ') || ahoraLocal()}, ${d.tipo}, ${n(d.monto)},
        ${txt(d.descripcion) || (d.tipo === 'pago' ? 'Pago' : 'Cargo manual')}, ${d.tipo === 'pago' ? d.medio_pago || 'Efectivo' : null})`
  }, 'Movimiento registrado')
}

export async function borrarMovimiento(id: number) {
  return accion(async () => {
    const [m] = await sql<{ venta_id: number | null }[]>`select venta_id from cc_movimientos where id = ${id}`
    if (m?.venta_id) throw new ErrorUsuario('Ese cargo viene de una venta: anulá la venta')
    await sql`delete from cc_movimientos where id = ${id}`
  }, 'Movimiento borrado')
}

// ---------- gastos ----------
export async function guardarGasto(g: { fecha: string; categoria: string; descripcion?: string; monto: number | string; medio_pago: string }) {
  return accion(async () => {
    if (!n(g.monto)) throw new ErrorUsuario('Falta el monto')
    await sql`insert into gastos (fecha, categoria, descripcion, monto, medio_pago)
      values (${g.fecha || hoyLocal()}, ${g.categoria || 'Otros'}, ${txt(g.descripcion)}, ${n(g.monto)}, ${g.medio_pago || 'Efectivo'})`
  }, 'Gasto agregado')
}

export async function borrarGasto(id: number) {
  return accion(async () => { await sql`delete from gastos where id = ${id}` }, 'Gasto borrado')
}

// ---------- caja ----------
export async function cerrarCaja(fecha: string, d: { efectivo_inicial: number | string; efectivo_contado: number | string; notas?: string }) {
  return accion(async () => {
    const c = await resumenCaja(fecha)
    const inicial = nOrNull(d.efectivo_inicial) ?? c.efectivo.inicial
    const esperado = inicial + c.efectivo.ventas + c.efectivo.cobros - c.efectivo.gastos
    const contado = nOrNull(d.efectivo_contado)
    const resumen = { ventas: c.ventas, porMedio: c.porMedio, cobros: c.cobros, gastos: c.gastos, ganancia_bruta: c.ganancia_bruta, resultado: c.resultado }
    await sql`insert into cierres (fecha, efectivo_inicial, efectivo_contado, efectivo_esperado, diferencia, resumen, notas)
      values (${fecha}, ${inicial}, ${contado}, ${esperado}, ${contado == null ? null : contado - esperado}, ${sql.json(resumen)}, ${txt(d.notas)})
      on conflict (fecha) do update set efectivo_inicial = excluded.efectivo_inicial, efectivo_contado = excluded.efectivo_contado,
        efectivo_esperado = excluded.efectivo_esperado, diferencia = excluded.diferencia, resumen = excluded.resumen, notas = excluded.notas,
        creado = ${ahoraLocal()}`
  }, 'Caja cerrada')
}

// ---------- configuración ----------
const CLAVES = ['negocio', 'medios_pago', 'descuento_revendedor', 'categorias_gastos',
  'tn_store_id', 'tn_token', 'tn_email', 'tn_auto_stock', 'tn_app_id', 'tn_client_secret']

export async function guardarConfig(d: Record<string, string>) {
  return accion(async () => {
    const filas = Object.entries(d)
      .filter(([k, v]) => CLAVES.includes(k) && !(['tn_token', 'tn_client_secret'].includes(k) && String(v).startsWith('••••')))
      .map(([clave, valor]) => ({ clave, valor: String(valor ?? '').trim() }))
    if (filas.length) await sql`insert into config ${sql(filas)} on conflict (clave) do update set valor = excluded.valor`
  }, 'Configuración guardada')
}

// ---------- Tienda Nube ----------
export const tnProbar = async () => accion(TN.probar)
export const tnProductos = async () => accion(TN.productosTN)
export const tnVincularAuto = async () => accion(TN.vincularAuto)
export const tnImportar = async (desde: string) => accion(() => TN.importarOrdenes(desde))
export const tnPublicar = async (opc: { stock: boolean; precio: boolean }) => accion(() => TN.publicar(null, opc))
export async function tnVincular(productoId: number, tnProductId: number | null, tnVariantId: number | null) {
  return accion(async () => {
    await sql`update productos set tn_product_id = ${tnProductId}, tn_variant_id = ${tnVariantId} where id = ${productoId}`
  })
}
export async function tnUrlAutorizar() {
  await requireSession()
  const cfg = await getConfig()
  return cfg.tn_app_id ? `https://www.tiendanube.com/apps/${encodeURIComponent(cfg.tn_app_id)}/authorize` : null
}
