'use client'

import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type Tema = 'light' | 'dark'

const THEME_KEY = 'tema'
const THEME_EVENT = 'tema-change'
const THEME_TRANSITION_CLASS = 'theme-transition'
const NO_THEME_TRANSITION_CLASS = 'no-theme-transition'

const BG_LIGHT = '#f5f7fa'
const BG_DARK = '#0b1220'

function normalizarTema(value: string | null): Tema {
  return value === 'dark' ? 'dark' : 'light'
}

function getSnapshot(): Tema {
  if (typeof window === 'undefined') return 'light'
  return normalizarTema(window.localStorage.getItem(THEME_KEY))
}

function getServerSnapshot(): Tema {
  return 'light'
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
  const bg = t === 'dark' ? BG_DARK : BG_LIGHT
  root.classList.toggle('dark', t === 'dark')
  root.setAttribute('data-theme', t)
  root.style.backgroundColor = bg
  if (document.body) document.body.style.backgroundColor = bg
}

function activarTransicionTema() {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  root.classList.remove(NO_THEME_TRANSITION_CLASS)
  root.classList.add(THEME_TRANSITION_CLASS)
  setTimeout(() => {
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
    const nuevo: Tema = tema === 'dark' ? 'light' : 'dark'
    window.localStorage.setItem(THEME_KEY, nuevo)
    activarTransicionTema()
    aplicarTema(nuevo)
    window.dispatchEvent(new Event(THEME_EVENT))
  }, [tema])

  return { tema, toggleTema }
}
