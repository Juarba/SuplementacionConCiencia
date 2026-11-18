import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { requireSession } from '@/lib/auth'
import { qrComprobante } from '@/lib/arca'
import { TIPOS_CBTE, nombreCbte, nombreCondicion, nombreDoc, numeroCbte } from '@/lib/arca-datos'
import { getComprobante, getConfig } from '@/lib/queries'
import { Imprimir } from './imprimir'

export const metadata: Metadata = { title: 'Comprobante' }

const plata = (v: number) => '$ ' + (Number(v) || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fecha = (f?: string | null) => (f ? `${f.slice(8, 10)}/${f.slice(5, 7)}/${f.slice(0, 4)}` : '')
const cuitFmt = (c: string) => (c.length === 11 ? `${c.slice(0, 2)}-${c.slice(2, 10)}-${c.slice(10)}` : c)

export default async function ComprobantePage({ params }: PageProps<'/comprobante/[id]'>) {
  await requireSession()
  const { id } = await params
  const [c, cfg] = await Promise.all([getComprobante(Number(id)), getConfig()])
  if (!c || c.estado !== 'autorizado') notFound()
  const qr = await qrComprobante(c)
  const t = TIPOS_CBTE[c.tipo]
  const letraA = t.letra === 'A'
  const sinIva = (v: number) => (letraA ? v / (1 + c.alicuota / 100) : v)
  const v = c.venta
  const ajustes = v ? [
    v.descuento ? { d: 'Descuento', m: -v.descuento } : null,
    v.recargo ? { d: 'Recargo', m: v.recargo } : null,
    v.envio ? { d: 'Envío', m: v.envio } : null,
  ].filter(x => !!x) : []
  const monotributo = (cfg.arca_condicion || 'monotributo') === 'monotributo'

  return (
    <div className="min-h-screen bg-neutral-200 py-6 text-black print:bg-white print:py-0">
      <style>{'@page { size: A4; margin: 10mm } @media print { html, body { background: white !important } }'}</style>
      <Imprimir />
      <div className="relative mx-auto w-full max-w-[210mm] bg-white p-8 text-[13px] shadow print:max-w-none print:p-0 print:shadow-none">
        {!c.produccion && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="-rotate-30 text-5xl font-bold text-red-500/20">SIN VALIDEZ FISCAL · PRUEBA</span>
          </div>
        )}
        <div className="mb-1 text-center text-xs font-semibold tracking-widest">ORIGINAL</div>
        <div className="grid grid-cols-[1fr_auto_1fr] border border-black">
          <div className="p-3">
            <div className="text-xl font-bold">{cfg.arca_razon_social}</div>
            <div className="mt-2"><b>Domicilio comercial:</b> {cfg.arca_domicilio}</div>
            <div><b>Condición frente al IVA:</b> {monotributo ? 'Responsable Monotributo' : 'IVA Responsable Inscripto'}</div>
          </div>
          <div className="flex flex-col items-center border-x border-black px-4 pt-1">
            <div className="text-4xl font-bold">{t.letra}</div>
            <div className="text-[10px] font-semibold">COD. {String(c.tipo).padStart(3, '0')}</div>
          </div>
          <div className="p-3">
            <div className="text-xl font-bold uppercase">{t.nombre}</div>
            <div className="mt-2"><b>Punto de venta:</b> {String(c.punto_venta).padStart(5, '0')} &nbsp; <b>Comp. Nro:</b> {String(c.numero).padStart(8, '0')}</div>
            <div><b>Fecha de emisión:</b> {fecha(c.fecha)}</div>
            <div><b>CUIT:</b> {cuitFmt(c.emisor_cuit)}</div>
            {cfg.arca_iibb && <div><b>Ingresos Brutos:</b> {cfg.arca_iibb}</div>}
            {cfg.arca_inicio && <div><b>Inicio de actividades:</b> {fecha(cfg.arca_inicio)}</div>}
          </div>
        </div>

        <div className="mt-2 grid grid-cols-2 gap-x-4 border border-black p-3">
          <div><b>{c.doc_tipo === 99 ? 'Documento' : nombreDoc(c.doc_tipo)}:</b> {c.doc_tipo === 99 ? '—' : [80, 86].includes(c.doc_tipo) ? cuitFmt(c.doc_nro) : c.doc_nro}</div>
          <div><b>Apellido y nombre / Razón social:</b> {c.receptor_nombre || 'Consumidor final'}</div>
          <div><b>Condición frente al IVA:</b> {nombreCondicion(c.condicion_iva)}</div>
          <div><b>Domicilio:</b> {c.receptor_domicilio || '—'}</div>
          <div><b>Condición de venta:</b> {v?.medio_pago || 'Contado'}</div>
          {c.asociado && <div><b>Comprobante asociado:</b> {nombreCbte(c.asociado.tipo)} {numeroCbte(c.asociado.punto_venta, c.asociado.numero)} del {fecha(c.asociado.fecha)}</div>}
        </div>

        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr className="border border-black bg-neutral-100 text-left">
              <th className="p-1.5">Descripción</th><th className="p-1.5 text-right">Cantidad</th>
              <th className="p-1.5 text-right">Precio unit.</th>{letraA && <th className="p-1.5 text-right">IVA</th>}<th className="p-1.5 text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {c.items.length ? c.items.map(i => (
              <tr key={i.id} className="border-b border-neutral-300">
                <td className="p-1.5">{i.descripcion}</td>
                <td className="p-1.5 text-right">{Number(i.cantidad).toLocaleString('es-AR')}</td>
                <td className="p-1.5 text-right">{plata(sinIva(i.precio))}</td>
                {letraA && <td className="p-1.5 text-right">{String(c.alicuota).replace('.', ',')}%</td>}
                <td className="p-1.5 text-right">{plata(sinIva(i.cantidad * i.precio))}</td>
              </tr>
            )) : (
              <tr className="border-b border-neutral-300"><td className="p-1.5">Venta de mercadería</td><td className="p-1.5 text-right">1</td><td className="p-1.5 text-right">{plata(letraA ? c.neto : c.total)}</td>{letraA && <td />}<td className="p-1.5 text-right">{plata(letraA ? c.neto : c.total)}</td></tr>
            )}
            {c.items.length > 0 && ajustes.map(a => (
              <tr key={a.d} className="border-b border-neutral-300">
                <td className="p-1.5">{a.d}</td><td className="p-1.5 text-right">1</td><td className="p-1.5 text-right">{plata(sinIva(a.m))}</td>
                {letraA && <td className="p-1.5 text-right">{String(c.alicuota).replace('.', ',')}%</td>}<td className="p-1.5 text-right">{plata(sinIva(a.m))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-4 ml-auto grid w-80 gap-1 border border-black p-3">
          {letraA ? <>
            <div className="flex justify-between"><span>Importe neto gravado</span><span>{plata(c.neto)}</span></div>
            <div className="flex justify-between"><span>IVA {String(c.alicuota).replace('.', ',')}%</span><span>{plata(c.iva)}</span></div>
          </> : <div className="flex justify-between"><span>Subtotal</span><span>{plata(c.total)}</span></div>}
          <div className="flex justify-between border-t border-black pt-1 text-base font-bold"><span>Importe total</span><span>{plata(c.total)}</span></div>
        </div>
        {t.letra === 'B' && (
          <div className="mt-2 ml-auto w-80 text-xs">
            <b>Régimen de Transparencia Fiscal al Consumidor (Ley 27.743)</b>
            <div className="flex justify-between"><span>IVA contenido</span><span>{plata(c.iva)}</span></div>
          </div>
        )}

        <div className="mt-6 flex items-center gap-4 border-t border-black pt-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="Código QR de ARCA" className="size-32" />
          <div className="flex-1">
            <div className="text-lg font-bold italic">ARCA</div>
            <div className="text-xs">Comprobante autorizado</div>
            {c.observaciones && <div className="mt-1 text-[10px] text-neutral-600">{c.observaciones}</div>}
          </div>
          <div className="text-right">
            <div><b>CAE N°:</b> {c.cae}</div>
            <div><b>Fecha de vto. de CAE:</b> {fecha(c.cae_vto)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
