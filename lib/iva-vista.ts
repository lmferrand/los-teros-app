'use client'

import { useCallback, useSyncExternalStore } from 'react'

// Toggle global "con IVA / sin IVA" para los importes que se muestran.
// Los márgenes siempre se calculan sin IVA; esto solo cambia la VISTA.
// Por defecto: SIN IVA (importes "reales").

const KEY = 'vista-iva'
const EVENT = 'vista-iva-change'

function getSnapshot(): boolean {
  if (typeof window === 'undefined') return false
  return window.localStorage.getItem(KEY) === 'con'
}
function getServerSnapshot(): boolean {
  return false
}
function subscribe(cb: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', cb)
  window.addEventListener(EVENT, cb)
  return () => {
    window.removeEventListener('storage', cb)
    window.removeEventListener(EVENT, cb)
  }
}

export function useVistaIva() {
  const conIva = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setConIva = useCallback((v: boolean) => {
    window.localStorage.setItem(KEY, v ? 'con' : 'sin')
    window.dispatchEvent(new Event(EVENT))
  }, [])

  const toggle = useCallback(() => setConIva(!conIva), [conIva, setConIva])

  return { conIva, setConIva, toggle, etiqueta: conIva ? 'Con IVA' : 'Sin IVA' }
}
