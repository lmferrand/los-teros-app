'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

type Tema = 'dark' | 'light'

const THEME_KEY = 'tema'
const THEME_EVENT = 'tema-change'

function normalizarTema(value: string | null): Tema {
  return value === 'light' ? 'light' : 'dark'
}

function getSnapshot(): Tema {
  if (typeof window === 'undefined') return 'dark'
  return normalizarTema(window.localStorage.getItem(THEME_KEY))
}

function getServerSnapshot(): Tema {
  return 'dark'
}

function subscribe(callback: () => void) {
  if (typeof window === 'undefined') return () => {}
  window.addEventListener('storage', callback)
  window.addEventListener(THEME_EVENT, callback)
  return () => {
    window.removeEventListener('storage', callback)
    window.removeEventListener(THEME_EVENT, callback)
  }
}

function aplicarTema(t: Tema) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('light', t === 'light')
  document.documentElement.setAttribute('data-theme', t)
}

export function useTheme() {
  const tema = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    aplicarTema(tema)
  }, [tema])

  const toggleTema = useCallback(() => {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(THEME_KEY, nuevo)
    aplicarTema(nuevo)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [tema])

  return { tema, toggleTema }
}
