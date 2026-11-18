// Tablas de ARCA (ex AFIP) para facturación electrónica. Sirven en servidor y en el navegador.

/** Tipos de comprobante (FEParamGetTiposCbte) */
export const TIPOS_CBTE: Record<number, { nombre: string; letra: 'A' | 'B' | 'C'; nc: boolean }> = {
  1: { nombre: 'Factura', letra: 'A', nc: false },
  3: { nombre: 'Nota de crédito', letra: 'A', nc: true },
  6: { nombre: 'Factura', letra: 'B', nc: false },
  8: { nombre: 'Nota de crédito', letra: 'B', nc: true },
  11: { nombre: 'Factura', letra: 'C', nc: false },
  13: { nombre: 'Nota de crédito', letra: 'C', nc: true },
}
export const TIPOS_FACTURA = [1, 6, 11]
/** Qué nota de crédito anula cada factura */
export const NC_DE: Record<number, number> = { 1: 3, 6: 8, 11: 13 }

/** Condición frente al IVA del receptor (FEParamGetCondicionIvaReceptor, obligatorio desde RG 5616) */
export const CONDICIONES_IVA: { id: number; nombre: string }[] = [
  { id: 5, nombre: 'Consumidor final' },
  { id: 1, nombre: 'IVA Responsable Inscripto' },
  { id: 6, nombre: 'Responsable Monotributo' },
  { id: 13, nombre: 'Monotributista Social' },
  { id: 16, nombre: 'Monotributo Trabajador Independiente Promovido' },
  { id: 4, nombre: 'IVA Sujeto Exento' },
  { id: 7, nombre: 'Sujeto no categorizado' },
  { id: 15, nombre: 'IVA no alcanzado' },
  { id: 10, nombre: 'IVA liberado – Ley 19.640' },
  { id: 9, nombre: 'Cliente del exterior' },
  { id: 8, nombre: 'Proveedor del exterior' },
]
/** Un Responsable Inscripto le hace Factura A a estas condiciones (incluye monotributistas, RG 5003); al resto, B */
export const CONDICIONES_FACTURA_A = [1, 6, 13, 16]

/** Tipos de documento (FEParamGetTiposDoc) */
export const DOC_TIPOS: { id: number; nombre: string }[] = [
  { id: 99, nombre: 'Sin identificar' },
  { id: 96, nombre: 'DNI' },
  { id: 80, nombre: 'CUIT' },
  { id: 86, nombre: 'CUIL' },
]

/** Alícuota de IVA → código de ARCA (FEParamGetTiposIva) */
export const ALICUOTAS_IVA: Record<string, number> = { '0': 3, '2.5': 9, '5': 8, '10.5': 4, '21': 5, '27': 6 }

export const nombreCondicion = (id?: number | null) => CONDICIONES_IVA.find(c => c.id === id)?.nombre ?? 'Consumidor final'
export const nombreDoc = (id?: number | null) => DOC_TIPOS.find(d => d.id === id)?.nombre ?? ''
export const nombreCbte = (tipo: number) => (TIPOS_CBTE[tipo] ? `${TIPOS_CBTE[tipo].nombre} ${TIPOS_CBTE[tipo].letra}` : `Comprobante ${tipo}`)
export const numeroCbte = (pv: number, nro: number) => `${String(pv).padStart(5, '0')}-${String(nro).padStart(8, '0')}`

/** Valida el dígito verificador de un CUIT/CUIL */
export function cuitValido(v: string) {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11) return false
  const pesos = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2]
  const suma = pesos.reduce((a, p, i) => a + p * Number(d[i]), 0)
  let dv = 11 - (suma % 11)
  if (dv === 11) dv = 0
  if (dv === 10) dv = 9
  return dv === Number(d[10])
}

export type Receptor = { doc_tipo: number; doc_nro: string; condicion_iva: number; nombre?: string | null; domicilio?: string | null }
