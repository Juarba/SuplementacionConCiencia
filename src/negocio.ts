// ============================================================================
//  CONFIGURACIÓN DEL NEGOCIO
//  Todo lo que cambia de un negocio a otro está acá. Para adaptar el sistema
//  a un rubro nuevo, empezá por este archivo.
//
//  Lo que el dueño cambia seguido (nombre visible, medios de pago con sus
//  recargos, descuento mayorista, categorías de gastos) se edita desde la
//  pantalla Configuración y se guarda en la base: no hace falta tocar código.
// ============================================================================

export const NEGOCIO = {
  /** Nombre que se ve en el login y en la pestaña del navegador (el del menú se cambia en Configuración) */
  nombre: 'Suplementacion Con Ciencia',

  // ---------- región ----------
  locale: 'es-AR',
  moneda: '$',
  /** Decimales al mostrar plata (0 para pesos, 2 para dólares/euros) */
  decimales: 0,
  /** Zona horaria del negocio. Si la cambiás, cambiala también en db/schema.sql */
  zonaHoraria: 'America/Argentina/Buenos_Aires',

  // ---------- cómo se llaman las cosas en este rubro ----------
  textos: {
    /** Agrupación de productos: Marca, Categoría, Rubro, Proveedor… */
    marca: 'Marca',
    marcas: 'marcas',
    /** Cliente con lista de precios especial: Revendedor, Mayorista, Distribuidor… */
    mayorista: 'Revendedor',
    mayoristas: 'Revendedores',
    /** Ejemplo que aparece en el buscador de productos de Nueva venta */
    ejemploBusqueda: 'ej: remera negra',
    /** Ejemplo de lo que se anota en las notas de una venta */
    ejemploNotas: 'Dirección, teléfono, talle, color…',
  },

  /** Sugerencias del campo "Entrega" en Nueva venta */
  entregas: ['Retira', 'Envío', 'Correo Argentino', 'Andreani'],

  // ---------- secciones que se pueden apagar ----------
  modulos: {
    /** Lista de precios mayorista / revendedores */
    mayoristas: true,
    /** Cierre de caja diario con arqueo de efectivo */
    caja: true,
    /** Integración con Tienda Nube */
    tiendanube: true,
  },
}

/** Valores iniciales de la pantalla Configuración (se usan si todavía no se guardó nada) */
export const CONFIG_INICIAL = {
  /** Uno por línea. "Nombre = 5" aplica 5% de recargo (precio ÷ 0,95). "Efectivo" no se puede quitar: lo usa el cierre de caja */
  medios_pago: ['Efectivo', 'Transferencia', 'Mercado Pago', 'Débito', 'Tarjeta 1 cuota = 5', 'Tarjeta 3 cuotas = 14'].join('\n'),
  categorias_gastos: 'Mercadería,Envíos,Publicidad,Alquiler,Servicios,Impuestos,Sueldos,Comisiones,Otros',
}
