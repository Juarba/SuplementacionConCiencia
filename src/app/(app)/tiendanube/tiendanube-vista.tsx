'use client'

import { useState } from 'react'
import { Download, Link2, RefreshCw, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  guardarConfig, tnImportar, tnProbar, tnProductos, tnPublicar, tnUrlAutorizar, tnVincular, tnVincularAuto,
} from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo, NativeSelect, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { fechaCorta, hoyLocal, money, norm, numf } from '@/lib/format'
import type { TnVariante, importarOrdenes } from '@/lib/tiendanube'
import type { Config, Producto } from '@/lib/types'

export function TiendaNubeVista({ cfg, productos, callbackUrl, conectado, error }: {
  cfg: Config; productos: Producto[]; callbackUrl: string; conectado: boolean; error?: string
}) {
  const conectada = !!(cfg.tn_store_id && cfg.tn_token)
  const vinculados = productos.filter(p => p.tn_variant_id).length
  const { pending, run } = useAccion()
  const [f, setF] = useState({
    tn_app_id: cfg.tn_app_id, tn_client_secret: cfg.tn_client_secret, tn_store_id: cfg.tn_store_id, tn_token: cfg.tn_token, tn_email: cfg.tn_email,
  })
  const [auto, setAuto] = useState(cfg.tn_auto_stock === '1')
  const [desde, setDesde] = useState(cfg.tn_ultima_importacion || hoyLocal())
  const [resImp, setResImp] = useState<Awaited<ReturnType<typeof importarOrdenes>> | null>(null)
  const [pubStock, setPubStock] = useState(true)
  const [pubPrecio, setPubPrecio] = useState(false)
  const [resPub, setResPub] = useState<{ ok: number; errores: string[] } | null>(null)
  const [tnProds, setTnProds] = useState<TnVariante[] | null>(null)
  const [filtro, setFiltro] = useState('')
  const [soloSin, setSoloSin] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <>
      <PageHeader title="Tienda Nube" description={
        conectada ? <span className="flex items-center gap-2"><Pill tono="ok">Conectada</Pill> tienda #{cfg.tn_store_id} · {vinculados} de {productos.length} productos vinculados</span>
          : <Pill tono="warn">Sin conectar</Pill>
      } />
      {conectado && <div className="mb-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">¡Listo! Tienda Nube quedó conectada.</div>}
      {error && <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>}

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>1. Conexión</CardTitle><CardDescription>Datos de tu aplicación de Tienda Nube</CardDescription></CardHeader>
          <CardContent className="grid gap-3">
            <details open={!conectada} className="rounded-lg bg-muted/50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">¿Cómo obtengo los datos?</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Entrá a <b>partners.tiendanube.com</b> y creá una aplicación para tu propia tienda.</li>
                <li>En &quot;URL de redirección&quot; poné: <code className="rounded bg-background px-1 text-foreground">{callbackUrl}</code></li>
                <li>Permisos: <b>productos</b> (leer y escribir) y <b>órdenes</b> (leer).</li>
                <li>Copiá el <b>App ID</b> y el <b>Client Secret</b> acá abajo y guardá.</li>
                <li>Tocá &quot;Autorizar en Tienda Nube&quot; e instalá la app. Volvés acá conectada.</li>
              </ol>
              <p className="mt-2 text-muted-foreground">Si ya tenés un access token y el ID de tienda, pegalos directamente.</p>
            </details>
            <form className="grid gap-3" onSubmit={e => { e.preventDefault(); run(() => guardarConfig({ ...f, tn_auto_stock: auto ? '1' : '0' })) }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="App ID"><Input value={f.tn_app_id} onChange={set('tn_app_id')} /></Campo>
                <Campo label="Client Secret"><Input type="password" value={f.tn_client_secret} onChange={set('tn_client_secret')} /></Campo>
                <Campo label="ID de tienda"><Input value={f.tn_store_id} onChange={set('tn_store_id')} /></Campo>
                <Campo label="Access token"><Input type="password" value={f.tn_token} onChange={set('tn_token')} /></Campo>
              </div>
              <Campo label="Tu email (Tienda Nube lo pide para identificar la app)"><Input type="email" value={f.tn_email} onChange={set('tn_email')} /></Campo>
              <Label className="flex items-center gap-2 font-normal"><Checkbox checked={auto} onCheckedChange={v => setAuto(!!v)} /> Actualizar el stock en Tienda Nube automáticamente después de cada venta o ingreso</Label>
              <div className="flex flex-wrap gap-2">
                <Button type="submit" disabled={pending}>Guardar</Button>
                <Button type="button" variant="outline" disabled={!cfg.tn_app_id} onClick={async () => { const u = await tnUrlAutorizar(); if (u) location.href = u }}>Autorizar en Tienda Nube</Button>
                <Button type="button" variant="outline" disabled={!conectada || pending} onClick={() => run(tnProbar, { ok: n => toast.success(`Conectado a "${n}" ✓`) })}>Probar conexión</Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="grid content-start gap-4">
          <Card>
            <CardHeader>
              <CardTitle>2. Importar ventas de la tienda online</CardTitle>
              <CardDescription>Trae las órdenes pagadas como ventas (descuenta stock y suma a caja y ganancias). No duplica las ya importadas.{cfg.tn_ultima_importacion && ` Última: ${fechaCorta(cfg.tn_ultima_importacion)}.`}</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex items-end gap-2">
                <Campo label="Desde"><Input type="date" value={desde} onChange={e => setDesde(e.target.value)} /></Campo>
                <Button disabled={!conectada || pending} onClick={() => { setResImp(null); run(() => tnImportar(desde), { ok: r => setResImp(r ?? null) }) }}><Download /> Importar órdenes</Button>
              </div>
              {resImp && (
                <div className="grid gap-2 text-sm">
                  <div className="rounded-lg bg-muted p-3">{resImp.importadas} órdenes importadas · {resImp.existentes} ya estaban</div>
                  {!!resImp.sinVincular.length && <div className="rounded-lg bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">Sin vincular (se cargaron sin descontar stock):<br />{resImp.sinVincular.join(' · ')}</div>}
                  {!!resImp.errores.length && <div className="rounded-lg bg-destructive/10 p-3 text-destructive">{resImp.errores.join(' · ')}</div>}
                </div>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>3. Publicar stock y precios</CardTitle><CardDescription>Manda el stock y/o precio de los productos vinculados a Tienda Nube.</CardDescription></CardHeader>
            <CardContent className="grid gap-3">
              <div className="flex flex-wrap items-center gap-4">
                <Label className="flex items-center gap-2 font-normal"><Checkbox checked={pubStock} onCheckedChange={v => setPubStock(!!v)} /> Stock</Label>
                <Label className="flex items-center gap-2 font-normal"><Checkbox checked={pubPrecio} onCheckedChange={v => setPubPrecio(!!v)} /> Precio</Label>
                <Button disabled={!conectada || !vinculados || pending} onClick={() => run(() => tnPublicar({ stock: pubStock, precio: pubPrecio }), { ok: r => r && setResPub(r) })}><Upload /> Publicar {vinculados} productos</Button>
              </div>
              {resPub && <div className="rounded-lg bg-muted p-3 text-sm">{resPub.ok} productos actualizados{resPub.errores.length ? ` · errores: ${resPub.errores.join(' · ')}` : ''}</div>}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Vincular productos</CardTitle>
          <CardDescription>Cada producto del sistema con su producto/variante de Tienda Nube.</CardDescription>
          <CardAction className="flex gap-2">
            <Button variant="outline" disabled={!conectada || pending} onClick={() => run(tnProductos, { ok: d => d && setTnProds(d) })}><RefreshCw /> Traer productos de TN</Button>
            <Button variant="outline" disabled={!conectada || pending} onClick={() => run(tnVincularAuto, { ok: r => r && toast.success(`${r.vinculados} vinculados · ${r.pendientes} sin coincidencia`) })}><Link2 /> Vincular automáticamente</Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {!tnProds ? <Vacio>{conectada ? 'Tocá "Traer productos de TN" para vincular a mano.' : 'Conectá la tienda primero.'}</Vacio> : <>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <Input className="max-w-xs" placeholder="Filtrar…" value={filtro} onChange={e => setFiltro(e.target.value)} />
              <Label className="flex items-center gap-2 font-normal"><Checkbox checked={soloSin} onCheckedChange={v => setSoloSin(!!v)} /> Solo sin vincular</Label>
              <span className="text-xs text-muted-foreground">{tnProds.length} productos/variantes en Tienda Nube</span>
            </div>
            <Table>
              <TableHeader><TableRow><TableHead>Producto del sistema</TableHead><TableHead className="text-right">Stock</TableHead><TableHead>Producto en Tienda Nube</TableHead></TableRow></TableHeader>
              <TableBody>
                {productos.filter(p => (!soloSin || !p.tn_variant_id) && (!filtro || norm(`${p.marca} ${p.nombre}`).includes(norm(filtro)))).map(p => (
                  <TableRow key={p.id}>
                    <TableCell className="whitespace-normal"><span className="text-xs text-muted-foreground">{p.marca}</span> {p.nombre}</TableCell>
                    <TableCell className="text-right">{numf(p.stock)}</TableCell>
                    <TableCell>
                      <NativeSelect className="max-w-md" value={p.tn_variant_id ? `${p.tn_product_id}:${p.tn_variant_id}` : ''}
                        onChange={e => {
                          const [tp, tv] = e.target.value ? e.target.value.split(':').map(Number) : [null, null]
                          run(() => tnVincular(p.id, tp, tv), { mensaje: 'Vinculado' })
                        }}>
                        <option value="">— sin vincular —</option>
                        {tnProds.map(t => <option key={t.tn_variant_id} value={`${t.tn_product_id}:${t.tn_variant_id}`}>{t.nombre}{t.sku ? ` [${t.sku}]` : ''} · {money(t.precio)} · stock {t.stock ?? '∞'}</option>)}
                      </NativeSelect>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>}
        </CardContent>
      </Card>
    </>
  )
}
