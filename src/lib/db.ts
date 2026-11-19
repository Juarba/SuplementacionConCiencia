import 'server-only'
import postgres from 'postgres'

// Conexión directa a Postgres (Supabase). En Vercel usar la URL del "transaction pooler" (puerto 6543).
// En Vercel cada instancia abre su propio pool: las conexiones ociosas se sueltan rápido para no
// acumular clientes en el pooler de Supabase. Con el transaction pooler (6543) 5 por instancia está bien;
// menos hace que las páginas con muchas consultas (Inicio, Reportes) las ejecuten en fila y tarden.
const prod = process.env.NODE_ENV === 'production'
const crear = () =>
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // requerido por el pooler de Supabase
    max: Number(process.env.DB_POOL_MAX || 5),
    idle_timeout: prod ? 10 : 20,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    ssl: prod ? { rejectUnauthorized: false } : false,
    connection: { statement_timeout: 8000 }, // 8 segundos máximo por query
    onnotice: () => {},
    types: {
      // numeric y bigint como number de JS; fechas como texto tal cual están guardadas
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      fecha: { to: 1114, from: [1082, 1114], serialize: (x: string) => x, parse: (x: string) => x.slice(0, 16) },
    },
  })

const g = globalThis as unknown as { __sql?: ReturnType<typeof crear> }
export const sql = g.__sql ?? crear()
if (process.env.NODE_ENV !== 'production') g.__sql = sql

/** Una transacción abierta con sql.begin */
export type Tx = postgres.TransactionSql<{ numeric: number; bigint: number; fecha: string }>
