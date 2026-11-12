import 'server-only'
import postgres from 'postgres'

// Conexión directa a Postgres (Supabase). En Vercel usar la URL del "transaction pooler" (puerto 6543).
const crear = () =>
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // requerido por el pooler de Supabase
    max: Number(process.env.DB_POOL_MAX || 5),
    idle_timeout: 20,
    connect_timeout: 10,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    connection: { statement_timeout: '8000' }, // 8 segundos máximo por query
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
