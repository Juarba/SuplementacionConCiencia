'use client'

import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function Imprimir() {
  return (
    <div className="mx-auto mb-4 flex max-w-[210mm] justify-end gap-2 print:hidden">
      <Button onClick={() => window.print()}><Printer /> Imprimir / Guardar PDF</Button>
    </div>
  )
}
