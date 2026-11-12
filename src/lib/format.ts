// Utilidades de formato (sirven en servidor y en el navegador)
import { CONFIG_INICIAL, NEGOCIO } from '@/negocio'

const { locale: L, zonaHoraria: TZ } = NEGOCIO
export const money = (v: number | null | undefined) =>
  NEGOCIO.moneda + ' ' + (Number(v) || 0).toLocaleString(L, { minimumFractionDigits: NEGOCIO.decimales, maximumFractionDigits: NEGOCIO.decimales })
export const pct = (v: number | null | undefined) => ((Number(v) || 0) * 100).toLocaleString(L, { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + '%'
export const numf = (v: number | null | undefined) => (Number(v) || 0).toLocaleString(L, { maximumFractionDigits: 2 })
export const fechaCorta = (f?: string | null) =>
  f ? f.slice(8, 10) + '/' + f.slice(5, 7) + (f.length > 10 ? ' ' + f.slice(11, 16) : '') : ''
export const fechaLarga = (d: Date, opc: Intl.DateTimeFormatOptions = {}) =>
  d.toLocaleDateString(L, { weekday: 'long', day: 'numeric', month: 'long', timeZone: TZ, ...opc })
export const norm = (s?: string | null) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
export const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']
export const nombreMes = (m: string) => MESES[+m.slice(5, 7) - 1] + ' ' + m.slice(0, 4)
export const signo = (v: number) => (v > 0.5 ? 'text-emerald-600 dark:text-emerald-400' : v < -0.5 ? 'text-red-600 dark:text-red-400' : '')

// Medios de pago: se editan en Configuración, uno por línea, "Nombre = recargo%"
export type MedioPago = { nombre: string; recargo: number }
export const CUENTA_CORRIENTE = 'Cuenta corriente'
export function parseMedios(txt?: string | null): MedioPago[] {
  const medios = (txt?.trim() ? txt : CONFIG_INICIAL.medios_pago).split(/\r?\n/).map(l => {
    const [nombre, recargo] = l.split('=').map(s => s.trim())
    return { nombre, recargo: Number(recargo?.replace(',', '.')) || 0 }
  }).filter(m => m.nombre && m.nombre !== CUENTA_CORRIENTE)
  // el cierre de caja cuenta el efectivo por nombre
  if (!medios.some(m => m.nombre === 'Efectivo')) medios.unshift({ nombre: 'Efectivo', recargo: 0 })
  return medios
}

// Fecha y hora del negocio, sin importar la zona horaria del servidor (Vercel corre en UTC)
export function ahoraLocal() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(new Date()).map(x => [x.type, x.value]))
  return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`
}
export const hoyLocal = () => ahoraLocal().slice(0, 10)
export const mesLocal = () => ahoraLocal().slice(0, 7)
export const ultimoDia = (mes: string) => `${mes}-${String(new Date(+mes.slice(0, 4), +mes.slice(5, 7), 0).getDate()).padStart(2, '0')}`
