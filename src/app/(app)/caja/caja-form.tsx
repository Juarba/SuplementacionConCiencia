'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cerrarCaja } from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { money, signo } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Cierre } from '@/lib/types'

export function FechaCaja({ fecha }: { fecha: string }) {
  const router = useRouter()
  return <Input type="date" className="w-auto" value={fecha} onChange={e => e.target.value && router.push(`/caja?fecha=${e.target.value}`)} />
}

type Efectivo = { inicial: number; ventas: number; cobros: number; gastos: number }

export function ArqueoForm({ fecha, efectivo: ef, cierre }: { fecha: string; efectivo: Efectivo; cierre: Cierre | null }) {
  const { pending, run } = useAccion()
  const [inicial, setInicial] = useState(String(cierre ? cierre.efectivo_inicial : ef.inicial))
  const [contado, setContado] = useState(cierre?.efectivo_contado != null ? String(cierre.efectivo_contado) : '')
  const [notas, setNotas] = useState(cierre?.notas ?? '')
  const esperado = (Number(inicial) || 0) + ef.ventas + ef.cobros - ef.gastos
  const dif = contado === '' ? null : Number(contado) - esperado

  return (
    <form className="grid gap-2 text-sm" onSubmit={e => {
      e.preventDefault()
      run(() => cerrarCaja(fecha, { efectivo_inicial: inicial, efectivo_contado: contado, notas }))
    }}>
      <div className="flex items-center justify-between gap-4"><span>Efectivo inicial</span><Input type="number" step="any" className="w-36 text-right" value={inicial} onChange={e => setInicial(e.target.value)} /></div>
      <Linea label="+ Ventas en efectivo" valor={ef.ventas} />
      <Linea label="+ Cobros en efectivo" valor={ef.cobros} />
      <Linea label="− Gastos en efectivo" valor={ef.gastos} />
      <div className="flex items-baseline justify-between border-t pt-2"><span className="font-medium">Debería haber</span><span className="text-xl font-semibold tabular-nums">{money(esperado)}</span></div>
      <div className="flex items-center justify-between gap-4"><span className="font-medium">Efectivo contado</span><Input type="number" step="any" className="w-36 text-right" placeholder="contá la caja" value={contado} onChange={e => setContado(e.target.value)} /></div>
      <div className="flex justify-between">
        <span>Diferencia</span>
        <span className={cn('font-medium tabular-nums', dif != null && signo(dif))}>{dif == null ? '—' : `${dif > 0.5 ? 'Sobran ' : dif < -0.5 ? 'Faltan ' : ''}${money(Math.abs(dif))}`}</span>
      </div>
      <Campo label="Notas" className="mt-2"><Input value={notas} onChange={e => setNotas(e.target.value)} /></Campo>
      <Button type="submit" className="mt-2" disabled={pending}>{cierre ? 'Actualizar cierre' : 'Cerrar caja'}</Button>
    </form>
  )
}

const Linea = ({ label, valor }: { label: string; valor: number }) => (
  <div className="flex justify-between text-muted-foreground"><span>{label}</span><span className="tabular-nums">{money(valor)}</span></div>
)
