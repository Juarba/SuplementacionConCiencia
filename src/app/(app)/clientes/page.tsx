import type { Metadata } from 'next'
import { getClientes } from '@/lib/queries'
import { ClientesVista } from './clientes-vista'

export const metadata: Metadata = { title: 'Clientes' }

export default async function Clientes() {
  return <ClientesVista clientes={await getClientes()} />
}
