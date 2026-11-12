import type { ReactNode } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export function PageHeader({ title, description, children }: { title: ReactNode; description?: ReactNode; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description && <div className="text-sm text-muted-foreground">{description}</div>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 print:hidden">{children}</div>}
    </div>
  )
}

export function Kpi({ label, value, hint, className }: { label: string; value: ReactNode; hint?: ReactNode; className?: string }) {
  return (
    <Card className="gap-1 py-4">
      <CardContent className="px-4">
        <div className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</div>
        <div className={cn('mt-1 text-xl font-semibold tabular-nums sm:text-2xl', className)}>{value}</div>
        {hint && <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div>}
      </CardContent>
    </Card>
  )
}

export function Campo({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    // el <label> envuelve al control, así queda asociado (accesibilidad y clic en la etiqueta)
    <label className={cn('grid gap-1.5', className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

const TONOS = {
  ok: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400',
  warn: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  bad: 'bg-red-500/10 text-red-700 dark:text-red-400',
  gray: 'bg-muted text-muted-foreground',
}
export function Pill({ tono = 'gray', className, children, ...props }: React.ComponentProps<'span'> & { tono?: keyof typeof TONOS }) {
  return <span className={cn('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium tabular-nums', TONOS[tono], className)} {...props}>{children}</span>
}
export const tonoStock = (stock: number, minimo: number) => (stock <= 0 ? 'bad' : minimo > 0 && stock <= minimo ? 'warn' : 'ok')

export function Vacio({ children }: { children: ReactNode }) {
  return <div className="py-8 text-center text-sm text-muted-foreground">{children}</div>
}

/** Select nativo con el estilo de los inputs de shadcn (más práctico para listas largas y formularios) */
export function NativeSelect({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      className={cn(
        'h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2 py-1 text-sm outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50 dark:bg-input/30 [&>option]:bg-popover',
        className,
      )}
      {...props}
    />
  )
}
