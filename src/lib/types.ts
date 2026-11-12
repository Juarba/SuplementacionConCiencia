export type Producto = {
  id: number; marca: string; nombre: string; sku: string | null
  costo: number; precio: number; precio_revendedor: number | null; precio_revendedor_calc: number
  stock: number; stock_minimo: number; stock_ideal: number; activo: boolean
  tn_product_id: number | null; tn_variant_id: number | null
}
export type Cliente = {
  id: number; nombre: string; telefono: string | null; direccion: string | null
  tipo: 'cliente' | 'revendedor'; descuento: number | null; notas: string | null
  saldo: number; ultima_compra: string | null; total_comprado: number
}
export type VentaItem = { id: number; venta_id: number; producto_id: number | null; descripcion: string; cantidad: number; precio: number; costo: number }
export type Venta = {
  id: number; fecha: string; cliente_id: number | null; cliente_nombre: string | null; tipo_precio: string
  medio_pago: string; entrega: string | null; subtotal: number; descuento: number; recargo: number; envio: number
  total: number; costo: number; notas: string | null; origen: string; tn_order_id: string | null; anulada: boolean
  items: VentaItem[]
}
export type Movimiento = { id: number; cliente_id: number; fecha: string; tipo: 'cargo' | 'pago'; monto: number; descripcion: string | null; venta_id: number | null; medio_pago: string | null; saldo?: number }
export type Gasto = { id: number; fecha: string; categoria: string; descripcion: string | null; monto: number; medio_pago: string | null }
export type StockMov = { id: number; producto_id: number; fecha: string; cantidad: number; motivo: string | null; ref: string | null }
export type Cierre = {
  id: number; fecha: string; efectivo_inicial: number; efectivo_contado: number | null; efectivo_esperado: number | null
  diferencia: number | null; notas: string | null; resumen: { ventas?: { total: number }; ganancia_bruta?: number } | null
}
export type Config = Record<string, string>

export type Resumen = {
  desde: string; hasta: string
  ventas: { cantidad: number; total: number; costo: number; envio: number; descuento: number; recargo: number }
  porMedio: { medio_pago: string; cantidad: number; total: number }[]
  porOrigen: { origen: string; cantidad: number; total: number; ganancia: number }[]
  cobros: { medio_pago: string; total: number }[]
  gastos: number
  gastosPorCategoria: { categoria: string; total: number }[]
  gastosPorMedio: { medio_pago: string; total: number }[]
  topProductos: { descripcion: string; unidades: number; vendido: number; ganancia: number }[]
  porDia: { dia: string; cantidad: number; total: number; ganancia: number; gastos: number }[]
  ganancia_bruta: number; resultado: number; margen: number
}

export type Resultado<T = unknown> = { ok: true; data?: T; mensaje?: string } | { ok: false; error: string }
