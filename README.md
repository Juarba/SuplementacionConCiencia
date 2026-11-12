# Gestión de negocio — plantilla

Sistema de ventas, stock, cuenta corriente, mayoristas, gastos, caja y Tienda Nube para un comercio chico.
Hecho con **Next.js 16 + shadcn/ui**, base de datos **Postgres (Supabase)**, listo para **Vercel**.

Es una plantilla: no trae datos de ningún negocio. Para usarla con uno nuevo, seguí
**Adaptarla a un negocio** y después **Publicarlo**.

## Adaptarla a un negocio

1. **Copiá esta carpeta entera** con el nombre del negocio (sin `node_modules`, `.next` ni `.pglite`).
2. **Editá `src/negocio.ts`**. Ahí está todo lo que cambia de un negocio a otro:
   - `nombre`: nombre en el login y en la pestaña del navegador
   - `locale`, `moneda`, `decimales`, `zonaHoraria`: país, símbolo de plata y hora local
   - `textos`: cómo se llaman las cosas en el rubro. `marca` puede ser "Categoría", "Rubro" o
     "Proveedor"; `mayorista` puede ser "Revendedor", "Mayorista" o "Distribuidor"
   - `entregas`: sugerencias del campo Entrega en Nueva venta
   - `modulos`: apagá lo que el negocio no use (`mayoristas`, `caja`, `tiendanube`)
   - `CONFIG_INICIAL`: medios de pago y categorías de gastos con los que arranca
3. Si el negocio **no está en Argentina**, cambiá también la zona horaria en `db/schema.sql`.
4. **Productos**: `db/seed.sql` trae 5 productos de ejemplo. Reemplazalos por los del negocio
   (mismo formato) o vaciá el archivo y cargalos desde la app.

El dueño puede cambiar después, desde **Configuración** y sin tocar código: el nombre que se ve en el
menú, los medios de pago con sus recargos, el descuento mayorista y las categorías de gastos.

## Publicarlo (una vez por negocio)

### 1. Supabase (base de datos)
1. Creá una cuenta en [supabase.com](https://supabase.com) y un proyecto nuevo. Elegí la región más
   cercana al negocio (para Argentina: **São Paulo, sa-east-1**). Guardá la contraseña de la base que te pide.
2. En el proyecto: **SQL Editor → New query**. Pegá todo el contenido de `db/schema.sql` y tocá **Run**.
3. Otra query nueva: pegá `db/seed.sql` y **Run**.
4. **Project Settings → Database → Connection string → Transaction pooler** (puerto 6543).
   Copiá esa URL y reemplazá `[YOUR-PASSWORD]` por tu contraseña. Esa es tu `DATABASE_URL`.

### 2. GitHub
Subí esta carpeta a un repositorio **privado** de GitHub (uno por negocio).

### 3. Vercel (la aplicación)
1. En [vercel.com](https://vercel.com) → **Add New → Project** → importá el repositorio.
2. En **Environment Variables** cargá las tres de `.env.example`:
   - `DATABASE_URL` → la del paso 1.4
   - `APP_PASSWORD` → la contraseña para entrar al sistema (larga)
   - `SESSION_SECRET` → un texto largo al azar (32+ caracteres)
3. **Deploy**. Te queda una dirección tipo `https://tu-proyecto.vercel.app`.
4. Las funciones corren en São Paulo (`vercel.json` → `gru1`). Si elegiste otra región en Supabase,
   cambiala ahí también para que queden cerca.

### 4. Tienda Nube (opcional)
Entrá al sistema → **Tienda Nube** y seguí los pasos. La URL de redirección que tenés que poner
en tu app de Tienda Nube aparece en esa pantalla (es `https://tu-proyecto.vercel.app/api/tn/callback`).
Si el negocio no vende por Tienda Nube, poné `tiendanube: false` en `src/negocio.ts`.

## Desarrollo en la PC

```bash
npm install
npm run db:local      # Postgres local de prueba (dejar abierto, en otra terminal)
npm run db:setup      # crea tablas y carga los productos de ejemplo
npm run dev           # http://localhost:3000
```

`.env.local` de ejemplo para la base local:

```
DATABASE_URL=postgres://postgres:postgres@127.0.0.1:5433/postgres
DB_POOL_MAX=1
APP_PASSWORD=prueba123
SESSION_SECRET=algo-largo-para-desarrollo-1234567890
```

## Cómo está organizado
- `src/negocio.ts` — **configuración del negocio** (empezá por acá)
- `db/schema.sql`, `db/seed.sql` — estructura de la base y productos de ejemplo
- `src/lib/queries.ts` — lecturas (reportes, caja, saldos)
- `src/lib/ventas.ts` — registrar / anular ventas (transacciones con stock y cuenta corriente)
- `src/lib/format.ts` — formato de plata y fechas, lectura de medios de pago
- `src/lib/tiendanube.ts` — integración con la API de Tienda Nube
- `src/app/actions.ts` — acciones del servidor (todas exigen sesión)
- `src/app/(app)/*` — pantallas

En la base, los mayoristas se guardan con `tipo = 'revendedor'` y la agrupación de productos en la
columna `marca`, se llamen como se llamen en pantalla.

## Cálculos
- **Ganancia bruta** = total vendido − costo de la mercadería − recargos de medios de pago
- **Resultado neto** = ganancia bruta − gastos
- El recargo de un medio de pago se calcula como precio ÷ (1 − recargo). Con 5% → precio ÷ 0,95.
- Todas las fechas se guardan en la **hora local del negocio** (`zonaHoraria` en `src/negocio.ts`).
