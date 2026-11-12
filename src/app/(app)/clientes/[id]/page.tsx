import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { parseMedios } from '@/lib/format'
import { getConfig, getCuenta } from '@/lib/queries'
import { CuentaVista } from './cuenta-vista'

export const metadata: Metadata = { title: 'Cuenta corriente' }

export default async function Cuenta({ params }: PageProps<'/clientes/[id]'>) {
  const { id } = await params
  const [cuenta, cfg] = await Promise.all([getCuenta(Number(id)), getConfig()])
  if (!cuenta) notFound()
  return <CuentaVista {...cuenta} medios={parseMedios(cfg.medios_pago).map(m => m.nombre)} />
}
