import 'server-only'
import { sql, type Tx } from './db'
import { ahoraLocal } from './format'
import type { Producto } from './types'

export class ErrorUsuario extends Error {}

export async function moverStock(tx: Tx, productoId: number | null, cantidad: number, motivo: string, ref?: string | null) {
  if (!productoId || !cantidad) return
  await tx`update productos set stock = stock + ${cantidad} where id = ${productoId}`
  await tx`insert into stock_movs (producto_id, fecha, cantidad, motivo, ref) values (${productoId}, ${ahoraLocal()}, ${cantidad}, ${motivo}, ${ref ?? null})`
}

export type NuevaVenta = {
  items: { producto_id: number | null; descripcion?: string; cantidad: number; precio: number; costo?: number }[]
  cliente_id?: number | null; cliente_nombre?: string | null; tipo_precio?: string; medio_pago?: string
  descuento?: number; recargo?: number; envio?: number; entrega?: string | null; notas?: string | null
  fecha?: string; origen?: string; tn_order_id?: string | null
}

const n = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))

export async function crearVenta(v: NuevaVenta) {
  if (!v.items?.length) throw new ErrorUsuario('La venta no tiene productos')
  if (v.medio_pago === 'Cuenta corriente' && !v.cliente_id) throw new ErrorUsuario('Para vender a cuenta corriente elegí un cliente')
  const fecha = v.fecha || ahoraLocal()
  return sql.begin(async tx => {
    let subtotal = 0, costo = 0
    const items = []
    for (const it of v.items) {
      const [p] = it.producto_id ? await tx<Producto[]>`select * from productos where id = ${it.producto_id}` : []
      const cantidad = n(it.cantidad) || 1, precio = n(it.precio)
      const c = it.costo != null ? n(it.costo) : p ? p.costo : 0
      subtotal += cantidad * precio
      costo += cantidad * c
      items.push({ producto_id: p ? p.id : null, descripcion: it.descripcion || (p ? `${p.marca} ${p.nombre}`.trim() : 'Ítem'), cantidad, precio, costo: c })
    }
    const descuento = n(v.descuento), recargo = n(v.recargo), envio = n(v.envio)
    const total = Math.round((subtotal - descuento + recargo + envio) * 100) / 100
    const [cliente] = v.cliente_id ? await tx<{ id: number; nombre: string }[]>`select id, nombre from clientes where id = ${v.cliente_id}` : []
    const [{ id }] = await tx<{ id: number }[]>`
      insert into ventas (fecha, cliente_id, cliente_nombre, tipo_precio, medio_pago, entrega, subtotal, descuento, recargo, envio, total, costo, notas, origen, tn_order_id)
      values (${fecha}, ${cliente?.id ?? null}, ${cliente?.nombre ?? v.cliente_nombre ?? null}, ${v.tipo_precio || 'publico'}, ${v.medio_pago || 'Efectivo'},
        ${v.entrega || null}, ${subtotal}, ${descuento}, ${recargo}, ${envio}, ${total}, ${costo}, ${v.notas || null}, ${v.origen || 'local'}, ${v.tn_order_id || null})
      returning id`
    for (const it of items) {
      await tx`insert into venta_items (venta_id, producto_id, descripcion, cantidad, precio, costo)
        values (${id}, ${it.producto_id}, ${it.descripcion}, ${it.cantidad}, ${it.precio}, ${it.costo})`
      await moverStock(tx, it.producto_id, -it.cantidad, 'Venta', 'venta:' + id)
    }
    if (v.medio_pago === 'Cuenta corriente')
      await tx`insert into cc_movimientos (cliente_id, fecha, tipo, monto, descripcion, venta_id)
        values (${cliente.id}, ${fecha}, 'cargo', ${total}, ${'Venta #' + id}, ${id})`
    return { id, total, productos: items.map(i => i.producto_id).filter((x): x is number => !!x) }
  })
}

export async function anularVenta(id: number) {
  return sql.begin(async tx => {
    const [v] = await tx<{ anulada: boolean }[]>`select anulada from ventas where id = ${id} for update`
    if (!v) throw new ErrorUsuario('Venta no encontrada')
    if (v.anulada) throw new ErrorUsuario('La venta ya está anulada')
    const items = await tx<{ producto_id: number | null; cantidad: number }[]>`select producto_id, cantidad from venta_items where venta_id = ${id}`
    for (const it of items) await moverStock(tx, it.producto_id, it.cantidad, 'Anulación venta', 'venta:' + id)
    await tx`delete from cc_movimientos where venta_id = ${id}`
    await tx`update ventas set anulada = true where id = ${id}`
    return { productos: items.map(i => i.producto_id).filter((x): x is number => !!x) }
  })
}
