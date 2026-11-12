'use client'

import { useState } from 'react'
import { guardarCliente, type ClienteForm } from '@/app/actions'
import { useAccion } from '@/components/acciones'
import { Campo, NativeSelect } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import type { Cliente } from '@/lib/types'
import { NEGOCIO } from '@/negocio'

const T = NEGOCIO.textos

type Props = { open: boolean; onOpenChange: (o: boolean) => void; cliente?: Cliente | null; tipo?: string; onGuardado?: (id?: number) => void }

export function ClienteDialog(props: Props) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      {/* el contenido se monta al abrir, así el formulario arranca limpio cada vez */}
      <DialogContent><Formulario {...props} /></DialogContent>
    </Dialog>
  )
}

function Formulario({ onOpenChange, cliente, tipo = 'cliente', onGuardado }: Props) {
  const { pending, run } = useAccion()
  const [f, setF] = useState<ClienteForm>(() => cliente
    ? { ...cliente, telefono: cliente.telefono ?? '', direccion: cliente.direccion ?? '', descuento: cliente.descuento ?? '', notas: cliente.notas ?? '' }
    : { nombre: '', telefono: '', direccion: '', tipo, descuento: '', notas: '' })
  const set = (k: keyof ClienteForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <>
      <DialogHeader><DialogTitle>{cliente ? 'Editar cliente' : f.tipo === 'revendedor' ? `Nuevo ${T.mayorista.toLowerCase()}` : 'Nuevo cliente'}</DialogTitle></DialogHeader>
      <form
        className="grid gap-3"
        onSubmit={e => {
          e.preventDefault()
          run(() => guardarCliente({ ...f, id: cliente?.id }), { ok: id => { onOpenChange(false); onGuardado?.(id) } })
        }}
      >
        <div className={NEGOCIO.modulos.mayoristas ? 'grid gap-3 sm:grid-cols-[2fr_1fr]' : 'grid gap-3'}>
          <Campo label="Nombre"><Input required value={f.nombre} onChange={set('nombre')} autoFocus /></Campo>
          {NEGOCIO.modulos.mayoristas && <Campo label="Tipo">
            <NativeSelect value={f.tipo} onChange={set('tipo')}><option value="cliente">Cliente</option><option value="revendedor">{T.mayorista}</option></NativeSelect>
          </Campo>}
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Campo label="Teléfono"><Input value={f.telefono ?? ''} onChange={set('telefono')} /></Campo>
          <Campo label="Dirección"><Input value={f.direccion ?? ''} onChange={set('direccion')} /></Campo>
        </div>
        {f.tipo === 'revendedor' && (
          <Campo label={`Descuento especial % sobre precio público (vacío = usa la lista de ${T.mayorista.toLowerCase()})`}>
            <Input type="number" step="any" value={f.descuento ?? ''} onChange={set('descuento')} />
          </Campo>
        )}
        <Campo label="Notas"><Textarea rows={2} value={f.notas ?? ''} onChange={set('notas')} /></Campo>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button type="submit" disabled={pending}>Guardar</Button>
        </DialogFooter>
      </form>
    </>
  )
}
