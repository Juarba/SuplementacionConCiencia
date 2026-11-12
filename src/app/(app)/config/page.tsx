import type { Metadata } from 'next'
import { getConfigPublica } from '@/lib/queries'
import { ConfigForm } from './config-form'

export const metadata: Metadata = { title: 'Configuración' }

export default async function Configuracion() {
  return <ConfigForm cfg={await getConfigPublica()} />
}
