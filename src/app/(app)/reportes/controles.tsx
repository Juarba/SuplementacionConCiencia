'use client'

import { useRouter } from 'next/navigation'
import { Printer } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

export function SelectorMes({ mes }: { mes: string }) {
  const router = useRouter()
  return <Input type="month" className="w-auto" value={mes} onChange={e => e.target.value && router.push(`/reportes?mes=${e.target.value}`)} />
}

export function Imprimir() {
  return <Button variant="outline" onClick={() => print()}><Printer /> Imprimir / PDF</Button>
}
