// Crea las tablas y carga los productos de ejemplo en la base de DATABASE_URL.
// Uso: npm run db:setup   (lee .env.local si existe)
import { readFileSync, existsSync } from 'node:fs'
import postgres from 'postgres'

if (!process.env.DATABASE_URL && existsSync('.env.local')) {
  for (const line of readFileSync('.env.local', 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (ponela en .env.local)')
  process.exit(1)
}

const sql = postgres(process.env.DATABASE_URL, { prepare: false, max: 1, onnotice: () => {} })
try {
  await sql.unsafe(readFileSync(new URL('../db/schema.sql', import.meta.url), 'utf8'))
  await sql.unsafe(readFileSync(new URL('../db/seed.sql', import.meta.url), 'utf8'))
  const [{ n }] = await sql`select count(*)::int n from productos`
  console.log(`Base lista: ${n} productos.`)
} catch (e) {
  console.error('Error preparando la base:', e.message)
  process.exitCode = 1
} finally {
  await sql.end()
}
