import 'server-only'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { sql } from './db'
import { ahoraLocal, hoyLocal } from './format'
import { getConfig } from './queries'
import { crearVenta, ErrorUsuario } from './ventas'
import type { Producto } from './types'
import { NEGOCIO } from '@/negocio'

type TnTexto = string | Record<string, string> | null | undefined
const texto = (v: TnTexto) => (v == null ? '' : typeof v === 'string' ? v : v.es || v.pt || Object.values(v)[0] || '')
const num = (v: unknown) => (v === '' || v == null || isNaN(Number(v)) ? 0 : Number(v))

class TnError extends ErrorUsuario { constructor(msg: string, public status: number) { super(msg) } }

async function tn<T = unknown>(method: string, endpoint: string, body?: unknown): Promise<T> {
  const cfg = await getConfig()
  if (!cfg.tn_store_id || !cfg.tn_token) throw new ErrorUsuario('Configurá el ID de tienda y el token de Tienda Nube primero')
  const res = await fetch(`https://api.tiendanube.com/v1/${cfg.tn_store_id}${endpoint}`, {
    method,
    headers: {
      Authentication: `bearer ${cfg.tn_token}`,
      'User-Agent': `Gestion ${NEGOCIO.nombre} (${cfg.tn_email || 'sin-email'})`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  })
  const raw = await res.text()
  let data: unknown
  try { data = JSON.parse(raw) } catch { data = raw }
  if (!res.ok) {
    const d = data as { description?: string; message?: string }
    throw new TnError(`Tienda Nube respondió ${res.status}: ${typeof data === 'string' ? data.slice(0, 200) : d.description || d.message || JSON.stringify(data).slice(0, 200)}`, res.status)
  }
  return data as T
}

async function paginado<T>(endpoint: string): Promise<T[]> {
  const out: T[] = []
  for (let page = 1; page < 100; page++) {
    let lote: T[]
    try { lote = await tn<T[]>('GET', `${endpoint}${endpoint.includes('?') ? '&' : '?'}per_page=200&page=${page}`) }
    catch (e) { if (e instanceof TnError && e.status === 404) break; throw e } // TN devuelve 404 después de la última página
    out.push(...lote)
    if (lote.length < 200) break
  }
  return out
}

export async function canjearCodigo(code: string) {
  const cfg = await getConfig()
  if (!cfg.tn_app_id || !cfg.tn_client_secret) throw new ErrorUsuario('Guardá primero el App ID y el Client Secret de tu app de Tienda Nube')
  const res = await fetch('https://www.tiendanube.com/apps/authorize/token', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ client_id: cfg.tn_app_id, client_secret: cfg.tn_client_secret, grant_type: 'authorization_code', code }),
  })
  const data = await res.json().catch(() => ({}))
  if (!data.access_token) throw new ErrorUsuario('Tienda Nube no devolvió un token: ' + (data.error_description || data.error || res.status))
  await sql`insert into config ${sql([{ clave: 'tn_token', valor: data.access_token }, { clave: 'tn_store_id', valor: String(data.user_id) }])}
    on conflict (clave) do update set valor = excluded.valor`
}

export async function probar() {
  const s = await tn<{ name: TnTexto; original_domain?: string }>('GET', '/store')
  return texto(s.name)
}

export type TnVariante = { tn_product_id: number; tn_variant_id: number; nombre: string; sku: string; precio: number; costo: number; stock: number | null }

export async function productosTN(): Promise<TnVariante[]> {
  type P = { id: number; name: TnTexto; variants?: { id: number; price: string; cost?: string | null; stock: number | null; sku: string | null; values?: TnTexto[] }[] }
  const prods = await paginado<P>('/products')
  return prods.flatMap(p => (p.variants || []).map(v => {
    const valores = (v.values || []).map(texto).filter(Boolean).join(' / ')
    return { tn_product_id: p.id, tn_variant_id: v.id, nombre: texto(p.name) + (valores ? ' — ' + valores : ''), sku: v.sku || '', precio: num(v.price), costo: num(v.cost), stock: v.stock }
  }))
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

/** Busca el producto del sistema para un ítem de TN: por variante vinculada, después por SKU y por nombre */
async function buscarProducto(variantId: number | null | undefined, sku: string | null | undefined, nombre: string) {
  if (variantId) {
    const [p] = await sql<Producto[]>`select * from productos where tn_variant_id = ${variantId}`
    if (p) return p
  }
  if (sku?.trim()) {
    const [p] = await sql<Producto[]>`select * from productos where upper(trim(sku)) = ${sku.trim().toUpperCase()} limit 1`
    if (p) return p
  }
  const nn = normalizar(nombre)
  if (!nn) return undefined
  const todos = await sql<Producto[]>`select * from productos`
  return todos.find(p => normalizar(p.nombre) === nn || normalizar(`${p.marca} ${p.nombre}`) === nn)
}

export async function vincularAuto() {
  const tnProds = await productosTN()
  const locales = await sql<Producto[]>`select * from productos where tn_variant_id is null`
  const usados = new Set((await sql<{ v: number }[]>`select tn_variant_id v from productos where tn_variant_id is not null`).map(r => r.v))
  let vinculados = 0
  for (const p of locales) {
    const cand = tnProds.find(t => !usados.has(t.tn_variant_id) && (
      (p.sku && t.sku && p.sku.trim().toUpperCase() === t.sku.trim().toUpperCase()) ||
      normalizar(t.nombre) === normalizar(p.nombre) || normalizar(t.nombre) === normalizar(p.marca + ' ' + p.nombre)))
    if (cand) {
      await sql`update productos set tn_product_id = ${cand.tn_product_id}, tn_variant_id = ${cand.tn_variant_id} where id = ${p.id}`
      usados.add(cand.tn_variant_id); vinculados++
    }
  }
  return { vinculados, pendientes: locales.length - vinculados }
}

export async function publicar(ids: number[] | null, opc: { stock: boolean; precio: boolean }) {
  const prods = ids?.length
    ? await sql<Producto[]>`select * from productos where tn_variant_id is not null and id in ${sql(ids)}`
    : await sql<Producto[]>`select * from productos where tn_variant_id is not null`
  const r = { ok: 0, errores: [] as string[] }
  for (const p of prods) {
    const body: Record<string, unknown> = {}
    if (opc.stock) body.stock = Math.max(0, Math.floor(p.stock))
    if (opc.precio) body.price = p.precio.toFixed(2)
    try { await tn('PUT', `/products/${p.tn_product_id}/variants/${p.tn_variant_id}`, body); r.ok++ }
    catch (e) { r.errores.push(`${p.nombre}: ${(e as Error).message}`) }
  }
  return r
}

/** Después de vender o ingresar mercadería, si está activado, actualiza el stock en Tienda Nube */
export async function autoPublicar(ids: number[]) {
  if (!ids.length) return
  const cfg = await getConfig()
  if (cfg.tn_auto_stock !== '1' || !cfg.tn_token) return
  try { await publicar(ids, { stock: true, precio: false }) }
  catch (e) { console.error('No se pudo actualizar stock en Tienda Nube:', (e as Error).message) }
}

type TnOrden = {
  id: number; number: number; status: string; payment_status?: string; created_at: string; paid_at?: string; total: string; shipping_cost_customer?: string
  customer?: { name?: string }; contact_name?: string; gateway_name?: string; shipping_option?: TnTexto
  products?: { product_id?: number | null; variant_id: number | null; sku?: string | null; name: string; price: string; quantity: string | number }[]
}
type ResultadoImportacion = { importadas: number; existentes: number; sinVincular: string[]; errores: string[] }
const nuevoResultado = (): ResultadoImportacion => ({ importadas: 0, existentes: 0, sinVincular: [], errores: [] })

export async function importarOrdenes(desde?: string) {
  const cfg = await getConfig()
  const min = desde || cfg.tn_ultima_importacion || hoyLocal()
  // un día antes por las dudas de la zona horaria: las órdenes ya importadas se saltean
  const antes = new Date(Date.parse(min + 'T00:00:00Z') - 86400000).toISOString()
  const ordenes = await paginado<TnOrden>(`/orders?payment_status=paid&created_at_min=${encodeURIComponent(antes)}`)
  const res = nuevoResultado()
  // las ventas de TN usan el costo cargado en Tienda Nube; el del sistema queda como respaldo
  const costos = ordenes.length ? await costosPorVariante() : new Map<number, number>()
  for (const o of ordenes) await importarUna(o, costos, res)
  await sql`update config set valor = ${hoyLocal()} where clave = 'tn_ultima_importacion'`
  return res
}

/** Importa una sola orden (la usa el aviso automático de Tienda Nube). Solo si está pagada y no cancelada. */
export async function importarOrdenPorId(id: number | string) {
  const o = await tn<TnOrden>('GET', `/orders/${encodeURIComponent(String(id))}`)
  const res = nuevoResultado()
  if (o.payment_status !== 'paid' || o.status === 'cancelled') return res
  await importarUna(o, await costosDeProductos(o), res)
  return res
}

/** Costos de TN solo de los productos de una orden (más rápido que traer todo el catálogo) */
async function costosDeProductos(o: TnOrden) {
  const m = new Map<number, number>()
  const ids = [...new Set((o.products || []).map(p => p.product_id).filter((x): x is number => !!x))]
  for (const pid of ids) {
    try {
      const p = await tn<{ variants?: { id: number; cost?: string | null }[] }>('GET', `/products/${pid}`)
      for (const v of p.variants || []) if (num(v.cost) > 0) m.set(v.id, num(v.cost))
    } catch { /* producto borrado en TN: queda el costo del sistema */ }
  }
  return m
}

async function importarUna(o: TnOrden, costos: Map<number, number>, res: ResultadoImportacion) {
  if (o.status === 'cancelled') return
  const [ya] = await sql`select id from ventas where tn_order_id = ${String(o.id)}`
  if (ya) { res.existentes++; return }
  const items = []
  for (const it of o.products || []) {
    const p = await buscarProducto(it.variant_id, it.sku, it.name)
    if (!p) res.sinVincular.push(`Orden #${o.number}: ${it.name}`)
    const costo = (it.variant_id && costos.get(it.variant_id)) || undefined // undefined → crearVenta usa el costo del sistema
    items.push({ producto_id: p ? p.id : null, descripcion: p ? `${p.marca} ${p.nombre}`.trim() : `[TN] ${it.name}`, cantidad: num(it.quantity), precio: num(it.price), costo })
  }
  const subtotal = items.reduce((a, i) => a + i.cantidad * i.precio, 0)
  const envio = num(o.shipping_cost_customer)
  const ajuste = Math.round((num(o.total) - subtotal - envio) * 100) / 100
  // fecha de TN viene con zona horaria: la paso a la hora del negocio
  const f = new Date(o.paid_at || o.created_at)
  const fecha = isNaN(f.getTime()) ? ahoraLocal()
    : new Intl.DateTimeFormat('sv-SE', { timeZone: NEGOCIO.zonaHoraria, dateStyle: 'short', timeStyle: 'short' }).format(f)
  try {
    await crearVenta({
      fecha, cliente_nombre: o.customer?.name || o.contact_name || null,
      medio_pago: 'Tienda Nube' + (o.gateway_name ? ` (${o.gateway_name})` : ''),
      entrega: texto(o.shipping_option) || null, items, envio,
      descuento: ajuste < 0 ? -ajuste : 0, recargo: ajuste > 0 ? ajuste : 0,
      notas: `Orden Tienda Nube #${o.number}`, origen: 'tiendanube', tn_order_id: String(o.id),
    })
    res.importadas++
  } catch (e) {
    // si el aviso llegó dos veces al mismo tiempo, la segunda choca con tn_order_id único: ya está importada
    if ((e as { code?: string }).code === '23505') res.existentes++
    else res.errores.push(`Orden #${o.number}: ${(e as Error).message}`)
  }
}

// ---------- Aviso automático de órdenes pagadas (webhook) ----------
type TnWebhook = { id: number; event: string; url: string }
const EVENTO = 'order/paid'

async function webhooksDeOrdenes() {
  try { return (await tn<TnWebhook[]>('GET', '/webhooks')).filter(w => w.event === EVENTO) }
  catch (e) { if (e instanceof TnError && e.status === 404) return []; throw e }
}

/** Le pide a Tienda Nube que avise a `url` cada vez que se paga una orden (reemplaza avisos viejos a otras URLs) */
export async function activarAviso(url: string) {
  const cfg = await getConfig()
  if (!cfg.tn_client_secret) throw new ErrorUsuario('Guardá el Client Secret de tu app: se usa para verificar que el aviso viene de Tienda Nube')
  if (!url.startsWith('https://') || /localhost|tiendanube|nuvemshop/i.test(url))
    throw new ErrorUsuario(`Tienda Nube no acepta avisos a ${url}: abrí el sistema desde su dirección pública (https) y probá de nuevo`)
  const actuales = await webhooksDeOrdenes()
  for (const w of actuales) if (w.url !== url) await tn('DELETE', `/webhooks/${w.id}`)
  if (!actuales.some(w => w.url === url)) await tn('POST', '/webhooks', { event: EVENTO, url })
  await sql`insert into config (clave, valor) values ('tn_aviso_url', ${url}) on conflict (clave) do update set valor = excluded.valor`
}

export async function desactivarAviso() {
  for (const w of await webhooksDeOrdenes()) await tn('DELETE', `/webhooks/${w.id}`)
  await sql`update config set valor = '' where clave = 'tn_aviso_url'`
}

/** Verifica la firma del aviso: HMAC-SHA256 (hex) del cuerpo tal cual llegó, con el Client Secret de la app */
export async function firmaValida(cuerpo: string, firma: string | null) {
  const cfg = await getConfig()
  if (!cfg.tn_client_secret || !firma) return false
  const esperada = createHmac('sha256', cfg.tn_client_secret).update(cuerpo, 'utf8').digest()
  const recibida = Buffer.from(firma.trim(), 'hex')
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada)
}

export async function tiendaConfigurada() {
  return (await getConfig()).tn_store_id
}

/** Costos cargados en Tienda Nube por variante */
async function costosPorVariante() {
  const m = new Map<number, number>()
  for (const v of await productosTN()) if (v.costo > 0) m.set(v.tn_variant_id, v.costo)
  return m
}

/**
 * Pone en las ventas de Tienda Nube ya importadas el costo cargado hoy en Tienda Nube
 * (si TN no tiene costo para ese producto, usa el del sistema cuando el ítem está en $0). No toca el stock.
 */
export async function recalcularCostos() {
  const items = await sql<{ id: number; venta_id: number; producto_id: number | null; descripcion: string; costo: number; tn_order_id: string | null; fecha: string }[]>`
    select vi.id, vi.venta_id, vi.producto_id, vi.descripcion, vi.costo, v.tn_order_id, to_char(v.fecha, 'YYYY-MM-DD') fecha from venta_items vi
    join ventas v on v.id = vi.venta_id
    where v.origen = 'tiendanube'
    order by vi.id`
  const res = { actualizados: 0, sinCosto: [] as string[] }
  if (!items.length) return res
  const costos = await costosPorVariante()

  // Ítems que se importaron sin vincular: vuelvo a traer sus órdenes para saber qué variante era cada uno
  // (los ítems se guardaron en el mismo orden que vienen en la orden)
  type OP = { variant_id: number | null; sku?: string | null; name: string }
  const variantes = new Map<number, OP>() // venta_item.id → producto de la orden en TN
  const sueltos = items.filter(i => !i.producto_id && i.tn_order_id)
  if (sueltos.length) {
    const desde = sueltos.map(i => i.fecha).sort()[0]
    const antes = new Date(Date.parse(desde + 'T00:00:00Z') - 86400000).toISOString()
    const ordenes = new Map((await paginado<{ id: number; products?: OP[] }>(`/orders?created_at_min=${encodeURIComponent(antes)}`)).map(o => [String(o.id), o]))
    const porVenta = new Map<string, number[]>()
    for (const i of items) if (i.tn_order_id) porVenta.set(i.tn_order_id, [...(porVenta.get(i.tn_order_id) || []), i.id])
    for (const [oid, ids] of porVenta) ids.forEach((id, k) => { const op = ordenes.get(oid)?.products?.[k]; if (op) variantes.set(id, op) })
  }

  const ventas = new Set<number>()
  for (const it of items) {
    const nombre = it.descripcion.replace(/^\[TN\]\s*/, '')
    const [vinculado] = it.producto_id ? await sql<Producto[]>`select * from productos where id = ${it.producto_id}` : []
    const op = variantes.get(it.id)
    const p = vinculado || await buscarProducto(op?.variant_id, op?.sku, op?.name || nombre)
    const variante = op?.variant_id || p?.tn_variant_id
    let costo = (variante && costos.get(Number(variante))) || 0
    if (!costo && !Number(it.costo)) costo = Number(p?.costo) || 0 // sin costo en TN: respaldo del sistema
    if (!costo) { if (!Number(it.costo) && !res.sinCosto.includes(nombre)) res.sinCosto.push(nombre); continue }
    if (costo !== Number(it.costo)) {
      await sql`update venta_items set costo = ${costo} where id = ${it.id}`
      ventas.add(it.venta_id); res.actualizados++
    }
  }
  if (ventas.size) await sql`update ventas v set costo = coalesce((select sum(cantidad * costo) from venta_items where venta_id = v.id), 0)
    where id in ${sql([...ventas])}`
  return res
}
