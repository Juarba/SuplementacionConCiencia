'use client'

import { useSyncExternalStore } from 'react'

// Tema claro/oscuro: se guarda en localStorage ("tema"); si no hay preferencia sigue al sistema.

const subscribe = (cb: () => void) => {
  const obs = new MutationObserver(cb)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => obs.disconnect()
}

export function useTema() {
  const oscuro = useSyncExternalStore(subscribe, () => document.documentElement.classList.contains('dark'), () => false)
  const alternar = () => {
    const d = !oscuro
    document.documentElement.classList.toggle('dark', d)
    try { localStorage.setItem('tema', d ? 'dark' : 'light') } catch {}
  }
  return { oscuro, alternar }
}
