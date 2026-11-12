'use client'

import { useTransition, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import type { Resultado } from '@/lib/types'

/** Ejecuta una server action, muestra el resultado con un toast y refresca la pantalla */
export function useAccion() {
  const [pending, start] = useTransition()
  const router = useRouter()
  function run<T>(fn: () => Promise<Resultado<T>>, opts?: { ok?: (data: T | undefined) => void; mensaje?: string }) {
    start(async () => {
      const r = await fn()
      if (!r.ok) { toast.error(r.error); return }
      const msg = opts?.mensaje ?? r.mensaje
      if (msg) toast.success(msg)
      opts?.ok?.(r.data)
      router.refresh()
    })
  }
  return { pending, run }
}

export function Confirmar({ titulo, descripcion, accion = 'Confirmar', onConfirm, children, destructivo = true }: {
  titulo: string; descripcion?: string; accion?: string; onConfirm: () => void; children: ReactNode; destructivo?: boolean
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          {descripcion && <AlertDialogDescription>{descripcion}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancelar</AlertDialogCancel>
          <AlertDialogAction variant={destructivo ? 'destructive' : 'default'} onClick={onConfirm}>{accion}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
