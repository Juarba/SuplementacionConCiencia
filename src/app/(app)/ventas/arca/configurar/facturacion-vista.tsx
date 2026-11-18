'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Download, ExternalLink, KeyRound, RefreshCw, ShieldCheck, Upload } from 'lucide-react'
import { toast } from 'sonner'
import {
  arcaGenerarClave, arcaGuardarCertificado, arcaImportarClave, arcaProbar, arcaVerificarPendientes, guardarConfig,
} from '@/app/actions'
import { Confirmar, useAccion } from '@/components/acciones'
import { Campo, NativeSelect, PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { ALICUOTAS_IVA, nombreCbte, numeroCbte } from '@/lib/arca-datos'
import { fechaCorta, money } from '@/lib/format'
import type { InfoCert } from '@/lib/arca'
import type { Comprobante, Config } from '@/lib/types'

function descargar(nombre: string, contenido: string) {
  const url = URL.createObjectURL(new Blob([contenido], { type: 'application/octet-stream' }))
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre })
  a.click()
  URL.revokeObjectURL(url)
}

export function FacturacionVista({ cfg, lista, certHomo, certProd, comprobantes }: {
  cfg: Config; lista: boolean; certHomo: InfoCert | null; certProd: InfoCert | null; comprobantes: Comprobante[]
}) {
  const { pending, run } = useAccion()
  const produccion = cfg.arca_produccion === '1'
  const [f, setF] = useState({
    arca_cuit: cfg.arca_cuit || '', arca_razon_social: cfg.arca_razon_social || '', arca_domicilio: cfg.arca_domicilio || '',
    arca_iibb: cfg.arca_iibb || '', arca_inicio: cfg.arca_inicio || '', arca_condicion: cfg.arca_condicion || 'monotributo',
    arca_pto_vta: cfg.arca_pto_vta || '', arca_alicuota: cfg.arca_alicuota || '21', arca_produccion: cfg.arca_produccion || '0',
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const [alias, setAlias] = useState('gestion')
  const [csr, setCsr] = useState(cfg.arca_csr || '')
  const [clave, setClave] = useState('')
  const [certs, setCerts] = useState({ homo: '', prod: '' })
  const [prueba, setPrueba] = useState<{ entorno: string; servidores: string; ultimo: string } | null>(null)
  const nombreCsr = `${alias || 'gestion'}-${(cfg.arca_cuit || '').replace(/\D/g, '')}.csr`

  return (
    <>
      <PageHeader title="Configurar facturación ARCA" description={
        <span className="flex flex-wrap items-center gap-2">
          {lista ? <Pill tono="ok">Lista para facturar</Pill> : <Pill tono="warn">Falta configurar</Pill>}
          {produccion ? <Pill tono="bad">PRODUCCIÓN: las facturas son reales</Pill> : <Pill>Homologación (pruebas, sin validez fiscal)</Pill>}
        </span>
      }>
        <Button variant="outline" asChild><Link href="/ventas/arca"><ArrowLeft /> Volver a facturación</Link></Button>
      </PageHeader>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>1. Datos fiscales</CardTitle><CardDescription>Salen impresos en cada factura.</CardDescription></CardHeader>
          <CardContent>
            <form className="grid gap-3" onSubmit={e => { e.preventDefault(); run(() => guardarConfig(f)) }}>
              <div className="grid gap-3 sm:grid-cols-2">
                <Campo label="CUIT (sin guiones)"><Input inputMode="numeric" value={f.arca_cuit} onChange={set('arca_cuit')} placeholder="20123456789" /></Campo>
                <Campo label="Condición frente al IVA">
                  <NativeSelect value={f.arca_condicion} onChange={set('arca_condicion')}>
                    <option value="monotributo">Monotributo (Factura C)</option>
                    <option value="responsable_inscripto">Responsable Inscripto (Factura A / B)</option>
                  </NativeSelect>
                </Campo>
              </div>
              <Campo label="Razón social (como figura en ARCA)"><Input value={f.arca_razon_social} onChange={set('arca_razon_social')} /></Campo>
              <Campo label="Domicilio comercial"><Input value={f.arca_domicilio} onChange={set('arca_domicilio')} /></Campo>
              <div className="grid gap-3 sm:grid-cols-3">
                <Campo label="Ingresos Brutos"><Input value={f.arca_iibb} onChange={set('arca_iibb')} placeholder="N° o Exento" /></Campo>
                <Campo label="Inicio de actividades"><Input type="date" value={f.arca_inicio} onChange={set('arca_inicio')} /></Campo>
                <Campo label="Punto de venta (web service)"><Input type="number" min={1} value={f.arca_pto_vta} onChange={set('arca_pto_vta')} /></Campo>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {f.arca_condicion === 'responsable_inscripto' && (
                  <Campo label="Alícuota de IVA de tus productos">
                    <NativeSelect value={f.arca_alicuota} onChange={set('arca_alicuota')}>
                      {Object.keys(ALICUOTAS_IVA).map(a => <option key={a} value={a}>{a.replace('.', ',')}%</option>)}
                    </NativeSelect>
                  </Campo>
                )}
                <Campo label="Entorno">
                  <NativeSelect value={f.arca_produccion} onChange={set('arca_produccion')}>
                    <option value="0">Homologación (pruebas)</option>
                    <option value="1">Producción (facturas reales)</option>
                  </NativeSelect>
                </Campo>
              </div>
              {f.arca_condicion === 'responsable_inscripto' && <p className="text-xs text-muted-foreground">Los precios de venta se toman con IVA incluido: el sistema separa neto e IVA al facturar.</p>}
              <Button type="submit" className="justify-self-start" disabled={pending}>Guardar</Button>
            </form>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>2. Clave privada y pedido de certificado</CardTitle>
            <CardDescription>
              {cfg.arca_key_ok ? <span className="flex items-center gap-1"><ShieldCheck className="size-4 text-emerald-600" /> Clave privada guardada (no sale del servidor).</span>
                : 'Generá la clave acá: se guarda en tu base y te da el archivo .csr para subir a ARCA.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3">
            <div className="flex flex-wrap items-end gap-2">
              <Campo label="Alias del certificado" className="w-48"><Input value={alias} onChange={e => setAlias(e.target.value)} /></Campo>
              {cfg.arca_key_ok ? (
                <Confirmar titulo="¿Generar una clave nueva?" accion="Generar" descripcion="Reemplaza la clave guardada: los certificados que ya pediste dejan de servir y vas a tener que pedir otros en ARCA."
                  onConfirm={() => run(() => arcaGenerarClave(alias), { ok: c => c && setCsr(c) })}>
                  <Button variant="outline" disabled={pending}><KeyRound /> Generar clave nueva</Button>
                </Confirmar>
              ) : (
                <Button disabled={pending} onClick={() => run(() => arcaGenerarClave(alias), { ok: c => c && setCsr(c) })}><KeyRound /> Generar clave y CSR</Button>
              )}
            </div>
            {csr && <>
              <Textarea readOnly rows={5} className="font-mono text-xs" value={csr} />
              <Button variant="outline" className="justify-self-start" onClick={() => descargar(nombreCsr, csr)}><Download /> Descargar {nombreCsr}</Button>
            </>}
            <details className="rounded-lg bg-muted/50 p-3 text-sm">
              <summary className="cursor-pointer font-medium">Ya tengo una clave privada (.key)</summary>
              <form className="mt-2 grid gap-2" onSubmit={e => { e.preventDefault(); run(() => arcaImportarClave(clave), { ok: () => setClave('') }) }}>
                <Textarea rows={4} className="font-mono text-xs" placeholder="-----BEGIN PRIVATE KEY-----" value={clave} onChange={e => setClave(e.target.value)} />
                <Button type="submit" variant="outline" className="justify-self-start" disabled={pending || !clave.trim()}>Guardar clave</Button>
              </form>
            </details>
          </CardContent>
        </Card>
      </div>

      <div className="mb-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>3. Certificado de ARCA</CardTitle><CardDescription>Pegá el contenido del .crt (o subí el archivo). Hay uno para pruebas y otro para producción.</CardDescription></CardHeader>
          <CardContent>
            <Tabs defaultValue={produccion ? 'prod' : 'homo'}>
              <TabsList><TabsTrigger value="homo">Homologación</TabsTrigger><TabsTrigger value="prod">Producción</TabsTrigger></TabsList>
              {(['homo', 'prod'] as const).map(ent => {
                const info = ent === 'homo' ? certHomo : certProd
                return (
                  <TabsContent key={ent} value={ent} className="grid gap-3 pt-2">
                    {info ? (
                      <div className="grid gap-1 rounded-lg bg-muted/50 p-3 text-xs">
                        <div><b>Titular:</b> {info.sujeto}</div>
                        <div><b>Emitido por:</b> {info.emisor}</div>
                        <div className="flex flex-wrap gap-2">
                          <span><b>Vence:</b> {fechaCorta(info.vence)}/{info.vence.slice(0, 4)}</span>
                          {info.vencido && <Pill tono="bad">Vencido</Pill>}
                          {info.coincideClave === false && <Pill tono="bad">No corresponde a la clave guardada</Pill>}
                          {info.coincideClave && !info.vencido && <Pill tono="ok">OK</Pill>}
                        </div>
                      </div>
                    ) : <Vacio>Sin certificado de {ent === 'homo' ? 'homologación' : 'producción'}.</Vacio>}
                    <Textarea rows={4} className="font-mono text-xs" placeholder="-----BEGIN CERTIFICATE-----" value={certs[ent]} onChange={e => setCerts({ ...certs, [ent]: e.target.value })} />
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={pending || !certs[ent].trim()} onClick={() => run(() => arcaGuardarCertificado(ent, certs[ent]), { ok: () => setCerts({ ...certs, [ent]: '' }) })}>Guardar certificado</Button>
                      <Button variant="outline" asChild>
                        <label className="cursor-pointer"><Upload /> Subir .crt
                          <input type="file" accept=".crt,.pem,.cer" className="hidden" onChange={async e => {
                            const file = e.target.files?.[0]
                            if (file) setCerts({ ...certs, [ent]: await file.text() })
                            e.target.value = ''
                          }} />
                        </label>
                      </Button>
                      {info && (
                        <Confirmar titulo="¿Borrar el certificado?" accion="Borrar" onConfirm={() => run(() => arcaGuardarCertificado(ent, ''))}>
                          <Button variant="ghost" disabled={pending}>Borrar</Button>
                        </Confirmar>
                      )}
                    </div>
                  </TabsContent>
                )
              })}
            </Tabs>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>¿Cómo saco el certificado en ARCA?</CardTitle><CardDescription>Se hace una sola vez (el certificado dura 2 años). Entrá con tu clave fiscal en arca.gob.ar.</CardDescription></CardHeader>
          <CardContent className="grid gap-3 text-sm">
            <details open={!certHomo && !certProd} className="rounded-lg bg-muted/50 p-3">
              <summary className="cursor-pointer font-medium">Homologación (para probar sin validez fiscal)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li><b>Administrador de Relaciones de Clave Fiscal</b> → Adherir servicio → ARCA → Servicios interactivos → <b>WSASS – Autogestión Certificados Homologación</b>.</li>
                <li>Entrá a <b>WSASS</b> → <b>Nuevo certificado</b>: poné el alias y pegá el contenido del .csr (paso 2). Copiá el certificado que te da y pegalo acá en la pestaña Homologación.</li>
                <li>En WSASS → <b>Crear autorización a servicio</b>: elegí tu alias, tu CUIT y el servicio <b>wsfe – Facturación Electrónica</b>.</li>
                <li>Punto de venta: en homologación podés usar cualquier número (por ejemplo 1).</li>
              </ol>
            </details>
            <details open={!!certHomo && !certProd} className="rounded-lg bg-muted/50 p-3">
              <summary className="cursor-pointer font-medium">Producción (facturas reales)</summary>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-muted-foreground">
                <li>Clave fiscal <b>nivel 3</b>. Si no aparece, adherí el servicio <b>Administración de Certificados Digitales</b> desde el Administrador de Relaciones.</li>
                <li><b>Administración de Certificados Digitales</b> → Agregar alias → subí el .csr → descargá el certificado (.crt) y subilo acá en la pestaña Producción.</li>
                <li><b>Administrador de Relaciones de Clave Fiscal</b> → Nueva relación → Buscar → ARCA → WebServices → <b>Facturación Electrónica</b>. En &quot;Representante&quot; elegí el certificado (tu alias) y confirmá.</li>
                <li><b>Administración de puntos de venta y domicilios</b> → Agregar un punto de venta nuevo con sistema <b>&quot;Factura Electrónica – Monotributo – Web Services&quot;</b> (monotributo) o <b>&quot;RECE para aplicativo y web services&quot;</b> (responsable inscripto). El de &quot;Comprobantes en línea&quot; no sirve para esto.</li>
                <li>Cargá ese número en <b>Punto de venta</b>, cambiá el entorno a <b>Producción</b> y probá la conexión.</li>
              </ol>
            </details>
          </CardContent>
        </Card>
      </div>

      <Card className="mb-4">
        <CardHeader>
          <CardTitle>4. Probar conexión</CardTitle>
          <CardDescription>Se conecta a ARCA con tu certificado y consulta el último comprobante del punto de venta. No emite nada.</CardDescription>
          <CardAction className="flex flex-wrap gap-2">
            <Button disabled={!lista || pending} onClick={() => { setPrueba(null); run(arcaProbar, { ok: r => r && setPrueba(r) }) }}><ShieldCheck /> Probar conexión</Button>
            <Button variant="outline" disabled={!lista || pending} onClick={() => run(arcaVerificarPendientes, { ok: r => r && toast.success(`${r.revisados} pendientes revisados · ${r.autorizados} estaban autorizados`) })}><RefreshCw /> Verificar pendientes</Button>
          </CardAction>
        </CardHeader>
        {prueba && (
          <CardContent>
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm">
              ✓ Conectado a ARCA ({prueba.entorno}). {prueba.ultimo}.<div className="text-xs text-muted-foreground">Servidores: {prueba.servidores}</div>
            </div>
          </CardContent>
        )}
      </Card>

      <Card>
        <CardHeader><CardTitle>Últimos comprobantes</CardTitle><CardDescription>Para facturar, abrí una venta en <b>Ventas</b> o tildá &quot;Facturar en ARCA&quot; al registrar una venta nueva.</CardDescription></CardHeader>
        <CardContent>
          {!comprobantes.length ? <Vacio>Todavía no se emitió ningún comprobante.</Vacio> : (
            <Table>
              <TableHeader><TableRow><TableHead>Fecha</TableHead><TableHead>Comprobante</TableHead><TableHead>Receptor</TableHead><TableHead>Venta</TableHead><TableHead>CAE</TableHead><TableHead className="text-right">Total</TableHead><TableHead /></TableRow></TableHeader>
              <TableBody>
                {comprobantes.map(c => (
                  <TableRow key={c.id}>
                    <TableCell>{fechaCorta(c.fecha)}</TableCell>
                    <TableCell>
                      {nombreCbte(c.tipo)} {numeroCbte(c.punto_venta, c.numero)}{' '}
                      {!c.produccion && <Pill>prueba</Pill>} {c.estado === 'pendiente' && <Pill tono="warn">pendiente</Pill>}
                    </TableCell>
                    <TableCell className="whitespace-normal">{c.receptor_nombre || 'Consumidor final'}{c.doc_tipo !== 99 && <span className="text-xs text-muted-foreground"> · {c.doc_nro}</span>}</TableCell>
                    <TableCell>{c.venta_id ? `#${c.venta_id}` : '—'}</TableCell>
                    <TableCell className="font-mono text-xs">{c.cae || '—'}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(c.total)}</TableCell>
                    <TableCell>{c.estado === 'autorizado' && <Button size="sm" variant="ghost" asChild><a href={`/comprobante/${c.id}`} target="_blank" rel="noreferrer"><ExternalLink /> Ver</a></Button>}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  )
}
