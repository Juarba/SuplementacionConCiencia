import 'server-only'
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

export type TnVariante = { tn_product_id: number; tn_variant_id: number; nombre: string; sku: string; precio: number; stock: number | null }

export async function productosTN(): Promise<TnVariante[]> {
  type P = { id: number; name: TnTexto; variants?: { id: number; price: string; stock: number | null; sku: string | null; values?: TnTexto[] }[] }
  const prods = await paginado<P>('/products')
  return prods.flatMap(p => (p.variants || []).map(v => {
    const valores = (v.values || []).map(texto).filter(Boolean).join(' / ')
    return { tn_product_id: p.id, tn_variant_id: v.id, nombre: texto(p.name) + (valores ? ' — ' + valores : ''), sku: v.sku || '', precio: num(v.price), stock: v.stock }
  }))
}

const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

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

export async function importarOrdenes(desde?: string) {
  const cfg = await getConfig()
  const min = desde || cfg.tn_ultima_importacion || hoyLocal()
  type O = {
    id: number; number: number; status: string; created_at: string; paid_at?: string; total: string; shipping_cost_customer?: string
    customer?: { name?: string }; contact_name?: string; gateway_name?: string; shipping_option?: TnTexto
    products?: { variant_id: number | null; name: string; price: string; quantity: string | number }[]
  }
  // un día antes por las dudas de la zona horaria: las órdenes ya importadas se saltean
  const antes = new Date(Date.parse(min + 'T00:00:00Z') - 86400000).toISOString()
  const ordenes = await paginado<O>(`/orders?payment_status=paid&created_at_min=${encodeURIComponent(antes)}`)
  const res = { importadas: 0, existentes: 0, sinVincular: [] as string[], errores: [] as string[] }
  for (const o of ordenes) {
    if (o.status === 'cancelled') continue
    const [ya] = await sql`select id from ventas where tn_order_id = ${String(o.id)}`
    if (ya) { res.existentes++; continue }
    const items = []
    for (const it of o.products || []) {
      const [p] = it.variant_id ? await sql<Producto[]>`select * from productos where tn_variant_id = ${it.variant_id}` : []
      if (!p) res.sinVincular.push(`Orden #${o.number}: ${it.name}`)
      items.push({ producto_id: p ? p.id : null, descripcion: p ? `${p.marca} ${p.nombre}`.trim() : `[TN] ${it.name}`, cantidad: num(it.quantity), precio: num(it.price) })
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
    } catch (e) { res.errores.push(`Orden #${o.number}: ${(e as Error).message}`) }
  }
  await sql`update config set valor = ${hoyLocal()} where clave = 'tn_ultima_importacion'`
  return res
}
