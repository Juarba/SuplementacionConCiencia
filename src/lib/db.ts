import 'server-only'
import { EventEmitter } from 'node:events'
import postgres from 'postgres'
import { attachDatabasePool } from '@vercel/functions'

// Conexión directa a Postgres (Supabase). En Vercel usar la URL del "transaction pooler" (puerto 6543).
// En Vercel cada instancia abre su propio pool: las conexiones ociosas se sueltan rápido para no
// acumular clientes en el pooler de Supabase. Con el transaction pooler (6543) 5 por instancia está bien;
// menos hace que las páginas con muchas consultas (Inicio, Reportes) las ejecuten en fila y tarden.
const prod = process.env.NODE_ENV === 'production'
const IDLE_S = prod ? 10 : 20
const TIMEOUT_MS = 8000 // máximo por query

// Vercel congela la instancia al terminar de responder: si quedan consultas a mitad de camino, la conexión
// queda colgada en Supabase. attachDatabasePool mantiene viva la instancia hasta que el pool se vacía;
// como no conoce a la librería `postgres`, le avisamos de cada consulta con un pool "compatible" (duck typing).
const usoDb = new EventEmitter()
attachDatabasePool({
  config: { idleTimeout: IDLE_S * 1000 + TIMEOUT_MS },
  on: (evento: 'release', fn: (...args: unknown[]) => void) => { usoDb.on(evento, fn) },
})

const crear = () =>
  postgres(process.env.DATABASE_URL!, {
    prepare: false, // requerido por el pooler de Supabase
    // sin pipelining: el transaction pooler de Supabase se desincroniza si le llegan varias consultas
    // seguidas por la misma conexión y quedan las dos puntas esperándose (páginas colgadas 300 s)
    ...({ max_pipeline: 1 } as object), // existe en la librería (src/index.js) pero falta en sus tipos
    max: Number(process.env.DB_POOL_MAX || 5),
    idle_timeout: IDLE_S,
    max_lifetime: 60 * 5,
    connect_timeout: 10,
    ssl: prod ? { rejectUnauthorized: false } : false,
    connection: { statement_timeout: TIMEOUT_MS },
    onnotice: () => {},
    types: {
      // numeric y bigint como number de JS; fechas como texto tal cual están guardadas
      numeric: { to: 1700, from: [1700], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      bigint: { to: 20, from: [20], serialize: (x: number) => String(x), parse: (x: string) => Number(x) },
      fecha: { to: 1114, from: [1082, 1114], serialize: (x: string) => x, parse: (x: string) => x.slice(0, 16) },
    },
  })

/** Avisa a Vercel de cada uso de la base (consultas y transacciones), dentro del contexto del pedido */
const conAviso = (db: ReturnType<typeof crear>) => new Proxy(db, {
  apply: (fn, self, args) => { usoDb.emit('release'); return Reflect.apply(fn, self, args) },
  get: (obj, k, r) => { if (k === 'begin') usoDb.emit('release'); return Reflect.get(obj, k, r) },
})

const g = globalThis as unknown as { __sql?: ReturnType<typeof crear> }
export const sql = g.__sql ?? conAviso(crear())
if (process.env.NODE_ENV !== 'production') g.__sql = sql

/** Una transacción abierta con sql.begin */
export type Tx = postgres.TransactionSql<{ numeric: number; bigint: number; fecha: string }>
