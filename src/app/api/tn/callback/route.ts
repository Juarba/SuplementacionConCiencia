import { NextResponse, type NextRequest } from 'next/server'
import { cookies } from 'next/headers'
import { COOKIE, tokenValido } from '@/lib/session'
import { canjearCodigo } from '@/lib/tiendanube'

// Tienda Nube redirige acá después de que autorizás la app en tu tienda.
export async function GET(req: NextRequest) {
  const destino = new URL('/tiendanube', req.url)
  if (!(await tokenValido((await cookies()).get(COOKIE)?.value))) return NextResponse.redirect(new URL('/login', req.url))
  try {
    await canjearCodigo(req.nextUrl.searchParams.get('code') || '')
    destino.searchParams.set('conectado', '1')
  } catch (e) {
    destino.searchParams.set('error', (e as Error).message)
  }
  return NextResponse.redirect(destino)
}
