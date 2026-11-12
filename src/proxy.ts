import { NextResponse, type NextRequest } from 'next/server'
import { COOKIE, tokenValido } from '@/lib/session'

// Chequeo rápido: sin sesión válida → pantalla de login.
// (Cada página y acción vuelve a verificar con requireSession.)
export async function proxy(req: NextRequest) {
  if (await tokenValido(req.cookies.get(COOKIE)?.value)) return NextResponse.next()
  return NextResponse.redirect(new URL('/login', req.url))
}

export const config = {
  matcher: ['/((?!login|api/tn/callback|_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
