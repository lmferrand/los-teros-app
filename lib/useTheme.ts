'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Tema = 'dark' | 'light'

const THEME_KEY = 'tema'
const THEME_EVENT = 'tema-change'
const THEME_TRANSITION_CLASS = 'theme-transition'
const NO_THEME_TRANSITION_CLASS = 'no-theme-transition'

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
  const root = document.documentElement
  const bg = t === 'light' ? '#f1f5f9' : '#080b14'
  root.classList.toggle('light', t === 'light')
  root.setAttribute('data-theme', t)
  root.style.backgroundColor = bg
  if (document.body) document.body.style.backgroundColor = bg
}

function activarTransicionTema() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove(NO_THEME_TRANSITION_CLASS)
  root.classList.add(THEME_TRANSITION_CLASS)
  window.setTimeout(() => {
    root.classList.remove(THEME_TRANSITION_CLASS)
  }, 320)
}

export function useTheme() {
  const tema = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    aplicarTema(tema)
    document.documentElement.classList.remove(NO_THEME_TRANSITION_CLASS)
  }, [tema])

  const toggleTema = useCallback(() => {
    const nuevo = tema === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(THEME_KEY, nuevo)
    activarTransicionTema()
    aplicarTema(nuevo)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [tema])

  return { tema, toggleTema }
}
