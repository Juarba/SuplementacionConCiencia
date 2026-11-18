import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { arcaLista, infoCertificado, type InfoCert } from '@/lib/arca'
import { getComprobantes, getConfig, getConfigPublica } from '@/lib/queries'
import { NEGOCIO } from '@/negocio'
import { FacturacionVista } from './facturacion-vista'

export const metadata: Metadata = { title: 'Configurar ARCA' }

const info = (pem?: string, key?: string): InfoCert | null => {
  if (!pem) return null
  try { return infoCertificado(pem, key) } catch { return null }
}

export default async function ConfigurarArca() {
  if (!NEGOCIO.modulos.facturacion) notFound()
  const [cfg, publica, comprobantes] = await Promise.all([getConfig(), getConfigPublica(), getComprobantes(50)])
  return (
    <FacturacionVista
      cfg={publica}
      lista={arcaLista(cfg)}
      certHomo={info(cfg.arca_cert_homo, cfg.arca_key)}
      certProd={info(cfg.arca_cert_prod, cfg.arca_key)}
      comprobantes={comprobantes}
    />
  )
}
