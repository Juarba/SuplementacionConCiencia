// Sesión firmada con HMAC (Web Crypto: funciona en proxy y en el servidor)
export const COOKIE = 'sesion'
const DURACION = 30 * 24 * 60 * 60 * 1000 // 30 días

const enc = new TextEncoder()
async function firmar(datos: string) {
  const secreto = process.env.SESSION_SECRET
  if (!secreto || secreto.length < 16) throw new Error('Falta SESSION_SECRET (mínimo 16 caracteres)')
  const key = await crypto.subtle.importKey('raw', enc.encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(datos))
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export async function crearToken() {
  const exp = String(Date.now() + DURACION)
  return { token: `${exp}.${await firmar(exp)}`, expira: new Date(Number(exp)) }
}

export async function tokenValido(token?: string) {
  if (!token) return false
  const [exp, sig] = token.split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const esperada = await firmar(exp)
  if (esperada.length !== sig.length) return false
  let dif = 0
  for (let i = 0; i < sig.length; i++) dif |= sig.charCodeAt(i) ^ esperada.charCodeAt(i)
  return dif === 0
}
