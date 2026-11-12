'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { guardarConfig } from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo, PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Config } from '@/lib/types'
import { CONFIG_INICIAL, NEGOCIO } from '@/negocio'

const T = NEGOCIO.textos

export function ConfigForm({ cfg }: { cfg: Config }) {
  const { pending, run } = useAccion()
  const [f, setF] = useState({
    negocio: cfg.negocio, medios_pago: cfg.medios_pago || CONFIG_INICIAL.medios_pago,
    descuento_revendedor: cfg.descuento_revendedor, categorias_gastos: cfg.categorias_gastos || CONFIG_INICIAL.categorias_gastos,
  })
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })
  return (
    <>
      <PageHeader title="Configuración" />
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle>General</CardTitle></CardHeader>
          <CardContent>
            <form className="grid gap-4" onSubmit={e => { e.preventDefault(); run(() => guardarConfig(f)) }}>
              <Campo label="Nombre del negocio"><Input value={f.negocio} onChange={set('negocio')} /></Campo>
              <Campo label="Medios de pago (uno por línea)"><Textarea rows={7} className="font-mono text-sm" value={f.medios_pago} onChange={set('medios_pago')} /></Campo>
              <p className="-mt-2 text-xs text-muted-foreground">
                Para cobrar un recargo agregá <b>= porcentaje</b>, ej: <code>Tarjeta 3 cuotas = 14</code> (precio ÷ 0,86).
                &quot;Efectivo&quot; siempre está (lo usa el cierre de caja) y &quot;Cuenta corriente&quot; se agrega sola.
              </p>
              {NEGOCIO.modulos.mayoristas && <>
                <Campo label={`Descuento por defecto para ${T.mayoristas.toLowerCase()} %`}><Input type="number" step="any" value={f.descuento_revendedor} onChange={set('descuento_revendedor')} /></Campo>
                <p className="-mt-2 text-xs text-muted-foreground">Se usa en los productos que no tienen precio de {T.mayorista.toLowerCase()} propio.</p>
              </>}
              <Campo label="Categorías de gastos (separadas por coma)"><Textarea rows={3} value={f.categorias_gastos} onChange={set('categorias_gastos')} /></Campo>
              <Button type="submit" className="justify-self-start" disabled={pending}>Guardar</Button>
            </form>
          </CardContent>
        </Card>
        <Card className="self-start">
          <CardHeader>
            <CardTitle>Copia de seguridad</CardTitle>
            <CardDescription>Descargá todos tus datos en un archivo. Supabase también guarda copias según tu plan.</CardDescription>
          </CardHeader>
          <CardContent><Button variant="outline" asChild><a href="/api/backup"><Download /> Descargar copia (JSON)</a></Button></CardContent>
        </Card>
      </div>
    </>
  )
}
