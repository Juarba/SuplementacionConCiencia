import { NextResponse } from 'next/server'
import { requireSession } from '@/lib/auth'
import { sql } from '@/lib/db'
import { ahoraLocal, hoyLocal } from '@/lib/format'
import { NEGOCIO } from '@/negocio'

// Descarga una copia completa de los datos en JSON
export async function GET() {
  await requireSession()
  const out: Record<string, unknown> = { generado: ahoraLocal() }
  for (const t of ['productos', 'clientes', 'ventas', 'venta_items', 'cc_movimientos', 'gastos', 'stock_movs', 'cierres'])
    out[t] = await sql`select * from ${sql(t)} order by id`
  return new NextResponse(JSON.stringify(out, null, 1), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="backup-${NEGOCIO.nombre.normalize('NFD').replace(/[^A-Za-z0-9]+/g, '-').toLowerCase()}-${hoyLocal()}.json"`,
    },
  })
}
