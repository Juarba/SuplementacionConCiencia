import 'server-only'
// Facturación electrónica con ARCA (ex AFIP), directo contra sus web services:
//   WSAA  → autenticación: con el certificado firmamos un pedido y nos da un permiso (token + sign) por 12 h
//   WSFEv1 → factura electrónica: pide el CAE de cada comprobante
// Manuales: https://www.afip.gob.ar/ws/documentacion/ (WSAA y "Factura electrónica – WSFEv1")
import https from 'node:https'
import { generateKeyPairSync } from 'node:crypto'
import forge from 'node-forge'
import { XMLParser } from 'fast-xml-parser'
import QRCode from 'qrcode'
import { sql } from './db'
import { hoyLocal, norm } from './format'
import { getConfig } from './queries'
import { ErrorUsuario } from './ventas'
import {
  ALICUOTAS_IVA, CONDICIONES_FACTURA_A, NC_DE, TIPOS_CBTE, TIPOS_FACTURA, cuitValido, nombreCbte, numeroCbte, type Receptor,
} from './arca-datos'
import type { Comprobante, Config } from './types'

type Entorno = 'homo' | 'prod'
const URLS = {
  homo: { wsaa: 'https://wsaahomo.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://wswhomo.afip.gov.ar/wsfev1/service.asmx' },
  prod: { wsaa: 'https://wsaa.afip.gov.ar/ws/services/LoginCms', wsfe: 'https://servicios1.afip.gov.ar/wsfev1/service.asmx' },
}

// ---------------------------------------------------------------------------
// HTTP / SOAP
// ---------------------------------------------------------------------------

// Los servidores de ARCA usan claves Diffie-Hellman de 1024 bits: con la seguridad por defecto de
// Node (OpenSSL 3) falla con "dh key too small". Bajamos el nivel SOLO para estas conexiones.
const agente = new https.Agent({ keepAlive: true, ciphers: 'DEFAULT@SECLEVEL=1' })

/** Error de red/timeout: no sabemos si ARCA recibió el pedido */
class ErrorRed extends Error {}

function post(url: string, body: string, soapAction: string): Promise<{ status: number; texto: string }> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      method: 'POST', agent: agente, timeout: 30000,
      headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: `"${soapAction}"`, 'Content-Length': Buffer.byteLength(body) },
    }, res => {
      const partes: Buffer[] = []
      res.on('data', c => partes.push(c))
      res.on('end', () => resolve({ status: res.statusCode || 0, texto: Buffer.concat(partes).toString('utf8') }))
      res.on('error', e => reject(new ErrorRed(e.message)))
    })
    req.on('timeout', () => req.destroy(new Error('ARCA no respondió a tiempo')))
    req.on('error', e => reject(new ErrorRed('No se pudo conectar con ARCA: ' + e.message)))
    req.end(body)
  })
}

const LISTAS = new Set(['Obs', 'Err', 'Evt', 'PtoVenta', 'AlicIva', 'CbteAsoc'])
const parser = new XMLParser({ removeNSPrefix: true, ignoreAttributes: true, parseTagValue: false, isArray: n => LISTAS.has(n) })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Nodo = any

async function soap(url: string, accion: string, sobre: string): Promise<Nodo> {
  const { status, texto } = await post(url, sobre, accion)
  let x: Nodo
  try { x = parser.parse(texto) } catch { x = null }
  const body = x?.Envelope?.Body
  if (!body) throw new ErrorRed(`ARCA respondió algo inesperado (HTTP ${status}): ${texto.replace(/<[^>]+>/g, ' ').trim().slice(0, 200)}`)
  if (body.Fault) throw new ErrorUsuario('ARCA: ' + (body.Fault.faultstring || JSON.stringify(body.Fault)))
  return body
}

// ---------------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------------

export type DatosArca = {
  cuit: string; entorno: Entorno; produccion: boolean; pv: number; key: string; cert: string
  monotributo: boolean; alicuota: number
}

export function datosArca(cfg: Config): DatosArca {
  const cuit = (cfg.arca_cuit || '').replace(/\D/g, '')
  const entorno: Entorno = cfg.arca_produccion === '1' ? 'prod' : 'homo'
  const d = {
    cuit, entorno, produccion: entorno === 'prod', pv: Number(cfg.arca_pto_vta) || 0,
    key: cfg.arca_key || '', cert: cfg[`arca_cert_${entorno}`] || '',
    monotributo: (cfg.arca_condicion || 'monotributo') === 'monotributo', alicuota: Number(cfg.arca_alicuota ?? 21),
  }
  if (!cuitValido(cuit)) throw new ErrorUsuario('La facturación no está configurada (falta un CUIT válido)')
  if (!d.pv) throw new ErrorUsuario('La facturación no está configurada (falta el punto de venta)')
  if (!d.key) throw new ErrorUsuario('La facturación no está configurada (falta la clave privada)')
  if (!d.cert) throw new ErrorUsuario(`La facturación no está configurada (falta el certificado de ${d.produccion ? 'producción' : 'homologación'})`)
  if (!d.monotributo && !(String(d.alicuota) in ALICUOTAS_IVA)) throw new ErrorUsuario('Alícuota de IVA inválida')
  return d
}

const guardar = (clave: string, valor: string) =>
  sql`insert into config (clave, valor) values (${clave}, ${valor}) on conflict (clave) do update set valor = excluded.valor`

// ---------------------------------------------------------------------------
// Clave privada, pedido de certificado (CSR) y certificado
// ---------------------------------------------------------------------------

/** Genera una clave RSA 2048 nueva y el CSR para subir a ARCA. La clave queda guardada en la base. */
export async function generarClave(alias: string) {
  const cfg = await getConfig()
  const cuit = (cfg.arca_cuit || '').replace(/\D/g, '')
  if (!cuitValido(cuit)) throw new ErrorUsuario('Guardá primero un CUIT válido')
  const razon = cfg.arca_razon_social?.trim()
  if (!razon) throw new ErrorUsuario('Guardá primero la razón social')
  const aliasOk = norm(alias || 'gestion').replace(/[^a-z0-9]/g, '') || 'gestion'
  const { privateKey } = generateKeyPairSync('rsa', {
    modulusLength: 2048, publicKeyEncoding: { type: 'spki', format: 'pem' }, privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
  })
  const csr = crearCsr(privateKey, cuit, razon, aliasOk)
  await sql.begin(async tx => {
    for (const [k, v] of [['arca_key', privateKey], ['arca_csr', csr], ['arca_ta_homo', ''], ['arca_ta_prod', '']])
      await tx`insert into config (clave, valor) values (${k}, ${v}) on conflict (clave) do update set valor = excluded.valor`
  })
  return csr
}

function crearCsr(keyPem: string, cuit: string, razon: string, alias: string) {
  const key = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey
  const csr = forge.pki.createCertificationRequest()
  csr.publicKey = forge.pki.setRsaPublicKey(key.n, key.e)
  // ARCA pide: C=AR, O=razón social, CN=alias, serialNumber=CUIT nnnnnnnnnnn (sin acentos)
  const ascii = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7E]/g, '').slice(0, 64)
  csr.setSubject([
    { shortName: 'C', value: 'AR' },
    { shortName: 'O', value: ascii(razon) },
    { shortName: 'CN', value: alias },
    { name: 'serialNumber', value: `CUIT ${cuit}` },
  ])
  csr.sign(key, forge.md.sha256.create())
  return forge.pki.certificationRequestToPem(csr)
}

/** Para usar una clave que ya tenías (por ejemplo, la que generó tu contador con OpenSSL) */
export async function importarClave(pem: string) {
  const limpio = pem.trim()
  try { forge.pki.privateKeyFromPem(limpio) } catch { throw new ErrorUsuario('Eso no parece una clave privada RSA en formato PEM (-----BEGIN … PRIVATE KEY-----)') }
  await sql.begin(async tx => {
    for (const [k, v] of [['arca_key', limpio], ['arca_csr', ''], ['arca_ta_homo', ''], ['arca_ta_prod', '']])
      await tx`insert into config (clave, valor) values (${k}, ${v}) on conflict (clave) do update set valor = excluded.valor`
  })
}

export type InfoCert = { sujeto: string; emisor: string; vence: string; vencido: boolean; coincideClave: boolean | null }

export function infoCertificado(pem: string, keyPem?: string): InfoCert {
  const c = forge.pki.certificateFromPem(pem)
  const nombre = (attrs: forge.pki.CertificateField[]) => attrs.map(a => `${a.shortName || a.name}=${a.value}`).join(', ')
  let coincideClave: boolean | null = null
  if (keyPem) {
    try {
      const k = forge.pki.privateKeyFromPem(keyPem) as forge.pki.rsa.PrivateKey
      coincideClave = (c.publicKey as forge.pki.rsa.PublicKey).n.equals(k.n)
    } catch { coincideClave = false }
  }
  return { sujeto: nombre(c.subject.attributes), emisor: nombre(c.issuer.attributes), vence: c.validity.notAfter.toISOString().slice(0, 10), vencido: c.validity.notAfter < new Date(), coincideClave }
}

export async function guardarCertificado(entorno: Entorno, pem: string) {
  const limpio = pem.trim()
  if (!limpio) { await guardar(`arca_cert_${entorno}`, ''); return null }
  const cfg = await getConfig()
  let info: InfoCert
  try { info = infoCertificado(limpio, cfg.arca_key) } catch { throw new ErrorUsuario('Eso no parece un certificado en formato PEM (-----BEGIN CERTIFICATE-----)') }
  if (info.coincideClave === false) throw new ErrorUsuario('Ese certificado no corresponde a la clave privada guardada. ¿Lo pediste con el CSR que generaste acá?')
  await sql.begin(async tx => {
    await tx`insert into config (clave, valor) values (${'arca_cert_' + entorno}, ${limpio}) on conflict (clave) do update set valor = excluded.valor`
    await tx`insert into config (clave, valor) values (${'arca_ta_' + entorno}, '') on conflict (clave) do update set valor = excluded.valor`
  })
  return info
}

// ---------------------------------------------------------------------------
// WSAA: permiso de acceso (Ticket de Acceso, dura 12 h)
// ---------------------------------------------------------------------------

type TA = { token: string; sign: string; expira: string }

/** Hora argentina con offset (-03:00), como la espera el WSAA */
const isoAR = (ms: number) => new Date(ms - 3 * 3600e3).toISOString().slice(0, 19) + '-03:00'

function firmarCms(contenido: string, certPem: string, keyPem: string) {
  const cert = forge.pki.certificateFromPem(certPem)
  const p7 = forge.pkcs7.createSignedData()
  p7.content = forge.util.createBuffer(contenido, 'utf8')
  p7.addCertificate(cert)
  p7.addSigner({
    key: forge.pki.privateKeyFromPem(keyPem), certificate: cert, digestAlgorithm: forge.pki.oids.sha256,
    authenticatedAttributes: [
      { type: forge.pki.oids.contentType, value: forge.pki.oids.data },
      { type: forge.pki.oids.messageDigest },
      // @types/node-forge declara value como string, pero forge espera un Date para signingTime
      { type: forge.pki.oids.signingTime, value: new Date() as unknown as string },
    ],
  })
  p7.sign()
  return forge.util.encode64(forge.asn1.toDer(p7.toAsn1()).getBytes())
}

const taVigente = (raw?: string): TA | null => {
  if (!raw) return null
  try { const ta = JSON.parse(raw) as TA; return Date.parse(ta.expira) - Date.now() > 5 * 60e3 ? ta : null } catch { return null }
}

async function credenciales(d: DatosArca, forzar = false): Promise<TA> {
  const clave = `arca_ta_${d.entorno}`
  if (!forzar) {
    const [fila] = await sql<{ valor: string }[]>`select valor from config where clave = ${clave}`
    const ta = taVigente(fila?.valor)
    if (ta) return ta
  }
  // ARCA no entrega un permiso nuevo mientras el anterior siga vigente: si dos pedidos piden a la vez,
  // el segundo queda bloqueado hasta 12 h. Por eso lo sacamos de a uno (lock en la base).
  return sql.begin(async tx => {
    await tx`select pg_advisory_xact_lock(4747001)`
    const [fila] = await tx<{ valor: string }[]>`select valor from config where clave = ${clave}`
    const previo = taVigente(fila?.valor)
    if (previo && !forzar) return previo
    const ahora = Date.now()
    const tra = '<?xml version="1.0" encoding="UTF-8"?><loginTicketRequest version="1.0"><header>' +
      `<uniqueId>${Math.floor(ahora / 1000)}</uniqueId><generationTime>${isoAR(ahora - 10 * 60e3)}</generationTime>` +
      `<expirationTime>${isoAR(ahora + 10 * 60e3)}</expirationTime></header><service>wsfe</service></loginTicketRequest>`
    let cms: string
    try { cms = firmarCms(tra, d.cert, d.key) } catch (e) { throw new ErrorUsuario('No se pudo firmar con el certificado/clave guardados: ' + (e as Error).message) }
    const sobre = '<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:wsaa="http://wsaa.view.sua.dvadac.desein.afip.gov">' +
      `<soapenv:Header/><soapenv:Body><wsaa:loginCms><wsaa:in0>${cms}</wsaa:in0></wsaa:loginCms></soapenv:Body></soapenv:Envelope>`
    let body: Nodo
    try { body = await soap(URLS[d.entorno].wsaa, '', sobre) } catch (e) {
      const m = (e as Error).message
      if (/TA valido/i.test(m)) throw new ErrorUsuario('ARCA ya entregó un permiso que sigue vigente pero no quedó guardado. Hay que esperar a que venza (hasta 12 horas) o usar otro certificado.')
      if (/cms\.cert\.untrusted|cert.*(expired|revoked)/i.test(m)) throw new ErrorUsuario(`El certificado no es válido para ${d.produccion ? 'producción' : 'homologación'} (vencido o de otro entorno). Detalle: ${m}`)
      if (/notAuthorized|no autorizado/i.test(m)) throw new ErrorUsuario('El certificado no está autorizado para Facturación Electrónica (wsfe). Revisá la relación en el Administrador de Relaciones / WSASS. Detalle: ' + m)
      throw e
    }
    const ret = body.loginCmsResponse?.loginCmsReturn
    const lt = ret ? parser.parse(ret)?.loginTicketResponse : null
    if (!lt?.credentials?.token) throw new ErrorUsuario('El WSAA no devolvió credenciales')
    const ta: TA = { token: lt.credentials.token, sign: lt.credentials.sign, expira: lt.header.expirationTime }
    await tx`insert into config (clave, valor) values (${clave}, ${JSON.stringify(ta)}) on conflict (clave) do update set valor = excluded.valor`
    return ta
  })
}

// ---------------------------------------------------------------------------
// WSFEv1
// ---------------------------------------------------------------------------

type ErrArca = { Code: string; Msg: string }
const lista = (r: Nodo, cont: string, item: string): ErrArca[] => r?.[cont]?.[item] || []
const textoErrores = (es: ErrArca[]) => es.map(e => `${e.Code}: ${e.Msg}`).join(' · ')

async function wsfe(d: DatosArca, op: string, interior: string, reintento = false): Promise<Nodo> {
  const ta = await credenciales(d, reintento)
  const sobre = '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body>' +
    `<ar:${op}><ar:Auth><ar:Token>${ta.token}</ar:Token><ar:Sign>${ta.sign}</ar:Sign><ar:Cuit>${d.cuit}</ar:Cuit></ar:Auth>${interior}</ar:${op}>` +
    '</soap:Body></soap:Envelope>'
  const body = await soap(URLS[d.entorno].wsfe, `http://ar.gov.afip.dif.FEV1/${op}`, sobre)
  const r = body[`${op}Response`]?.[`${op}Result`]
  if (!r) throw new ErrorRed(`ARCA no devolvió resultado para ${op}`)
  const errs = lista(r, 'Errors', 'Err')
  // 600: token/sign inválidos o vencidos → pedimos permiso nuevo una vez
  if (!reintento && errs.some(e => String(e.Code) === '600')) return wsfe(d, op, interior, true)
  return r
}

export async function ultimoAutorizado(d: DatosArca, tipo: number): Promise<number> {
  const r = await wsfe(d, 'FECompUltimoAutorizado', `<ar:PtoVta>${d.pv}</ar:PtoVta><ar:CbteTipo>${tipo}</ar:CbteTipo>`)
  const errs = lista(r, 'Errors', 'Err')
  if (errs.length) throw new ErrorUsuario('ARCA: ' + textoErrores(errs))
  return Number(r.CbteNro) || 0
}

type CbteArca = { CodAutorizacion: string; FchVto: string; ImpTotal: string; CbteFch: string; Resultado: string }

export async function consultar(d: DatosArca, tipo: number, numero: number, pv = d.pv): Promise<CbteArca | null> {
  const r = await wsfe(d, 'FECompConsultar',
    `<ar:FeCompConsReq><ar:CbteTipo>${tipo}</ar:CbteTipo><ar:CbteNro>${numero}</ar:CbteNro><ar:PtoVta>${pv}</ar:PtoVta></ar:FeCompConsReq>`)
  const errs = lista(r, 'Errors', 'Err')
  if (errs.some(e => String(e.Code) === '602')) return null // no existe
  if (errs.length) throw new ErrorUsuario('ARCA: ' + textoErrores(errs))
  return r.ResultGet || null
}

/** Prueba de punta a punta: servidores, certificado, permiso y punto de venta */
export async function probar() {
  const cfg = await getConfig()
  const d = datosArca(cfg)
  const dummy = await soap(URLS[d.entorno].wsfe, 'http://ar.gov.afip.dif.FEV1/FEDummy',
    '<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:ar="http://ar.gov.afip.dif.FEV1/"><soap:Body><ar:FEDummy/></soap:Body></soap:Envelope>')
  const s = dummy.FEDummyResponse?.FEDummyResult || {}
  const tipo = d.monotributo ? 11 : 6
  const ultimo = await ultimoAutorizado(d, tipo)
  return {
    entorno: d.produccion ? 'producción' : 'homologación',
    servidores: `app ${s.AppServer} · base ${s.DbServer} · auth ${s.AuthServer}`,
    ultimo: `Último ${nombreCbte(tipo)} en el punto de venta ${d.pv}: ${ultimo ? numeroCbte(d.pv, ultimo) : 'ninguno todavía'}`,
  }
}

// ---------------------------------------------------------------------------
// Emisión
// ---------------------------------------------------------------------------

const yyyymmdd = (f: string) => f.replace(/-/g, '')
const deYyyymmdd = (f: string) => (f && f.length === 8 ? `${f.slice(0, 4)}-${f.slice(4, 6)}-${f.slice(6, 8)}` : null)
const m2 = (v: number) => v.toFixed(2)

/** Separa neto e IVA de un total con IVA incluido (en centavos, para que sumen exacto) */
function montos(total: number, tipo: number, alicuota: number) {
  const cent = Math.round(total * 100)
  if (TIPOS_CBTE[tipo].letra === 'C') return { neto: cent / 100, iva: 0, alicuota: 0 }
  const neto = Math.round(cent / (1 + alicuota / 100))
  return { neto: neto / 100, iva: (cent - neto) / 100, alicuota }
}

type Emision = { tipo: number; venta_id: number | null; total: number; receptor: Receptor; asociado?: Comprobante | null }

function detalleXml(d: DatosArca, c: Emision, numero: number, fecha: string, m: ReturnType<typeof montos>) {
  const r = c.receptor
  // El orden de los elementos tiene que respetar el WSDL
  let x = '<ar:FECAEDetRequest>' +
    '<ar:Concepto>1</ar:Concepto>' + // 1 = productos (no pide fechas de servicio)
    `<ar:DocTipo>${r.doc_tipo}</ar:DocTipo><ar:DocNro>${r.doc_tipo === 99 ? 0 : r.doc_nro.replace(/\D/g, '')}</ar:DocNro>` +
    `<ar:CbteDesde>${numero}</ar:CbteDesde><ar:CbteHasta>${numero}</ar:CbteHasta><ar:CbteFch>${yyyymmdd(fecha)}</ar:CbteFch>` +
    `<ar:ImpTotal>${m2(c.total)}</ar:ImpTotal><ar:ImpTotConc>0.00</ar:ImpTotConc><ar:ImpNeto>${m2(m.neto)}</ar:ImpNeto>` +
    `<ar:ImpOpEx>0.00</ar:ImpOpEx><ar:ImpTrib>0.00</ar:ImpTrib><ar:ImpIVA>${m2(m.iva)}</ar:ImpIVA>` +
    '<ar:MonId>PES</ar:MonId><ar:MonCotiz>1</ar:MonCotiz>' +
    `<ar:CondicionIVAReceptorId>${r.condicion_iva}</ar:CondicionIVAReceptorId>`
  if (c.asociado) {
    const a = c.asociado
    x += `<ar:CbtesAsoc><ar:CbteAsoc><ar:Tipo>${a.tipo}</ar:Tipo><ar:PtoVta>${a.punto_venta}</ar:PtoVta><ar:Nro>${a.numero}</ar:Nro>` +
      `<ar:Cuit>${a.emisor_cuit}</ar:Cuit><ar:CbteFch>${yyyymmdd(a.fecha)}</ar:CbteFch></ar:CbteAsoc></ar:CbtesAsoc>`
  }
  if (TIPOS_CBTE[c.tipo].letra !== 'C')
    x += `<ar:Iva><ar:AlicIva><ar:Id>${ALICUOTAS_IVA[String(m.alicuota)]}</ar:Id><ar:BaseImp>${m2(m.neto)}</ar:BaseImp><ar:Importe>${m2(m.iva)}</ar:Importe></ar:AlicIva></ar:Iva>`
  x += '</ar:FECAEDetRequest>'
  return `<ar:FeCAEReq><ar:FeCabReq><ar:CantReg>1</ar:CantReg><ar:PtoVta>${d.pv}</ar:PtoVta><ar:CbteTipo>${c.tipo}</ar:CbteTipo></ar:FeCabReq>` +
    `<ar:FeDetReq>${x}</ar:FeDetReq></ar:FeCAEReq>`
}

/**
 * Si una emisión anterior se cortó (timeout, se cayó la conexión) el comprobante quedó 'pendiente':
 * le preguntamos a ARCA si llegó a autorizarlo. Si existe, lo completamos con su CAE; si no, lo borramos.
 */
async function resolverPendientes(d: DatosArca, tipo?: number) {
  const pend = await sql<Comprobante[]>`select * from comprobantes where estado = 'pendiente' and produccion = ${d.produccion}
    and emisor_cuit = ${d.cuit} ${tipo ? sql`and tipo = ${tipo}` : sql``} order by id`
  let resueltos = 0
  for (const p of pend) {
    const r = await consultar(d, p.tipo, p.numero, p.punto_venta)
    if (r?.CodAutorizacion && Math.abs(Number(r.ImpTotal) - p.total) < 0.01) {
      await sql`update comprobantes set estado = 'autorizado', cae = ${r.CodAutorizacion}, cae_vto = ${deYyyymmdd(r.FchVto)} where id = ${p.id}`
      resueltos++
    } else {
      await sql`delete from comprobantes where id = ${p.id}`
    }
  }
  return { revisados: pend.length, autorizados: resueltos }
}

/** Antes de facturar una venta: si quedó algo a medias de esa venta, primero lo resolvemos (para no facturar dos veces) */
async function resolverPendientesDeVenta(d: DatosArca, ventaId: number) {
  const [p] = await sql`select 1 from comprobantes where venta_id = ${ventaId} and estado = 'pendiente'`
  if (p) await resolverPendientes(d)
}

export async function verificarPendientes() {
  return resolverPendientes(datosArca(await getConfig()))
}

async function emitir(d: DatosArca, c: Emision): Promise<Comprobante> {
  const r = c.receptor
  if (r.doc_tipo !== 99 && !r.doc_nro.replace(/\D/g, '')) throw new ErrorUsuario('Falta el número de documento del receptor')
  if ([80, 86].includes(r.doc_tipo) && !cuitValido(r.doc_nro)) throw new ErrorUsuario('El CUIT/CUIL del receptor no es válido')
  if (TIPOS_CBTE[c.tipo].letra === 'A' && r.doc_tipo !== 80) throw new ErrorUsuario('Para Factura A el receptor tiene que tener CUIT')
  if (!(c.total > 0)) throw new ErrorUsuario('El total tiene que ser mayor a cero')

  await resolverPendientes(d, c.tipo)
  const numero = (await ultimoAutorizado(d, c.tipo)) + 1
  const fecha = hoyLocal()
  const m = montos(c.total, c.tipo, d.alicuota)

  // Reservamos el número antes de pedir el CAE: si se corta en el medio, queda 'pendiente' y se verifica después
  let id: number
  try {
    [{ id }] = await sql<{ id: number }[]>`insert into comprobantes
      (venta_id, fecha, tipo, punto_venta, numero, estado, doc_tipo, doc_nro, condicion_iva, receptor_nombre, receptor_domicilio,
       neto, iva, alicuota, total, asociado_id, produccion, emisor_cuit)
      values (${c.venta_id}, ${fecha}, ${c.tipo}, ${d.pv}, ${numero}, 'pendiente', ${r.doc_tipo}, ${r.doc_tipo === 99 ? '0' : r.doc_nro.replace(/\D/g, '')},
        ${r.condicion_iva}, ${r.nombre || null}, ${r.domicilio || null}, ${m.neto}, ${m.iva}, ${m.alicuota}, ${c.total},
        ${c.asociado?.id ?? null}, ${d.produccion}, ${d.cuit})
      returning id`
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw new ErrorUsuario('Se está emitiendo otro comprobante al mismo tiempo. Probá de nuevo en unos segundos.')
    throw e
  }

  let res: Nodo
  try {
    res = await wsfe(d, 'FECAESolicitar', detalleXml(d, c, numero, fecha, m))
  } catch (e) {
    if (e instanceof ErrorRed) // no sabemos si llegó: queda pendiente y se verifica en la próxima emisión
      throw new ErrorUsuario(`No se pudo confirmar con ARCA (${e.message}). El comprobante quedó pendiente: se verifica solo la próxima vez que factures, o tocá "Verificar pendientes" en Ventas → Facturar ARCA.`)
    await sql`delete from comprobantes where id = ${id}`
    throw e
  }

  const det = res.FeDetResp?.FECAEDetResponse
  const fila = Array.isArray(det) ? det[0] : det
  const obs = lista(fila, 'Observaciones', 'Obs')
  if (fila?.Resultado === 'A' && fila.CAE) {
    const [cbte] = await sql<Comprobante[]>`update comprobantes set estado = 'autorizado', cae = ${fila.CAE}, cae_vto = ${deYyyymmdd(fila.CAEFchVto)},
      observaciones = ${obs.length ? textoErrores(obs) : null} where id = ${id} returning *`
    return cbte
  }
  await sql`delete from comprobantes where id = ${id}`
  const motivo = textoErrores([...lista(res, 'Errors', 'Err'), ...obs]) || 'sin detalle'
  throw new ErrorUsuario(`ARCA rechazó el comprobante: ${motivo}`)
}

/** Datos del receptor que se proponen al facturar una venta (los del cliente, o consumidor final) */
export async function receptorDeVenta(ventaId: number): Promise<Receptor> {
  const [c] = await sql<{ nombre: string | null; direccion: string | null; doc_tipo: number | null; doc_nro: string | null; condicion_iva: number | null }[]>`
    select coalesce(c.nombre, v.cliente_nombre) nombre, c.direccion, c.doc_tipo, c.doc_nro, c.condicion_iva
    from ventas v left join clientes c on c.id = v.cliente_id where v.id = ${ventaId}`
  if (!c) throw new ErrorUsuario('Venta no encontrada')
  const docTipo = c.doc_tipo && c.doc_nro ? c.doc_tipo : 99
  return { doc_tipo: docTipo, doc_nro: docTipo === 99 ? '0' : c.doc_nro!, condicion_iva: c.condicion_iva || 5, nombre: c.nombre, domicilio: c.direccion }
}

export async function facturarVenta(ventaId: number, receptor?: Receptor) {
  const d = datosArca(await getConfig())
  await resolverPendientesDeVenta(d, ventaId)
  const [v] = await sql<{ id: number; total: number; anulada: boolean }[]>`select id, total, anulada from ventas where id = ${ventaId}`
  if (!v) throw new ErrorUsuario('Venta no encontrada')
  if (v.anulada) throw new ErrorUsuario('La venta está anulada')
  const [ya] = await sql<Comprobante[]>`select * from comprobantes where venta_id = ${ventaId} and tipo in ${sql(TIPOS_FACTURA)}
    and produccion = ${d.produccion} and estado = 'autorizado' and not exists (select 1 from comprobantes nc where nc.asociado_id = comprobantes.id and nc.estado = 'autorizado')`
  if (ya) throw new ErrorUsuario(`La venta ya tiene ${nombreCbte(ya.tipo)} ${numeroCbte(ya.punto_venta, ya.numero)}`)
  const r = receptor ?? await receptorDeVenta(ventaId)
  const rec: Receptor = { ...r, doc_tipo: Number(r.doc_tipo), condicion_iva: Number(r.condicion_iva), doc_nro: String(r.doc_nro ?? '') }
  const tipo = d.monotributo ? 11 : CONDICIONES_FACTURA_A.includes(rec.condicion_iva) ? 1 : 6
  return emitir(d, { tipo, venta_id: ventaId, total: v.total, receptor: rec })
}

/** Emite la nota de crédito que anula la factura de la venta (si tiene). Devuelve null si no había nada que anular. */
export async function notaCreditoVenta(ventaId: number) {
  const cfg = await getConfig()
  const [pend] = await sql`select 1 from comprobantes where venta_id = ${ventaId} and estado = 'pendiente'`
  if (pend) await resolverPendientes(datosArca(cfg))
  const [f] = await sql<Comprobante[]>`select * from comprobantes where venta_id = ${ventaId} and tipo in ${sql(TIPOS_FACTURA)}
    and estado = 'autorizado' and produccion = ${cfg.arca_produccion === '1'}
    and not exists (select 1 from comprobantes nc where nc.asociado_id = comprobantes.id and nc.estado = 'autorizado')
    order by id desc limit 1`
  if (!f) return null
  const d = datosArca(cfg)
  return emitir(d, {
    tipo: NC_DE[f.tipo], venta_id: ventaId, total: f.total, asociado: f,
    receptor: { doc_tipo: f.doc_tipo, doc_nro: f.doc_nro, condicion_iva: f.condicion_iva, nombre: f.receptor_nombre, domicilio: f.receptor_domicilio },
  })
}

/** ¿Está todo cargado como para facturar? (sin conectarse a ARCA) */
export function arcaLista(cfg: Config) {
  try { datosArca(cfg); return true } catch { return false }
}

// ---------------------------------------------------------------------------
// QR (RG 4892): va impreso en cada comprobante
// ---------------------------------------------------------------------------

export function urlQr(c: Comprobante) {
  const datos = {
    ver: 1, fecha: c.fecha, cuit: Number(c.emisor_cuit), ptoVta: c.punto_venta, tipoCmp: c.tipo, nroCmp: c.numero,
    importe: c.total, moneda: 'PES', ctz: 1, tipoDocRec: c.doc_tipo, nroDocRec: Number(c.doc_nro) || 0, tipoCodAut: 'E', codAut: Number(c.cae),
  }
  return 'https://www.afip.gob.ar/fe/qr/?p=' + Buffer.from(JSON.stringify(datos)).toString('base64')
}

export const qrComprobante = (c: Comprobante) => QRCode.toDataURL(urlQr(c), { margin: 1, width: 180, errorCorrectionLevel: 'M' })
