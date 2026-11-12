import type { Metadata } from 'next'
import { getClientes, getProductos } from '@/lib/queries'
import { RevendedoresVista } from './revendedores-vista'
import { NEGOCIO } from '@/negocio'

export const metadata: Metadata = { title: NEGOCIO.textos.mayoristas }

export default async function Revendedores() {
  const [productos, clientes] = await Promise.all([getProductos(), getClientes()])
  return <RevendedoresVista productos={productos.filter(p => p.activo)} revendedores={clientes.filter(c => c.tipo === 'revendedor')} />
}
