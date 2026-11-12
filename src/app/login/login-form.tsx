'use client'

import { useActionState } from 'react'
import { login } from '@/app/actions'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { NEGOCIO } from '@/negocio'

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null)
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-bold text-primary-foreground">{NEGOCIO.nombre.charAt(0).toUpperCase()}</div>
        <CardTitle className="text-xl">{NEGOCIO.nombre}</CardTitle>
        <CardDescription>Ingresá la contraseña para continuar</CardDescription>
      </CardHeader>
      <CardContent>
        <form action={action} className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="password">Contraseña</Label>
            <Input id="password" name="password" type="password" autoFocus required />
          </div>
          {state?.error && <p className="text-sm text-destructive">{state.error}</p>}
          <Button type="submit" disabled={pending}>{pending ? 'Ingresando…' : 'Ingresar'}</Button>
        </form>
      </CardContent>
    </Card>
  )
}
