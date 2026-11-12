'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { ClienteDialog } from '@/components/cliente-dialog'
import { PageHeader, Pill, Vacio } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { fechaCorta, money, norm } from '@/lib/format'
import { cn } from '@/lib/utils'
import type { Cliente } from '@/lib/types'
import { NEGOCIO } from '@/negocio'

export function ClientesVista({ clientes }: { clientes: Cliente[] }) {
  const router = useRouter()
  const [tab, setTab] = useState('todos')
  const [buscar, setBuscar] = useState('')
  const [nuevo, setNuevo] = useState(false)
  const deuda = clientes.reduce((a, c) => a + Math.max(0, c.saldo), 0)
  const t = norm(buscar)
  const lista = clientes.filter(c => (tab === 'todos' || (tab === 'deuda' ? Math.abs(c.saldo) > 0.5 : c.tipo === tab)) && (!t || norm(`${c.nombre} ${c.telefono}`).includes(t)))
  return (
    <>
      <PageHeader title="Clientes y cuenta corriente" description={<>{clientes.length} clientes · total a cobrar <b className="text-red-600 dark:text-red-400">{money(deuda)}</b></>}>
        <Button onClick={() => setNuevo(true)}><Plus /> Cliente</Button>
      </PageHeader>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="todos">Todos</TabsTrigger>
            <TabsTrigger value="deuda">Con saldo pendiente</TabsTrigger>
            <TabsTrigger value="cliente">Clientes</TabsTrigger>
            {NEGOCIO.modulos.mayoristas && <TabsTrigger value="revendedor">{NEGOCIO.textos.mayoristas}</TabsTrigger>}
          </TabsList>
        </Tabs>
        <Input className="max-w-xs" placeholder="Buscar…" value={buscar} onChange={e => setBuscar(e.target.value)} />
      </div>
      <Card className="py-0">
        <Table>
          <TableHeader>
            <TableRow><TableHead>Nombre</TableHead><TableHead>Tipo</TableHead><TableHead>Teléfono</TableHead><TableHead>Última compra</TableHead><TableHead className="text-right">Total comprado</TableHead><TableHead className="text-right">Saldo</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {lista.length ? lista.map(c => (
              <TableRow key={c.id} className="cursor-pointer" onClick={() => router.push(`/clientes/${c.id}`)}>
                <TableCell className="font-medium">{c.nombre}</TableCell>
                <TableCell>{c.tipo === 'revendedor' ? <Pill tono="ok">{NEGOCIO.textos.mayorista}</Pill> : <Pill>Cliente</Pill>}</TableCell>
                <TableCell>{c.telefono}</TableCell>
                <TableCell>{fechaCorta(c.ultima_compra)}</TableCell>
                <TableCell className="text-right tabular-nums">{money(c.total_comprado)}</TableCell>
                <TableCell className={cn('text-right tabular-nums', c.saldo > 0.5 ? 'text-red-600 dark:text-red-400' : c.saldo < -0.5 ? 'text-emerald-600' : 'text-muted-foreground')}>
                  {Math.abs(c.saldo) > 0.5 ? `${c.saldo > 0 ? 'Debe' : 'A favor'} ${money(Math.abs(c.saldo))}` : 'Al día'}
                </TableCell>
              </TableRow>
            )) : <TableRow><TableCell colSpan={6}><Vacio>No hay clientes cargados</Vacio></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Card>
      <ClienteDialog open={nuevo} onOpenChange={setNuevo} />
    </>
  )
}
