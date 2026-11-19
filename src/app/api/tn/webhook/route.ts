import { after, NextResponse, type NextRequest } from 'next/server'
import { firmaValida, importarOrdenPorId, tiendaConfigurada } from '@/lib/tiendanube'

// Tienda Nube avisa acá cada vez que se paga una orden (se activa desde la pantalla Tienda Nube).
// Espera respuesta en menos de 3 segundos: respondo enseguida y la importación corre después.
// Si el aviso llega repetido, la orden no se duplica (tn_order_id es único).
export async function POST(req: NextRequest) {
  const cuerpo = await req.text()
  if (!(await firmaValida(cuerpo, req.headers.get('x-linkedstore-hmac-sha256'))))
    return NextResponse.json({ error: 'firma inválida' }, { status: 401 })

  let aviso: { store_id?: number | string; event?: string; id?: number | string }
  try { aviso = JSON.parse(cuerpo) } catch { return NextResponse.json({ error: 'JSON inválido' }, { status: 400 }) }

  // otro evento u otra tienda: se acepta para que Tienda Nube no lo reintente, pero no se hace nada
  if (aviso.event !== 'order/paid' || !aviso.id || String(aviso.store_id) !== (await tiendaConfigurada()))
    return NextResponse.json({ ok: true, ignorado: true })

  const id = aviso.id
  after(async () => {
    try {
      const r = await importarOrdenPorId(id)
      if (r.errores.length) console.error(`Aviso TN orden ${id}:`, r.errores.join(' · '))
      else console.log(`Aviso TN orden ${id}: ${r.importadas ? 'importada' : 'ya estaba o no está pagada'}`
        + (r.sinVincular.length ? ` · sin vincular: ${r.sinVincular.join(' · ')}` : ''))
    } catch (e) {
      console.error(`Aviso TN orden ${id}: no se pudo importar:`, (e as Error).message)
    }
  })
  return NextResponse.json({ ok: true })
}
