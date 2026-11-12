import 'server-only'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { COOKIE, tokenValido } from './session'

/** Cortar si no hay sesión. Usar en cada página y cada server action. */
export async function requireSession() {
  const c = await cookies()
  if (!(await tokenValido(c.get(COOKIE)?.value))) redirect('/login')
}
