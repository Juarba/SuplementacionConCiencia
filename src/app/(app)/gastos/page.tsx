import type { Metadata } from 'next'
import { getConfig, getGastos } from '@/lib/queries'
import { mesLocal, parseMedios, ultimoDia } from '@/lib/format'
import { GastosVista } from './gastos-vista'

export const metadata: Metadata = { title: 'Gastos' }

export default async function Gastos({ searchParams }: PageProps<'/gastos'>) {
  const q = await searchParams
  const mes = typeof q.mes === 'string' && /^\d{4}-\d{2}$/.test(q.mes) ? q.mes : mesLocal()
  const [gastos, cfg] = await Promise.all([getGastos(`${mes}-01`, ultimoDia(mes)), getConfig()])
  const categorias = (cfg.categorias_gastos || '').split(',').map(s => s.trim()).filter(Boolean)
  return <GastosVista mes={mes} gastos={gastos} categorias={categorias} medios={parseMedios(cfg.medios_pago).map(m => m.nombre)} />
}
